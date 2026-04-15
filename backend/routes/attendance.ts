import { Router } from 'express';
import * as c from '../controllers/attendanceController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/start-day', c.startDay);
router.post('/checkin',   c.checkIn);
router.post('/checkout',  c.checkOut);
router.post('/break',     c.toggleBreak);
router.get('/today',      c.getTodayAttendance);
router.get('/history',    c.getHistory);
router.get('/stats',      c.getStats);

export default router;
