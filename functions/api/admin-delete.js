const map = {
  audit: 'audits',
  training: 'training_records',
  reaudit: 'reaudits',
  toolbox: 'toolbox_results',
  tightness: 'tightness_records',
  library: 'technical_library'
};

function auditRefFor(id) {
  return `HBS-${Number(id)}`;
}

async function safeRun(env, sql, ...binds) {
  try {
    return await env.DB.prepare(sql).bind(...binds).run();
  } catch (e) {
    console.log('admin-delete skipped:', sql, e.message);
    return null;
  }
}

async function deleteAuditLinkedRecords(env, auditId) {
  const ref = auditRefFor(auditId);

  // Photos linked by numeric audit id.
  await safeRun(env, 'DELETE FROM audit_photos WHERE audit_id=?', Number(auditId));

  // Workflow records may be linked by either audit_id or generated HBS reference.
  await safeRun(env, 'DELETE FROM training_records WHERE audit_ref=?', ref);
  await safeRun(env, 'DELETE FROM reaudits WHERE audit_id=? OR audit_ref=?', Number(auditId), ref);

  // Test results normally store the originating audit reference in answers_json.
  await safeRun(env, 'DELETE FROM toolbox_results WHERE answers_json LIKE ?', `%${ref}%`);

  // Future-proof optional workflow/action tables if they exist.
  await safeRun(env, 'DELETE FROM compliance_actions WHERE audit_id=? OR audit_ref=?', Number(auditId), ref);
  await safeRun(env, 'DELETE FROM workflow_log WHERE audit_id=? OR audit_ref=?', Number(auditId), ref);
}

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (b.role !== 'manager') {
      return Response.json({ ok: false, error: 'Manager access only' }, { status: 403 });
    }

    const table = map[b.type];
    const id = Number(b.id);
    if (!table || !id) throw new Error('Invalid delete request');

    if (b.type === 'audit') {
      await deleteAuditLinkedRecords(env, id);
    }

    await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();

    return Response.json({
      ok: true,
      message: b.type === 'audit'
        ? `Deleted audit record ${id} and linked workflow records`
        : `Deleted ${b.type} record ${id}`
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
