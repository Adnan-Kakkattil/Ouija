# OUIJA CTF

Ghost-themed Capture The Flag with an interactive Ouija board, team signup, and username-or-email login.

Built as an **Express** Node.js app for **Hostinger Node.js Web Apps** (and local `npm start`).

## Stack

- **Node.js 18–24** (Hostinger-supported range)
- **Express** — serves `public/` + `/api/*`
- **express-session** + file store — cookie sessions
- **bcryptjs** — password hashing
- **JSON files** in `data/` — users, teams, solves (no MySQL required)

## Quick start (local)

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Optional:

```bash
set PORT=3000
set SESSION_SECRET=your-long-random-string
set COOKIE_SECURE=0
npm start
```

On PowerShell:

```powershell
$env:PORT=3000
$env:SESSION_SECRET="change-me"
npm start
```

## Project layout

```
app.js                 # Hostinger entry point (listens on process.env.PORT)
package.json           # start script + engines
public/                # static UI (HTML/CSS/JS, Ouija board, effects)
src/lib/               # JSON store + challenge catalogue
src/routes/            # /api/auth, /api/challenges
data/                  # runtime JSON (gitignored)
sessions/              # session files (gitignored)
```

## Hostinger deployment

Hostinger Node apps need:

1. **Entry file:** `app.js`
2. **Start command:** `npm start` (runs `node app.js`)
3. **Port:** the app uses `process.env.PORT` (required)
4. **Node version:** 18, 20, 22, or 24 — matches `engines` in `package.json`
5. **No build step** for this project (leave build empty / unused)

### Steps

1. Push this repo to GitHub (or zip the project **without** `node_modules/`, `data/*.json`, `sessions/`).
2. In **hPanel → Websites → Add Website → Node.js Apps**.
3. Import the Git repo (or upload the zip with `package.json` at the archive root).
4. Configure:
   - **Node.js version:** `20` (recommended) or `22` / `24`
   - **Entry file:** `app.js`
   - **Install command:** `npm install` (or `npm ci` if you commit `package-lock.json`)
   - **Build command:** leave empty
   - **Start command:** `npm start`
5. Environment variables in Hostinger:

   | Variable | Value |
   |----------|--------|
   | `SESSION_SECRET` | Long random string |
   | `COOKIE_SECURE` | `1` (HTTPS) |
   | `NODE_ENV` | `production` |

6. Deploy / restart the app.
7. Confirm `/api/health` returns `{ "ok": true }`.

### Persistence on shared hosting

User and team data are stored as JSON under `data/`. Sessions under `sessions/`. Both are created at runtime. On Hostinger, ensure the app has write permission to its directory. For multi-instance scaling you would switch to MySQL later; for a single Node process this is enough.

## Auth features

- **Signup:** username, email, passphrase, team dropdown (seeded circles) or **found a new circle**
- **Login:** username **or** email + passphrase
- **Dashboard:** score, circle, Ouija board, standings peek
- **Trials:** challenge list, flag submit (`ouija{...}`)

## API sketch

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | Health check |
| GET | `/api/auth/teams` | Team dropdown |
| POST | `/api/auth/signup` | Create medium + session |
| POST | `/api/auth/login` | Username or email |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/challenges` | Auth required |
| POST | `/api/challenges/:id/submit` | Submit flag |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Production / Hostinger start |
| `npm run dev` | Local start with `--watch` (Node 18+) |

## License

MIT
