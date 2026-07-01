export async function onRequestGet({env}){
  const checks=[];
  async function checkTable(name){
    try{
      const r=await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${name}`).first();
      checks.push({name,ok:true,count:r&&r.count!==undefined?r.count:0});
    }catch(e){checks.push({name,ok:false,error:e.message});}
  }
  try{
    if(!env.DB) return Response.json({ok:false,error:'D1 database binding DB is not available'},{status:500});
    const tables=['users','audits','training','reaudits','toolbox_tests','toolbox_questions','toolbox_results','paperwork_audits','compliance_actions','tightness_tests','knowledge_documents'];
    for(const t of tables) await checkTable(t);
    const failed=checks.filter(c=>!c.ok);
    return Response.json({ok:failed.length===0,version:'14.3.4',message:failed.length?'Some tables are missing or unavailable':'System health OK',checks});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500});}
}
