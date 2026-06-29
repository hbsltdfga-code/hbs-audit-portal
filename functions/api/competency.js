function score(a){return Number(a.score||0)}
function nameFrom(x){return x.engineer_name||x.engineer||x.name||'Unknown'}
export async function onRequestGet({ env }) {
  try {
    const q = async (sql) => { try { return (await env.DB.prepare(sql).all()).results || []; } catch(e) { return []; } };
    const users = await q("SELECT * FROM users ORDER BY name");
    const audits = await q("SELECT * FROM audits");
    const training = await q("SELECT * FROM training_records");
    const tests = await q("SELECT * FROM toolbox_results");
    const tightness = await q("SELECT * FROM tightness_records");

    const engineerNames = new Set();
    users.forEach(u=>{ if(u.name) engineerNames.add(u.name); });
    audits.forEach(a=>engineerNames.add(nameFrom(a)));
    training.forEach(t=>engineerNames.add(nameFrom(t)));
    tests.forEach(t=>engineerNames.add(nameFrom(t)));
    tightness.forEach(t=>engineerNames.add(nameFrom(t)));

    const engineers = [...engineerNames].filter(Boolean).sort().map(engineer=>{
      const ea = audits.filter(a=>nameFrom(a).toLowerCase()===engineer.toLowerCase());
      const et = training.filter(t=>nameFrom(t).toLowerCase()===engineer.toLowerCase());
      const ex = tests.filter(t=>nameFrom(t).toLowerCase()===engineer.toLowerCase());
      const eg = tightness.filter(t=>nameFrom(t).toLowerCase()===engineer.toLowerCase());
      const avg = ea.length ? Math.round(ea.reduce((s,a)=>s+score(a),0)/ea.length) : 0;
      const fails = ea.filter(a=>score(a)>0 && score(a)<75 || /fail/i.test(a.result||'')).length;
      const openTraining = et.filter(t=>/open|pending|returned/i.test(t.status||'')).length;
      const completedTraining = et.filter(t=>/complete/i.test(t.status||'')).length;
      let status='Competent / Monitoring';
      let action='Continue routine audit cycle';
      if(fails || openTraining){ status='Action Required'; action='Complete training and re-audit before closing competency concern'; }
      else if(avg && avg<85){ status='Improvement Required'; action='Targeted coaching recommended'; }
      else if(avg>=95){ status='Excellent'; action='Maintain CPD and consider mentoring role'; }
      return {engineer,audits:ea.length,average_score:avg,fails,open_training:openTraining,completed_training:completedTraining,tests:ex.length,tightness_tests:eg.length,status,recommended_action:action};
    });

    return Response.json({ok:true,engineers});
  } catch(e) {
    return Response.json({ok:false,error:e.message},{status:500});
  }
}
