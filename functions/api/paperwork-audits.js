async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS paperwork_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    site_name TEXT,
    job_ref TEXT,
    audit_date TEXT,
    auditor TEXT,
    score REAL,
    outcome TEXT,
    details_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS compliance_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT, source_id INTEGER, engineer_name TEXT, audit_ref TEXT, title TEXT, detail TEXT,
    priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'Open', assigned_to TEXT, due_date TEXT,
    created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
function parseCp15Actions(b,id){
  const qs=Array.isArray(b.questions)?b.questions:[];
  const checks=[['CP15 Local Tightness Test','local tightness'],['CP15 Combustion Readings','combustion'],['CP15 Gas Pressure','working pressure'],['CP15 Gas Rate','gas rate']];
  const out=[];
  for(const [title,needle] of checks){const q=qs.find(x=>String(x.question||'').toLowerCase().includes(needle));if(q&&['fail','improve'].includes(String(q.response_value||'').toLowerCase()))out.push({title,detail:(q.finding||q.corrective_action||q.question||title),priority:String(q.response_value).toLowerCase()==='fail'?'high':'medium'});}
  return out;
}

export async function onRequestGet({request,env}){
  try{
    await ensure(env);
    const u=new URL(request.url), id=u.searchParams.get('id'), role=u.searchParams.get('role')||'engineer', eng=u.searchParams.get('engineer')||'';
    if(id){const audit=await env.DB.prepare('SELECT * FROM paperwork_audits WHERE id=?').bind(Number(id)).first();return Response.json({ok:!!audit,audit});}
    let rows;
    if(['manager','director','admin'].includes(String(role).toLowerCase())) rows=await env.DB.prepare('SELECT * FROM paperwork_audits ORDER BY id DESC LIMIT 500').all();
    else rows=await env.DB.prepare('SELECT * FROM paperwork_audits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC LIMIT 200').bind(eng).all();
    return Response.json({ok:true,audits:rows.results||[]});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500});}
}
export async function onRequestPost({request,env}){
  try{
    await ensure(env);
    const b=await request.json();
    if(!['manager','senior_engineer'].includes(b.role||'')) return Response.json({ok:false,error:'Only managers or senior engineers can create paperwork audits'},{status:403});
    if(!b.engineer_name||!b.site_name) return Response.json({ok:false,error:'Engineer and site/client are required.'},{status:400});
    const details={questions:b.questions||[], created_by:b.auditor||'', schema:'v14-paperwork-audit'};
    const ins=await env.DB.prepare(`INSERT INTO paperwork_audits (engineer_name,site_name,job_ref,audit_date,auditor,score,outcome,details_json) VALUES (?,?,?,?,?,?,?,?)`).bind(
      b.engineer_name||'', b.site_name||'', b.job_ref||'', b.audit_date||new Date().toISOString().slice(0,10), b.auditor||'', Number(b.score||0), b.outcome||'', JSON.stringify(details)
    ).run();
    const newId=ins.meta?.last_row_id;
    for(const a of parseCp15Actions(b,newId)){
      await env.DB.prepare(`INSERT INTO compliance_actions (source,source_id,engineer_name,audit_ref,title,detail,priority,status,assigned_to,due_date,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .bind('paperwork_audit',Number(newId||0),b.engineer_name||'',b.job_ref||'',a.title,a.detail,a.priority,'Open',b.engineer_name||'',b.audit_date||new Date().toISOString().slice(0,10),b.auditor||'').run();
    }
    return Response.json({ok:true,id:newId});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500});}
}
