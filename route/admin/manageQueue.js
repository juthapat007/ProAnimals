//route/admin/manageQueue.js
import express from 'express';
import moment from 'moment';
import { getPoolPromise } from '../../config/db.js'; // แก้ไข: ใช้ getPoolPromise แทน getPool
import { requireLogin } from '../../middleware/auth.js';

const router = express.Router();

// แสดงหน้ารายการคิว
router.get('/', requireLogin, async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ admin
    if (req.session.access_type !== 'admin') {
      return res.status(403).render('error', {
        message: 'ไม่มีสิทธิ์เข้าถึงหน้านี้'
      });
    }

    const pool = getPoolPromise(req.session.user_email);
    const selectedDate = req.query.date || moment().format('YYYY-MM-DD');

    // ตรวจสอบรูปแบบวันที่
    if (!moment(selectedDate, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).render('error', {
        message: 'รูปแบบวันที่ไม่ถูกต้อง'
      });
    }

    // 1. ดึงข้อมูลคิวตามวันที่
    const bookings = await getBookingsByDate(pool, selectedDate);
    
    // 2. ดึงค่าสถานะที่เป็นไปได้
    const statusOptions = await getStatusOptions(pool);
    
    console.log("📊 Rendering mg_queue with:", {
      bookingsCount: bookings.length,
      selectedDate,
      statusOptionsCount: statusOptions.length
    });
    
    res.render('admin/mg_queue', {
      data: bookings,
      booking: bookings, // เพิ่มสำหรับ backward compatibility
      selectedDate,
      statusOptions,
      moment,
      user_name: req.session.user_name
    });
  } catch (error) {
    console.error('Error in mg_queue route:', error);
    res.status(500).render('error', { 
      message: 'เกิดข้อผิดพลาดในระบบ',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// อัปเดตสถานะคิว
router.post('/update-status', requireLogin, async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ admin
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'ไม่มีสิทธิ์เข้าถึง' 
      });
    }

    const { booking_id, status } = req.body;
    const pool = getPoolPromise(req.session.user_email);

    console.log("📝 Update request:", { booking_id, status });

    if (!booking_id || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'ข้อมูลไม่ครบถ้วน' 
      });
    }

    await updateBookingStatus(pool, booking_id, status);
    
    console.log("✅ Status updated successfully");
    
    res.json({ 
      success: true,
      message: 'อัปเดตสถานะสำเร็จ',
      booking_id,
      new_status: status
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message
    });
  }
});

// อัปเดตข้อมูล booking ทั้งหมด
router.post('/update', requireLogin, async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ admin
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'ไม่มีสิทธิ์เข้าถึง' 
      });
    }

    const pool = getPoolPromise(req.session.user_email);
    const { booking_id, booking_date, time_booking, status } = req.body;

    console.log("📝 Full update request:", req.body);

    if (!booking_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ต้องการ booking_id' 
      });
    }

    // สร้าง SQL แบบ dynamic
    let updateFields = [];
    let updateValues = [];
    
    if (booking_date) {
      updateFields.push('booking_date = ?');
      updateValues.push(booking_date);
    }
    
    if (time_booking) {
      updateFields.push('time_booking = ?');
      updateValues.push(time_booking);
    }
    
    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'ไม่มีข้อมูลที่ต้องการอัปเดต' 
      });
    }
    
    updateValues.push(booking_id); // สำหรับ WHERE clause
    
    const updateSql = `
      UPDATE booking
      SET ${updateFields.join(', ')}
      WHERE booking_id = ?
    `;
    
    const [result] = await pool.query(updateSql, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบข้อมูลการจองที่ต้องการอัปเดต' 
      });
    }
    
    console.log('✅ Full update successful:', result);
    res.json({ 
      success: true,
      message: 'อัปเดตข้อมูลสำเร็จ'
    });
  } catch (error) {
    console.error('❌ Full update error:', error);
    res.status(500).json({ 
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + error.message
    });
  }
});

// ฟังก์ชันช่วยเหลือ
async function getBookingsByDate(pool, date) {
  const sql = `
    SELECT 
    booking.booking_id,
    booking.time_booking,
    booking.booking_date,
    booking.service_id,
    booking.status,
    pet.pet_name,
    customer.cus_email,
    customer.cus_name,
    customer.cus_phon,
    treatment_history.pay_status
FROM booking
INNER JOIN customer ON booking.cus_id = customer.cus_id
INNER JOIN pet ON booking.pet_id = pet.pet_id
LEFT JOIN treatment_history ON booking.booking_id = treatment_history.booking_id
    WHERE DATE(booking.booking_date) = ?
    ORDER BY booking.time_booking ASC;
  `;
  
  try {
    const [results] = await pool.query(sql, [date]);
    console.log(`📅 Found ${results.length} bookings for date: ${date}`);
    return results;
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    throw error;
  }
}

async function getStatusOptions(pool) {
  try {
    const [enumResults] = await pool.query(
      `SHOW COLUMNS FROM booking LIKE 'status'`
    );
    
    if (enumResults.length > 0) {
      const statusOptions = enumResults[0].Type
        .replace(/^enum\(|\)$/g, '')
        .split(',')
        .map(v => v.replace(/'/g, '').trim());
      
      console.log("📋 Status options:", statusOptions);
      return statusOptions;
    } else {
      console.log("⚠️ Using default status options");
      return ['รอการรักษา', 'กำลังรักษา', 'เสร็จสิ้น', 'ล้มเหลว'];
    }
  } catch (error) {
    console.error('❌ Error fetching status options:', error);
    return ['รอการรักษา', 'กำลังรักษา', 'เสร็จสิ้น', 'ล้มเหลว'];
  }
}

async function updateBookingStatus(pool, booking_id, status) {
  const sql = 'UPDATE booking SET status = ? WHERE booking_id = ?';
  const [result] = await pool.query(sql, [status, booking_id]);
  
  if (result.affectedRows === 0) {
    throw new Error('ไม่พบข้อมูลการจองที่ต้องการอัปเดต');
  }
  
  return result;
}

export default router;