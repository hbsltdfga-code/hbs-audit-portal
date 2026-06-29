async function columnExists(env, table, column) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (info.results || []).some(c => c.name === column);
}

async function ensureTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS technical_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    category TEXT,
    reference TEXT,
    keywords TEXT,
    file_name TEXT,
    mime_type TEXT,
    file_key TEXT,
    file_size INTEGER,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  if (!(await columnExists(env, 'technical_library', 'file_key'))) {
    await env.DB.prepare(`ALTER TABLE technical_library ADD COLUMN file_key TEXT`).run();
  }
  if (!(await columnExists(env, 'technical_library', 'file_size'))) {
    await env.DB.prepare(`ALTER TABLE technical_library ADD COLUMN file_size INTEGER`).run();
  }

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS library_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,
    opened_by TEXT,
    action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

function cleanName(name) {
  return String(name || 'document').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 140);
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureTables(env);
    if (!env.LIBRARY_BUCKET) throw new Error('R2 binding LIBRARY_BUCKET is not configured');

    const url = new URL(request.url);
    const title = url.searchParams.get('title') || url.searchParams.get('file_name') || 'Untitled document';
    const categoryRaw = url.searchParams.get('category') || 'Other';
    const category = cleanName(categoryRaw);
    const reference = url.searchParams.get('reference') || '';
    const keywords = url.searchParams.get('keywords') || '';
    const fileName = cleanName(url.searchParams.get('file_name') || 'document');
    const mimeType = url.searchParams.get('mime_type') || request.headers.get('content-type') || 'application/octet-stream';
    const uploadedBy = url.searchParams.get('uploaded_by') || '';
    const size = Number(request.headers.get('content-length') || 0);

    const key = `${category}/${Date.now()}-${fileName}`;

    await env.LIBRARY_BUCKET.put(key, request.body, {
      httpMetadata: { contentType: mimeType },
      customMetadata: {
        title,
        uploaded_by: uploadedBy,
        reference
      }
    });

    const finalSize = size || (await env.LIBRARY_BUCKET.head(key))?.size || 0;

    const ins = await env.DB.prepare(`INSERT INTO technical_library
      (title, category, reference, keywords, file_name, mime_type, file_key, file_size, uploaded_by)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(title, categoryRaw, reference, keywords, fileName, mimeType, key, finalSize, uploadedBy)
      .run();

    return Response.json({ ok:true, id:ins.meta?.last_row_id, key, file_size:finalSize });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
