import express from 'express';
import { getPool } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';
import dayjs from "dayjs";
const router = express.Router();

// GET /users/select_time
router.get('/select_time', requireLogin, (req, res) => {
  const selectedDate = req.query.date || new Date().toISOString().slice(0, 10);
  const { service_id, cus_id, pet_id } = req.query;
  const pool = getPool(req.session.user_email);
  const allSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  pool.query(
    `SELECT time_booking FROM booking WHERE booking_date = ?`,
    [selectedDate],
    (err, timeResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send("เกิดข้อผิดพลาดในฐานข้อมูลค่ะ");
      }

      const booked_times = timeResults.map(r => r.time_booking);

      res.render("users/select_time", {
        date: selectedDate,
        allSlots,
        booked_times,
        cus_id,
        pet_id,
        service_id,
        error: null
      });
    }
  );
});

// POST /users/select_time
router.post('/select_time', requireLogin, (req, res) => {
  const { pet_id, cus_id, service_id, booking_date, time_booking } = req.body;

  if (!pet_id || !cus_id || !service_id || !booking_date || !time_booking) {
    return res.status(400).send("ข้อมูลไม่ครบค่ะ");
  }

  const formattedTime = dayjs(`2025-01-01 ${time_booking}`).format("HH:mm");
  const pool = getPool(req.session.user_email);

  pool.query(
    `SELECT * FROM booking 
     WHERE booking_date = ? 
       AND time_booking = ?`,
    [booking_date, formattedTime],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send("เกิดข้อผิดพลาดในฐานข้อมูลค่ะ");
      }

      if (results.length > 0) {
        return res.render("users/select_time", {
          date: booking_date,
          available_dates: [],
          booked_times: results.map(r => r.time_booking),
          cus_id,
          pet_id,
          service_id,
          error: `ช่วงเวลา ${formattedTime} ของวันที่ ${booking_date} ถูกจองไปแล้วค่ะ กรุณาเลือกเวลาอื่นค่ะ`
        });
      }
      pool.query(
  `INSERT INTO booking (cus_id, pet_id, service_id, booking_date, time_booking) 
   VALUES (?, ?, ?, ?, ?)`,
  [cus_id, pet_id, service_id, booking_date, formattedTime],
  (err2, result) => {
    if (err2) {
      console.error(err2);
      return res.status(500).send("เกิดข้อผิดพลาดในการบันทึกข้อมูลค่ะ");
    }

    const booking_id = result.insertId;

    // ✅ ต้องเป็น redirect GET เท่านั้น
    res.redirect(`/users/success?booking_id=${booking_id}`);
  }
);


    }
  );
});

export default router;