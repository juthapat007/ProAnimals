// route/users/index.js
import express from 'express';
const router = express.Router();

// Import all user routes
import registerRoutes from './register.js';
import mainRoutes from './main.js';
import bookingRoutes from './booking.js';
import selectTimeRoutes from './select_time.js';
import confirmRoutes from './confirm.js';
import petsRoutes from './pets.js';
import profileRoutes from './profile.js';
import queueRoutes from './queue.js';

// Use routes with appropriate prefixes
router.use('/register', registerRoutes);
router.use('/main', mainRoutes);
router.use('/booking', bookingRoutes);
router.use('/select-time', selectTimeRoutes);
router.use('/confirm', confirmRoutes);
router.use('/pets', petsRoutes);
router.use('/profile', profileRoutes);
router.use('/queue', queueRoutes);

export default router;
