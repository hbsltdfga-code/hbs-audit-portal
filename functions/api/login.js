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

  await env.DB.prepare(`UPDATE users SET active=1 WHERE active IS NULL`).run();

  await env.DB.prepare(`
    UPDATE users
    SET role='manager', title='Manager', active=1
    WHERE lower(name) IN (lower('Peter Taylor'), lower('Eward Richards'), lower('Lucy Coppage'))
       OR lower(email) IN (lower('peter@hbs.local'), lower('eward.richards@hbs.local'), lower('lucy.coppage@hbs.local'))
  `).run();

  await env.DB.prepare(`
    UPDATE users
    SET role='senior_engineer', title='Senior Engineer', active=1
    WHERE lower(name)=lower('Mark Fuller')
       OR lower(email)=lower('mark.fuller@hbs.local')
  `).run();

  await env.DB.prepare(`
    UPDATE users
    SET active=0
    WHERE lower(name)=lower('Russell Haines')
  `).run();
}

function clean(v) {
  return String(v || '').trim().toLowerCase();
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureUserColumns(env);

    const body = await request.json();
    const login = clean(body.email || body.username || '');
    const pin = String(body.pin || body.password || '').trim();

    if (!login || !pin) {
      return Response.json({ ok:false, error:'Enter email/name and PIN.' }, { status:400 });
    }

    const rows = await env.DB.prepare(`
      SELECT id, name, email, role, pin, title, COALESCE(active,1) AS active
      FROM users
      WHERE COALESCE(active,1)=1
    `).all();

    const users = rows.results || [];
    const user = users.find(u => {
      const nm = clean(u.name);
      const em = clean(u.email);
      const storedPin = String(u.pin || '').trim();
      return storedPin === pin && (
        em === login ||
        nm === login ||
        nm.includes(login) ||
        login.includes(nm)
      );
    });

    if (!user) {
      return Response.json({
        ok:false,
        error:'Invalid login details. Use Peter Taylor or peter@hbs.local with PIN 3110.'
      }, { status:401 });
    }

    return Response.json({ ok:true, user });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

// Browser test helper:
// /api/login?user=peter@hbs.local&pin=3110
export async function onRequestGet({ request, env }) {
  try {
    await ensureUserColumns(env);
    const url = new URL(request.url);
    const login = clean(url.searchParams.get('user') || url.searchParams.get('email') || '');
    const pin = String(url.searchParams.get('pin') || '').trim();

    if (!login || !pin) {
      return Response.json({ ok:true, message:'Login API is active. Test with /api/login?user=peter@hbs.local&pin=3110' });
    }

    const rows = await env.DB.prepare(`
      SELECT id, name, email, role, pin, title, COALESCE(active,1) AS active
      FROM users
      WHERE COALESCE(active,1)=1
    `).all();

    const user = (rows.results || []).find(u => {
      const nm = clean(u.name);
      const em = clean(u.email);
      return String(u.pin || '').trim() === pin && (em === login || nm === login || nm.includes(login));
    });

    if (!user) return Response.json({ ok:false, error:'Test login failed' }, { status:401 });
    return Response.json({ ok:true, user });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
