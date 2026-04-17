import { Router } from 'express';
import * as c from '../controllers/dailyReportController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/submit', c.submitReport);
router.put('/submit', c.upsertReport);
router.get('/today', c.getTodayReports);
router.get('/all-today', restrictTo('Admin'), c.getAllTodayReports);
router.get('/history', c.getHistory);
router.get('/stats', c.getStats);

export default router;
