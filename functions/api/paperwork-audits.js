
function normalise(v){return String(v||'').trim().toLowerCase()}
function isBadResponse(q){
  const v=normalise(q.response_value||q.response);
  return ['fail','improve','improvement required','minor','minor issue'].includes(v);
}
function isCriticalResponse(q){
  const v=normalise(q.response_value||q.response);
  return ['fail','improve','improvement required'].includes(v);
}
function analyseCp15Paperwork(questions){
  const flags=[];
  const qs=Array.isArray(questions)?questions:[];
  const rules=[
    {key:'cp15_complete', match:['cp15 or service sheet fully completed'], title:'CP15 / service sheet incomplete', severity:'major', penalty:6, action:'Engineer must correct the service record and confirm all mandatory CP15/service sections are completed.'},
    {key:'combustion', match:['combustion readings recorded'], title:'Missing combustion readings or justification', severity:'critical', penalty:10, action:'Engineer must provide combustion readings or a clear technical justification where readings could not be taken.'},
    {key:'working_pressure', match:['working pressure','inlet pressure'], title:'Missing gas working / inlet pressure evidence', severity:'critical', penalty:8, action:'Engineer must record working pressure/inlet pressure or provide a reasoned justification.'},
    {key:'gas_rate', match:['gas rate','burner input'], title:'Missing gas rate / burner input evidence', severity:'major', penalty:6, action:'Engineer must record gas rate/burner input where applicable or justify N/A.'},
    {key:'local_tightness', match:['local tightness','regulation 26(9)'], title:'Missing Local Gas Tightness Test / Regulation 26(9) evidence', severity:'critical', penalty:12, action:'Engineer must confirm Local Gas Tightness Test evidence and Regulation 26(9) compliance where applicable.'},
    {key:'unsafe_notice', match:['warning notices','unsafe situations'], title:'Unsafe situation / warning notice documentation issue', severity:'critical', penalty:12, action:'Manager must review unsafe situation documentation and confirm correct warning notice process.'},
    {key:'defects', match:['defects and recommendations'], title:'Defects or recommendations not clearly documented', severity:'major', penalty:6, action:'Engineer must update defects/recommendations with clear client-facing corrective information.'},
    {key:'evidence_photos', match:['photographs attached'], title:'Required photographic evidence missing', severity:'major', penalty:4, action:'Engineer must attach supporting evidence where required by HBS procedure.'}
  ];
  for(const q of qs){
    const text=normalise((q.section||'')+' '+(q.question||''));
    for(const r of rules){
      if(r.match.some(m=>text.includes(m)) && isBadResponse(q)){
        flags.push({key:r.key,title:r.title,severity:r.severity,penalty:r.penalty,response:q.response||q.response_value||'',finding:q.finding||'',corrective_action:q.corrective_action||r.action,action:r.action});
      }
    }
  }
  const penalty=Math.min(30, flags.reduce((a,f)=>a+Number(f.penalty||0),0));
  const critical=flags.filter(f=>f.severity==='critical').length;
  const major=flags.filter(f=>f.severity==='major').length;
  const status=critical?'Critical Review':major?'Manager Review':'Clear';
  return {schema:'v14.3.1-cp15-paperwork-intelligence',status,penalty,critical,major,flags};
}

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
    const cp15_intelligence=analyseCp15Paperwork(b.questions||[]);
    const details={questions:b.questions||[], cp15_intelligence, created_by:b.auditor||'', schema:'v14.3.1-paperwork-audit'};
    const ins=await env.DB.prepare(`INSERT INTO paperwork_audits (engineer_name,site_name,job_ref,audit_date,auditor,score,outcome,details_json) VALUES (?,?,?,?,?,?,?,?)`).bind(
      b.engineer_name||'', b.site_name||'', b.job_ref||'', b.audit_date||new Date().toISOString().slice(0,10), b.auditor||'', Number(b.score||0), b.outcome||'', JSON.stringify(details)
    ).run();
    return Response.json({ok:true,id:ins.meta?.last_row_id,cp15_intelligence});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500});}
}
