
async function ensureTraining(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (id INTEGER PRIMARY KEY AUTOINCREMENT,engineer_name TEXT,training_type TEXT,assigned_date TEXT,completion_date TEXT,status TEXT DEFAULT 'Open',audit_ref TEXT,manager_name TEXT,manager_notes TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
}
function hasSafetyCriticalIssue(b){
  const cls=String(b.classification||b.safety_classification||'').toUpperCase();
  if(['ID','AR','NCS'].includes(cls)) return true;
  const qs=Array.isArray(b.questions)?b.questions:[];
  return qs.some(q=>{
    const sec=String(q.section||'').toLowerCase();
    const question=String(q.question||'').toLowerCase();
    const response=String(q.response||q.score||q.assessment||'').toLowerCase();
    const safety=(sec.includes('safety')||question.includes('ventilation')||question.includes('flue')||question.includes('tightness')||question.includes('isolation')||question.includes('defects classified'));
    return safety && (response.includes('fail')||response==='0'||response==='5'||response.includes('improvement'));
  });
}
async function assignAuditTraining(env,b,id,ref,result){
  try{
    await ensureTraining(env);
    const today=new Date().toISOString().slice(0,10);
    const engineer=b.engineer_name||'';
    const manager=b.auditor||b.manager_name||'';
    if(!engineer) return;
    if(['Improvement Required','Fail'].includes(result)){
      await env.DB.prepare('INSERT INTO training_records (engineer_name,training_type,assigned_date,status,audit_ref,manager_name,manager_notes) VALUES (?,?,?,?,?,?,?)')
        .bind(engineer,'Post-Audit Refresher Test',today,'Open',ref,manager,'Automatically assigned from audit outcome: '+result).run();
    }
    if(hasSafetyCriticalIssue(b)){
      await env.DB.prepare('INSERT INTO training_records (engineer_name,training_type,assigned_date,status,audit_ref,manager_name,manager_notes) VALUES (?,?,?,?,?,?,?)')
        .bind(engineer,'Gas Safety / Unsafe Situations Test',today,'Open',ref,manager,'Automatically assigned from safety-critical audit finding.').run();
    }
  }catch(e){console.log('Training assignment skipped:',e.message)}
}

function outcome(score){
  score=Number(score||0);
  return score>=95?'Excellent':score>=85?'Pass':score>=75?'Improvement Required':'Fail';
}
async function tableColumns(env, table){
  try{
    const r=await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (r.results||[]).map(x=>String(x.name));
  }catch(e){return []}
}
function pickClientColumn(cols){
  if(cols.includes('client')) return 'client';
  if(cols.includes('client_name')) return 'client_name';
  return null;
}
export async function onRequestGet({request,env}){
  try{
    const u=new URL(request.url),role=u.searchParams.get('role')||'engineer',eng=u.searchParams.get('engineer')||'';
    let rows;
    if(role==='manager') rows=await env.DB.prepare('SELECT * FROM audits ORDER BY id DESC').all();
    else if(role==='senior_engineer') rows=await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_name)=lower(?) OR lower(auditor)=lower(?) ORDER BY id DESC').bind(eng,eng).all();
    else rows=await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC').bind(eng).all();
    const audits=(rows.results||[]).map(r=>({
      ...r,
      client: r.client ?? r.client_name ?? '',
      ref: r.audit_ref || r.ref || `HBS-${r.id}`
    }));
    return Response.json({ok:true,audits});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPost({request,env}){
  try{
    const b=await request.json();
    if(!['manager','senior_engineer'].includes(b.role||'')) return Response.json({ok:false,error:'Only managers or senior engineers can create audits'},{status:403});
    const score=Number(b.score||0), result=b.result||outcome(score);
    const cols=await tableColumns(env,'audits');
    const clientCol=pickClientColumn(cols);
    const data={
      engineer_name:b.engineer_name||'',
      site_name:b.site_name||'',
      audit_date:b.audit_date||new Date().toISOString().slice(0,10),
      auditor:b.auditor||'',
      appliance_type:b.audit_type||b.appliance_type||'',
      manufacturer:b.manufacturer||'',
      model:b.model||'',
      asset_number:b.asset_number||'',
      serial_number:b.serial_number||'',
      score,
      result,
      findings:b.findings||'',
      training_required:b.training_required||'',
      audit_json:JSON.stringify((()=>{ const {photos, photo_data, photoData, ...rest}=b; return rest; })())
    };
    if(clientCol) data[clientCol]=b.client||b.client_name||'';
    const useCols=Object.keys(data).filter(c=>!cols.length || cols.includes(c));
    if(!useCols.length) throw new Error('No matching audit columns found.');
    const placeholders=useCols.map(()=>'?').join(',');
    const sql=`INSERT INTO audits (${useCols.join(',')}) VALUES (${placeholders})`;
    const ins=await env.DB.prepare(sql).bind(...useCols.map(c=>data[c])).run();
    const id=ins.meta?.last_row_id;
    const ref=`HBS-${id}`;
    await assignAuditTraining(env,b,id,ref,result);
    // Store photos separately from audit_json. Do not fail the audit if photo storage is unavailable.
    try{
      const photos=Array.isArray(b.photos)?b.photos:[];
      if(id && photos.length){
        for(const p of photos.slice(0,8)){
          const name=p.filename||p.photo_name||'audit-photo.jpg';
          const url=p.data_url||p.photo_url||'';
          // D1 has row/cell size limits, so skip uncompressed or oversized data URLs.
          if(url && url.length < 900000){
            await env.DB.prepare('INSERT INTO audit_photos (audit_id, photo_name, photo_url) VALUES (?,?,?)').bind(id,name,url).run();
          }
        }
      }
    }catch(photoErr){console.log('Photo save skipped:', photoErr.message)}
    return Response.json({ok:true,id,ref,score,result});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
