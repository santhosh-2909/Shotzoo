const router = require('express').Router();
const c = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');
const Attendance = require('../models/Attendance');

router.use(protect);

router.post('/start-day', c.startDay);
router.post('/checkin', c.checkIn);
router.post('/checkout', c.checkOut);
router.post('/break', c.toggleBreak);
router.get('/today', c.getToday);
router.get('/history', c.getHistory);
router.get('/stats', c.getStats);

// Diagnostic endpoint - shows debug info
router.get('/debug', async (req, res) => {
  try {
    const userId = req.user._id;
    const allRecords = await Attendance.find({ user: userId }).sort({ date: -1 }).limit(10);
    const todayRecord = await Attendance.findOne({ 
      user: userId, 
      date: { 
        $gte: new Date(new Date().setHours(0,0,0,0)),
        $lte: new Date(new Date().setHours(23,59,59,999))
      }
    });
    
    res.json({
      success: true,
      userId: userId,
      totalRecords: allRecords.length,
      lastRecords: allRecords,
      todayRecord: todayRecord || null,
      message: 'If no records show and todayRecord is null, you need to click Start My Day in Attendance page'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
