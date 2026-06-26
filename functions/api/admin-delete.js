async function ensureLog(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS deletion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_name TEXT,
    action TEXT,
    target TEXT,
    reason TEXT,
    deleted_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function safeDelete(env, sql, binds = []) {
  try {
    const stmt = env.DB.prepare(sql);
    const res = binds.length ? await stmt.bind(...binds).run() : await stmt.run();
    return res.meta?.changes || 0;
  } catch (e) {
    return 0;
  }
}

export async function onRequestGet({ env }) {
  try {
    await ensureLog(env);
    const rows = await env.DB.prepare('SELECT * FROM deletion_log ORDER BY id DESC LIMIT 100').all();
    return Response.json({ ok:true, logs: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureLog(env);
    const body = await request.json();
    const action = body.action || '';
    const manager = body.manager || '';
    const reason = body.reason || '';
    let deleted = {};
    let target = '';

    if (action === 'delete_audit_bundle') {
      const auditId = Number(body.audit_id);
      if (!auditId) throw new Error('Missing audit_id');
      target = 'HBS-' + auditId;

      const audit = await env.DB.prepare('SELECT id, engineer_name FROM audits WHERE id=?').bind(auditId).first();
      if (!audit) throw new Error('Audit HBS-' + auditId + ' not found');

      const engineer = audit.engineer_name || '';

      deleted.photos = await safeDelete(env, 'DELETE FROM audit_photos WHERE audit_id=?', [auditId]);

      deleted.toolbox_results = 0;
      deleted.toolbox_results += await safeDelete(env, 'DELETE FROM toolbox_results WHERE audit_id=?', [auditId]);
      deleted.toolbox_results += await safeDelete(env, 'DELETE FROM toolbox_results WHERE lower(engineer_name)=lower(?)', [engineer]);

      deleted.reaudits = 0;
      deleted.reaudits += await safeDelete(env, 'DELETE FROM reaudits WHERE audit_id=?', [auditId]);
      deleted.reaudits += await safeDelete(env, 'DELETE FROM reaudits WHERE lower(engineer_name)=lower(?)', [engineer]);

      deleted.training_records = await safeDelete(env, 'DELETE FROM training_records WHERE lower(engineer_name)=lower(?)', [engineer]);
      deleted.audits = await safeDelete(env, 'DELETE FROM audits WHERE id=?', [auditId]);

    } else if (action === 'delete_engineer_training') {
      const engineer = body.engineer_name || '';
      if (!engineer) throw new Error('Missing engineer_name');
      target = engineer;

      deleted.toolbox_results = await safeDelete(env, 'DELETE FROM toolbox_results WHERE lower(engineer_name)=lower(?)', [engineer]);
      deleted.reaudits = await safeDelete(env, 'DELETE FROM reaudits WHERE lower(engineer_name)=lower(?)', [engineer]);
      deleted.training_records = await safeDelete(env, 'DELETE FROM training_records WHERE lower(engineer_name)=lower(?)', [engineer]);

    } else {
      throw new Error('Unknown action');
    }

    await env.DB.prepare('INSERT INTO deletion_log (manager_name, action, target, reason, deleted_json) VALUES (?,?,?,?,?)')
      .bind(manager, action, target, reason, JSON.stringify(deleted)).run();

    return Response.json({ ok:true, deleted });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
