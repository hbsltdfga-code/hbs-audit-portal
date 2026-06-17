export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare('SELECT * FROM reaudits ORDER BY due_date ASC').all();
    return Response.json({ ok:true, reaudits: rows.results || [] });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}
