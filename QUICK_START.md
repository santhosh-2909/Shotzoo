# 🚀 Quick Start: Employee ID Email Feature

## What Was Changed?
✅ Company field → Employment Type (Office/Home)
✅ Auto-generated Employee IDs sent via email
✅ Users can now login with Email or Employee ID

---

## Next Steps (5 minutes)

### Step 1: Install Dependencies
```bash
cd backend
npm install
```
This installs `nodemailer` (email library) with other packages.

### Step 2: Configure Email
Edit `backend/.env` and add your email credentials:

**For Gmail:**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

**To get Gmail App Password:**
1. Go to myaccount.google.com
2. Security → App passwords
3. Select Mail & Windows Computer
4. Copy the 16-character password (paste in EMAIL_PASSWORD above)

### Step 3: Restart Backend
```bash
npm start
```

### Step 4: Test
1. Open `http://localhost:3000/Sign_up.html`
2. Fill the form with test data
3. Select "Work From Office" or "Work From Home" for Type
4. Submit
5. Check your email for Employee ID (should arrive in seconds)

---

## How It Works

```
User Registration
    ↓
Create Account with Auto Employee ID
    ↓
Send Email with Employee ID (async)
    ↓
Return Success Response
    ↓
User Receives: Email with ID like "SZ-2026-001"
    ↓
User Can Login With: Email OR Employee ID
```

---

## Employee ID Format
- **Format**: `SZ-YYYY-###`
- **Example**: `SZ-2026-001`, `SZ-2026-002`
- **Generated**: Automatically on account creation
- **Sent**: Via email within 2 minutes

---

## What Users See in Email
```
┌─────────────────────────────────┐
│      Welcome to ShotZoo!        │
│                                 │
│ Your Employee ID:               │
│    ┌─────────────────────────┐  │
│    │    SZ-2026-001          │  │
│    └─────────────────────────┘  │
│                                 │
│ Use this or your email to login │
└─────────────────────────────────┘
```

---

## Login Now Works Two Ways

### Before: Email + Password only
```
Login with:
- Email: john@example.com
- Password: ••••••••
```

### Now: Email OR Employee ID + Password
```
Option 1 (Email):
- Email: john@example.com
- Password: ••••••••

Option 2 (Employee ID):
- Employee ID: SZ-2026-001
- Password: ••••••••
```

---

## Files to Know About

| File | Purpose |
|------|---------|
| `frontend/Sign_up.html` | Registration form |
| `backend/.env` | Email configuration (SECRET!) |
| `backend/utils/emailService.js` | Email sending code |
| `backend/controllers/authController.js` | Registration logic |
| `EMAIL_SETUP_GUIDE.md` | Detailed setup docs |
| `CHANGES_SUMMARY.md` | Complete change log |

---

## Troubleshooting

### ❌ Email not sending?
1. Check .env has correct credentials
2. For Gmail: Verify App Password (not regular password)
3. Check server console for errors
4. Try different email service if available

### ❌ Form won't submit?
1. Fill ALL required fields
2. Passwords must match
3. Email must be valid format
4. Check browser console for errors

### ❌ Can't login with Employee ID?
1. Make sure you have the correct Employee ID from email
2. Check spelling (format: SZ-2026-001)
3. Try Email login as backup
4. Check server is running

---

## Did It Work? ✅

You'll know it's working when:
1. ✅ Registration form shows "Type" instead of "Company"
2. ✅ Form accepts "Work From Office" and "Work From Home" as options
3. ✅ Account creates successfully
4. ✅ Email arrives with Employee ID
5. ✅ Can login with both Email and Employee ID

---

## Common Questions

**Q: Why do I need 2FA on Gmail?**
A: Google requires it for App Passwords (safer than storing actual password)

**Q: Can I use other email services?**
A: Yes! See EMAIL_SETUP_GUIDE.md for Outlook, custom SMTP, etc.

**Q: Why "Work From Office/Home" instead of "Company"?**
A: Better reflects actual work arrangement, simpler data model

**Q: How long until email arrives?**
A: Usually within seconds (configured to send within 2 minutes max)

**Q: What if email doesn't arrive?**
A: Check EMAIL_SETUP_GUIDE.md troubleshooting section

---

## Support

**Still stuck?**
1. Read EMAIL_SETUP_GUIDE.md (most answers there)
2. Check server console for error messages
3. Verify all .env variables are set correctly
4. Test with a simple email service first

---

**Last Updated**: April 8, 2026
**Version**: 2.0.0
