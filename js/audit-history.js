async function loadAuditHistory(){
  setHtml('auditHistory', `
    <h2>Audit History v10.1</h2>
    <p class="muted">Complete audit review including responses, findings, combustion readings, photographs and printable booklet.</p>

    <div class="grid">
      <label>Search<br><input id="auditSearch" oninput="renderAuditHistoryRows()" placeholder="Engineer, site, client, manufacturer, result"></label>
      <label>Result<br>
        <select id="auditResultFilter" onchange="renderAuditHistoryRows()">
          <option value="">All</option>
          <option>Excellent</option>
          <option>Pass</option>
          <option>Improvement Required</option>
          <option>Fail</option>
        </select>
      </label>
    </div>

    <p><button onclick="loadAuditHistory()">Refresh</button></p>

    <table>
      <thead>
        <tr>
          <th>Ref</th><th>Date</th><th>Engineer</th><th>Client</th><th>Site</th>
          <th>Manufacturer</th><th>Model</th><th>Score</th><th>Result</th><th>Action</th>
        </tr>
      </thead>
      <tbody id="auditHistoryRows"></tbody>
    </table>

    <h3>Selected Audit Detail</h3>
    <div id="auditDetail" class="muted">Select an audit to review full results.</div>
  `);

  const role = HBS.user.role;
  const eng = encodeURIComponent(HBS.user.name);

  try {
    const j = await api(`/api/audits?role=${role}&engineer=${eng}`);
    window._auditHistory = j.audits || [];
    renderAuditHistoryRows();
  } catch(e) {
    $('auditHistoryRows').innerHTML = '<tr><td colspan="10">' + e.message + '</td></tr>';
  }
}

function ahSafe(v){
  return v === undefined || v === null ? '' : String(v);
}

function ahHtml(v){
  return ahSafe(v).replace(/[<>&]/g, function(c){
    return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c];
  });
}

function renderAuditHistoryRows(){
  const q = ($('auditSearch')?.value || '').toLowerCase();
  const resultFilter = $('auditResultFilter')?.value || '';

  const rows = (window._auditHistory || []).filter(function(a){
    const haystack = [
      a.ref, a.audit_ref, a.engineer_name, a.client, a.site_name,
      a.manufacturer, a.model, a.result, a.audit_date, a.created_at
    ].map(x => ahSafe(x).toLowerCase()).join(' ');

    return (!q || haystack.includes(q)) &&
           (!resultFilter || ahSafe(a.result) === resultFilter);
  });

  $('auditHistoryRows').innerHTML = rows.map(function(a){
    return `<tr>
      <td>${ahHtml(a.ref || a.audit_ref || 'HBS-' + a.id)}</td>
      <td>${ahHtml(a.audit_date || a.created_at)}</td>
      <td>${ahHtml(a.engineer_name)}</td>
      <td>${ahHtml(a.client)}</td>
      <td>${ahHtml(a.site_name)}</td>
      <td>${ahHtml(a.manufacturer)}</td>
      <td>${ahHtml(a.model)}</td>
      <td>${ahHtml(a.score)}</td>
      <td>${ahHtml(a.result)}</td>
      <td><button onclick="viewAuditDetail(${Number(a.id)})">Review</button></td>
    </tr>`;
  }).join('');
}

function parseAuditJson(a){
  try {
    const d = JSON.parse(a.audit_json || '{}');
    return d && typeof d === 'object' ? d : {};
  } catch(e) {
    return {};
  }
}

function firstValue(obj, keys){
  if (!obj || typeof obj !== 'object') return '';
  const wanted = keys.map(k => String(k).toLowerCase());

  for (const key of Object.keys(obj)) {
    if (wanted.includes(String(key).toLowerCase())) {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }

  return '';
}

function deepFindValue(obj, keys){
  if (!obj || typeof obj !== 'object') return '';

  const direct = firstValue(obj, keys);
  if (direct !== '') return direct;

  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child && typeof child === 'object') {
      const found = deepFindValue(child, keys);
      if (found !== '') return found;
    }
  }

  return '';
}

function collectQuestionArrays(obj, results){
  results = results || [];
  if (!obj || typeof obj !== 'object') return results;

  if (Array.isArray(obj)) {
    const looksLikeQuestions = obj.some(x => x && typeof x === 'object' && (
      x.question || x.Question || x.text || x.label || x.item || x.audit_question ||
      x.response || x.answer || x.score || x.result || x.status ||
      x.finding || x.findings || x.notes || x.note || x.comment || x.evidence
    ));

    if (looksLikeQuestions) results.push(obj);
    obj.forEach(x => collectQuestionArrays(x, results));
  } else {
    Object.values(obj).forEach(x => collectQuestionArrays(x, results));
  }

  return results;
}

function normaliseQuestionRows(d){
  const direct = d.questions || d.auditQuestions || d.audit_questions ||
                 d.question_results || d.auditResults || d.results || [];

  let source = [];

  if (Array.isArray(direct) && direct.length) {
    source = direct;
  } else {
    const arrays = collectQuestionArrays(d, []);
    source = arrays.sort((a,b) => b.length - a.length)[0] || [];
  }

  return source.map(function(q, i){
    return {
      no: firstValue(q, ['no','No','number','Number','id','ID','question_no','questionNumber']) || (i + 1),
      section: firstValue(q, ['section','Section','category','Category','group','Group']) || '',
      question: firstValue(q, ['question','Question','text','Text','label','Label','item','Item','audit_question','check','Check']) || '',
      response: firstValue(q, ['response','Response','answer','Answer','result','Result','status','Status','value','Value','selected','selectedValue']) ||
                firstValue(q, ['score','Score']) || '',
      finding: firstValue(q, ['finding','Finding','findings','Findings','evidence','Evidence','comment','Comment','comments','Comments','notes','Notes','note','Note','manager_comment']) || ''
    };
  }).filter(q => q.question || q.response || q.finding);
}

function combustionValues(d, a){
  const c = d.combustion || d.readings || d.combustion_readings || {};

  return {
    gas_rate: a.gas_rate || deepFindValue(d, ['gas_rate','gasRate','Gas Rate']),
    standing_pressure: a.standing_pressure || deepFindValue(d, ['standing_pressure','standingPressure','Standing Pressure']),
    working_pressure: a.working_pressure || deepFindValue(d, ['working_pressure','workingPressure','Working Pressure']),
    inlet_pressure: a.inlet_pressure || c.inlet_pressure || c.inletPressure || deepFindValue(d, ['inlet_pressure','inletPressure','Inlet Pressure','aInletPressure']),
    burner_pressure: a.burner_pressure || deepFindValue(d, ['burner_pressure','burnerPressure','Burner Pressure']),
    co: a.co || c.co || c.CO || deepFindValue(d, ['co','CO','co_ppm','CO ppm','aCO']),
    co2: a.co2 || c.co2 || c.CO2 || deepFindValue(d, ['co2','CO2','co2_percent','CO2 %','aCO2']),
    o2: a.o2 || c.o2 || c.O2 || deepFindValue(d, ['o2','O2','oxygen','O2 %','aO2']),
    flue_temp: a.flue_temp || c.flue_temp || c.flueTemp || deepFindValue(d, ['flue_temp','flueTemp','Flue Temp','flue_temperature','aFlueTemp']),
    efficiency: a.efficiency || c.efficiency || deepFindValue(d, ['efficiency','Efficiency','aEfficiency']),
    ratio: a.ratio || c.ratio || deepFindValue(d, ['ratio','Ratio','co_co2_ratio','CO/CO2','aRatio'])
  };
}

async function viewAuditDetail(id){
  try {
    let audit = (window._auditHistory || []).find(x => Number(x.id) === Number(id));
    let photos = [];

    try {
      const full = await api('/api/audit?id=' + encodeURIComponent(id));
      if (full.audit) audit = {...audit, ...full.audit};
      photos = full.photos || [];
    } catch(e) {
      console.warn('Audit detail/photo fetch issue', e);
    }

    if (!audit) {
      $('auditDetail').textContent = 'Audit not found.';
      return;
    }

    const data = parseAuditJson(audit);
    const questions = normaliseQuestionRows(data);
    const combustion = combustionValues(data, audit);
    const ref = audit.ref || audit.audit_ref || 'HBS-' + audit.id;

    const photoHtml = photos.length
      ? photos.map(function(p, i){
          return `<a href="${ahHtml(p.photo_url)}" target="_blank">
                    <img class="photo-thumb" src="${ahHtml(p.photo_url)}" title="${ahHtml(p.photo_name || 'Photo ' + (i + 1))}">
                  </a>`;
        }).join('')
      : 'No photographs attached to this audit.';

    $('auditDetail').innerHTML = `
      <div id="auditPrintArea">
        <h2>Audit Review: ${ahHtml(ref)}</h2>

        <table>
          <tr><th>Audit Reference</th><td>${ahHtml(ref)}</td><th>Date</th><td>${ahHtml(audit.audit_date || audit.created_at)}</td></tr>
          <tr><th>Engineer</th><td>${ahHtml(audit.engineer_name)}</td><th>Auditor</th><td>${ahHtml(audit.auditor || data.auditor)}</td></tr>
          <tr><th>Client</th><td>${ahHtml(audit.client || data.client)}</td><th>Site</th><td>${ahHtml(audit.site_name)}</td></tr>
          <tr><th>Manufacturer</th><td>${ahHtml(audit.manufacturer)}</td><th>Model</th><td>${ahHtml(audit.model)}</td></tr>
          <tr><th>Serial Number</th><td>${ahHtml(audit.serial_number || data.serial_number)}</td><th>Asset Number</th><td>${ahHtml(audit.asset_number || data.asset_number)}</td></tr>
          <tr><th>Score</th><td>${ahHtml(audit.score)}%</td><th>Result</th><td>${ahHtml(audit.result)}</td></tr>
          <tr><th>Classification</th><td>${ahHtml(audit.classification || data.classification)}</td><th>Training / Re-audit</th><td>${ahHtml(audit.training_required || data.training_required)}</td></tr>
          <tr><th>Findings / Actions</th><td colspan="3">${ahHtml(audit.findings || data.findings)}</td></tr>
          <tr><th>Positive Observations</th><td colspan="3">${ahHtml(data.positive_observations || data.positiveObservations)}</td></tr>
        </table>

        <h3>Technical Readings</h3>
        <table>
          <tr><th>Gas Rate</th><td>${ahHtml(combustion.gas_rate)}</td><th>Standing Pressure</th><td>${ahHtml(combustion.standing_pressure)}</td></tr>
          <tr><th>Working Pressure</th><td>${ahHtml(combustion.working_pressure)}</td><th>Inlet Pressure</th><td>${ahHtml(combustion.inlet_pressure)}</td></tr>
          <tr><th>Burner Pressure</th><td>${ahHtml(combustion.burner_pressure)}</td><th>CO ppm</th><td>${ahHtml(combustion.co)}</td></tr>
          <tr><th>CO2 %</th><td>${ahHtml(combustion.co2)}</td><th>O2 %</th><td>${ahHtml(combustion.o2)}</td></tr>
          <tr><th>Flue Temp °C</th><td>${ahHtml(combustion.flue_temp)}</td><th>Efficiency %</th><td>${ahHtml(combustion.efficiency)}</td></tr>
          <tr><th>CO/CO2 Ratio</th><td>${ahHtml(combustion.ratio)}</td><th></th><td></td></tr>
        </table>

        <h3>Question Results</h3>
        <table>
          <thead><tr><th>No</th><th>Section</th><th>Question</th><th>Response / Score</th><th>Finding / Notes</th></tr></thead>
          <tbody>
            ${questions.length
              ? questions.map(q => `<tr><td>${ahHtml(q.no)}</td><td>${ahHtml(q.section)}</td><td>${ahHtml(q.question)}</td><td>${ahHtml(q.response)}</td><td>${ahHtml(q.finding)}</td></tr>`).join('')
              : '<tr><td colspan="5">No detailed question data stored for this historic audit.</td></tr>'}
          </tbody>
        </table>

        <h3>Photographs</h3>
        <div>${photoHtml}</div>
      </div>

      <p>
        <button onclick="printAuditReview()">Print Audit Booklet</button>
        <button class="secondary" onclick="downloadAuditHtml()">Download HTML Booklet</button>
        <button class="secondary" onclick="toggleRawAudit()">Show Raw Audit JSON</button>
      </p>

      <pre id="rawAuditJson" class="hide">${ahHtml(JSON.stringify(data, null, 2))}</pre>
    `;
  } catch(e) {
    $('auditDetail').textContent = e.message;
  }
}

function toggleRawAudit(){
  const el = $('rawAuditJson');
  if (el) el.classList.toggle('hide');
}

function printAuditReview(){
  const content = $('auditPrintArea')?.innerHTML || '';
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>Audit Review</title><style>body{font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#eee}img{max-width:180px;max-height:140px;margin:4px}</style></head><body>' + content + '</body></html>');
  w.document.close();
  w.print();
}

function downloadAuditHtml(){
  const content = $('auditPrintArea')?.innerHTML || '';
  const blob = new Blob(['<html><body>' + content + '</body></html>'], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'audit-review.html';
  a.click();
}
