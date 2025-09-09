import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ✅ GET - แสดงหน้าเพิ่มสัตว์เลี้ยงพร้อมรายการที่มีอยู่
router.get('/', requireLogin, async (req, res) => {
  try {
    const cusId = req.query.cus_id;
    
    // ตรวจสอบว่ามี cus_id หรือไม่
    if (!cusId) {
      return res.status(400).send('ไม่พบรหัสลูกค้า');
    }

    // ตรวจสอบสิทธิ์การเข้าถึง
    if (req.session.access_type !== 'admin') {
      return res.redirect('/');
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    try {
      // 1) ดึงประเภทสัตว์เลี้ยง
      const [types] = await pool.query('SELECT type_id, type FROM pet_type ORDER BY type ASC');

      // 2) ดึงข้อมูลลูกค้า
      const [customerRows] = await pool.query(
        'SELECT cus_id, cus_name, cus_email, cus_phon FROM customer WHERE cus_id = ?',
        [cusId]
      );

      if (customerRows.length === 0) {
        return res.status(404).send('ไม่พบข้อมูลลูกค้า');
      }

      const customer = customerRows[0];

      // 3) ดึงรายการสัตว์เลี้ยงที่ลูกค้ามีอยู่แล้ว
      const [existingPets] = await pool.query(
        `SELECT p.pet_id, p.pet_name, p.pet_gender, p.img, pt.type, pt.type_id
         FROM pet p
         LEFT JOIN pet_type pt ON p.type_id = pt.type_id
         WHERE p.cus_id = ?
         ORDER BY p.pet_name ASC`,
        [cusId]
      );

      console.log(`✅ Customer ${customer.cus_name} has ${existingPets.length} pets`);

      res.render('admin/add_pet', {
        cusId,
        customer,
        types,
        existingPets, // ✅ ส่งรายการสัตว์เลี้ยงที่มีอยู่
        error: req.query.error || null,
        success: req.query.success || null,
        pet_name: req.query.pet_name || null
      });

    } catch (dbError) {
      console.error('❌ Database error in add_pet GET:', dbError);
      res.status(500).send('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    }

  } catch (err) {
    console.error('❌ Error in add_pet GET:', err);
    res.status(500).send('เกิดข้อผิดพลาดในระบบ');
  }
});

// ✅ POST - เพิ่มสัตว์เลี้ยงใหม่
router.post('/', requireLogin, upload.single('pet_image'), async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์
    if (req.session.access_type !== 'admin') {
      return res.redirect('/');
    }

    const { pet_name, pet_gender, pet_type, cus_id } = req.body;
    const img = req.file ? req.file.filename : '';

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!pet_name || !pet_gender || !pet_type || !cus_id) {
      return res.redirect(`/admin/add_pet?cus_id=${cus_id}&error=missing_data`);
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    try {
      // ตรวจสอบว่าลูกค้ามีอยู่จริง
      const [customerCheck] = await pool.query(
        'SELECT cus_id FROM customer WHERE cus_id = ?',
        [cus_id]
      );

      if (customerCheck.length === 0) {
        return res.redirect(`/admin/add_pet?cus_id=${cus_id}&error=customer_not_found`);
      }

      // ตรวจสอบว่าสัตว์เลี้ยงชื่อนี้มีอยู่แล้วสำหรับลูกค้าคนนี้หรือไม่
      const [duplicateCheck] = await pool.query(
        'SELECT pet_id FROM pet WHERE pet_name = ? AND cus_id = ?',
        [pet_name, cus_id]
      );

      if (duplicateCheck.length > 0) {
        return res.redirect(`/admin/add_pet?cus_id=${cus_id}&error=duplicate_pet_name`);
      }

      // หาหรือสร้าง type_id
      const [typeRows] = await pool.query(
        'SELECT type_id FROM pet_type WHERE type = ?',
        [pet_type]
      );

      let type_id = typeRows.length > 0 ? typeRows[0].type_id : null;

      if (!type_id) {
        const [insertType] = await pool.query(
          'INSERT INTO pet_type (type) VALUES (?)',
          [pet_type]
        );
        type_id = insertType.insertId;
        console.log(`✅ Created new pet type: ${pet_type} (ID: ${type_id})`);
      }

      // เพิ่มสัตว์เลี้ยงใหม่
      const [result] = await pool.query(
        `INSERT INTO pet (pet_name, pet_gender, type_id, cus_id, img)
         VALUES (?, ?, ?, ?, ?)`,
        [pet_name, pet_gender, type_id, cus_id, img]
      );

      const newPetId = result.insertId;
      console.log(`✅ Added new pet: ${pet_name} (ID: ${newPetId}) for customer ${cus_id}`);

      // redirect กลับไปที่หน้าเดิมพร้อม success message
      res.redirect(`/admin/add_pet?cus_id=${cus_id}&success=pet_added&pet_name=${encodeURIComponent(pet_name)}`);

    } catch (dbError) {
      console.error('❌ Database error in add_pet POST:', dbError);
      res.redirect(`/admin/add_pet?cus_id=${cus_id}&error=database_error`);
    }

  } catch (err) {
    console.error('❌ Error in add_pet POST:', err);
    res.redirect(`/admin/add_pet?cus_id=${req.body.cus_id}&error=system_error`);
  }
});

// ✅ PUT - แก้ไขข้อมูลสัตว์เลี้ยง
router.put('/edit/:pet_id', requireLogin, upload.single('pet_image'), async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const petId = parseInt(req.params.pet_id);
    const { pet_name, pet_gender, pet_type, cus_id, keep_current_image } = req.body;
    
    if (!petId || !pet_name || !pet_gender || !pet_type || !cus_id) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    // ตรวจสอบว่าสัตว์เลี้ยงนี้เป็นของลูกค้าคนนี้จริง
    const [petCheck] = await pool.query(
      'SELECT pet_name, img FROM pet WHERE pet_id = ? AND cus_id = ?',
      [petId, cus_id]
    );

    if (petCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสัตว์เลี้ยง' });
    }

    const currentPet = petCheck[0];

    // ตรวจสอบชื่อซ้ำ (ยกเว้นสัตว์เลี้ยงตัวนี้เอง)
    const [duplicateCheck] = await pool.query(
      'SELECT pet_id FROM pet WHERE pet_name = ? AND cus_id = ? AND pet_id != ?',
      [pet_name, cus_id, petId]
    );

    if (duplicateCheck.length > 0) {
      return res.status(409).json({ success: false, message: 'ชื่อสัตว์เลี้ยงนี้มีอยู่แล้ว' });
    }

    // จัดการประเภทสัตว์เลี้ยง
    const [typeRows] = await pool.query(
      'SELECT type_id FROM pet_type WHERE type = ?',
      [pet_type]
    );

    let type_id = typeRows.length > 0 ? typeRows[0].type_id : null;

    if (!type_id) {
      const [insertType] = await pool.query(
        'INSERT INTO pet_type (type) VALUES (?)',
        [pet_type]
      );
      type_id = insertType.insertId;
    }

    // จัดการรูปภาพ
    let newImageName = currentPet.img; // ใช้รูปเดิม
    
    if (req.file) {
      // มีการอัปโหลดรูปใหม่
      newImageName = req.file.filename;
      
      // ลบรูปเดิม (ถ้ามี)
      if (currentPet.img) {
        try {
          await fs.promises.unlink(`public/uploads/${currentPet.img}`);
          console.log(`✅ Deleted old image: ${currentPet.img}`);
        } catch (err) {
          console.log(`⚠️ Could not delete old image: ${currentPet.img}`);
        }
      }
    } else if (!keep_current_image) {
      // ผู้ใช้ต้องการลบรูปภาพ
      if (currentPet.img) {
        try {
          await fs.promises.unlink(`public/uploads/${currentPet.img}`);
          console.log(`✅ Deleted image: ${currentPet.img}`);
        } catch (err) {
          console.log(`⚠️ Could not delete image: ${currentPet.img}`);
        }
      }
      newImageName = '';
    }

    // อัปเดตข้อมูลสัตว์เลี้ยง
    await pool.query(
      `UPDATE pet SET pet_name = ?, pet_gender = ?, type_id = ?, img = ?
       WHERE pet_id = ? AND cus_id = ?`,
      [pet_name, pet_gender, type_id, newImageName, petId, cus_id]
    );

    console.log(`✅ Updated pet: ${pet_name} (ID: ${petId})`);

    res.json({
      success: true,
      message: `แก้ไขข้อมูล ${pet_name} เรียบร้อยแล้ว`,
      pet: {
        pet_id: petId,
        pet_name,
        pet_gender,
        type: pet_type,
        img: newImageName
      }
    });

  } catch (error) {
    console.error('❌ Error updating pet:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล'
    });
  }
});

// ✅ DELETE - ลบสัตว์เลี้ยง (สำหรับ AJAX)
router.delete('/remove/:pet_id', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const petId = parseInt(req.params.pet_id);
    const cusId = req.query.cus_id;

    if (!petId || !cusId) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    // ตรวจสอบว่าสัตว์เลี้ยงนี้เป็นของลูกค้าคนนี้จริง
    const [petCheck] = await pool.query(
      'SELECT pet_name, img FROM pet WHERE pet_id = ? AND cus_id = ?',
      [petId, cusId]
    );

    if (petCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสัตว์เลี้ยง' });
    }

    const pet = petCheck[0];

    // ตรวจสอบว่าสัตว์เลี้ยงนี้มีการจองหรือประวัติการรักษาหรือไม่
    const [bookingCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM booking WHERE pet_id = ?',
      [petId]
    );

    if (bookingCheck[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: `ไม่สามารถลบ ${pet.pet_name} ได้ เนื่องจากมีประวัติการจองบริการ`
      });
    }

    // ลบรูปภาพ (ถ้ามี)
    if (pet.img) {
      try {
        await fs.promises.unlink(`public/uploads/${pet.img}`);
        console.log(`✅ Deleted pet image: ${pet.img}`);
      } catch (err) {
        console.log(`⚠️ Could not delete pet image: ${pet.img}`);
      }
    }

    // ลบสัตว์เลี้ยง
    await pool.query('DELETE FROM pet WHERE pet_id = ?', [petId]);

    console.log(`✅ Deleted pet: ${pet.pet_name} (ID: ${petId})`);

    res.json({
      success: true,
      message: `ลบข้อมูล ${pet.pet_name} เรียบร้อยแล้ว`
    });

  } catch (error) {
    console.error('❌ Error deleting pet:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบข้อมูล'
    });
  }
});

// ✅ GET - ดึงข้อมูลสัตว์เลี้ยงสำหรับแก้ไข
router.get('/edit/:pet_id', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const petId = parseInt(req.params.pet_id);
    const cusId = req.query.cus_id;

    if (!petId || !cusId) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    const [petRows] = await pool.query(
      `SELECT p.pet_id, p.pet_name, p.pet_gender, p.img, pt.type, pt.type_id
       FROM pet p
       LEFT JOIN pet_type pt ON p.type_id = pt.type_id
       WHERE p.pet_id = ? AND p.cus_id = ?`,
      [petId, cusId]
    );

    if (petRows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสัตว์เลี้ยง' });
    }

    res.json({
      success: true,
      pet: petRows[0]
    });

  } catch (error) {
    console.error('❌ Error fetching pet data:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล'
    });
  }
});

// ✅ API endpoint สำหรับดึงข้อมูลสัตว์เลี้ยงของลูกค้า
router.get('/api/customer/:cus_id/pets', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'admin') {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const cusId = req.params.cus_id;
    const userEmail = req.session?.user_email || 'wun@example.com';
    const pool = getPoolPromise(userEmail);

    const [pets] = await pool.query(
      `SELECT p.pet_id, p.pet_name, p.pet_gender, p.img, pt.type
       FROM pet p
       LEFT JOIN pet_type pt ON p.type_id = pt.type_id
       WHERE p.cus_id = ?
       ORDER BY p.pet_name ASC`,
      [cusId]
    );

    res.json({
      success: true,
      pets: pets,
      count: pets.length
    });

  } catch (error) {
    console.error('❌ Error fetching pets:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล'
    });
  }
});

export default router;