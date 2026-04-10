const router = require('express').Router();
const c = require('../controllers/dailyReportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/submit', c.submitReport);
router.put('/submit', c.upsertReport);
router.get('/today', c.getTodayReports);
router.get('/all-today', c.getAllTodayReports);
router.get('/history', c.getHistory);
router.get('/stats', c.getStats);

module.exports = router;
