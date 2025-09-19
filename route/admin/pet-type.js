import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// แสดงหน้า manage_pet_type
router.get("/", requireLogin, async (req, res) => {
  try {
    const pool = getPoolPromise(req.session.user_email);

    const [types] = await pool.query("SELECT type_id, type FROM pet_type ORDER BY type_id");
    const [services] = await pool.query("SELECT service_id, service_type, service_price, service_time FROM service_type ORDER BY service_id");

    res.render("admin/manage_pet_type", { types, services });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// เพิ่มประเภทสัตว์
router.post("/add", requireLogin, async (req, res) => {
  try {
    const { type } = req.body;
    const pool = getPoolPromise(req.session.user_email);
    await pool.query("INSERT INTO pet_type (type) VALUES (?)", [type]);
    res.redirect("/admin/manage_pet_type");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// แก้ไขประเภทสัตว์
router.post("/update", requireLogin, async (req, res) => {
  try {
    const { type_id, type } = req.body;
    const pool = getPoolPromise(req.session.user_email);
    await pool.query("UPDATE pet_type SET type=? WHERE type_id=?", [type, type_id]);
    res.redirect("/admin/manage_pet_type");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// ลบประเภทสัตว์
router.post("/delete", requireLogin, async (req, res) => {
  try {
    const { type_id } = req.body;
    const pool = getPoolPromise(req.session.user_email);
    await pool.query("DELETE FROM pet_type WHERE type_id=?", [type_id]);
    res.redirect("/admin/manage_pet_type");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

export default router;
