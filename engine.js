const db = require('./db');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Runs one workflow step by step and records the result for its owner.
async function execute(wf) {
  const steps = JSON.parse(wf.steps), started = Date.now();
  const id = db.prepare('INSERT INTO runs(user_id,workflow_id,workflow_name,started_at,duration_ms,status,log) VALUES(?,?,?,?,?,?,?)')
    .run(wf.user_id, wf.id, wf.name, new Date().toISOString(), 0, 'running', '[]').lastInsertRowid;
  const log = []; let status = 'done';
  for (const s of steps) {
    await sleep(250);
    if (s.needs) {
      const i = db.prepare('SELECT connected FROM integrations WHERE user_id=? AND name=?').get(wf.user_id, s.needs);
      if (!i || !i.connected) { log.push({ ok: false, text: `${s.needs} is not connected. Connect it in the Integration hub, then retry.` }); status = 'failed'; break; }
    }
    if (s.type === 'condition') {
      const limit = parseInt((s.name.match(/\d+/) || [70])[0], 10), score = 50 + Math.floor(Math.random() * 50);
      const pass = /under|below/i.test(s.name) ? score < limit : score >= limit;
      log.push({ ok: true, text: `${s.name}: value was ${score}` });
      if (!pass) { log.push({ ok: null, text: 'Did not match. Sent to a person to review.' }); status = 'review'; break; }
    } else log.push({ ok: true, text: s.name });
  }
  db.prepare('UPDATE runs SET status=?, duration_ms=?, log=? WHERE id=?').run(status, Date.now() - started, JSON.stringify(log), id);
}
// The run row is inserted before the first await, so the newest id for this user is this run.
function start(wf) {
  execute(wf).catch(e => console.error('run error', e));
  return db.prepare('SELECT MAX(id) m FROM runs WHERE user_id=?').get(wf.user_id).m;
}
module.exports = { start };
