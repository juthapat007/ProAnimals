import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';

const router = express.Router();

// หน้าแสดงรายการสัตว์เลี้ยงที่รอการรักษา
router.get('/', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.redirect('/');
    }

    const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
    console.log('📅 Selected date:', selectedDate);

    const pool = getPoolPromise(req.session.user_email);

    // ดึงข้อมูลการจองสำหรับวันที่เลือก
    const [bookingResults] = await pool.query(`
      SELECT 
        b.booking_id,
        b.booking_date,
        b.time_booking,
        b.status,
        b.service_id,
        b.pet_id,
        b.cus_id,
        b.customer_type,
        p.pet_name,
        p.pet_gender,
        p.img as pet_image,
        pt.type as pet_type_name,
        c.cus_name as owner_name,
        st.service_type as service_name,
        st.service_price
      FROM booking b
      LEFT JOIN pet p ON b.pet_id = p.pet_id
      LEFT JOIN pet_type pt ON p.type_id = pt.type_id
      LEFT JOIN customer c ON b.cus_id = c.cus_id
      LEFT JOIN service_type st ON b.service_id = st.service_id
      WHERE DATE(b.booking_date) = ?
      ORDER BY b.time_booking ASC
    `, [selectedDate]);

    console.log(`📋 Found ${bookingResults.length} bookings for ${selectedDate}`);

    res.render('veterinarian/pet_order', {
      bookings: bookingResults,
      selectedDate: selectedDate,
      vetName: req.session.user_name,
      vetId: req.session.vet_id
    });

  } catch (error) {
    console.error('❌ Pet order page error:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
  }
});

// อัพเดทสถานะการจอง
router.post('/booking/:booking_id/status', requireLogin, async (req, res) => {
  console.log("📩 Incoming update:", req.params, req.body);
  try {
    if (req.session.access_type !== 'veterinarian') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const { booking_id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'กรุณาระบุสถานะ' 
      });
    }

    const pool = getPoolPromise(req.session.user_email);

    const [result] = await pool.query(
      'UPDATE booking SET status = ? WHERE booking_id = ?',
      [status, booking_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบการจองนี้' 
      });
    }

    console.log(`✅ Updated booking ${booking_id} status to: ${status}`);

    res.json({ 
      success: true, 
      message: 'อัพเดทสถานะเรียบร้อยแล้ว',
      booking_id: booking_id,
      new_status: status
    });

  } catch (error) {
    console.error('❌ Update status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการอัพเดทสถานะ: ' + error.message 
    });
  }
});

export default router;