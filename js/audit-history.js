async function loadAuditHistory(){
 setHtml('auditHistory',
 '<h2>Audit History v10.1</h2>'+
 '<p class="muted">Complete audit review including responses, findings, combustion readings, photographs and printable booklet.</p>'+
 '<div class="grid">'+
 '<label>Search<br><input id="auditSearch" oninput="renderAuditHistoryRows()" placeholder="Engineer, site, client, manufacturer, result"></label>'+
 '<label>Result<br><select id="auditResultFilter" onchange="renderAuditHistoryRows()"><option value="">All</option><option>Excellent</option><option>Pass</option><option>Improvement Required</option><option>Fail</option></select></label>'+
 '</div>'+
 '<p><button onclick="loadAuditHistory()">Refresh</button></p>'+
 '<table><thead><tr><th>Ref</th><th>Date</th><th>Engineer</th><th>Client</th><th>Site</th><th>Manufacturer</th><th>Model</th><th>Score</th><th>Result</th><th>Action</th></tr></thead><tbody id="histRows"></tbody></table>'+
 '<h3>Selected Audit Detail</h3><div id="auditDetail">Select an audit.</div>');
 try{
   const j=await api('/api/audits?role='+user.role+'&engineer='+encodeURIComponent(user.name));
   window._audits=j.audits||[];
   renderAuditHistoryRows();
 }catch(e){
   $('histRows').innerHTML='<tr><td colspan="10">'+e.message+'</td></tr>';
 }
}

function renderAuditHistoryRows(){
 const q=($('auditSearch')?.value||'').toLowerCase();
 const rf=$('auditResultFilter')?.value||'';
 const rows=(window._audits||[]).filter(a=>{
   const hay=[a.ref,a.audit_ref,a.engineer_name,a.client,a.site_name,a.manufacturer,a.model,a.result,a.audit_date,a.created_at].map(x=>safe(x).toLowerCase()).join(' ');
   return (!q || hay.includes(q)) && (!rf || safe(a.result)===rf);
 });
 $('histRows').innerHTML=rows.map(a=>'<tr>'+
   '<td>'+safe(a.ref||a.audit_ref||'HBS-'+a.id)+'</td>'+
   '<td>'+safe(a.audit_date||a.created_at)+'</td>'+
   '<td>'+safe(a.engineer_name)+'</td>'+
   '<td>'+safe(a.client)+'</td>'+
   '<td>'+safe(a.site_name)+'</td>'+
   '<td>'+safe(a.manufacturer)+'</td>'+
   '<td>'+safe(a.model)+'</td>'+
   '<td>'+safe(a.score)+'</td>'+
   '<td>'+safe(a.result)+'</td>'+
   '<td><button onclick="viewAuditDetail('+a.id+')">Review</button></td>'+
 '</tr>').join('');
}

function parseAuditJson(a){
 let d={};
 try{d=JSON.parse(a.audit_json||'{}')}catch(e){}
 return d && typeof d==='object' ? d : {};
}

function valFrom(obj,names){
 if(!obj || typeof obj!=='object') return '';
 const wanted=names.map(n=>String(n).toLowerCase());
 for(const k of Object.keys(obj)){
   if(wanted.includes(String(k).toLowerCase()) && obj[k]!==undefined && obj[k]!==null && String(obj[k]).trim()!=='') return obj[k];
 }
 return '';
}

function deepFind(obj,names){
 if(!obj || typeof obj!=='object') return '';
 const direct=valFrom(obj,names);
 if(direct!=='' && direct!==undefined && direct!==null) return direct;
 for(const k of Object.keys(obj)){
   const v=obj[k];
   if(v && typeof v==='object'){
     const found=deepFind(v,names);
     if(found!=='' && found!==undefined && found!==null) return found;
   }
 }
 return '';
}

function collectQuestionRows(d){
 const direct=d.questions||d.auditQuestions||d.audit_questions||d.responses||d.question_results||d.auditResults||[];
 if(Array.isArray(direct) && direct.length){
   return direct.map((q,i)=>({
     section:q.section||q.category||q.group||'',
     question:q.question||q.text||q.label||q.item||q.audit_question||'',
     response:q.response||q.answer||q.result||q.status||q.score||q.value||q.selectedValue||'',
     finding:q.finding||q.findings||q.notes||q.note||q.comment||q.comments||q.evidence||q.manager_comment||''
   })).filter(q=>q.question||q.response||q.finding);
 }
 const arrays=[];
 function walk(o){
   if(!o||typeof o!=='object') return;
   if(Array.isArray(o)){
     if(o.some(x=>x&&typeof x==='object'&&(x.question||x.text||x.response||x.answer||x.finding||x.notes||x.score))) arrays.push(o);
     o.forEach(walk);
   }else Object.values(o).forEach(walk);
 }
 walk(d);
 let best=arrays.sort((a,b)=>b.length-a.length)[0]||[];
 return best.map((q,i)=>({
   section:q.section||q.category||q.group||'',
   question:q.question||q.text||q.label||q.item||q.audit_question||'',
   response:q.response||q.answer||q.result||q.status||q.score||q.value||'',
   finding:q.finding||q.findings||q.notes||q.note||q.comment||q.comments||q.evidence||''
 })).filter(q=>q.question||q.response||q.finding);
}

function combustionFrom(d,a){
 const c=d.combustion||d.readings||d.combustion_readings||{};
 return {
   gas_rate: a.gas_rate || deepFind(d,['gas_rate','gasRate','Gas Rate']),
   standing_pressure: a.standing_pressure || deepFind(d,['standing_pressure','standingPressure','Standing Pressure']),
   working_pressure: a.working_pressure || deepFind(d,['working_pressure','workingPressure','Working Pressure']),
   inlet_pressure: a.inlet_pressure || c.inlet_pressure || c.inletPressure || deepFind(d,['inlet_pressure','inletPressure','Inlet Pressure','aInletPressure']),
   burner_pressure: a.burner_pressure || deepFind(d,['burner_pressure','burnerPressure','Burner Pressure']),
   co: a.co || c.co || c.CO || deepFind(d,['co','CO','co_ppm','aCO']),
   co2: a.co2 || c.co2 || c.CO2 || deepFind(d,['co2','CO2','aCO2']),
   o2: a.o2 || c.o2 || c.O2 || deepFind(d,['o2','O2','aO2']),
   flue_temp: a.flue_temp || c.flue_temp || c.flueTemp || deepFind(d,['flue_temp','flueTemp','Flue Temp','aFlueTemp']),
   efficiency: a.efficiency || c.efficiency || deepFind(d,['efficiency','Efficiency','aEfficiency']),
   ratio: a.ratio || c.ratio || deepFind(d,['ratio','Ratio','co_co2_ratio','aRatio'])
 };
}

async function viewAuditDetail(id){
 try{
   let a=(window._audits||[]).find(x=>Number(x.id)===Number(id));
   let photos=[];
   try{
     const full=await api('/api/audit?id='+id);
     if(full.audit)a={...a,...full.audit};
     photos=full.photos||[];
   }catch(e){}
   if(!a){$('auditDetail').textContent='Audit not found.';return}
   const d=parseAuditJson(a);
   const qs=collectQuestionRows(d);
   const comb=combustionFrom(d,a);
   const ref=safe(a.ref||a.audit_ref||'HBS-'+a.id);
   const photoHtml=photos.length?photos.map((p,i)=>'<a href="'+p.photo_url+'" target="_blank"><img class="photo-thumb" src="'+p.photo_url+'" title="'+safe(p.photo_name||('Photo '+(i+1)))+'"></a>').join(''):'No photographs attached to this audit.';
   $('auditDetail').innerHTML=
   '<div id="auditPrintArea">'+
   '<h2>Audit Review: '+ref+'</h2>'+
   '<table>'+
   '<tr><th>Audit Reference</th><td>'+ref+'</td><th>Date</th><td>'+safe(a.audit_date||a.created_at)+'</td></tr>'+
   '<tr><th>Engineer</th><td>'+safe(a.engineer_name)+'</td><th>Auditor</th><td>'+safe(a.auditor||d.auditor)+'</td></tr>'+
   '<tr><th>Client</th><td>'+safe(a.client||d.client)+'</td><th>Site</th><td>'+safe(a.site_name)+'</td></tr>'+
   '<tr><th>Manufacturer</th><td>'+safe(a.manufacturer)+'</td><th>Model</th><td>'+safe(a.model)+'</td></tr>'+
   '<tr><th>Serial Number</th><td>'+safe(a.serial_number||d.serial_number)+'</td><th>Asset Number</th><td>'+safe(a.asset_number||d.asset_number)+'</td></tr>'+
   '<tr><th>Score</th><td>'+safe(a.score)+'%</td><th>Result</th><td>'+safe(a.result)+'</td></tr>'+
   '<tr><th>Classification</th><td>'+safe(a.classification||d.classification)+'</td><th>Training / Re-audit</th><td>'+safe(a.training_required||d.training_required)+'</td></tr>'+
   '<tr><th>Findings / Actions</th><td colspan="3">'+safe(a.findings||d.findings)+'</td></tr>'+
   '<tr><th>Positive Observations</th><td colspan="3">'+safe(d.positive_observations||d.positiveObservations)+'</td></tr>'+
   '</table>'+
   '<h3>Technical Readings</h3>'+
   '<table>'+
   '<tr><th>Gas Rate</th><td>'+safe(comb.gas_rate)+'</td><th>Standing Pressure</th><td>'+safe(comb.standing_pressure)+'</td></tr>'+
   '<tr><th>Working Pressure</th><td>'+safe(comb.working_pressure)+'</td><th>Inlet Pressure</th><td>'+safe(comb.inlet_pressure)+'</td></tr>'+
   '<tr><th>Burner Pressure</th><td>'+safe(comb.burner_pressure)+'</td><th>CO ppm</th><td>'+safe(comb.co)+'</td></tr>'+
   '<tr><th>CO2 %</th><td>'+safe(comb.co2)+'</td><th>O2 %</th><td>'+safe(comb.o2)+'</td></tr>'+
   '<tr><th>Flue Temp °C</th><td>'+safe(comb.flue_temp)+'</td><th>Efficiency %</th><td>'+safe(comb.efficiency)+'</td></tr>'+
   '<tr><th>CO/CO2 Ratio</th><td>'+safe(comb.ratio)+'</td><th></th><td></td></tr>'+
   '</table>'+
   '<h3>Question Results</h3>'+
   '<table><thead><tr><th>Section</th><th>Question</th><th>Response / Score</th><th>Finding / Notes</th></tr></thead><tbody>'+
   (qs.length?qs.map(q=>'<tr><td>'+safe(q.section)+'</td><td>'+safe(q.question)+'</td><td>'+safe(q.response)+'</td><td>'+safe(q.finding)+'</td></tr>').join(''):'<tr><td colspan="4">No detailed question data stored for this historic audit.</td></tr>')+
   '</tbody></table>'+
   '<h3>Photographs</h3><div>'+photoHtml+'</div>'+
   '</div>'+
   '<p><button onclick="printAuditReview()">Print Audit Booklet</button><button class="secondary" onclick="downloadAuditHtml()">Download HTML Booklet</button><button class="secondary" onclick="document.getElementById(\\'rawAuditJson\\').classList.toggle(\\'hide\\')">Show Raw Audit JSON</button></p>'+
   '<pre id="rawAuditJson" class="hide">'+htmlSafe(JSON.stringify(d,null,2))+'</pre>';
 }catch(e){$('auditDetail').textContent=e.message}
}

function printAuditReview(){
 const content=$('auditPrintArea')?.innerHTML||'';
 const w=window.open('','_blank');
 w.document.write('<html><head><title>Audit Review</title><style>body{font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#eee}img{max-width:180px;max-height:140px;margin:4px}</style></head><body>'+content+'</body></html>');
 w.document.close();w.print();
}

function downloadAuditHtml(){
 const content=$('auditPrintArea')?.innerHTML||'';
 const blob=new Blob(['<html><body>'+content+'</body></html>'],{type:'text/html'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download='audit-review.html';
 a.click();
}
