// route/users/success.js
import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';
const router = express.Router();

// GET /users/success - แสดงหน้าสำเร็จ
router.get('/', requireLogin, async (req, res) => {
  try {
    const { booking_id } = req.query;
    
    if (!booking_id) {
      return res.redirect('/users/booking');
    }

    const pool = getPoolPromise(req.session.user_email);
    
    // ✅ แก้ไข column name ให้ตรงกับฐานข้อมูล
    const [bookingRows] = await pool.query(
      `SELECT 
          b.booking_id,
          b.booking_date,
          b.time_booking,
          b.status,
          p.pet_name,
          c.cus_name,
          st.service_type,
          st.service_price,
          v.vet_name
       FROM booking b
       JOIN pet p ON b.pet_id = p.pet_id
       JOIN customer c ON b.cus_id = c.cus_id
       JOIN service_type st ON b.service_id = st.service_id
       LEFT JOIN veterinarian v ON b.vet_id = v.vet_id
       WHERE b.booking_id = ? AND b.cus_id = ?`,
      [booking_id, req.session.cus_id]
    );

    if (bookingRows.length === 0) {
      return res.redirect('/users/booking');
    }

    const booking = bookingRows[0];

    // format วันที่และเวลา
    const formattedDate = new Date(booking.booking_date).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const formattedTime = booking.time_booking + " น.";

    res.render("users/success", {
      booking_id: booking.booking_id,
      date: formattedDate,
      time: formattedTime,
      petName: booking.pet_name,
      customerName: booking.cus_name,
      serviceType: booking.service_type,
      servicePrice: booking.service_price,
      vetName: booking.vet_name || 'ยังไม่ระบุ',
      status: booking.status
    });

  } catch (err) {
    console.error('❌ Success page error:', err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

// POST /users/success
router.post('/', requireLogin, async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.redirect('/users/booking');

    const pool = getPoolPromise(req.session.user_email);

    // ✅ แก้ไข column name ให้ตรงกับฐานข้อมูล
    const [bookingRows] = await pool.query(
      `SELECT 
          b.booking_id, b.booking_date, b.time_booking, b.status,
          p.pet_name, c.cus_name, st.service_type, st.service_price,
          v.vet_name
       FROM booking b
       JOIN pet p ON b.pet_id = p.pet_id
       JOIN customer c ON b.cus_id = c.cus_id
       JOIN service_type st ON b.service_id = st.service_id
       LEFT JOIN veterinarian v ON b.vet_id = v.vet_id
       WHERE b.booking_id = ? AND b.cus_id = ?`,
      [booking_id, req.session.cus_id]
    );

    if (bookingRows.length === 0) {
      return res.redirect('/users/booking');
    }

    const booking = bookingRows[0];
    const formattedDate = new Date(booking.booking_date).toLocaleDateString("th-TH");
    const formattedTime = booking.time_booking + " น.";

    res.render("users/success", {
      booking_id: booking.booking_id,
      date: formattedDate,
      time: formattedTime,
      petName: booking.pet_name,
      customerName: booking.cus_name,
      serviceType: booking.service_type,
      servicePrice: booking.service_price,
      vetName: booking.vet_name || 'ยังไม่ระบุ',
      status: booking.status
    });

  } catch (err) {
    console.error("❌ POST /users/success error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

export default router;