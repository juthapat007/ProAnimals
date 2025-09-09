// route/users/confirm.js
import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';

const router = express.Router();

// GET /users/confirm (แสดง preview เฉย ๆ ไม่ควรเรียกตรง ๆ)
router.get('/', requireLogin, (req, res) => {
  return res.redirect('/users/booking');
});

// POST /users/confirm - แสดงหน้ายืนยันการจอง (preview)
router.post("/", requireLogin, async (req, res) => {
  try {
    const { cus_id, pet_id, service_id, date, time } = req.body;

    const pool = getPoolPromise(req.session.user_email);

    // ✅ query pet info
    const [petRows] = await pool.query(
      `SELECT p.pet_name, p.pet_gender, pt.type AS pet_type_name,
              c.cus_name, c.cus_phon, c.cus_email
       FROM pet p
       JOIN customer c ON p.cus_id = c.cus_id
       JOIN pet_type pt ON p.type_id = pt.type_id
       WHERE p.pet_id = ? AND p.cus_id = ?`,
      [pet_id, cus_id]
    );

    if (petRows.length === 0) {
      return res.send("ไม่พบข้อมูลสัตว์เลี้ยง");
    }

    const pet_info = petRows[0];

    // ✅ query service info
    const [serviceRows] = await pool.query(
      `SELECT service_type, service_price 
       FROM service_type 
       WHERE service_id = ?`,
      [service_id]
    );

    if (serviceRows.length === 0) {
      return res.send("<script>alert('ไม่พบข้อมูลบริการ'); window.location.href='/users/booking';</script>");
    }

    const service_info = serviceRows[0];

    // ✅ format date & time
    const formattedDate = new Date(date).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    const formattedTime = time + " น.";

    // ✅ แสดงหน้า confirm.ejs พร้อมปุ่ม "ยืนยัน"
    res.render("users/confirm", {
      petInfo: pet_info,
      serviceInfo: service_info,
      date,
      time,
      formattedDate,
      formattedTime,
      cus_id,
      pet_id,
      service_id
    });

  } catch (err) {
    console.error("❌ Confirm preview error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

// ✅ POST /users/confirm/submit - บันทึกการจองจริง + redirect success
router.post("/submit", requireLogin, async (req, res) => {
  try {
    const { cus_id, pet_id, service_id, date, time } = req.body;
    const pool = getPoolPromise(req.session.user_email);

    // ✅ 1. หา vet_id ที่ available ในวันที่เลือก
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
        throw new Error('ไม่พบสัตวแพทย์ในระบบ');
      }
    }

    // ✅ 2. คำนวณ end_time จาก service_time
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

    // ✅ 3. บันทึกลง DB พร้อม vet_id และ end_time
    const [result] = await pool.query(
      `INSERT INTO booking (time_booking, end_time, service_id, cus_id, pet_id, vet_id, booking_date, status, customer_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'รอการรักษา', 'Booking')`,
      [time, end_time, service_id, cus_id, pet_id, vet_id, date]
    );

    const booking_id = result.insertId;

    console.log(`✅ Booking created successfully: ID ${booking_id}, Vet: ${vet_id}, Date: ${date}, Time: ${time}`);

    // ✅ render หน้า success พร้อมข้อมูล
    res.render("users/success", {
      booking_id,
      date,
      time
    });

  } catch (err) {
    console.error("❌ Confirm submit error:", err);
    console.error("❌ Error details:", err.message);
    res.status(500).send(`บันทึกการจองไม่สำเร็จ: ${err.message}`);
  }
});

export default router;