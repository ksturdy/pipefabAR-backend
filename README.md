# PipeFabAR Backend API

Node.js/Express backend for PipeFabAR. Provides REST API for iOS and web clients to sync project data.

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Postgres locally** (if you don't have it):
   ```bash
   # macOS with Homebrew
   brew install postgresql
   brew services start postgresql
   createdb pipefabar
   ```

3. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your local database URL:
   ```
   DATABASE_URL=postgresql://localhost:5432/pipefabar
   JWT_SECRET=dev-secret-key-change-in-production
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```
   Server will run on `http://localhost:3000`

5. **Test the API:**
   ```bash
   # Health check
   curl http://localhost:3000/health

   # Register a user
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

## Deployment to Render

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial backend setup"
   git push origin main
   ```

2. **Create Render project:**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Choose the `pipefabAR-backend` repository
   - Set environment:
     - **Build Command:** `npm install`
     - **Start Command:** `node server.js`

3. **Add Postgres database:**
   - In Render dashboard, create a new PostgreSQL database
   - Copy the `Internal Database URL`
   - Add to your Web Service environment variables:
     - `DATABASE_URL`: (paste the URL)
     - `JWT_SECRET`: (generate a random string)
     - `NODE_ENV`: `production`

4. **Deploy:**
   - Render will automatically deploy when you push to main
   - Check logs in Render dashboard for any errors

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login (returns JWT token)

### Projects (requires auth)
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project with work packages
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Work Packages (requires auth)
- `GET /api/workPackages/project/:projectId` - List work packages
- `POST /api/workPackages` - Create work package
- `PUT /api/workPackages/:id` - Update work package
- `DELETE /api/workPackages/:id` - Delete work package

### Spools (requires auth)
- `GET /api/spools/workPackage/:workPackageId` - List spools
- `POST /api/spools` - Create spool
- `PUT /api/spools/:id` - Update spool
- `DELETE /api/spools/:id` - Delete spool

## Authentication

All endpoints except `/api/auth/*` require a bearer token:
```
Authorization: Bearer <token>
```

Get a token by logging in:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Then use the returned `token` in all subsequent requests.
