export async function onRequestGet({ request, env }) {
  try { const url=new URL(request.url); const role=url.searchParams.get('role')||'manager'; const engineer=url.searchParams.get('engineer')||''; let rows;
    if(role==='engineer') rows=await env.DB.prepare('SELECT * FROM reaudits WHERE lower(engineer_name)=lower(?) ORDER BY due_date DESC,id DESC').bind(engineer).all();
    else rows=await env.DB.prepare('SELECT * FROM reaudits ORDER BY due_date DESC,id DESC').all();
    return Response.json({ok:true,reaudits:rows.results||[]});
  } catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPost({ request, env }) {
  try { const b=await request.json(); const id=Number(b.id); const status=b.status||'Completed'; const completionDate=new Date().toISOString().slice(0,10); await env.DB.prepare('UPDATE reaudits SET status=?, completed_date=? WHERE id=?').bind(status,completionDate,id).run(); return Response.json({ok:true,id,status});
  } catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}