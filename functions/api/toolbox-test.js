export async function onRequestGet({ request, env }) {
  try { const url=new URL(request.url); const role=url.searchParams.get('role')||'manager'; const engineer=url.searchParams.get('engineer')||''; let rows;
    if(role==='engineer') rows=await env.DB.prepare('SELECT * FROM toolbox_results WHERE lower(engineer_name)=lower(?) ORDER BY created_at DESC').bind(engineer).all();
    else rows=await env.DB.prepare('SELECT * FROM toolbox_results ORDER BY created_at DESC').all();
    return Response.json({ok:true,results:rows.results||[]});
  } catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPost({ request, env }) {
  try { const b=await request.json(); const level=b.test_level||'level1'; const score=Number(b.score||0); const passMark=level==='level2'?27:14; const result=score>=passMark?'PASS':'FAIL'; const trainingId=b.training_id?Number(b.training_id):null; const auditId=b.audit_id?Number(b.audit_id):null; const engineer=b.engineer_name||''; const testDate=b.test_date||new Date().toISOString().slice(0,10); const answers=JSON.stringify({test_level:level,total_questions:b.total_questions||0,pass_mark:passMark,answers:b.answers||[]});
    const ins=await env.DB.prepare('INSERT INTO toolbox_results (training_id,audit_id,engineer_name,test_date,score,result,answers_json) VALUES (?,?,?,?,?,?,?)').bind(trainingId,auditId,engineer,testDate,score,result,answers).run();
    if(result==='PASS' && trainingId) await env.DB.prepare('UPDATE training_records SET status="Completed", completion_date=? WHERE id=?').bind(testDate,trainingId).run();
    return Response.json({ok:true,id:ins.meta?.last_row_id,score,result,test_level:level});
  } catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}