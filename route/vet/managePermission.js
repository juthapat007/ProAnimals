import express from "express";
import { getPoolPromise } from "../../config/db.js"; // ปรับ path ให้ตรงกับโปรเจกต์คุณ
import { requireLogin } from "../../middleware/auth.js"; // กันคนไม่ได้ login

const router = express.Router();

// แสดงหน้าจัดการสิทธิ์
router.get("/", requireLogin, async (req, res) => {
  try {
    const pool = getPoolPromise(req.session.user_email);
    const [permissions] = await pool.query(`
      SELECT p.count_users, p.access_email, p.access_type, c.cus_name, c.cus_phon
      FROM permission p
      LEFT JOIN customer c ON p.access_email = c.cus_email
      WHERE access_type = 'customer';
    `);

    res.render("veterinarian/mg_permission", {
      permissions, // ส่งไปหน้า ejs
      user: req.session, // เผื่อเอาไปใช้โชว์ชื่อ
        vetId: req.session.vet_id  // สมมุติคุณเก็บ vet_id ไว้ใน session
    });
  } catch (err) {
    console.error("❌ Error fetching permissions:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์");
  }
});

// 📌 อัพเดทสิทธิ์
// POST /update/:id
router.post("/update/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const { access_type } = req.body;

    const pool = getPoolPromise(req.session.user_email);

    // ดึงข้อมูลผู้ใช้ก่อนแก้ไข
    const [rows] = await pool.query(
      `SELECT p.access_email, p.access_pwd, c.cus_name, c.cus_phon
       FROM permission p
       LEFT JOIN customer c ON p.access_email = c.cus_email
       WHERE p.count_users = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).send("User not found");

    const user = rows[0];

    // อัพเดท access_type ในตาราง permission
    await pool.query(
      "UPDATE permission SET access_type = ? WHERE count_users = ?",
      [access_type, id]
    );

    // ถ้า access_type เป็น admin
    if (access_type === "admin") {
      const [existingAdmin] = await pool.query(
        "SELECT admin_email FROM admin WHERE admin_email = ?",
        [user.access_email]
      );
      if (existingAdmin.length === 0) {
        await pool.query(
          `INSERT INTO admin (admin_email, admin_name, admin_phon)
           VALUES (?, ?, ?)`,
          [user.access_email, user.cus_name, user.cus_phon]
        );
      }
    }

    // ถ้า access_type เป็น veterinarian
    if (access_type === "veterinarian") {
      const [existingVet] = await pool.query(
        "SELECT vet_email FROM veterinarian WHERE vet_email = ?",
        [user.access_email]
      );
      if (existingVet.length === 0) {
        const [last] = await pool.query("SELECT vet_id FROM veterinarian ORDER BY vet_id DESC LIMIT 1");

    let newId = "VET001"; // ค่าเริ่มต้นถ้ายังไม่มีข้อมูลเลย
    if (last.length > 0) {
      const lastId = last[0].medication_id; // เช่น M005
      const num = parseInt(lastId.replace("VET", "")) + 1; // 5+1 = 6
      newId = "VET" + num.toString().padStart(2, "0"); // ได้ M006
    }
        await pool.query(
          `INSERT INTO veterinarian (vet_id, vet_name, vet_email, vet_phon)
           VALUES (?, ?, ?, ?)`,
          [newId, user.cus_name, user.access_email, user.cus_phon]
        );
      }
    }

    res.render("veterinarian/mg_permission", {
  permissions,
  user: req.session,
  vetId: req.session.vet_id  // สมมุติคุณเก็บ vet_id ไว้ใน session
});

  } catch (err) {
    console.error("❌ Update permission error:", err);
    res.status(500).send("Database Error: " + err.message);
  }
});


export default router;