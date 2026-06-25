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

      const audit = await env.DB.prepare('SELECT engineer_name FROM audits WHERE id=?').bind(auditId).first();
      const engineer = audit?.engineer_name || '';

      const photos = await env.DB.prepare('DELETE FROM audit_photos WHERE audit_id=?').bind(auditId).run();
      const tests = await env.DB.prepare('DELETE FROM toolbox_results WHERE audit_id=? OR training_id IN (SELECT id FROM training_records WHERE engineer_name=?)')
        .bind(auditId, engineer).run();
      const reaudits = await env.DB.prepare('DELETE FROM reaudits WHERE audit_id=?').bind(auditId).run();
      const training = await env.DB.prepare('DELETE FROM training_records WHERE engineer_name=? AND lower(status) IN (\'open\',\'pending\',\'in progress\')')
        .bind(engineer).run();
      const audits = await env.DB.prepare('DELETE FROM audits WHERE id=?').bind(auditId).run();

      deleted = {
        audits: audits.meta?.changes || 0,
        photos: photos.meta?.changes || 0,
        training_records: training.meta?.changes || 0,
        toolbox_results: tests.meta?.changes || 0,
        reaudits: reaudits.meta?.changes || 0
      };
    } else if (action === 'delete_engineer_training') {
      const engineer = body.engineer_name || '';
      if (!engineer) throw new Error('Missing engineer_name');
      target = engineer;

      const tests = await env.DB.prepare('DELETE FROM toolbox_results WHERE lower(engineer_name)=lower(?)').bind(engineer).run();
      const reaudits = await env.DB.prepare('DELETE FROM reaudits WHERE lower(engineer_name)=lower(?)').bind(engineer).run();
      const training = await env.DB.prepare('DELETE FROM training_records WHERE lower(engineer_name)=lower(?)').bind(engineer).run();

      deleted = {
        training_records: training.meta?.changes || 0,
        toolbox_results: tests.meta?.changes || 0,
        reaudits: reaudits.meta?.changes || 0
      };
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
