export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || '';
    const email = (url.searchParams.get('email') || '').toLowerCase();

    let rows;
    if (role === 'manager') {
      rows = await env.DB.prepare('SELECT id,email,name,role,active FROM users ORDER BY name').all();
    } else {
      rows = await env.DB.prepare('SELECT id,email,name,role,active FROM users WHERE lower(email)=lower(?)').bind(email).all();
    }

    return Response.json({ ok:true, users: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const id = body.id ? Number(body.id) : null;
    const email = body.email || '';
    const name = body.name || '';
    const pin = body.pin || '1234';
    const role = body.role || 'engineer';
    const active = Number(body.active ?? 1);

    if (id) {
      await env.DB.prepare('UPDATE users SET email=?, name=?, pin=?, role=?, active=? WHERE id=?')
        .bind(email, name, pin, role, active, id).run();
      return Response.json({ ok:true, id });
    }

    const ins = await env.DB.prepare('INSERT INTO users (email,pin,role,name,active) VALUES (?,?,?,?,?)')
      .bind(email, pin, role, name, active).run();
    return Response.json({ ok:true, id: ins.meta?.last_row_id });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
