import express from "express";
import { getPool } from "../../config/db.js";
import multer from "multer";
import path from "path";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/"),
  filename: (req, file, cb) => cb(null, "pet-" + Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// GET แก้ไขสัตว์เลี้ยง
router.get("/:pet_id", async (req, res) => {
  if (!req.session.user_email) return res.redirect("/login");

  const { pet_id } = req.params;
  const pool = getPool(req.session.user_email);

  try {
    const [petRows] = await pool.promise().query(
      "SELECT * FROM pet WHERE pet_id = ?", [pet_id]
    );
    if (!petRows.length) return res.status(404).send("ไม่พบข้อมูลสัตว์เลี้ยง");

    const [petTypes] = await pool.promise().query("SELECT * FROM pet_type");

    res.render("users/edit_pet", { pet: petRows[0], pet_types: petTypes });
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาด");
  }
});

// POST อัปเดตสัตว์เลี้ยง
router.post("/", upload.single("pet_img"), async (req, res) => {
  if (!req.session.user_email) return res.redirect("/login");

  const { pet_id, pet_name, pet_gender, type_id } = req.body;
  const pool = getPool(req.session.user_email);

  try {
    const fields = [];
    const params = [];

    if (pet_name) { fields.push("pet_name=?"); params.push(pet_name); }
    if (pet_gender) { fields.push("pet_gender=?"); params.push(pet_gender); }
    if (type_id) { fields.push("type_id=?"); params.push(type_id); }
    if (req.file) { fields.push("img=?"); params.push(req.file.filename); }

    if (fields.length) {
      params.push(pet_id);
      await pool.promise().query(`UPDATE pet SET ${fields.join(", ")} WHERE pet_id=?`, params);
    }

    // ✅ Redirect พร้อม query success
    res.redirect(`/users/select_pet?update=success`);
  } catch (err) {
    console.error(err);
    res.status(500).send("ไม่สามารถบันทึกข้อมูลสัตว์เลี้ยงได้");
  }
});


export default router;
