export async function onRequestGet({ request, env }) {
  try {
    const ref = new URL(request.url).searchParams.get('ref');
    const audit = await env.DB.prepare('SELECT * FROM audits WHERE audit_ref=?').bind(ref).first();
    const photos = await env.DB.prepare('SELECT filename,mime_type,data_url FROM audit_photos WHERE audit_ref=?').bind(ref).all();
    return Response.json({ ok:!!audit, audit, photos: photos.results || [] });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}
