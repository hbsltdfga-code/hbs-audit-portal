window.HBS={user:null,nonEngineers:['Peter Taylor','Eward Richards','Lucy Coppage','Russell Haines'],sections:['dashboard','auditForm','auditHistory','trainingCentre','competencyCentre','toolboxCentre','tightnessCentre','knowledgeCentre','userManagement','recordManagement']};
function $(id){return document.getElementById(id)}
function safe(v){return v??''}
function roleLabel(role){return role==='manager'?'Manager':role==='senior_engineer'?'Senior Engineer':'Engineer'}
function isManager(){return HBS.user&&HBS.user.role==='manager'}
function isEngineerName(name){return !!name&&!HBS.nonEngineers.map(x=>x.toLowerCase()).includes(String(name).toLowerCase())}
function show(id){HBS.sections.forEach(s=>$(s)?.classList.add('hide'));$(id)?.classList.remove('hide')}
async function api(url,opts){const r=await fetch(url,opts||{cache:'no-store'});const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){throw new Error(t.slice(0,300))}if(!r.ok||j.ok===false)throw new Error(j.error||('HTTP '+r.status));return j}
function setHtml(id,html){const el=$(id);if(el)el.innerHTML=html}
function outcome(score){score=Number(score||0);if(score>=95)return'Excellent';if(score>=85)return'Pass';if(score>=75)return'Improvement Required';return'Fail'}
async function loadEngineersInto(ids){const j=await api('/api/users');const eng=(j.users||[]).filter(u=>isEngineerName(u.name));ids.forEach(id=>{const s=$(id);if(s)s.innerHTML=eng.map(u=>`<option>${u.name}</option>`).join('')});return eng}
