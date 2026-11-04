# FlowPilot – workflow automation (full stack)

Front end: HTML/CSS/JS in `public/`. Back end: Node.js + Express, SQLite (pure JavaScript, nothing to compile), JWT login.

## Run it (needs Node.js 18 or newer: https://nodejs.org)
1. Unzip, then open a terminal INSIDE the `flowpilot` folder (the one with `package.json`).
2. Run:
```
npm install
npm start
```
3. Open http://localhost:3000

If port 3000 is busy: `PORT=3001 npm start` (Mac/Linux) or `set PORT=3001 && npm start` (Windows cmd).

## Accounts
Anyone can click "Create an account" with their name, email and a password (8+ characters), then sign in later with the same email and password.
Each account has its own workflows, runs, integrations and settings. A new account starts with sample data so the screens are not empty.

## What the back end does
- Sign up / sign in with bcrypt-hashed passwords and JWT tokens (7 days)
- Every API route needs the token, and every query only touches the signed-in user's rows
- Rate limiting (150 requests/min per route group, 10 sign-in or sign-up attempts/min), returns 429
- Workflows: list, create, edit, delete, on/off (`/api/workflows`)
- Execution engine (`engine.js`): runs steps in order, checks conditions, fails a step when its integration is not connected, saves a step-by-step log
- Runs + retry, integrations, dashboard/analytics numbers, settings
- Input validation and parameterized SQL

## Files
```
server.js   routes, auth, rate limiter
db.js       database + starter data for new accounts
engine.js   workflow execution engine
public/     the web app (login, dashboard, library, builder, integrations, monitor, analytics, settings)
```

## Before putting it online
Set `JWT_SECRET` (a long random string) and `PORT` as environment variables. The database is the file `flowpilot-data.db`; on a host with a temporary disk, move to a hosted database (Postgres/MySQL).
