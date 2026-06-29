export async function onRequestGet({ env }) {
  try {
    const q = async (sql) => {
      try { return (await env.DB.prepare(sql).all()).results || []; } catch(e) { return []; }
    };
    const audits = await q('SELECT * FROM audits');
    const training = await q('SELECT * FROM training_records');
    const reaudits = await q('SELECT * FROM reaudits');
    const tightness = await q('SELECT * FROM tightness_records');
    const docs = await q('SELECT * FROM technical_library');

    const avg = audits.length ? Math.round(audits.reduce((s,a)=>s+Number(a.score||0),0)/audits.length) : 0;
    const failed = audits.filter(a=>Number(a.score||0)>0 && Number(a.score||0)<75 || /fail/i.test(a.result||'')).length;
    const openTraining = training.filter(t=>/open|pending|returned/i.test(t.status||'')).length;
    const openReaudits = reaudits.filter(r=>/open|pending/i.test(r.status||'')).length;
    let overall = avg;
    if(openTraining) overall -= Math.min(15, openTraining*2);
    if(openReaudits) overall -= Math.min(10, openReaudits*2);
    if(failed) overall -= Math.min(15, failed*3);
    overall = Math.max(0, Math.min(100, overall || 0));

    const notifications = [];
    if(failed) notifications.push({priority:'High',message:`${failed} failed audit(s) recorded`,action:'Review audit findings and assign training'});
    if(openTraining) notifications.push({priority:'Medium',message:`${openTraining} open training record(s)`,action:'Manager sign-off or return for further training'});
    if(openReaudits) notifications.push({priority:'Medium',message:`${openReaudits} open re-audit(s)`,action:'Schedule or complete re-audit'});
    if(!notifications.length) notifications.push({priority:'Normal',message:'No urgent compliance actions identified',action:'Continue monitoring'});

    return Response.json({ok:true,summary:{
      overall_compliance:overall,
      audits:audits.length,
      average_score:avg,
      failed_audits:failed,
      open_training:openTraining,
      open_reaudits:openReaudits,
      tightness_tests:tightness.length,
      documents:docs.length
    },notifications});
  } catch(e) {
    return Response.json({ok:false,error:e.message},{status:500});
  }
}
