export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || '';
    const email = (url.searchParams.get('email') || '').toLowerCase();
    let rows;
    if (role === 'manager') rows = await env.DB.prepare('SELECT id,email,name,role,active FROM users ORDER BY name').all();
    else rows = await env.DB.prepare('SELECT id,email,name,role,active FROM users WHERE lower(email)=lower(?)').bind(email).all();
    return Response.json({ ok:true, users: rows.results || [] });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (b.id) {
      await env.DB.prepare('UPDATE users SET email=?, name=?, pin=?, role=?, active=? WHERE id=?')
        .bind(b.email||'', b.name||'', b.pin||'1234', b.role||'engineer', Number(b.active??1), Number(b.id)).run();
      return Response.json({ ok:true, id:b.id });
    }
    const ins = await env.DB.prepare('INSERT INTO users (email,pin,role,name,active) VALUES (?,?,?,?,?)')
      .bind(b.email||'', b.pin||'1234', b.role||'engineer', b.name||'', Number(b.active??1)).run();
    return Response.json({ ok:true, id:ins.meta?.last_row_id });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}