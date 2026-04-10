const router = require('express').Router();
const c = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.get('/', c.getProfile);
router.put('/', upload.single('photo'), c.updateProfile);
router.put('/password', c.changePassword);
router.put('/preferences', c.updatePreferences);

// OTP-gated forgot-password reset flow on the profile page.
router.post('/password/reset/request', c.requestPasswordResetOtp);
router.post('/password/reset/confirm', c.resetPasswordWithOtp);

module.exports = router;
