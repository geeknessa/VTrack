# VTrack - Production Deployment Guide

This guide covers deploying VTrack to production using free-tier cloud infrastructure suited for university students.

---

## Recommended Production Stack (Zero-to-Low Cost)

| Layer | Recommended Provider | Plan / Tier | Key Features |
| :--- | :--- | :--- | :--- |
| **Database** | [Neon](https://neon.tech) or [Supabase](https://supabase.com) | Free Tier (0.5 GB) | Serverless PostgreSQL with automated SSL, connection pooling, and instant branching. |
| **Backend API** | [Render](https://render.com) or [Railway](https://railway.app) | Free / Starter ($0 - $7/mo) | Native Node.js web service with automatic SSL, environment secrets, and health check monitoring. |
| **Frontend Web App** | [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com) | Free Tier | Global edge CDN, automated Git preview deployments, and custom domains with free SSL. |

---

## Step 1: Database Provisioning & Migrations

1. Create a PostgreSQL project on Neon or Supabase.
2. Copy your pooled connection string with SSL mode enabled:
   ```text
   postgres://[user]:[password]@[host]/[database]?sslmode=require
   ```
3. Run the database migrations to apply tables `001` through `016` (including global Nile campus restaurants and seed FX rates):
   ```bash
   cd backend
   DATABASE_URL="postgres://[user]:[password]@[host]/[database]?sslmode=require" npm run migrate
   ```

---

## Step 2: Backend API Deployment (e.g. Render / Railway)

1. Connect your repository to Render/Railway as a **Web Service**.
2. Set the root directory to `backend`.
3. Set the build and start commands:
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
4. Set the **Health Check Path** to `/api/health`.
5. Configure the following **Environment Variables**:
   * `NODE_ENV`: `production`
   * `PORT`: `5000` (Render/Railway injects its own port automatically)
   * `DATABASE_URL`: `postgres://[user]:[password]@[host]/[database]?sslmode=require`
   * `SESSION_SECRET`: A secure 64-character random string (Generate using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   * `CLIENT_URL`: `https://vtrack.vercel.app` (your deployed frontend URL without trailing slash)
   * `ALLOWED_ORIGINS`: `https://vtrack.vercel.app`

---

## Step 3: Frontend Deployment (e.g. Vercel)

1. Connect your repository to Vercel as a new Project.
2. Set the **Root Directory** to `frontend`.
3. Framework Preset: **Vite**.
4. Build settings:
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
5. Configure the Environment Variable:
   * `VITE_API_URL`: `https://vtrack-api.onrender.com` (your deployed backend API URL)
6. Deploy! Vercel will automatically read `frontend/vercel.json` to handle client-side routing rewrites (`/* -> /index.html`).

---

## Step 4: Post-Deployment Verification Checklist

- [ ] **Health Endpoint**:
  Visit `https://your-api.com/api/health`. Expected response:
  ```json
  {
    "status": "ok",
    "service": "VTrack JSON API",
    "database": "connected",
    "uptime_seconds": 12,
    "timestamp": "2026-10-12T11:30:00.000Z"
  }
  ```
- [ ] **Security Headers**:
  Inspect response headers using DevTools or curl:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Cross-Origin-Resource-Policy: cross-origin`
- [ ] **Auth & Session Flow**:
  1. Open the frontend and complete the 5-step onboarding wizard.
  2. Verify that login credentials persist securely in httpOnly cookies.
  3. Verify that opening a second tab allows independent user switching via `x-session-token`.
- [ ] **Global Menus**:
  Navigate to `/menus` and confirm that all 12 authentic campus restaurants and 593 dishes display correctly.
- [ ] **Export & Deletion**:
  Navigate to `/settings`, download a CSV export of your transactions, and test modal actions.
