export async function onRequestGet({ request, env }) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    const audit = await env.DB.prepare('SELECT * FROM audits WHERE id=?').bind(id).first();
    const photos = await env.DB.prepare('SELECT photo_name, photo_url FROM audit_photos WHERE audit_id=?').bind(id).all();
    return Response.json({ ok:!!audit, audit, photos: photos.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
