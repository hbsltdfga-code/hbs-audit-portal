async function ensureUserColumns(env) {
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
  const names = (cols.results || []).map(c => c.name);

  if (!names.includes('title')) await env.DB.prepare('ALTER TABLE users ADD COLUMN title TEXT').run();
  if (!names.includes('active')) await env.DB.prepare('ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1').run();

  // Ensure existing users are not accidentally locked out unless specifically disabled later.
  await env.DB.prepare(`UPDATE users SET active=1 WHERE active IS NULL`).run();

  // Management access
  await env.DB.prepare(`
    UPDATE users
    SET role='manager', title='Manager', active=1
    WHERE lower(name) IN (lower('Peter Taylor'), lower('Eward Richards'), lower('Lucy Coppage'))
       OR lower(email) LIKE '%peter%'
       OR lower(email) LIKE '%eward%'
       OR lower(email) LIKE '%lucy%'
  `).run();

  // Senior Engineer restricted access
  await env.DB.prepare(`
    UPDATE users
    SET role='senior_engineer', title='Senior Engineer', active=1
    WHERE lower(name)=lower('Mark Fuller')
  `).run();

  // Russell removed from active access only if the exact user exists.
  await env.DB.prepare(`
    UPDATE users
    SET active=0
    WHERE lower(name)=lower('Russell Haines')
  `).run();
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureUserColumns(env);

    const body = await request.json();
    const login = String(body.email || body.username || '').trim().toLowerCase();
    const pin = String(body.pin || body.password || '').trim();

    if (!login || !pin) {
      return Response.json({ ok:false, error:'Enter email/name and PIN.' }, { status:400 });
    }

    const user = await env.DB.prepare(`
      SELECT id, name, email, role, pin, title, COALESCE(active,1) AS active
      FROM users
      WHERE COALESCE(active,1)=1
        AND (
          lower(email)=?
          OR lower(name)=?
          OR lower(name) LIKE ?
        )
        AND trim(CAST(pin AS TEXT))=?
      LIMIT 1
    `).bind(login, login, `%${login}%`, pin).first();

    if (!user) {
      return Response.json({
        ok:false,
        error:'Invalid login details. Check the user is active in D1 and that the PIN is correct.'
      }, { status:401 });
    }

    return Response.json({ ok:true, user });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
