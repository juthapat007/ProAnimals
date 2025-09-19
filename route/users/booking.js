import express from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);
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
      step: 2,
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
      step: 2,
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
        step: 2,
        cus_id: req.session.cus_id,
        cus_name: req.session.user_name,
        pet_id: null,
        pet: null,
        services: [],
        today: new Date().toISOString().slice(0, 10),
        error: 'ไม่พบข้อมุลสัตว์เลี้ยง'
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
      step: 2,
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
      step: 2,
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
    const pool = getPoolPromise(req.session.user_email || 'default@example.com');
    
    const [rows] = await pool.query(
      `SELECT DISTINCT work_day FROM vet_work WHERE work_day >= CURDATE() ORDER BY work_day ASC`
    );

    // แปลงเป็น YYYY-MM-DD local timezone (Asia/Bangkok)
    const availableDates = rows.map(row => 
      dayjs(row.work_day).tz('Asia/Bangkok').format('YYYY-MM-DD')
    );

    res.json({
      success: true,
      availableDates: availableDates
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงวันที่' });
  }
});


// ✅ แก้ไข API สำหรับดึงเวลาที่ว่าง ใน booking.js

router.get('/api/available-times/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        success: false,
        message: 'รูปแบบวันที่ไม่ถูกต้อง'
      });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);
    
    // ดึงข้อมูลเวลาทำงานของสัตวแพทย์ในวันที่เฉพาะ
    const [rows] = await pool.query(
      `SELECT DISTINCT 
         vw.vet_id,
         v.vet_name,
         vw.start_time,
         vw.end_time,
         TIME_FORMAT(vw.start_time, '%H:%i') as start_formatted,
         TIME_FORMAT(vw.end_time, '%H:%i') as end_formatted
       FROM vet_work vw
       INNER JOIN veterinarian v ON vw.vet_id = v.vet_id
       WHERE vw.work_day = ?
       ORDER BY vw.start_time ASC`,
      [date]
    );
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        times: [],  // ✅ เพิ่ม field นี้สำหรับ backward compatibility
        availableTimes: [],
        message: 'ไม่มีสัตวแพทย์ให้บริการในวันที่นี้'
      });
    }

    // ดึงการจองที่มีอยู่แล้วในวันนี้
    const [existingBookings] = await pool.query(
      `SELECT time_booking, end_time, vet_id 
       FROM booking 
       WHERE booking_date = ? 
       AND status IN ('รอการรักษา', 'กำลังรักษา')`,
      [date]
    );

    // สร้างช่วงเวลาที่สามารถจองได้ (เป็นช่วง 30 นาที)
    const availableTimes = [];
    const simpleTimeList = []; // ✅ สำหรับ backward compatibility
    
    for (const vet of rows) {
      const startTime = dayjs(`${date} ${vet.start_time}`);
      const endTime = dayjs(`${date} ${vet.end_time}`);
      
      let currentTime = startTime;
      
      while (currentTime.isBefore(endTime)) {
        const timeStr = currentTime.format('HH:mm');
        const datetimeStr = currentTime.format('YYYY-MM-DD HH:mm:ss');
        
        // ตรวจสอบว่าเวลานี้ว่างหรือไม่
        const isTimeAvailable = !existingBookings.some(booking => {
          if (booking.vet_id !== vet.vet_id) return false;
          
          const bookingStart = dayjs(`${date} ${booking.time_booking}`);
          const bookingEnd = booking.end_time 
            ? dayjs(`${date} ${booking.end_time}`)
            : bookingStart.add(30, 'minute'); // default 30 min if no end_time
          
          return currentTime.isBefore(bookingEnd) && currentTime.add(30, 'minute').isAfter(bookingStart);
        });
        
        if (isTimeAvailable) {
          availableTimes.push({
            vet_id: vet.vet_id,
            vet_name: vet.vet_name,
            time: timeStr,
            display_time: timeStr,
            datetime: datetimeStr
          });
          
          // เพิ่มใน simple list (เฉพาะเวลา) สำหรับ backward compatibility
          if (!simpleTimeList.includes(timeStr)) {
            simpleTimeList.push(timeStr);
          }
        }
        
        // เพิ่มทุกๆ 30 นาที
        currentTime = currentTime.add(30, 'minute');
      }
    }
    
    // เรียงเวลาจากน้อยไปมาก
    availableTimes.sort((a, b) => a.time.localeCompare(b.time));
    simpleTimeList.sort();
    
    console.log(`✅ Available times for ${date}:`, availableTimes.length, 'slots');
    
    res.json({
      success: true,
      times: simpleTimeList,  // ✅ รูปแบบเก่า - array ของ string เวลา
      availableTimes: availableTimes,  // ✅ รูปแบบใหม่ - array ของ object พร้อมข้อมูล vet
      date: date,
      count: availableTimes.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching available times:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเวลา',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ เพิ่ม API endpoint ใหม่สำหรับ admin ที่รองรับ service_id
router.get('/admin/api/available-times', async (req, res) => {
  try {
    const { date, service_id } = req.query;

    if (!date || !service_id) {
      return res.status(400).json({
        success: false,
        message: 'ต้องระบุ date และ service_id'
      });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    // ดึงระยะเวลาของบริการ
    const [serviceRows] = await pool.query(
      `SELECT service_time FROM service_type WHERE service_id = ?`,
      [service_id]
    );

    if (serviceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลบริการ'
      });
    }

    const serviceTime = serviceRows[0].service_time;
    const [hours, minutes] = serviceTime.split(':').map(Number);
    const serviceDurationMinutes = hours * 60 + minutes;

    // เรียกใช้ logic เดียวกับ user API แต่คำนึงถึงระยะเวลาบริการ
    // ... (logic เหมือนกับข้างบน แต่ปรับให้เหมาะกับ admin)

    res.json({
      success: true,
      availableSlots: [], // ปรับให้เหมาะกับ admin format
      serviceDurationMinutes
    });

  } catch (error) {
    console.error('❌ Error in admin available-times API:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเวลา'
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