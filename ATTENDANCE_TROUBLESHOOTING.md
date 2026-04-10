# Attendance Loading - Troubleshooting Guide

## Quick Diagnostic Steps

### Step 1: Check if Backend is Running
```
Open in browser: http://localhost:5000/api/health
Expected response: { "status": "ok", "time": "..." }
```

### Step 2: Check Attendance Records in Database
```
Open in browser (while logged in): http://localhost:5000/api/attendance/debug
This will show:
- Total attendance records for you
- Last 10 records
- Today's record
- Status and messages
```

### Step 3: Check Browser Console for Errors
1. Open Dashboard
2. Press **F12** to open Developer Tools
3. Click **Console** tab
4. Look for red error messages
5. Report any errors you see

---

## Common Issues & Fixes

### Issue: "No attendance records yet. Start your day to begin tracking!"

**This is NORMAL if you haven't started your day yet!**

**Fix:**
1. Go to **Attendance.html**
2. Click **"Start My Day"** button
3. Click **Check In**
4. (Optional) Click **Check Out** later
5. Return to **Dashboard.html** - data should now show

---

### Issue: "Unable to load attendance data" (Error message)

**Possible causes:**
1. Backend server not running
2. Not logged in (session expired)
3. Database connection issue

**Fix:**
1. Check backend is running: `npm start` in backend folder
2. Log out and log back in
3. Check MongoDB is running
4. Check browser console (F12) for specific error

---

### Issue: "Session expired. Please log in again."

**Your login token expired or is invalid**

**Fix:**
1. Reload the page
2. If still stuck, log out and log back in
3. Check that JWT_SECRET in .env is correct

---

### Issue: Blank attendance section on Dashboard

**Could be multiple causes**

**Debug Steps:**
1. Open browser console (F12)
2. Go to Dashboard
3. Look for any red errors
4. Copy error text and check troubleshooting
5. Run `/api/attendance/debug` endpoint to check database

---

## Database Verification

### Check MongoDB has Attendance Records

**In MongoDB client, run:**
```
use shotzoo
db.attendances.find({ user: ObjectId("YOUR_USER_ID") }).pretty()
```

If no records appear, you need to:
1. Go to Attendance.html
2. Click "Start My Day"
3. Records will be created in database

---

## Manual API Testing

### Get Attendance History (via curl)
```bash
curl -X GET http://localhost:5000/api/attendance/history \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Accept: application/json"
```

### Get Debug Info (via curl)
```bash
curl -X GET http://localhost:5000/api/attendance/debug \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Accept: application/json"
```

---

## What Should Work

### Correct Flow:
1. ✅ Login to Dashboard
2. ✅ See stats (might show 0 initially)
3. ✅ Go to Attendance page
4. ✅ Click "Start My Day"
5. ✅ Return to Dashboard
6. ✅ See attendance dots for this week
7. ✅ See message like "1/1 days attended"

---

## Still Having Issues?

1. **Check browser console (F12)** for error messages
2. **Visit debug endpoint** to verify data exists
3. **Check backend is running** with `/api/health`
4. **Check MongoDB is running** and databases exist
5. **Try different browser** to rule out cache issues
6. **Clear browser cache** (Ctrl+Shift+Delete)

---

## Files Involved

- **Frontend**: `frontend/Dashboard.html` (lines 403-480)
- **Backend**: `backend/controllers/attendanceController.js`
- **Backend**: `backend/routes/attendance.js`
- **Database**: `shotzoo.attendances` collection

---

## Contact Support

If none of these steps work:
1. Note the exact error message
2. Run the `/api/attendance/debug` endpoint and copy output
3. Check browser console error
4. Share all three with support

---

**Last Updated**: April 8, 2026
**Version**: 1.0
