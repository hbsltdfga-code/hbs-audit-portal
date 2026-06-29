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
export async function onRequestPost({ request, env }) {
  try {
    await ensureUsers(env);
    const b = await request.json();
    const email = b.email || b.username || '';
    const pin = b.pin || b.password || '';
    const user = await env.DB.prepare(`SELECT id,name,email,role,pin,title,active FROM users
      WHERE (lower(email)=lower(?) OR lower(name)=lower(?)) AND pin=? AND COALESCE(active,1)=1`)
      .bind(email, email, pin).first();
    if (!user) return Response.json({ ok:false, error:'Invalid login details' }, { status:401 });
    return Response.json({ ok:true, user });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
