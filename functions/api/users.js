export async function onRequestGet({ env }) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,email TEXT,role TEXT,pin TEXT,title TEXT,active INTEGER DEFAULT 1)`).run();
    const cols = await env.DB.prepare('PRAGMA table_info(users)').all();
    if (!(cols.results || []).some(c => c.name === 'title')) await env.DB.prepare('ALTER TABLE users ADD COLUMN title TEXT').run();
    await env.DB.prepare(`UPDATE users SET role='senior_engineer', title='Senior Engineer' WHERE lower(name)=lower('Mark Fuller')`).run();
    const rows = await env.DB.prepare('SELECT id,name,email,role,pin,title,active FROM users ORDER BY role,name').all();
    return Response.json({ ok:true, users: rows.results || [] });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const cols = await env.DB.prepare('PRAGMA table_info(users)').all();
    if (!(cols.results || []).some(c => c.name === 'title')) await env.DB.prepare('ALTER TABLE users ADD COLUMN title TEXT').run();
    if (body.id) {
      await env.DB.prepare(`UPDATE users SET name=?, email=?, role=?, pin=?, title=?, active=? WHERE id=?`)
        .bind(body.name||'', body.email||'', body.role||'engineer', body.pin||'1234', body.title||'', Number(body.active ?? 1), Number(body.id)).run();
      return Response.json({ ok:true, id:body.id });
    }
    const ins = await env.DB.prepare(`INSERT INTO users (name,email,role,pin,title,active) VALUES (?,?,?,?,?,?)`)
      .bind(body.name||'', body.email||'', body.role||'engineer', body.pin||'1234', body.title||'', Number(body.active ?? 1)).run();
    return Response.json({ ok:true, id:ins.meta?.last_row_id });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}
