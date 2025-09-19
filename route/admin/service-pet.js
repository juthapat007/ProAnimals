import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// แสดงหน้า manage_service_pet
router.get("/", requireLogin, async (req, res) => {
  try {
    const pool = getPoolPromise(req.session.user_email);

    const [services] = await pool.query(
      "SELECT service_id, service_type, service_price, service_time FROM service_type ORDER BY service_id"
    );

    res.render("admin/manage_service_pet", { services });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// POST /add
router.post("/add", requireLogin, async (req, res) => {
  try {
    const { service_type, service_price, service_time } = req.body;
    const pool = getPoolPromise(req.session.user_email);
    await pool.query(
      "INSERT INTO service_type (service_type, service_price, service_time) VALUES (?, ?, ?)",
      [service_type, service_price, service_time]
    );
    res.redirect("/admin/manage_service_pet");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// POST /update
router.post("/update", requireLogin, async (req, res) => {
  try {
    const { service_id, service_type, service_price, service_time } = req.body;
    const pool = getPoolPromise(req.session.user_email);
    await pool.query(
      "UPDATE service_type SET service_type=?, service_price=?, service_time=? WHERE service_id=?",
      [service_type, service_price, service_time, service_id]
    );
    res.redirect("/admin/manage_service_pet");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// POST /delete
router.post("/delete", requireLogin, async (req, res) => {
  try {
    const { service_id } = req.body;
    const pool = getPoolPromise(req.session.user_email);
    await pool.query("DELETE FROM service_type WHERE service_id=?", [service_id]);
    res.redirect("/admin/manage_service_pet");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error: " + err.message);
  }
});

export default router;
