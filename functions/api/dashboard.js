const NON_ENGINEERS = ['Peter Taylor','Eward Richards','Lucy Coppage','Russell Haines'];
const isEngineer = n => n && !NON_ENGINEERS.map(x => x.toLowerCase()).includes(String(n).toLowerCase());

function outcome(score){
  score = Number(score || 0);
  if (score >= 95) return 'Excellent';
  if (score >= 85) return 'Pass';
  if (score >= 75) return 'Improvement Required';
  if (score > 0) return 'Fail';
  return '';
}

function parseJson(row){
  try { return row.audit_json ? JSON.parse(row.audit_json) : {}; } catch(e) { return {}; }
}

function normaliseAudit(row){
  const j = parseJson(row);
  const m = {...j, ...row};
  const score = Number(m.score || 0);
  const result = m.result || outcome(score);
  return {
    id: m.id,
    ref: m.audit_ref || m.ref || (m.id ? `HBS-${m.id}` : ''),
    date: m.audit_date || m.date || m.created_at || '',
    engineer: m.engineer_name || m.engineer || '',
    site: m.site_name || m.site || '',
    client: m.client || m.client_name || '',
    manufacturer: m.manufacturer || '',
    model: m.model || '',
    score,
    result,
    findings: m.findings || j.findings || '',
    created_at: m.created_at || ''
  };
}

async function safeAll(env, sql){
  try { return (await env.DB.prepare(sql).all()).results || []; } catch(e) { return []; }
}

function openRows(rows){
  return (rows || []).filter(r => !/completed|closed|signed off/i.test(String(r.status || 'Open')));
}

function groupCounts(rows, field){
  const by = {};
  (rows || []).forEach(r => {
    const key = r[field] || '';
    if (!key) return;
    by[key.toLowerCase()] = (by[key.toLowerCase()] || 0) + 1;
  });
  return by;
}

export async function onRequestGet({request, env}){
  try{
    const u = new URL(request.url);
    const role = u.searchParams.get('role') || 'engineer';
    const engineer = u.searchParams.get('engineer') || '';

    const rawAudits = await safeAll(env, 'SELECT * FROM audits ORDER BY id DESC');
    const audits = rawAudits.map(normaliseAudit);
    const training = await safeAll(env, 'SELECT * FROM training_records ORDER BY id DESC');
    const toolbox = await safeAll(env, 'SELECT * FROM toolbox_results ORDER BY id DESC');
    const reaudits = await safeAll(env, 'SELECT * FROM reaudits ORDER BY id DESC');

    const total = audits.length;
    const average_score = total ? Math.round(audits.reduce((s,a) => s + Number(a.score || 0), 0) / total) : 0;
    const excellent = audits.filter(a => a.score >= 95 || /excellent/i.test(a.result)).length;
    const pass = audits.filter(a => (a.score >= 85 && a.score < 95) || /^pass$/i.test(a.result)).length;
    const improvement = audits.filter(a => (a.score >= 75 && a.score < 85) || /improvement/i.test(a.result)).length;
    const fail = audits.filter(a => (a.score > 0 && a.score < 75) || /fail/i.test(a.result)).length;
    const pass_rate = total ? Math.round(((excellent + pass) / total) * 100) : 0;
    const open_training_rows = openRows(training);
    const open_reaudit_rows = openRows(reaudits);

    const trainingByEngineer = groupCounts(open_training_rows, 'engineer_name');
    const reauditsByEngineer = groupCounts(open_reaudit_rows, 'engineer_name');

    const by = {};
    audits.filter(a => isEngineer(a.engineer)).forEach(a => {
      const key = a.engineer;
      if (!by[key]) by[key] = {engineer:key, audits:0, total:0, excellent:0, improvement:0, fails:0, open_training:0, open_reaudits:0};
      by[key].audits++;
      by[key].total += Number(a.score || 0);
      if (a.score >= 95) by[key].excellent++;
      else if (a.score >= 75 && a.score < 85) by[key].improvement++;
      else if (a.score > 0 && a.score < 75) by[key].fails++;
    });

    Object.values(by).forEach(r => {
      r.avg_score = r.audits ? Math.round(r.total / r.audits) : 0;
      r.open_training = trainingByEngineer[String(r.engineer).toLowerCase()] || 0;
      r.open_reaudits = reauditsByEngineer[String(r.engineer).toLowerCase()] || 0;
      r.status = r.avg_score >= 85 && !r.open_training && !r.open_reaudits ? 'Competent' : (r.avg_score < 75 || r.fails ? 'Immediate Action' : 'Action Required');
    });

    const league = Object.values(by).sort((a,b) => b.avg_score - a.avg_score);
    const engineers_attention = league.filter(r => r.avg_score < 85 || r.fails > 0 || r.open_training > 0 || r.open_reaudits > 0);

    const engineerAudits = audits.filter(a => String(a.engineer).toLowerCase() === String(engineer).toLowerCase());
    const engineerTraining = training.filter(t => String(t.engineer_name).toLowerCase() === String(engineer).toLowerCase());
    const engineerOpenTraining = openRows(engineerTraining);
    const engineerReaudits = reaudits.filter(r => String(r.engineer_name || r.engineer).toLowerCase() === String(engineer).toLowerCase());
    const engineerOpenReaudits = openRows(engineerReaudits);
    const engineerTests = toolbox.filter(t => String(t.engineer_name).toLowerCase() === String(engineer).toLowerCase());
    const engineerAverage = engineerAudits.length ? Math.round(engineerAudits.reduce((s,a) => s + Number(a.score || 0), 0) / engineerAudits.length) : 0;
    const latestAudit = engineerAudits[0] || null;

    return Response.json({
      ok:true,
      summary:{total_audits:total, average_score, pass_rate, excellent, pass, improvement, fail, open_training:open_training_rows.length, open_reaudits:open_reaudit_rows.length},
      league,
      engineers_attention,
      audits: role === 'manager' ? audits.slice(0,50) : engineerAudits.slice(0,50),
      open_training: role === 'manager' ? open_training_rows.slice(0,50) : engineerOpenTraining,
      open_reaudits: role === 'manager' ? open_reaudit_rows.slice(0,50) : engineerOpenReaudits,
      engineer:{
        name: engineer,
        audits: engineerAudits,
        latest_audit: latestAudit,
        average_score: engineerAverage,
        status: latestAudit ? latestAudit.result : '',
        open_training: engineerOpenTraining,
        open_reaudits: engineerOpenReaudits,
        tests: engineerTests
      }
    });
  }catch(e){
    return Response.json({ok:false,error:e.message},{status:500});
  }
}
