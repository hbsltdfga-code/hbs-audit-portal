async function ensureUsers(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    role TEXT,
    pin TEXT,
    title TEXT,
    active INTEGER DEFAULT 1
  )`).run();
  const cols = await env.DB.prepare('PRAGMA table_info(users)').all();
  if (!(cols.results || []).some(c => c.name === 'title')) await env.DB.prepare('ALTER TABLE users ADD COLUMN title TEXT').run();
  if (!(cols.results || []).some(c => c.name === 'active')) await env.DB.prepare('ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1').run();

  await env.DB.prepare(`UPDATE users SET role='manager', title='Manager', active=1 WHERE lower(name) IN (lower('Peter Taylor'), lower('Eward Richards'), lower('Lucy Coppage'))`).run();
  await env.DB.prepare(`UPDATE users SET role='senior_engineer', title='Senior Engineer', active=1 WHERE lower(name)=lower('Mark Fuller')`).run();
  await env.DB.prepare(`UPDATE users SET active=0 WHERE lower(name)=lower('Russell Haines')`).run();
}
export async function onRequestGet({ env }) {
  try {
    await ensureUsers(env);
    const rows = await env.DB.prepare(`SELECT id,name,email,role,pin,title,active FROM users WHERE COALESCE(active,1)=1 ORDER BY
      CASE role WHEN 'manager' THEN 1 WHEN 'senior_engineer' THEN 2 ELSE 3 END, name`).all();
    return Response.json({ ok:true, users: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
export async function onRequestPost({ request, env }) {
  try {
    await ensureUsers(env);
    const b = await request.json();
    if (b.id) {
      await env.DB.prepare(`UPDATE users SET name=?, email=?, role=?, pin=?, title=?, active=? WHERE id=?`)
        .bind(b.name||'', b.email||'', b.role||'engineer', b.pin||'1234', b.title||'', Number(b.active ?? 1), Number(b.id)).run();
      return Response.json({ ok:true, id:b.id });
    }
    const ins = await env.DB.prepare(`INSERT INTO users (name,email,role,pin,title,active) VALUES (?,?,?,?,?,?)`)
      .bind(b.name||'', b.email||'', b.role||'engineer', b.pin||'1234', b.title||'', Number(b.active ?? 1)).run();
    return Response.json({ ok:true, id:ins.meta?.last_row_id });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
