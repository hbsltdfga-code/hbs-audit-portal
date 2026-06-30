const NON_ENGINEERS=['Peter Taylor','Eward Richards','Lucy Coppage','Russell Haines'];
function isEngineer(n){return n && !NON_ENGINEERS.map(x=>x.toLowerCase()).includes(String(n).toLowerCase())}
function norm(v){return String(v||'').trim()}
function lower(v){return norm(v).toLowerCase()}
function outcome(score){score=Number(score||0);return score>=95?'Excellent':score>=85?'Pass':score>=75?'Improvement Required':score>0?'Fail':'No Audit'}
async function all(env,sql){try{return (await env.DB.prepare(sql).all()).results||[]}catch(e){return[]}}
function parseJson(row){try{return row.audit_json?JSON.parse(row.audit_json):{}}catch(e){return{}}}
function auditRef(a){return a.audit_ref||a.ref||(a.id?`HBS-${a.id}`:'')}
function normaliseAudit(a){const j=parseJson(a);const m={...j,...a};const score=Number(m.score||0);return{...m,id:m.id,ref:auditRef(m),engineer_name:m.engineer_name||m.engineer||'',site_name:m.site_name||m.site||'',audit_date:m.audit_date||m.date||m.created_at||'',score,result:m.result||outcome(score),questions:Array.isArray(j.questions)?j.questions:[],created_at:m.created_at||''}}
function openRow(r){return !/completed|closed|signed off|approved/i.test(norm(r.status||'Open'))}
function safetyCritical(a){
 const j=parseJson(a); const qs=Array.isArray(j.questions)?j.questions:[];
 const cls=norm(j.classification||j.safety_classification||a.classification||a.safety_classification).toUpperCase();
 if(['ID','AR'].includes(cls)) return true;
 return qs.some(q=>{const sec=lower(q.section), question=lower(q.question), resp=lower(q.response||q.score||q.assessment||q.response_value); const safety=sec.includes('safety')||question.includes('ventilation')||question.includes('flue')||question.includes('tightness')||question.includes('isolation')||question.includes('defects classified'); return safety&&(resp.includes('fail')||resp==='0'||resp.includes('improvement'));});
}
function weaknessFromQuestions(audits){
 const counts={};
 audits.forEach(a=>{(a.questions||[]).forEach(q=>{const r=lower(q.response||q.response_value||q.score); if(r.includes('improvement')||r.includes('fail')||r==='0'||r==='5'){const key=q.question||'Unspecified audit item'; counts[key]=(counts[key]||0)+1;}})});
 return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([question,count])=>({question,count}));
}
function timelineFor(engineer,audits,training,tests,reaudits){
 const items=[];
 audits.forEach(a=>items.push({date:a.audit_date||a.created_at,type:'Audit',title:`${a.ref} - ${a.result}`,detail:`${a.site_name||''} · ${a.score}%`,score:a.score,ref:a.ref}));
 training.forEach(t=>items.push({date:t.assigned_date||t.created_at,type:'Training',title:t.training_type||'Training assigned',detail:`${t.status||'Open'} ${t.audit_ref?`· ${t.audit_ref}`:''}`,ref:t.audit_ref||''}));
 tests.forEach(t=>items.push({date:t.created_at||t.signed_off_at,type:'Test',title:t.test_type||'Test completed',detail:`${t.score||0}% · ${t.result||''} · ${t.status||''}`}));
 reaudits.forEach(r=>items.push({date:r.due_date||r.created_at,type:'Re-audit',title:r.audit_ref||'Re-audit',detail:r.status||'Open',ref:r.audit_ref||''}));
 return items.filter(x=>x.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,25);
}
export async function onRequestGet({request,env}){
 try{
  const u=new URL(request.url); const requested=u.searchParams.get('engineer')||'';
  const users=await all(env,'SELECT * FROM users');
  const audits=(await all(env,'SELECT * FROM audits ORDER BY id DESC')).map(normaliseAudit);
  const training=await all(env,'SELECT * FROM training_records ORDER BY id DESC');
  const tests=await all(env,'SELECT * FROM toolbox_results ORDER BY id DESC');
  const reaudits=await all(env,'SELECT * FROM reaudits ORDER BY id DESC');
  const names=new Set();
  users.forEach(u=>{if(isEngineer(u.name))names.add(u.name)}); audits.forEach(a=>{if(isEngineer(a.engineer_name))names.add(a.engineer_name)}); training.forEach(t=>{if(isEngineer(t.engineer_name))names.add(t.engineer_name)}); tests.forEach(t=>{if(isEngineer(t.engineer_name))names.add(t.engineer_name)});
  const engineers=[...names].sort().map(engineer=>{
    const ea=audits.filter(a=>lower(a.engineer_name)===lower(engineer));
    const et=training.filter(t=>lower(t.engineer_name)===lower(engineer));
    const ex=tests.filter(t=>lower(t.engineer_name)===lower(engineer));
    const er=reaudits.filter(r=>lower(r.engineer_name||r.engineer)===lower(engineer));
    const openTraining=et.filter(openRow), openReaudits=er.filter(openRow);
    const avg=ea.length?Math.round(ea.reduce((s,a)=>s+Number(a.score||0),0)/ea.length):0;
    const latest=ea[0]||null; const fails=ea.filter(a=>Number(a.score||0)>0&&Number(a.score||0)<75||/fail/i.test(a.result||'')).length;
    const critical=ea.some(safetyCritical); const pendingTests=ex.filter(t=>/pending|repeat|required/i.test(norm(t.status))).length;
    let status='No Audit Record', recommended_action='Schedule first audit';
    if(avg>=95&&!openTraining.length&&!openReaudits.length&&!fails&&!critical){status='Excellent';recommended_action='Continue routine audit cycle / consider mentoring'}
    else if(avg>=85&&!openTraining.length&&!openReaudits.length&&!fails&&!critical){status='Competent';recommended_action='Continue routine audit cycle'}
    else if(avg>=75||openTraining.length||openReaudits.length){status='Improvement Required';recommended_action='Complete open training and re-audit'}
    if(avg>0&&avg<75||fails||critical){status='Immediate Action';recommended_action='Level 2 competency review and manager sign-off required'}
    const competency_score=Math.max(0,Math.min(100,avg-(openTraining.length*3)-(openReaudits.length*3)-(fails*5)-(critical?10:0)));
    return {engineer,audits:ea.length,average_score:avg,competency_score,fails,open_training:openTraining.length,open_reaudits:openReaudits.length,tests:ex.length,pending_tests:pendingTests,safety_critical:critical,status,recommended_action,latest_audit:latest?{ref:latest.ref,date:latest.audit_date,site:latest.site_name,score:latest.score,result:latest.result}:null,weaknesses:weaknessFromQuestions(ea)};
  });
  const response={ok:true,engineers};
  if(requested){
    const profile=engineers.find(e=>lower(e.engineer)===lower(requested));
    const ea=audits.filter(a=>lower(a.engineer_name)===lower(requested)); const et=training.filter(t=>lower(t.engineer_name)===lower(requested)); const ex=tests.filter(t=>lower(t.engineer_name)===lower(requested)); const er=reaudits.filter(r=>lower(r.engineer_name||r.engineer)===lower(requested));
    response.profile=profile||null; response.audit_history=ea.slice(0,20); response.training=et.slice(0,20); response.tests=ex.slice(0,20); response.reaudits=er.slice(0,20); response.timeline=timelineFor(requested,ea,et,ex,er);
  }
  return Response.json(response);
 }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
