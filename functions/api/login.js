export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase();
    const pin = body.pin || '';
    const user = await env.DB.prepare('SELECT id,email,name,role,active FROM users WHERE lower(email)=lower(?) AND pin=? AND active=1')
      .bind(email, pin).first();
    if (!user) return Response.json({ ok:false, error:'Invalid login or inactive user' }, { status:401 });
    return Response.json({ ok:true, user });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}