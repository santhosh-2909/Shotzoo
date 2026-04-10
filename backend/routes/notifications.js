const router = require('express').Router();
const c = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', c.getNotifications);
// Specific routes before parameterized
router.put('/read-all', c.markAllAsRead);
router.put('/:id/read', c.markAsRead);
router.delete('/:id', c.dismissNotification);

module.exports = router;
