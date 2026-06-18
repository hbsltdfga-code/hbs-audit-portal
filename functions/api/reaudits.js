export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      'SELECT * FROM reaudits ORDER BY due_date ASC, id DESC'
    ).all();
    return Response.json({ ok:true, reaudits: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const id = Number(body.id || 0);
    const status = body.status || 'Completed';
    if (!id) return Response.json({ ok:false, error:'Missing re-audit id' }, { status:400 });

    const completedDate = ['completed','complete','closed'].includes(String(status).toLowerCase())
      ? new Date().toISOString().slice(0,10)
      : '';

    await env.DB.prepare(
      'UPDATE reaudits SET status=?, completed_date=? WHERE id=?'
    ).bind(status, completedDate, id).run();

    return Response.json({ ok:true, id, status, completed_date: completedDate });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
