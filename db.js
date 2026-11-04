const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database(process.env.DB_FILE || 'flowpilot.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, password_hash TEXT,
  email_on_fail INTEGER DEFAULT 1, auto_retry INTEGER DEFAULT 0, daily_summary INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS integrations(id INTEGER PRIMARY KEY, name TEXT UNIQUE, category TEXT, icon TEXT, tint TEXT, connected INTEGER);
CREATE TABLE IF NOT EXISTS workflows(id INTEGER PRIMARY KEY, name TEXT, trigger_name TEXT, team TEXT, description TEXT,
  badge TEXT, tint TEXT, icon TEXT, active INTEGER DEFAULT 1, steps TEXT);
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, workflow_id INTEGER, workflow_name TEXT, started_at TEXT,
  duration_ms INTEGER, status TEXT, log TEXT);
`);

function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c) return;
  db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)')
    .run('Mithra', 'mithra@company.com', bcrypt.hashSync('password', 10));

  const ints = [['Salesforce','CRM','cloud','sky',1],['PostgreSQL','Database','db','mint',1],['Slack','Messaging','chat','lav',0],
    ['Gmail','Email','mail','cor',1],['Stripe','Payments','card','sun',0],['HubSpot','CRM','users','lav',0],
    ['Zendesk','Support','ticket','mint',0],['Google Calendar','Scheduling','cal','sky',0]];
  const ii = db.prepare('INSERT INTO integrations(name,category,icon,tint,connected) VALUES(?,?,?,?,?)');
  ints.forEach(r => ii.run(...r));

  const S = (type, name, needs) => ({ type, name, needs: needs || null });
  const wfs = [
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
  const wi = db.prepare('INSERT INTO workflows(name,trigger_name,team,description,badge,tint,icon,active,steps) VALUES(?,?,?,?,?,?,?,?,?)');
  wfs.forEach(w => wi.run(...w.slice(0, 8), JSON.stringify(w[8])));

  // a week of sample run history for the charts
  const ri = db.prepare('INSERT INTO runs(workflow_id,workflow_name,started_at,duration_ms,status,log) VALUES(?,?,?,?,?,?)');
  const perDay = [62,80,71,95,88,34,28];
  const names = db.prepare('SELECT id,name FROM workflows').all();
  for (let d = 6; d >= 0; d--) {
    const n = Math.round(perDay[6 - d] / 4);
    for (let k = 0; k < n; k++) {
      const w = names[(k + d) % names.length];
      const t = new Date(Date.now() - d * 864e5 - k * 36e5).toISOString();
      const r = Math.random();
      ri.run(w.id, w.name, t, 800 + Math.floor(Math.random() * 3000), r < 0.93 ? 'done' : r < 0.97 ? 'review' : 'failed', '[]');
    }
  }
}
seed();
module.exports = db;
