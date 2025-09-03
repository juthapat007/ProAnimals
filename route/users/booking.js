import express from 'express';
import dayjs from 'dayjs';
import { requireLogin } from '../../middleware/auth.js';
import { getPoolPromise } from '../../config/db.js';

const router = express.Router();

// ✅ GET /users/booking - แสดงหน้าเลือกบริการ
router.get('/booking', requireLogin, async (req, res) => {
  try {
    // ตรวจสอบ session
    if (!req.session.cus_id || !req.session.user_email) {
      return res.redirect('/login');
    }

    res.render('users/booking', {
      cus_id: req.session.cus_id,
      cus_name: req.session.user_name,
      pet_id: null,
      pet: null,
      services: [],
      today: new Date().toISOString().slice(0, 10),
      error: null
    });

  } catch (error) {
    console.error('❌ GET /users/booking Error:', error);
    res.render('users/booking', {
      cus_id: req.session.cus_id,
      cus_name: req.session.user_name,
      pet_id: null,
      pet: null,
      services: [],
      today: new Date().toISOString().slice(0, 10),
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// ✅ POST /users/booking - รับข้อมูลจาก select_pet และแสดงฟอร์มเลือกบริการ
router.post('/booking', async (req, res) => {
  const { pet_id, cus_id } = req.body;

  // ตรวจสอบข้อมูลที่ส่งมา
  if (!pet_id || !cus_id) {
    console.log('❌ Missing data:', { pet_id, cus_id });
    return res.redirect('/users/select_pet');
  }

  // ตรวจสอบว่า cus_id ตรงกับ session หรือไม่
  if (req.session.cus_id && parseInt(cus_id) !== parseInt(req.session.cus_id)) {
    console.log('❌ Customer ID mismatch');
    return res.redirect('/users/select_pet');
  }

  try {
    const pool = getPoolPromise(req.session.user_email || 'default@example.com');

    // 1) ดึงข้อมูลสัตว์เลี้ยง
    const [petResults] = await pool.query(
      `SELECT p.pet_name, p.pet_gender, pt.type AS pet_type_name
       FROM pet p
       LEFT JOIN pet_type pt ON p.type_id = pt.type_id
       WHERE p.pet_id = ? AND p.cus_id = ?`,
      [pet_id, cus_id]
    );

    if (petResults.length === 0) {
      console.log('❌ Pet not found:', { pet_id, cus_id });
      return res.render('users/booking', {
        cus_id: req.session.cus_id,
        cus_name: req.session.user_name,
        pet_id: null,
        pet: null,
        services: [],
        today: new Date().toISOString().slice(0, 10),
        error: 'ไม่พบข้อมูลสัตว์เลี้ยง'
      });
    }

    // 2) ดึงข้อมูลบริการทั้งหมด
    const [serviceResults] = await pool.query(
      `SELECT service_id, service_type, service_price 
       FROM service_type 
       ORDER BY service_id ASC`
    );

    console.log('✅ Pet data:', petResults[0]);
    console.log('✅ Services count:', serviceResults.length);

    // 3) แสดงหน้าเลือกบริการ
    res.render('users/booking', {
      pet_id: parseInt(pet_id),
      cus_id: parseInt(cus_id),
      pet: petResults[0],
      services: serviceResults,
      today: new Date().toISOString().slice(0, 10),
      cus_name: req.session.user_name,
      error: null
    });

  } catch (error) {
    console.error('❌ POST /users/booking Error:', error);
    res.render('users/booking', {
      cus_id: req.session.cus_id,
      cus_name: req.session.user_name,
      pet_id: null,
      pet: null,
      services: [],
      today: new Date().toISOString().slice(0, 10),
      error: 'เกิดข้อผิดพลาดในระบบฐานข้อมูล'
    });
  }
});

// ✅ API สำหรับดึงวันที่ที่เปิดให้บริการ (จาก vet_work table)
router.get('/api/available-dates', async (req, res) => {
  try {
    // ใช้ user_email จาก session หรือใช้ default
    const userEmail = req.session?.user_email || 'default@example.com';
    const pool = getPoolPromise(userEmail);
    
    // ดึงเฉพาะวันที่ >= วันนี้ จาก vet_work table
    const [rows] = await pool.query(
      `SELECT DISTINCT work_date 
       FROM vet_work 
       WHERE work_date >= CURDATE() 
       ORDER BY work_date ASC`
    );
    
    // แปลงเป็น array ของวันที่ในรูปแบบ YYYY-MM-DD
    const availableDates = rows.map(row => {
      if (row.work_date instanceof Date) {
        return row.work_date.toISOString().slice(0, 10);
      } else {
        // ถ้าเป็น string หรือรูปแบบอื่น
        return dayjs(row.work_date).format('YYYY-MM-DD');
      }
    });
    
    console.log('✅ Available dates loaded:', availableDates);
    
    res.json({
      success: true,
      availableDates: availableDates,
      count: availableDates.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching available dates:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลวันที่',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ API สำหรับตรวจสอบข้อมูล session (สำหรับ debugging)
router.get('/api/session-info', (req, res) => {
  if (!req.session.user_email) {
    return res.status(401).json({
      success: false,
      message: 'ไม่ได้เข้าสู่ระบบ'
    });
  }

  res.json({
    success: true,
    session: {
      user_email: req.session.user_email,
      user_name: req.session.user_name,
      cus_id: req.session.cus_id,
      role: req.session.role
    }
  });
});


export default router;