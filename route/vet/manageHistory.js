import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';

const router = express.Router();

// แสดงหน้าจัดการประวัติการรักษา
router.get('/:booking_id', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.redirect('/');
    }

    const { booking_id } = req.params;
    console.log('🔍 Accessing mg_history with booking_id:', booking_id);
    
    const pool = getPoolPromise(req.session.user_email);

    // ดึงข้อมูลการจองและข้อมูลสัตว์เลี้ยง
    const [bookingResults] = await pool.query(`
      SELECT 
        b.booking_id, 
        b.booking_date, 
        b.time_booking, 
        b.pet_id,
        b.service_id,
        b.cus_id,
        b.status,
        b.customer_type,
        p.pet_name,
        p.pet_gender,
        pt.type as pet_type_name,
        p.img as pet_image,
        c.cus_name as owner_name,
        st.service_type as service_name,
        st.service_price
      FROM booking b
      LEFT JOIN pet p ON b.pet_id = p.pet_id
      LEFT JOIN pet_type pt ON p.type_id = pt.type_id  
      LEFT JOIN customer c ON b.cus_id = c.cus_id
      LEFT JOIN service_type st ON b.service_id = st.service_id
      WHERE b.booking_id = ?
    `, [booking_id]);

    console.log('📋 Booking results:', bookingResults);

    if (bookingResults.length === 0) {
      return res.status(404).send('ไม่พบการจองนี้');
    }

    // ดึงประวัติการรักษาของสัตว์เลี้ยงนี้ - แก้ไข WHERE clause
    const [historyResults] = await pool.query(`
      SELECT 
        th.treatment_id,
        th.pet_weight_kg as weight,
        th.booking_id,
        th.treatment_date,
        th.treatment_details,
        th.vet_id,
        v.vet_name,
        b.service_id,
        st.service_type as service_name,
        b.customer_type,
        p.pet_name
      FROM treatment_history th
      LEFT JOIN veterinarian v ON th.vet_id = v.vet_id
      LEFT JOIN booking b ON th.booking_id = b.booking_id
      LEFT JOIN service_type st ON b.service_id = st.service_id
      LEFT JOIN pet p ON b.pet_id = p.pet_id
      WHERE th.booking_id = ?
      ORDER BY th.treatment_date DESC
    `, [booking_id]); // ใช้ booking_id แทน pet_id

    // ตรวจสอบว่ามีประวัติการรักษาของการจองนี้แล้วหรือไม่
    const hasExistingHistory = historyResults.length > 0;

    console.log('📝 History results:', historyResults);

    res.render('veterinarian/mg_history', {
      booking: bookingResults[0],
      histories: historyResults,
      vetName: req.session.user_name,
      vetId: req.session.vet_id,
      today: new Date().toLocaleDateString('th-TH'),
      hasExistingHistory: hasExistingHistory
    });

  } catch (error) {
    console.error('❌ History page error:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ: ' + error.message);
  }
});

// บันทึกประวัติการรักษา
router.post('/save', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const { 
      booking_id,
      weight, 
      treatment_details 
    } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น (เอา treatment_status ออก)
    if (!booking_id || !weight || !treatment_details) {
      return res.status(400).json({ 
        success: false, 
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' 
      });
    }

    const pool = getPoolPromise(req.session.user_email);

    // ตรวจสอบว่ามีประวัติการรักษาของการจองนี้แล้วหรือไม่
    const [existingHistory] = await pool.query(`
      SELECT treatment_id 
      FROM treatment_history 
      WHERE booking_id = ? AND DATE(treatment_date) = CURDATE()
    `, [booking_id]);

    const treatment_date = new Date().toISOString().split('T')[0];

    if (existingHistory.length > 0) {
      // อัพเดทประวัติที่มีอยู่ (เอา treatment_status ออก)
      await pool.query(`
        UPDATE treatment_history SET
          pet_weight_kg = ?,
          treatment_date = ?,
          treatment_details = ?
        WHERE treatment_id = ?
      `, [
        parseFloat(weight),
        treatment_date,
        treatment_details,
        existingHistory[0].treatment_id
      ]);

      console.log(`✅ Updated treatment history for booking ${booking_id}`);
    } else {
      // เพิ่มประวัติใหม่ - แก้ไขจำนวน placeholder ให้ตรงกัน
      await pool.query(`
        INSERT INTO treatment_history (
          pet_weight_kg, 
          treatment_date, 
          treatment_details, 
          booking_id,
          vet_id
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        parseFloat(weight),
        treatment_date,
        treatment_details,
        booking_id,
        req.session.vet_id
      ]);

      console.log(`✅ Created new treatment history for booking ${booking_id}`);
    }

    // อัพเดทสถานะการจองเป็น "เสร็จสิ้น"
    await pool.query(
      'UPDATE booking SET status = ? WHERE booking_id = ?',
      ['เสร็จสิ้น', booking_id]
    );

    res.json({ 
      success: true, 
      message: 'บันทึกประวัติการรักษาเรียบร้อยแล้ว',
      booking_id: booking_id
    });

  } catch (error) {
    console.error('❌ Save history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการบันทึกประวัติ: ' + error.message 
    });
  }
});

// แก้ไขประวัติการรักษา
router.get('/edit/:treatment_id', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.redirect('/');
    }

    const { treatment_id } = req.params;
    const pool = getPoolPromise(req.session.user_email);

    // ดึงข้อมูลประวัติการรักษาที่จะแก้ไข - แก้ไข JOIN
    const [historyResults] = await pool.query(`
      SELECT 
        th.treatment_id,
        th.pet_weight_kg as weight,
        th.booking_id,
        th.treatment_date,
        th.treatment_details,
        th.vet_id,
        v.vet_name,
        p.pet_name,
        p.pet_gender,
        pt.type as pet_type_name,
        st.service_type as service_name,
        c.cus_name as owner_name
      FROM treatment_history th
      LEFT JOIN veterinarian v ON th.vet_id = v.vet_id
      LEFT JOIN booking b ON th.booking_id = b.booking_id
      LEFT JOIN pet p ON b.pet_id = p.pet_id
      LEFT JOIN pet_type pt ON p.type_id = pt.type_id
      LEFT JOIN service_type st ON b.service_id = st.service_id
      LEFT JOIN customer c ON b.cus_id = c.cus_id
      WHERE th.treatment_id = ?
    `, [treatment_id]);

    if (historyResults.length === 0) {
      return res.status(404).send('ไม่พบประวัติการรักษานี้');
    }

    res.render('veterinarian/history_edit', {
      history: historyResults[0],
      vetName: req.session.user_name,
      vetId: req.session.vet_id
    });

  } catch (error) {
    console.error('❌ Edit history page error:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
  }
});

// อัพเดทประวัติการรักษา
router.post('/edit/:treatment_id', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const { treatment_id } = req.params;
    const { 
      weight, 
      treatment_details 
    } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น (เอา treatment_status ออก)
    if (!weight || !treatment_details) {
      return res.status(400).json({ 
        success: false, 
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' 
      });
    }

    const pool = getPoolPromise(req.session.user_email);

    // อัพเดทประวัติการรักษา (เอา treatment_status และ booking_id ออกจาก UPDATE)
    const [result] = await pool.query(`
      UPDATE treatment_history SET
        pet_weight_kg = ?,
        treatment_details = ?
      WHERE treatment_id = ?
    `, [
      parseFloat(weight),
      treatment_details,
      treatment_id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบประวัติการรักษานี้' 
      });
    }

    console.log(`✅ Updated treatment history ${treatment_id}`);

    res.json({ 
      success: true, 
      message: 'อัพเดทประวัติการรักษาเรียบร้อยแล้ว',
      treatment_id: treatment_id
    });

  } catch (error) {
    console.error('❌ Update history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการอัพเดทประวัติ: ' + error.message 
    });
  }
});

export default router;