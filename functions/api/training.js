const LEVEL1='Level 1 - Commercial Gas Safety Refresher';
const LEVEL2='Level 2 - Advanced Commercial Gas Safety Competency Assessment';
function norm(v){return String(v||'').trim()}function lower(v){return norm(v).toLowerCase()}
function addDays(dateStr,days){const d=dateStr?new Date(dateStr):new Date();if(Number.isNaN(d.getTime()))return new Date(Date.now()+days*86400000).toISOString().slice(0,10);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
async function cols(env,table){try{return((await env.DB.prepare(`PRAGMA table_info(${table})`).all()).results||[]).map(c=>c.name)}catch(e){return[]}}
async function ensureColumn(env,table,name,type){const c=await cols(env,table);if(!c.includes(name)){try{await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run()}catch(e){}}}
async function ensure(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (id INTEGER PRIMARY KEY AUTOINCREMENT,engineer_name TEXT,training_type TEXT,assigned_date TEXT,completion_date TEXT,status TEXT DEFAULT 'Open',audit_ref TEXT,due_date TEXT,manager_name TEXT,manager_notes TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
 await ensureColumn(env,'training_records','audit_ref','TEXT');
 await ensureColumn(env,'training_records','due_date','TEXT');
 await ensureColumn(env,'training_records','manager_name','TEXT');
 await ensureColumn(env,'training_records','manager_notes','TEXT');
 await ensureColumn(env,'training_records','created_at','DATETIME DEFAULT CURRENT_TIMESTAMP');
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reaudits (id INTEGER PRIMARY KEY AUTOINCREMENT,audit_id INTEGER,audit_ref TEXT,engineer_name TEXT,due_date TEXT,completed_date TEXT,status TEXT DEFAULT 'Open',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
 await ensureColumn(env,'reaudits','audit_id','INTEGER');
 await ensureColumn(env,'reaudits','audit_ref','TEXT');
 await ensureColumn(env,'reaudits','created_at','DATETIME DEFAULT CURRENT_TIMESTAMP');
}
function parseJson(r){try{return r.audit_json?JSON.parse(r.audit_json):{}}catch(e){return{}}}
function refFor(a){return a.audit_ref||a.ref||(a.id?`HBS-${a.id}`:'')}
function isCriticalClassification(v){
 const cls=norm(v).toUpperCase();
 return ['ID','IMMEDIATE DANGER','IMMEDIATELY DANGEROUS','GAS ESCAPE','UNSAFE SITUATION'].includes(cls);
}
function containsCriticalText(v){const t=norm(v).toUpperCase();return t.includes('GAS ESCAPE')||t.includes('GAS LEAK')||t.includes('SMELL OF GAS')||t.includes('IMMEDIATE DANGER')||t.includes('IMMEDIATELY DANGEROUS')||t.includes('UNSAFE SITUATION')}
function hasSafetyCriticalIssue(a){
 const j=parseJson(a);
 if(isCriticalClassification(j.classification||j.safety_classification||j.defect_classification||a.classification||a.safety_classification||a.defect_classification))return true;
 if(containsCriticalText(j.findings||j.training_required||a.findings||a.training_required||''))return true;
 const qs=Array.isArray(j.questions)?j.questions:[];
 return qs.some(q=>isCriticalClassification(q.classification||q.defect_classification||q.safety_classification||'') || containsCriticalText(q.finding||q.findings||q.note||q.notes||q.comment||q.comments||''));
}
function assignmentForAudit(a){const score=Number(a.score||0);const result=norm(a.result);const critical=hasSafetyCriticalIssue(a);if(critical)return{type:LEVEL2,notes:'Safety-critical audit finding requiring Level 2 assessment.'};if(score<75||result==='Fail')return{type:LEVEL2,notes:'Audit score below 75% requiring Level 2 assessment.'};if(score>=75&&score<85)return{type:LEVEL1,notes:'Improvement Required audit outcome requiring Level 1 refresher.'};return null}
async function normaliseExisting(env){
 await env.DB.prepare(`UPDATE training_records SET training_type=? WHERE training_type LIKE '%Post-audit refresher%' OR training_type LIKE '%Toolbox%' OR training_type LIKE '%Level 1 Commercial%' OR training_type='Post-Audit Refresher Test'`).bind(LEVEL1).run().catch(()=>{});
 await env.DB.prepare(`UPDATE training_records SET training_type=? WHERE training_type LIKE '%Level 2%' OR training_type LIKE '%Unsafe%' OR training_type LIKE '%Advanced%'`).bind(LEVEL2).run().catch(()=>{});
}
async function insertTrainingIfMissing(env,a,ass){const engineer=a.engineer_name||'';const ref=refFor(a);if(!engineer||!ref||!ass)return;const assigned=a.audit_date||new Date().toISOString().slice(0,10);const due=addDays(assigned,30);const existing=await env.DB.prepare(`SELECT id FROM training_records WHERE lower(engineer_name)=lower(?) AND COALESCE(audit_ref,'')=? AND training_type=? AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved') LIMIT 1`).bind(engineer,ref,ass.type).first().catch(()=>null);if(!existing){await env.DB.prepare('INSERT INTO training_records (engineer_name,training_type,assigned_date,due_date,status,audit_ref,manager_name,manager_notes) VALUES (?,?,?,?,?,?,?,?)').bind(engineer,ass.type,assigned,due,'Open',ref,a.auditor||'',ass.notes).run()}}
async function insertReauditIfMissing(env,a){const engineer=a.engineer_name||'';const ref=refFor(a);if(!engineer||!ref)return;const existing=await env.DB.prepare(`SELECT id FROM reaudits WHERE lower(engineer_name)=lower(?) AND (COALESCE(audit_ref,'')=? OR audit_id=?) AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed') LIMIT 1`).bind(engineer,ref,Number(a.id||0)).first().catch(()=>null);if(!existing){await env.DB.prepare('INSERT INTO reaudits (audit_id,audit_ref,engineer_name,due_date,status) VALUES (?,?,?,?,?)').bind(Number(a.id||0),ref,engineer,addDays(a.audit_date||a.created_at,30),'Open').run()}}

async function cleanupLegacyUnlinked(env){
 // Remove legacy open training rows that are not linked to an audit.
 // Historic completed records are preserved.
 await env.DB.prepare(`DELETE FROM training_records WHERE COALESCE(audit_ref,'')='' AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved')`).run().catch(()=>{});
 // If duplicates exist for the same engineer/audit/test, keep the newest open record only.
 await env.DB.prepare(`DELETE FROM training_records WHERE id IN (
   SELECT t.id FROM training_records t
   JOIN training_records newer
     ON lower(COALESCE(t.engineer_name,''))=lower(COALESCE(newer.engineer_name,''))
    AND COALESCE(t.audit_ref,'')=COALESCE(newer.audit_ref,'')
    AND COALESCE(t.training_type,'')=COALESCE(newer.training_type,'')
    AND newer.id>t.id
   WHERE COALESCE(t.audit_ref,'')<>''
     AND lower(COALESCE(t.status,'Open')) NOT IN ('completed','closed','signed off','approved')
     AND lower(COALESCE(newer.status,'Open')) NOT IN ('completed','closed','signed off','approved')
 )`).run().catch(()=>{});
}

async function backfillFromAudits(env){await ensure(env);await normaliseExisting(env);const rows=await env.DB.prepare('SELECT * FROM audits ORDER BY id DESC').all().catch(()=>({results:[]}));for(const a of rows.results||[]){const ass=assignmentForAudit(a);if(ass){await insertTrainingIfMissing(env,a,ass);await insertReauditIfMissing(env,a)}}await cleanupLegacyUnlinked(env)}
export async function onRequestGet({request,env}){try{await ensure(env);await backfillFromAudits(env);const u=new URL(request.url),role=u.searchParams.get('role')||'engineer',eng=u.searchParams.get('engineer')||'';let rows;if(role==='manager')rows=await env.DB.prepare('SELECT * FROM training_records ORDER BY id DESC').all();else rows=await env.DB.prepare('SELECT * FROM training_records WHERE lower(engineer_name)=lower(?) ORDER BY id DESC').bind(eng).all();return Response.json({ok:true,training:rows.results||[]})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}}
export async function onRequestPut({request,env}){try{await ensure(env);const b=await request.json();const done=b.status==='Completed'?new Date().toISOString().slice(0,10):'';await env.DB.prepare('UPDATE training_records SET status=?, completion_date=?, manager_name=?, manager_notes=? WHERE id=?').bind(b.status||'Completed',done,b.manager_name||'',b.manager_notes||'',Number(b.id)).run();return Response.json({ok:true,id:b.id})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}}
