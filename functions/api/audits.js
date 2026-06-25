function outcome(score){score=Number(score||0);if(score>=95)return'Excellent';if(score>=85)return'Pass';if(score>=75)return'Improvement Required';return'Fail'}
function addDays(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function trainingText(body, score){let level=body.test_level||(score<75?'level2':score<85?'level1':'none'); if(level==='auto')level=score<75?'level2':score<85?'level1':'none'; if(level==='level2')return'Level 2 Advanced Competency Assessment required. Practical assessment and manager sign-off required before re-audit.'; if(level==='level1')return'Level 1 Commercial Gas Safety Refresher required. Re-audit to be completed within 30 days.'; if(level==='practical')return'Practical Assessment required. Manager observation and sign-off required.'; if(level==='manufacturer')return'Manufacturer Product Training required.'; if(level==='coaching')return'One-to-One Coaching required.'; if(level==='reaudit')return'Re-audit Only required.'; return body.training_required||''}
export async function onRequestGet({ request, env }) {
  try { const url=new URL(request.url); const email=(url.searchParams.get('email')||'').toLowerCase(); const role=url.searchParams.get('role')||'engineer'; let rows;
    if(role==='manager') rows=await env.DB.prepare('SELECT * FROM audits ORDER BY created_at DESC').all();
    else rows=await env.DB.prepare('SELECT * FROM audits WHERE lower(audit_json) LIKE ? ORDER BY created_at DESC').bind('%"engineer_email":"'+email+'"%').all();
    return Response.json({ok:true,audits:rows.results||[]});
  } catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPost({ request, env }) {
  try { const body=await request.json(); const score=Number(body.score||0); const result=outcome(score); const auditJson=JSON.stringify(body);
    const insert=await env.DB.prepare('INSERT INTO audits (engineer_name,audit_date,site_name,score,result,auditor,audit_json) VALUES (?,?,?,?,?,?,?)').bind(body.engineer_name||'',body.audit_date||'',body.site_name||'',score,result,body.auditor||body.manager_name||'',auditJson).run();
    const auditId=insert.meta?.last_row_id;
    if(Array.isArray(body.photos)){for(const p of body.photos.slice(0,12)){if(p.data_url) await env.DB.prepare('INSERT INTO audit_photos (audit_id, photo_name, photo_url) VALUES (?,?,?)').bind(auditId,p.filename||'photo.jpg',p.data_url).run()}}
    if(score<85 && (body.test_level||'auto')!=='none'){await env.DB.prepare('INSERT INTO training_records (engineer_name,training_type,assigned_date,completion_date,status) VALUES (?,?,?,?,?)').bind(body.engineer_name||'',trainingText(body,score),new Date().toISOString().slice(0,10),'','Open').run(); await env.DB.prepare('INSERT INTO reaudits (audit_id,engineer_name,due_date,completed_date,status) VALUES (?,?,?,?,?)').bind(auditId,body.engineer_name||'',addDays(30),'','Open').run()}
    return Response.json({ok:true,id:auditId,result,score});
  } catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}