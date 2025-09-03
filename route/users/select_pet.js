import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// ✅ GET /users/select_pet - แสดงหน้าเลือกสัตว์เลี้ยง
router.get("/", requireLogin, async (req, res) => {
  try {
    // ตรวจสอบ session
    if (!req.session.user_email || !req.session.cus_id) {
      console.log('❌ Session missing:', {
        user_email: req.session.user_email,
        cus_id: req.session.cus_id
      });
      return res.redirect("/login");
    }

    const user_email = req.session.user_email;
    const pool = getPoolPromise(user_email);

    // 1) ดึงข้อมูลลูกค้า (double-check)
    const [cusRows] = await pool.query(
      "SELECT cus_id, cus_name FROM customer WHERE cus_email = ?", 
      [user_email]
    );

    if (cusRows.length === 0) {
      console.log('❌ Customer not found for email:', user_email);
      return res.render("users/select_pet", {
        cus_id: null,
        cus_name: "",
        pets: [],
        error: "ไม่พบข้อมูลลูกค้า กรุณาเข้าสู่ระบบใหม่",
      });
    }

    const { cus_id, cus_name } = cusRows[0];

    // เช็คว่า cus_id ใน database ตรงกับ session หรือไม่
    if (parseInt(cus_id) !== parseInt(req.session.cus_id)) {
      console.log('❌ Customer ID mismatch:', {
        db_cus_id: cus_id,
        session_cus_id: req.session.cus_id
      });
      return res.redirect('/logout');
    }

    // 2) ดึงข้อมูลสัตว์เลี้ยงที่ผูกกับลูกค้า
    const [petRows] = await pool.query(
      `SELECT p.pet_id, p.pet_name, p.pet_gender, p.img, t.type
       FROM pet p
       LEFT JOIN pet_type t ON p.type_id = t.type_id
       WHERE p.cus_id = ?
       ORDER BY p.pet_name ASC`,
      [cus_id]
    );

    console.log(`✅ Found ${petRows.length} pets for customer ${cus_name} (ID: ${cus_id})`);

    res.render("users/select_pet", {
      cus_id: cus_id,
      cus_name: cus_name,
      pets: petRows,
      error: null,
    });

  } catch (err) {
    console.error("❌ Error GET /users/select_pet:", err);
    res.render("users/select_pet", {
      cus_id: req.session.cus_id || null,
      cus_name: req.session.user_name || "",
      pets: [],
      error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// ✅ POST /users/select_pet - เมื่อเลือกสัตว์เลี้ยงแล้ว (optional route)
router.post("/", requireLogin, async (req, res) => {
  const { pet_id } = req.body;
  const cus_id = req.session.cus_id;

  if (!pet_id || !cus_id) {
    return res.redirect('/users/select_pet?error=missing_data');
  }

  try {
    const pool = getPoolPromise(req.session.user_email);
    
    // ตรวจสอบว่าสัตว์เลี้ยงนี้เป็นของลูกค้าคนนี้จริงๆ
    const [petCheck] = await pool.query(
      'SELECT pet_id, pet_name FROM pet WHERE pet_id = ? AND cus_id = ?',
      [pet_id, cus_id]
    );

    if (petCheck.length === 0) {
      return res.redirect('/users/select_pet?error=invalid_pet');
    }

    console.log(`✅ Pet selected: ${petCheck[0].pet_name} (ID: ${pet_id}) by customer ${cus_id}`);

    // ส่งต่อไป booking route
    res.redirect(`/users/booking?pet_id=${pet_id}&cus_id=${cus_id}`);

  } catch (error) {
    console.error('❌ Error POST /users/select_pet:', error);
    res.redirect('/users/select_pet?error=system_error');
  }
});

// ✅ API endpoint สำหรับดึงข้อมูลสัตว์เลี้ยง (สำหรับ AJAX)
router.get('/api/pets', requireLogin, async (req, res) => {
  try {
    if (!req.session.user_email || !req.session.cus_id) {
      return res.status(401).json({
        success: false,
        message: 'ไม่ได้เข้าสู่ระบบ'
      });
    }

    const pool = getPoolPromise(req.session.user_email);
    const [petRows] = await pool.query(
      `SELECT p.pet_id, p.pet_name, p.pet_gender, p.img, t.type
       FROM pet p
       LEFT JOIN pet_type t ON p.type_id = t.type_id
       WHERE p.cus_id = ?
       ORDER BY p.pet_name ASC`,
      [req.session.cus_id]
    );

    res.json({
      success: true,
      pets: petRows,
      count: petRows.length
    });

  } catch (error) {
    console.error('❌ Error GET /api/pets:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสัตว์เลี้ยง'
    });
  }
});

export default router;