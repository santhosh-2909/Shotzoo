import { Router } from 'express';
import * as c from '../controllers/profileController';
import { protect } from '../middleware/auth';
import upload from '../middleware/upload';

const router = Router();

router.use(protect);

router.get('/', c.getProfile);
router.put('/', upload.single('photo'), c.updateProfile);
router.put('/password', c.changePassword);
router.put('/preferences', c.updatePreferences);

// OTP-gated forgot-password reset flow on the profile page.
router.post('/password/reset/request', c.requestPasswordResetOtp);
router.post('/password/reset/confirm', c.resetPasswordWithOtp);

export default router;
