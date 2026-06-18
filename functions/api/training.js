export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      'SELECT * FROM training_records ORDER BY assigned_date DESC, id DESC'
    ).all();
    return Response.json({ ok:true, training: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const id = Number(body.id || 0);
    const status = body.status || 'Completed';
    if (!id) return Response.json({ ok:false, error:'Missing training record id' }, { status:400 });

    const completionDate = ['completed','complete','closed'].includes(String(status).toLowerCase())
      ? new Date().toISOString().slice(0,10)
      : '';

    await env.DB.prepare(
      'UPDATE training_records SET status=?, completion_date=? WHERE id=?'
    ).bind(status, completionDate, id).run();

    return Response.json({ ok:true, id, status, completion_date: completionDate });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
