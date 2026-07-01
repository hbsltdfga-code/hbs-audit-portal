function norm(v){return String(v||'').trim()}
function lower(v){return norm(v).toLowerCase()}
function isPrivileged(role){return ['manager','senior_engineer','director','admin'].includes(lower(role))}
function refFor(a){return a.audit_ref || a.ref || (a.id ? `HBS-${a.id}` : '')}
function parseJson(v){try{return v?JSON.parse(v):{}}catch(e){return {}}}
function addAction(list,a){
  list.push({
    id:a.id||'', source:a.source||'', type:a.type||'', priority:a.priority||'normal',
    engineer_name:a.engineer_name||'', audit_ref:a.audit_ref||'', due_date:a.due_date||'',
    status:a.status||'Open', title:a.title||'', detail:a.detail||'', action:a.action||'',
    created_at:a.created_at||'', audit_id:a.audit_id||''
  })
}
async function q(env,sql,binds=[]){try{let s=env.DB.prepare(sql);if(binds.length)s=s.bind(...binds);return (await s.all()).results||[]}catch(e){return []}}
async function tableExists(env,name){try{const r=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();return !!r}catch(e){return false}}
export async function onRequestGet({request,env}){
  try{
    const u=new URL(request.url);
    const role=lower(u.searchParams.get('role')||'engineer');
    const engineer=norm(u.searchParams.get('engineer')||'');
    const all=isPrivileged(role);
    const actions=[];

    const trainingSql=all?
      `SELECT * FROM training_records WHERE lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved') ORDER BY COALESCE(due_date,assigned_date,created_at) ASC LIMIT 200`:
      `SELECT * FROM training_records WHERE lower(engineer_name)=lower(?) AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved') ORDER BY COALESCE(due_date,assigned_date,created_at) ASC LIMIT 100`;
    const training=await q(env,trainingSql,all?[]:[engineer]);
    training.forEach(r=>addAction(actions,{source:'training',id:r.id,type:String(r.training_type||'Training'),priority:String(r.training_type||'').includes('Level 2')?'high':'medium',engineer_name:r.engineer_name,audit_ref:r.audit_ref,due_date:r.due_date,status:r.status,title:r.training_type,detail:r.manager_notes||'Training / test action assigned from audit workflow.',action:'Open Training Centre',created_at:r.created_at}));

    const reaSql=all?
      `SELECT * FROM reaudits WHERE lower(COALESCE(status,'Open')) NOT IN ('completed','closed') ORDER BY due_date ASC LIMIT 200`:
      `SELECT * FROM reaudits WHERE lower(engineer_name)=lower(?) AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed') ORDER BY due_date ASC LIMIT 100`;
    const reaudits=await q(env,reaSql,all?[]:[engineer]);
    reaudits.forEach(r=>addAction(actions,{source:'reaudit',id:r.id,type:'Re-audit Required',priority:'medium',engineer_name:r.engineer_name,audit_ref:r.audit_ref,due_date:r.due_date,status:r.status,title:'Re-audit Required',detail:'Re-audit remains open following audit outcome.',action:'Open Re-audits',audit_id:r.audit_id,created_at:r.created_at}));

    const auditsSql=all?
      `SELECT * FROM audits ORDER BY id DESC LIMIT 200`:
      `SELECT * FROM audits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC LIMIT 100`;
    const audits=await q(env,auditsSql,all?[]:[engineer]);
    audits.forEach(a=>{
      const d=parseJson(a.audit_json);
      const cls=norm(d.safety_classification||d.classification||a.safety_classification||a.classification||'None');
      const clsU=cls.toUpperCase();
      if(['AR','ID','GAS ESCAPE','UNSAFE SITUATION','IMMEDIATE DANGER','IMMEDIATELY DANGEROUS'].includes(clsU)){
        addAction(actions,{source:'audit',id:a.id,audit_id:a.id,type:'Safety Classification',priority:clsU==='AR'?'medium':'high',engineer_name:a.engineer_name,audit_ref:refFor(a),due_date:a.audit_date,status:'Review',title:`${cls} Review`,detail:`Audit ${refFor(a)} recorded safety classification ${cls}.`,action:'Review Audit',created_at:a.created_at});
      }
    });

    if(await tableExists(env,'paperwork_audits')){
      const pSql=all?
        `SELECT * FROM paperwork_audits ORDER BY id DESC LIMIT 100`:
        `SELECT * FROM paperwork_audits WHERE lower(engineer_name)=lower(?) ORDER BY id DESC LIMIT 50`;
      const papers=await q(env,pSql,all?[]:[engineer]);
      papers.filter(p=>Number(p.score||100)<85).forEach(p=>addAction(actions,{source:'paperwork',id:p.id,type:'Paperwork Review',priority:Number(p.score||0)<75?'high':'medium',engineer_name:p.engineer_name,audit_ref:p.job_ref||p.audit_ref||'',due_date:p.audit_date||p.created_at,status:'Review',title:'Paperwork Compliance Review',detail:`Paperwork score ${p.score||0}% requires review.`,action:'Open Paperwork Audits',created_at:p.created_at}));
      papers.forEach(p=>{
        const d=parseJson(p.details_json);
        const intel=d.cp15_intelligence||{};
        const flags=Array.isArray(intel.flags)?intel.flags:[];
        flags.filter(f=>['critical','major'].includes(lower(f.severity))).forEach(f=>addAction(actions,{source:'cp15_intelligence',id:p.id,type:'CP15 Intelligence',priority:lower(f.severity)==='critical'?'high':'medium',engineer_name:p.engineer_name,audit_ref:p.job_ref||p.audit_ref||'',due_date:p.audit_date||p.created_at,status:'Review',title:f.title||'CP15 Paperwork Issue',detail:f.finding||f.action||'CP15 paperwork issue identified by intelligence checks.',action:'Open Paperwork Audits',created_at:p.created_at}));
      });
    }

    const priorityRank={high:1,medium:2,normal:3,low:4};
    actions.sort((a,b)=>(priorityRank[a.priority]||9)-(priorityRank[b.priority]||9) || String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')));
    const summary={total:actions.length,high:actions.filter(a=>a.priority==='high').length,training:training.length,reaudits:reaudits.length,safety:actions.filter(a=>a.source==='audit').length,paperwork:actions.filter(a=>a.source==='paperwork').length};
    return Response.json({ok:true,summary,actions});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
