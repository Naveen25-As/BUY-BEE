# BUY BEE Deployment Guide

This guide covers deploying the BUY BEE e-commerce platform to production.

## Prerequisites

- Supabase account (https://supabase.com)
- Node.js 20+ installed
- Git
- Deployment accounts (Vercel for frontend, Render/Railway for backend)

## Deployment Architecture

```
Frontend (React/Vite) → Vercel
Backend (Express/Node.js) → Render/Railway
Database (PostgreSQL) → Supabase (accessed only by the backend)
```

## Step 1: Database Setup (Supabase)

1. **Create the Supabase project and schema:** follow `SUPABASE_SETUP.md` (run the three SQL files in
   `server/supabase/migrations` in order).

2. **(Optional) Migrate existing MongoDB data:** run `npm run migrate:mongo` (dry run) and then
   `npm run migrate:mongo -- --execute` from `server/`, see `SUPABASE_SETUP.md` section 5.
   Keep MongoDB until the deployed app is verified.

3. **Collect the backend environment variables:**
   ```env
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # secret, backend only
   JWT_SECRET=your_long_random_secret_at_least_32_characters  # keep the old value to keep existing sessions valid
   CLIENT_URL=https://your-frontend.vercel.app
   ```

## Step 2: Backend Deployment (Render/Railway)

### Option A: Render

1. **Prepare Backend for Render:**
   - Make sure `server/package.json` has correct scripts:
     ```json
     "scripts": {
       "start": "node src/index.js",
       "dev": "node --watch src/index.js"
     }
     ```

2. **Create Render Account:**
   - Go to https://render.com
   - Sign up/login

3. **Deploy:**
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Root Directory:** `server`
     - **Runtime:** Node 20+ (set `NODE_VERSION=20` if needed)
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Environment Variables:**
       - `PORT`: `5000`
       - `NODE_ENV`: `production`
       - `SUPABASE_URL`: (Supabase Project URL)
       - `SUPABASE_SERVICE_ROLE_KEY`: (Supabase service_role key, mark it as secret)
       - `JWT_SECRET`: (your secure secret)
       - `CLIENT_URL`: (your Vercel frontend URL)

4. **Get Backend URL:**
   - Render will provide a URL like `https://your-backend.onrender.com`
   - Note this for frontend configuration

### Option B: Railway

1. **Create Railway Account:**
   - Go to https://railway.app
   - Sign up/login

2. **Deploy:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your repository
   - Configure:
     - **Root Directory:** `server`
     - **Environment Variables:** (same as Render)
   - Railway will auto-detect Node.js and deploy

## Step 3: Frontend Deployment (Vercel)

1. **Prepare Frontend for Vercel:**
   - Update `client/.env.production`:
     ```env
     VITE_API_URL=https://your-backend-url.onrender.com/api
     ```

2. **Create Vercel Account:**
   - Go to https://vercel.com
   - Sign up/login

3. **Deploy:**
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset:** Vite
     - **Root Directory:** `client`
     - **Environment Variables:**
       - `VITE_API_URL`: (your backend URL + `/api`)
       - Do **not** add any Supabase variables to Vercel: the frontend only talks to the Express API.
   - Click "Deploy"

4. **Get Frontend URL:**
   - Vercel will provide a URL like `https://your-frontend.vercel.app`

## Step 4: Update Backend CORS

Update your backend CORS configuration to include the production frontend URL:

```javascript
// server/src/index.js
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://your-frontend.vercel.app' // Add your production URL
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
```

## Step 5: Seed Production Database

After deployment, you may want to seed your production database with initial data:

Skip this if you migrated MongoDB data. Otherwise, from your machine with `server/.env` pointing at the
production Supabase project:

```bash
cd server
npm run seed   # refuses to run if the database already contains data
```

## Environment Variables Summary

### Backend (`server/.env`)
```env
PORT=5000
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_long_random_secret_at_least_32_characters
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend.vercel.app
SMTP_HOST=smtp.gmail.com (optional)
SMTP_PORT=587 (optional)
SMTP_USER=your-email@gmail.com (optional)
SMTP_PASS=your-app-password (optional)
EMAIL_FROM=noreply@buybee.com (optional)
```

### Frontend (`client/.env.production`)
```env
VITE_API_URL=https://your-backend.onrender.com/api
```

## Verification Checklist

After deployment, verify:

- [ ] Frontend loads at your Vercel URL
- [ ] Backend health check responds: `https://your-backend.onrender.com/api/health`
- [ ] User registration works
- [ ] User login works
- [ ] Products load from database
- [ ] Cart functionality works
- [ ] Checkout process works
- [ ] Admin login works
- [ ] Admin dashboard loads data

## Troubleshooting

### Frontend Issues

**CORS Errors:**
- Verify backend CORS includes your frontend URL
- Check that `VITE_API_URL` is correct

**API Calls Failing:**
- Check browser console for network errors
- Verify backend is running and accessible
- Check environment variables are set correctly

### Backend Issues

**Database Connection Failed:**
- Startup log shows `Supabase connection failed: ...`
- Verify `SUPABASE_URL` and that `SUPABASE_SERVICE_ROLE_KEY` is the service_role key (not the anon key)
- Make sure all three migration files were run (see `SUPABASE_SETUP.md`)

**JWT Errors:**
- Verify `JWT_SECRET` is set and consistent
- Check token expiration settings

**Build Failures:**
- Check Render/Railway build logs
- Verify all dependencies are in `package.json`
- Ensure Node.js version compatibility

## Performance Optimization

### Frontend (Vercel)
- Vercel automatically handles CDN caching
- Images are optimized automatically
- Enable Vercel Analytics for monitoring

### Backend (Render/Railway)
- Use Render's free tier for development
- Consider upgrading for production:
  - More CPU/memory
  - Faster build times
  - Dedicated instances

### Database (Supabase)
- Monitor slow queries in Supabase -> Reports / Query Performance
- Indexes for common filters, a full-text search index and foreign-key indexes are created by the migrations

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong `JWT_SECRET` (32+ characters)
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` only in the Render environment (never in Vercel or git)
- [ ] Confirm RLS is enabled on all tables (Supabase -> Table Editor shows "RLS enabled")
- [ ] Use HTTPS (automatic on Vercel/Render)
- [ ] Set up monitoring/alerts
- [ ] Regular database backups
- [ ] Review access logs periodically

## Monitoring

### Vercel (Frontend)
- Built-in analytics dashboard
- Real-time logs
- Performance metrics

### Render/Railway (Backend)
- Real-time logs
- Metrics dashboard
- Alert configurations

### Supabase
- Database reports and query performance
- API / Postgres logs

## Backup Strategy

### Database Backups
- Supabase provides daily backups on paid plans; enable Point-in-Time Recovery for production
- `pg_dump` against the Supabase connection string for manual backups
- Test restore process periodically

### Code Backups
- GitHub repository serves as backup
- Tag releases for version control
- Document deployment configurations

## Scaling Considerations

### When to Scale Frontend
- High traffic volumes
- Need for global CDN
- Edge computing requirements

### When to Scale Backend
- API response time > 500ms
- High CPU/memory usage
- Need for background jobs

### When to Scale Database
- Query performance degradation
- Storage approaching limits
- Need for sharding

## Cost Estimates (Free Tier)

- **Vercel:** Free for hobby projects
- **Render:** Free tier available (limited hours)
- **Supabase:** Free tier (500MB database)

**Estimated Monthly Cost (Production):**
- Vercel Pro: $20/month
- Render Pro: $7/month minimum
- Supabase Pro: $25/month
- **Total:** ~$52/month for small production setup

## Post-Deployment Tasks

1. **Set up monitoring:**
   - Configure error tracking (Sentry)
   - Set up uptime monitoring
   - Configure performance monitoring

2. **Configure email:**
   - Set up SMTP for password reset emails
   - Test email delivery
   - Configure email templates

3. **Set up analytics:**
   - Google Analytics for frontend
   - Backend API monitoring
   - Database performance tracking

4. **Security hardening:**
   - Enable rate limiting
   - Configure WAF rules
   - Set up security headers
   - Regular security audits

## Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Render Docs:** https://render.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Vite Deployment:** https://vitejs.dev/guide/build.html
