import { Router } from 'express';
import { register, login, logout, getMe, createEmployee } from '../controllers/authController';
import { protect } from '../middleware/auth';
import upload from '../middleware/upload';

const router = Router();

router.post('/register', upload.single('photo'), register);
router.post('/create-employee', protect, createEmployee);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
