import { Router } from 'express';
import * as c from '../controllers/notificationController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', c.getNotifications);
// Specific routes before parameterized
router.put('/read-all', c.markAllAsRead);
router.put('/:id/read', c.markAsRead);
router.delete('/:id', c.dismissNotification);

export default router;
