export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'engineer';
    const engineer = url.searchParams.get('engineer') || '';
    let rows;

    if (role === 'manager') {
      rows = await env.DB.prepare('SELECT * FROM reaudits ORDER BY due_date DESC, id DESC').all();
    } else if (role === 'senior_engineer') {
      rows = { results: [] };
    } else {
      rows = await env.DB.prepare('SELECT * FROM reaudits WHERE lower(engineer_name)=lower(?) ORDER BY due_date DESC, id DESC')
        .bind(engineer).all();
    }

    return Response.json({ ok:true, reaudits: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
