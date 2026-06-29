export async function onRequestGet({request, env}) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    const doc = await env.DB.prepare('SELECT * FROM technical_library WHERE id=?').bind(id).first();
    if (!doc || !doc.file_key) return new Response('File not found', {status:404});
    const obj = await env.LIBRARY_BUCKET.get(doc.file_key);
    if (!obj) return new Response('R2 object not found', {status:404});
    return new Response(obj.body, {
      headers: {
        'content-type': doc.mime_type || 'application/octet-stream',
        'content-disposition': `inline; filename="${doc.file_name || 'document'}"`
      }
    });
  } catch(e) {
    return new Response(e.message, {status:500});
  }
}
