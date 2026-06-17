export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare('SELECT * FROM training_records ORDER BY id DESC').all();
    return Response.json({ ok:true, training: rows.results || [] });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}
