async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,email TEXT,role TEXT,pin TEXT,title TEXT,active INTEGER DEFAULT 1)`).run();
  const cols=await env.DB.prepare('PRAGMA table_info(users)').all();
  const names=(cols.results||[]).map(c=>c.name);
  if(!names.includes('title'))await env.DB.prepare('ALTER TABLE users ADD COLUMN title TEXT').run();
  if(!names.includes('active'))await env.DB.prepare('ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1').run();
  await env.DB.prepare(`UPDATE users SET role='manager', title='Manager', active=1 WHERE lower(name) IN (lower('Peter Taylor'),lower('Eward Richards'),lower('Lucy Coppage'))`).run();
  await env.DB.prepare(`UPDATE users SET role='senior_engineer', title='Senior Engineer', active=1 WHERE lower(name)=lower('Mark Fuller')`).run();
  await env.DB.prepare(`UPDATE users SET active=0 WHERE lower(name)=lower('Russell Haines')`).run();
}
function safeRole(v){v=String(v||'engineer').trim().toLowerCase();return ['manager','senior_engineer','engineer'].includes(v)?v:'engineer'}
function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,title:u.title,active:u.active,pin_mask:u.pin?'••••':''}}
function managerOnly(role){return String(role||'').toLowerCase()==='manager'}
export async function onRequestGet({env}){
  try{await ensure(env);const rows=await env.DB.prepare(`SELECT id,name,email,role,pin,title,COALESCE(active,1) AS active FROM users WHERE COALESCE(active,1)=1 ORDER BY CASE role WHEN 'manager' THEN 1 WHEN 'senior_engineer' THEN 2 ELSE 3 END,name`).all();return Response.json({ok:true,users:(rows.results||[]).map(publicUser)})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}
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
    return Response.json({ok:true,user:publicUser(updated)})
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
