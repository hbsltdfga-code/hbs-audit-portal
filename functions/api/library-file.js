export async function onRequestGet({ request, env }) {
  try {
    if (!env.LIBRARY_BUCKET) return new Response('R2 binding LIBRARY_BUCKET is not configured', { status:500 });
    const key = new URL(request.url).searchParams.get('key');
    if (!key) return new Response('Missing key', { status:400 });

    const obj = await env.LIBRARY_BUCKET.get(key);
    if (!obj) return new Response('File not found', { status:404 });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    headers.set('cache-control', 'private, max-age=300');
    headers.set('content-disposition', `inline; filename="${key.split('/').pop()}"`);

    return new Response(obj.body, { headers });
  } catch (e) {
    return new Response(e.message, { status:500 });
  }
}
