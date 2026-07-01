async function ensureAuditPhotos(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    photo_name TEXT,
    photo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
function norm(v){return String(v||'').trim()}
function allowed(role){return ['manager','senior_engineer'].includes(String(role||'').toLowerCase())}
export async function onRequestGet({request,env}){
  try{
    const u=new URL(request.url);
    const id=u.searchParams.get('id');
    const role=String(u.searchParams.get('role')||'engineer').toLowerCase();
    const engineer=norm(u.searchParams.get('engineer'));
    if(!id)return Response.json({ok:false,error:'Audit id is required'},{status:400});
    const audit=await env.DB.prepare('SELECT * FROM audits WHERE id=?').bind(id).first();
    if(!audit)return Response.json({ok:false,error:'Audit not found'},{status:404});
    if(!allowed(role)){
      if(!engineer || norm(audit.engineer_name).toLowerCase()!==engineer.toLowerCase()){
        return Response.json({ok:false,error:'Access denied for this audit'},{status:403});
      }
    }
    await ensureAuditPhotos(env);
    let photos=[];
    try{
      photos=(await env.DB.prepare('SELECT photo_name, photo_url, created_at FROM audit_photos WHERE audit_id=? ORDER BY id ASC').bind(id).all()).results||[];
    }catch(e){photos=[];}
    // Legacy fallback: earlier builds may have stored photos inside audit_json.
    if(!photos.length && audit.audit_json){
      try{
        const d=JSON.parse(audit.audit_json||'{}');
        const arr=[];
        ['photos','photo_data','photoData','audit_photos'].forEach(k=>{if(Array.isArray(d[k]))arr.push(...d[k])});
        photos=arr.map((p,i)=>({photo_name:p.photo_name||p.filename||p.name||`Photo ${i+1}`, photo_url:p.photo_url||p.data_url||p.url||p.src||''})).filter(p=>p.photo_url);
      }catch(e){}
    }
    return Response.json({ok:true,audit,photos});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
