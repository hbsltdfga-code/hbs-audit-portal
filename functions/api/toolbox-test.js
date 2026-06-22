export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare('SELECT * FROM toolbox_results ORDER BY created_at DESC').all();
    return Response.json({ ok:true, results: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const score = Number(body.score || 0);
    const result = score >= 12 ? 'PASS' : 'FAIL';
    const auditId = body.audit_id ? Number(body.audit_id) : null;
    const engineer = body.engineer_name || '';
    const testDate = body.test_date || new Date().toISOString().slice(0,10);
    const answers = JSON.stringify(body.answers || []);

    const ins = await env.DB.prepare(`INSERT INTO toolbox_results
      (audit_id, engineer_name, test_date, score, result, answers_json)
      VALUES (?,?,?,?,?,?)`)
      .bind(auditId, engineer, testDate, score, result, answers).run();

    if (result === 'PASS') {
      await env.DB.prepare(`UPDATE training_records
        SET status='Completed', completion_date=?
        WHERE engineer_name=? AND lower(status) IN ('open','in progress','pending')`)
        .bind(testDate, engineer).run();
    }

    return Response.json({ ok:true, id:ins.meta?.last_row_id, score, result });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
