import express from "express";
import { getPoolPromise } from "../../config/db.js";

const router = express.Router();

// แสดงประวัติการรักษา
router.get("/", async (req, res) => {
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

res.render("veterinarian/history_treatment", { 
  treatments: rows,
  vetId: req.session.vet_id
});
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

export default router;
