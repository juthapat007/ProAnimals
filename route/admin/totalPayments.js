import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';

const router = express.Router();

// ✅ GET: โหลดหน้า total pay
router.get('/', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.redirect('/');
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);
    const bookingId = req.query.booking_id;

    if (!bookingId) {
      return res.status(400).send('ไม่พบ booking_id');
    }

    // ✅ ข้อมูลการจอง
    const [bookingRows] = await pool.query(`
      SELECT 
        booking.*,
        customer.cus_name,
        pet.pet_name,
        pet.pet_gender,
        service_type.service_type,
        service_type.service_price
      FROM booking
      LEFT JOIN customer ON booking.cus_id = customer.cus_id
      LEFT JOIN pet ON booking.pet_id = pet.pet_id
      LEFT JOIN service_type ON booking.service_id = service_type.service_id
      WHERE booking.booking_id = ?
    `, [bookingId]);

    if (bookingRows.length === 0) {
      return res.status(404).send('ไม่พบข้อมูลการจอง ID นี้');
    }
    const booking = bookingRows[0];

    // ✅ ดึง ENUM ของ payment
    const [enumRows] = await pool.query(
      "SHOW COLUMNS FROM treatment_history LIKE 'payment'"
    );
    let enumStr = enumRows[0].Type; // เช่น enum('ค้างชำระ','เงินสด','เงินโอน')
    let paymentOptions = enumStr
      .replace(/enum\(|\)/g, '')
      .replace(/'/g, '')
      .split(',');

    // ✅ ข้อมูลยา (ทั้งหมด สำหรับ search)
    const [medications] = await pool.query(`
      SELECT medication_id, medicine_name, medicine_price, medicine_package
      FROM medication
      ORDER BY medicine_name ASC
    `);
// ส่วนที่ต้องแก้ไขในไฟล์ totalPayments.js

// ✅ ดึงยาที่จ่ายแล้ว - แก้ไขส่วนนี้
const [treatmentRows] = await pool.query(`
  SELECT treatment_id, pay_status, payment
  FROM treatment_history
  WHERE booking_id = ?
  LIMIT 1
`, [bookingId]);

let currentPayment = 'ค้างชำระ'; // default
let paymentDone = false;           // default
let dispensedMeds = [];  // ประกาศตัวแปรก่อน

if (treatmentRows.length > 0) {
  const treatmentId = treatmentRows[0].treatment_id;
  currentPayment = treatmentRows[0].payment;
  paymentDone = treatmentRows[0].pay_status === 'ชำระแล้ว';

  // ดึงยาที่จ่ายแล้ว - ใช้ query เดียวกันกับ medication_order.js
  const [dispensedResult] = await pool.query(`
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
  `, [treatmentId]);

  dispensedMeds = dispensedResult;
}

// คำนวณยอดรวมยาที่จ่ายแล้ว
let totalDispensed = 0;
if (dispensedMeds && dispensedMeds.length > 0) {
  dispensedMeds.forEach(d => totalDispensed += parseFloat(d.total_price));
}

res.render('admin/total_pay', {
  booking,
  medications,
  dispensedMeds,
  totalDispensed, // ✅ เพิ่มตัวแปรนี้
  paymentOptions,
  currentPayment,
  paymentDone,
  admin_name: req.session.user_name,
  admin_id: req.session.admin_id
});


  } catch (err) {
    console.error('❌ Total pay page error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในระบบ: ' + err.message);
  }
});

// ✅ GET: ค้นหายา (API endpoint)
router.get('/search', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const pool = getPoolPromise(req.session.user_email || 'wun@example.com');
    const keyword = req.query.keyword;

    if (!keyword) {
      return res.json([]);
    }

    const [rows] = await pool.query(
      `SELECT medication_id, medicine_name, medicine_price, medicine_package
       FROM medication
       WHERE medication_id LIKE ? OR medicine_name LIKE ?
       ORDER BY medicine_name ASC
       LIMIT 20`,
      [`%${keyword}%`, `%${keyword}%`]
    );

    res.json(rows);

  } catch (err) {
    console.error('❌ Medicine search error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการค้นหา' });
  }
});

// ✅ POST: บันทึกการชำระเงิน
router.post('/', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.redirect('/');
    }

    const { booking_id, payment_method } = req.body;
    const userEmail = req.session.user_email;
    const pool = getPoolPromise(userEmail);

    if (!booking_id) {
      return res.status(400).send("ไม่พบ booking_id");
    }

    // ✅ update treatment_history ให้เป็น ชำระแล้ว
    await pool.query(
      `UPDATE treatment_history
       SET pay_status = 'ชำระแล้ว',
           payment = ? 
       WHERE booking_id = ?`,
      [payment_method, booking_id]
    );

    // console.log(`✅ อัปเดตชำระเงิน booking_id=${booking_id}, method=${payment_method}`);

    res.redirect('/admin/mg_queue');

  } catch (err) {
    console.error("❌ Payment save error:", err);
    res.status(500).send("บันทึกการชำระเงินไม่สำเร็จ: " + err.message);
  }
});

export default router;
