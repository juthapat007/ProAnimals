import express from 'express';
import { requireLogin } from '../../middleware/auth.js';

const router = express.Router();
// GET /users/main
router.get('/main', requireLogin, (req, res) => {
  res.render('users/main', {
    cus_name: req.session.user_name,
    cus_email: req.session.user_email,
    cus_id: req.session.cus_id
  });
});

export default router;