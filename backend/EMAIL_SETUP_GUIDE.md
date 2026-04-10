# ShotZoo Employee ID - Email Setup Guide

## Overview
The system now automatically generates and sends Employee IDs to new users via email when they register.

## Changes Made

### 1. Frontend Changes (Sign_up.html)
- **Removed**: Company field selector
- **Added**: Type field with two options:
  - "Work From Office"
  - "Work From Home"
- **Updated Field Name**: Changed from `company` to `employeeType`
- **Updated Placeholders**: 
  - Full Name: "enter name"
  - Email: "enter email"
  - Contact: "enter contact"

### 2. Backend Changes

#### New Files Created:
- `backend/utils/emailService.js` - Email sending utility

#### Files Modified:
- `backend/package.json` - Added `nodemailer` dependency
- `backend/controllers/authController.js` - Updated to handle `employeeType` and send employee ID emails
- `backend/models/User.js` - Updated `employeeType` enum from `['Online', 'Offline']` to `['Office', 'Home']`
- `backend/.env` - Added email configuration variables

## Email Configuration

### Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account:
   - Go to myaccount.google.com
   - Security settings
   - Enable 2-step verification

2. **Generate App Password**:
   - Go to myaccount.google.com → Security → App passwords
   - Select "Mail" and "Windows Computer"
   - Generate and copy the 16-character password

3. **Update .env file**:
```
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

### Other Email Services

**Outlook:**
```
EMAIL_SERVICE=outlook
EMAIL_USER=your_email@outlook.com
EMAIL_PASSWORD=your_password
```

**Custom SMTP:**
Edit `backend/utils/emailService.js` to configure custom SMTP settings:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

## Installation

1. **Install Dependencies**:
```bash
cd backend
npm install
```

This will install `nodemailer` along with other dependencies.

2. **Setup Environment Variables**:
Create/update `.env` file in the `backend` directory with your email credentials.

3. **Start the Server**:
```bash
npm start
# or for development
npm run dev
```

## Employee ID Generation & Delivery

### How It Works:
1. User registers with account details
2. User account is created with auto-generated Employee ID (format: `SZ-YYYY-XXX`)
   - Example: `SZ-2026-001`, `SZ-2026-002`, etc.
3. Email is sent to the user's registered email address within seconds (configured to send within 2 minutes)
4. Email contains:
   - Welcome message
   - Employee ID (highlighted)
   - Instructions on how to use Employee ID for login
   - Support contact information

### Login Methods:
Users can now login using either:
- Email + Password
- Employee ID + Password

## Troubleshooting

### Email Not Sending?

1. **Check .env configuration**:
   - Verify EMAIL_USER and EMAIL_PASSWORD are correct
   - For Gmail, ensure you're using an App Password (not your regular password)
   - Ensure EMAIL_SERVICE is set to 'gmail' or appropriate service

2. **Check Server Logs**:
   - Look for error messages in the console where backend is running
   - Common issues: Authentication failure, SMTP connection errors

3. **Gmail Specific**:
   - Verify 2-Factor Authentication is enabled
   - Confirm App Password is correct (remove spaces if any)
   - Check "Less secure app access" if needed (not recommended for production)

4. **Network/Firewall**:
   - Ensure port 587 (or configured port) is not blocked
   - Check proxy settings if behind corporate firewall

### Test Email Sending:

You can manually test by running this in Node.js console:
```javascript
const { sendEmployeeIdEmail } = require('./utils/emailService');
sendEmployeeIdEmail('test@example.com', 'Test User', 'SZ-2026-001');
```

## Security Notes

- **Never commit .env files** to version control
- Use environment-specific credentials for each environment (dev, staging, production)
- Consider using services like AWS SES, SendGrid, or Mailgun for production
- Implement rate limiting on registration endpoint
- Add email verification before allowing full access (optional enhancement)

## Future Enhancements

1. Email verification requirement before account activation
2. Resend Employee ID option in user dashboard
3. Custom email templates per company
4. Scheduled email delivery
5. Email delivery status tracking
6. Bulk employee registration with auto-ID emails

## Support

For issues or questions, check:
- Node.js console logs for error messages
- Nodemailer documentation: https://nodemailer.com/
- Email service provider documentation
