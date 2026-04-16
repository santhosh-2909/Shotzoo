import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  createEmployee,
  createAdmin,
  checkSetup,
  setupAdmin,
} from '../controllers/authController';
import { protect, restrictTo } from '../middleware/auth';
import upload from '../middleware/upload';

const router = Router();

// First-run setup — public, gated server-side by "zero admins exist"
router.get('/check-setup', checkSetup);
router.post('/setup',      setupAdmin);

router.post('/register',        upload.single('photo'), register);
router.post('/create-employee', protect, createEmployee);
router.post('/create-admin',    protect, restrictTo('Admin'), createAdmin);
router.post('/login',           login);
router.post('/logout',          logout);
router.get('/me',               protect, getMe);

export default router;
