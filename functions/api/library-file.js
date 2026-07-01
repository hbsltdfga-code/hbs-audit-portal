async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS technical_library (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,category TEXT,reference TEXT,keywords TEXT,file_name TEXT,mime_type TEXT,file_key TEXT,r2_key TEXT,file_size INTEGER,uploaded_by TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
}
export async function onRequestGet({request, env}) {
  try {
    if(!env.LIBRARY_BUCKET) return new Response('R2 binding LIBRARY_BUCKET is not configured.', {status:500});
    await ensure(env);
    const id = new URL(request.url).searchParams.get('id');
    const doc = await env.DB.prepare('SELECT * FROM technical_library WHERE id=?').bind(id).first();
    const key = doc?.r2_key || doc?.file_key;
    if (!doc || !key) return new Response('File not found', {status:404});
    const obj = await env.LIBRARY_BUCKET.get(key);
    if (!obj) return new Response('R2 object not found', {status:404});
    return new Response(obj.body, {headers:{'content-type': doc.mime_type || obj.httpMetadata?.contentType || 'application/octet-stream','content-disposition': `inline; filename="${String(doc.file_name || 'document').replace(/"/g,'')}"`}});
  } catch(e) { return new Response(e.message, {status:500}); }
}
