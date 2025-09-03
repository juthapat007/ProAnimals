// route/vet/index.js
import express from 'express';
const router = express.Router();

// import petOrder from './pet_order';
import report from './report.js';

// router.use('/orders', petOrder);
router.use('/reports', report);

export default router;