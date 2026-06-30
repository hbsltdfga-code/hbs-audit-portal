// HBS Compliance Manager - Tightness Test Centre v10.4
// Calculates stabilisation period, test duration and indicative permitted pressure drop
// from the IGEM UP/1 table logic used in the HBS tightness calculator.

const HBS_TT_GASES = {
  'Natural Gas': { f1: 42, mplrNew: 0.0014, mplrBperM3: 0.0005, mplrCD: 0.03 },
  'Propane':     { f1: 102, mplrNew: 0.00057, mplrBperM3: 0.0002, mplrCD: 0.0123 },
  'Butane':      { f1: 128, mplrNew: 0.00044, mplrBperM3: 0.00016, mplrCD: 0.0098 }
};

function ttUser(){ return window.HBS?.user || window.user || {name:'',role:'engineer'}; }
function ttVal(id){ return document.getElementById(id)?.value || ''; }
function ttNum(id){ const v=parseFloat(ttVal(id)); return Number.isFinite(v)?v:0; }
function ttSet(id,v){ const e=document.getElementById(id); if(e)e.textContent=v; }
function ttStandard(iv, chosen){ return chosen === 'auto' ? (iv <= 1 ? 'TPCP1A' : 'TPCP1') : chosen; }

function calculateTightnessResult(){
  const gasName = ttVal('ttGas') || 'Natural Gas';
  const gas = HBS_TT_GASES[gasName] || HBS_TT_GASES['Natural Gas'];
  const installationType = ttVal('ttInstallType') || 'Existing';
  const area = ttVal('ttArea') || 'B';
  const iv = ttNum('ttIV');
  const roomVol = ttNum('ttRoomVol') || 60;
  const grm = ttNum('ttGauge');
  const testPressure = ttNum('ttPressure') || 21;
  const measuredDrop = ttNum('ttMeasuredDrop');
  const standard = ttStandard(iv, ttVal('ttStandard') || 'auto');

  // TTD formula logic follows the IGEM UP/1 timing table approach used in the HBS calculator:
  // New/Area A: GRM × IV × F1
  // Existing Area B: 2.8 × GRM × IV × RV^-1 × F1
  // Existing Area C/D: 0.047 × GRM × IV × F1
  let ttdRaw = 0;
  if (installationType === 'New' || area === 'A') ttdRaw = grm * iv * gas.f1;
  else if (area === 'B') ttdRaw = 2.8 * grm * iv * (1 / roomVol) * gas.f1;
  else ttdRaw = 0.047 * grm * iv * gas.f1;

  const testDuration = Math.max(2, Math.ceil(ttdRaw));
  const stabilisation = standard === 'TPCP1A' ? Math.max(testDuration, 6) : Math.max(testDuration, 15);

  let mplr = 0;
  if (installationType === 'New' || area === 'A') mplr = gas.mplrNew;
  else if (area === 'B') mplr = gas.mplrBperM3 * roomVol;
  else mplr = gas.mplrCD;

  // F3 for fuel gas at operating pressure, used by the previous HBS calculator.
  const f3 = 0.059;
  let permittedDrop = iv > 0 ? (mplr * testDuration) / (f3 * iv) : 0;
  if (permittedDrop > testPressure) permittedDrop = testPressure;

  let outcome = 'CHECK';
  if (iv > 0) outcome = measuredDrop <= permittedDrop ? 'PASS' : 'FAIL / INVESTIGATE';

  return {
    site_name: ttVal('ttSite'),
    client: ttVal('ttClient'),
    engineer_name: ttVal('ttEngineer') || ttUser().name,
    audit_ref: ttVal('ttRef'),
    test_date: ttVal('ttDate') || new Date().toISOString().slice(0,10),
    gas_type: gasName,
    installation_type: installationType,
    test_area: area,
    standard,
    installation_volume: iv,
    room_volume: roomVol,
    gauge_resolution: grm,
    test_pressure: testPressure,
    measured_drop: measuredDrop,
    stabilisation_time: stabilisation,
    test_duration: testDuration,
    total_test_time: stabilisation + testDuration,
    permitted_drop: permittedDrop,
    mplr,
    f1: gas.f1,
    f3,
    outcome,
    source_reference: 'IGE/UP/1 tables supplied by HBS: timing factor / F1 / MPLR / F3 logic'
  };
}

function updateTightnessCalculation(){
  const r = calculateTightnessResult();
  ttSet('ttStdOut', r.standard);
  ttSet('ttStabOut', `${r.stabilisation_time} minutes`);
  ttSet('ttDurOut', `${r.test_duration} minutes`);
  ttSet('ttTotalOut', `${r.total_test_time} minutes`);
  ttSet('ttDropOut', `${r.permitted_drop.toFixed(3)} mbar`);
  ttSet('ttOutcomeOut', r.outcome);
  const report = `HBS Tightness Test Record\nSite: ${r.site_name}\nClient: ${r.client}\nEngineer: ${r.engineer_name}\nDate: ${r.test_date}\nGas Type: ${r.gas_type}\nInstallation Type: ${r.installation_type}\nTest Area: ${r.test_area}\nStandard: ${r.standard}\nInstallation Volume: ${r.installation_volume.toFixed(6)} m³\nRoom Volume: ${r.room_volume.toFixed(3)} m³\nGauge Resolution: ${r.gauge_resolution} mbar\nTest Pressure: ${r.test_pressure} mbar\nStabilisation Time: ${r.stabilisation_time} minutes\nTest Duration: ${r.test_duration} minutes\nTotal Time: ${r.total_test_time} minutes\nPermitted Drop: ${r.permitted_drop.toFixed(3)} mbar\nMeasured Drop: ${r.measured_drop.toFixed(3)} mbar\nOutcome: ${r.outcome}\nSource: ${r.source_reference}`;
  const out = document.getElementById('ttReport'); if(out) out.textContent = report;
  return r;
}

async function loadTightness(){
  const u = ttUser();
  setHtml('tightness', `
    <h2>Tightness Test Centre</h2>
    <p class="muted">Enter the test details below. The system calculates the stabilisation time, test duration and indicative permitted pressure drop using the IGEM UP/1 table logic built into the HBS calculator.</p>

    <div class="grid">
      <label>Site Name<br><input id="ttSite" placeholder="Site name"></label>
      <label>Client<br><input id="ttClient" placeholder="Client"></label>
      <label>Engineer<br><input id="ttEngineer" value="${safe(u.name||'')}"></label>
      <label>Date<br><input id="ttDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
      <label>Job / Audit Ref<br><input id="ttRef" placeholder="Optional"></label>
      <label>Gas Type<br><select id="ttGas"><option>Natural Gas</option><option>Propane</option><option>Butane</option></select></label>
      <label>Procedure<br><select id="ttStandard"><option value="auto">Auto based on IV</option><option>TPCP1A</option><option>TPCP1</option></select></label>
      <label>Installation Type<br><select id="ttInstallType"><option>Existing</option><option>New</option></select></label>
      <label>Test Area<br><select id="ttArea"><option value="A">Type A - New / inadequately ventilated</option><option value="B">Type B - Existing rooms under 60m³</option><option value="C">Type C - Room over 60m³ + pipe volume</option><option value="D">Type D - Underground</option></select></label>
      <label>Installation Volume m³<br><input id="ttIV" type="number" step="0.000001" value="0"></label>
      <label>Room Volume m³<br><input id="ttRoomVol" type="number" step="0.001" value="60"></label>
      <label>Gauge Resolution<br><select id="ttGauge"><option value="0.01">Electronic gauge - 2 decimal place</option><option value="0.1">Electronic gauge - 1 decimal place</option><option value="1">Electronic gauge - 0 decimal place</option><option value="0.5">Water gauge</option></select></label>
      <label>Test Pressure mbar<br><input id="ttPressure" type="number" step="0.1" value="21"></label>
      <label>Measured Pressure Drop mbar<br><input id="ttMeasuredDrop" type="number" step="0.001" value="0"></label>
    </div>

    <p>
      <button onclick="updateTightnessCalculation()">Calculate Times</button>
      <button onclick="saveTightness()">Save Test Record</button>
      <button class="secondary" onclick="clearTightnessForm()">Clear Form</button>
      <button class="secondary" onclick="loadTightnessRecords()">Refresh Records</button>
      <button class="secondary" onclick="window.print()">Print / PDF</button>
    </p>
    <p id="ttMsg" class="muted"></p>

    <div class="statgrid">
      <div class="stat"><b>Selected Standard</b><br><b id="ttStdOut">TPCP1A</b></div>
      <div class="stat"><b>Stabilisation</b><br><b id="ttStabOut">6 minutes</b></div>
      <div class="stat"><b>Test Duration</b><br><b id="ttDurOut">2 minutes</b></div>
      <div class="stat"><b>Total Time</b><br><b id="ttTotalOut">8 minutes</b></div>
      <div class="stat"><b>Permitted Drop</b><br><b id="ttDropOut">0.000 mbar</b></div>
      <div class="stat"><b>Outcome</b><br><b id="ttOutcomeOut">CHECK</b></div>
    </div>

    <h3>Generated Report</h3>
    <pre id="ttReport"></pre>

    <h3>Saved Tightness Records</h3>
    <table><thead><tr><th>ID</th><th>Date</th><th>Engineer</th><th>Site</th><th>Gas</th><th>IV</th><th>Stab</th><th>Duration</th><th>Drop</th><th>Result</th><th>Action</th></tr></thead><tbody id="ttRows"></tbody></table>
    <h3>Selected Record</h3>
    <div id="ttDetail" class="muted">Select a record to review details.</div>
  `);
  document.querySelectorAll('#tightness input,#tightness select').forEach(el => el.addEventListener('input', updateTightnessCalculation));
  updateTightnessCalculation();
  await loadTightnessRecords();
}

function clearTightnessForm(){
  ['ttSite','ttClient','ttRef'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['ttIV','ttMeasuredDrop'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='0';});
  updateTightnessCalculation();
}

async function saveTightness(){
  try{
    const r = updateTightnessCalculation();
    if(!r.site_name) throw new Error('Enter a site name before saving.');
    if(!r.installation_volume || r.installation_volume <= 0) throw new Error('Enter installation volume before saving.');
    const u = ttUser();
    const body = {
      engineer_name: r.engineer_name || u.name,
      role: u.role,
      site_name: r.site_name,
      client: r.client,
      audit_ref: r.audit_ref,
      test_date: r.test_date,
      area_tested: r.test_area,
      test_type: r.standard,
      installation_volume: r.installation_volume,
      test_pressure: r.test_pressure,
      stabilisation_time: r.stabilisation_time,
      test_duration: r.test_duration,
      measured_drop: r.measured_drop,
      permitted_leak_rate: r.mplr,
      calculated_leak_rate: r.permitted_drop,
      outcome: r.outcome,
      notes: document.getElementById('ttReport')?.textContent || '',
      details_json: JSON.stringify(r)
    };
    const j = await api('/api/tightness',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    document.getElementById('ttMsg').textContent = 'Saved tightness test record ID ' + j.id;
    await loadTightnessRecords();
  } catch(e){ document.getElementById('ttMsg').textContent = e.message; }
}

async function loadTightnessRecords(){
  try{
    const u = ttUser();
    const j = await api(`/api/tightness?role=${encodeURIComponent(u.role||'engineer')}&engineer=${encodeURIComponent(u.name||'')}`);
    window._tightnessRecords = j.records || [];
    const rows = window._tightnessRecords.map(r => {
      let d={}; try{d=JSON.parse(r.details_json||'{}')}catch(e){}
      return `<tr><td>${safe(r.id)}</td><td>${safe(r.test_date)}</td><td>${safe(r.engineer_name)}</td><td>${safe(r.site_name)}</td><td>${safe(d.gas_type||'')}</td><td>${Number(r.installation_volume||0).toFixed(6)}</td><td>${safe(r.stabilisation_time)}</td><td>${safe(r.test_duration)}</td><td>${Number(r.measured_drop||0).toFixed(3)}</td><td>${safe(r.outcome)}</td><td><button onclick="viewTightnessDetail(${Number(r.id)})">View</button></td></tr>`;
    }).join('');
    document.getElementById('ttRows').innerHTML = rows || '<tr><td colspan="11">No saved tightness test records.</td></tr>';
  } catch(e){ document.getElementById('ttRows').innerHTML = `<tr><td colspan="11">${safe(e.message)}</td></tr>`; }
}

function viewTightnessDetail(id){
  const r=(window._tightnessRecords||[]).find(x=>Number(x.id)===Number(id));
  if(!r)return;
  let d={}; try{d=JSON.parse(r.details_json||'{}')}catch(e){}
  document.getElementById('ttDetail').innerHTML = `<table><tr><th>ID</th><td>${safe(r.id)}</td></tr><tr><th>Date</th><td>${safe(r.test_date)}</td></tr><tr><th>Engineer</th><td>${safe(r.engineer_name)}</td></tr><tr><th>Site</th><td>${safe(r.site_name)}</td></tr><tr><th>Client</th><td>${safe(r.client)}</td></tr><tr><th>Gas Type</th><td>${safe(d.gas_type)}</td></tr><tr><th>Standard</th><td>${safe(r.test_type)}</td></tr><tr><th>Installation Volume</th><td>${Number(r.installation_volume||0).toFixed(6)} m³</td></tr><tr><th>Stabilisation</th><td>${safe(r.stabilisation_time)} minutes</td></tr><tr><th>Test Duration</th><td>${safe(r.test_duration)} minutes</td></tr><tr><th>Permitted Drop</th><td>${Number(r.calculated_leak_rate||0).toFixed(3)} mbar</td></tr><tr><th>Measured Drop</th><td>${Number(r.measured_drop||0).toFixed(3)} mbar</td></tr><tr><th>Outcome</th><td>${safe(r.outcome)}</td></tr><tr><th>Report</th><td><pre>${safe(r.notes||'')}</pre></td></tr></table>`;
}
