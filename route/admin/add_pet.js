import express from 'express';
import { getPool } from '../../config/db.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET
router.get('/', async (req, res) => {
  const cusId = req.query.cus_id;
  const db = getPool().promise();

  try {
    const [types] = await db.query('SELECT type_id, type FROM pet_type');
    let customer = null;
    if (cusId) {
      const [rows] = await db.query(
        'SELECT cus_email, cus_phon FROM customer WHERE cus_id = ?',
        [cusId]
      );
      customer = rows[0] || null;
    }
    res.render('admin/add_pet', { cusId, customer, types });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// POST
router.post('/', upload.single('pet_image'), async (req, res) => {
  const { pet_name, pet_gender, pet_type, cus_id } = req.body;
  const img = req.file ? req.file.filename : '';
  const db = getPool().promise();

  try {
    const [typeRows] = await db.query(
      'SELECT type_id FROM pet_type WHERE type = ?',
      [pet_type]
    );
    let type_id = typeRows.length > 0 ? typeRows[0].type_id : null;
    if (!type_id) {
      const [insertType] = await db.query(
        'INSERT INTO pet_type (type) VALUES (?)',
        [pet_type]
      );
      type_id = insertType.insertId;
    }
    await db.query(
      `INSERT INTO pet (pet_name, pet_gender, type_id, cus_id, img, pet_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [pet_name, pet_gender, type_id, cus_id, img, type_id.toString()]
    );
    res.redirect('/somewhere');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการเพิ่มสัตว์เลี้ยง');
  }
});

export default router; // <-- ต้องมี export default
