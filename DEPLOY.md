# Deployment: Netlify + Backend (VPS or Railway)

Snake Wars is split into **frontend** (Netlify) and **backend** (your VPS e.g. Hetzner, or Railway). The Empire game and all other games use the same backend.

---

## Pre-deploy checklist

- [ ] **Backend** is running on the VPS (pm2 or similar) and reachable at `http://YOUR_IP:3000` (or your domain).
- [ ] **Netlify** has env var `SNAKE_WARS_BACKEND_URL` set to your backend URL (e.g. `http://46.225.187.250:3000`). Without this, the frontend still uses the hardcoded fallback (Railway URL).
- [ ] **CORS**: Backend allows your frontend origin. The code already allows `*.netlify.app` and the VPS IP; if you use a **custom domain** for the frontend, add it to `ALLOWED_ORIGINS` in `backend/server.js`.
- [ ] **HTTPS / mixed content**: If the frontend is on **HTTPS** (Netlify) and the backend is **HTTP**, browsers **block** the WebSocket (mixed content). The backend must be available over **HTTPS** so Socket.IO can use **WSS**. See **[Backend over HTTPS (VPS)](#backend-over-https-vps)** below.

---

## Backend over HTTPS (VPS)

When the frontend is on HTTPS (e.g. Netlify), the backend URL must be **https://** so the browser allows **wss://**. Two practical options:

### Option A: Caddy (recommended – auto HTTPS)

1. **Domain**: Point a domain or subdomain (e.g. `api.yourdomain.com`) to your VPS IP with an A record.
2. **Install Caddy** on the VPS (e.g. `apt install caddy` on Debian/Ubuntu).
3. **Configure** (e.g. `/etc/caddy/Caddyfile`):

   ```text
   api.yourdomain.com {
       reverse_proxy localhost:3000
   }
   ```

4. **Restart Caddy**: `systemctl reload caddy`. Caddy gets a Let's Encrypt certificate automatically.
5. **Firewall**: Open 80 and 443: `ufw allow 80; ufw allow 443; ufw reload`.
6. **Netlify**: Set `SNAKE_WARS_BACKEND_URL=https://api.yourdomain.com` (no port; 443 is default). Redeploy.

Socket.IO will use `wss://api.yourdomain.com` and mixed content is resolved.

### Option B: Nginx + Certbot

1. Point a domain (e.g. `api.yourdomain.com`) to your VPS IP.
2. Install nginx and certbot: `apt install nginx certbot python3-certbot-nginx`.
3. Create a server block for `api.yourdomain.com` that proxies to `http://127.0.0.1:3000` (including WebSocket upgrade headers).
4. Run `certbot --nginx -d api.yourdomain.com` to get SSL.
5. Set `SNAKE_WARS_BACKEND_URL=https://api.yourdomain.com` in Netlify and redeploy.

Example nginx location for the backend and WebSocket:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### If you don’t have a domain

**Step-by-step (free, no domain):** See **[docs/CLOUDFLARE-TUNNEL-SETUP.md](docs/CLOUDFLARE-TUNNEL-SETUP.md)** for installing cloudflared, starting the tunnel, and setting `SNAKE_WARS_BACKEND_URL` in Netlify. The backend already allows `*.trycloudflare.com` in CORS.

---

## Backend (VPS or Railway)

### How the Empire database works

- **No separate DB server.** Empire uses **SQLite** (file-based) via `better-sqlite3`.
- **Setup is automatic:** On first request, the backend opens the DB file, runs schema creation (`ensureSchema`) and universe bootstrap (450 empty slots). No migrations or manual setup.
- **Where the file lives:** Controlled by `EMPIRE_DB_PATH`. Default (no env var) = `empire.db` next to the code (e.g. inside the container at `/app/empire/empire.db`).
- **Docker:** The repo includes a `Dockerfile` that builds the backend. Railway can use it (set “Dockerfile” as build type and root to repo). The Dockerfile installs build tools so `better-sqlite3` compiles on Alpine.

### Persistence (surviving server restarts)

- **Why data is lost:** The default DB path is next to the code (e.g. `backend/empire/empire.db`). When you run in **Docker or Railway**, the container filesystem is **ephemeral**: every restart/redeploy creates a new container and the file is gone.
- **Step-by-step guide:** See **[docs/EMPIRE-PERSISTENCE.md](docs/EMPIRE-PERSISTENCE.md)** for exact steps for: local Node, local Docker, and Railway.
- **Short version:** Local Node → run from `backend/` and data persists. Docker/Railway → add a volume (e.g. mount path `/data`), set `EMPIRE_DB_PATH=/data/empire.db`, redeploy. The server logs `[Empire] Database path: ...` on first use so you can confirm the path.

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
