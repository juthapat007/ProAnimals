// customerContact.js
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import path from "path";
import { getPool } from '../../config/db.js';

const router = express.Router();

// เพิ่ม middleware สำหรับ debug
router.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

router.get('/', async (req, res) => {
    try {
        const db = getPool().promise();
        const [rows] = await db.query(
            'SELECT cus_id, cus_name, cus_email, cus_phon FROM customer ORDER BY cus_id ASC'
        );

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

    try {
        const db = getPool().promise();
        const [pets] = await db.query('SELECT * FROM pet WHERE cus_id = ?', [cusId]);
        res.render('admin/pet_list', { pets });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});

router.post('/add', async (req, res) => {
    const { name, email, phone } = req.body;
    try {
        const db = getPool().promise();
        await db.query(
            'INSERT INTO customer (cus_name, cus_email, cus_phon, cus_password, cus_img) VALUES (?, ?, ?, ?, ?)',
            [name, email || '', phone, '', '']
        );
        res.json({ success: true, message: "เพิ่มลูกค้าเรียบร้อย" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Add customer error' });
    }
});


// ลบลูกค้า
router.get('/delete/:id', async (req, res) => {
    const id = req.params.id;
    
    if (!id) {
        return res.status(400).json({ error: 'ไม่พบ ID ลูกค้า' });
    }

    try {
        const db = getPool().promise();
        
        // ตรวจสอบว่ามีลูกค้านี้หรือไม่
        const [customer] = await db.query(
            'SELECT cus_id FROM customer WHERE cus_id = ?',
            [id]
        );
        
        if (customer.length === 0) {
            return res.status(404).json({ error: 'ไม่พบลูกค้าที่ต้องการลบ' });
        }

        // ตรวจสอบว่ามีสัตว์เลี้ยงหรือข้อมูลอื่นที่เกี่ยวข้องหรือไม่
        const [pets] = await db.query('SELECT COUNT(*) as count FROM pet WHERE cus_id = ?', [id]);
        
        if (pets[0].count > 0) {
            return res.status(400).json({ 
                error: `ไม่สามารถลบลูกค้าได้ เนื่องจากมีสัตว์เลี้ยง ${pets[0].count} ตัว ที่เกี่ยวข้อง` 
            });
        }

        await db.query('DELETE FROM customer WHERE cus_id = ?', [id]);
        res.status(200).json({ success: true, message: 'ลบลูกค้าเรียบร้อย' });
    } catch (err) {
        console.error('Delete customer error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบลูกค้า' });
    }
});

// แก้ไขลูกค้า
router.post('/edit/:id', async (req, res) => {
    const id = req.params.id;
    const { name, email, phone } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'ไม่พบ ID ลูกค้า' });
    }
    
    if (!name || !phone) {
        return res.status(400).json({ error: 'ชื่อและเบอร์โทรเป็นข้อมูลที่จำเป็น' });
    }

    try {
        const db = getPool().promise();
        
        // ตรวจสอบว่ามีลูกค้านี้หรือไม่
        const [customer] = await db.query(
            'SELECT cus_id FROM customer WHERE cus_id = ?',
            [id]
        );
        
        if (customer.length === 0) {
            return res.status(404).json({ error: 'ไม่พบลูกค้าที่ต้องการแก้ไข' });
        }
        
        // ตรวจสอบเบอร์โทรซ้ำ (ยกเว้นลูกค้าคนนี้)
        const [existing] = await db.query(
            'SELECT cus_id FROM customer WHERE cus_phon = ? AND cus_id != ?',
            [phone, id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'เบอร์โทรนี้มีอยู่ในระบบแล้ว' });
        }

        const [result] = await db.query(
            'UPDATE customer SET cus_name = ?, cus_email = ?, cus_phon = ? WHERE cus_id = ?',
            [name, email, phone, id]
        );
        
        console.log('Update result:', result); // Debug log
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'ไม่พบลูกค้าที่ต้องการแก้ไข' });
        }
        
        res.status(200).json({ success: true, message: 'แก้ไขข้อมูลลูกค้าเรียบร้อย' });
    } catch (err) {
        console.error('Edit customer error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
    }
});

// ค้นหาลูกค้า
router.get("/search_customer", async (req, res) => {
    const searchName = req.query.name;
    
    if (!searchName || searchName.trim().length < 2) {
        return res.json([]);
    }

    try {
        const db = getPool().promise();
        const name = `%${searchName.trim()}%`;
        
        const [results] = await db.query(
            "SELECT cus_name, cus_id, cus_email, cus_phon FROM customer WHERE cus_name LIKE ? COLLATE utf8mb4_general_ci ORDER BY cus_name ASC LIMIT 10",
            [name]
        );
        
        res.json(results);
    } catch (err) {
        console.error("Search customer error:", err);
        res.status(500).json([]);
    }
});

// API สำหรับดึงข้อมูลลูกค้า
router.get('/api/customer/:id', async (req, res) => {
    const id = req.params.id;
    
    try {
        const db = getPool().promise();
        const [customer] = await db.query(
            'SELECT cus_id, cus_name, cus_email, cus_phon FROM customer WHERE cus_id = ?',
            [id]
        );
        
        if (customer.length === 0) {
            return res.status(404).json({ error: 'ไม่พบลูกค้า' });
        }
        
        res.json(customer[0]);
    } catch (err) {
        console.error('Get customer error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

export default router;