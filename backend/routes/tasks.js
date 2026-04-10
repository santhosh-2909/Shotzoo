const router = require('express').Router();
const c = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

router.use(protect);

// IMPORTANT: specific routes BEFORE parameterized :id route
router.get('/today', c.getTodayTasks);
router.get('/stats', c.getTaskStats);
router.get('/upcoming', c.getUpcomingDeadlines);

router.route('/').get(c.getTasks).post(c.createTask);
router.route('/:id').get(c.getTask).put(c.updateTask).delete(c.deleteTask);
router.put('/:id/status', c.updateTaskStatus);

module.exports = router;
