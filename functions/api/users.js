export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare('SELECT id,name,email,role,active FROM users ORDER BY role,name').all();
    return Response.json({ ok:true, users: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
