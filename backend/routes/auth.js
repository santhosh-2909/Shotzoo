const router = require('express').Router();
const { register, login, logout, getMe, createEmployee } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', upload.single('photo'), register);
router.post('/create-employee', protect, createEmployee);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;
