import express from 'express';
import { getPool } from '../../config/db.js';
import { requireLogin } from '../../middleware/auth.js';
import dayjs from "dayjs";
const router = express.Router();

// Helper functions
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const addMinutesToTime = (timeStr, minutesToAdd) => {
  const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
  return minutesToTime(totalMinutes);
};

// Check if time ranges overlap
const isTimeOverlap = (start1, end1, start2, end2) => {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);
  
  return start1Min < end2Min && start2Min < end1Min;
};

// Convert TIME format (HH:MM:SS) to minutes
const serviceTimeToMinutes = (serviceTime) => {
  const [hours, minutes] = serviceTime.split(':').map(Number);
  return hours * 60 + minutes;
};

// Generate available time slots
const generateTimeSlots = (serviceDurationMinutes) => {
  const CLINIC_START = '09:00';
  const CLINIC_END = '18:00';
  const STEP_MINUTES = 60; // 1 hour steps
  
  const slots = [];
  const startMinutes = timeToMinutes(CLINIC_START);
  const endMinutes = timeToMinutes(CLINIC_END);
  
  for (let current = startMinutes; current + serviceDurationMinutes <= endMinutes; current += STEP_MINUTES) {
    slots.push(minutesToTime(current));
  }
  
  return slots;
};

// GET /users/select_time
router.get('/select_time', requireLogin, (req, res) => {
  const selectedDate = req.query.date || new Date().toISOString().slice(0, 10);
  const { service_id, cus_id, pet_id } = req.query;
  const pool = getPool(req.session.user_email);

  if (!service_id || !cus_id || !pet_id) {
    return res.status(400).send("ข้อมูลไม่ครบค่ะ");
  }

  if (!service_id || !cus_id || !pet_id) {
    return res.status(400).send("ข้อมูลไม่ครบค่ะ");
  }

  // Get service information including duration
  pool.query(
    `SELECT service_type, service_price, service_time 
     FROM service_type 
     WHERE service_id = ?`,
    [service_id],
    (err, serviceResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send("เกิดข้อผิดพลาดในฐานข้อมูลค่ะ");
      }

      if (serviceResults.length === 0) {
        return res.status(404).send("ไม่พบบริการที่เลือกค่ะ");
      }

      const service = serviceResults[0];
      const serviceDurationMinutes = serviceTimeToMinutes(service.service_time);

      // Get all bookings for the selected date
      pool.query(
        `SELECT b.time_booking, b.end_time, st.service_time
         FROM booking b
         JOIN service_type st ON b.service_id = st.service_id
         WHERE b.booking_date = ?`,
        [selectedDate],
        (err, bookingResults) => {
          if (err) {
            console.error(err);
            return res.status(500).send("เกิดข้อผิดพลาดในฐานข้อมูลค่ะ");
          }

          // Generate all possible time slots
          const allSlots = generateTimeSlots(serviceDurationMinutes);
          
          // Check availability for each slot
          const availableSlots = [];
          const bookedSlots = [];

          for (const slot of allSlots) {
            const slotEndTime = addMinutesToTime(slot, serviceDurationMinutes);
            let isAvailable = true;

            // Check against existing bookings
            for (const booking of bookingResults) {
              let bookingEndTime = booking.end_time;
              
              // If end_time is null, calculate it from service_time
              if (!bookingEndTime) {
                const bookingDuration = serviceTimeToMinutes(booking.service_time);
                bookingEndTime = addMinutesToTime(booking.time_booking, bookingDuration);
              }

              if (isTimeOverlap(slot, slotEndTime, booking.time_booking, bookingEndTime)) {
                isAvailable = false;
                break;
              }
            }

            if (isAvailable) {
              availableSlots.push(slot);
            } else {
              bookedSlots.push(slot);
            }
          }

          res.render("users/select_time", {
            date: selectedDate,
            service,
            serviceDurationMinutes,
            availableSlots,
            bookedSlots,
            allSlots,
            cus_id,
            pet_id,
            service_id,
            error: null
          });
        }
      );
    }
  );
});

// POST /users/select_time (for the confirm step)
router.post('/select_time', requireLogin, (req, res) => {
  const { pet_id, cus_id, service_id, booking_date, time_booking } = req.body;

  if (!pet_id || !cus_id || !service_id || !booking_date || !time_booking) {
    return res.status(400).send("ข้อมูลไม่ครบค่ะ");
  }

  const pool = getPool(req.session.user_email);

  // Get service duration
  pool.query(
    `SELECT service_time FROM service_type WHERE service_id = ?`,
    [service_id],
    (err, serviceResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send("เกิดข้อผิดพลาดในฐานข้อมูลค่ะ");
      }

      if (serviceResults.length === 0) {
        return res.status(404).send("ไม่พบบริการที่เลือกค่ะ");
      }

      const serviceDurationMinutes = serviceTimeToMinutes(serviceResults[0].service_time);
      const endTime = addMinutesToTime(time_booking, serviceDurationMinutes);

      // Double-check availability
      pool.query(
        `SELECT b.time_booking, b.end_time, st.service_time
         FROM booking b
         JOIN service_type st ON b.service_id = st.service_id
         WHERE b.booking_date = ?`,
        [booking_date],
        (err, existingBookings) => {
          if (err) {
            console.error(err);
            return res.status(500).send("เกิดข้อผิดพลาดในฐานข้อมูลค่ะ");
          }

          // Check for conflicts
          for (const booking of existingBookings) {
            let bookingEndTime = booking.end_time;
            
            if (!bookingEndTime) {
              const bookingDuration = serviceTimeToMinutes(booking.service_time);
              bookingEndTime = addMinutesToTime(booking.time_booking, bookingDuration);
            }

            if (isTimeOverlap(time_booking, endTime, booking.time_booking, bookingEndTime)) {
              return res.status(400).send(`ช่วงเวลา ${time_booking} - ${endTime} ของวันที่ ${booking_date} มีการจองซ้อนทับกัน กรุณาเลือกเวลาอื่นค่ะ`);
            }
          }

          // Insert new booking with end_time
          pool.query(
            `INSERT INTO booking (cus_id, pet_id, service_id, booking_date, time_booking, end_time) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [cus_id, pet_id, service_id, booking_date, time_booking, endTime],
            (err2, result) => {
              if (err2) {
                console.error(err2);
                return res.status(500).send("เกิดข้อผิดพลาดในการบันทึกข้อมูลค่ะ");
              }

              const booking_id = result.insertId;
              res.redirect(`/users/success?booking_id=${booking_id}`);
            }
          );
        }
      );
    }
  );
});

export default router;