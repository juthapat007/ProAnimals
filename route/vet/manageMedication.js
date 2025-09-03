import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// 📌 แสดงหน้า + ดึงข้อมูล
router.get("/", requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== "veterinarian") {
      return res.redirect("/");
    }
    const pool = getPoolPromise(req.session.user_email);
    const [medications] = await pool.query("SELECT * FROM medication ORDER BY medication_id");

    res.render("veterinarian/manage_Medication", {
      vetName: req.session.user_name,
      medications,
    });
  } catch (err) {
    console.error("❌ Medication error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// 📌 เพิ่มยา
router.post("/manage_medication/add", requireLogin, async (req, res) => {
  try {
    const { medication_id, medicine_name, stock_quantity, medicine_package, medicine_price } = req.body;

    const pool = getPoolPromise(req.session.user_email);
    await pool.query(
      `INSERT INTO medication (medication_id, medicine_name, stock_quantity, medicine_package, medicine_price)
       VALUES (?, ?, ?, ?, ?)`,
      [medication_id, medicine_name, stock_quantity, medicine_package, medicine_price]
    );

    res.redirect("/veterinarian/manage_medication");
  } catch (err) {
    console.error("❌ Add medication error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});
// 📌 POST: อัพเดทข้อมูลยา
router.post("/update", requireLogin, async (req, res) => {
  try {
    const { medication_id, medicine_name, stock_quantity, medicine_package, medicine_price } = req.body;
    const pool = getPoolPromise(req.session.user_email);

    await pool.query(
      `UPDATE medication 
       SET medicine_name=?, stock_quantity=?, medicine_package=?, medicine_price=? 
       WHERE medication_id=?`,
      [medicine_name, stock_quantity, medicine_package, medicine_price, medication_id]
    );

    res.redirect("/veterinarian/manage_Medication");
  } catch (err) {
    console.error("❌ update medication error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการแก้ไขข้อมูลยา: " + err.message);
  }
});



// 📌 ลบยา
router.post("/manage_medication/delete", requireLogin, async (req, res) => {
  try {
    const { medication_id } = req.body;

    const pool = getPoolPromise(req.session.user_email);
    await pool.query("DELETE FROM medication WHERE medication_id=?", [medication_id]);

    res.redirect("/veterinarian/manage_medication");
  } catch (err) {
    console.error("❌ Delete medication error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

export default router;
