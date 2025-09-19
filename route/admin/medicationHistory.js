import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// ✅ แสดงหน้าข้อมูลการจ่ายยา
router.get("/", requireLogin, async (req, res) => {
  try {
    const pool = getPoolPromise(req.session.user_email);

    const [rows] = await pool.query(`
      SELECT th.treatment_id, 
             d.quantity, 
             m.medication_id, 
             m.medicine_name, 
             m.medicine_price, 
             m.medicine_package
      FROM dispens d
      INNER JOIN treatment_history th 
        ON d.treatment_id = th.treatment_id
      INNER JOIN medication m 
        ON d.medication_id = m.medication_id
      ORDER BY th.treatment_id DESC
    `);

    res.render("admin/medication_history", { medications: rows });
  } catch (err) {
    console.error("❌ Error fetching medication history:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการโหลดข้อมูล");
  }
});

export default router;
