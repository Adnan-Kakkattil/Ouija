# OUIJA CTF

Ghost-themed Capture The Flag with an interactive Ouija board, team signup, and username-or-email login.

Built as an **Express** Node.js app for **Docker** (port 80), **Hostinger Node.js Web Apps**, and local `npm start`.

## Docker (port 80)

### 1. Prepare env

```bash
cp .env.example .env
# Edit .env — set at least:
#   MONGODB_URI=mongodb+srv://...
#   MONGODB_DB=lostweeb01_db
#   SESSION_SECRET=long-random-string
#   COOKIE_SECURE=0          # use 1 only behind HTTPS
#   NODE_ENV=production
```

Atlas **Network Access** must allow the Docker host IP (or `0.0.0.0/0`).

### 2. Build the image

```bash
docker build -t ouija-ctf:latest .
```

### 3. Run on port 80

```bash
docker run -d \
  --name ouija-ctf \
  -p 80:80 \
  --env-file .env \
  -e PORT=80 \
  -e HOST=0.0.0.0 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  ouija-ctf:latest
```

Open [http://localhost](http://localhost) (or `http://YOUR_SERVER_IP`).  
Health: [http://localhost/api/health](http://localhost/api/health)

### 4. Update after code changes (rebuild + replace container)

```bash
# Pull / sync your latest files, then:
docker build -t ouija-ctf:latest .
docker stop ouija-ctf
docker rm ouija-ctf
docker run -d \
  --name ouija-ctf \
  -p 80:80 \
  --env-file .env \
  -e PORT=80 \
  -e HOST=0.0.0.0 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  ouija-ctf:latest
```

**One-liner with Compose** (same rebuild behaviour):

```bash
docker compose up -d --build --force-recreate
```

### Useful Docker commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d --build` | Build + start |
| `docker compose up -d --build --force-recreate` | Rebuild image and recreate container after changes |
| `docker compose logs -f` | Follow logs |
| `docker compose down` | Stop and remove container |
| `docker ps` | Confirm `ouija-ctf` is up on `0.0.0.0:80` |
| `curl http://127.0.0.1/api/health` | Quick health check |

### Notes

- The container listens on **port 80 inside**; `-p 80:80` maps it to the host.
- Secrets stay in `.env` (gitignored) — they are **not** baked into the image.
- On plain HTTP, keep `COOKIE_SECURE=0` or logins will not stick. Behind TLS termination, set `COOKIE_SECURE=1`.

## Hostinger Business (Node Web App)

Compatible with **Business Web Hosting** Node.js Web Apps.

### hPanel settings

| Setting | Value |
|---------|--------|
| Framework | **Express.js** (or Other) |
| Node.js version | **20** (preferred) or **18** |
| Entry file | `app.js` |
| Build command | `npm run build` |
| Start command | `npm start` |
| Root | repository root (where `package.json` lives) |

### Environment variables (hPanel → Environment Variables)

| Variable | Example |
|----------|---------|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `MONGODB_DB` | `lostweeb01_db` |
| `SESSION_SECRET` | long random string |
| `COOKIE_SECURE` | `1` |
| `NODE_ENV` | `production` |

### MongoDB Atlas (required)

1. **Network Access** → add `0.0.0.0/0` (allow Hostinger outbound IPs)
2. Use a DB user/password in `MONGODB_URI`

### Important: driver version

Use **`mongodb@6`** (pinned). `mongodb@7` requires Node ≥ 20.19 and crashes on Hostinger Node 18 with `crypto is not defined`.

After changing deps: **Redeploy** (or push to GitHub so Hostinger rebuilds `node_modules`).

## Stack

- **Node.js 18–24** (Hostinger-supported range)
- **Express** — serves `public/` + `/api/*`
- **MongoDB Atlas** — users, teams, solves, login history, sessions
- **express-session** + **connect-mongo** — cookie sessions in MongoDB
- **bcryptjs** — password hashing

## Quick start (local)

1. Copy credentials into place (already present if you have `atlas-credentials.env`):

```bash
# atlas-credentials.env should contain:
# MONGODB_URI=mongodb+srv://...
```

2. Create `.env` from the example (session secret, port):

```bash
copy .env.example .env
```

3. Install and run:

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The app loads `atlas-credentials.env` then `.env` (`.env` wins on conflicts).

## Project layout

```
Dockerfile             # Production image (Node 20, port 80)
docker-compose.yml     # Build + run helper on host :80
app.js                 # Entry point (listens on process.env.PORT)
package.json           # start script + engines
public/                # static UI (HTML/CSS/JS, Ouija board, effects)
src/lib/db.js          # MongoDB connection
src/lib/store.js       # users, teams, solves, logins
src/lib/challenges.js  # challenge catalogue
src/routes/            # /api/auth, /api/challenges, /api/rooms, …
atlas-credentials.env  # Atlas URI (gitignored)
.env                   # local / Docker secrets (gitignored)
```

## MongoDB collections

| Collection | Purpose |
|------------|---------|
| `users` | Mediums (login, score, progress counters) |
| `teams` | Circles (seeded + user-founded) |
| `solves` | Flag submissions / progress |
| `logins` | Login tracking (ip, user-agent, time) |
| `sessions` | express-session store |

## Hostinger deployment

Compatible with **Business Web Hosting** [Node.js Web Apps](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

Hostinger Node apps need:

1. **Framework:** Express.js (or Other)
2. **Entry file:** `app.js`
3. **Start command:** `npm start`
4. **Build command:** `npm run build`
5. **Port:** `process.env.PORT` (do not hardcode; Hostinger injects it)
6. **Bind:** `0.0.0.0`
7. **Node version:** 18, 20, 22, or 24 (prefer **20**)

Build output lives under the domain’s `nodejs` folder; `public_html/.htaccess` is generated by Hostinger to reverse-proxy to your Express process. All `/api/*` and static files are served by this app.

### Environment variables

| Variable | Value |
|----------|--------|
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DB` | `ouija` (or your DB name) |
| `SESSION_SECRET` | Long random string (required in production) |
| `COOKIE_SECURE` | `1` (HTTPS session cookies) |
| `NODE_ENV` | `production` |

Do **not** commit `atlas-credentials.env` or `.env`.

### “Could not open the table” on dashboard

That toast means the browser loaded `dashboard.html` but **`/api/*` did not answer with JSON** (Node process down or still restarting after a GitHub deploy).

1. Open `https://your-domain/api/health` — expect JSON with `"ok":true` and `"build":"rooms-v2"`.
2. If you see HTML `Cannot GET /api/health`, the Node app is not running: hPanel → website → **Running → Restart**, or Redeploy.
3. Wait 1–2 minutes after a push to `main` (auto-deploy recycles the process).
4. Hard-refresh the dashboard (Ctrl+F5). Clients now retry briefly when Hostinger returns HTML 404s during recycle.

### MongoDB Atlas (required)

1. **Network Access** → add `0.0.0.0/0` (allow Hostinger outbound IPs)
2. Use a DB user/password in `MONGODB_URI`

## Auth features

- **Signup:** username, email, passphrase, team dropdown or found a new circle
- **Login:** username **or** email + passphrase (recorded in `logins`)
- **Dashboard:** score, circle, Ouija board, standings
- **Trials:** challenge list, flag submit (`ouija{...}`)

## API sketch

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | Health + DB stats |
| GET | `/api/auth/teams` | Team dropdown |
| POST | `/api/auth/signup` | Create medium + session |
| POST | `/api/auth/login` | Username or email |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user + progress |
| GET | `/api/challenges` | Auth required |
| POST | `/api/challenges/:id/submit` | Submit flag |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Production / Hostinger / Docker `CMD` |
| `npm run dev` | Local start with `--watch` (Node 18+) |
| `docker compose up -d --build` | Build image and run on port 80 |

## License

MIT
