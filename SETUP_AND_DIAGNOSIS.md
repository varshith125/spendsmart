# SpendSmart Application - Diagnostic Report & Setup Guide

## Issues Found & Fixed ✅

### 1. **API URL Configuration Issue** ❌ FIXED ✅
**Problem:** Frontend was using relative URLs like `/api/auth` which would call the same domain as the frontend. When frontend is on `localhost:5173` and backend is on `localhost:5000`, these relative URLs fail.

**Files Updated:**
- [client/src/context/AuthContext.jsx](client/src/context/AuthContext.jsx) - Updated to use environment-based API URL
- [client/src/hooks/useExpenses.js](client/src/hooks/useExpenses.js) - Updated API endpoint
- [client/src/hooks/useCreditCards.js](client/src/hooks/useCreditCards.js) - Updated API endpoint
- [client/src/hooks/useLoans.js](client/src/hooks/useLoans.js) - Updated API endpoint
- [client/src/pages/Insights.jsx](client/src/pages/Insights.jsx) - Updated API endpoint
- [client/src/pages/Reports.jsx](client/src/pages/Reports.jsx) - Updated API endpoint
- **Created:** [client/src/utils/apiConfig.js](client/src/utils/apiConfig.js) - Centralized API configuration utility

**Solution:** Now uses `VITE_API_URL` environment variable with fallback to `http://localhost:5000`

---

### 2. **Missing Environment Configuration** ❌ FIXED ✅
**Problem:** Only `.env.example` files existed, no actual `.env` files with real configuration.

**Created Files:**
- **[server/.env](server/.env)** - Contains:
  - `MONGODB_URI` (default: mongodb://localhost:27017/spendsmart)
  - `JWT_SECRET` (you must change this!)
  - `CLIENT_URL` (http://localhost:5173)
  - `GEMINI_API_KEY` (optional, for AI insights)
  - `PORT` (5000)

- **[client/.env](client/.env)** - Contains:
  - `VITE_API_URL=http://localhost:5000`

---

### 3. **Port Conflict** ⚠️ NEEDS ATTENTION
**Problem:** Server error logs show `EADDRINUSE: address already in use :::5000`

**Solution:** A previous server process is still running. Need to kill it.

---

### 4. **Database Not Connected** ⚠️ NEEDS ATTENTION
**Problem:** MongoDB URI was not configured, so backend cannot save data to database.

**What's needed:**
- MongoDB instance running locally (port 27017), OR
- MongoDB Atlas connection string from https://www.mongodb.com/cloud/atlas

---

## Pre-requisites Checklist

- [ ] Node.js v18+ installed
- [ ] MongoDB running locally OR MongoDB Atlas account
- [ ] Terminal access to the project directory

---

## Setup Steps

### Step 1: Verify Environment Files
✅ **Done!** Both `.env` files are now created:
- [server/.env](server/.env)
- [client/.env](client/.env)

### Step 2: Update Server Configuration
Edit [server/.env](server/.env) and configure:
```
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<change-to-a-strong-random-string>
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=<optional-for-ai-features>
PORT=5000
```

### Step 3: Install Dependencies
```bash
# In server directory
cd server
npm install

# In client directory
cd ../client
npm install
```

### Step 4: Start Services

**Terminal 1 - Start Backend Server:**
```bash
cd server
npm run dev
# Should output: ✅ Connected to MongoDB
# Should output: 🚀 Server running on port 5000
```

**Terminal 2 - Start Frontend:**
```bash
cd client
npm run dev
# Should output: ➜  Local:   http://localhost:5173/
```

### Step 5: Test Login/Signup
1. Navigate to http://localhost:5173/signup
2. Create an account with:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
3. Should see "Account created! 🎉" and redirect to dashboard
4. Data should be saved in MongoDB

---

## Database Setup

### Option A: Local MongoDB
```bash
# Windows (if using MongoDB installer)
mongod

# Or using WSL/Linux
sudo systemctl start mongodb
```

### Option B: MongoDB Atlas (Cloud)
1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. Get connection string (looks like: `mongodb+srv://user:password@cluster.mongodb.net/spendsmart`)
4. Update `MONGODB_URI` in [server/.env](server/.env)

---

## Verification Checklist

After startup, verify:

- [ ] Backend console shows: `✅ Connected to MongoDB`
- [ ] Frontend loads at http://localhost:5173
- [ ] Can navigate to /signup page
- [ ] Signup form submits without errors
- [ ] User data appears in MongoDB (check with MongoDB Compass)
- [ ] Can login with created account
- [ ] Dashboard loads and no API errors in browser console

---

## Common Issues & Solutions

### Issue: "Cannot POST /api/auth/signup"
**Cause:** Frontend and backend not communicating
**Solution:** Verify VITE_API_URL is set to backend URL in [client/.env](client/.env)

### Issue: "MongoDB connection error"
**Cause:** MongoDB not running or wrong connection string
**Solution:** 
- Check if MongoDB service is running
- Verify MONGODB_URI in [server/.env](server/.env)
- Test with `mongo` or `mongosh` CLI

### Issue: "Port 5000 already in use"
**Cause:** Previous server process still running
**Solution:** Kill the process:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :5000
kill -9 <PID>
```

### Issue: "JWT_SECRET is required"
**Cause:** JWT_SECRET not set in [server/.env](server/.env)
**Solution:** Add any random string to JWT_SECRET

---

## File Structure Summary

```
spendsmart-main/
├── server/
│   ├── .env                    ← ✅ CREATED with MongoDB config
│   ├── .env.example
│   ├── server.js               ← Connects to MongoDB
│   ├── routes/
│   │   └── auth.js             ← Login/Signup endpoints
│   ├── models/
│   │   └── User.js             ← User schema
│   └── package.json
│
├── client/
│   ├── .env                    ← ✅ CREATED with API URL
│   ├── .env.example
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx ← ✅ UPDATED to use env API URL
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useExpenses.js  ← ✅ UPDATED
│   │   │   ├── useCreditCards.js ← ✅ UPDATED
│   │   │   └── useLoans.js     ← ✅ UPDATED
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Insights.jsx    ← ✅ UPDATED
│   │   │   └── Reports.jsx     ← ✅ UPDATED
│   │   ├── utils/
│   │   │   └── apiConfig.js    ← ✅ CREATED (centralized API config)
│   │   └── main.jsx
│   └── package.json
```

---

## Next Steps

1. ✅ Environment files created
2. ✅ API URL configuration fixed
3. ⏳ **TODO:** Install dependencies (`npm install` in server & client)
4. ⏳ **TODO:** Configure MongoDB connection
5. ⏳ **TODO:** Start server and client
6. ⏳ **TODO:** Test login/signup functionality
7. ⏳ **TODO:** Verify data is saved to MongoDB

---

## Summary of Changes

| File | Change | Status |
|------|--------|--------|
| server/.env | Created with MongoDB/JWT config | ✅ |
| client/.env | Created with API URL | ✅ |
| client/src/utils/apiConfig.js | Created centralized config | ✅ |
| client/src/context/AuthContext.jsx | Uses getApiUrl() | ✅ |
| client/src/hooks/useExpenses.js | Uses getApiUrl() | ✅ |
| client/src/hooks/useCreditCards.js | Uses getApiUrl() | ✅ |
| client/src/hooks/useLoans.js | Uses getApiUrl() | ✅ |
| client/src/pages/Insights.jsx | Uses getApiUrl() | ✅ |
| client/src/pages/Reports.jsx | Uses getApiUrl() | ✅ |

