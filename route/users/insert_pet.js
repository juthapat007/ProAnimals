import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';  // Fixed path - go up 2 levels to reach middleware

const router = express.Router();

// __dirname สำหรับ ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ตั้งค่า multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads')); 
  },
  filename: (req, file, cb) => {
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

// 👉 POST: บันทึกสัตว์เลี้ยง
router.post('/insert_pet', requireLogin, upload.single('pet_img'), (req, res) => {
  const pool = getPool(req.session.user_email);
  const { pet_name, pet_gender, type_id } = req.body;
  const cus_id = req.session.cus_id;

  if (!pet_name || !pet_gender || !type_id || !req.file) {
    return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วน');
  }

  const img = req.file.filename;

  pool.query(
    `INSERT INTO pet (pet_name, pet_gender, type_id, cus_id, img) 
     VALUES (?, ?, ?, ?, ?)`,
    [pet_name, pet_gender, type_id, cus_id, img],
    (err) => {
      if (err) return res.status(500).send('Database Error');
      res.redirect('/select_pet');
    }
  );
});

// 👉 GET: แสดงฟอร์มเพิ่มสัตว์เลี้ยง
router.get('/insert_pet', requireLogin, (req, res) => {
  const pool = getPool(req.session.user_email);
  pool.query("SELECT type_id, type FROM pet_type ORDER BY type", (err, results) => {
    if (err) return res.status(500).send('Database Error');
    res.render('users/insert_pet', { 
      pet_types: results,
      email: req.session.user_email,
      accessType: req.session.access_type,
      userData: { access_pwd: req.session.access_pwd || '' } // ป้องกัน error
    });
  });
});

export default router;