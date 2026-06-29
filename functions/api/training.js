async function ensureTraining(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    training_type TEXT,
    assigned_date TEXT,
    completion_date TEXT,
    status TEXT DEFAULT 'Open',
    audit_ref TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
export async function onRequestGet({ request, env }) {
  try {
    await ensureTraining(env);
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'engineer';
    const engineer = url.searchParams.get('engineer') || '';

    let rows;
    if (role === 'manager') {
      rows = await env.DB.prepare(`SELECT * FROM training_records ORDER BY id DESC`).all();
    } else if (role === 'senior_engineer') {
      rows = { results: [] };
    } else {
      rows = await env.DB.prepare(`SELECT * FROM training_records WHERE lower(engineer_name)=lower(?) ORDER BY id DESC`)
        .bind(engineer).all();
    }

    return Response.json({ ok: true, training: rows.results || [] });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
export async function onRequestPost({ request, env }) {
  try {
    await ensureTraining(env);
    const body = await request.json();
    if (body.role && body.role !== 'manager') {
      return Response.json({ ok: false, error: 'Manager access only' }, { status: 403 });
    }

    if (body.id) {
      await env.DB.prepare(`UPDATE training_records SET status=?, completion_date=? WHERE id=?`)
        .bind(body.status || 'Completed', body.completion_date || new Date().toISOString().slice(0, 10), Number(body.id)).run();
      return Response.json({ ok: true, id: body.id });
    }

    const ins = await env.DB.prepare(`INSERT INTO training_records
      (engineer_name, training_type, assigned_date, completion_date, status, audit_ref)
      VALUES (?,?,?,?,?,?)`)
      .bind(body.engineer_name || '', body.training_type || '', body.assigned_date || new Date().toISOString().slice(0,10), body.completion_date || '', body.status || 'Open', body.audit_ref || '').run();

    return Response.json({ ok: true, id: ins.meta?.last_row_id });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
