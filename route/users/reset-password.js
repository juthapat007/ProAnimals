// route/users/reset-password.js
import express from "express";
import bcrypt from "bcrypt";
import { getPoolPromise } from "../../config/db.js";

const router = express.Router();

// GET แสดงฟอร์มรีเซ็ตรหัสผ่าน
router.get("/", async (req, res) => {
  const { token } = req.query;
  const pool = getPoolPromise();

  const [rows] = await pool.query(
    "SELECT * FROM password_reset WHERE token = ? AND expires_at > NOW()",
    [token]
  );

  if (!rows.length) {
    return res.send("❌ ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้ว");
  }

  res.render("users/reset-password", { token });
});

// POST บันทึกรหัสผ่านใหม่
router.post("/", async (req, res) => {
  const { token, password } = req.body;
  const pool = getPoolPromise();

  const [rows] = await pool.query(
    "SELECT * FROM password_reset WHERE token = ? AND expires_at > NOW()",
    [token]
  );

  if (!rows.length) {
    return res.send("❌ ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้ว");
  }

  const email = rows[0].email;
  const hashedPassword = await bcrypt.hash(password, 10);

  await pool.query(
    "UPDATE permission SET access_pwd = ? WHERE access_email = ?",
    [hashedPassword, email]
  );

  await pool.query("DELETE FROM password_reset WHERE token = ?", [token]);

  res.send(`
  <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
    <h2>✅ รีเซ็ตรหัสผ่านเรียบร้อยแล้ว</h2>
    <p>สามารถเข้าสู่ระบบได้เลย</p>
    <a href="../../public/index" 
       style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
       กลับไปหน้าแรก
    </a>
  </div>
`);

});

// ✅ export default
export default router;
