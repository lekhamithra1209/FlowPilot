const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const engine = require('./engine');

const PORT = process.env.PORT || 3000;
// JWT secret: use the environment variable, or create one once and keep it in a file.
const SECRET_FILE = path.join(__dirname, '.jwt-secret');
const SECRET = process.env.JWT_SECRET || (fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8')
  : (() => { const s = crypto.randomBytes(48).toString('hex'); fs.writeFileSync(SECRET_FILE, s); return s; })());

const app = express();
app.use(express.json({ limit: '100kb' }));

// --- in-memory rate limiter (per IP, per route group, per minute) ---
const hits = new Map();
function limit(max) {
  return (req, res, next) => {
    const key = req.ip + '|' + req.originalUrl.split('?')[0].split('/').slice(0, 4).join('/');
    const now = Date.now(), w = hits.get(key) || { n: 0, t: now };
    if (now - w.t > 60000) { w.n = 0; w.t = now; }
    w.n++; hits.set(key, w);
    if (w.n > max) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    next();
  };
}
setInterval(() => hits.clear(), 5 * 60000).unref();

// --- accounts: anyone can sign up with their email ---
const sign = u => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });
const userOut = u => ({ id: u.id, name: u.name, email: u.email });
app.post('/api/auth/signup', limit(10), (req, res) => {
  const name = String((req.body || {}).name || '').trim().slice(0, 60);
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const password = String((req.body || {}).password || '');
  if (!name) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
    return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  const id = db.prepare('INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 10), new Date().toISOString()).lastInsertRowid;
  db.seedUser(id);
  res.status(201).json({ token: sign({ id }), user: { id, name, email } });
});
app.post('/api/auth/login', limit(10), (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !bcrypt.compareSync(String((req.body || {}).password || ''), u.password_hash))
    return res.status(401).json({ error: 'Email or password is not right.' });
  res.json({ token: sign(u), user: userOut(u) });
});

function auth(req, res, next) {
  try {
    const p = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(p.id);
    if (!u) throw new Error('no user');
    req.user = u; next();
  } catch { res.status(401).json({ error: 'Please sign in again.' }); }
}
const api = express.Router();
api.use(limit(150), auth);
api.get('/me', (req, res) => res.json(userOut(req.user)));

// --- workflows (every query is limited to the signed-in user's rows) ---
function stats(id) {
  const r = db.prepare(`SELECT COUNT(*) runs, SUM(status='done') ok FROM runs WHERE workflow_id=? AND status!='running'`).get(id);
  return { runs: r.runs, success: r.runs ? Math.round(100 * (r.ok || 0) / r.runs) : 100 };
}
const wfOut = w => ({ id: w.id, name: w.name, trigger: w.trigger_name, team: w.team, description: w.description,
  badge: w.badge, tint: w.tint, icon: w.icon, active: !!w.active, steps: JSON.parse(w.steps), ...stats(w.id) });
const getWf = (req, id) => db.prepare('SELECT * FROM workflows WHERE id=? AND user_id=?').get(id, req.user.id);
function validSteps(s) {
  return Array.isArray(s) && s.length > 0 && s.length <= 20 &&
    s.every(x => ['trigger','condition','action'].includes(x.type) && typeof x.name === 'string' && x.name.length <= 80);
}
api.get('/workflows', (req, res) => res.json(db.prepare('SELECT * FROM workflows WHERE user_id=? ORDER BY id').all(req.user.id).map(wfOut)));
api.post('/workflows', (req, res) => {
  const { name, steps } = req.body || {};
  if (!name || typeof name !== 'string' || !validSteps(steps)) return res.status(400).json({ error: 'A name and at least one valid step are required.' });
  const id = db.prepare(`INSERT INTO workflows(user_id,name,trigger_name,team,description,badge,tint,icon,active,steps) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, name.slice(0, 80), steps[0].name, 'Operations', 'Custom workflow.', 'New', 'lav', 'flow', 1, JSON.stringify(steps)).lastInsertRowid;
  res.status(201).json(wfOut(getWf(req, id)));
});
api.put('/workflows/:id', (req, res) => {
  const w = getWf(req, req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found.' });
  const { name, steps } = req.body || {};
  if (!validSteps(steps)) return res.status(400).json({ error: 'Steps are not valid.' });
  db.prepare('UPDATE workflows SET name=?, trigger_name=?, steps=? WHERE id=?').run(String(name || w.name).slice(0, 80), steps[0].name, JSON.stringify(steps), w.id);
  res.json(wfOut(getWf(req, w.id)));
});
api.patch('/workflows/:id/toggle', (req, res) => {
  const w = getWf(req, req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found.' });
  db.prepare('UPDATE workflows SET active=? WHERE id=?').run(w.active ? 0 : 1, w.id);
  res.json(wfOut(getWf(req, w.id)));
});
api.delete('/workflows/:id', (req, res) => {
  const w = getWf(req, req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found.' });
  db.prepare('DELETE FROM workflows WHERE id=?').run(w.id); res.status(204).end();
});
api.post('/workflows/:id/run', (req, res) => {
  const w = getWf(req, req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found.' });
  res.status(202).json({ runId: engine.start(w) });
});

// --- runs ---
const runOut = r => ({ id: r.id, workflowId: r.workflow_id, workflow: r.workflow_name, startedAt: r.started_at,
  seconds: +(r.duration_ms / 1000).toFixed(1), status: r.status, log: JSON.parse(r.log) });
api.get('/runs', (req, res) => res.json(db.prepare('SELECT * FROM runs WHERE user_id=? ORDER BY id DESC LIMIT 25').all(req.user.id).map(runOut)));
api.post('/runs/:id/retry', (req, res) => {
  const r = db.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  const w = r && getWf(req, r.workflow_id);
  if (!w) return res.status(404).json({ error: 'That workflow no longer exists.' });
  res.status(202).json({ runId: engine.start(w) });
});

// --- integrations ---
const inOut = i => ({ id: i.id, name: i.name, category: i.category, icon: i.icon, tint: i.tint, connected: !!i.connected });
api.get('/integrations', (req, res) => res.json(db.prepare('SELECT * FROM integrations WHERE user_id=? ORDER BY id').all(req.user.id).map(inOut)));
api.patch('/integrations/:id/toggle', (req, res) => {
  const i = db.prepare('SELECT * FROM integrations WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!i) return res.status(404).json({ error: 'Integration not found.' });
  db.prepare('UPDATE integrations SET connected=? WHERE id=?').run(i.connected ? 0 : 1, i.id);
  res.json(inOut(db.prepare('SELECT * FROM integrations WHERE id=?').get(i.id)));
});

// --- dashboard + analytics ---
api.get('/stats', (req, res) => {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const rows = db.prepare(`SELECT * FROM runs WHERE user_id=? AND started_at>=? AND status!='running'`).all(req.user.id, since);
  const days = [], names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(Date.now() - d * 864e5), key = day.toISOString().slice(0, 10);
    const rs = rows.filter(r => r.started_at.slice(0, 10) === key);
    days.push({ label: names[day.getUTCDay()], runs: rs.length, success: rs.length ? Math.round(100 * rs.filter(r => r.status === 'done').length / rs.length) : 100 });
  }
  const by = {}; rows.forEach(r => by[r.workflow_name] = (by[r.workflow_name] || 0) + 1);
  res.json({
    activeWorkflows: db.prepare('SELECT COUNT(*) c FROM workflows WHERE user_id=? AND active=1').get(req.user.id).c,
    runsThisWeek: rows.length, failed: rows.filter(r => r.status === 'failed').length,
    avgSeconds: rows.length ? +(rows.reduce((a, r) => a + r.duration_ms, 0) / rows.length / 1000).toFixed(1) : 0,
    days, byWorkflow: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, runs]) => ({ name, runs }))
  });
});

// --- settings ---
api.get('/settings', (req, res) => {
  const u = req.user;
  res.json({ name: u.name, email: u.email, emailOnFail: !!u.email_on_fail, autoRetry: !!u.auto_retry, dailySummary: !!u.daily_summary });
});
api.put('/settings', (req, res) => {
  const b = req.body || {}, email = String(b.email || '').trim().toLowerCase();
  if (!String(b.name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a name and a valid email.' });
  const taken = db.prepare('SELECT id FROM users WHERE email=? AND id!=?').get(email, req.user.id);
  if (taken) return res.status(409).json({ error: 'Another account already uses that email.' });
  db.prepare('UPDATE users SET name=?, email=?, email_on_fail=?, auto_retry=?, daily_summary=? WHERE id=?')
    .run(String(b.name).trim().slice(0, 60), email, +!!b.emailOnFail, +!!b.autoRetry, +!!b.dailySummary, req.user.id);
  res.json({ ok: true });
});

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong on our side.' }); });

db.ready.then(() => {
  const server = app.listen(PORT, () => console.log(`\n  FlowPilot is running.\n  Open http://localhost:${PORT} in your browser.\n`));
  server.on('error', e => {
    if (e.code === 'EADDRINUSE') console.error(`\n  Port ${PORT} is already in use. Close the other app, or use another port:\n    Mac/Linux:  PORT=3001 npm start\n    Windows:    set PORT=3001 && npm start\n`);
    else console.error(e);
    process.exit(1);
  });
}).catch(e => { console.error('Could not start the database:', e); process.exit(1); });
