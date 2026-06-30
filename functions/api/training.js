const LEVEL1='Level 1 - Commercial Gas Safety Refresher';
const LEVEL2='Level 2 - Advanced Commercial Gas Safety Competency Assessment';

function canonicalTrainingType(type){
  const raw=String(type||'').trim();
  const t=raw.toLowerCase();
  // Order matters: Level 1 contains "gas safety", so identify refresher/toolbox wording first.
  if(t.includes('level 1')||t.includes('post-audit')||t.includes('post audit')||t.includes('refresher')||t.includes('toolbox')) return LEVEL1;
  if(t.includes('level 2')||t.includes('advanced')||t.includes('unsafe')||t.includes('competency assessment')||t.includes('competency')) return LEVEL2;
  return raw;
}

async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (id INTEGER PRIMARY KEY AUTOINCREMENT,engineer_name TEXT,training_type TEXT,assigned_date TEXT,completion_date TEXT,status TEXT DEFAULT 'Open',audit_ref TEXT,manager_name TEXT,manager_notes TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
}

async function normaliseLegacyRows(env){
  // One-way safe data cleanup: convert historic v10 wording to the two official test names.
  await env.DB.prepare(`UPDATE training_records SET training_type=? WHERE lower(training_type) LIKE '%post-audit%' OR lower(training_type) LIKE '%post audit%' OR lower(training_type) LIKE '%refresher%' OR lower(training_type) LIKE '%toolbox%' OR lower(training_type) LIKE '%level 1%'`).bind(LEVEL1).run();
  await env.DB.prepare(`UPDATE training_records SET training_type=? WHERE lower(training_type) LIKE '%level 2%' OR lower(training_type) LIKE '%advanced%' OR lower(training_type) LIKE '%unsafe%' OR lower(training_type) LIKE '%competency%'`).bind(LEVEL2).run();
}

function dedupeOpenRows(rows){
  const seen=new Set();
  const out=[];
  for(const r of rows||[]){
    r.training_type=canonicalTrainingType(r.training_type);
    if(String(r.status||'Open').toLowerCase()==='completed') { out.push(r); continue; }
    const audit=String(r.audit_ref||'').trim() || ('legacy-'+String(r.assigned_date||''));
    const key=[String(r.engineer_name||'').toLowerCase(),r.training_type.toLowerCase(),audit].join('|');
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function onRequestGet({request,env}){
  try{
    await ensure(env);
    await normaliseLegacyRows(env);
    const u=new URL(request.url),role=u.searchParams.get('role')||'engineer',eng=u.searchParams.get('engineer')||'';
    let rows;
    if(role==='manager') rows=await env.DB.prepare('SELECT * FROM training_records ORDER BY id DESC').all();
    else if(role==='senior_engineer') rows={results:[]};
    else rows=await env.DB.prepare('SELECT * FROM training_records WHERE lower(engineer_name)=lower(?) ORDER BY id DESC').bind(eng).all();
    return Response.json({ok:true,training:dedupeOpenRows(rows.results||[])});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}

export async function onRequestPut({request,env}){
  try{
    await ensure(env);
    const b=await request.json();
    const done=b.status==='Completed'?new Date().toISOString().slice(0,10):'';
    await env.DB.prepare('UPDATE training_records SET status=?, completion_date=?, manager_name=?, manager_notes=? WHERE id=?').bind(b.status||'Completed',done,b.manager_name||'',b.manager_notes||'',Number(b.id)).run();
    return Response.json({ok:true,id:b.id})
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
