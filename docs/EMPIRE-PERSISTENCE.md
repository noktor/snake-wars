# Empire game: step-by-step persistence guide

When you **restart the server**, Empire’s database can be lost if it’s stored on an ephemeral filesystem (e.g. inside a Docker container). This guide shows exactly what to do so your universe **persists** across restarts.

---

## Choose your setup

- **A. I run the backend with Node on my machine** (e.g. `cd backend && node server.js`)  
  → See [Option A: Local Node](#option-a-local-node) below.

- **B. I run the backend with Docker on my machine** (e.g. `docker build` / `docker run`)  
  → See [Option B: Local Docker](#option-b-local-docker) below.

- **C. I deploy the backend to Railway** (or another cloud that uses containers)  
  → See [Option C: Railway](#option-c-railway) below.

- **D. I run the backend on a VPS** (e.g. Hetzner, DigitalOcean, any Linux server)  
  → See [Option D: VPS (e.g. Hetzner)](#option-d-vps-eg-hetzner) below.

---

## Option A: Local Node

You run the server directly with Node (no Docker).

### Step 1: Run the server from the `backend` folder

From your project root:

```bash
cd backend
node server.js
```

The database file is created at `backend/empire/empire.db`. That folder is on your real disk, so **data already persists** when you stop and start the server again.

### Step 2 (optional): Use a separate data folder

If you prefer the DB in a dedicated folder:

1. Create a folder (e.g. `backend/data`).
2. Before starting the server, set the environment variable:
   - **Windows (PowerShell):** `$env:EMPIRE_DB_PATH = ".\data\empire.db"`
   - **Windows (CMD):** `set EMPIRE_DB_PATH=.\data\empire.db`
   - **Mac/Linux:** `export EMPIRE_DB_PATH=./data/empire.db`
3. From `backend/`, run: `node server.js`

The app will create `data/` if it doesn’t exist. The DB file will be `backend/data/empire.db` and will persist across restarts.

**Summary for Option A:** Run from `backend/`; no extra steps required for persistence. Optionally set `EMPIRE_DB_PATH` to use a `data/` folder.

---

## Option B: Local Docker

You build and run the backend in Docker on your machine.

### Step 1: Create a folder on your machine for the DB

Example (Windows PowerShell):

```powershell
mkdir C:\snake-wars-data
```

Example (Mac/Linux):

```bash
mkdir -p ~/snake-wars-data
```

This folder will hold the DB file and must be **outside** the container.

### Step 2: Run the container with a volume

When you run the container, mount that folder **inside** the container (e.g. at `/data`) and tell the app to use it.

**If you use `docker run`** (replace `your-image-name` and the path with your values):

- **Windows:**  
  `docker run -p 3000:3000 -e EMPIRE_DB_PATH=/data/empire.db -v C:\snake-wars-data:/data your-image-name`

- **Mac/Linux:**  
  `docker run -p 3000:3000 -e EMPIRE_DB_PATH=/data/empire.db -v ~/snake-wars-data:/data your-image-name`

**If you use `docker-compose`**, add something like this to your compose file:

```yaml
services:
  backend:
    image: your-image-name
    ports:
      - "3000:3000"
    environment:
      - EMPIRE_DB_PATH=/data/empire.db
    volumes:
      - ./snake-wars-data:/data
```

Then run: `docker-compose up`.

### Step 3: Restart and confirm

1. Stop the container (Ctrl+C or `docker stop`).
2. Start it again with the **same** `-v` / `volumes` and `EMPIRE_DB_PATH=/data/empire.db`.
3. In the server logs you should see:  
   `[Empire] Database path: /data/empire.db (set EMPIRE_DB_PATH for persistent storage)`  
4. Open the game and check that your planets/players are still there.

**Summary for Option B:** Create a host folder, mount it into the container at `/data`, set `EMPIRE_DB_PATH=/data/empire.db`, and always run with that volume.

---

## Option C: Railway

You deploy the backend to Railway (or a similar platform that runs your app in a container).

### Step 1: Open your project and the backend service

1. Go to [railway.app](https://railway.app) and open your project.
2. Click the service that runs the Snake Wars **backend** (the one that uses the Dockerfile or runs `node server.js`).

### Step 2: Add a volume

1. In the service, open the **Variables** or **Settings** tab (Railway may show “Volumes” in the top tabs or under Settings).
2. Find **Volumes** (or “Add Volume” / “Mount Volume”).
3. Click **Add Volume** (or equivalent).
4. Set the **mount path** to:  
   **`/data`**  
   (This is the path *inside* the container where the volume will appear.)
5. Save. Railway will create a volume and attach it to this service.

### Step 3: Set the environment variable

1. In the same service, open the **Variables** tab (environment variables).
2. Add a new variable:
   - **Name:** `EMPIRE_DB_PATH`
   - **Value:** `/data/empire.db`
3. Save. Railway will redeploy the service.

### Step 4: Check that it works

1. After the redeploy, open the **Deploy** or **Logs** tab.
2. When the app starts and someone uses Empire (or the tick runs), you should see in the logs:  
   `[Empire] Database path: /data/empire.db (set EMPIRE_DB_PATH for persistent storage)`
3. Play the game (create a planet, build something).
4. Trigger a **redeploy** or **restart** the service (e.g. from the Railway dashboard).
5. Open the game again. Your planets and progress should still be there.

**Summary for Option C:** Add a volume with mount path `/data`, set `EMPIRE_DB_PATH=/data/empire.db`, redeploy, and check the log line and in-game data after a restart.

---

## Option D: VPS (e.g. Hetzner)

You have a Linux server (Hetzner, DigitalOcean, etc.) and run the backend there. The server disk is **persistent**, so you don’t need Railway-style volumes.

### Option D1: Run Node directly on the VPS (recommended)

No Docker: you run `node server.js` on the server. The DB file is a normal file on disk and **persists** across restarts.

1. **Copy your project** to the VPS (e.g. `git clone` or rsync).
2. On the VPS, install Node.js (e.g. v18 or v20).
3. From the project root:
   ```bash
   cd backend
   npm install
   node server.js
   ```
   Or run it in the background with **pm2** so it restarts on reboot:
   ```bash
   npm install -g pm2
   cd backend
   npm install
   pm2 start server.js --name snake-wars-backend
   pm2 save
   pm2 startup   # follow the command it prints so it starts on boot
   ```
4. The DB is at `backend/empire/empire.db` on the VPS. It **persists** when you restart the process or the server. No extra config needed.

**Optional:** To keep the DB in a dedicated folder (e.g. `/var/lib/snake-wars/empire.db`), create the dir and set the env var before starting:
```bash
sudo mkdir -p /var/lib/snake-wars
sudo chown "$USER" /var/lib/snake-wars
export EMPIRE_DB_PATH=/var/lib/snake-wars/empire.db
node server.js
```
(With pm2, set `EMPIRE_DB_PATH` in the app’s env or in an ecosystem file.)

### Option D2: Run with Docker on the VPS

If you run the backend in Docker on the VPS, the container filesystem is still ephemeral. Use a **bind mount** so the DB lives on the VPS disk.

1. On the VPS, create a folder for the DB:
   ```bash
   mkdir -p /opt/snake-wars-data
   ```
2. When you run the container, mount that folder and set the env var:
   ```bash
   docker run -d -p 3000:3000 \
     -e EMPIRE_DB_PATH=/data/empire.db \
     -v /opt/snake-wars-data:/data \
     --restart unless-stopped \
     your-backend-image
   ```
3. The DB file will be at `/opt/snake-wars-data/empire.db` on the VPS and will persist across container restarts and server reboots.

**Summary for Option D:** On a VPS, running Node directly means the DB already persists. If you use Docker, bind-mount a host folder (e.g. `/opt/snake-wars-data`) to `/data` and set `EMPIRE_DB_PATH=/data/empire.db`.

---

## Quick reference

| Setup           | What to do |
|----------------|------------|
| **Local Node** | Run `node server.js` from `backend/`. DB is `backend/empire/empire.db` and persists. Optional: set `EMPIRE_DB_PATH=./data/empire.db` to use a `data/` folder. |
| **Local Docker** | Create a folder on your machine. Run the container with `-v /your/folder:/data` and `-e EMPIRE_DB_PATH=/data/empire.db`. |
| **Railway**    | In the backend service: add a volume with mount path `/data`, set variable `EMPIRE_DB_PATH=/data/empire.db`, then redeploy. |
| **VPS (Hetzner etc.)** | Run Node directly from `backend/` (e.g. with pm2): DB persists automatically. With Docker: bind-mount a host folder to `/data` and set `EMPIRE_DB_PATH=/data/empire.db`. |

If something doesn’t work, check the server logs for the line starting with `[Empire] Database path:` to see where the DB file is actually being created.
