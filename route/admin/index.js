// route/admin/index.js
import express from 'express';
import addPet from './add_pet.js';
import contactCustomer from './customerContact.js';
import manageQueue from './manageQueue.js';
import totalPayment from './totalPayments.js';

const router = express.Router();

router.get('/manageQueue', (req, res) => {
  res.send('นี่คือหน้า admin/manageQueue');
});
// Use routes
router.use('/pets', addPet);
router.use('/customers', contactCustomer);
router.use('/mg_queue', manageQueue);
router.use('/payments', totalPayment);

export default router;
