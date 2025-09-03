import express from 'express';
import { getPoolPromise } from "../../config/db.js";
import { requireLogin } from "../../middleware/auth.js";

const router = express.Router();

// GET /history - Display treatment history for logged-in customer
router.get('/', requireLogin, async (req, res) => {
  let connection;
  
  try {
    const pool = await getPoolPromise();
    connection = await pool.getConnection();
    
    const customerId = req.session.cus_id;
    
    // Query to get treatment history for the logged-in customer
    const historyQuery = `
      SELECT 
        th.treatment_id,
        th.treatment_date,
        th.treatment_details,
        th.pet_weight_kg,
        p.pet_name,
        st.service_type,
        v.vet_name,
        b.status as treatment_status,
        b.customer_type as cus_type,
        b.booking_date,
        b.time_booking
      FROM treatment_history th
      JOIN booking b ON th.booking_id = b.booking_id
      JOIN pet p ON b.pet_id = p.pet_id
      JOIN service_type st ON b.service_id = st.service_id
      JOIN veterinarian v ON th.vet_id = v.vet_id
      WHERE b.cus_id = ?
      ORDER BY th.treatment_date DESC, th.treatment_id DESC
    `;
    
    const [historyRows] = await connection.execute(historyQuery, [customerId]);
    
    // Transform data to match the EJS template expectations
    const history = historyRows.map(row => ({
      treatment_id: row.treatment_id,
      pet_name: row.pet_name,
      service_type: row.service_type,
      vet_name: row.vet_name,
      pet_weight_kg: row.pet_weight_kg,
      treatment_date: row.treatment_date,
      treatment_details: row.treatment_details || 'ไม่มีรายละเอียด',
      treatment_status: mapStatusToText(row.treatment_status),
      cus_type: row.cus_type,
      booking_date: row.booking_date,
      time_booking: row.time_booking
    }));
    
    // Get customer info for display
    const customerQuery = 'SELECT cus_name FROM customer WHERE cus_id = ?';
    const [customerRows] = await connection.execute(customerQuery, [customerId]);
    const customerName = customerRows.length > 0 ? customerRows[0].cus_name : 'ผู้ใช้';
    
    res.render('users/history', {
      title: 'ประวัติการรักษา',
      history: history,
      customerName: customerName,
      session: req.session
    });
    
  } catch (error) {
    console.error('Error fetching treatment history:', error);
    res.status(500).render('error', {
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการรักษา',
      error: error
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET /history/details/:treatmentId - Get detailed treatment information
router.get('/details/:treatmentId', requireLogin, async (req, res) => {
  let connection;
  
  try {
    const pool = await getPoolPromise();
    connection = await pool.getConnection();
    
    const treatmentId = req.params.treatmentId;
    const customerId = req.session.cus_id;
    
    // Query to get detailed treatment information
    const detailQuery = `
      SELECT 
        th.treatment_id,
        th.treatment_date,
        th.treatment_details,
        th.pet_weight_kg,
        p.pet_name,
        p.pet_gender,
        pt.type as pet_type,
        st.service_type,
        st.service_price,
        v.vet_name,
        v.vet_phon,
        b.status as treatment_status,
        b.customer_type as cus_type,
        b.booking_date,
        b.time_booking,
        c.cus_name,
        c.cus_phon
      FROM treatment_history th
      JOIN booking b ON th.booking_id = b.booking_id
      JOIN pet p ON b.pet_id = p.pet_id
      JOIN pet_type pt ON p.type_id = pt.type_id
      JOIN service_type st ON b.service_id = st.service_id
      JOIN veterinarian v ON th.vet_id = v.vet_id
      JOIN customer c ON b.cus_id = c.cus_id
      WHERE th.treatment_id = ? AND b.cus_id = ?
    `;
    
    const [detailRows] = await connection.execute(detailQuery, [treatmentId, customerId]);
    
    if (detailRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลการรักษานี้'
      });
    }
    
    // Get medications used in this treatment
    const medicationQuery = `
      SELECT 
        m.medicine_name,
        d.quantity,
        m.medicine_price,
        m.medicine_package
      FROM dispens d
      JOIN medication m ON d.medication_id = m.medication_id
      WHERE d.treatment_id = ?
    `;
    
    const [medicationRows] = await connection.execute(medicationQuery, [treatmentId]);
    
    const treatmentDetail = {
      ...detailRows[0],
      medications: medicationRows,
      treatment_status_text: mapStatusToText(detailRows[0].treatment_status)
    };
    
    res.json({
      success: true,
      data: treatmentDetail
    });
    
  } catch (error) {
    console.error('Error fetching treatment details:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดการรักษา'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET /history/filter - Filter treatment history
router.get('/filter', requireLogin, async (req, res) => {
  let connection;
  
  try {
    const pool = await getPoolPromise();
    connection = await pool.getConnection();
    
    const customerId = req.session.cus_id;
    const { startDate, endDate, petId, serviceId, status } = req.query;
    
    let whereConditions = ['b.cus_id = ?'];
    let queryParams = [customerId];
    
    // Add date range filter
    if (startDate) {
      whereConditions.push('th.treatment_date >= ?');
      queryParams.push(startDate);
    }
    
    if (endDate) {
      whereConditions.push('th.treatment_date <= ?');
      queryParams.push(endDate);
    }
    
    // Add pet filter
    if (petId && petId !== 'all') {
      whereConditions.push('p.pet_id = ?');
      queryParams.push(parseInt(petId));
    }
    
    // Add service filter
    if (serviceId && serviceId !== 'all') {
      whereConditions.push('st.service_id = ?');
      queryParams.push(parseInt(serviceId));
    }
    
    // Add status filter
    if (status && status !== 'all') {
      whereConditions.push('b.status = ?');
      queryParams.push(status);
    }
    
    const filterQuery = `
      SELECT 
        th.treatment_id,
        th.treatment_date,
        th.treatment_details,
        th.pet_weight_kg,
        p.pet_name,
        st.service_type,
        v.vet_name,
        b.status as treatment_status,
        b.customer_type as cus_type
      FROM treatment_history th
      JOIN booking b ON th.booking_id = b.booking_id
      JOIN pet p ON b.pet_id = p.pet_id
      JOIN service_type st ON b.service_id = st.service_id
      JOIN veterinarian v ON th.vet_id = v.vet_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY th.treatment_date DESC, th.treatment_id DESC
    `;
    
    const [historyRows] = await connection.execute(filterQuery, queryParams);
    
    const history = historyRows.map(row => ({
      ...row,
      treatment_status: mapStatusToText(row.treatment_status)
    }));
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('Error filtering treatment history:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการกรองข้อมูล'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Helper function to map status to Thai text
function mapStatusToText(status) {
  const statusMap = {
    'รอการรักษา': 'รอการรักษา',
    'กำลังรักษา': 'กำลังรักษา', 
    'เสร็จสิ้น': 'Completed',
    'ล้มเหลว': 'ล้มเหลว'
  };
  
  return statusMap[status] || status;
}

export default router;