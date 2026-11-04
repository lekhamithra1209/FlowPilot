const db = require('./db');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Runs a workflow step by step and writes the result to the runs table.
async function execute(wf) {
  const steps = JSON.parse(wf.steps);
  const started = Date.now();
  const info = db.prepare('INSERT INTO runs(workflow_id,workflow_name,started_at,duration_ms,status,log) VALUES(?,?,?,?,?,?)')
    .run(wf.id, wf.name, new Date().toISOString(), 0, 'running', '[]');
  const id = info.lastInsertRowid;
  const log = [];
  let status = 'done';

  for (const s of steps) {
    await sleep(250);
    if (s.needs) {
      const i = db.prepare('SELECT connected FROM integrations WHERE name=?').get(s.needs);
      if (!i || !i.connected) {
        log.push({ ok: false, text: `${s.needs} is not connected. Connect it in the Integration hub, then retry.` });
        status = 'failed';
        break;
      }
    }
    if (s.type === 'condition') {
      const limit = parseInt((s.name.match(/\d+/) || [70])[0], 10);
      const score = 50 + Math.floor(Math.random() * 50);
      const pass = s.name.match(/under|below/i) ? score < limit : score >= limit;
      log.push({ ok: true, text: `${s.name}: value was ${score}` });
      if (!pass) { log.push({ ok: null, text: 'Did not match. Sent to a person to review.' }); status = 'review'; break; }
    } else {
      log.push({ ok: true, text: s.name });
    }
  }
  db.prepare('UPDATE runs SET status=?, duration_ms=?, log=? WHERE id=?').run(status, Date.now() - started, JSON.stringify(log), id);
  return id;
}

// Starts a run and returns right away; the run finishes in the background.
function start(wf) {
  execute(wf).catch(e => console.error('run error', e));
  // the run row is inserted synchronously inside execute(), so the newest id is this run
  return db.prepare('SELECT MAX(id) m FROM runs').get().m;
}
module.exports = { start, execute };
