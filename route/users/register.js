import express from 'express';
import bcrypt from 'bcrypt';
import crypto from "crypto";
import nodemailer from "nodemailer";
import { getPool } from '../../config/db.js';

const router = express.Router();


// GET /users/register
router.get('/register', (req, res) => {
  res.render('users/register', {
    error: null,
    success: null,
    old: {}
  });
});

// POST /users/register
router.post('/register', async (req, res) => {
  const { name, phone, email, password, confirm_password } = req.body;

  let error = null;
  let success = null;

  // ตรวจสอบข้อมูลที่จำเป็น
  if (!name || !phone || !email || !password || !confirm_password) {
    error = 'กรุณากรอกข้อมูลให้ครบทุกช่อง';
  } 
  // ตรวจสอบรูปแบบอีเมล
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error = 'รูปแบบอีเมลไม่ถูกต้อง';
  } 
  // ตรวจสอบความยาวรหัสผ่าน (เปลี่ยนจาก 8 เป็น 6 ให้สอดคล้องกับ EJS)
  else if (password.length < 6) {
    error = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
  } 
  // ตรวจสอบการยืนยันรหัสผ่าน
  else if (password !== confirm_password) {
    error = 'รหัสผ่านไม่ตรงกัน';
  }
  // ตรวจสอบรูปแบบเบอร์โทร (10 หลัก)
  else if (!/^[0-9]{10}$/.test(phone)) {
    error = 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก';
  }

  if (error) {
    return res.render('users/register', {
      error,
      success: null,
      old: req.body
    });
  }

  try {
    const pool = getPool(email);

    // ตรวจสอบว่าอีเมลนี้ถูกใช้งานแล้วหรือไม่
    const checkEmailQuery = 'SELECT cus_id FROM customer WHERE cus_email = ?';
    
    pool.query(checkEmailQuery, [email], async (err, rows) => {
      if (err) {
        console.error('Error checking email:', err);
        return res.render('users/register', {
          error: 'เกิดข้อผิดพลาดในการตรวจสอบอีเมล',
          success: null,
          old: req.body
        });
      }

      if (rows.length > 0) {
        return res.render('users/register', {
          error: 'อีเมลนี้ถูกใช้งานแล้ว',
          success: null,
          old: req.body
        });
      }

      try {
        // เข้ารหัสรหัสผ่าน
        const hashedPassword = await bcrypt.hash(password, 10);

        // เริ่ม transaction
        pool.getConnection((err, conn) => {
          if (err) {
            console.error('Connection error:', err);
            return res.render('users/register', {
              error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล',
              success: null,
              old: req.body
            });
          }

          conn.beginTransaction(err => {
            if (err) {
              console.error('Transaction error:', err);
              conn.release();
              return res.render('users/register', {
                error: 'เกิดข้อผิดพลาดในการเริ่ม transaction',
                success: null,
                old: req.body
              });
            }

            // บันทึกข้อมูลลูกค้า
            const insertCustomerQuery = 'INSERT INTO customer (cus_phon, cus_name, cus_email) VALUES (?, ?, ?)';
            
            conn.query(insertCustomerQuery, [phone, name, email], (err) => {
              if (err) {
                console.error('Error inserting customer:', err);
                return conn.rollback(() => {
                  conn.release();
                  res.render('users/register', {
                    error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า',
                    success: null,
                    old: req.body
                  });
                });
              }

              // บันทึกข้อมูลสิทธิ์การเข้าใช้
              const insertPermissionQuery = 'INSERT INTO permission (access_email, access_pwd, access_type) VALUES (?, ?, "customer")';
              
              conn.query(insertPermissionQuery, [email, hashedPassword], (err) => {
                if (err) {
                  console.error('Error inserting permission:', err);
                  return conn.rollback(() => {
                    conn.release();
                    res.render('users/register', {
                      error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสิทธิ์',
                      success: null,
                      old: req.body
                    });
                  });
                }
// commit transaction
conn.commit(async err => {
  if (err) {
    console.error('Error committing transaction:', err);
    return conn.rollback(() => {
      conn.release();
      res.render('users/register', {
        error: 'เกิดข้อผิดพลาดในการยืนยันการบันทึก',
        success: null,
        old: req.body
      });
    });
  }

  conn.release();
  console.log('✅ User registered successfully:', email);

  try {
    // 1) สร้าง token
    const token = crypto.randomBytes(32).toString("hex");

    // 2) เก็บ token ลง DB
    const pool2 = getPool();
    await pool2.promise().query(
      "INSERT INTO email_verification (email, token) VALUES (?, ?)",
      [email, token]
    );

    // 3) สร้าง transporter ที่นี่
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "65011213056@msu.ac.th",   // ใส่อีเมลจริง
        pass: "bcmrhpnphrjjbprz"       // App Password
      }
    });

    // 4) ลิงก์ยืนยัน
    const verifyUrl = `http://localhost:3000/users/verify-email?token=${token}`;

    // 5) ส่งอีเมล
    await transporter.sendMail({
      from: '"คลินิกสัตวแพทย์" <65011213056@msu.ac.th>',
      to: email,
      subject: "ยืนยันการสมัครสมาชิก",
      text: `สวัสดี คุณ ${name}\n\nกรุณากดลิงก์นี้เพื่อยืนยันอีเมลของคุณ: ${verifyUrl}`,
      html: `<p>สวัสดี คุณ ${name}</p>
             <p>กรุณากดลิงก์นี้เพื่อยืนยันอีเมลของคุณ:</p>
             <a href="${verifyUrl}">${verifyUrl}</a>`
    });

    console.log("📧 Verification email sent to:", email);
  } catch (mailErr) {
    console.error("❌ Error sending verification email:", mailErr);
  }

  // 6) ส่งข้อความกลับไปหน้าเว็บ
  res.render('users/register', {
    error: null,
    success: 'สมัครสมาชิกสำเร็จ! กรุณายืนยันอีเมลของคุณจากกล่องจดหมาย',
    old: {}
  });
});



              });
            });
          });
        });

      } catch (hashError) {
        console.error('Error hashing password:', hashError);
        return res.render('users/register', {
          error: 'เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน',
          success: null,
          old: req.body
        });
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.render('users/register', {
      error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง',
      success: null,
      old: req.body
    });
  }
});

export default router;