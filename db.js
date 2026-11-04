// SQLite via sql.js (pure JavaScript, nothing to compile), saved to a file after every change.
const fs = require('fs'), path = require('path');
const initSqlJs = require('sql.js');
const FILE = process.env.DB_FILE || path.join(__dirname, 'flowpilot-data.db');
let raw, timer;

function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { fs.writeFileSync(FILE, Buffer.from(raw.export())); } catch (e) { console.error('Could not save database:', e.message); }
  }, 200);
}
function prepare(sql) {
  return {
    all(...p) { const st = raw.prepare(sql); try { st.bind(p); const o = []; while (st.step()) o.push(st.getAsObject()); return o; } finally { st.free(); } },
    get(...p) { return this.all(...p)[0]; },
    run(...p) {
      const st = raw.prepare(sql);
      try { st.run(p); } finally { st.free(); }
      const id = raw.exec('SELECT last_insert_rowid()')[0].values[0][0];
      save(); return { lastInsertRowid: id };
    }
  };
}

const S = (type, name, needs) => ({ type, name, needs: needs || null });
const STARTER = [
  ['Lead follow-up','New CRM lead','Sales','Scores new leads and emails the owner within a minute.','Popular','lav','inbox',1,
    [S('trigger','New CRM lead','Salesforce'),S('condition','Score is 70 or more'),S('action','Email the owner','Gmail')]],
  ['Invoice approval','New invoice','Finance','Approves small invoices and sends large ones to a manager.','Needs attention','cor','doc',1,
    [S('trigger','New invoice','Stripe'),S('condition','Amount is under 5000'),S('action','Approve and log','PostgreSQL')]],
  ['Ticket router','New ticket','Support','Sorts new tickets by topic and assigns the right team.','Popular','mint','ticket',1,
    [S('trigger','New ticket'),S('condition','Topic is clear'),S('action','Assign to a team','PostgreSQL')]],
  ['Loan document check','File uploaded','Finance','Reads uploaded documents and flags missing ones.','New','sky','db',1,
    [S('trigger','File uploaded'),S('action','Text extracted'),S('action','Find customer in the CRM','Salesforce')]],
  ['Weekly report','Every Monday','Operations','Sends a summary of last week’s runs to your team.','','sun','cal',0,
    [S('trigger','Every Monday 9:00'),S('action','Collect run numbers','PostgreSQL'),S('action','Email the team','Gmail')]],
  ['New hire setup','Offer accepted','Operations','Creates accounts and sends a welcome message.','New','lav','users',0,
    [S('trigger','Offer accepted'),S('action','Create accounts'),S('action','Send welcome','Gmail')]]
];
const APPS = [['Salesforce','CRM','cloud','sky',1],['PostgreSQL','Database','db','mint',1],['Slack','Messaging','chat','lav',0],
  ['Gmail','Email','mail','cor',1],['Stripe','Payments','card','sun',0],['HubSpot','CRM','users','lav',0],
  ['Zendesk','Support','ticket','mint',0],['Google Calendar','Scheduling','cal','sky',0]];

// Every new account starts with its own apps, workflows and a week of sample runs.
function seedUser(uid) {
  raw.exec('BEGIN');
  APPS.forEach(a => prepare('INSERT INTO integrations(user_id,name,category,icon,tint,connected) VALUES(?,?,?,?,?,?)').run(uid, ...a));
  STARTER.forEach(w => prepare('INSERT INTO workflows(user_id,name,trigger_name,team,description,badge,tint,icon,active,steps) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(uid, ...w.slice(0, 8), JSON.stringify(w[8])));
  const wfs = prepare('SELECT id,name FROM workflows WHERE user_id=?').all(uid);
  const perDay = [62,80,71,95,88,34,28];
  for (let d = 6; d >= 0; d--) {
    const n = Math.round(perDay[6 - d] / 6);
    for (let k = 0; k < n; k++) {
      const w = wfs[(k + d) % wfs.length], r = Math.random();
      prepare('INSERT INTO runs(user_id,workflow_id,workflow_name,started_at,duration_ms,status,log) VALUES(?,?,?,?,?,?,?)')
        .run(uid, w.id, w.name, new Date(Date.now() - d * 864e5 - k * 36e5).toISOString(), 800 + Math.floor(Math.random() * 3000),
          r < 0.93 ? 'done' : r < 0.97 ? 'review' : 'failed', '[]');
    }
  }
  raw.exec('COMMIT');
}

const ready = initSqlJs().then(SQL => {
  raw = fs.existsSync(FILE) ? new SQL.Database(fs.readFileSync(FILE)) : new SQL.Database();
  raw.exec(`
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, password_hash TEXT,
    email_on_fail INTEGER DEFAULT 1, auto_retry INTEGER DEFAULT 0, daily_summary INTEGER DEFAULT 1, created_at TEXT);
  CREATE TABLE IF NOT EXISTS integrations(id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, category TEXT, icon TEXT, tint TEXT, connected INTEGER);
  CREATE TABLE IF NOT EXISTS workflows(id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, trigger_name TEXT, team TEXT, description TEXT,
    badge TEXT, tint TEXT, icon TEXT, active INTEGER DEFAULT 1, steps TEXT);
  CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, user_id INTEGER, workflow_id INTEGER, workflow_name TEXT, started_at TEXT,
    duration_ms INTEGER, status TEXT, log TEXT);
  CREATE INDEX IF NOT EXISTS i_w ON workflows(user_id); CREATE INDEX IF NOT EXISTS i_r ON runs(user_id,id); CREATE INDEX IF NOT EXISTS i_i ON integrations(user_id);
  `);
  save();
});
module.exports = { ready, prepare, seedUser };
