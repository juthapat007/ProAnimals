// route/users/edit_person.js
import express from "express";
import { getPool } from "../../config/db.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// 📌 ตั้งค่า multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/"); // โฟลเดอร์เก็บรูป
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});
const upload = multer({ storage });

// ====================== GET ======================
router.get("/", async (req, res) => {
  if (!req.session.user_email) return res.redirect("/login");

  const pool = getPool(req.session.user_email);
  try {
    const [rows] = await pool.promise().query(
      "SELECT cus_id, cus_name,cus_phon, cus_email, cus_img FROM customer WHERE cus_email = ?",
      [req.session.user_email]
    );

    if (rows.length === 0) return res.status(404).send("ไม่พบข้อมูลลูกค้า");

    res.render("users/edit_person", { customer: rows[0] });
  } catch (err) {
    console.error("❌ Error GET edit_person:", err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

// ====================== POST ======================
router.post("/", upload.single("profile_img"), async (req, res) => {
  if (!req.session.user_email) return res.redirect("/login");

  const { cus_name, cus_tel, cus_address } = req.body;
  const user_email = req.session.user_email;
  const pool = getPool(user_email);

  try {
    let fields = [];
    let params = [];

    if (cus_name) {
      fields.push("cus_name=?");
      params.push(cus_name);
    }
    if (cus_tel) {
      fields.push("cus_phon=?");
      params.push(cus_tel);
    }
    if (cus_address) {
      fields.push("cus_address=?");
      params.push(cus_address);
    }
    if (req.file) {
      fields.push("cus_img=?");
      params.push(req.file.filename);
    }

    if (fields.length === 0) {
      return res.redirect("/users/edit_person"); // ไม่มีอะไรต้องอัพเดต
    }

    let sql = `UPDATE customer SET ${fields.join(", ")} WHERE cus_email=?`;
    params.push(user_email);

    await pool.promise().query(sql, params);

    res.redirect("/users/edit_person");
  } catch (err) {
    console.error("❌ Error POST edit_person:", err);
    res.status(500).send("บันทึกไม่สำเร็จ");
  }
});


export default router;
