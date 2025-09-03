import express from 'express';
import bcrypt from 'bcrypt';
import { getPool } from '../../config/db.js';

const router = express.Router();

// GET /users/register
router.get('/register', (req, res) => {
  res.render('users/register', {
    error: null,
    success: null,
  });
});
// POST /users/register
router.post('/register', (req, res) => {
  const { name, phone, email, password, confirm_password } = req.body;

  let error = null;
  let success = null;

  if (!name || !phone || !email || !password) {
    error = 'กรุณากรอกข้อมูลให้ครบทุกช่อง';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error = 'รูปแบบอีเมลไม่ถูกต้อง';
  } else if (password.length < 8) {
    error = 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร';
  } else if (password !== confirm_password) {
    error = 'รหัสผ่านไม่ตรงกัน';
  }

  if (error) {
    return res.render('users/register', {
      error,
      success: null,
      old: req.body
    });
  }

  const pool = getPool(email);

  pool.query(
    'SELECT cus_id FROM customer WHERE cus_email = ?',
    [email],
    (err, rows) => {
      if (err) {
        console.error(err);
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

      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          console.error(err);
          return res.render('users/register', {
            error: 'เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน',
            success: null,
            old: req.body
          });
        }

        pool.getConnection((err, conn) => {
          if (err) {
            console.error(err);
            return res.render('users/register', {
              error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล',
              success: null,
              old: req.body
            });
          }

          conn.beginTransaction(err => {
            if (err) {
              console.error(err);
              conn.release();
              return res.render('users/register', {
                error: 'เกิดข้อผิดพลาดในการเริ่ม transaction',
                success: null,
                old: req.body
              });
            }

            conn.query(
              'INSERT INTO customer (cus_phon, cus_name, cus_email) VALUES (?, ?, ?)',
              [phone, name, email],
              (err) => {
                if (err) {
                  console.error(err);
                  return conn.rollback(() => {
                    conn.release();
                    res.render('users/register', {
                      error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล customer',
                      success: null,
                      old: req.body
                    });
                  });
                }

                conn.query(
                  'INSERT INTO permission (access_email, access_pwd, access_type) VALUES (?, ?, "customer")',
                  [email, hash],
                  (err) => {
                    if (err) {
                      console.error(err);
                      return conn.rollback(() => {
                        conn.release();
                        res.render('users/register', {
                          error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล permission',
                          success: null,
                          old: req.body
                        });
                      });
                    }

                    conn.commit(err => {
                      if (err) {
                        console.error(err);
                        return conn.rollback(() => {
                          conn.release();
                          res.render('users/register', {
                            error: 'เกิดข้อผิดพลาดในการ commit',
                            success: null,
                            old: req.body
                          });
                        });
                      }

                      conn.release();
                      res.render('users/register', {
                        error: null,
                        success: 'สมัครสมาชิกสำเร็จ! คุณสามารถเข้าสู่ระบบได้ทันที',
                        old: {}
                      });
                    });
                  }
                );
              }
            );
          });
        });
      });
    }
  );
});

export default router;