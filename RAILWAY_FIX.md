# 🔧 Railway Deployment Fix Guide

## ✅ Local Testing Results
Your application is **working perfectly locally**:
- Socket.IO server running on port 3001 ✅
- Next.js frontend running on port 3000 ✅
- Redis connection successful ✅
- Room creation and Socket.IO communication working ✅

## ❌ Issues Found in Railway Configuration

Based on the Railway configuration screenshot you provided, here are the critical issues:

### **Issue 1: NEXT_PUBLIC_APP_URL is Incorrect** 🚨
**Current (WRONG):**
```
NEXT_PUBLIC_APP_URL=http://localhost:3000,https://bldsty.vercel.app,https://www.blindlol.com,https://blindlol.com
```

**Problem:** This variable should contain a **single URL**, not a comma-separated list. This is the URL of your frontend application, not a CORS list.

**Fix:** Remove this variable entirely from Railway, or set it to a single URL if needed by your frontend.

### **Issue 2: Missing or Incorrect PORT Configuration**
Railway automatically provides a `PORT` environment variable. Your code correctly reads it, but ensure Railway isn't overriding it.

---

## 🔧 Correct Railway Environment Variables

Set these **exact** environment variables in your Railway dashboard:

### **1. REDIS_URL** ✅ (Already Correct)
```
redis://default:TSfGgsznef3vepELf83N2SPh3UbxJarB@redis-10834.crce217.ap-south-1-1.ec2.cloud.redislabs.com:10834
```

### **2. ALLOWED_ORIGINS** ✅ (Already Correct)
```
http://localhost:3000,https://bldsty.vercel.app,https://www.blindlol.com,https://blindlol.com
```

### **3. Remove or Fix NEXT_PUBLIC_APP_URL** ❌
**Option A (Recommended):** Delete this variable entirely from Railway
- The Socket.IO server doesn't need this variable
- This is only used by the Next.js frontend (deployed on Vercel)

**Option B:** If you must keep it, set it to a single URL:
```
NEXT_PUBLIC_APP_URL=https://www.blindlol.com
```

### **4. Remove NEXT_PUBLIC_SOCKET_URL from Railway** ❌
This variable is only needed by the **frontend** (Vercel), not the backend (Railway).
Delete it from Railway environment variables.

---

## 📋 Step-by-Step Fix Instructions

### Step 1: Update Railway Environment Variables
1. Go to your Railway project dashboard
2. Click on **Variables** tab
3. **Delete** the following variables:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SOCKET_URL`

4. **Keep** these variables:
   - `REDIS_URL` (already correct)
   - `ALLOWED_ORIGINS` (already correct)

5. Click **Deploy** to redeploy with new settings

### Step 2: Verify Railway Deployment
After deployment, test your Railway Socket.IO server:

1. **Health Check:**
   ```bash
   curl https://bldsty.up.railway.app/health
   ```
   Should return: `{"status":"ok","timestamp":...}`

2. **Check Logs:**
   - Go to Railway dashboard → **Deployments** → **View Logs**
   - Look for:
     ```
     ✅ Redis connected
     ✅ Socket.IO handlers registered
     🚀 Socket.IO server running on port XXXX
     📡 Accepting connections from: ...
     ```

### Step 3: Update Vercel Environment Variables
Make sure your Vercel deployment has:

**Production Environment:**
```
NEXT_PUBLIC_SOCKET_URL=https://bldsty.up.railway.app
NEXT_PUBLIC_APP_URL=https://www.blindlol.com
```

**Development Environment:**
```
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🧪 Testing After Fix

### Test 1: Railway Health Check
```bash
curl https://bldsty.up.railway.app/health
```
Expected: `{"status":"ok","timestamp":1234567890}`

### Test 2: Socket.IO Connection from Browser
1. Open your production site: https://www.blindlol.com
2. Open browser console (F12)
3. Look for: `Connected to server`
4. Try creating a room

### Test 3: Check Railway Logs
```bash
# If you have Railway CLI installed
railway logs
```
Look for successful connections and no CORS errors.

---

## 🐛 Common Errors and Solutions

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"
**Cause:** Frontend URL not in `ALLOWED_ORIGINS`
**Fix:** Add your frontend URL to `ALLOWED_ORIGINS` in Railway

### Error: "WebSocket connection failed"
**Cause:** Wrong `NEXT_PUBLIC_SOCKET_URL` in Vercel
**Fix:** Set `NEXT_PUBLIC_SOCKET_URL=https://bldsty.up.railway.app` in Vercel

### Error: "Redis connection failed"
**Cause:** Wrong `REDIS_URL` or Redis server down
**Fix:** Verify Redis URL in Railway matches your Redis Cloud credentials

---

## 📊 Environment Variable Summary

| Variable | Railway (Socket.IO) | Vercel (Frontend) |
|----------|---------------------|-------------------|
| `REDIS_URL` | ✅ Required | ❌ Not needed |
| `ALLOWED_ORIGINS` | ✅ Required | ❌ Not needed |
| `NEXT_PUBLIC_SOCKET_URL` | ❌ Not needed | ✅ Required |
| `NEXT_PUBLIC_APP_URL` | ❌ Not needed | ✅ Required |
| `PORT` | ✅ Auto-set by Railway | ✅ Auto-set by Vercel |

---

## 🎯 Quick Fix Checklist

- [ ] Remove `NEXT_PUBLIC_APP_URL` from Railway
- [ ] Remove `NEXT_PUBLIC_SOCKET_URL` from Railway
- [ ] Keep `REDIS_URL` in Railway
- [ ] Keep `ALLOWED_ORIGINS` in Railway
- [ ] Redeploy Railway
- [ ] Test health endpoint: `https://bldsty.up.railway.app/health`
- [ ] Verify Vercel has `NEXT_PUBLIC_SOCKET_URL=https://bldsty.up.railway.app`
- [ ] Test production site: https://www.blindlol.com

---

## 📞 Need Help?

If issues persist after following this guide:
1. Check Railway deployment logs for errors
2. Check Vercel deployment logs
3. Test Socket.IO connection in browser console
4. Verify all environment variables are set correctly
