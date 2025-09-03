import express from 'express';

import { getPool } from ('../../config/db.js');

const router = express.Router();
router.get('/', async (req, res) => {
  if (!req.session.user_email) {
    return res.redirect('/login');
  }

  try {
    const pool = getPool(req.session.user_email);
    
    // ดึงข้อมูลลูกค้า
    const [customerRows] = await pool.promise().query(
      "SELECT cus_id FROM customer WHERE cus_email = ?",
      [req.session.user_email]
    );
    
    if (customerRows.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลลูกค้า");
    }
    
    const cus_id = customerRows[0].cus_id;

    // ดึงข้อมูลสัตว์เลี้ยงของลูกค้า
    const [petsRows] = await pool.promise().query(
      "SELECT pet_id, pet_name FROM pet WHERE cus_id = ?",
      [cus_id]
    );

    const pet_ids = petsRows.map(pet => pet.pet_id);

    // ดึงประวัติการรักษา
    let history = [];
    if (pet_ids.length > 0) {
      const placeholders = pet_ids.map(() => '?').join(',');
      
      const [historyRows] = await pool.promise().query(`
        SELECT th.*, p.pet_name, s.service_type, v.vet_name 
        FROM treatment_history th
        JOIN pet p ON th.pet_id = p.pet_id
        JOIN service_type s ON th.service_id = s.service_id
        JOIN veterinarian v ON th.vet_id = v.vet_id
        WHERE th.pet_id IN (${placeholders})
        ORDER BY th.treatment_date DESC
      `, pet_ids);
      
      history = historyRows;
    }

    // กรองข้อมูลตาม pet_id ที่เลือก (ถ้ามี)
    let filtered_history = history;
    if (req.query.pet_id) {
      const filter_pet_id = parseInt(req.query.pet_id);
      filtered_history = history.filter(item => item.pet_id === filter_pet_id);
    }

    res.render('history', {
      pets: petsRows,
      history: filtered_history,
      cus_id: cus_id,
      user_name: req.session.user_name
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการรักษา");
  }
});

export default router;