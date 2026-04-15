# Deploying ShotZoo to Vercel

This is a monorepo with the React/Vite frontend in `frontend/` and the
Express/Mongoose backend exposed as a single Vercel serverless function
via `api/[...path].ts` (which re-exports `backend/server.ts`).

## 1. Prerequisites

- A free **MongoDB Atlas** account (https://www.mongodb.com/cloud/atlas)
- A free **Vercel** account (https://vercel.com)
- This repo pushed to GitHub: https://github.com/santhosh-2909/Shotzoo

## 2. Create a MongoDB Atlas cluster (5 minutes)

1. Sign in at https://cloud.mongodb.com
2. **Create a free M0 cluster** in any region (closest to `iad1` is best — pick AWS / N. Virginia)
3. **Database Access** → **Add new database user**
   - Username: `shotzoo`
   - Password: generate a strong one and save it
   - Privileges: **Read and write to any database**
4. **Network Access** → **Add IP address** → `0.0.0.0/0` (allow from anywhere — required because Vercel functions don't have a fixed IP)
5. **Database** → **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://shotzoo:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with the one you saved, and add `/shotzoo` before the `?`:
   ```
   mongodb+srv://shotzoo:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/shotzoo?retryWrites=true&w=majority
   ```

**Test it locally before deploying:**
```bash
cd backend
MONGODB_URI="mongodb+srv://..." node scripts/test-mongo.js
```
You should see `✓ Connected successfully`.

## 3. Import the project into Vercel

1. https://vercel.com/new
2. Select your GitHub account → **santhosh-2909/Shotzoo** → **Import**
3. **Framework Preset:** Other (don't use Vite — the `vercel.json` overrides it)
4. **Root Directory:** `.` (the repo root)
5. Don't deploy yet — click **Environment Variables** first

## 4. Set environment variables (one-time)

Open `vercel.env.txt` in this repo (it's gitignored — contains a fresh
generated JWT secret). Copy each `KEY=value` line into Vercel's
**Environment Variables** form.

The full list:

| Key | Value | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | *(empty)* | Frontend talks to `/api/*` directly (Vercel rewrite) |
| `NODE_ENV` | `production` | Backend strict mode (refuses to start without MongoDB) |
| `JWT_SECRET` | *(from `vercel.env.txt` — 128 hex chars)* | JWT signing key |
| `JWT_EXPIRE` | `7d` | JWT lifetime |
| `MONGODB_URI` | `mongodb+srv://shotzoo:...@cluster0.xxxxx.mongodb.net/shotzoo?retryWrites=true&w=majority` | Atlas connection string from step 2 |
| `ALLOWED_ORIGINS` | `https://your-project.vercel.app` | CORS allowlist (use your real domain) |
| `EMAIL_SERVICE` | `gmail` *(optional)* | Only if you want OTP/email features |
| `EMAIL_USER` | `your_email@gmail.com` *(optional)* | Gmail app-password user |
| `EMAIL_PASSWORD` | *(Gmail app password)* | https://myaccount.google.com/apppasswords |

**Apply each variable to:** Production + Preview + Development (check all three).

## 5. Runtime settings (Vercel dashboard)

The repo pins **Node 22.x** via `engines.node` in every `package.json`.
Vercel will pick this up automatically. If your project's Deployment
Settings still show `Node.js Version: 24.x`:

1. **Project → Settings → Functions** → **Node.js Version** → **22.x** → Save
2. Redeploy

Other settings (from your screenshot) — leave as-is:

| Setting | Value | Why |
|---|---|---|
| Function CPU | Standard 1 vCPU 2 GB | More than enough for ShotZoo |
| Function Region | `iad1` (US East) | Pair with an Atlas cluster in N. Virginia for low latency |
| Fluid Compute | Enabled | Faster cold starts |
| Skew Protection | Disabled (or enable if you want client/server version pinning) |
| Cold Start Prevention | Disabled (paid feature, not needed) |
| Deployment Protection | Standard Protection | Prevents accidental public previews |

## 6. Deploy

1. Click **Deploy** in Vercel
2. Wait for the build (~2 minutes — installs root + frontend deps, builds Vite, bundles serverless function)
3. Open the deployment URL
4. Splash → Landing → Sign In
5. Login with `admin@shotzoo.dev` / `admin123` (auto-seeded on first boot against your Atlas cluster)

## 7. After deploy — verify it works

In a browser console at your deployed URL, run:

```js
fetch('/api/health').then(r => r.json()).then(console.log)
// → { status: "ok", time: "..." }

fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@shotzoo.dev', password: 'admin123' })
}).then(r => r.json()).then(console.log)
// → { success: true, token: "...", user: {...} }
```

If either fails:

| Symptom | Fix |
|---|---|
| `404 API endpoint not found` | `vercel.json` rewrites missing — redeploy after pushing latest commit |
| `MONGODB_URI is required in production` | You forgot to set `MONGODB_URI` in Vercel Environment Variables |
| `Failed to connect to MONGODB_URI` | Wrong password or IP whitelist not `0.0.0.0/0` in Atlas Network Access |
| `Not allowed by CORS` | Set `ALLOWED_ORIGINS` to your actual `*.vercel.app` URL |
| 500 with empty body | Check Vercel → Functions → Logs for the real exception |

## 8. After the deploy succeeds — security cleanup

1. **Delete `vercel.env.txt`** from your local checkout (it has the JWT secret in plaintext)
2. **Lock down `ALLOWED_ORIGINS`** if you're using a custom domain — replace the `*.vercel.app` URL with your real domain
3. **Rotate the JWT secret** if you ever git-add'd `vercel.env.txt` accidentally (run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` to generate a new one and update Vercel)

## 9. Notes on the architecture

- **Frontend**: `frontend/dist/` is served by Vercel's static hosting at `/`
- **Backend**: `api/[...path].ts` is a single serverless function. `vercel.json` rewrites `/api/*` and `/uploads/*` → that function. The function imports `backend/server.ts` which is a normal Express app.
- **Photos**: stored as `data:image/...;base64,...` URLs inline in the User document. No filesystem writes — works on Vercel's read-only filesystem.
- **Cron**: the hourly overdue-task job in `backend/server.ts` is **disabled on Vercel** (gated behind `!isServerless`). If you need it, set up a separate Vercel Cron at `vercel.com/dashboard → Cron`.
- **DB**: in production, `backend/config/db.ts` requires `MONGODB_URI` and exits if it's missing or unreachable. No silent in-memory fallback (which would be wiped on every cold start anyway).

## 10. Troubleshooting cheat sheet

```bash
# Test mongodb connection locally
cd backend
MONGODB_URI="mongodb+srv://..." node scripts/test-mongo.js

# Verify all type checks pass before pushing
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Build everything locally (matches what Vercel does)
npm install                        # root deps for serverless function
npm --prefix frontend install      # frontend deps
npm --prefix frontend run build    # frontend build

# Local dev (two terminals)
cd backend && npm run dev          # :5000
cd frontend && npm run dev         # :5173 (proxies /api → :5000)
```
