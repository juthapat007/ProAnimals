import express from 'express';
import { getPoolPromise } from '../../config/db.js';
import dayjs from 'dayjs';

const router = express.Router();

// GET แสดงหน้ายืนยัน
router.get("/", (req, res) => {
  const { pet_id, cus_id, slot, vet_id, service_id, date } = req.query;
  res.render("admin/confirm_AM", { pet_id, cus_id, slot, vet_id, service_id, date });
});

// POST บันทึกลง DB
router.post('/', async (req, res) => {
    const { pet_id, cus_id, slot, service_id, date } = req.body;

    try {
        const pool = await getPoolPromise();

        // หา vet_id ที่ว่างในเวลานั้น
        const [vet] = await pool.query(
          `SELECT vet_id 
           FROM vet_work
           WHERE work_day = ?  BETWEEN start_time AND end_time
           LIMIT 1`,
          [date, slot]
        );

        if (!vet.length) {
            return res.json({ success: false, message: 'ไม่พบสัตวแพทย์ที่ว่างในเวลานี้' });
        }

        const vet_id = vet[0].vet_id;

        // เวลา end_time = slot + 1 ชั่วโมง (หรือปรับตามจริง)
        const end_time = dayjs(`1970-01-01T${slot}`).add(1, 'hour').format('HH:mm:ss');

        await pool.query(
            `INSERT INTO booking 
            (time_booking, end_time, service_id, cus_id, pet_id, vet_id, booking_date, status, customer_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'รอการรักษา', 'Walk-in')`,
            [slot, end_time, service_id, cus_id, pet_id, vet_id, date]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: err.message });
    }
});


export default router;
