# Cloudflare Tunnel – step-by-step (free, no domain)

Use this to expose your Snake Wars backend over **HTTPS/WSS** so the Netlify frontend can connect without mixed-content errors. No domain or open ports required.

---

## Prerequisites

- Backend running on your VPS (e.g. `pm2` with Node on port 3000).
- SSH access to the VPS.

---

## Step 1 – SSH into your VPS

Connect as usual, e.g.:

```bash
ssh root@46.225.187.250
```

(Use your actual user/IP if different.)

---

## Step 2 – Install cloudflared (one-time)

On **Debian/Ubuntu** (64-bit):

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

Check it’s installed:

```bash
cloudflared --version
```

---

## Step 3 – Start the tunnel

Run (replace `3000` if your backend uses another port):

```bash
cloudflared tunnel --url http://localhost:3000
```

**Leave this terminal open.** After a few seconds you’ll see something like:

```text
Your quick Tunnel has been created! Visit it at:
https://something-random-here.trycloudflare.com
```

That URL is your backend over HTTPS. Copy it (no trailing slash).

---

## Step 4 – Update Netlify

1. Open **Netlify** → your site → **Site configuration** → **Environment variables**.
2. Set **`SNAKE_WARS_BACKEND_URL`** to the tunnel URL, e.g.  
   `https://something-random-here.trycloudflare.com`
3. **Trigger a new deploy** (Deploys → Trigger deploy → Deploy site) so the frontend is rebuilt with this URL.

---

## Step 5 – Deploy backend CORS change (if not done yet)

The backend must allow the tunnel origin. The repo already includes:

- `*.trycloudflare.com` in `ALLOWED_ORIGINS` in `backend/server.js`.

If you pulled that change, restart the backend on the VPS:

```bash
pm2 restart snake-wars-backend
```

(Use your actual pm2 app name if different.)

---

## Step 6 – Keep the tunnel running

- **While testing:** Leave the terminal with `cloudflared tunnel --url ...` open.
- **In the background (same session):**

  ```bash
  nohup cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
  ```

  Wait a few seconds, then read the URL from the log:

  ```bash
  sleep 5
  cat /tmp/cloudflared.log
  ```

- **Permanent (survives reboot):** Run the tunnel under **pm2** (the `--` passes the rest to cloudflared):

  ```bash
  pm2 start cloudflared --name tunnel -- tunnel --url http://localhost:3000
  pm2 save
  pm2 startup   # if you want it to start on boot
  ```

  Get the URL from pm2 logs:

  ```bash
  pm2 logs tunnel
  ```

  Copy the `https://....trycloudflare.com` URL and update **`SNAKE_WARS_BACKEND_URL`** in Netlify, then redeploy.

---

## Important: quick tunnel URL changes

With the **quick** tunnel (`cloudflared tunnel --url ...`), the URL **changes every time you restart** cloudflared. So whenever you restart the tunnel:

1. Get the new URL from the log or `pm2 logs tunnel`.
2. Set **`SNAKE_WARS_BACKEND_URL`** in Netlify to that new URL.
3. Trigger a new deploy so the frontend uses the new backend URL.

For a **stable** URL without buying a domain, you can later set up a **named** Cloudflare Tunnel (free) and get a fixed subdomain.

---

## Checklist

- [ ] Backend running on VPS (e.g. port 3000).
- [ ] cloudflared installed; tunnel started and URL copied.
- [ ] `SNAKE_WARS_BACKEND_URL` in Netlify set to `https://xxx.trycloudflare.com`.
- [ ] New Netlify deploy triggered.
- [ ] Backend restarted (so CORS allows `*.trycloudflare.com`).
- [ ] Tunnel running in background or under pm2.

After that, open your Netlify site and play; the client will connect over **wss://** to the tunnel and mixed content will be resolved.
