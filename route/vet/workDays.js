// router/veterinarian/work_days.js
import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// 👉 render หน้า work_days พร้อมตารางงาน
router.get("/", requireLogin, async (req, res) => {
  const { vet_id } = req.query;

  if (!vet_id) {
    return res.status(400).send("❌ ต้องมี vet_id");
  }

  try {
    const pool = getPoolPromise(req.session.user_email);

    // ดึงตารางงานของ vet จาก table vet_work
    const [schedule] = await pool.query(
      `SELECT work_id, work_day, start_time, end_time 
       FROM vet_work 
       WHERE vet_id = ? 
       ORDER BY work_day ASC`,
      [vet_id]
    );

    // ดึงวันที่ที่ใช้แล้วทั้งหมดของ vet นี้
    const [usedDates] = await pool.query(
      `SELECT DATE_FORMAT(work_day, '%Y-%m-%d') as formatted_date FROM vet_work WHERE vet_id = ?`,
      [vet_id]
    );

    // แปลงวันที่เป็นรูปแบบ YYYY-MM-DD สำหรับ Flatpickr
    const disabledDates = usedDates.map(row => row.formatted_date);

    console.log("Schedule for", vet_id, schedule); // Debug
    console.log("Disabled dates:", disabledDates); // Debug

    res.render("veterinarian/work_days", {
      vetId: vet_id,   // map เป็น vetId
      schedule,
      disabledDates: JSON.stringify(disabledDates) // ส่งเป็น JSON string
    });

  } catch (err) {
    console.error("❌ Work days error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการโหลดข้อมูล");
  }
});

// เพิ่มวันทำงาน
router.post("/add", async (req, res) => {
  try {
    const { vet_id, work_dates, start_time, end_time } = req.body;
    const pool = await getPoolPromise();

    // แยกวันที่ออกจาก string
    const dates = work_dates.split(",").map(d => d.trim());

    // เก็บวันที่ซ้ำไว้เพื่อตอบกลับ
    const duplicateDates = [];

    for (let date of dates) {
      // เช็กว่ามีวันนี้อยู่แล้วในตาราง vet_work สำหรับ vet_id นี้
      const [existing] = await pool.query(
        "SELECT * FROM vet_work WHERE work_day = ? AND vet_id = ?",
        [date, vet_id]
      );

      if (existing.length > 0) {
        duplicateDates.push(date); // เก็บวันซ้ำ
        continue; // ข้าม insert
      }

      // insert วันใหม่
      await pool.query(
        "INSERT INTO vet_work (vet_id, work_day, start_time, end_time) VALUES (?, ?, ?, ?)",
        [vet_id, date, start_time, end_time]
      );
    }

    // ส่ง alert กลับไปหน้าเว็บ (ถ้ามีวันซ้ำ)
    if (duplicateDates.length > 0) {
      // แปลง array เป็น string แบบ readable
      const dupStr = duplicateDates.join(", ");
      res.send(`<script>alert('วันที่ ${dupStr} ถูกใช้แล้ว ไม่สามารถเพิ่มได้'); window.location.href='/veterinarian/work_days?vet_id=${vet_id}';</script>`);
    } else {
      res.redirect(`/veterinarian/work_days?vet_id=${vet_id}`);
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการเพิ่มวันทำงาน");
  }
});

// ลบวันทำงาน
router.get('/delete/:work_id', async (req, res) => {
  const workId = req.params.work_id;

  try {
    const pool = await getPoolPromise();
    const [result] = await pool.query(
      'DELETE FROM vet_work WHERE work_id = ?',
      [workId]
    );

    // ถ้าต้องการส่งกลับไปหน้าเดิม
    res.redirect('/veterinarian/work_days?vet_id=' + req.query.vet_id);
  } catch (err) {
    console.error(err);
    res.status(500).send('ลบข้อมูลไม่สำเร็จ');
  }
});


// แก้ไขเวลา
router.post("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time } = req.body;
    const pool = getPoolPromise(req.session.user_email);

    await pool.query(
      "UPDATE vet_work SET start_time = ?, end_time = ? WHERE work_id = ?",
      [start_time, end_time, id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating workday");
  }
});

export default router;