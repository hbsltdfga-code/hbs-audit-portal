export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'manager';
    const engineer = url.searchParams.get('engineer') || '';
    let rows;

    if (role === 'engineer') {
      rows = await env.DB.prepare('SELECT * FROM training_records WHERE lower(engineer_name)=lower(?) ORDER BY assigned_date DESC, id DESC')
        .bind(engineer).all();
    } else {
      rows = await env.DB.prepare('SELECT * FROM training_records ORDER BY assigned_date DESC, id DESC').all();
    }

    return Response.json({ ok:true, training: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    if (body.role && body.role !== 'manager') {
      return Response.json({ ok:false, error:'Manager access only' }, { status:403 });
    }

    if (body.engineer_name && body.training_type && !body.id) {
      const ins = await env.DB.prepare(`INSERT INTO training_records
        (engineer_name, training_type, assigned_date, completion_date, status)
        VALUES (?,?,?,?,?)`)
        .bind(
          body.engineer_name || '',
          body.training_type || '',
          body.assigned_date || new Date().toISOString().slice(0,10),
          body.completion_date || '',
          body.status || 'Open'
        ).run();
      return Response.json({ ok:true, id:ins.meta?.last_row_id, status:body.status||'Open' });
    }

    const id = Number(body.id);
    const status = body.status || 'Completed';
    const completionDate = new Date().toISOString().slice(0,10);

    await env.DB.prepare('UPDATE training_records SET status=?, completion_date=? WHERE id=?')
      .bind(status, completionDate, id).run();

    return Response.json({ ok:true, id, status });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
