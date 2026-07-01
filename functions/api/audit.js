export async function onRequestGet({request,env}){
  try{
    const u=new URL(request.url);
    const id=u.searchParams.get('id');
    const role=String(u.searchParams.get('role')||'engineer').toLowerCase();
    const engineer=String(u.searchParams.get('engineer')||'').trim();
    if(!id)return Response.json({ok:false,error:'Audit id is required'},{status:400});
    const audit=await env.DB.prepare('SELECT * FROM audits WHERE id=?').bind(id).first();
    if(!audit)return Response.json({ok:false,error:'Audit not found'},{status:404});
    if(!['manager','senior_engineer'].includes(role)){
      if(!engineer || String(audit.engineer_name||'').trim().toLowerCase()!==engineer.toLowerCase()){
        return Response.json({ok:false,error:'Access denied for this audit'},{status:403});
      }
    }
    let photos=[];
    try{photos=(await env.DB.prepare('SELECT photo_name, photo_url FROM audit_photos WHERE audit_id=?').bind(id).all()).results||[]}catch(e){}
    return Response.json({ok:true,audit,photos});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
