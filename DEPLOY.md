# Deployment: Netlify + Railway

Snake Wars is split into **frontend** (Netlify) and **backend** (Railway). The Empire game and all other games use the same backend.

---

## Backend (Railway)

### How the Empire database works

- **No separate DB server.** Empire uses **SQLite** (file-based) via `better-sqlite3`.
- **Setup is automatic:** On first request, the backend opens the DB file, runs schema creation (`ensureSchema`) and universe bootstrap (450 empty slots). No migrations or manual setup.
- **Where the file lives:** Controlled by `EMPIRE_DB_PATH`. Default (no env var) = `empire.db` next to the code (e.g. inside the container at `/app/empire/empire.db`).
- **Docker:** The repo includes a `Dockerfile` that builds the backend. Railway can use it (set “Dockerfile” as build type and root to repo). The Dockerfile installs build tools so `better-sqlite3` compiles on Alpine.

### Persistence on Railway

- **Without a volume:** The container filesystem is **ephemeral**. The DB is created and works, but **every new deploy** replaces the container and the DB is lost → fresh universe each time.
- **With a volume (recommended for production):** In Railway, add a **Volume** to the service, mount it at e.g. `/data`, and set `EMPIRE_DB_PATH=/data/empire.db`. The DB file then lives on the volume and **persists across deploys**.

### Setup

1. **Create a new project** on [Railway](https://railway.app) and add a service.
2. **Deploy from repo:** Either use the **Dockerfile** (recommended: “Dockerfile” as builder, no root directory) or **Nixpacks/Node:** root directory = `backend`, build = `npm install`, start = `npm start`.
3. **Start:** Runs `node server.js`. Railway sets `PORT`; the server uses `process.env.PORT || 3000` and listens on `0.0.0.0`.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Set automatically by Railway. |
| `EMPIRE_DB_PATH` | No | Path for the Empire SQLite DB file. **Default:** `empire/empire.db` inside the app. For **persistent data**, use a Railway volume and set e.g. `EMPIRE_DB_PATH=/data/empire.db`. |

### CORS

The backend allows:

- `https://*.netlify.app`
- The specific origin `https://competent-bhabha-e702ed.netlify.app`
- `http://localhost:3000`, `http://localhost:8080` (and 127.0.0.1)

If your frontend uses a different Netlify URL, add it to `ALLOWED_ORIGINS` in `backend/server.js` or extend the regex.

### Health check

- **Path:** `GET /` or `GET /health`
- **Response:** `200` with body `Snake Wars backend`

---

## Frontend (Netlify)

### Setup

1. **Connect the repo** to Netlify.
2. **Build settings** (or use the repo’s `netlify.toml`):
   - **Base directory:** `frontend`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `.` (relative to base, so the contents of `frontend`)

The build runs `inject-env.js` (injects backend URL if placeholder is used) and `minify.js` (minifies JS when `NETLIFY=true` or `CI=true`).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SNAKE_WARS_BACKEND_URL` | Recommended | Full backend URL, e.g. `https://your-app.up.railway.app`. If not set, the frontend uses the hardcoded fallback in each HTML file (e.g. `https://snake-wars-production.up.railway.app`). To override at build time, set this in Netlify and ensure the hub’s `index.html` uses the placeholder expected by `inject-env.js` (see `frontend/inject-env.js`). |

### After deploy

- Open the Netlify site URL. The hub and all games (Snake, BR, Heave Ho, RTS, Empire) load from the same origin; they connect to the backend URL above for Socket.IO.

---

## Checklist

- [ ] **Railway:** Service root = `backend` (or equivalent), start = `npm start`, `PORT` provided by Railway.
- [ ] **Railway (optional):** Volume for Empire DB and `EMPIRE_DB_PATH` set for persistent universe.
- [ ] **Netlify:** Base = `frontend`, build = `npm install && npm run build`, publish = `.`
- [ ] **Netlify:** `SNAKE_WARS_BACKEND_URL` = your Railway backend URL (e.g. `https://xxx.up.railway.app`), or rely on the hardcoded fallback.
- [ ] **CORS:** If your Netlify domain is not `*.netlify.app` or the hardcoded origin, update `ALLOWED_ORIGINS` in `backend/server.js`.
