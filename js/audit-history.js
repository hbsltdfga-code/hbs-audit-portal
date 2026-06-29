async function loadAuditHistory(){
  setHtml('auditHistory',`
    <h2>Audit History</h2>
    <p><button onclick="loadAuditHistory()">Refresh</button></p>
    <table><thead><tr><th>Ref</th><th>Date</th><th>Engineer</th><th>Site</th><th>Manufacturer</th><th>Model</th><th>Score</th><th>Result</th><th>Action</th></tr></thead><tbody id="auditHistoryRows"></tbody></table>
    <h3>Selected Audit Detail</h3>
    <div id="auditDetail" class="muted">Select an audit to review full results.</div>
  `);
  const role=HBS.user.role, eng=encodeURIComponent(HBS.user.name);
  try{
    const j=await api(`/api/audits?role=${role}&engineer=${eng}`);
    window._auditHistory=j.audits||[];
    $('auditHistoryRows').innerHTML=window._auditHistory.map(a=>`<tr>
      <td>${a.ref||'HBS-'+a.id}</td><td>${safe(a.audit_date||a.created_at)}</td><td>${safe(a.engineer_name)}</td><td>${safe(a.site_name)}</td>
      <td>${safe(a.manufacturer)}</td><td>${safe(a.model)}</td><td>${safe(a.score||0)}</td><td>${safe(a.result)}</td>
      <td><button onclick="viewAuditDetail(${a.id})">Review</button></td>
    </tr>`).join('');
  }catch(e){$('auditHistoryRows').innerHTML='<tr><td colspan="9">'+e.message+'</td></tr>'}
}

function firstVal(obj, keys){
  if(!obj || typeof obj!=='object') return '';
  for(const k of keys){
    if(obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  return '';
}

function deepFind(obj, keys){
  if(!obj || typeof obj!=='object') return '';
  const v = firstVal(obj, keys);
  if(v !== '') return v;
  for(const k of Object.keys(obj)){
    const child = obj[k];
    if(child && typeof child === 'object'){
      const found = deepFind(child, keys);
      if(found !== '') return found;
    }
  }
  return '';
}

function collectQuestionArrays(obj, results=[]){
  if(!obj || typeof obj!=='object') return results;
  if(Array.isArray(obj)){
    const looksLikeQuestions = obj.some(x => x && typeof x==='object' && (
      x.question || x.Question || x.label || x.text || x.item || x.audit_question || x.check ||
      x.answer || x.response || x.Response || x.result || x.status
    ));
    if(looksLikeQuestions) results.push(obj);
    obj.forEach(x=>collectQuestionArrays(x, results));
  } else {
    Object.values(obj).forEach(x=>collectQuestionArrays(x, results));
  }
  return results;
}

function normaliseQuestions(rawJson){
  const arrays = collectQuestionArrays(rawJson);
  let best = [];
  for(const arr of arrays){
    if(arr.length > best.length) best = arr;
  }
  return best.map((q,i)=>({
    no: firstVal(q,['no','No','number','Number','id','ID','question_no','questionNumber']) || (i+1),
    question: firstVal(q,['question','Question','text','Text','label','Label','item','Item','audit_question','check','Check']) || '',
    response: firstVal(q,['response','Response','answer','Answer','result','Result','status','Status','value','Value','selected','selectedValue','engineer_response']) || '',
    finding: firstVal(q,['finding','Finding','findings','Findings','evidence','Evidence','comment','Comment','comments','Comments','notes','Notes','manager_comment']) || ''
  })).filter(q=>q.question || q.response || q.finding);
}

function combustionValues(d,a){
  return {
    co: firstVal(a,['co','CO','co_ppm','CO ppm']) || deepFind(d,['co','CO','co_ppm','CO ppm','aCO']),
    co2: firstVal(a,['co2','CO2','co2_percent','CO2 %']) || deepFind(d,['co2','CO2','co2_percent','CO2 %','aCO2']),
    o2: firstVal(a,['o2','O2','oxygen','O2 %']) || deepFind(d,['o2','O2','oxygen','O2 %','aO2']),
    flue_temp: firstVal(a,['flue_temp','flueTemp','Flue Temp','flue_temperature']) || deepFind(d,['flue_temp','flueTemp','Flue Temp','flue_temperature','aFlueTemp']),
    efficiency: firstVal(a,['efficiency','Efficiency']) || deepFind(d,['efficiency','Efficiency','aEfficiency']),
    ratio: firstVal(a,['ratio','Ratio','co_co2_ratio','CO/CO2']) || deepFind(d,['ratio','Ratio','co_co2_ratio','CO/CO2','aRatio']),
    inlet_pressure: firstVal(a,['inlet_pressure','inletPressure','Inlet Pressure','working_pressure']) || deepFind(d,['inlet_pressure','inletPressure','Inlet Pressure','working_pressure','aInletPressure'])
  };
}

async function viewAuditDetail(id){
  try{
    let a=(window._auditHistory||[]).find(x=>Number(x.id)===Number(id));
    let photos=[];
    try{
      const full=await api('/api/audit?id='+encodeURIComponent(id));
      if(full.audit) a={...a,...full.audit};
      photos=full.photos||[];
    }catch(e){console.warn('No photo/detail endpoint',e)}
    if(!a){$('auditDetail').textContent='Audit not found.';return}

    let d={};
    try{d=JSON.parse(a.audit_json||'{}')}catch(e){}
    const questions=normaliseQuestions(d);
    const combustion=combustionValues(d,a);
    const photoHtml=photos.length
      ? photos.map(p=>`<a href="${p.photo_url}" target="_blank"><img class="photo-thumb" src="${p.photo_url}"></a>`).join('')
      : 'No photos attached to this audit.';

    $('auditDetail').innerHTML=`<table>
      <tr><th>Ref</th><td>${a.ref||'HBS-'+a.id}</td></tr>
      <tr><th>Engineer</th><td>${safe(a.engineer_name)}</td></tr>
      <tr><th>Site</th><td>${safe(a.site_name)}</td></tr>
      <tr><th>Client</th><td>${safe(a.client||d.client)}</td></tr>
      <tr><th>Auditor</th><td>${safe(a.auditor||d.auditor)}</td></tr>
      <tr><th>Manufacturer / Model</th><td>${safe(a.manufacturer)} ${safe(a.model)}</td></tr>
      <tr><th>Score / Result</th><td>${safe(a.score)}% - ${safe(a.result)}</td></tr>
      <tr><th>Classification</th><td>${safe(a.classification||d.classification)}</td></tr>
      <tr><th>Training Required</th><td>${safe(a.training_required||d.training_required)}</td></tr>
      <tr><th>Findings</th><td>${safe(a.findings||d.findings)}</td></tr>
      <tr><th>Positive Observations</th><td>${safe(d.positive_observations)}</td></tr>
    </table>

    <h4>Combustion / Safety Readings</h4>
    <table><tbody>
      <tr><th>CO ppm</th><td>${safe(combustion.co)}</td><th>CO2 %</th><td>${safe(combustion.co2)}</td></tr>
      <tr><th>O2 %</th><td>${safe(combustion.o2)}</td><th>Flue Temp °C</th><td>${safe(combustion.flue_temp)}</td></tr>
      <tr><th>Efficiency %</th><td>${safe(combustion.efficiency)}</td><th>Ratio</th><td>${safe(combustion.ratio)}</td></tr>
      <tr><th>Inlet Pressure</th><td>${safe(combustion.inlet_pressure)}</td><th></th><td></td></tr>
    </tbody></table>

    <h4>Photographs</h4><div>${photoHtml}</div>

    <h4>Question Results</h4>
    <table><thead><tr><th>No</th><th>Question</th><th>Response</th><th>Finding</th></tr></thead><tbody>
      ${questions.length ? questions.map(q=>`<tr><td>${safe(q.no)}</td><td>${safe(q.question)}</td><td>${safe(q.response)}</td><td>${safe(q.finding)}</td></tr>`).join('') : '<tr><td colspan="4">No detailed question responses were stored with this historic audit.</td></tr>'}
    </tbody></table>`;
  }catch(e){$('auditDetail').textContent=e.message}
}
