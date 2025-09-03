import express from "express"; 
import { getPoolPromise } from "../../config/db.js";

const router = express.Router();

// แสดงหน้า work_days
router.get("/", async (req, res) => {
  try {
    const pool = getPoolPromise(req.session?.user_email || "default@example.com");
    
    // ✅ เปลี่ยนชื่อตารางและไม่มี id แล้ว
    const [rows] = await pool.query("SELECT * FROM vet_work ORDER BY work_date ASC");
    const disabledDates = rows.map(r => r.work_date.toISOString().slice(0, 10));

    res.render("veterinarian/work_days", {   // แก้ path ตามโครงสร้างโฟลเดอร์จริง
      schedule: rows,
      disabledDates
    });
  } catch (err) {
    console.error("❌ Error loading schedule:", err);
    res.status(500).send("Error loading schedule");
  }
});

// เพิ่มวันทำงาน
router.post("/add", async (req, res) => {
  try {
    const { work_dates } = req.body;
    if (!work_dates) return res.redirect("/veterinarian/work_days");

    const dates = work_dates.split(",");
    const pool = getPoolPromise(req.session?.user_email || "default@example.com");

    // ✅ เปลี่ยนชื่อตารางและใช้ INSERT IGNORE เพื่อหลีกเลี่ยง duplicate
    const stmt = "INSERT IGNORE INTO vet_work (work_date) VALUES (?)";
    for (const d of dates) {
      try {
        await pool.query(stmt, [d]);
      } catch (dateErr) {
        // ถ้าวันนี้มีอยู่แล้ว (duplicate) ให้ข้ามไป
        if (dateErr.code !== 'ER_DUP_ENTRY') {
          throw dateErr;
        }
      }
    }
    res.redirect("/veterinarian/work_days");
  } catch (err) {
    console.error("❌ Error inserting dates:", err);
    res.status(500).send("Error saving schedule");
  }
});

// ลบวันทำงาน - เปลี่ยนจาก id เป็น work_date
router.get("/delete/:date", async (req, res) => {
  try {
    const workDate = req.params.date;
    const pool = getPoolPromise(req.session?.user_email || "default@example.com");
    
    // ✅ ใช้ work_date แทน id
    await pool.query("DELETE FROM vet_work WHERE work_date = ?", [workDate]);
    res.redirect("/veterinarian/work_days");
  } catch (err) {
    console.error("❌ Error deleting date:", err);
    res.status(500).send("Error deleting");
  }
});

export default router;