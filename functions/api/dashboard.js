function normaliseAudit(row) {
  let j = {};
  try {
    if (row.audit_json) j = JSON.parse(row.audit_json);
  } catch(e) {}

  const merged = Object.assign({}, j, row);
  const score = Number(merged.score || merged.audit_score || merged.total_score || merged.calculated_score || 0);

  let result = merged.result || merged.outcome || '';
  if (!result && score) {
    if (score >= 95) result = 'Excellent';
    else if (score >= 85) result = 'Pass';
    else if (score >= 75) result = 'Improvement Required';
    else result = 'Fail';
  }

  return {
    id: merged.id,
    ref: merged.audit_ref || merged.ref || (merged.id ? `HBS-${merged.id}` : ''),
    date: merged.audit_date || merged.date || merged.created_at || '',
    engineer: merged.engineer_name || merged.engineer || '',
    site: merged.site_name || merged.site || '',
    manufacturer: merged.manufacturer || '',
    model: merged.model || '',
    score,
    result
  };
}

export async function onRequestGet({ env }) {
  try {
    const auditsRaw = await env.DB.prepare(`SELECT * FROM audits ORDER BY id DESC`).all();
    const audits = (auditsRaw.results || []).map(normaliseAudit);

    let training = [];
    let reaudits = [];
    try {
      training = (await env.DB.prepare(`SELECT * FROM training_records`).all()).results || [];
    } catch(e) {}
    try {
      reaudits = (await env.DB.prepare(`SELECT * FROM reaudits`).all()).results || [];
    } catch(e) {}

    const total = audits.length;
    const avg = total ? Math.round(audits.reduce((s,a)=>s + Number(a.score || 0), 0) / total) : 0;
    const excellent = audits.filter(a => a.score >= 95 || /excellent/i.test(a.result || '')).length;
    const pass = audits.filter(a => (a.score >= 85 && a.score < 95) || /^pass$/i.test(a.result || '')).length;
    const improvement = audits.filter(a => (a.score >= 75 && a.score < 85) || /improvement/i.test(a.result || '')).length;
    const fail = audits.filter(a => (a.score > 0 && a.score < 75) || /fail/i.test(a.result || '')).length;
    const pass_rate = total ? Math.round(((excellent + pass) / total) * 100) : 0;
    const open_training = training.filter(t => /open|pending/i.test(t.status || '')).length;
    const open_reaudits = reaudits.filter(r => /open|pending/i.test(r.status || '')).length;

    const byEngineer = {};
    audits.forEach(a => {
      const e = a.engineer || 'Unknown';
      if (!byEngineer[e]) byEngineer[e] = { engineer:e, audits:0, total:0, excellent:0, improvement:0, fails:0 };
      byEngineer[e].audits++;
      byEngineer[e].total += Number(a.score || 0);
      if (a.score >= 95) byEngineer[e].excellent++;
      else if (a.score >= 75 && a.score < 85) byEngineer[e].improvement++;
      else if (a.score > 0 && a.score < 75) byEngineer[e].fails++;
    });

    const league = Object.values(byEngineer)
      .map(r => ({ ...r, avg_score: r.audits ? Math.round(r.total / r.audits) : 0 }))
      .sort((a,b) => b.avg_score - a.avg_score);

    return Response.json({
      ok:true,
      summary:{ total_audits:total, average_score:avg, pass_rate, excellent, pass, improvement, fail, open_training, open_reaudits },
      league,
      audits
    });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
