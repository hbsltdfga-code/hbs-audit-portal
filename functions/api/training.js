async function columnExists(env, table, column) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (info.results || []).some(c => c.name === column);
}
async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    training_type TEXT,
    assigned_date TEXT,
    completion_date TEXT,
    status TEXT DEFAULT 'Open',
    audit_ref TEXT,
    manager_name TEXT,
    manager_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  for (const c of ['manager_name','manager_notes']) {
    if (!(await columnExists(env,'training_records',c))) {
      await env.DB.prepare(`ALTER TABLE training_records ADD COLUMN ${c} TEXT`).run();
    }
  }
}
export async function onRequestGet({request,env}){
  try{
    await ensure(env);
    const u=new URL(request.url),role=u.searchParams.get('role')||'engineer',engineer=u.searchParams.get('engineer')||'';
    let rows;
    if(role==='manager') rows=await env.DB.prepare('SELECT * FROM training_records ORDER BY id DESC').all();
    else if(role==='senior_engineer') rows={results:[]};
    else rows=await env.DB.prepare('SELECT * FROM training_records WHERE lower(engineer_name)=lower(?) ORDER BY id DESC').bind(engineer).all();
    return Response.json({ok:true,training:rows.results||[]});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPost({request,env}){
  try{
    await ensure(env);
    const b=await request.json();
    if(b.role&&b.role!=='manager') return Response.json({ok:false,error:'Manager access only'},{status:403});
    const ins=await env.DB.prepare(`INSERT INTO training_records (engineer_name,training_type,assigned_date,status,audit_ref,manager_name,manager_notes)
      VALUES (?,?,?,?,?,?,?)`)
      .bind(b.engineer_name||'',b.training_type||'',b.assigned_date||new Date().toISOString().slice(0,10),b.status||'Open',b.audit_ref||'',b.manager_name||'',b.manager_notes||'').run();
    return Response.json({ok:true,id:ins.meta?.last_row_id});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPut({request,env}){
  try{
    await ensure(env);
    const b=await request.json();
    if(!b.id) throw new Error('Missing training record id');
    const completed = b.status === 'Completed' ? new Date().toISOString().slice(0,10) : '';
    await env.DB.prepare(`UPDATE training_records SET status=?, completion_date=?, manager_name=?, manager_notes=? WHERE id=?`)
      .bind(b.status||'Completed', completed, b.manager_name||'', b.manager_notes||'', Number(b.id)).run();
    return Response.json({ok:true,id:b.id,status:b.status||'Completed'});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
