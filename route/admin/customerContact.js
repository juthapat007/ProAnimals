// app.js
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import path from "path";
import { getPool } from '../../config/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const db = getPool().promise();
        const [rows] = await db.query(
            'SELECT cus_id, cus_name, cus_email, cus_phon FROM customer ORDER BY cus_id ASC'
        );

        // ดึงค่าจาก query string เช่น /admin/contact_customer?edit_id=3
        const editId = req.query.edit_id || null;

        res.render('admin/contact_customer', {
            customers: rows,
            editId // 👈 ส่งไปให้ EJS ใช้
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});

router.get('/pet-list', async (req, res) => {
    const cusId = req.query.cus_id;
    if (!cusId) {
        return res.status(400).send("cus_id is required");
    }

    const db = getPool().promise();
    const [pets] = await db.query('SELECT * FROM pet WHERE cus_id = ?', [cusId]);
    res.render('admin/pet_list', { pets });
});


// เพิ่มลูกค้า
router.post('/add', async (req, res) => {
    const { name, email, phone } = req.body;
    try {
        const db = getPool();
        await db.query(
            'INSERT INTO customer (cus_name, cus_email, cus_phon, cus_password, cus_img) VALUES (?, ?, ?, ?, ?)',
            [name, email, phone, '', '']
        );
        res.redirect('/admin/contact_customer');
    } catch (err) {
        console.error(err);
        res.status(500).send('Add customer error');
    }
});

// ลบลูกค้า
router.get('/delete/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const db = getPool();
        await db.query('DELETE FROM customer WHERE cus_id = ?', [id]);
        res.redirect('/admin/contact_customer');
    } catch (err) {
        console.error(err);
        res.status(500).send('Delete error');
    }
});

// แก้ไขลูกค้า
router.post('/edit/:id', async (req, res) => {
    const id = req.params.id;
    const { name, email, phone } = req.body;
    try {
        const db = getPool();
        await db.query(
            'UPDATE customer SET cus_name = ?, cus_email = ?, cus_phon = ? WHERE cus_id = ?',
            [name, email, phone, id]
        );
        res.redirect('/admin/contact_customer');
    } catch (err) {
        console.error(err);
        res.status(500).send('Edit error');
    }
});
router.get("/search_customer", (req, res) => {
  const name = `%${req.query.name}%`;
  const db = getPool('wun@example.com');

  db.query(
    "SELECT cus_name, cus_id, cus_email, cus_phon FROM customer WHERE cus_name LIKE ? COLLATE utf8mb4_general_ci ",
    [name],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json([]);
      }
      res.json(results);
    }
  );
});

export default router;