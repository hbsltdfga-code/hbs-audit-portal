async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,email TEXT,role TEXT,pin TEXT,title TEXT,active INTEGER DEFAULT 1)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,user_name TEXT,email TEXT,action TEXT,status TEXT,details TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  const cols=await env.DB.prepare('PRAGMA table_info(users)').all();
  const names=(cols.results||[]).map(c=>c.name);
  if(!names.includes('title'))await env.DB.prepare('ALTER TABLE users ADD COLUMN title TEXT').run();
  if(!names.includes('active'))await env.DB.prepare('ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1').run();
  await env.DB.prepare(`UPDATE users SET active=1 WHERE active IS NULL`).run();
  await env.DB.prepare(`UPDATE users SET role='manager', title='Manager', active=1 WHERE lower(name) IN (lower('Peter Taylor'),lower('Eward Richards'),lower('Lucy Coppage')) OR lower(email) IN (lower('peter@hbs.local'),lower('eward.richards@hbs.local'),lower('lucy.coppage@hbs.local'))`).run();
  await env.DB.prepare(`UPDATE users SET role='senior_engineer', title='Senior Engineer', active=1 WHERE lower(name)=lower('Mark Fuller') OR lower(email)=lower('mark.fuller@hbs.local')`).run();
  await env.DB.prepare(`UPDATE users SET active=0 WHERE lower(name)=lower('Russell Haines')`).run();
}
const clean=v=>String(v||'').trim().toLowerCase();
function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,title:u.title,active:u.active};}
async function log(env,u,action,status,details){try{await env.DB.prepare('INSERT INTO user_activity_log (user_id,user_name,email,action,status,details) VALUES (?,?,?,?,?,?)').bind(u?.id||null,u?.name||'',u?.email||'',action,status,details||'').run()}catch(e){}}
async function findUser(env,login,pin){
  const rows=await env.DB.prepare(`SELECT id,name,email,role,pin,title,COALESCE(active,1) AS active FROM users`).all();
  const all=rows.results||[];
  const inactive=all.find(u=>{const nm=clean(u.name),em=clean(u.email);return COALESCE_ACTIVE(u)===0&&(em===login||nm===login||nm.includes(login)||login.includes(nm))});
  if(inactive)return {inactive};
  const user=all.find(u=>{const nm=clean(u.name),em=clean(u.email),p=String(u.pin||'').trim();return COALESCE_ACTIVE(u)===1&&p===pin&&(em===login||nm===login||nm.includes(login)||login.includes(nm))});
  return {user};
}
function COALESCE_ACTIVE(u){return Number(u.active===undefined||u.active===null?1:u.active)}
export async function onRequestPost({request,env}){
  try{await ensure(env);const b=await request.json();const login=clean(b.email||b.username||''),pin=String(b.pin||b.password||'').trim();if(!login||!pin)return Response.json({ok:false,error:'Enter email/name and PIN.'},{status:400});const result=await findUser(env,login,pin);if(result.inactive){await log(env,result.inactive,'login','blocked','Inactive account');return Response.json({ok:false,error:'Account is inactive. Contact a manager.'},{status:403})}if(!result.user){await log(env,{email:login},'login','failed','Invalid login details');return Response.json({ok:false,error:'Invalid login details.'},{status:401})}await log(env,result.user,'login','success','');return Response.json({ok:true,user:publicUser(result.user)})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
export async function onRequestGet({request,env}){
  try{await ensure(env);const u=new URL(request.url);const login=clean(u.searchParams.get('user')||u.searchParams.get('email')||''),pin=String(u.searchParams.get('pin')||'').trim();if(!login||!pin)return Response.json({ok:true,message:'Login API is active'});const result=await findUser(env,login,pin);if(!result.user)return Response.json({ok:false,error:'Test login failed'},{status:401});return Response.json({ok:true,user:publicUser(result.user)})}catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
