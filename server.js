const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const engine = require('./engine');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '100kb' }));

// --- simple in-memory rate limiter (per IP, per minute) ---
const hits = new Map();
function limit(max) {
  return (req, res, next) => {
    const key = req.ip + req.baseUrl + req.path.split('/')[1];
    const now = Date.now(), w = hits.get(key) || { n: 0, t: now };
    if (now - w.t > 60000) { w.n = 0; w.t = now; }
    w.n++; hits.set(key, w);
    res.set('X-RateLimit-Remaining', Math.max(0, max - w.n));
    if (w.n > max) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    next();
  };
}
setInterval(() => hits.clear(), 5 * 60000).unref();

// --- auth ---
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try { req.user = jwt.verify(h.replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Please sign in again.' }); }
}
app.post('/api/auth/login', limit(10), (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || ''));
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'Email or password is not right.' });
  const token = jwt.sign({ id: u.id, email: u.email }, SECRET, { expiresIn: '8h' });
  res.json({ token, user: { name: u.name, email: u.email } });
});

const api = express.Router();
api.use(limit(120), auth);

// --- workflows ---
const wfOut = w => ({ id: w.id, name: w.name, trigger: w.trigger_name, team: w.team, description: w.description,
  badge: w.badge, tint: w.tint, icon: w.icon, active: !!w.active, steps: JSON.parse(w.steps), ...stats(w.id) });
function stats(id) {
  const r = db.prepare(`SELECT COUNT(*) runs, SUM(status='done') ok FROM runs WHERE workflow_id=? AND status!='running'`).get(id);
  return { runs: r.runs, success: r.runs ? Math.round(100 * (r.ok || 0) / r.runs) : 100 };
}
function validSteps(s) {
  return Array.isArray(s) && s.length > 0 && s.length <= 20 &&
    s.every(x => ['trigger','condition','action'].includes(x.type) && typeof x.name === 'string' && x.name.length <= 80);
}
api.get('/workflows', (req, res) => res.json(db.prepare('SELECT * FROM workflows ORDER BY id').all().map(wfOut)));
api.post('/workflows', (req, res) => {
  const { name, steps } = req.body || {};
  if (!name || typeof name !== 'string' || !validSteps(steps)) return res.status(400).json({ error: 'A name and at least one valid step are required.' });
  const i = db.prepare(`INSERT INTO workflows(name,trigger_name,team,description,badge,tint,icon,active,steps) VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(name.slice(0, 80), steps[0].name, req.body.team || 'Operations', req.body.description || 'Custom workflow.', 'New', 'lav', 'flow', 1, JSON.stringify(steps));
  res.status(201).json(wfOut(db.prepare('SELECT * FROM workflows WHERE id=?').get(i.lastInsertRowid)));
});
api.put('/workflows/:id', (req, res) => {
  const w = db.prepare('SELECT * FROM workflows WHERE id=?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found.' });
  const { name, steps } = req.body || {};
  if (!validSteps(steps)) return res.status(400).json({ error: 'Steps are not valid.' });
  db.prepare('UPDATE workflows SET name=?, trigger_name=?, steps=? WHERE id=?').run(String(name || w.name).slice(0, 80), steps[0].name, JSON.stringify(steps), w.id);
  res.json(wfOut(db.prepare('SELECT * FROM workflows WHERE id=?').get(w.id)));
});
api.patch('/workflows/:id/toggle', (req, res) => {
  const w = db.prepare('SELECT * FROM workflows WHERE id=?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found.' });
  db.prepare('UPDATE workflows SET active=? WHERE id=?').run(w.active ? 0 : 1, w.id);
  res.json(wfOut(db.prepare('SELECT * FROM workflows WHERE id=?').get(w.id)));
});
api.delete('/workflows/:id', (req, res) => {
  db.prepare('DELETE FROM workflows WHERE id=?').run(req.params.id); res.status(204).end();
});
api.post('/workflows/:id/run', (req, res) => {
  const w = db.prepare('SELECT * FROM workflows WHERE id=?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found.' });
  res.status(202).json({ runId: engine.start(w) });
});

// --- runs ---
const runOut = r => ({ id: r.id, workflowId: r.workflow_id, workflow: r.workflow_name, startedAt: r.started_at,
  seconds: +(r.duration_ms / 1000).toFixed(1), status: r.status, log: JSON.parse(r.log) });
api.get('/runs', (req, res) => res.json(db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 25').all().map(runOut)));
api.post('/runs/:id/retry', (req, res) => {
  const r = db.prepare('SELECT * FROM runs WHERE id=?').get(req.params.id);
  const w = r && db.prepare('SELECT * FROM workflows WHERE id=?').get(r.workflow_id);
  if (!w) return res.status(404).json({ error: 'Run not found.' });
  res.status(202).json({ runId: engine.start(w) });
});

// --- integrations ---
const inOut = i => ({ id: i.id, name: i.name, category: i.category, icon: i.icon, tint: i.tint, connected: !!i.connected });
api.get('/integrations', (req, res) => res.json(db.prepare('SELECT * FROM integrations ORDER BY id').all().map(inOut)));
api.patch('/integrations/:id/toggle', (req, res) => {
  const i = db.prepare('SELECT * FROM integrations WHERE id=?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Integration not found.' });
  db.prepare('UPDATE integrations SET connected=? WHERE id=?').run(i.connected ? 0 : 1, i.id);
  res.json(inOut(db.prepare('SELECT * FROM integrations WHERE id=?').get(i.id)));
});

// --- dashboard + analytics numbers ---
api.get('/stats', (req, res) => {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const rows = db.prepare(`SELECT * FROM runs WHERE started_at>=? AND status!='running'`).all(since);
  const days = [], names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(Date.now() - d * 864e5), key = day.toISOString().slice(0, 10);
    const rs = rows.filter(r => r.started_at.slice(0, 10) === key);
    days.push({ label: names[day.getUTCDay()], runs: rs.length,
      success: rs.length ? Math.round(100 * rs.filter(r => r.status === 'done').length / rs.length) : 100 });
  }
  const byWf = {};
  rows.forEach(r => byWf[r.workflow_name] = (byWf[r.workflow_name] || 0) + 1);
  res.json({
    activeWorkflows: db.prepare('SELECT COUNT(*) c FROM workflows WHERE active=1').get().c,
    runsThisWeek: rows.length,
    failed: rows.filter(r => r.status === 'failed').length,
    avgSeconds: rows.length ? +(rows.reduce((a, r) => a + r.duration_ms, 0) / rows.length / 1000).toFixed(1) : 0,
    days, byWorkflow: Object.entries(byWf).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, runs]) => ({ name, runs }))
  });
});

// --- settings ---
api.get('/settings', (req, res) => {
  const u = db.prepare('SELECT name,email,email_on_fail,auto_retry,daily_summary FROM users WHERE id=?').get(req.user.id);
  res.json({ name: u.name, email: u.email, emailOnFail: !!u.email_on_fail, autoRetry: !!u.auto_retry, dailySummary: !!u.daily_summary });
});
api.put('/settings', (req, res) => {
  const b = req.body || {};
  if (!b.name || !/^\S+@\S+\.\S+$/.test(b.email || '')) return res.status(400).json({ error: 'Enter a name and a valid email.' });
  db.prepare('UPDATE users SET name=?, email=?, email_on_fail=?, auto_retry=?, daily_summary=? WHERE id=?')
    .run(String(b.name).slice(0, 60), b.email, +!!b.emailOnFail, +!!b.autoRetry, +!!b.dailySummary, req.user.id);
  res.json({ ok: true });
});

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong on our side.' }); });
app.listen(PORT, () => console.log(`FlowPilot running at http://localhost:${PORT}`));
