// route/users/pets.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireLogin } from '../../middleware/auth.js';
import { getPoolPromise } from '../../config/db.js'; // ✅ แก้ไขให้ใช้ getPoolPromise

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB
});

// ✅ GET /users/select_pet - แสดงรายการสัตว์เลี้ยง
router.get('/select_pet', requireLogin, async (req, res) => {
  try {
    // ตรวจสอบว่าเป็น customer หรือไม่
    if (req.session.access_type !== 'customer') {
      return res.redirect('/');
    }

    const cus_id = req.session.cus_id;
    const cus_name = req.session.user_name || "ไม่ทราบชื่อ";

    console.log("🐕 Loading select_pet for customer:", { cus_id, cus_name });

    const pool = getPoolPromise(req.session.user_email);

    // ✅ ใช้ async/await แทน callback
    const [pets] = await pool.query(
      `SELECT p.*, pt.type AS pet_type_name
       FROM pet p
       LEFT JOIN pet_type pt ON p.type_id = pt.type_id
       WHERE p.cus_id = ?
       ORDER BY p.pet_name ASC`,
      [cus_id]
    );

    // ดึงข้อมูลประเภทสัตว์เลี้ยงด้วย (สำหรับใช้ในอนาคต)
    const [petTypes] = await pool.query("SELECT * FROM pet_type ORDER BY type ASC");

    console.log(`📊 Found ${pets.length} pets for customer ${cus_id}`);

    res.render('users/select_pet', {
      cus_id,
      cus_name,
      pets: pets || [],
      pet_types: petTypes || [],
      error: null
    });

  } catch (error) {
    console.error('❌ Error in select_pet:', error);
    res.status(500).render('users/select_pet', {
      cus_id: req.session.cus_id,
      cus_name: req.session.user_name,
      pets: [],
      pet_types: [],
      error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลสัตว์เลี้ยง'
    });
  }
});

// ✅ GET /users/insert_pet - แสดงฟอร์มเพิ่มสัตว์เลี้ยง
router.get('/insert_pet', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'customer') {
      return res.redirect('/');
    }

    const pool = getPoolPromise(req.session.user_email);
    const [petTypes] = await pool.query('SELECT * FROM pet_type ORDER BY type ASC');

    res.render('users/insert_pet', { 
      pet_types: petTypes,
      cus_id: req.session.cus_id,
      cus_name: req.session.user_name
    });

  } catch (error) {
    console.error('❌ Error loading insert_pet:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดหน้าเพิ่มสัตว์เลี้ยง');
  }
});

// ✅ POST /users/insert_pet - บันทึกข้อมูลสัตว์เลี้ยงใหม่
router.post('/insert_pet', requireLogin, upload.single('pet_img'), async (req, res) => {
  try {
    if (req.session.access_type !== 'customer') {
      return res.status(403).send('ไม่มีสิทธิ์เข้าถึง');
    }

    const pool = getPoolPromise(req.session.user_email);
    const { pet_name, pet_gender, type_id } = req.body;
    const cus_id = req.session.cus_id;

    console.log("📝 Insert pet data:", { pet_name, pet_gender, type_id, cus_id, hasFile: !!req.file });

    if (!pet_name || !pet_gender || !type_id || !req.file) {
      return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วนและเลือกรูปภาพ');
    }

    const img = req.file.filename;

    await pool.query(
      `INSERT INTO pet (pet_name, pet_gender, type_id, cus_id, img) 
       VALUES (?, ?, ?, ?, ?)`,
      [pet_name, pet_gender, type_id, cus_id, img]
    );

    console.log("✅ Pet inserted successfully");
    res.redirect('/users/select_pet');

  } catch (error) {
    console.error('❌ Error inserting pet:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
});

// ✅ GET /users/edit_pet - แสดงฟอร์มแก้ไขสัตว์เลี้ยง
router.get('/edit_pet', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'customer') {
      return res.redirect('/');
    }

    const pet_id = req.query.pet_id;

    if (!pet_id) {
      return res.status(400).send("ไม่พบ pet_id");
    }

    const pool = getPoolPromise(req.session.user_email);

    // ตรวจสอบว่าสัตว์เลี้ยงเป็นของลูกค้าคนนี้หรือไม่
    const [petResults] = await pool.query(
      "SELECT * FROM pet WHERE pet_id = ? AND cus_id = ?",
      [pet_id, req.session.cus_id]
    );

    if (petResults.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลสัตว์เลี้ยงหรือไม่มีสิทธิ์เข้าถึง");
    }

    const pet = petResults[0];

    const [petTypes] = await pool.query("SELECT * FROM pet_type ORDER BY type ASC");

    res.render("users/edit_pet", {
      pet,
      pet_types: petTypes,
      cus_id: req.session.cus_id,
      cus_name: req.session.user_name
    });

  } catch (error) {
    console.error("❌ Error loading edit_pet:", error);
    res.status(500).send("เกิดข้อผิดพลาดในการโหลดข้อมูลสัตว์เลี้ยง");
  }
});

// ✅ POST /users/update_pet - อัปเดตข้อมูลสัตว์เลี้ยง
router.post('/update_pet', requireLogin, upload.single('pet_img'), async (req, res) => {
  try {
    if (req.session.access_type !== 'customer') {
      return res.status(403).send('ไม่มีสิทธิ์เข้าถึง');
    }

    console.log("📝 Update pet - BODY:", req.body);
    console.log("📝 Update pet - FILE:", req.file);

    const { pet_id, pet_name, type_id, pet_gender } = req.body;

    if (!pet_id || !pet_name || !type_id || !pet_gender) {
      return res.status(400).send("ข้อมูลไม่ครบค่ะ");
    }

    const pool = getPoolPromise(req.session.user_email);

    // ตรวจสอบสิทธิ์ก่อนแก้ไข
    const [checkPet] = await pool.query(
      "SELECT pet_id FROM pet WHERE pet_id = ? AND cus_id = ?",
      [pet_id, req.session.cus_id]
    );

    if (checkPet.length === 0) {
      return res.status(403).send("ไม่มีสิทธิ์แก้ไขสัตว์เลี้ยงนี้");
    }

    let sql, params;

    if (req.file) {
      // อัปโหลดรูปใหม่
      sql = `UPDATE pet 
             SET pet_name = ?, type_id = ?, pet_gender = ?, img = ?
             WHERE pet_id = ? AND cus_id = ?`;
      params = [pet_name, type_id, pet_gender, req.file.filename, pet_id, req.session.cus_id];
    } else {
      // ไม่อัปโหลดรูป
      sql = `UPDATE pet 
             SET pet_name = ?, type_id = ?, pet_gender = ?
             WHERE pet_id = ? AND cus_id = ?`;
      params = [pet_name, type_id, pet_gender, pet_id, req.session.cus_id];
    }

    await pool.query(sql, params);

    console.log("✅ Pet updated successfully");
    res.redirect('/users/select_pet');

  } catch (error) {
    console.error("❌ Error updating pet:", error);
    res.status(500).send("เกิดข้อผิดพลาดในการแก้ไขข้อมูลสัตว์ค่ะ");
  }
});

// ✅ DELETE /users/delete_pet - ลบสัตว์เลี้ยง (เผื่อต้องใช้ในอนาคต)
router.post('/delete_pet', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'customer') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const { pet_id } = req.body;

    if (!pet_id) {
      return res.status(400).json({ success: false, message: 'ไม่พบ pet_id' });
    }

    const pool = getPoolPromise(req.session.user_email);

    // ตรวจสอบสิทธิ์
    const [checkPet] = await pool.query(
      "SELECT pet_id FROM pet WHERE pet_id = ? AND cus_id = ?",
      [pet_id, req.session.cus_id]
    );

    if (checkPet.length === 0) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ลบสัตว์เลี้ยงนี้' });
    }

    await pool.query("DELETE FROM pet WHERE pet_id = ? AND cus_id = ?", [pet_id, req.session.cus_id]);

    console.log("✅ Pet deleted successfully");
    res.json({ success: true, message: 'ลบสัตว์เลี้ยงสำเร็จ' });

  } catch (error) {
    console.error("❌ Error deleting pet:", error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

export default router;