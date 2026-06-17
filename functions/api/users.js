export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare('SELECT id,name,email,role,active FROM users ORDER BY role,name').all();
    return Response.json({ ok:true, users: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const action = body.action || 'save';
    if (action === 'delete') {
      await env.DB.prepare('UPDATE users SET active=0 WHERE id=?').bind(body.id).run();
      return Response.json({ ok:true });
    }
    if (body.id) {
      await env.DB.prepare('UPDATE users SET name=?, email=?, role=?, pin=?, active=? WHERE id=?')
        .bind(body.name || '', body.email || '', body.role || 'engineer', body.pin || '1234', Number(body.active ?? 1), body.id).run();
      return Response.json({ ok:true });
    }
    const r = await env.DB.prepare('INSERT INTO users (email,pin,role,name,active) VALUES (?,?,?,?,?)')
      .bind(body.email || '', body.pin || '1234', body.role || 'engineer', body.name || '', Number(body.active ?? 1)).run();
    return Response.json({ ok:true, id:r.meta?.last_row_id });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
