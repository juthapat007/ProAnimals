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

    // บันทึกลง DB
    const [result] = await pool.query(
      `INSERT INTO booking (time_booking, service_id, cus_id, pet_id, booking_date, status, customer_type)
       VALUES (?, ?, ?, ?, ?, 'รอการรักษา', 'Booking')`,
      [time, service_id, cus_id, pet_id, date]
    );

    const booking_id = result.insertId;

    // ✅ render หน้า success พร้อมข้อมูล
    res.render("users/success", {
      booking_id,
      date,
      time
    });

  } catch (err) {
    console.error("❌ Confirm submit error:", err);
    res.status(500).send("บันทึกการจองไม่สำเร็จ");
  }
});



export default router;
