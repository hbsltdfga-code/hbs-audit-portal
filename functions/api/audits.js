const LEVEL1='Level 1 - Commercial Gas Safety Refresher';
const LEVEL2='Level 2 - Advanced Commercial Gas Safety Competency Assessment';
function addDays(dateStr,days){const d=dateStr?new Date(dateStr):new Date(); if(Number.isNaN(d.getTime())) return new Date(Date.now()+days*86400000).toISOString().slice(0,10); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10)}
function norm(v){return String(v??'').trim()}function lower(v){return norm(v).toLowerCase()}
function first(...vals){for(const v of vals){if(v!==undefined&&v!==null&&String(v).trim()!=='')return String(v).trim()}return ''}
async function ensureTraining(env){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (id INTEGER PRIMARY KEY AUTOINCREMENT,engineer_name TEXT,training_type TEXT,assigned_date TEXT,completion_date TEXT,status TEXT DEFAULT 'Open',audit_ref TEXT,manager_name TEXT,manager_notes TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run()}
async function ensureReaudits(env){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reaudits (id INTEGER PRIMARY KEY AUTOINCREMENT,audit_ref TEXT,engineer_name TEXT,due_date TEXT,completed_date TEXT,status TEXT DEFAULT 'Open',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run()}
function hasSafetyCriticalIssue(b){
  const cls=norm(b.classification||b.safety_classification||'').toUpperCase();
  if(['ID','AR'].includes(cls)) return true;
  const qs=Array.isArray(b.questions)?b.questions:[];
  return qs.some(q=>{
    const sec=lower(q.section), question=lower(q.question), response=lower(q.response||q.response_value||q.score||q.assessment);
    const safety=sec.includes('safety')||question.includes('ventilation')||question.includes('flue')||question.includes('tightness')||question.includes('isolation')||question.includes('defects classified');
    return safety && (response.includes('fail')||response==='0');
  });
}
function trainingFor(score,result,safetyCritical){
  score=Number(score||0); result=norm(result);
  if(safetyCritical || score<75 || result==='Fail') return {type:LEVEL2,notes:safetyCritical?'Automatically assigned from safety-critical audit finding.':'Automatically assigned because audit score was below 75%.'};
  if(score>=75 && score<85) return {type:LEVEL1,notes:'Automatically assigned because audit score was between 75% and 84%: '+score+'%.'};
  return null;
}
async function insertTrainingIfMissing(env,engineer,ref,assigned,type,manager,notes){
  const existing=await env.DB.prepare(`SELECT id FROM training_records WHERE lower(engineer_name)=lower(?) AND audit_ref=? AND training_type=? AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved') LIMIT 1`).bind(engineer,ref,type).first().catch(()=>null);
  if(existing&&existing.id) return;
  await env.DB.prepare('INSERT INTO training_records (engineer_name,training_type,assigned_date,status,audit_ref,manager_name,manager_notes) VALUES (?,?,?,?,?,?,?)').bind(engineer,type,assigned,'Open',ref,manager||'',notes||'').run();
}
async function insertReauditIfMissing(env,engineer,ref,auditDate){
  await ensureReaudits(env);
  const existing=await env.DB.prepare(`SELECT id FROM reaudits WHERE lower(engineer_name)=lower(?) AND audit_ref=? AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed') LIMIT 1`).bind(engineer,ref).first().catch(()=>null);
  if(existing&&existing.id) return;
  await env.DB.prepare('INSERT INTO reaudits (audit_ref,engineer_name,due_date,status) VALUES (?,?,?,?)').bind(ref,engineer,addDays(auditDate,30),'Open').run();
}
async function assignAuditTraining(env,audit,id,ref,result){
  try{
    await ensureTraining(env);
    const assigned=audit.audit_date||new Date().toISOString().slice(0,10);
    const engineer=first(audit.engineer_name,audit.engineer,audit.aEngineer,audit.engineerName);
    if(!engineer) { console.log('Training assignment skipped: no engineer on audit '+ref); return; }
    const manager=first(audit.auditor,audit.manager_name,audit.managerName);
    const score=Number(audit.score||0);
    const action=trainingFor(score,result,hasSafetyCriticalIssue(audit));
    if(action){
      await insertTrainingIfMissing(env,engineer,ref,assigned,action.type,manager,action.notes);
      await insertReauditIfMissing(env,engineer,ref,assigned);
    }
  }catch(e){console.log('Training assignment skipped:',e.message)}
}
function outcome(score){score=Number(score||0);return score>=95?'Excellent':score>=85?'Pass':score>=75?'Improvement Required':'Fail'}
async function tableColumns(env, table){try{const r=await env.DB.prepare(`PRAGMA table_info(${table})`).all();return (r.results||[]).map(x=>String(x.name))}catch(e){return []}}
function pickClientColumn(cols){if(cols.includes('client')) return 'client'; if(cols.includes('client_name')) return 'client_name'; return null}
export async function onRequestGet({request,env}){try{const u=new URL(request.url),role=u.searchParams.get('role')||'engineer',eng=u.searchParams.get('engineer')||'';let rows;if(role==='manager') rows=await env.DB.prepare('SELECT * FROM audits ORDER BY id DESC').all();else if(role==='senior_engineer') rows=await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_name)=lower(?) OR lower(auditor)=lower(?) ORDER BY id DESC').bind(eng,eng).all();else rows=await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC').bind(eng).all();const audits=(rows.results||[]).map(r=>({...r,client:r.client??r.client_name??'',ref:r.audit_ref||r.ref||`HBS-${r.id}`}));return Response.json({ok:true,audits})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}}
export async function onRequestPost({request,env}){try{const b=await request.json();if(!['manager','senior_engineer'].includes(b.role||'')) return Response.json({ok:false,error:'Only managers or senior engineers can create audits'},{status:403});const score=Number(b.score||0), result=b.result||outcome(score);const cols=await tableColumns(env,'audits');const clientCol=pickClientColumn(cols);const data={engineer_name:first(b.engineer_name,b.engineer,b.aEngineer,b.engineerName),site_name:first(b.site_name,b.site,b.aSite, b.siteName),audit_date:first(b.audit_date,b.date,b.aDate)||new Date().toISOString().slice(0,10),auditor:first(b.auditor,b.aAuditor,b.manager_name),appliance_type:first(b.audit_type,b.appliance_type),manufacturer:first(b.manufacturer,b.aManufacturer),model:first(b.model,b.aModel),asset_number:first(b.asset_number,b.asset,b.aAsset),serial_number:first(b.serial_number,b.serial,b.aSerial),score,result,findings:b.findings||b.aFindings||'',training_required:b.training_required||b.aTraining||'',audit_json:JSON.stringify((()=>{const {photos,photo_data,photoData,...rest}=b;return rest})())};if(clientCol) data[clientCol]=first(b.client,b.client_name,b.aClient);const useCols=Object.keys(data).filter(c=>!cols.length||cols.includes(c));if(!useCols.length) throw new Error('No matching audit columns found.');const sql=`INSERT INTO audits (${useCols.join(',')}) VALUES (${useCols.map(()=>'?').join(',')})`;const ins=await env.DB.prepare(sql).bind(...useCols.map(c=>data[c])).run();const id=ins.meta?.last_row_id;const ref=`HBS-${id}`;const workflowAudit={...b,...data,questions:Array.isArray(b.questions)?b.questions:[],classification:b.classification,safety_classification:b.safety_classification};await assignAuditTraining(env,workflowAudit,id,ref,result);try{const photos=Array.isArray(b.photos)?b.photos:[];if(id&&photos.length){for(const p of photos.slice(0,8)){const name=p.filename||p.photo_name||'audit-photo.jpg';const url=p.data_url||p.photo_url||'';if(url&&url.length<900000){await env.DB.prepare('INSERT INTO audit_photos (audit_id, photo_name, photo_url) VALUES (?,?,?)').bind(id,name,url).run()}}}}catch(photoErr){console.log('Photo save skipped:',photoErr.message)}return Response.json({ok:true,id,ref,score,result})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}}
