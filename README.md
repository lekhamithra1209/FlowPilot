# FlowPilot – workflow automation (full stack)

Front end: HTML/CSS/JS (served from `public/`). Back end: Node.js + Express + SQLite, JWT login, REST API.

## Run it
```
npm install
npm start
```
Open http://localhost:3000. The database file is created and filled with sample data on first start.
Demo login (the app signs in automatically): mithra@company.com / password

## What the back end does
- JWT login (`POST /api/auth/login`) and a bearer-token check on every other route
- Rate limiting (120 requests/min per route, 10 login attempts/min) that returns 429
- Workflows: list, create, edit, delete, on/off toggle (`/api/workflows`)
- Execution engine (`engine.js`): runs steps one at a time, checks conditions, fails a step when its
  integration is not connected, and writes a step-by-step log to the `runs` table
- Runs and retry (`/api/runs`, `/api/runs/:id/retry`), integrations (`/api/integrations`),
  dashboard and analytics numbers (`/api/stats`), settings (`/api/settings`)
- Input validation and parameterized SQL queries

## Files
```
server.js   routes, auth, rate limiter
db.js       SQLite schema + sample data
engine.js   workflow execution engine
public/     the web app
```

## Try this
Turn off Gmail in the Integration hub, run "Lead follow-up", and watch the run fail with a clear message in the monitor.

## Before real use
Set `JWT_SECRET` and `PORT` as environment variables, add a real sign-up/login screen, and move to MySQL/Postgres if you need more than one server.
