export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const email = body.email || body.username || '';
    const pin = body.pin || body.password || '';

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      role TEXT,
      pin TEXT,
      title TEXT,
      active INTEGER DEFAULT 1
    )`).run();

    const cols = await env.DB.prepare(`PRAGMA table_info(users)`).all();
    if (!(cols.results || []).some(c => c.name === 'title')) {
      await env.DB.prepare(`ALTER TABLE users ADD COLUMN title TEXT`).run();
    }

    await env.DB.prepare(`UPDATE users SET role='senior_engineer', title='Senior Engineer' WHERE lower(name)=lower('Mark Fuller')`).run();

    const user = await env.DB.prepare(`SELECT id,name,email,role,pin,title,active FROM users
      WHERE lower(email)=lower(?) AND pin=? AND COALESCE(active,1)=1`)
      .bind(email, pin).first();

    if (!user) return Response.json({ ok: false, error: 'Invalid login details' }, { status: 401 });

    return Response.json({ ok: true, user });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
