import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// ✅ แสดงหน้าข้อมูลการรักษา
router.get("/", requireLogin, async (req, res) => {
  try {
    const pool = getPoolPromise(req.session.user_email);

    const [rows] = await pool.query(`
      SELECT th.treatment_id,
             th.pet_weight_kg,
             th.treatment_date,
             th.treatment_details,
             veterinarian.vet_id,
             th.pay_status,
             th.payment
      FROM treatment_history th
      INNER JOIN veterinarian 
      ON th.vet_id = veterinarian.vet_id
      ORDER BY th.treatment_date DESC
    `);

    res.render("admin/treatment_history", { treatments: rows });
  } catch (err) {
    console.error("❌ Error fetching treatment history:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการโหลดข้อมูล");
  }
});

export default router;
