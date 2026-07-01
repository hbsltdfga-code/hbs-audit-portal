const NON=['Peter Taylor','Eward Richards','Lucy Coppage','Russell Haines','Compliance Manager'];
const isEng=n=>n&&!NON.map(x=>x.toLowerCase()).includes(String(n).toLowerCase());
function parse(v){try{return v?JSON.parse(v):{}}catch(e){return {}}}
function norm(row){let j=parse(row.audit_json);const m={...j,...row};const score=Number(m.score||0);let result=m.result||'';if(!result&&score){result=score>=95?'Excellent':score>=85?'Pass':score>=75?'Improvement Required':'Fail'}return{id:m.id,ref:m.audit_ref||m.ref||(m.id?`HBS-${m.id}`:''),date:m.audit_date||m.date||m.created_at||'',engineer:m.engineer_name||m.engineer||'',site:m.site_name||m.site||'',manufacturer:m.manufacturer||'',model:m.model||'',score,result}}
function cp15Issues(p){const d=parse(p.details_json);const qs=Array.isArray(d.questions)?d.questions:[];const labels=[['tightness','local tightness'],['combustion','combustion'],['pressure','working pressure'],['gas_rate','gas rate'],['safety_devices','safety device'],['safety_valves','safety valve'],['expansion','expansion vessel']];const out=[];for(const [key,needle] of labels){const q=qs.find(x=>String(x.question||'').toLowerCase().includes(needle));if(q&&['fail','improve','minor'].includes(String(q.response_value||'').toLowerCase()))out.push({key,question:q.question,response:q.response_value,finding:q.finding||''});}return out;}
async function rows(env,sql){try{return (await env.DB.prepare(sql).all()).results||[]}catch(e){return []}}
export async function onRequestGet({env}){try{
 const audits=(await rows(env,'SELECT * FROM audits ORDER BY id DESC')).map(norm);
 const paperwork=await rows(env,'SELECT * FROM paperwork_audits ORDER BY id DESC');
 const training=await rows(env,'SELECT * FROM training_records');
 const reaudits=await rows(env,'SELECT * FROM reaudits');
 const tests=await rows(env,'SELECT * FROM toolbox_results');
 const actions=await rows(env,"SELECT * FROM compliance_actions WHERE lower(COALESCE(status,'Open')) NOT IN ('completed','closed')");
 const total=audits.length,average_score=total?Math.round(audits.reduce((s,a)=>s+Number(a.score||0),0)/total):0;
 const excellent=audits.filter(a=>a.score>=95||/excellent/i.test(a.result)).length;
 const pass=audits.filter(a=>(a.score>=85&&a.score<95)||/^pass$/i.test(a.result)).length;
 const improvement=audits.filter(a=>(a.score>=75&&a.score<85)||/improvement/i.test(a.result)).length;
 const fail=audits.filter(a=>(a.score>0&&a.score<75)||/fail/i.test(a.result)).length;
 const pass_rate=total?Math.round(((excellent+pass)/total)*100):0;
 const paperTotal=paperwork.length;
 const paperAvg=paperTotal?Math.round(paperwork.reduce((s,p)=>s+Number(p.score||0),0)/paperTotal):0;
 const paperFail=paperwork.filter(p=>Number(p.score||0)<80).length;
 const cp15IssueList=paperwork.flatMap(p=>cp15Issues(p).map(i=>({...i,id:p.id,engineer_name:p.engineer_name,site_name:p.site_name,job_ref:p.job_ref,audit_date:p.audit_date})));
 const open_training=training.filter(t=>/open|pending|returned|repeat|required/i.test(t.status||'')).length;
 const open_reaudits=reaudits.filter(r=>/open|pending/i.test(r.status||'')).length;
 const tests_pending=tests.filter(t=>/pending|review/i.test(t.status||'')).length;
 const open_actions=open_training+open_reaudits+actions.length+cp15IssueList.length;
 const by={};audits.filter(a=>isEng(a.engineer)).forEach(a=>{if(!by[a.engineer])by[a.engineer]={engineer:a.engineer,audits:0,total:0,excellent:0,improvement:0,fails:0};by[a.engineer].audits++;by[a.engineer].total+=Number(a.score||0);if(a.score>=95)by[a.engineer].excellent++;else if(a.score>=75&&a.score<85)by[a.engineer].improvement++;else if(a.score>0&&a.score<75)by[a.engineer].fails++});
 const league=Object.values(by).map(r=>({...r,avg_score:r.audits?Math.round(r.total/r.audits):0})).sort((a,b)=>b.avg_score-a.avg_score);
 const trends={paperwork_average:paperAvg,paperwork_total:paperTotal,paperwork_below_target:paperFail,cp15_issues:cp15IssueList.length,tests_pending,open_compliance_actions:actions.length};
 return Response.json({ok:true,summary:{total_audits:total,average_score,pass_rate,excellent,pass,improvement,fail,open_training,open_reaudits,open_actions},trends,cp15_issues:cp15IssueList.slice(0,50),league,audits});
}catch(e){return Response.json({ok:false,error:e.message},{status:500})}}
