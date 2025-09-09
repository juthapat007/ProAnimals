import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// 📌 แสดงหน้า + ดึงข้อมูล
router.get("/", requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== "admin") {
      return res.redirect("/");
    }

    const pool = getPoolPromise(req.session.user_email);
    const [services] = await pool.query(
      "SELECT * FROM service_type ORDER BY service_id"
    );

    res.render("admin/service-pet", {
      adminName: req.session.user_name,
      services,
    });
  } catch (err) {
    console.error("❌ Service error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// 📌 เพิ่มบริการ
router.post("/add", requireLogin, async (req, res) => {
  try {
    const { service_type, service_price, service_time } = req.body;
    const pool = getPoolPromise(req.session.user_email);

    // หา id ล่าสุด
    const [last] = await pool.query(
      "SELECT service_id FROM service_type ORDER BY service_id DESC LIMIT 1"
    );

    let newId = "S001"; 
    if (last.length > 0) {
      const lastId = last[0].service_id; // เช่น S005
      const num = parseInt(lastId.replace("S", "")) + 1;
      newId = "S" + num.toString().padStart(3, "0"); 
    }

    await pool.query(
      `INSERT INTO service_type (service_id, service_type, service_price, service_time) 
       VALUES (?, ?, ?, ?)`,
      [newId, service_type, service_price, service_time]
    );

    res.redirect("/admin/manage_service_pet");
  } catch (err) {
    console.error("❌ Add service error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// 📌 อัพเดทบริการ
router.post("/update", requireLogin, async (req, res) => {
  try {
    const { service_id, service_type, service_price, service_time } = req.body;
    const pool = getPoolPromise(req.session.user_email);

    await pool.query(
      `UPDATE service_type 
       SET service_type=?, service_price=?, service_time=? 
       WHERE service_id=?`,
      [service_type, service_price, service_time, service_id]
    );

    res.redirect("/admin/manage_service_pet");
  } catch (err) {
    console.error("❌ Update service error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการแก้ไขข้อมูลบริการ: " + err.message);
  }
});

// 📌 ลบบริการ
router.post("/delete", requireLogin, async (req, res) => {
  try {
    const { service_id } = req.body;
    const pool = getPoolPromise(req.session.user_email);

    await pool.query("DELETE FROM service_type WHERE service_id=?", [service_id]);

    res.redirect("/admin/manage_service_pet");
  } catch (err) {
    console.error("❌ Delete service error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

export default router;
