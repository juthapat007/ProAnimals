import express from "express";
import { getPoolPromise } from "../../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const pool = getPoolPromise("wun@system.com");
    const type = req.query.type || "month";

    let query = "";
    if (type === "week") {
      query = `
        SELECT DATE_FORMAT(treatment_date, '%d-%m') AS label, COUNT(*) AS total
        FROM treatment_history
        WHERE treatment_date >= CURDATE() - INTERVAL 7 DAY
        GROUP BY treatment_date
        ORDER BY treatment_date;
      `;
    } else if (type === "year") {
      query = `
        SELECT DATE_FORMAT(treatment_date, '%Y') AS label, COUNT(*) AS total
        FROM treatment_history
        GROUP BY YEAR(treatment_date)
        ORDER BY YEAR(treatment_date);
      `;
    } else {
      query = `
        SELECT DATE_FORMAT(treatment_date, '%Y-%m') AS label, COUNT(*) AS total
        FROM treatment_history
        GROUP BY YEAR(treatment_date), MONTH(treatment_date)
        ORDER BY YEAR(treatment_date), MONTH(treatment_date);
      `;
    }

    const [rows] = await pool.query(query);
    const labels = rows.map(r => r.label);
    const data = rows.map(r => r.total);

    // ✅ ต้องส่ง type ไปด้วย
    res.render('veterinarian/report', {
  type: req.query.type || 'week',
  labels: labels,
  data: data,
  vetId: req.session.vet_id // หรือค่าที่คุณใช้
});


  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


export default router;
