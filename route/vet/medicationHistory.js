import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// แสดงประวัติการจ่ายยา
router.get("/", requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== "veterinarian") {
      return res.redirect("/");
    }

    const searchTreatmentId = req.query.treatment_id || ""; // รับค่าค้นหา

    const pool = getPoolPromise(req.session.user_email);

    let query = `
      SELECT 
        d.dispens_id,
        d.treatment_id,
        d.dispens_date,
        d.medication_id,
        m.medicine_name,
        d.quantity,
        m.medicine_package,
        m.medicine_price,
        t.vet_id,
        v.vet_name
      FROM dispens d
      INNER JOIN medication m ON d.medication_id = m.medication_id
      INNER JOIN treatment_history t ON d.treatment_id = t.treatment_id
      INNER JOIN veterinarian v ON t.vet_id = v.vet_id
    `;

    let params = [];

    // ถ้ามีการค้นหา treatment_id
    if (searchTreatmentId) {
      query += ` WHERE d.treatment_id LIKE ? `;
      params.push(`%${searchTreatmentId}%`);
    }

    query += " ORDER BY d.dispens_date DESC";

    const [results] = await pool.query(query, params);

    res.render("veterinarian/medication_history", {
      dispens: results,
      searchTreatmentId,
    });
  } catch (err) {
    console.error("❌ Medication history error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

export default router;
