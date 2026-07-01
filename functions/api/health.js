export async function onRequestGet({env}){
  const version='14.3.5';
  const checks=[];
  const warnings=[];
  const requiredTables=['users','audits'];
  const optionalTables=['training','reaudits','toolbox_tests','toolbox_questions','toolbox_results','paperwork_audits','compliance_actions','compliance_action_history','tightness_tests','knowledge_documents','user_activity','schema_migrations'];
  async function checkTable(name,required=false){
    try{
      const r=await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${name}`).first();
      checks.push({name,required,ok:true,count:r&&r.count!==undefined?r.count:0});
    }catch(e){
      checks.push({name,required,ok:false,error:e.message});
      if(required) warnings.push(`Required table unavailable: ${name}`);
    }
  }
  try{
    if(!env.DB){
      return Response.json({ok:false,version,error:'D1 database binding DB is not available',checks:[],warnings:['DB binding missing']},{status:500});
    }
    for(const t of requiredTables) await checkTable(t,true);
    for(const t of optionalTables) await checkTable(t,false);
    let schema_version=null;
    try{
      const s=await env.DB.prepare('SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1').first();
      schema_version=s&&s.version?s.version:null;
    }catch(e){/* optional */}
    const requiredMissing=checks.filter(c=>c.required&&!c.ok);
    const optionalMissing=checks.filter(c=>!c.required&&!c.ok);
    const missing_tables=checks.filter(c=>!c.ok).map(c=>c.name);
    const r2_available=!!(env.KNOWLEDGE_BUCKET||env.R2_BUCKET||env.HBS_KNOWLEDGE_BUCKET);
    if(optionalMissing.length) warnings.push(`${optionalMissing.length} optional table(s) missing or unavailable`);
    if(!r2_available) warnings.push('Knowledge Centre R2 binding not detected by health check; this is only required where R2 uploads are used');
    return Response.json({
      ok:requiredMissing.length===0,
      version,
      schema_version,
      message:requiredMissing.length?'Required tables are missing or unavailable':(warnings.length?'System online with warnings':'System health OK'),
      required_tables:requiredTables,
      optional_tables:optionalTables,
      missing_tables,
      warnings,
      r2_available,
      checks
    },{status:requiredMissing.length?500:200});
  }catch(e){
    return Response.json({ok:false,version,error:e.message,checks,warnings},{status:500});
  }
}
