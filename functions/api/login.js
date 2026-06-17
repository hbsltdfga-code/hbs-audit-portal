export async function onRequestPost({ request, env }) {
  try {
    const { email, pin } = await request.json();
    const user = await env.DB.prepare(
      'SELECT id,name,email,role FROM users WHERE lower(email)=lower(?) AND pin=? AND active=1'
    ).bind(email || '', pin || '').first();
    if (!user) return Response.json({ ok:false, error:'Invalid email or PIN' }, { status:401 });
    return Response.json({ ok:true, user });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
