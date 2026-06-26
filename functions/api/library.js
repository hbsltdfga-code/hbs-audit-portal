async function ensureTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS technical_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    category TEXT,
    reference TEXT,
    keywords TEXT,
    file_name TEXT,
    mime_type TEXT,
    file_data TEXT,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS library_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,
    opened_by TEXT,
    action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
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
      return Response.json({ ok:true, document: doc });
    }

    const q = '%' + (url.searchParams.get('q') || '').toLowerCase() + '%';
    const category = url.searchParams.get('category') || '';

    let rows;
    if (category) {
      rows = await env.DB.prepare(`SELECT id,title,category,reference,keywords,file_name,mime_type,uploaded_by,created_at
        FROM technical_library
        WHERE category=? AND (lower(title) LIKE ? OR lower(reference) LIKE ? OR lower(keywords) LIKE ? OR lower(file_name) LIKE ?)
        ORDER BY category, title`)
        .bind(category, q, q, q, q).all();
    } else {
      rows = await env.DB.prepare(`SELECT id,title,category,reference,keywords,file_name,mime_type,uploaded_by,created_at
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
    const body = await request.json();
    if (!body.file_data) throw new Error('No file data received');
    if ((body.file_data || '').length > 11000000) throw new Error('File too large for D1 storage');

    const ins = await env.DB.prepare(`INSERT INTO technical_library
      (title, category, reference, keywords, file_name, mime_type, file_data, uploaded_by)
      VALUES (?,?,?,?,?,?,?,?)`)
      .bind(
        body.title || body.file_name || 'Untitled document',
        body.category || 'Other',
        body.reference || '',
        body.keywords || '',
        body.file_name || '',
        body.mime_type || '',
        body.file_data || '',
        body.uploaded_by || ''
      ).run();

    return Response.json({ ok:true, id: ins.meta?.last_row_id });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    await ensureTables(env);
    const body = await request.json();
    const id = Number(body.id);
    if (!id) throw new Error('Missing document id');

    await env.DB.prepare('INSERT INTO library_access_log (document_id, opened_by, action) VALUES (?,?,?)')
      .bind(id, body.manager || '', 'delete').run();

    const del = await env.DB.prepare('DELETE FROM technical_library WHERE id=?').bind(id).run();
    return Response.json({ ok:true, deleted: del.meta?.changes || 0 });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
