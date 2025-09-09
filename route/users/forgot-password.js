import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const router = express.Router();

// สร้าง transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
        user: "65011213056@msu.ac.th",   // ใส่อีเมลจริง
        pass: "bcmrhpnphrjjbprz"       // App Password
  }
});

// GET แสดงฟอร์มลืมรหัสผ่าน
router.get('/', (req, res) => {
  res.render('users/forgot-password');
});

// POST ส่งลิงก์รีเซ็ตรหัสผ่าน
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    const pool = getPoolPromise();

    const [rows] = await pool.query(
      "SELECT * FROM customer WHERE cus_email = ?",
      [email]
    );

    if (!rows.length) return res.send("❌ อีเมลไม่ถูกต้อง");

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 ชั่วโมง

    await pool.query(
      "INSERT INTO password_reset(email, token, expires_at) VALUES(?, ?, ?)",
      [email, token, expires]
    );

    const resetLink = `http://localhost:3000/users/reset-password?token=${token}`;

    // ส่งอีเมล
    const mailOptions = {
      from: '"คลินิกสัตวแพทย์" <your_email@gmail.com>',
      to: email,
      subject: "รีเซ็ตรหัสผ่านของคุณ",
      html: `
        <p>สวัสดี คุณ</p>
        <p>กรุณาคลิกที่ลิงก์นี้เพื่อรีเซ็ตรหัสผ่านของคุณ:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง</p>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.send("❌ เกิดข้อผิดพลาดในการส่งอีเมล");
      }
      console.log("📧 Email sent: " + info.response);
      res.send("✅ ส่งอีเมลรีเซ็ตรหัสผ่านเรียบร้อย");
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ เกิดข้อผิดพลาดในระบบ");
  }
});

export default router;
