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
      vetId: req.session.vet_id,
      vetName: req.session.user_name,
      medications,
    });
  } catch (err) {
    console.error("❌ Medication error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// 📌 เพิ่มยา
// 📌 เพิ่มยา
router.post("/add", requireLogin, async (req, res) => {
  try {
    const { medicine_name, stock_quantity, medicine_package, medicine_price } = req.body;

    const pool = getPoolPromise(req.session.user_email);

    // 🔹 หา id ล่าสุด
    const [last] = await pool.query("SELECT medication_id FROM medication ORDER BY medication_id DESC LIMIT 1");

    let newId = "M001"; // ค่าเริ่มต้นถ้ายังไม่มีข้อมูลเลย
    if (last.length > 0) {
      const lastId = last[0].medication_id; // เช่น M005
      const num = parseInt(lastId.replace("M", "")) + 1; // 5+1 = 6
      newId = "M" + num.toString().padStart(3, "0"); // ได้ M006
    }

    // 🔹 บันทึกข้อมูลใหม่
    await pool.query(
      `INSERT INTO medication (medication_id, medicine_name, stock_quantity, medicine_package, medicine_price)
       VALUES (?, ?, ?, ?, ?)`,
      [newId, medicine_name, stock_quantity, medicine_package, medicine_price]
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

    res.redirect("/veterinarian/manage_medication");
  } catch (err) {
    console.error("❌ update medication error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการแก้ไขข้อมูลยา: " + err.message);
  }
});



// 📌 ลบยา
router.post("/delete", requireLogin, async (req, res) => {
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
