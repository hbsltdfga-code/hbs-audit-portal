async function ensure(env){
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
  )`).run()
}
export async function onRequestGet({request,env}){
  try{
    await ensure(env);
    const u=new URL(request.url);
    const id=u.searchParams.get('id');
    if(id){
      const doc=await env.DB.prepare('SELECT * FROM technical_library WHERE id=?').bind(id).first();
      if(!doc)return Response.json({ok:false,error:'Document not found'},{status:404});
      return Response.json({ok:true,document:{...doc,file_url:`/api/library-file?id=${encodeURIComponent(id)}`}});
    }
    const q=(u.searchParams.get('q')||'').toLowerCase();
    const cat=u.searchParams.get('category')||'';
    let rows;
    if(q&&cat){
      rows=await env.DB.prepare(`SELECT * FROM technical_library WHERE category=? AND (lower(title) LIKE ? OR lower(reference) LIKE ? OR lower(keywords) LIKE ?) ORDER BY id DESC LIMIT 1000`).bind(cat,`%${q}%`,`%${q}%`,`%${q}%`).all();
    }else if(q){
      rows=await env.DB.prepare(`SELECT * FROM technical_library WHERE lower(title) LIKE ? OR lower(reference) LIKE ? OR lower(keywords) LIKE ? OR lower(category) LIKE ? ORDER BY id DESC LIMIT 1000`).bind(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`).all();
    }else if(cat){
      rows=await env.DB.prepare(`SELECT * FROM technical_library WHERE category=? ORDER BY id DESC LIMIT 1000`).bind(cat).all();
    }else{
      rows=await env.DB.prepare('SELECT * FROM technical_library ORDER BY id DESC LIMIT 1000').all();
    }
    return Response.json({ok:true,documents:rows.results||[]});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
