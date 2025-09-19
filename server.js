import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPoolPromise } from './config/db.js';
import bcrypt from 'bcrypt';
import session from 'express-session';
import moment from 'moment-timezone';
import dayjs from "dayjs";
import { requireLogin } from './middleware/auth.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// สำหรับ __dirname ใน ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const app = express();
app.use(express.static(path.join(process.cwd(), "public")));

// Middleware สำหรับรับ JSON และ form
app.use(express.json()); // สำหรับ parse JSON
app.use(express.urlencoded({ extended: true })); // สำหรับ parse form data


// ตั้งค่า session - เพิ่มเวลา timeout
app.use(session({
  secret: 'Why_do_we_have_to_endure',
  resave: false,
  saveUninitialized: false, // เปลี่ยนเป็น false เพื่อความปลอดภัย
  cookie: {
    maxAge: 60 * 60 * 1000, // เพิ่มเป็น 1 ชั่วโมง (แทน 10 นาที)
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ตั้งค่า timezone
moment.tz.setDefault('Asia/Bangkok');
process.env.TZ = 'Asia/Bangkok';

// ตั้งค่า view engine → EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes ES Module แบบถูกต้อง
import adminRoutes from './route/admin/index.js';
import vetRoutes from './route/vet/index.js';
import userRoutes from './route/users/index.js';
import manageQueueRouter from './route/admin/manageQueue.js';
import petsRouter from './route/users/pets.js';
import bookingRoter from './route/users/booking.js';
import insertRoter from './route/users/insert_pet.js';
import registerRoter from './route/users/register.js';
import selectTimeRoter from './route/users/select_time.js';

import confirmRouter from './route/users/confirm.js';
import successRouter from './route/users/success.js';
app.use('/users/success', successRouter);
app.use('/users/confirm', confirmRouter);

import forgotPasswordRouter from './route/users/forgot-password.js';
app.use('/users/forgot-password', forgotPasswordRouter);
import resetPasswordRouter from './route/users/reset-password.js';
app.use('/users/reset-password', resetPasswordRouter);

import selectPetRouter from "./route/users/select_pet.js";
app.use("/users/select_pet", selectPetRouter);

import editPersonRouter from "./route/users/edit_person.js";
app.use("/users/edit_person", editPersonRouter);

import editPetRouter from "./route/users/edit_pet.js";
app.use("/users/edit_pet", editPetRouter);

import historyRouter from './route/users/history.js';
app.use('/users/history', historyRouter);
import queueRoutes from "./route/users/queue.js";
app.use("/users/queue", queueRoutes);


// Import routers
import petTypeRouter from "./route/admin/pet-type.js";
app.use("/admin/manage_pet_type", petTypeRouter);

import servicePetRouter from "./route/admin/service-pet.js";
app.use("/admin/manage_service_pet", servicePetRouter);
import treatmentHistoryRouter from "./route/admin/treatmentHistory.js";
app.use("/admin/treatment_history", treatmentHistoryRouter);

import medicationHistoryRouter from "./route/admin/medicationHistory.js";
app.use("/admin/medication_history", medicationHistoryRouter);

import confirmAMRouter from "./route/admin/confirmAM.js";
app.use("/admin/confirm_AM", confirmAMRouter);


import vet_treatmentHistoryRouter from "./route/vet/treatmentHistory.js";
import vet_medicationHistoryRouter from "./route/vet/medicationHistory.js";
app.use("/veterinarian/history_treatment", vet_treatmentHistoryRouter);
app.use("/veterinarian/history_medication", vet_medicationHistoryRouter);




import totalPayRouter from './route/admin/totalPayments.js'; 
import contactCusRouter from './route/admin/customerContact.js'; 
import addPetRouter from './route/admin/add_pet.js'; 

import petServiceRoutes from "./route/admin/petService.js";

// ✅ เส้นทาง admin
app.use("/admin/pet_service", petServiceRoutes);




import petOrderRoutes from './route/vet/pet_order.js';
import orderMedicationRoutes from "./route/vet/medication_order.js";
import manageHistoryRoutes from "./route/vet/manageHistory.js";
import medicationHistoryRoutes from "./route/vet/medicationHistory.js";
import manageMedicationRoutes from "./route/vet/manageMedication.js";
import reportRoutes from "./route/vet/report.js";
import workDayRoutes from "./route/vet/workDays.js";
import editHistoryRouter from "./route/vet/editHistory.js";

import managePermissionRouter from "./route/admin/managePermission.js";
app.use("/admin/mg_permission", managePermissionRouter);


// ...



// Mount routes - แก้ไขการ mount route
app.use('/admin', adminRoutes);
app.use('/vet', vetRoutes);
app.use('/users', userRoutes);
app.use('/admin/mg_queue', manageQueueRouter);
app.use('/users', petsRouter);
app.use('/users', bookingRoter);
app.use('/users', insertRoter);
app.use('/users', registerRoter);
app.use('/users', selectTimeRoter);


// เพิ่ม route สำหรับ pet service
app.use('/admin/total_pay', totalPayRouter);
app.use('/admin/contact_customer', contactCusRouter);
app.use('/admin/add_pet', addPetRouter);


app.use('/veterinarian/pet_order', petOrderRoutes);
app.use("/veterinarian/mg_history", manageHistoryRoutes);
app.use("/veterinarian/order_medication",orderMedicationRoutes);
app.use("/veterinarian/medication_history", medicationHistoryRoutes);
app.use("/veterinarian/manage_medication", manageMedicationRoutes);
app.use("/veterinarian/report", reportRoutes);
app.use("/veterinarian/work_days", workDayRoutes);
app.use("/veterinarian/edit_history", editHistoryRouter);




app.get("/users/verify-email", async (req, res) => {
  const { token } = req.query;
  const pool = getPoolPromise(); // ใช้ pool ปกติ

  try {
    const [rows] = await pool.query(
      "SELECT email FROM email_verification WHERE token = ?",
      [token]
    );

    if (rows.length === 0) {
      return res.render('users/verify', {
        success: false,
        message: "❌ ลิงก์ยืนยันไม่ถูกต้อง หรือหมดอายุแล้ว"
      });
    }

    const email = rows[0].email;

    // อัปเดตสถานะยืนยันในตาราง customer
    await pool.query(
      "UPDATE customer SET email_verified = 1 WHERE cus_email = ?",
      [email]
    );

    // ลบ token ทิ้ง
    await pool.query(
      "DELETE FROM email_verification WHERE token = ?",
      [token]
    );

    res.render('users/verify_success', {
  success: true,
  message: '✅ ยืนยันอีเมลสำเร็จแล้ว! ตอนนี้คุณสามารถเข้าสู่ระบบได้'
});
  } catch (err) {
    console.error("Verify error:", err);
    res.render('users/verify_success', {
  success: false,
  message: '❌ ลิงก์ยืนยันไม่ถูกต้อง หรือหมดอายุแล้ว'
});
  }
});


// หน้าแรก
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== LOGIN ROUTE ===== 
app.post('/login', async (req, res) => {
  try {
    const email = req.body?.access_email || '';
    const password = req.body?.access_pwd || '';
    
    console.log("=== [LOGIN REQUEST] ===");
    console.log("Email:", email);
    console.log("Password length:", password.length);

    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({ 
        success: false, 
        message: 'กรุณากรอก email และ password' 
      });
    }

    // เชื่อมต่อฐานข้อมูล
    const pool = getPoolPromise(email);
    // console.log("✅ Pool selected for:", email);

    // 1️⃣ ตรวจสอบ permission
    console.log("🔍 Checking permission table...");
    const [permissionResults] = await pool.query(
      'SELECT * FROM permission WHERE access_email = ?', 
      [email]
    );
    
    // console.log("📊 Permission results:", permissionResults);
    
    if (!permissionResults || permissionResults.length === 0) {
      console.log("❌ No user found in permission table");
      return res.status(401).json({ 
        success: false, 
        message: 'ไม่พบบัชชีผู้ใช้งาน' 
      });
    }

    const user = permissionResults[0];
    console.log("👤 User found:", {
      email: user.access_email,
      type: user.access_type,
      hasPassword: !!user.access_pwd
    });

    let hash = user.access_pwd;
    
    // แปลง $2y$ เป็น $2b$ สำหรับ bcrypt.js
    if (hash && hash.startsWith('$2y$')) {
      hash = hash.replace('$2y$', '$2b$');
      console.log("🔄 Converted $2y$ to $2b$");
    }

    // 2️⃣ ตรวจสอบรหัสผ่าน
    console.log("🔍 Comparing password...");
    const isMatch = await bcrypt.compare(password, hash);
    
    console.log("🎯 Password match result:", isMatch);
    
    if (!isMatch) {
      console.log("❌ Password mismatch");
      return res.status(401).json({ 
        success: false, 
        message: 'รหัสผ่านไม่ถูกต้อง' 
      });
    }

    // 3️⃣ สร้าง session
    req.session.user_email = user.access_email;
    req.session.access_type = user.access_type;

    console.log(`✅ Login successful for ${email}, type: ${user.access_type}`);

    // 4️⃣ แยก flow ตาม access_type
    let redirectUrl = '/';
    
    if (user.access_type === 'customer') {
      console.log("👥 Processing customer flow...");
      // หลังจากดึงข้อมูล customer
const [custResults] = await pool.query(
  'SELECT cus_name, cus_id, email_verified FROM customer WHERE cus_email = ?',
  [email]
);

if (!custResults || custResults.length === 0) {
  return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลลูกค้าในระบบ' });
}

const customer = custResults[0];

// ✅ เช็ค email_verified
if (customer.email_verified !== 1) {
  return res.status(403).json({
    success: false,
    message: '❌ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
    
  });
}

// ถ้า verified = 1 จึงสร้าง session
req.session.user_name = customer.cus_name;
req.session.cus_id = customer.cus_id;
redirectUrl = '/users/main';

    } else if (user.access_type === 'admin') {
      // console.log("👨‍💼 Processing admin flow...");
      
      try {
        const [adminResults] = await pool.query(
          'SELECT admin_id, admin_name FROM admin WHERE admin_email = ?', 
          [email]
        );
        
        if (adminResults && adminResults.length > 0) {
          console.log("📊 Admin results:", adminResults);
          req.session.user_name = adminResults[0].admin_name;
          req.session.admin_id = adminResults[0].admin_id;
        } else {
          console.log("⚠️ No admin data found, using email as name");
          req.session.user_name = email.split('@')[0];
          req.session.admin_id = null;
        }
      } catch (adminErr) {
        console.error('⚠️ Admin query error (using fallback):', adminErr);
        req.session.user_name = email.split('@')[0];
        req.session.admin_id = null;
      }
      
      redirectUrl = '/admin/mg_queue';
      
    }  else if (user.access_type === 'veterinarian') {
  console.log("👨‍⚕️ Processing veterinarian flow...");
  
  const [vetResults] = await pool.query(
    'SELECT vet_id, vet_name FROM veterinarian WHERE vet_email = ?', 
    [email]
  );
  
  console.log("📊 Veterinarian results:", vetResults);
  
  if (!vetResults || vetResults.length === 0) {
    console.log("❌ No veterinarian data found");
    return res.status(404).json({ 
      success: false, 
      message: 'ไม่พบข้อมูลสัตวแพทย์ในระบบ' 
    });
  }

  req.session.user_name = vetResults[0].vet_name;
  req.session.vet_id = vetResults[0].vet_id; // ⭐ สำคัญ: เก็บ vet_id ใน session
  redirectUrl = '/veterinarian/pet_order';
    } else {
      console.log("❌ Unknown access_type:", user.access_type);
      return res.status(400).json({ 
        success: false, 
        message: `access_type "${user.access_type}" ไม่รองรับ` 
      });
    }

    console.log("✅ Session created:", req.session);
    
    // ส่งกลับ JSON response แทน redirect ถ้าเป็น AJAX
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ 
        success: true, 
        message: 'เข้าสู่ระบบสำเร็จ',
        redirect: redirectUrl 
      });
    } else {
      return res.redirect(redirectUrl);
    }

  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในระบบ: ' + error.message 
    });
  }
});



//====================================================
// ===== OTHER ROUTES =====
//====================================================

app.get('/users/main', requireLogin, (req, res) => {
  if (req.session.access_type !== 'customer') {
    return res.redirect('/');
  }
  
  // console.log("🏠 Rendering users/main with session:", req.session);
  
  res.render('users/main', {
    cus_name: req.session.user_name,
    user_name: req.session.user_name,
    cus_id: req.session.cus_id,
    user_email: req.session.user_email,
    access_type: req.session.access_type
  });
});



app.post('/booking', requireLogin, async (req, res) => {
  try {
    if (req.session.access_type !== 'customer') {
      return res.redirect('/');
    }
    const { pet_id, cus_id } = req.body;
    console.log("📋 Booking request:", { pet_id, cus_id, session_cus_id: req.session.cus_id });
    if (!pet_id || !cus_id) {
      return res.redirect('/users/booking');
    }
    // ตรวจสอบว่า cus_id ตรงกับ session หรือไม่
    if (cus_id != req.session.cus_id) {
      return res.status(403).send('ไม่มีสิทธิ์เข้าถึง');
    }
    const pool = getPoolPromise(req.session.user_email);
    // ดึงข้อมูลสัตว์เลี้ยง
    const [petResults] = await pool.query(
      `SELECT p.pet_name, p.pet_gender, pt.type AS pet_type_name, p.img
       FROM pet p
       LEFT JOIN pet_type pt ON p.type_id = pt.type_id
       WHERE p.pet_id = ? AND p.cus_id = ?`,
      [pet_id, cus_id]
    );
    if (petResults.length === 0) {
      return res.send('ไม่พบข้อมูลสัตว์เลี้ยง');
    }

    // ดึงข้อมูลบริการ
    const [serviceResults] = await pool.query(`SELECT * FROM service_type ORDER BY service_name ASC`);

    res.render('users/booking', {
      pet_id,
      cus_id,
      pet: petResults[0],
      services: serviceResults,
      today: new Date().toISOString().slice(0, 10),
      cus_name: req.session.user_name
    });

  } catch (error) {
    console.error('❌ Booking page error:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดหน้าจอง');
  }
});

// หน้า HTML
// app.get('/admin/manage_service_pet', (req, res) => {
//   // ตรวจสอบสิทธิ์ admin
//   if (!req.session.user_email) return res.redirect('/login');

//   res.render('admin/manage_service_pet', {
//     user: req.session.user_email
//   });
// });


// =====================================================================================================================
//                   
//                                     veterinarian
// 
// =====================================================================================================================



// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Error destroying session:', err);
      return res.status(500).send('Logout failed');
    }

    // เคลียร์ cookie ด้วย
    res.clearCookie('connect.sid');

    // ไปที่หน้า public/index.html
    res.redirect('/index.html');
  });
});


// ===== API ROUTES =====
app.get('/api/available-slots', requireLogin, async (req, res) => {
  try {
    const { date, service_id } = req.query;
    const pool = getPoolPromise(req.session.user_email);

    if (!date || !service_id) {
      return res.status(400).json({ error: 'กรุณาระบุวันที่และบริการ' });
    }

    const [bookedTimes] = await pool.query(
      `SELECT time_booking FROM booking 
       WHERE booking_date = ? AND service_id = ?`,
      [date, service_id]
    );

    const allSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const availableSlots = allSlots.filter(time => 
      !bookedTimes.some(booked => booked.time_booking === time)
    );

    res.json({
      date,
      service_id,
      available_slots: availableSlots
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
});

// API: ตรวจสอบว่าวันไหนหมอคนไหนเปิดร้าน (สำหรับ users)
app.get('/api/vet-availability', async (req, res) => {
  try {
    const { date, vet_id } = req.query;
    const email = req.session?.user_email || 'default@example.com';
    const pool = getPoolPromise(email);
    
    if (!date) {
      return res.status(400).json({ error: 'กรุณาระบุวันที่' });
    }
    
    let query = 'SELECT vet_id, closed_date FROM vet_closed_days WHERE closed_date = ?';
    let params = [date];
    
    if (vet_id) {
      query += ' AND vet_id = ?';
      params.push(vet_id);
    }
    
    const [closedResults] = await pool.query(query, params);
    const closedVets = closedResults.map(row => row.vet_id);
    
    // ดึงรายชื่อหมอทั้งหมด
    const [allVets] = await pool.query('SELECT vet_id, vet_name FROM veterinarian');
    
    const availability = allVets.map(vet => ({
      vet_id: vet.vet_id,
      vet_name: vet.vet_name,
      is_available: !closedVets.includes(vet.vet_id)
    }));
    
    res.json({
      date,
      vets: availability,
      available_vets: availability.filter(v => v.is_available)
    });
    
  } catch (error) {
    console.error('Error checking vet availability:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบ' });
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});