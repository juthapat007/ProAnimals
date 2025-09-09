//route/vet/manageHistory.js
import express from "express";
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// ✅ เพิ่ม GET route สำหรับหน้าหลักจัดการประวัติการรักษา
router.get("/", requireLogin, async (req, res) => {
  try {
    // ตรวจสอบสิทธิ์
    if (req.session.access_type !== "veterinarian") {
      return res.redirect("/");
    }

    const pool = getPoolPromise(req.session.user_email);
    
    // ดึงประวัติการรักษาทั้งหมด
    const [treatments] = await pool.query(`
      SELECT 
        th.treatment_id,
        th.treatment_date,
        th.pet_weight_kg,
        th.treatment_details,
        th.vet_notes,
        th.booking_id,
        p.pet_name,
        p.pet_gender,
        pt.type as pet_type,
        c.cus_name,
        v.vet_name,
        b.booking_date,
        b.time_booking,
        st.service_type as service_name
      FROM treatment_history th
      LEFT JOIN booking b ON th.booking_id = b.booking_id
      LEFT JOIN pet p ON b.pet_id = p.pet_id
      LEFT JOIN customer c ON b.cus_id = c.cus_id
      LEFT JOIN pet_type pt ON p.type_id = pt.type_id
      LEFT JOIN veterinarian v ON th.vet_id = v.vet_id
      LEFT JOIN service_type st ON b.service_id = st.service_id
      ORDER BY th.treatment_date DESC
    `);

    // ตรวจสอบว่ามีไฟล์ template หรือไม่
    console.log("🔍 Loading manage history page...");
    console.log("📊 Total treatments found:", treatments.length);

    res.render("veterinarian/manage_history", {
      vetId: req.session.vet_id,
      vetName: req.session.user_name,
      treatments: treatments,
      user_name: req.session.user_name
    });

  } catch (error) {
    console.error("❌ Error loading manage history:", error);
    res.status(500).send(`เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}`);
  }
});

// GET route สำหรับแสดงหน้าฟอร์มบันทึกประวัติการรักษา// GET route สำหรับแสดงหน้าฟอร์มบันทึกประวัติการรักษา
router.get("/:booking_id", requireLogin, async (req, res) => {
  try {
    // ถ้าไม่ใช่ veterinarian ให้ redirect ไปหน้าอื่น
    if (req.session.access_type !== "veterinarian") {
      return res.redirect("/");
    }

    const { booking_id } = req.params;
    const pool = getPoolPromise(req.session.user_email);

    console.log("Booking ID:", booking_id);
    console.log("Session email:", req.session.user_email);
    console.log("Session vet_id:", req.session.vet_id);

    // หา vet_id จาก email ในฐานข้อมูลจริง
    const [veterinarianResult] = await pool.query(
      'SELECT vet_id FROM veterinarian WHERE vet_email = ?',
      [req.session.user_email]
    );

    if (veterinarianResult.length === 0) {
      return res.status(403).send("ไม่พบข้อมูลสัตวแพทย์");
    }

    const actualVetId = veterinarianResult[0].vet_id;
    console.log("Actual vet_id from DB:", actualVetId);

    // อัปเดต session ให้ตรงกับฐานข้อมูล
    req.session.vet_id = actualVetId;

    // ดึง booking โดยไม่จำกัด vet_id (สัตวแพทย์ทุกคนเข้าถึงได้)
    const [bookingResult] = await pool.query(`
      SELECT 
        b.*,
        p.pet_name,
        pt.type as pet_type_name,
        c.cus_name as owner_name,
        st.service_type as service_name,
        v.vet_name,
        v.vet_id as vetId
      FROM booking b
      INNER JOIN pet p ON b.pet_id = p.pet_id
      INNER JOIN pet_type pt ON p.type_id = pt.type_id
      INNER JOIN customer c ON b.cus_id = c.cus_id
      INNER JOIN service_type st ON b.service_id = st.service_id
      INNER JOIN veterinarian v ON b.vet_id = v.vet_id
      WHERE b.booking_id = ?
    `, [booking_id]);

    console.log("Booking query result:", bookingResult);

    if (!bookingResult || bookingResult.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลการจอง");
    }

    const [existingHistory] = await pool.query(`
      SELECT th.*, v.vet_name
      FROM treatment_history th
      INNER JOIN veterinarian v ON th.vet_id = v.vet_id
      WHERE th.booking_id = ?
      ORDER BY th.treatment_date DESC
    `, [booking_id]);

    const booking = bookingResult[0];
    const hasExistingHistory = existingHistory.length > 0;
    const today = new Date().toLocaleDateString('th-TH');

    res.render("veterinarian/mg_history", {
      booking,
      histories: existingHistory,
      hasExistingHistory,
      today,
      vetName: booking.vet_name,
      vetId: actualVetId
    });

  } catch (err) {
    console.error("MG History page error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});

// POST route สำหรับบันทึกข้อมูลการรักษา
router.post("/save", requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== "veterinarian") {
      return res.status(403).json({ success: false, message: "ไม่มีสิทธิ์ทำรายการนี้" });
    }

    const { booking_id, weight, research, treatment_details } = req.body;
    const vetId = req.session.vet_id; // สมมุติว่าเก็บ vet_id ใน session

    if (!booking_id || !weight || !treatment_details) {
      return res.status(400).json({ success: false, message: "กรอกข้อมูลไม่ครบ" });
    }

    const pool = getPoolPromise(req.session.user_email);

    // ตรวจสอบว่ามีประวัติการรักษาอยู่แล้วหรือไม่
    const [existing] = await pool.query(
      `SELECT treatment_id FROM treatment_history WHERE booking_id = ?`,
      [booking_id]
    );

    if (existing.length > 0) {
      return res.json({ success: false, message: "เคสนี้บันทึกประวัติแล้ว" });
    }

    // Insert ข้อมูลลง treatment_history
    const [result] = await pool.query(
      `INSERT INTO treatment_history
       (booking_id, pet_weight_kg, treatment_date, treatment_details, vet_id, pay_status, payment)
       VALUES (?, ?, CURDATE(), ?, ?, 'ค้างชำระ', 'ค้างชำระ')`,
      [booking_id, weight, treatment_details, vetId]
    );

    if (result.affectedRows === 1) {
      return res.json({ success: true, message: "บันทึกประวัติเรียบร้อย" });
    } else {
      return res.json({ success: false, message: "ไม่สามารถบันทึกประวัติได้" });
    }

  } catch (err) {
    console.error("❌ Save history error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
});

// GET route สำหรับดึงข้อมูลประวัติการรักษา
router.get("/history/:booking_id", requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== "veterinarian") {
      return res.status(403).json({ 
        success: false, 
        message: "ไม่มีสิทธิ์เข้าถึง" 
      });
    }

    const { booking_id } = req.params;
    const pool = getPoolPromise(req.session.user_email);

    // ดึงประวัติการรักษาพร้อมข้อมูลที่เกี่ยวข้อง
    const [histories] = await pool.query(`
      SELECT 
        th.treatment_id,
        th.booking_id,
        th.pet_weight_kg,
        b.booking_date,
        b.time_booking,
        b.status as booking_status,
        b.customer_type,
        p.pet_name,
        pt.type as pet_type_name,
        c.cus_name as owner_name,
        st.service_type as service_name,
        v.vet_name
      FROM treatment_history th
      INNER JOIN booking b ON th.booking_id = b.booking_id
      INNER JOIN pet p ON b.pet_id = p.pet_id
      INNER JOIN pet_type pt ON p.type_id = pt.type_id
      INNER JOIN customer c ON b.cus_id = c.cus_id
      INNER JOIN service_type st ON b.service_id = st.service_id
      INNER JOIN veterinarian v ON th.vet_id = v.vet_id
      WHERE th.booking_id = ?
      ORDER BY th.treatment_date DESC
    `, [booking_id]);

    res.json({ 
      success: true, 
      data: histories 
    });

  } catch (err) {
    console.error("❌ Treatment history fetch error:", err);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล" 
    });
  }
});

// PUT route สำหรับแก้ไขประวัติการรักษา
router.put("/edit/:treatment_id", requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== "veterinarian") {
      return res.status(403).json({ 
        success: false, 
        message: "ไม่มีสิทธิ์เข้าถึง" 
      });
    }

    const { treatment_id } = req.params;
    const { weight, research, treatment_details, pay_status, payment } = req.body;

    // Validation
    if (!weight || !treatment_details) {
      return res.status(400).json({ 
        success: false, 
        message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" 
      });
    }

    const weightFloat = parseFloat(weight);
    if (isNaN(weightFloat) || weightFloat <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "น้ำหนักต้องเป็นตัวเลขที่มากกว่า 0" 
      });
    }

    const pool = getPoolPromise(req.session.user_email);

    // ตรวจสอบสิทธิ์ในการแก้ไข
    const [treatmentCheck] = await pool.query(`
      SELECT th.*, v.vet_email 
      FROM treatment_history th
      INNER JOIN veterinarian v ON th.vet_id = v.vet_id
      WHERE th.treatment_id = ? AND th.vet_id = ?
    `, [treatment_id, req.session.user_email]);

    if (treatmentCheck.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบข้อมูลหรือไม่มีสิทธิ์แก้ไข" 
      });
    }

    // เตรียมข้อมูลสำหรับอัพเดท
    let finalTreatmentDetails = treatment_details.trim();
    if (research && research.trim()) {
      finalTreatmentDetails = `การวิจัย/ตรวจพิเศษ: ${research.trim()}\n\nรายละเอียดการรักษา: ${treatment_details.trim()}`;
    }

    // อัพเดทข้อมูล
    const updateQuery = `
      UPDATE treatment_history 
      SET 
        pet_weight_kg = ?,
        treatment_details = ?
        ${pay_status ? ', pay_status = ?' : ''}
        ${payment ? ', payment = ?' : ''}
      WHERE treatment_id = ?
    `;

    const updateParams = [weightFloat, finalTreatmentDetails];
    if (pay_status) updateParams.push(pay_status);
    if (payment) updateParams.push(payment);
    updateParams.push(treatment_id);

    await pool.query(updateQuery, updateParams);

    console.log(`✅ Treatment history updated successfully - ID: ${treatment_id}`);

    res.json({ 
      success: true, 
      message: "แก้ไขประวัติการรักษาเรียบร้อยแล้ว" 
    });

  } catch (err) {
    console.error("❌ Treatment history update error:", err);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการแก้ไขข้อมูル" 
    });
  }
});

export default router;