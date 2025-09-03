import express from 'express';
import multer from 'multer';
import path from 'path';
import { getPool } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';
const router = express.Router();

// ตั้งค่า multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public', 'uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB
});

// GET /users/edit_person
router.get('/edit_person', requireLogin, (req, res) => {
  const pool = getPool(req.session.user_email);
  const cus_id = req.session.cus_id;

  pool.query("SELECT * FROM customer WHERE cus_id = ?", [cus_id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("เกิดข้อผิดพลาดจากฐานข้อมูล");
    }

    if (results.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลลูกค้า");
    }

    res.render("users/edit_person", {
      customer: results[0],
      cus_name: req.session.user_name
    });
  });
});

// POST /users/update_customer
router.post('/update_customer', requireLogin, upload.single('profile_img'), (req, res) => {
  const { cus_id, cus_phon, cus_name, cus_email } = req.body;

  if (!cus_id || !cus_name || !cus_phon || !cus_email) {
    return res.status(400).send("ข้อมูลไม่ครบค่ะ");
  }

  const pool = getPool(req.session.user_email);

  let sql, params;

  if (req.file) {
    // อัปโหลดรูปใหม่
    sql = `UPDATE customer 
           SET cus_phon = ?, cus_name = ?, cus_email = ?, cus_img = ? 
           WHERE cus_id = ?`;
    params = [cus_phon, cus_name, cus_email, req.file.filename, cus_id];
  } else {
    // ไม่อัปโหลดรูป
    sql = `UPDATE customer 
           SET cus_phon = ?, cus_name = ?, cus_email = ? 
           WHERE cus_id = ?`;
    params = [cus_phon, cus_name, cus_email, cus_id];
  }

  pool.query(sql, params, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("เกิดข้อผิดพลาดในการแก้ไขข้อมูลค่ะ");
    }

    res.redirect(`/users/select_pet?cus_id=${req.session.cus_id}`);
  });
});

export default router;