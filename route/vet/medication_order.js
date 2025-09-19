// routes/vet/medication_order.js
import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// GET: หน้า order_medication
router.get('/:treatment_id', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'veterinarian') return res.redirect('/');

    const { treatment_id } = req.params;
    const pool = await getPoolPromise(req.session.user_email);

    // ดึงข้อมูล treatment + booking + owner + service + pet type + vet name
    const [rows] = await pool.query(`
      SELECT 
        th.treatment_id,
        th.booking_id,
        th.treatment_date,
        th.treatment_details,
        b.booking_date,
        b.time_booking,
        b.status,
        b.customer_type,
        p.pet_name,
        p.pet_gender,
        p.img as pet_image,
        pt.type AS pet_type_name,
        v.vet_name,
        st.service_type as service_name,
        st.service_price,
        c.cus_name AS owner_name
      FROM treatment_history th
      LEFT JOIN booking b ON th.booking_id = b.booking_id
      LEFT JOIN pet p ON b.pet_id = p.pet_id
      LEFT JOIN pet_type pt ON p.type_id = pt.type_id
      LEFT JOIN service_type st ON b.service_id = st.service_id
      LEFT JOIN customer c ON b.cus_id = c.cus_id
      LEFT JOIN veterinarian v ON th.vet_id = v.vet_id
      WHERE th.treatment_id = ?
      LIMIT 1
    `, [treatment_id]);

    if (rows.length === 0) return res.status(404).send('ไม่พบข้อมูลการรักษา');

    // ยาที่มีสต็อก > 0
    const [medication] = await pool.query(`
      SELECT medication_id, medicine_name, medicine_package, medicine_price, stock_quantity
      FROM medication
      WHERE stock_quantity > 0
      ORDER BY medicine_name ASC
    `);

    // รายการที่จ่ายแล้ว
    const [dispensedMeds] = await pool.query(`
      SELECT
        d.dispens_id,
        d.medication_id,
        d.quantity,
        d.dispens_date,
        m.medicine_name,
        m.medicine_package,
        m.medicine_price,
        (m.medicine_price * d.quantity) AS total_price
      FROM dispens d
      JOIN medication m ON d.medication_id = m.medication_id
      WHERE d.treatment_id = ?
      ORDER BY d.dispens_date DESC, d.dispens_id DESC
    `, [treatment_id]);

    const medicineTotal = dispensedMeds.reduce((s, r) => s + (+r.total_price || 0), 0);
    const servicePrice = +rows[0].service_price || 0;
    const grandTotal = servicePrice + medicineTotal;

    res.render('veterinarian/order_medication', {
      treatmentId: treatment_id,
      booking: rows[0],
      treatment: rows[0],
      medication,
      dispensedMeds,
      vetName: req.session.user_name || rows[0].vet_name || '',
      vetId: req.session.vet_id || rows[0].vet_id || '',
      medicineTotal,
      grandTotal
    });

  } catch (err) {
    console.error('GET order_medication error:', err);
    res.status(500).send('เกิดข้อผิดพลาด: ' + err.message);
  }
});

// POST: Batch insert
router.post('/save_medications_batch', requireLogin, async (req, res) => {
  let conn;
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    const { treatment_id, medications } = req.body;
    if (!treatment_id || !Array.isArray(medications) || medications.length === 0) {
      return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน: กรุณาเลือกยาอย่างน้อย 1 รายการ' });
    }

    const pool = await getPoolPromise(req.session.user_email);
    conn = await pool.getConnection();

    const valid = [];
    const errors = [];

    // ตรวจสอบทีละรายการ
    for (let i = 0; i < medications.length; i++) {
      const row = medications[i];
      const id = row?.medication_id;
      const q = parseInt(row?.quantity);

      if (!id || !q || q <= 0) { errors.push(`แถวที่ ${i+1}: ข้อมูลไม่ถูกต้อง`); continue; }

      const [stockRes] = await conn.query(
        'SELECT stock_quantity, medicine_name FROM medication WHERE medication_id = ?',
        [id]
      );
      if (stockRes.length === 0) { errors.push(`แถวที่ ${i+1}: ไม่พบรหัสยา ${id}`); continue; }

      const name = stockRes[0].medicine_name;
      const stock = parseInt(stockRes[0].stock_quantity);
      if (q > stock) { errors.push(`${name}: สต็อกไม่พอ (เหลือ ${stock}, ต้องการ ${q})`); continue; }

      

      valid.push({ medication_id: id, quantity: q, medicine_name: name });
    }

    if (errors.length) {
      return res.json({ success: false, message: errors.join('\n') });
    }
    if (valid.length === 0) {
      return res.json({ success: false, message: 'ไม่มียาที่สามารถบันทึกได้' });
    }

await conn.beginTransaction();

try {
  // อัปเดต stock ของทุกยา
  for (const it of valid) {
    await conn.query(
      `UPDATE medication SET stock_quantity = stock_quantity - ? WHERE medication_id = ?`,
      [it.quantity, it.medication_id]
    );
  }

  // insert dispens ทีหลัง
  for (const it of valid) {
    await conn.query(
      `INSERT INTO dispens (treatment_id, medication_id, quantity, dispens_date)
       VALUES (?, ?, ?, CURDATE())`,
      [treatment_id, it.medication_id, it.quantity]
    );
  }

  await conn.commit();
} catch (txErr) {
  await conn.rollback();
  throw txErr;
}


    return res.json({
      success: true,
      message: `บันทึกการจ่ายยา ${valid.length} รายการเรียบร้อยแล้ว`
    });

  } catch (err) {
    console.error('save_medications_batch error:', err);
    return res.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    if (conn) conn.release();
  }
});

// DELETE: ยกเลิกการจ่ายยา 1 รายการ (คืนสต็อก)
router.delete('/remove_medication/:dispensId', requireLogin, async (req, res) => {
  let conn;
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    const dispensId = parseInt(req.params.dispensId);
    if (!dispensId) return res.json({ success:false, message:'รหัสการจ่ายยาไม่ถูกต้อง' });

    const pool = await getPoolPromise(req.session.user_email);
    conn = await pool.getConnection();

    const [rows] = await conn.query(`
      SELECT d.medication_id, d.quantity, m.medicine_name
      FROM dispens d
      JOIN medication m ON d.medication_id = m.medication_id
      WHERE d.dispens_id = ?`, [dispensId]);

    if (rows.length === 0) return res.json({ success:false, message:'ไม่พบรายการที่ต้องการลบ' });

    const { medication_id, quantity, medicine_name } = rows[0];

    await conn.beginTransaction();
    try {
      await conn.query(`DELETE FROM dispens WHERE dispens_id = ?`, [dispensId]);
      await conn.query(`UPDATE medication SET stock_quantity = stock_quantity + ? WHERE medication_id = ?`,
        [quantity, medication_id]);
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    }

    return res.json({ success:true, message:`ยกเลิกการจ่ายยา ${medicine_name} จำนวน ${quantity} หน่วย สำเร็จ` });

  } catch (err) {
    console.error('remove_medication error:', err);
    return res.json({ success:false, message:'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
