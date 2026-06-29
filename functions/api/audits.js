function outcome(score){
  score=Number(score||0);
  if(score>=95) return 'Excellent';
  if(score>=85) return 'Pass';
  if(score>=75) return 'Improvement Required';
  return 'Fail';
}

async function ensureAudits(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    site_name TEXT,
    client TEXT,
    audit_date TEXT,
    auditor TEXT,
    appliance_type TEXT,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    asset_number TEXT,
    score REAL,
    result TEXT,
    findings TEXT,
    training_required TEXT,
    audit_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function onRequestGet({ request, env }) {
  try {
    await ensureAudits(env);
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'engineer';
    const engineer = url.searchParams.get('engineer') || '';
    let rows;

    if (role === 'manager') {
      rows = await env.DB.prepare('SELECT * FROM audits ORDER BY id DESC').all();
    } else if (role === 'senior_engineer') {
      rows = await env.DB.prepare(`SELECT * FROM audits
        WHERE lower(engineer_name)=lower(?) OR lower(auditor)=lower(?)
        ORDER BY id DESC`).bind(engineer, engineer).all();
    } else {
      rows = await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC')
        .bind(engineer).all();
    }

    return Response.json({ ok:true, audits: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureAudits(env);
    const body = await request.json();
    const role = body.role || 'engineer';

    if (!['manager','senior_engineer'].includes(role)) {
      return Response.json({ ok:false, error:'Only managers or senior engineers can create audits' }, { status:403 });
    }

    const score = Number(body.score || body.calculated_score || 0);
    const result = body.result || body.outcome || outcome(score);

    const ins = await env.DB.prepare(`INSERT INTO audits
      (engineer_name, site_name, client, audit_date, auditor, appliance_type, manufacturer, model, serial_number, asset_number, score, result, findings, training_required, audit_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        body.engineer_name || body.engineer || '',
        body.site_name || body.site || '',
        body.client || '',
        body.audit_date || body.date || new Date().toISOString().slice(0,10),
        body.auditor || body.created_by || '',
        body.appliance_type || '',
        body.manufacturer || '',
        body.model || '',
        body.serial_number || '',
        body.asset_number || '',
        score,
        result,
        body.findings || body.findings_corrective_actions || '',
        body.training_required || '',
        JSON.stringify(body)
      ).run();

    return Response.json({ ok:true, id:ins.meta?.last_row_id, result, score });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
