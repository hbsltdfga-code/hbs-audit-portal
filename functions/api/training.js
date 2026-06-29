export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'engineer';
    const engineer = url.searchParams.get('engineer') || '';
    let rows;

    if (role === 'manager') {
      rows = await env.DB.prepare('SELECT * FROM training_records ORDER BY assigned_date DESC, id DESC').all();
    } else if (role === 'senior_engineer') {
      rows = { results: [] };
    } else {
      rows = await env.DB.prepare('SELECT * FROM training_records WHERE lower(engineer_name)=lower(?) ORDER BY assigned_date DESC, id DESC')
        .bind(engineer).all();
    }

    return Response.json({ ok:true, training: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
