async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,email TEXT,role TEXT,pin TEXT,title TEXT,active INTEGER DEFAULT 1)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,user_name TEXT,email TEXT,action TEXT,status TEXT,details TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  const cols=await env.DB.prepare('PRAGMA table_info(users)').all();
  const names=(cols.results||[]).map(c=>c.name);
  if(!names.includes('title'))await env.DB.prepare('ALTER TABLE users ADD COLUMN title TEXT').run();
  if(!names.includes('active'))await env.DB.prepare('ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1').run();
  await env.DB.prepare(`UPDATE users SET active=1 WHERE active IS NULL`).run();
  await env.DB.prepare(`UPDATE users SET role='manager', title='Manager', active=1 WHERE lower(name) IN (lower('Peter Taylor'),lower('Eward Richards'),lower('Lucy Coppage'))`).run();
  await env.DB.prepare(`UPDATE users SET role='senior_engineer', title='Senior Engineer', active=1 WHERE lower(name)=lower('Mark Fuller')`).run();
  await env.DB.prepare(`UPDATE users SET active=0 WHERE lower(name)=lower('Russell Haines')`).run();
}
function safeRole(v){v=String(v||'engineer').trim().toLowerCase();return ['manager','senior_engineer','engineer'].includes(v)?v:'engineer'}
function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,title:u.title,active:Number(u.active===undefined||u.active===null?1:u.active),pin_mask:u.pin?'••••':''}}
function managerOnly(role){return String(role||'').toLowerCase()==='manager'}
async function log(env,actor,u,action,status,details){try{await env.DB.prepare('INSERT INTO user_activity_log (user_id,user_name,email,action,status,details) VALUES (?,?,?,?,?,?)').bind(u?.id||null,u?.name||'',u?.email||'',action,status,(actor?('By '+actor+'. '):'')+(details||'')).run()}catch(e){}}
export async function onRequestGet({request,env}){
  try{await ensure(env);const url=new URL(request.url);if(url.searchParams.get('activity')==='1'){const role=url.searchParams.get('role')||'';if(!managerOnly(role))return Response.json({ok:false,error:'Manager access required to view user activity.'},{status:403});const rows=await env.DB.prepare(`SELECT id,user_id,user_name,email,action,status,details,created_at FROM user_activity_log ORDER BY id DESC LIMIT 100`).all();return Response.json({ok:true,activity:rows.results||[]})}const includeInactive=url.searchParams.get('includeInactive')==='1';const sql=`SELECT id,name,email,role,pin,title,COALESCE(active,1) AS active FROM users ${includeInactive?'':'WHERE COALESCE(active,1)=1'} ORDER BY CASE role WHEN 'manager' THEN 1 WHEN 'senior_engineer' THEN 2 ELSE 3 END,name`;const rows=await env.DB.prepare(sql).all();return Response.json({ok:true,users:(rows.results||[]).map(publicUser)})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPost({request,env}){
  try{await ensure(env);const b=await request.json();if(!managerOnly(b.current_role||b.role_request||b.requesting_role))return Response.json({ok:false,error:'Manager access required to create users.'},{status:403});const name=String(b.name||'').trim();const email=String(b.email||'').trim();const role=safeRole(b.user_role||b.role);const title=String(b.title||role.replace('_',' ')).trim();const pin=String(b.pin||'').trim();if(!name)return Response.json({ok:false,error:'Name is required.'},{status:400});if(!/^\d{4,8}$/.test(pin))return Response.json({ok:false,error:'PIN must be 4 to 8 digits.'},{status:400});await env.DB.prepare('INSERT INTO users (name,email,role,title,pin,active) VALUES (?,?,?,?,?,1)').bind(name,email,role,title,pin).run();const created=await env.DB.prepare('SELECT id,name,email,role,pin,title,COALESCE(active,1) AS active FROM users ORDER BY id DESC LIMIT 1').first();await log(env,b.manager||'',created,'user_created','success','Role '+role);return Response.json({ok:true,user:publicUser(created)})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestPut({request,env}){
  try{
    await ensure(env);
    const b=await request.json();
    if(!managerOnly(b.current_role||b.role_request||b.requesting_role))return Response.json({ok:false,error:'Manager access required to update users.'},{status:403});
    const id=Number(b.id||0);
    if(!id)return Response.json({ok:false,error:'User id is required.'},{status:400});
    const existing=await env.DB.prepare('SELECT id,name,email,role,pin,title,COALESCE(active,1) AS active FROM users WHERE id=?').bind(id).first();
    if(!existing)return Response.json({ok:false,error:'User not found.'},{status:404});
    const name=String(b.name??existing.name??'').trim();
    const email=String(b.email??existing.email??'').trim();
    const role=safeRole(b.user_role??b.new_role??existing.role);
    const title=String(b.title??existing.title??'').trim();
    const active=(b.active===0||b.active==='0'||b.active===false)?0:1;
    let pin=String(existing.pin||'').trim();
    if(b.pin!==undefined&&String(b.pin).trim()!==''){
      pin=String(b.pin).trim();
      if(!/^\d{4,8}$/.test(pin))return Response.json({ok:false,error:'PIN must be 4 to 8 digits.'},{status:400});
    }
    await env.DB.prepare('UPDATE users SET name=?, email=?, role=?, title=?, active=?, pin=? WHERE id=?').bind(name,email,role,title,active,pin,id).run();
    const updated=await env.DB.prepare('SELECT id,name,email,role,pin,title,COALESCE(active,1) AS active FROM users WHERE id=?').bind(id).first();
    await log(env,b.manager||'',updated,'user_updated','success','Role '+role+', active '+active+(pin!==existing.pin?', PIN changed':''));
    return Response.json({ok:true,user:publicUser(updated)})
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestDelete({request,env}){
  try{await ensure(env);const u=new URL(request.url);if(!managerOnly(u.searchParams.get('role')))return Response.json({ok:false,error:'Manager access required to deactivate users.'},{status:403});const id=Number(u.searchParams.get('id')||0);if(!id)return Response.json({ok:false,error:'User id is required.'},{status:400});const existing=await env.DB.prepare('SELECT id,name,email,role,title,COALESCE(active,1) AS active FROM users WHERE id=?').bind(id).first();if(!existing)return Response.json({ok:false,error:'User not found.'},{status:404});await env.DB.prepare('UPDATE users SET active=0 WHERE id=?').bind(id).run();await log(env,u.searchParams.get('manager')||'',existing,'user_deactivated','success','');return Response.json({ok:true,message:'User deactivated'})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
