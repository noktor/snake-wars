# snake-wars
A multiplayer snake game.

## Deployment (frontend + backend split)

- **Frontend** → [Netlify](https://netlify.com) — `netlify.toml` tells Netlify to use **`frontend/`** only (base + publish).
- **Backend** → [Railway](https://railway.app) — **`Dockerfile`** at repo root builds and runs only **`backend/`**.

### 1. Deploy backend on Railway

- Connect this repo to Railway and deploy from the **root** of the repo.
- Railway will use the **Dockerfile** and build/run only the backend. No Root Directory change needed.
- After deploy, copy your backend **public URL** (e.g. `https://your-app.up.railway.app`).

### 2. Deploy frontend on Netlify

- Connect this repo to Netlify. **`netlify.toml`** sets `base = "frontend"` and `publish = "."`, so Netlify builds and deploys only the `frontend/` folder.

### 3. Point the frontend at the backend

- In the **frontend** (e.g. in `frontend/index.html`), set the backend URL so the Netlify site talks to Railway:

```html
<script>window.SNAKE_WARS_BACKEND_URL = 'https://your-app.up.railway.app';</script>
```

- Replace `https://your-app.up.railway.app` with your real Railway backend URL.
- Redeploy the frontend on Netlify so the change is live.

### 4. Local development

- **Backend:** `cd backend && npm install && npm start` (runs on port 3000).
- **Frontend:** from the repo root run:
  ```bash
  npm run frontend
  ```
  This serves `frontend/` at **http://localhost:8080**. Open that URL in the browser. On localhost the frontend automatically uses `http://localhost:3000` for the backend, so start the backend first if you want to play locally.
