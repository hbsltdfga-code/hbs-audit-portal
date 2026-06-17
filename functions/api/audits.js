export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email') || '';
    const role = url.searchParams.get('role') || 'engineer';
    let rows;
    if (role === 'engineer') {
      rows = await env.DB.prepare('SELECT * FROM audits WHERE lower(engineer_email)=lower(?) ORDER BY created_at DESC').bind(email).all();
    } else {
      rows = await env.DB.prepare('SELECT * FROM audits ORDER BY created_at DESC').all();
    }
    return Response.json({ ok:true, audits: rows.results || [] });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const audit_ref = body.audit_ref || ('HBS-' + Date.now());
    const score = Number(body.score || 0);
    const result = score >= 85 ? 'Pass' : score >= 75 ? 'Improvement Required' : 'Fail';
    const reaudit_required = score < 85 ? 1 : 0;
    const training_required = score < 85 ? (body.training_required || 'Post audit refresher training / toolbox talk required') : (body.training_required || 'None');

    await env.DB.prepare(`INSERT OR REPLACE INTO audits
      (audit_ref, engineer_email, engineer_name, manager_email, site_name, client_name, audit_date, appliance_details, score, result, actions_required, training_required, reaudit_required, reaudit_date, signature, audit_json, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
      .bind(audit_ref, body.engineer_email, body.engineer_name, body.manager_email || '', body.site_name, body.client_name || '', body.audit_date, body.appliance_details || '', score, result, body.actions_required || '', training_required, reaudit_required, body.reaudit_date || '', body.signature || '', JSON.stringify(body)).run();

    if (Array.isArray(body.photos)) {
      await env.DB.prepare('DELETE FROM audit_photos WHERE audit_ref=?').bind(audit_ref).run();
      for (const p of body.photos.slice(0,6)) {
        if (p.data_url) await env.DB.prepare('INSERT INTO audit_photos (audit_ref, filename, mime_type, data_url) VALUES (?,?,?,?)').bind(audit_ref, p.filename || 'photo', p.mime_type || 'image/jpeg', p.data_url).run();
      }
    }
    return Response.json({ ok:true, audit_ref, result, score });
  } catch (e) { return Response.json({ ok:false, error:e.message }, { status:500 }); }
}
