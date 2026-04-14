import { Router } from 'express';
import * as c from '../controllers/taskController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

// IMPORTANT: specific routes BEFORE parameterized :id route
router.get('/today', c.getTodayTasks);
router.get('/stats', c.getTaskStats);
router.get('/upcoming', c.getUpcomingDeadlines);

router.route('/').get(c.getTasks).post(c.createTask);
router.route('/:id').get(c.getTask).put(c.updateTask).delete(c.deleteTask);
router.put('/:id/status', c.updateTaskStatus);

export default router;
