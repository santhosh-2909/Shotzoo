# ShotZoo Update Summary - Employee Type & Auto Employee ID

## 📋 Overview
This update replaces the "Company" field with "Employment Type" (Work From Office/Home) and implements automatic Employee ID generation with email delivery.

---

## ✅ Changes Implemented

### Frontend Changes (Sign_up.html)

#### Form Field Updates:
| Before | After |
|--------|-------|
| Placeholder: "John Doe" | "enter name" |
| Placeholder: "john@shotzoo.io" | "enter email" |
| Placeholder: "+1 (555) 000-0000" | "enter contact" |
| **Company field with options** | **Type field with options** |

#### New "Type" Field:
- **Label**: TYPE
- **Field Name**: `employeeType`
- **Options**:
  - Select Type (default/disabled)
  - Work From Office
  - Work From Home

---

### Backend Changes

#### 1. New File: `backend/utils/emailService.js`
- **Purpose**: Handles email sending for Employee IDs
- **Features**:
  - Sends beautifully formatted HTML emails
  - Uses Nodemailer library
  - Supports Gmail, Outlook, and custom SMTP servers
  - Error handling and logging

#### 2. Updated: `backend/controllers/authController.js`
**Changes:**
- Removed `company` parameter from registration
- Added `employeeType` parameter handling
- Integrated email sending after user creation
- Updated user response to return `employeeType` instead of `company`
- Employee ID is automatically generated and emailed within 2 minutes

**Registration Flow:**
1. Validate input (name, email, password)
2. Create user with generated Employee ID
3. Trigger email send (asynchronously)
4. Return user data and authentication token

#### 3. Updated: `backend/models/User.js`
**Schema Changes:**
```
Before: employeeType: { enum: ['Online', 'Offline'], default: 'Online' }
After:  employeeType: { enum: ['Office', 'Home'], default: 'Office' }
```

#### 4. Updated: `backend/package.json`
**New Dependency:**
```json
"nodemailer": "^6.9.7"
```

#### 5. Updated: `backend/.env`
**New Configuration Variables:**
```
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here
```

---

## 🚀 How to Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Email (Gmail Example)
1. Enable 2-Factor Authentication on Gmail
2. Generate App Password at myaccount.google.com → Security → App passwords
3. Update `.env`:
```
EMAIL_SERVICE=gmail
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

### 3. Start Backend Server
```bash
npm start        # Production
npm run dev      # Development with auto-reload
```

---

## 📧 Employee ID Email

### What Users Receive:
- Welcome message with their name
- Auto-generated Employee ID (format: `SZ-YYYY-XXX`)
- Instructions on how to use Employee ID to login
- Support information

### Email Delivery:
- **Timing**: Within 2 minutes of account creation
- **Method**: Nodemailer with configured email service
- **Delivery**: Asynchronous (doesn't block account creation)

### Login Options (Both Valid):
1. Email + Password
2. Employee ID + Password

---

## 🔄 User Journey

### Registration:
1. User fills form with name, email, phone, employment type, password
2. Account created with auto-generated Employee ID
3. Email sent with Employee ID notification

### First Login:
- Can use email or Employee ID (with password)
- Full access to dashboard and features

---

## 📝 Files Modified Summary

| File | Changes |
|------|---------|
| frontend/Sign_up.html | Updated form fields and placeholders |
| backend/controllers/authController.js | Added email sending, updated registration flow |
| backend/models/User.js | Updated employeeType enum values |
| backend/package.json | Added nodemailer dependency |
| backend/.env | Added email configuration |
| **NEW** backend/utils/emailService.js | Email sending utility |
| **NEW** backend/EMAIL_SETUP_GUIDE.md | Detailed setup documentation |

---

## 🔐 Security Considerations

✅ **Implemented:**
- Automatic Employee ID generation (prevents duplicates)
- Secure password handling (bcrypt)
- JWT authentication unchanged
- Email stored securely in .env (not in code)

⚠️ **Recommendations for Production:**
- Use environment-specific email credentials
- Implement email verification before full access
- Use dedicated email service (AWS SES, SendGrid, Mailgun)
- Never commit .env files to version control
- Implement rate limiting on registration endpoint
- Add CAPTCHA to prevent automated registrations

---

## 🆘 Troubleshooting

### Email Not Sending?
1. **Check .env file** - Verify credentials are correct
2. **Check Gmail** - For Gmail, must use App Password + 2FA enabled
3. **Check Logs** - Server console will show error details
4. **Check Network** - Ensure port 587 is not blocked

### User Not Receiving Email?
1. Check spam/junk folder
2. Verify email address entered correctly
3. Check server logs for errors
4. Try sending test email manually

### Other Issues?
- See detailed troubleshooting in `backend/EMAIL_SETUP_GUIDE.md`

---

## 📚 Documentation

- Detailed setup: [EMAIL_SETUP_GUIDE.md](./backend/EMAIL_SETUP_GUIDE.md)
- Email service code: [emailService.js](./backend/utils/emailService.js)
- API documentation: Check existing API docs

---

## ✨ Future Enhancements

Potential additions:
- Email verification before account activation
- Resend Employee ID option in dashboard
- Bulk employee import with auto ID assignment
- Custom email templates per organization
- Email delivery tracking
- SMS backup for Employee ID delivery

---

## ℹ️ Support & Questions

For implementation or deployment questions:
1. Check EMAIL_SETUP_GUIDE.md
2. Review error logs in server console
3. Verify .env configuration
4. Test with manual email sending

---

**Last Updated**: April 8, 2026
**Version**: 2.0.0 (Employee ID & Type Field Update)
