async function columnExists(env, table, column) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (info.results || []).some(c => c.name === column);
}
async function ensureTable(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS toolbox_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    test_type TEXT,
    level TEXT,
    score REAL,
    result TEXT,
    status TEXT DEFAULT 'Pending Manager Review',
    answers_json TEXT,
    manager_name TEXT,
    manager_notes TEXT,
    signed_off_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const cols=['test_type','level','status','manager_name','manager_notes','signed_off_at'];
  for(const c of cols){
    if(!(await columnExists(env,'toolbox_results',c))){
      await env.DB.prepare(`ALTER TABLE toolbox_results ADD COLUMN ${c} TEXT`).run();
    }
  }
}
export async function onRequestGet({ request, env }) {
  try{
    await ensureTable(env);
    const url=new URL(request.url);
    const role=url.searchParams.get('role')||'engineer';
    const engineer=url.searchParams.get('engineer')||'';
    let rows;
    if(role==='manager'){
      rows=await env.DB.prepare('SELECT * FROM toolbox_results ORDER BY id DESC').all();
    }else{
      rows=await env.DB.prepare('SELECT * FROM toolbox_results WHERE lower(engineer_name)=lower(?) ORDER BY id DESC').bind(engineer).all();
    }
    return Response.json({ok:true,results:rows.results||[]});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPost({ request, env }) {
  try{
    await ensureTable(env);
    const b=await request.json();
    if(b.role && b.role!=='manager' && b.manual===true) return Response.json({ok:false,error:'Manager access only'},{status:403});
    const ins=await env.DB.prepare(`INSERT INTO toolbox_results
      (engineer_name,test_type,level,score,result,status,answers_json,manager_name,manager_notes,signed_off_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        b.engineer_name||b.engineer||'',
        b.test_type||b.assessment_type||'Toolbox Test',
        b.level||'',
        Number(b.score||0),
        b.result||b.outcome||'',
        b.status||'Pending Manager Review',
        b.answers_json||JSON.stringify(b.answers||{}),
        b.manager_name||'',
        b.manager_notes||'',
        b.status==='Completed' ? new Date().toISOString() : ''
      ).run();
    return Response.json({ok:true,id:ins.meta?.last_row_id});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPut({ request, env }) {
  try{
    await ensureTable(env);
    const b=await request.json();
    if(!b.id) throw new Error('Missing test record id');
    await env.DB.prepare(`UPDATE toolbox_results
      SET status=?, manager_name=?, manager_notes=?, signed_off_at=?
      WHERE id=?`)
      .bind(b.status||'Completed',b.manager_name||'',b.manager_notes||'',new Date().toISOString(),Number(b.id)).run();
    return Response.json({ok:true,id:b.id,status:b.status||'Completed'});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
