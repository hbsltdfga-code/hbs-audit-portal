async function columnNames(env, table){
  try{return ((await env.DB.prepare(`PRAGMA table_info(${table})`).all()).results||[]).map(c=>c.name)}catch(e){return []}
}
async function ensureColumn(env, table, name, type){
  const c=await columnNames(env,table);
  if(!c.includes(name)){try{await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run()}catch(e){}}
}
async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS technical_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    category TEXT,
    reference TEXT,
    issue TEXT,
    version TEXT,
    keywords TEXT,
    file_name TEXT,
    mime_type TEXT,
    file_key TEXT,
    r2_key TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'Current',
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await ensureColumn(env,'technical_library','issue','TEXT');
  await ensureColumn(env,'technical_library','version','TEXT');
  await ensureColumn(env,'technical_library','r2_key','TEXT');
  await ensureColumn(env,'technical_library','status',"TEXT DEFAULT 'Current'");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS library_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,
    opened_by TEXT,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
function displayDoc(doc){
  const key=doc.r2_key||doc.file_key||'';
  return {...doc,r2_key:key,file_key:key,file_url:`/api/library-file?id=${encodeURIComponent(doc.id)}`};
}
export async function onRequestGet({request, env}) {
  try {
    await ensure(env);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const doc = await env.DB.prepare('SELECT * FROM technical_library WHERE id=?').bind(id).first();
      if (!doc) return Response.json({ok:false,error:'Document not found'}, {status:404});
      const openedBy = url.searchParams.get('open_by') || '';
      if (openedBy) await env.DB.prepare('INSERT INTO library_access_log (document_id, opened_by) VALUES (?,?)').bind(Number(id), openedBy).run();
      return Response.json({ok:true, document:displayDoc(doc)});
    }
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const cat = (url.searchParams.get('category') || '').trim();
    const term = `%${q}%`;
    let rows;
    if (q && cat) {
      rows = await env.DB.prepare(`SELECT * FROM technical_library WHERE category=? AND COALESCE(status,'Current')!='Archived' AND (lower(title) LIKE ? OR lower(reference) LIKE ? OR lower(issue) LIKE ? OR lower(keywords) LIKE ? OR lower(file_name) LIKE ? OR lower(uploaded_by) LIKE ?) ORDER BY datetime(created_at) DESC, id DESC LIMIT 1000`).bind(cat,term,term,term,term,term,term).all();
    } else if (q) {
      rows = await env.DB.prepare(`SELECT * FROM technical_library WHERE COALESCE(status,'Current')!='Archived' AND (lower(title) LIKE ? OR lower(category) LIKE ? OR lower(reference) LIKE ? OR lower(issue) LIKE ? OR lower(keywords) LIKE ? OR lower(file_name) LIKE ? OR lower(uploaded_by) LIKE ?) ORDER BY datetime(created_at) DESC, id DESC LIMIT 1000`).bind(term,term,term,term,term,term,term).all();
    } else if (cat) {
      rows = await env.DB.prepare(`SELECT * FROM technical_library WHERE category=? AND COALESCE(status,'Current')!='Archived' ORDER BY datetime(created_at) DESC, id DESC LIMIT 1000`).bind(cat).all();
    } else {
      rows = await env.DB.prepare(`SELECT * FROM technical_library WHERE COALESCE(status,'Current')!='Archived' ORDER BY datetime(created_at) DESC, id DESC LIMIT 1000`).all();
    }
    return Response.json({ok:true, documents:(rows.results||[]).map(displayDoc)});
  } catch(e) { return Response.json({ok:false,error:e.message}, {status:500}); }
}
