const HBS_NON_ENGINEERS = ['Peter Taylor','Eward Richards','Lucy Coppage','Russell Haines'];
function isEngineer(name){return name && !HBS_NON_ENGINEERS.map(x=>x.toLowerCase()).includes(String(name).toLowerCase());}
function normaliseAudit(row) {
  let j = {};
  try { if (row.audit_json) j = JSON.parse(row.audit_json); } catch(e) {}
  const m = Object.assign({}, j, row);
  const score = Number(m.score || m.audit_score || m.total_score || m.calculated_score || 0);
  let result = m.result || m.outcome || '';
  if (!result && score) {
    if (score >= 95) result = 'Excellent';
    else if (score >= 85) result = 'Pass';
    else if (score >= 75) result = 'Improvement Required';
    else result = 'Fail';
  }
  return {
    id: m.id,
    ref: m.audit_ref || m.ref || (m.id ? `HBS-${m.id}` : ''),
    date: m.audit_date || m.date || m.created_at || '',
    engineer: m.engineer_name || m.engineer || m.Engineer || '',
    site: m.site_name || m.site || m.Site || '',
    manufacturer: m.manufacturer || m.Manufacturer || '',
    model: m.model || m.Model || '',
    score,
    result
  };
}
export async function onRequestGet({ env }) {
  try {
    const audits = ((await env.DB.prepare(`SELECT * FROM audits ORDER BY id DESC`).all()).results || []).map(normaliseAudit);
    let training=[], reaudits=[];
    try { training = (await env.DB.prepare(`SELECT * FROM training_records`).all()).results || []; } catch(e) {}
    try { reaudits = (await env.DB.prepare(`SELECT * FROM reaudits`).all()).results || []; } catch(e) {}

    const total = audits.length;
    const average_score = total ? Math.round(audits.reduce((s,a)=>s+Number(a.score||0),0)/total) : 0;
    const excellent = audits.filter(a=>a.score>=95 || /excellent/i.test(a.result||'')).length;
    const pass = audits.filter(a=>(a.score>=85&&a.score<95) || /^pass$/i.test(a.result||'')).length;
    const improvement = audits.filter(a=>(a.score>=75&&a.score<85) || /improvement/i.test(a.result||'')).length;
    const fail = audits.filter(a=>(a.score>0&&a.score<75) || /fail/i.test(a.result||'')).length;
    const pass_rate = total ? Math.round(((excellent+pass)/total)*100) : 0;
    const open_training = training.filter(t=>/open|pending/i.test(t.status||'')).length;
    const open_reaudits = reaudits.filter(r=>/open|pending/i.test(r.status||'')).length;

    const byEng = {};
    const byMonth = {};
    audits.forEach(a=>{
      const e=a.engineer||'Unknown';
      if(!byEng[e]) byEng[e]={engineer:e,audits:0,total:0,excellent:0,improvement:0,fails:0};
      byEng[e].audits++; byEng[e].total += Number(a.score||0);
      if(a.score>=95) byEng[e].excellent++; else if(a.score>=75&&a.score<85) byEng[e].improvement++; else if(a.score>0&&a.score<75) byEng[e].fails++;
      const mo=String(a.date||'').slice(0,7)||'Unknown';
      if(!byMonth[mo]) byMonth[mo]={month:mo,audits:0,total:0,improvement:0,fails:0};
      byMonth[mo].audits++; byMonth[mo].total += Number(a.score||0);
      if(a.score>=75&&a.score<85) byMonth[mo].improvement++; else if(a.score>0&&a.score<75) byMonth[mo].fails++;
    });
    const league = Object.values(byEng).map(r=>({...r,avg_score:r.audits?Math.round(r.total/r.audits):0})).sort((a,b)=>b.avg_score-a.avg_score);
    const trends = Object.values(byMonth).map(r=>({...r,avg_score:r.audits?Math.round(r.total/r.audits):0})).sort((a,b)=>String(a.month).localeCompare(String(b.month)));

    return Response.json({ok:true,summary:{total_audits:total,average_score,pass_rate,excellent,pass,improvement,fail,open_training,open_reaudits},league,trends,audits});
  } catch(e) {
    return Response.json({ok:false,error:e.message},{status:500});
  }
}
