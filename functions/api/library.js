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

  // Upgrade older D1-library table that stored file_data but did not have R2 columns.
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
  return String(name || 'document').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2) throw new Error('Invalid file data');
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function fileRoute(key) {
  return '/api/library-file?key=' + encodeURIComponent(key);
}

export async function onRequestGet({ request, env }) {
  try {
    await ensureTables(env);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const doc = await env.DB.prepare('SELECT * FROM technical_library WHERE id=?').bind(id).first();
      if (!doc) return Response.json({ ok:false, error:'Document not found' }, { status:404 });
      const openedBy = url.searchParams.get('open_by') || '';
      if (openedBy) {
        await env.DB.prepare('INSERT INTO library_access_log (document_id, opened_by, action) VALUES (?,?,?)')
          .bind(Number(id), openedBy, 'open').run();
      }
      if (!doc.file_key) return Response.json({ ok:false, error:'Document was created before R2 storage and has no R2 file key. Re-upload this document.' }, { status:400 });
      doc.file_url = fileRoute(doc.file_key);
      return Response.json({ ok:true, document: doc });
    }

    const q = '%' + (url.searchParams.get('q') || '').toLowerCase() + '%';
    const category = url.searchParams.get('category') || '';

    let rows;
    if (category) {
      rows = await env.DB.prepare(`SELECT id,title,category,reference,keywords,file_name,mime_type,file_key,file_size,uploaded_by,created_at
        FROM technical_library
        WHERE category=? AND (lower(title) LIKE ? OR lower(reference) LIKE ? OR lower(keywords) LIKE ? OR lower(file_name) LIKE ?)
        ORDER BY category, title`)
        .bind(category, q, q, q, q).all();
    } else {
      rows = await env.DB.prepare(`SELECT id,title,category,reference,keywords,file_name,mime_type,file_key,file_size,uploaded_by,created_at
        FROM technical_library
        WHERE lower(title) LIKE ? OR lower(reference) LIKE ? OR lower(keywords) LIKE ? OR lower(file_name) LIKE ? OR lower(category) LIKE ?
        ORDER BY category, title`)
        .bind(q, q, q, q, q).all();
    }

    return Response.json({ ok:true, documents: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureTables(env);
    if (!env.LIBRARY_BUCKET) throw new Error('R2 binding LIBRARY_BUCKET is not configured');

    const body = await request.json();
    if (!body.file_data) throw new Error('No file data received');

    const bytes = dataUrlToBytes(body.file_data);
    const fileName = cleanName(body.file_name || 'document');
    const category = cleanName(body.category || 'Other');
    const key = `${category}/${Date.now()}-${fileName}`;

    await env.LIBRARY_BUCKET.put(key, bytes, {
      httpMetadata: { contentType: body.mime_type || 'application/octet-stream' },
      customMetadata: {
        title: body.title || fileName,
        uploaded_by: body.uploaded_by || ''
      }
    });

    const ins = await env.DB.prepare(`INSERT INTO technical_library
      (title, category, reference, keywords, file_name, mime_type, file_key, file_size, uploaded_by)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(
        body.title || fileName,
        body.category || 'Other',
        body.reference || '',
        body.keywords || '',
        fileName,
        body.mime_type || 'application/octet-stream',
        key,
        bytes.length,
        body.uploaded_by || ''
      ).run();

    return Response.json({ ok:true, id: ins.meta?.last_row_id, key });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    await ensureTables(env);
    if (!env.LIBRARY_BUCKET) throw new Error('R2 binding LIBRARY_BUCKET is not configured');

    const body = await request.json();
    const id = Number(body.id);
    if (!id) throw new Error('Missing document id');

    const doc = await env.DB.prepare('SELECT * FROM technical_library WHERE id=?').bind(id).first();
    if (!doc) throw new Error('Document not found');

    if (doc.file_key) await env.LIBRARY_BUCKET.delete(doc.file_key);

    await env.DB.prepare('INSERT INTO library_access_log (document_id, opened_by, action) VALUES (?,?,?)')
      .bind(id, body.manager || '', 'delete').run();

    const del = await env.DB.prepare('DELETE FROM technical_library WHERE id=?').bind(id).run();
    return Response.json({ ok:true, deleted: del.meta?.changes || 0 });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
