import express from 'express';
import dayjs from 'dayjs';
import { requireLogin } from '../../middleware/auth.js';
import { getPoolPromise } from '../../config/db.js';

const router = express.Router();

// ✅ GET /admin/pet_service - แสดงหน้าเลือกบริการสำหรับสัตว์เลี้ยง
router.get('/', requireLogin, async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ admin
    if (req.session.access_type !== 'admin') {
      return res.redirect('/');
    }

    const { pet_id, cus_id } = req.query;

    if (!pet_id || !cus_id) {
      return res.redirect('/admin/customers');
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    try {
      // 1) ดึงข้อมูลลูกค้า
      const [customerRows] = await pool.query(
        'SELECT cus_id, cus_name, cus_email, cus_phon FROM customer WHERE cus_id = ?',
        [cus_id]
      );

      if (customerRows.length === 0) {
        return res.status(404).send('ไม่พบข้อมูลลูกค้า');
      }

      // 2) ดึงข้อมูลสัตว์เลี้ยง
      const [petRows] = await pool.query(
        `SELECT p.pet_id, p.pet_name, p.pet_gender, p.img, pt.type AS pet_type_name
         FROM pet p
         LEFT JOIN pet_type pt ON p.type_id = pt.type_id
         WHERE p.pet_id = ? AND p.cus_id = ?`,
        [pet_id, cus_id]
      );

      if (petRows.length === 0) {
        return res.status(404).send('ไม่พบข้อมูลสัตว์เลี้ยง');
      }

      // 3) ดึงข้อมูลบริการทั้งหมด
      const [serviceRows] = await pool.query(
        `SELECT service_id, service_type, service_price 
         FROM service_type 
         ORDER BY service_id ASC`
      );

      // 4) ดึงประวัติการจองของสัตว์เลี้ยงตัวนี้
      const [bookingHistory] = await pool.query(
        `SELECT 
            b.booking_id, 
            b.booking_date, 
            b.time_booking, 
            b.status, 
            s.service_type, 
            s.service_price,
            v.vet_name
        FROM booking b
        LEFT JOIN service_type s ON b.service_id = s.service_id
        LEFT JOIN veterinarian v ON b.vet_id = v.vet_id
        WHERE b.pet_id = ?
        ORDER BY b.booking_date DESC, b.time_booking DESC
        LIMIT 10`,
        [pet_id]
      );

      console.log('✅ Pet service data loaded successfully');

      res.render('admin/pet_service', {
        customer: customerRows[0],
        pet: petRows[0],
        services: serviceRows,
        bookingHistory,
        today: new Date().toISOString().slice(0, 10),
        error: req.query.error || null,
        success: req.query.success || null
      });

    } catch (dbError) {
      console.error('❌ Database error in pet-service:', dbError);
      res.status(500).send('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    }

  } catch (error) {
    console.error('❌ Error in pet-service GET:', error);
    res.status(500).send('เกิดข้อผิดพลาดในระบบ');
  }
});

// ✅ POST /admin/pet_service - สร้างการจองบริการใหม่
router.post('/', requireLogin, async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์ admin
    if (req.session.access_type !== 'admin') {
      return res.redirect('/');
    }

    const { pet_id, cus_id, service_id, date, time, note } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!pet_id || !cus_id || !service_id || !date || !time) {
      return res.redirect(`/admin/pet_service?pet_id=${pet_id}&cus_id=${cus_id}&error=missing_data`);
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    try {
      // ตรวจสอบว่าสัตว์เลี้ยงและลูกค้ามีอยู่จริง
      const [petCheck] = await pool.query(
        'SELECT pet_name FROM pet WHERE pet_id = ? AND cus_id = ?',
        [pet_id, cus_id]
      );

      if (petCheck.length === 0) {
        return res.redirect(`/admin/pet_service?pet_id=${pet_id}&cus_id=${cus_id}&error=pet_not_found`);
      }

      // ✅ หา vet_id ที่ available ในวันที่เลือก
      const [availableVets] = await pool.query(
        `SELECT DISTINCT vw.vet_id 
         FROM vet_work vw
         WHERE vw.work_day = ? 
         AND vw.start_time <= ? 
         AND vw.end_time >= ?
         ORDER BY vw.vet_id ASC
         LIMIT 1`,
        [date, time, time]
      );

      let vet_id = null;
      
      if (availableVets.length > 0) {
        vet_id = availableVets[0].vet_id;
      } else {
        // ถ้าไม่มี vet available ให้ใช้ vet_id แรกในระบบ (fallback)
        const [firstVet] = await pool.query(
          `SELECT vet_id FROM veterinarian ORDER BY vet_id ASC LIMIT 1`
        );
        
        if (firstVet.length > 0) {
          vet_id = firstVet[0].vet_id;
        } else {
          return res.redirect(`/admin/pet_service?pet_id=${pet_id}&cus_id=${cus_id}&error=no_vet_available`);
        }
      }

      // ✅ ตรวจสอบว่ามีการจองซ้ำในเวลาเดียวกันหรือไม่
      const [timeConflict] = await pool.query(
        `SELECT booking_id FROM booking 
         WHERE booking_date = ? AND time_booking = ? 
         AND status IN ('รอการรักษา', 'กำลังรักษา')`,
        [date, time]
      );

      if (timeConflict.length > 0) {
        return res.redirect(`/admin/pet_service?pet_id=${pet_id}&cus_id=${cus_id}&error=time_conflict`);
      }

      // ✅ คำนวณ end_time จาก service_time
      const [serviceTime] = await pool.query(
        `SELECT service_time FROM service_type WHERE service_id = ?`,
        [service_id]
      );

      let end_time = null;
      if (serviceTime.length > 0) {
        // แปลง TIME เป็นนาที แล้วเพิ่มเข้าใน time_booking
        const serviceMinutes = serviceTime[0].service_time;
        const [hours, minutes] = serviceMinutes.split(':').map(Number);
        const serviceDuration = hours * 60 + minutes;
        
        const [timeHours, timeMinutes] = time.split(':').map(Number);
        const startMinutes = timeHours * 60 + timeMinutes;
        const endMinutes = startMinutes + serviceDuration;
        
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        end_time = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
      }

      // ✅ สร้างการจองใหม่พร้อม vet_id และ end_time
      const [result] = await pool.query(
        `INSERT INTO booking (time_booking, end_time, service_id, cus_id, pet_id, vet_id, booking_date, status, customer_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'รอการรักษา', 'Booking')`,
        [time, end_time, service_id, cus_id, pet_id, vet_id, date]
      );

      const bookingId = result.insertId;
      console.log(`✅ Created new booking: ${bookingId} for pet ${petCheck[0].pet_name} with vet ${vet_id}`);

      res.redirect(`/admin/pet_service?pet_id=${pet_id}&cus_id=${cus_id}&success=booking_created&booking_id=${bookingId}`);

    } catch (dbError) {
      console.error('❌ Database error in pet-service POST:', dbError);
      res.redirect(`/admin/pet_service?pet_id=${pet_id}&cus_id=${cus_id}&error=database_error`);
    }

  } catch (error) {
    console.error('❌ Error in pet-service POST:', error);
    res.redirect(`/admin/pet_service?pet_id=${req.body.pet_id}&cus_id=${req.body.cus_id}&error=system_error`);
  }
});

// ✅ API สำหรับดึงวันที่ที่เปิดให้บริการ (แก้ไขใหม่)
// ✅ API สำหรับดึงวันที่ที่เปิดให้บริการ (แก้ไขใหม่เรียบร้อย)
router.get('/api/available-dates', requireLogin, async (req, res) => {
  try {
    console.log('📡 API: /api/available-dates called');

    // ตรวจสอบสิทธิ์ admin
    if (req.session.access_type !== 'admin') {
      console.log('❌ Unauthorized access attempt');
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    console.log('👤 User email:', userEmail);

    const pool = getPoolPromise(userEmail);

    // ดึงวันที่เปิดให้บริการจาก vet_work
    const [rows] = await pool.query(
      `SELECT DISTINCT work_day 
       FROM vet_work 
       WHERE work_day >= CURDATE() 
       ORDER BY work_day ASC
       LIMIT 30`
    );

    console.log('📊 Raw database result:', rows);

    if (!rows || rows.length === 0) {
      console.log('⚠️ No work days found in database');
      return res.json({
        success: true,
        availableDates: [],
        count: 0,
        message: 'ไม่มีวันที่เปิดให้บริการในขณะนี้'
      });
    }

    // แปลง work_day เป็น string รูปแบบ YYYY-MM-DD
    const availableDates = rows
      .map(row => dayjs(row.work_day).format('YYYY-MM-DD'))
      .filter(dateStr => /^\d{4}-\d{2}-\d{2}$/.test(dateStr));

    console.log('✅ Processed available dates:', availableDates);

    res.json({
      success: true,
      availableDates,
      count: availableDates.length,
      message: `พบวันที่ให้บริการ ${availableDates.length} วัน`
    });

  } catch (error) {
    console.error('❌ Error in /api/available-dates:', error);

    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลวันที่',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


// ✅ API สำหรับดึงเวลาที่ว่าง (ปรับปรุงใหม่)
router.get('/api/available-times', requireLogin, async (req, res) => {
  try {
    console.log('📡 API: available-times called with params:', req.query);
    
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const { date, service_id } = req.query;

    if (!date || !service_id) {
      console.log('⚠️ Missing required parameters:', { date, service_id });
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน - ต้องมี date และ service_id' });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    // 1) ดึงระยะเวลาของบริการ
    const [serviceRows] = await pool.query(
      `SELECT service_time FROM service_type WHERE service_id = ?`,
      [service_id]
    );

    if (serviceRows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลบริการ' });
    }

    const serviceTime = serviceRows[0].service_time;
    console.log('⏱️ Service time:', serviceTime);
    
    const [hours, minutes] = serviceTime.split(':').map(Number);
    const serviceDurationMinutes = hours * 60 + minutes;

    // 2) ดึงช่วงเวลาทำงานของสัตวแพทย์ในวันที่เลือก
    const [vetWorkRows] = await pool.query(
      `SELECT DISTINCT start_time, end_time 
       FROM vet_work 
       WHERE work_day = ?
       ORDER BY start_time ASC`,
      [date]
    );

    console.log('👨‍⚕️ Vet work hours for', date, ':', vetWorkRows);

    if (vetWorkRows.length === 0) {
      return res.json({
        success: true,
        availableSlots: [],
        bookedSlots: [],
        allSlots: [],
        message: 'ไม่มีสัตวแพทย์ทำงานในวันนี้'
      });
    }

    // 3) ดึงการจองที่มีอยู่แล้วในวันที่เลือก
    const [existingBookings] = await pool.query(
      `SELECT b.time_booking, b.end_time, st.service_time
       FROM booking b
       JOIN service_type st ON b.service_id = st.service_id
       WHERE b.booking_date = ? AND b.status IN ('รอการรักษา', 'กำลังรักษา')
       ORDER BY b.time_booking ASC`,
      [date]
    );

    console.log('📋 Existing bookings for', date, ':', existingBookings);

    // 4) สร้าง time slots ตามช่วงเวลาทำงานของสัตวแพทย์
    const generateTimeSlots = (startTime, endTime) => {
      const slots = [];
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      // สร้าง slots ทุก 60 นาที
      for (let current = startTotalMinutes; current + serviceDurationMinutes <= endTotalMinutes; current += 60) {
        const hours = Math.floor(current / 60);
        const minutes = current % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
      return slots;
    };

    // รวม slots จากช่วงเวลาทำงานทั้งหมด
    let allSlots = [];
    vetWorkRows.forEach(work => {
      const slots = generateTimeSlots(work.start_time, work.end_time);
      allSlots = [...allSlots, ...slots];
    });
    
    // เอาค่าซ้ำออก และเรียงลำดับ
    allSlots = [...new Set(allSlots)].sort();
    
    console.log('⏰ All possible time slots:', allSlots);

    // 5) ตรวจสอบความว่างของแต่ละ slot
    const availableSlots = [];
    const bookedSlots = [];

    for (const slot of allSlots) {
      const [slotHours, slotMinutes] = slot.split(':').map(Number);
      const slotStartMinutes = slotHours * 60 + slotMinutes;
      const slotEndMinutes = slotStartMinutes + serviceDurationMinutes;
      
      let isAvailable = true;

      for (const booking of existingBookings) {
        const [bookingHours, bookingMinutes] = booking.time_booking.split(':').map(Number);
        const bookingStartMinutes = bookingHours * 60 + bookingMinutes;
        
        let bookingEndMinutes;
        if (booking.end_time) {
          const [endHours, endMins] = booking.end_time.split(':').map(Number);
          bookingEndMinutes = endHours * 60 + endMins;
        } else {
          // คำนวณจาก service_time
          const [serviceHours, serviceMins] = booking.service_time.split(':').map(Number);
          bookingEndMinutes = bookingStartMinutes + (serviceHours * 60 + serviceMins);
        }

        // ตรวจสอบการทับซ้อน
        if (slotStartMinutes < bookingEndMinutes && bookingStartMinutes < slotEndMinutes) {
          isAvailable = false;
          break;
        }
      }

      if (isAvailable) {
        availableSlots.push(slot);
      } else {
        bookedSlots.push(slot);
      }
    }

    console.log('✅ Available slots:', availableSlots);
    console.log('❌ Booked slots:', bookedSlots);

    res.json({
      success: true,
      availableSlots,
      bookedSlots,
      allSlots,
      serviceDurationMinutes,
      vetWorkHours: vetWorkRows,
      message: `พบเวลาว่าง ${availableSlots.length} ช่วง จากทั้งหมด ${allSlots.length} ช่วง`
    });

  } catch (error) {
    console.error('❌ Error in /api/available-times:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเวลา',
      error: error.message
    });
  }
});




// ✅ PUT - อัปเดตสถานะการจอง
router.put('/booking/:booking_id/status', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const bookingId = req.params.booking_id;
    const { status } = req.body;

    // ✅ ใช้สถานะที่ตรงกับฐานข้อมูล
    const validStatuses = ['รอการรักษา', 'กำลังรักษา', 'เสร็จสิ้น', 'ล้มเหลว'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    const [result] = await pool.query(
      'UPDATE booking SET status = ? WHERE booking_id = ?',
      [status, bookingId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบการจอง' });
    }

    console.log(`✅ Updated booking ${bookingId} status to ${status}`);

    res.json({
      success: true,
      message: `อัปเดตสถานะเป็น ${status} เรียบร้อยแล้ว`
    });

  } catch (error) {
    console.error('❌ Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ'
    });
  }
});

export default router;