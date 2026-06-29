async function ensureReaudits(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reaudits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_ref TEXT,
    engineer_name TEXT,
    due_date TEXT,
    completed_date TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
export async function onRequestGet({ request, env }) {
  try {
    await ensureReaudits(env);
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'engineer';
    const engineer = url.searchParams.get('engineer') || '';

    let rows;
    if (role === 'manager') {
      rows = await env.DB.prepare(`SELECT * FROM reaudits ORDER BY id DESC`).all();
    } else if (role === 'senior_engineer') {
      rows = { results: [] };
    } else {
      rows = await env.DB.prepare(`SELECT * FROM reaudits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC`)
        .bind(engineer).all();
    }

    return Response.json({ ok: true, reaudits: rows.results || [] });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
export async function onRequestPost({ request, env }) {
  try {
    await ensureReaudits(env);
    const body = await request.json();
    if (body.role && body.role !== 'manager') {
      return Response.json({ ok: false, error: 'Manager access only' }, { status: 403 });
    }

    if (body.id) {
      await env.DB.prepare(`UPDATE reaudits SET status=?, completed_date=? WHERE id=?`)
        .bind(body.status || 'Completed', body.completed_date || new Date().toISOString().slice(0, 10), Number(body.id)).run();
      return Response.json({ ok: true, id: body.id });
    }

    const ins = await env.DB.prepare(`INSERT INTO reaudits
      (audit_ref, engineer_name, due_date, completed_date, status)
      VALUES (?,?,?,?,?)`)
      .bind(body.audit_ref || '', body.engineer_name || '', body.due_date || '', body.completed_date || '', body.status || 'Open').run();

    return Response.json({ ok: true, id: ins.meta?.last_row_id });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
