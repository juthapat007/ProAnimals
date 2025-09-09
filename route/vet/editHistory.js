import express from "express";
import { getPoolPromise } from "../../config/db.js"; // 🔥 เปลี่ยนจาก getPool เป็น getPoolPromise
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// GET หน้าจัดการแก้ไขประวัติการรักษา
router.get("/:treatment_id", requireLogin, async (req, res) => {
  const { treatment_id } = req.params;
  const pool = getPoolPromise(req.session.user_email); // 🔥 ใช้ getPoolPromise

  try {
    // 🔥 เปลี่ยนจาก pool.promise().query() เป็น pool.query()
    const [rows] = await pool.query(
      "SELECT * FROM treatment_history WHERE treatment_id = ?",
      [treatment_id]
    );

    if (rows.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลประวัติการรักษา");
    }

    const treatment = rows[0];
    // แปลงวันที่ให้อยู่ในรูปแบบที่ถูกต้อง
    treatment.treatment_date = treatment.treatment_date ? new Date(treatment.treatment_date) : null;

    console.log("🔍 Treatment data loaded:", {
      treatment_id: treatment.treatment_id,
      pet_weight_kg: treatment.pet_weight_kg,
      treatment_date: treatment.treatment_date
    });

    res.render("veterinarian/edit_history", { 
      vetId: req.session.vet_id,
      vetName: req.session.user_name,
      treatment: treatment
    });

  } catch (err) {
    console.error("❌ Error GET edit_history:", err);
    res.status(500).send(`เกิดข้อผิดพลาดในระบบ: ${err.message}`);
  }
});

// POST บันทึกการแก้ไข
router.post("/:treatment_id", requireLogin, async (req, res) => {
  const { treatment_id } = req.params;
  const { pet_weight_kg, treatment_details, vet_notes, booking_id } = req.body;
  const pool = getPoolPromise(req.session.user_email); // 🔥 ใช้ getPoolPromise

try {
  await pool.query(
    `UPDATE treatment_history 
     SET pet_weight_kg = ?, treatment_details = ?, vet_notes = ? 
     WHERE treatment_id = ?`,
    [pet_weight_kg ?? null, treatment_details ?? null, vet_notes ?? null, treatment_id]
  );
  res.redirect(`/veterinarian/mg_history/${booking_id}`);
} catch(err) {
  console.error("Update failed:", err);
  res.status(500).send("Update ไม่สำเร็จ: " + err.message);
}

});

export default router;