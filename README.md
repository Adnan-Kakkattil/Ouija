# OUIJA CTF

Ghost-themed Capture The Flag with an interactive Ouija board, team signup, and username-or-email login.

Built as an **Express** Node.js app for **Hostinger Node.js Web Apps** (and local `npm start`).

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
app.js                 # Hostinger entry point (listens on process.env.PORT)
package.json           # start script + engines
public/                # static UI (HTML/CSS/JS, Ouija board, effects)
src/lib/db.js          # MongoDB connection
src/lib/store.js       # users, teams, solves, logins
src/lib/challenges.js  # challenge catalogue
src/routes/            # /api/auth, /api/challenges
atlas-credentials.env  # Atlas URI (gitignored)
.env                   # local secrets (gitignored)
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

Hostinger Node apps need:

1. **Entry file:** `app.js`
2. **Start command:** `npm start`
3. **Port:** `process.env.PORT`
4. **Node version:** 18, 20, 22, or 24

### Environment variables

| Variable | Value |
|----------|--------|
| `MONGODB_URI` | Atlas connection string (include DB name `/ouija`) |
| `MONGODB_DB` | `ouija` (optional if URI already has a path) |
| `SESSION_SECRET` | Long random string |
| `COOKIE_SECURE` | `1` (HTTPS) |
| `NODE_ENV` | `production` |

Do **not** commit `atlas-credentials.env` or `.env`.

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
| `npm start` | Production / Hostinger start |
| `npm run dev` | Local start with `--watch` (Node 18+) |

## License

MIT
