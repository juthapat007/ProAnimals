import express from "express";
import { getPool } from "../../config/db.js";
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
    // ✅ อ่านค่าที่เลือกจาก query string เช่น ?date=2025-09-18
    const today = dayjs().format("YYYY-MM-DD");
    const selectedDate = req.query.date || today;

    // หา customer id จาก email
    const [customerRows] = await pool.promise().query(
      "SELECT cus_id, cus_name FROM customer WHERE cus_email = ?",
      [user_email]
    );
    const customer = customerRows[0];

  
        // ✅ ถ้าเลือกวันมา → filter ตามวันนั้น
        const [bookingRows] = await pool.promise().query(
          `
            SELECT b.booking_id, b.booking_date, b.time_booking,
               s.service_type, p.pet_name, c.cus_name, c.cus_id, b.status
        FROM booking b
        JOIN service_type s ON b.service_id = s.service_id
        JOIN pet p ON b.pet_id = p.pet_id
        JOIN customer c ON b.cus_id = c.cus_id
        WHERE b.booking_date = ?
        ORDER BY b.time_booking
          `,
          [ selectedDate]
        );
        let ourQueueIndex = null;
    let pendingBeforeUs = 0;
      
    bookingRows.forEach((b,i)=>{
      if (b.cus_id === customer?.cus_id){
        ourQueueIndex = i +1;
      }else if(b.status !== "เสร็จสิ้น" && ourQueueIndex === null){
        pendingBeforeUs++;
      }
    });

    // ✅ ส่งค่าไปให้ ejs ใช้
    res.render("users/queue", {
      cus_name: customer?.cus_name || "",
      cus_id: customer?.cus_id || null,
      bookings: bookingRows,
      selectedDate,
      ourQueueIndex,
      pendingBeforeUs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

export default router;
