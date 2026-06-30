const LEVEL1='Level 1 - Commercial Gas Safety Refresher';
const LEVEL2='Level 2 - Advanced Commercial Gas Safety Competency Assessment';
function addDays(dateStr,days){const d=dateStr?new Date(dateStr):new Date();if(Number.isNaN(d.getTime()))return new Date(Date.now()+days*86400000).toISOString().slice(0,10);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function norm(v){return String(v||'').trim()}function lower(v){return norm(v).toLowerCase()}
async function cols(env,table){try{return ((await env.DB.prepare(`PRAGMA table_info(${table})`).all()).results||[]).map(c=>c.name)}catch(e){return[]}}
async function ensureColumn(env,table,name,type){const c=await cols(env,table);if(!c.includes(name)){try{await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run()}catch(e){}}}
async function ensureTraining(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (id INTEGER PRIMARY KEY AUTOINCREMENT,engineer_name TEXT,training_type TEXT,assigned_date TEXT,completion_date TEXT,status TEXT DEFAULT 'Open',audit_ref TEXT,due_date TEXT,manager_name TEXT,manager_notes TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
 await ensureColumn(env,'training_records','audit_ref','TEXT');
 await ensureColumn(env,'training_records','due_date','TEXT');
 await ensureColumn(env,'training_records','manager_name','TEXT');
 await ensureColumn(env,'training_records','manager_notes','TEXT');
 await ensureColumn(env,'training_records','created_at','DATETIME DEFAULT CURRENT_TIMESTAMP');
}
async function ensureReaudits(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reaudits (id INTEGER PRIMARY KEY AUTOINCREMENT,audit_id INTEGER,audit_ref TEXT,engineer_name TEXT,due_date TEXT,completed_date TEXT,status TEXT DEFAULT 'Open',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
 await ensureColumn(env,'reaudits','audit_id','INTEGER');
 await ensureColumn(env,'reaudits','audit_ref','TEXT');
 await ensureColumn(env,'reaudits','created_at','DATETIME DEFAULT CURRENT_TIMESTAMP');
}
function hasSafetyCriticalIssue(b){
 const cls=norm(b.classification||b.safety_classification||'').toUpperCase();
 if(['ID','AR'].includes(cls))return true;
 const qs=Array.isArray(b.questions)?b.questions:[];
 return qs.some(q=>{
   const response=lower(q.response||q.response_value||q.score||q.assessment);
   if(!(response.includes('fail')||response==='0'))return false;
   const text=lower([q.finding,q.findings,q.note,q.notes,q.corrective_action,q.evidence,q.technical_reference,q.question].filter(Boolean).join(' '));
   return text.includes('immediately dangerous')||text.includes(' at risk')||text.includes(' ar ')||text.includes(' id ')||text.includes('unsafe')||text.includes('gas leak')||text.includes('smell of gas');
 });
}
function trainingFor(score,result,safetyCritical){score=Number(score||0);result=norm(result);if(safetyCritical)return{type:LEVEL2,notes:'Safety-critical audit finding requiring Level 2 assessment.'};if(score<75||result==='Fail')return{type:LEVEL2,notes:'Audit score below 75% requiring Level 2 assessment.'};if(score>=75&&score<85)return{type:LEVEL1,notes:'Improvement Required audit outcome requiring Level 1 refresher.'};return null}
async function insertTrainingIfMissing(env,engineer,ref,assigned,due,type,manager,notes){
 await ensureTraining(env);
 const existing=await env.DB.prepare(`SELECT id FROM training_records WHERE lower(engineer_name)=lower(?) AND COALESCE(audit_ref,'')=? AND training_type=? AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved') LIMIT 1`).bind(engineer,ref,type).first().catch(()=>null);
 if(existing&&existing.id)return;
 await env.DB.prepare('INSERT INTO training_records (engineer_name,training_type,assigned_date,due_date,status,audit_ref,manager_name,manager_notes) VALUES (?,?,?,?,?,?,?,?)').bind(engineer,type,assigned,due,'Open',ref,manager||'',notes||'').run();
}
async function insertReauditIfMissing(env,engineer,ref,auditId,auditDate){
 await ensureReaudits(env);
 const existing=await env.DB.prepare(`SELECT id FROM reaudits WHERE lower(engineer_name)=lower(?) AND (COALESCE(audit_ref,'')=? OR audit_id=?) AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed') LIMIT 1`).bind(engineer,ref,Number(auditId||0)).first().catch(()=>null);
 if(existing&&existing.id)return;
 await env.DB.prepare('INSERT INTO reaudits (audit_id,audit_ref,engineer_name,due_date,status) VALUES (?,?,?,?,?)').bind(Number(auditId||0),ref,engineer,addDays(auditDate,30),'Open').run();
}
async function assignAuditTraining(env,a,id,ref,result){try{const assigned=a.audit_date||new Date().toISOString().slice(0,10);const engineer=a.engineer_name||a.engineer||'';if(!engineer)return;const manager=a.auditor||a.manager_name||'';const score=Number(a.score||0);const action=trainingFor(score,result,hasSafetyCriticalIssue(a));if(action){const due=addDays(assigned,30);await insertTrainingIfMissing(env,engineer,ref,assigned,due,action.type,manager,action.notes);await insertReauditIfMissing(env,engineer,ref,id,assigned)}}catch(e){console.log('Training assignment skipped:',e.message)}}
function workflowActionText(score,result,safetyCritical){score=Number(score||0);result=norm(result);if(safetyCritical)return 'Level 2 Advanced Competency Assessment required due to safety-critical finding. Manager review and re-audit required.';if(score<75||result==='Fail')return 'Level 2 Advanced Competency Assessment required. Manager review and re-audit within 30 days.';if(score>=75&&score<85)return 'Level 1 Commercial Gas Safety Refresher required. Re-audit within 30 days.';return 'No further action required.'}
function outcome(score){score=Number(score||0);return score>=95?'Excellent':score>=85?'Pass':score>=75?'Improvement Required':'Fail'}
async function tableColumns(env,table){try{return((await env.DB.prepare(`PRAGMA table_info(${table})`).all()).results||[]).map(x=>String(x.name))}catch(e){return[]}}
function pickClientColumn(cols){if(cols.includes('client'))return'client';if(cols.includes('client_name'))return'client_name';return null}
export async function onRequestGet({request,env}){try{const u=new URL(request.url),role=u.searchParams.get('role')||'engineer',eng=u.searchParams.get('engineer')||'';let rows;if(role==='manager')rows=await env.DB.prepare('SELECT * FROM audits ORDER BY id DESC').all();else if(role==='senior_engineer')rows=await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_name)=lower(?) OR lower(auditor)=lower(?) ORDER BY id DESC').bind(eng,eng).all();else rows=await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC').bind(eng).all();const audits=(rows.results||[]).map(r=>({...r,client:r.client??r.client_name??'',ref:r.audit_ref||r.ref||`HBS-${r.id}`}));return Response.json({ok:true,audits})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}}
export async function onRequestPost({request,env}){try{const b=await request.json();if(!['manager','senior_engineer'].includes(b.role||''))return Response.json({ok:false,error:'Only managers or senior engineers can create audits'},{status:403});const score=Number(b.score||0),result=b.result||outcome(score);const auditCols=await tableColumns(env,'audits');const clientCol=pickClientColumn(auditCols);const data={engineer_name:b.engineer_name||b.engineer||'',site_name:b.site_name||b.site||'',audit_date:b.audit_date||b.date||new Date().toISOString().slice(0,10),auditor:b.auditor||'',appliance_type:b.audit_type||b.appliance_type||'',manufacturer:b.manufacturer||'',model:b.model||'',asset_number:b.asset_number||'',serial_number:b.serial_number||'',score,result,findings:b.findings||'',training_required:workflowActionText(score,result,hasSafetyCriticalIssue(b)),audit_json:JSON.stringify((()=>{const{photos,photo_data,photoData,...rest}=b;rest.training_required=workflowActionText(score,result,hasSafetyCriticalIssue(b));return rest})())};if(clientCol)data[clientCol]=b.client||b.client_name||'';const useCols=Object.keys(data).filter(c=>!auditCols.length||auditCols.includes(c));if(!useCols.length)throw new Error('No matching audit columns found.');const sql=`INSERT INTO audits (${useCols.join(',')}) VALUES (${useCols.map(()=>'?').join(',')})`;const ins=await env.DB.prepare(sql).bind(...useCols.map(c=>data[c])).run();const id=ins.meta?.last_row_id;const ref=`HBS-${id}`;const saved={...b,...data,id,ref,result,score};await assignAuditTraining(env,saved,id,ref,result);try{const photos=Array.isArray(b.photos)?b.photos:[];if(id&&photos.length){for(const p of photos.slice(0,8)){const name=p.filename||p.photo_name||'audit-photo.jpg';const url=p.data_url||p.photo_url||'';if(url&&url.length<900000)await env.DB.prepare('INSERT INTO audit_photos (audit_id, photo_name, photo_url) VALUES (?,?,?)').bind(id,name,url).run()}}}catch(photoErr){console.log('Photo save skipped:',photoErr.message)}return Response.json({ok:true,id,ref,score,result})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}}
