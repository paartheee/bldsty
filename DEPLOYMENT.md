# 🚀 Deployment Guide for Bldsty

This guide will help you deploy **Bldsty** to production using Vercel (frontend) and Railway (Socket.IO backend).

## Architecture Overview

- **Frontend (Next.js)**: Deployed to Vercel at `bldsty.vercel.app`
- **Backend (Socket.IO)**: Deployed to Railway
- **Database (Redis)**: Redis Cloud (already configured)

---

## Part 1: Deploy Socket.IO Server to Railway

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)

### Step 2: Deploy Socket.IO Server
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Connect your GitHub account and select this repository
4. Railway will automatically detect the `railway.json` configuration

### Step 3: Configure Environment Variables
In Railway dashboard, add these environment variables:

```bash
REDIS_URL=redis://default:TSfGgsznef3vepELf83N2SPh3UbxJarB@redis-10834.crce217.ap-south-1-1.ec2.cloud.redislabs.com:10834
ALLOWED_ORIGINS=https://bldsty.vercel.app,http://localhost:3000
PORT=3001
```

### Step 4: Get Railway URL
1. After deployment, Railway will provide a public URL like: `https://your-app.railway.app`
2. **Copy this URL** - you'll need it for Vercel

---

## Part 2: Deploy Next.js App to Vercel

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy to Vercel
From the project root, run:

```bash
vercel --prod
```

When prompted:
- **Project name**: `bldsty`
- **Framework**: Next.js (auto-detected)
- **Build command**: `next build` (auto-detected)
- **Output directory**: `.next` (auto-detected)

### Step 4: Configure Environment Variables in Vercel

#### Option A: Via Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **bldsty** project
3. Go to **Settings → Environment Variables**
4. Add the following:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-app.railway.app` | Production |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` | Development |

#### Option B: Via CLI
```bash
vercel env add NEXT_PUBLIC_SOCKET_URL production
# Paste your Railway URL: https://your-app.railway.app

vercel env add NEXT_PUBLIC_SOCKET_URL development
# Paste: http://localhost:3001
```

### Step 5: Redeploy After Adding Variables
```bash
vercel --prod
```

---

## Part 3: Update Railway CORS Settings

After deploying to Vercel, update Railway environment variables:

1. Go to Railway dashboard
2. Update `ALLOWED_ORIGINS` to include your Vercel URL:
```bash
ALLOWED_ORIGINS=https://bldsty.vercel.app,http://localhost:3000
```
3. Railway will automatically redeploy

---

## 🎉 Your App is Live!

- **Frontend**: https://bldsty.vercel.app
- **Socket.IO Backend**: https://your-app.railway.app

---

## Local Development

### Run both servers locally:

**Terminal 1 - Socket.IO Server:**
```bash
npm run dev:socket
```

**Terminal 2 - Next.js Frontend:**
```bash
npm run dev
```

Then open http://localhost:3000

---

## Troubleshooting

### Socket.IO Connection Issues

1. **Check CORS settings** in Railway
   - Ensure `ALLOWED_ORIGINS` includes your Vercel URL

2. **Check environment variables** in Vercel
   - Verify `NEXT_PUBLIC_SOCKET_URL` points to your Railway URL

3. **Check Railway logs**
   ```bash
   railway logs
   ```

4. **Test Socket.IO server directly**
   - Open `https://your-app.railway.app/health` in browser
   - Should return: `{"status":"ok","timestamp":...}`

### Redis Connection Issues

1. **Verify Redis URL** in Railway environment variables
2. **Check Redis Cloud dashboard** for connection limits
3. **Check Railway logs** for Redis connection errors

---

## Custom Domain (Optional)

### For Vercel:
1. Go to **Project Settings → Domains**
2. Add your custom domain (e.g., `bldsty.com`)
3. Follow DNS configuration instructions

### For Railway:
1. Go to **Settings → Networking**
2. Add custom domain
3. Update Railway URL in Vercel environment variables

---

## Monitoring

### Railway Metrics:
- View deployment logs
- Monitor CPU/Memory usage
- Track request counts

### Vercel Analytics:
- View page views
- Monitor build times
- Track errors

---

## Cost Estimates (Free Tiers)

- **Vercel**: Free for hobby projects (100 GB bandwidth/month)
- **Railway**: $5 free credit/month (includes 500 hours of usage)
- **Redis Cloud**: Free tier (30MB storage)

**Total**: ~$0-5/month depending on usage

---

## Support

If you encounter issues:
1. Check Railway logs: `railway logs`
2. Check Vercel deployment logs in dashboard
3. Test Socket.IO connection in browser console
4. Verify all environment variables are set correctly
