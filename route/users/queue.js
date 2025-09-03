import express from 'express';
import { getPool } from '../../config/db.js';
import dayjs from "dayjs";
const router = express.Router();

// GET /users/queue
router.get("/", async (req, res) => {
  if (!req.session.user_email) {
    return res.redirect("/login");
  }
  const user_email = req.session.user_email;
  const pool = getPool(user_email);

  try {
    const [customerRows] = await pool.promise().query(
      "SELECT cus_id, cus_name FROM customer WHERE cus_email = ?",
      [user_email]
    );

    const customer = customerRows[0];

    let bookings = [];

    if (customer) {
      const [dates] = await pool.promise().query(
        "SELECT DISTINCT booking_date FROM booking WHERE cus_id = ?",
        [customer.cus_id]
      );

      if (dates.length > 0) {
        const dateList = dates.map((d) =>
          dayjs(d.booking_date).format("YYYY-MM-DD")
        );

        const placeholders = dateList.map(() => "?").join(",");

        const [bookingRows] = await pool.promise().query(
          `
            SELECT b.booking_id, b.booking_date, b.time_booking, 
                   s.service_type, p.pet_name, c.cus_name, b.status
            FROM booking b
            JOIN service_type s ON b.service_id = s.service_id
            JOIN pet p ON b.pet_id = p.pet_id
            JOIN customer c ON b.cus_id = c.cus_id
            WHERE b.booking_date IN (${placeholders})
            ORDER BY b.booking_date DESC, b.time_booking
          `,
          dateList
        );

        bookings = bookingRows;
      }
    }

    res.render("users/queue", {
      cus_name: customer?.cus_name || "",
      bookings,
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

export default router;