async function columnNames(env, table){try{return ((await env.DB.prepare(`PRAGMA table_info(${table})`).all()).results||[]).map(c=>c.name)}catch(e){return []}}
async function ensureColumn(env, table, name, type){const c=await columnNames(env,table);if(!c.includes(name)){try{await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run()}catch(e){}}}
async function ensure(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS technical_library (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,category TEXT,reference TEXT,issue TEXT,version TEXT,keywords TEXT,file_name TEXT,mime_type TEXT,file_key TEXT,r2_key TEXT,file_size INTEGER,status TEXT DEFAULT 'Current',uploaded_by TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
 await ensureColumn(env,'technical_library','issue','TEXT');
 await ensureColumn(env,'technical_library','version','TEXT');
 await ensureColumn(env,'technical_library','r2_key','TEXT');
 await ensureColumn(env,'technical_library','status',"TEXT DEFAULT 'Current'");
}
function safeName(n){return String(n||'document').replace(/[\\/<>:"|?*]+/g,'_').replace(/\s+/g,'_').slice(0,160)}
function slug(v){return String(v||'general').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'general'}
export async function onRequestPost({request,env}){
 try{
  if(!env.LIBRARY_BUCKET) return Response.json({ok:false,error:'R2 binding LIBRARY_BUCKET is not configured.'},{status:500});
  await ensure(env);
  const form=await request.formData();
  const file=form.get('file');
  if(!file || typeof file.arrayBuffer!=='function') return Response.json({ok:false,error:'No file received.'},{status:400});
  const title=String(form.get('title')||file.name||'Untitled Document').trim();
  const category=String(form.get('category')||'Forms & Templates').trim();
  const reference=String(form.get('reference')||'').trim();
  const issue=String(form.get('issue')||'').trim();
  const version=String(form.get('version')||'').trim();
  const keywords=String(form.get('keywords')||'').trim();
  const uploadedBy=String(form.get('uploaded_by')||'').trim();
  const fileName=safeName(file.name);
  const key=`knowledge/${slug(category)}/${Date.now()}-${fileName}`;
  const buf=await file.arrayBuffer();
  await env.LIBRARY_BUCKET.put(key,buf,{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{title,category,uploadedBy}});
  const ins=await env.DB.prepare(`INSERT INTO technical_library (title,category,reference,issue,version,keywords,file_name,mime_type,file_key,r2_key,file_size,status,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(title,category,reference,issue,version,keywords,file.name||fileName,file.type||'application/octet-stream',key,key,Number(file.size||buf.byteLength||0),'Current',uploadedBy).run();
  return Response.json({ok:true,id:ins.meta?.last_row_id,r2_key:key,size:Number(file.size||buf.byteLength||0)});
 }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
