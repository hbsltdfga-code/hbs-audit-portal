// HBS Compliance Manager - Tightness Test Centre v11.2.1
// Professional responsive full calculator with IGEM table-based timing, saveable records and PDA/tablet layout fix.
// Includes pipework entries, rotary/turbine flange + meter length calculation, meter/manual volumes and fittings/manual allowances.

const HBS_TT_GASES = {
  'Natural Gas': { f1: 42,  mplrNew: 0.0014,  mplrBperM3: 0.0005,  mplrCD: 0.03 },
  'Propane':     { f1: 102, mplrNew: 0.00057, mplrBperM3: 0.0002,  mplrCD: 0.0123 },
  'Butane':      { f1: 128, mplrNew: 0.00044, mplrBperM3: 0.00016, mplrCD: 0.0098 }
};

const HBS_PIPE_DATA = {
  'Steel/Iron': {'DN15':16.1,'DN20':21.6,'DN25':27.2,'DN32':35.9,'DN40':41.8,'DN50':53.0,'DN65':68.8,'DN80':80.8,'DN100':105.3,'DN125':130.8,'DN150':155.4},
  'Copper': {'DN15':13.6,'DN22':20.2,'DN28':26.2,'DN35':32.6,'DN42':39.6,'DN54':51.6,'DN67':64.6,'DN76':73.6,'DN108':105.6},
  'PE SDR11': {'DN20':16.4,'DN25':20.4,'DN32':26.2,'DN40':32.6,'DN63':51.4,'DN90':73.6,'DN125':102.2,'DN180':147.2},
  'PE SDR17': {'DN63':55.4,'DN90':79.2,'DN125':110.2,'DN180':158.6,'DN250':220.4},
  'Manual': {'Manual':0}
};

const HBS_METER_STD = {
  'None': 0,
  'U6': 0.006,
  'U16': 0.016,
  'U25': 0.025,
  'U40': 0.040,
  'U65': 0.065,
  'U100': 0.100,
  'G160': 0.160,
  'G250': 0.250,
  'G400': 0.400,
  'G650': 0.650,
  'Other': 0
};

function ttUser(){ return window.HBS?.user || window.user || {name:'',role:'engineer'}; }
function ttEl(id){ return document.getElementById(id); }
function ttVal(id){ return ttEl(id)?.value || ''; }
function ttNum(id){ const v=parseFloat(ttVal(id)); return Number.isFinite(v)?v:0; }
function ttSet(id,v){ const e=ttEl(id); if(e)e.textContent=v; }
function ttSafe(v){ return typeof safe === 'function' ? safe(v) : String(v ?? '').replace(/[&<>'"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
function ttPerM(idmm){ const d = Number(idmm||0)/1000; return Math.PI*d*d/4; }
function ttStandard(iv, chosen){ return chosen === 'auto' ? (iv <= 1 ? 'TPCP1A' : 'TPCP1') : chosen; }

function ttMaterialOptions(){ return Object.keys(HBS_PIPE_DATA).map(m=>`<option value="${m}">${m}</option>`).join(''); }
function ttMeterOptions(){ return Object.entries(HBS_METER_STD).map(([k,v])=>`<option value="${k}">${k}${v?` - ${v.toFixed(3)} m³`:''}</option>`).join(''); }

function ttPipeRowHtml(i){
  return `<tr>
    <td class="ttNo">${i}</td>
    <td><select class="input ttMat">${ttMaterialOptions()}</select></td>
    <td><select class="input ttSize"></select></td>
    <td><input class="input ttLen" type="number" step="0.01" value="0" placeholder="0.00"></td>
    <td class="calc tt-calc-cell ttDiaOut">0.0</td>
    <td class="calc tt-calc-cell ttPerMOut">0.000000</td>
    <td class="calc tt-calc-cell ttVolOut">0.000000</td>
    <td><button type="button" class="danger tt-mini" onclick="ttRemovePipeRow(this)">Remove</button></td>
  </tr>`;
}

async function loadTightness(){
  const u = ttUser();
  setHtml('tightness', `
    <h2>Tightness Test Centre</h2>
    <p class="muted">Professional commercial gas tightness test calculator using HBS pipework entries, meter volume calculation and IGEM table-based timing. The competent engineer remains responsible for confirming the final judgement against the controlled IGEM document.</p>

    <style>
      #tightness{--hbs-blue:#0b3d70;--hbs-mid:#14558f;--hbs-line:#d6e3f2;--hbs-bg:#f6f9fd;--hbs-card:#ffffff;--hbs-muted:#52657a;}
      #tightness .tt-layout{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;align-items:start;}
      #tightness .tt-card{background:var(--hbs-card);border:1px solid var(--hbs-line);border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.04);padding:14px;box-sizing:border-box;overflow:hidden;}
      #tightness .tt-card h3{display:flex;gap:10px;align-items:center;margin:0 0 4px 0;font-size:18px;}
      #tightness .tt-sub{margin:0 0 12px 0;color:var(--hbs-muted);font-size:13px;}
      #tightness .tt-step{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--hbs-blue);color:white;font-weight:700;flex:0 0 auto;}
      #tightness .span-12{grid-column:span 12}.span-8{grid-column:span 12}.span-6{grid-column:span 6}.span-4{grid-column:span 12}.span-3{grid-column:span 3}
      #tightness .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:end;}
      #tightness label{display:block;font-weight:600;color:#10233d;font-size:13px;}
      #tightness label input,#tightness label select,#tightness label textarea{width:100%;box-sizing:border-box;margin-top:6px;background:#fff;border:1px solid #bfd0e3;border-radius:8px;padding:9px;font-size:14px;min-height:38px;}
      #tightness label input:focus,#tightness label select:focus,#tightness label textarea:focus{outline:none;border-color:var(--hbs-mid);box-shadow:0 0 0 3px rgba(20,85,143,.14);}
      #tightness .tt-table-wrap{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--hbs-line);border-radius:10px;background:#fff;margin:10px 0;box-sizing:border-box;}
      #tightness .tt-table-wrap table{width:100%;min-width:760px;margin:0;border-collapse:collapse;table-layout:auto;}
      #tightness .tt-table-wrap th{background:#edf4fb;color:#10233d;font-size:12px;text-align:left;padding:9px;white-space:nowrap;}
      #tightness .tt-table-wrap td{padding:8px;border-top:1px solid #edf2f7;vertical-align:middle;white-space:nowrap;}
      #tightness .tt-table-wrap th:nth-child(1),#tightness .tt-table-wrap td:nth-child(1){width:48px;}
      #tightness .tt-table-wrap th:nth-child(2),#tightness .tt-table-wrap td:nth-child(2){width:150px;}
      #tightness .tt-table-wrap th:nth-child(3),#tightness .tt-table-wrap td:nth-child(3){width:130px;}
      #tightness .tt-table-wrap th:nth-child(4),#tightness .tt-table-wrap td:nth-child(4){width:130px;}
      #tightness .tt-table-wrap th:nth-child(5),#tightness .tt-table-wrap td:nth-child(5),#tightness .tt-table-wrap th:nth-child(6),#tightness .tt-table-wrap td:nth-child(6),#tightness .tt-table-wrap th:nth-child(7),#tightness .tt-table-wrap td:nth-child(7){width:110px;}
      #tightness .tt-table-wrap th:nth-child(8),#tightness .tt-table-wrap td:nth-child(8){width:90px;}
      #tightness .tt-table-wrap input,#tightness .tt-table-wrap select{width:100%;min-width:88px;box-sizing:border-box;border:1px solid #bfd0e3;border-radius:7px;padding:7px;background:#fff;}
      #tightness .tt-table-wrap .ttLen{min-width:80px;}
      #tightness .tt-calc-cell{background:#f4f8fc;color:#0b2f55;font-weight:600;}
      #tightness .tt-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0;}
      #tightness .stat{background:#f8fbff;border:1px solid var(--hbs-line);border-radius:12px;min-height:70px;box-sizing:border-box;padding:12px;overflow-wrap:anywhere;}
      #tightness .stat b:first-child{font-size:12px;color:#33465c;text-transform:uppercase;letter-spacing:.02em;}
      #tightness .stat b:last-child{font-size:18px;color:#0b2f55;}
      #tightness .tt-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;}
      #tightness .tt-mini{padding:6px 9px;font-size:12px;}
      #tightness #ttReport{white-space:pre-wrap;max-height:300px;overflow:auto;background:#f8fbff;border:1px solid var(--hbs-line);border-radius:10px;padding:12px;font-size:12px;}
      #tightness .tt-outcome-pass{border-color:#9bd7af;background:#eefaf2;color:#0f6a2b;}
      #tightness .tt-outcome-fail{border-color:#efb1b1;background:#fff4f4;color:#9a1f1f;}
      #tightness .tt-note{background:#f5f8fc;border-left:5px solid var(--hbs-mid);padding:10px 12px;border-radius:8px;color:#33465c;margin:10px 0;}
      @media(max-width:1100px){#tightness .span-8,#tightness .span-6,#tightness .span-4,#tightness .span-3{grid-column:span 12;}#tightness .tt-layout{grid-template-columns:1fr;}#tightness .tt-table-wrap table{min-width:720px;}}
      @media(max-width:700px){#tightness .grid{grid-template-columns:1fr;}#tightness .tt-card{padding:12px;border-radius:10px;}#tightness .tt-actions button{width:100%;}.tt-table-wrap{font-size:12px;}}
    </style>

    <div class="tt-layout">
      <div class="tt-card span-12"><h3><span class="tt-step">1</span> Site and Test Details</h3><p class="tt-sub">Complete the core test details before saving the record.</p>
        <div class="grid">
          <label>Site Name<input id="ttSite" placeholder="Site name"></label>
          <label>Client<input id="ttClient" placeholder="Client"></label>
          <label>Engineer<input id="ttEngineer" value="${ttSafe(u.name||'')}"></label>
          <label>Date<input id="ttDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
          <label>Job / Audit Ref<input id="ttRef" placeholder="Optional"></label>
          <label>Area Tested<input id="ttAreaTested" placeholder="e.g. Boiler room, kitchen gas line"></label>
          <label>Gas Type<select id="ttGas"><option>Natural Gas</option><option>Propane</option><option>Butane</option></select></label>
          <label>Procedure<select id="ttStandard"><option value="auto">Auto based on IV</option><option>TPCP1A</option><option>TPCP1</option></select></label>
          <label>Installation Type<select id="ttInstallType"><option>Existing</option><option>New</option></select></label>
          <label>Test Area<select id="ttArea"><option value="A">Type A - New / inadequately ventilated</option><option value="B">Type B - Existing rooms under 60m³</option><option value="C">Type C - Room over 60m³ + pipe volume</option><option value="D">Type D - Underground</option></select></label>
          <label>Room Volume m³<input id="ttRoomVol" type="number" step="0.001" value="60"></label>
          <label>Gauge Resolution<select id="ttGauge"><option value="0.01">Electronic gauge - 2 decimal place</option><option value="0.1">Electronic gauge - 1 decimal place</option><option value="1">Electronic gauge - 0 decimal place</option><option value="0.5">Water gauge</option><option value="0.1">High S.G gauge</option></select></label>
        </div>
      </div>

      <div class="tt-card span-8"><h3><span class="tt-step">2</span> Pipework Data</h3><p class="tt-sub">Add each pipe section. Volumes are calculated from material, size and length.</p>
        <div class="tt-table-wrap"><table><thead><tr><th>No.</th><th>Material</th><th>Size</th><th>Length m</th><th>Used ID mm</th><th>m³/m</th><th>Volume m³</th><th>Remove</th></tr></thead><tbody id="ttPipeBody">
          ${ttPipeRowHtml(1)}${ttPipeRowHtml(2)}${ttPipeRowHtml(3)}
        </tbody></table></div>
        <p><button onclick="ttAddPipeRow()">+ Add Pipework Section</button></p>
      </div>

      <div class="tt-card span-4"><h3><span class="tt-step">3</span> Meter & Additional Volumes</h3><p class="tt-sub">Rotary and turbine meters calculate from flange internal diameter and meter length. Use manufacturer volume where published.</p>
        <div class="grid">
          <label>Meter Type<select id="ttMeterType"><option>None</option><option>Diaphragm / Standard Meter</option><option>Rotary</option><option>Turbine</option><option>Other / Manual</option></select></label>
          <label>Standard Meter Volume<select id="ttMeterStd">${ttMeterOptions()}</select></label>
          <label>Flange Internal Diameter mm<input id="ttMeterFlangeDia" type="number" step="0.1" value="0"></label>
          <label>Meter Length mm<input id="ttMeterLength" type="number" step="1" value="0"></label>
          <label>Manufacturer Meter Volume m³<input id="ttMeterManual" type="number" step="0.000001" value="0"></label>
          <label>Additional Installation Volume m³<input id="ttManualIV" type="number" step="0.000001" value="0"></label>
          <label>Fittings Allowance<select id="ttFittingsMode"><option value="10">Apply 10% of pipework volume</option><option value="manual">Manual fittings volume</option><option value="0">No fittings allowance</option></select></label>
          <label>Manual Fittings Volume m³<input id="ttManualFittings" type="number" step="0.000001" value="0"></label>
        </div>
      </div>

      <div class="tt-card span-8"><h3><span class="tt-step">4</span> IGEM Calculation</h3><p class="tt-sub">Calculated automatically from installation volume, gas type, area, pressure gauge resolution and test conditions.</p>
        <div class="tt-summary">
          <div class="stat"><b>Pipework Volume</b><br><b id="ttPipeVolOut">0.000000 m³</b></div>
          <div class="stat"><b>Meter Volume</b><br><b id="ttMeterVolOut">0.000000 m³</b></div>
          <div class="stat"><b>Fittings Volume</b><br><b id="ttFittingsVolOut">0.000000 m³</b></div>
          <div class="stat"><b>Manual Additions</b><br><b id="ttManualIVOut">0.000000 m³</b></div>
          <div class="stat"><b>Total IV</b><br><b id="ttIVOut">0.000000 m³</b></div>
          <div class="stat"><b>Standard</b><br><b id="ttStdOut">TPCP1A</b></div>
          <div class="stat"><b>Stabilisation</b><br><b id="ttStabOut">6 minutes</b></div>
          <div class="stat"><b>Test Duration</b><br><b id="ttDurOut">2 minutes</b></div>
          <div class="stat"><b>Total Time</b><br><b id="ttTotalOut">8 minutes</b></div>
          <div class="stat"><b>Permitted Drop</b><br><b id="ttDropOut">0.000 mbar</b></div>
        </div>
      </div>

      <div class="tt-card span-4"><h3><span class="tt-step">5</span> Test Record</h3><p class="tt-sub">Enter measured results and save the completed test.</p>
        <div class="grid">
          <label>Test Pressure mbar<input id="ttPressure" type="number" step="0.1" value="21"></label>
          <label>Measured Pressure Drop mbar<input id="ttMeasuredDrop" type="number" step="0.001" value="0"></label>
        </div>
        <div id="ttOutcomeCard" class="stat" style="margin-top:12px"><b>Outcome</b><br><b id="ttOutcomeOut">CHECK</b></div>
        <p class="tt-actions">
          <button onclick="updateTightnessCalculation()">Calculate</button>
          <button onclick="saveTightness()">Save Test Record</button>
          <button class="secondary" onclick="clearTightnessForm()">Clear Form</button>
          <button class="secondary" onclick="window.print()">Print / PDF</button>
        </p>
        <p id="ttMsg" class="muted"></p>
      </div>

      <div class="tt-card span-12"><h3>Generated Report</h3><pre id="ttReport"></pre></div>

      <div class="tt-card span-12"><h3>Saved Tightness Records</h3>
        <p><button class="secondary" onclick="loadTightnessRecords()">Refresh Records</button></p>
        <div class="tt-table-wrap"><table><thead><tr><th>ID</th><th>Date</th><th>Engineer</th><th>Site</th><th>Gas</th><th>IV</th><th>Stab</th><th>Duration</th><th>Drop</th><th>Result</th><th>Action</th></tr></thead><tbody id="ttRows"></tbody></table></div>
        <h3>Selected Record</h3><div id="ttDetail" class="muted">Select a record to review details.</div>
      </div>
    </div>
  `);
  ttInitialisePipeRows();
  document.querySelectorAll('#tightness input,#tightness select').forEach(el => { el.addEventListener('input', updateTightnessCalculation); el.addEventListener('change', updateTightnessCalculation); });
  updateTightnessCalculation();
  await loadTightnessRecords();
}

function ttInitialisePipeRows(){
  document.querySelectorAll('#ttPipeBody tr').forEach(tr=>ttBindPipeRow(tr));
  ttRenumberPipeRows();
}
function ttBindPipeRow(tr){
  const mat = tr.querySelector('.ttMat');
  const size = tr.querySelector('.ttSize');
  mat.addEventListener('change',()=>ttFillSizes(tr));
  size.addEventListener('change',updateTightnessCalculation);
  tr.querySelector('.ttLen').addEventListener('input',updateTightnessCalculation);
  ttFillSizes(tr);
}
function ttFillSizes(tr){
  const mat = tr.querySelector('.ttMat').value;
  const size = tr.querySelector('.ttSize');
  const old = size.value;
  size.innerHTML = Object.keys(HBS_PIPE_DATA[mat]||{}).map(s=>`<option value="${s}">${s}</option>`).join('');
  if((HBS_PIPE_DATA[mat]||{})[old] !== undefined) size.value = old;
  updateTightnessCalculation();
}
function ttRenumberPipeRows(){ document.querySelectorAll('#ttPipeBody tr').forEach((tr,i)=>tr.querySelector('.ttNo').textContent=i+1); }
function ttAddPipeRow(){
  const body = ttEl('ttPipeBody');
  body.insertAdjacentHTML('beforeend', ttPipeRowHtml(body.querySelectorAll('tr').length+1));
  ttBindPipeRow(body.lastElementChild);
  ttRenumberPipeRows();
  updateTightnessCalculation();
}
function ttRemovePipeRow(btn){
  const rows = document.querySelectorAll('#ttPipeBody tr');
  if(rows.length <= 1){ alert('At least one pipework section must remain.'); return; }
  btn.closest('tr').remove();
  ttRenumberPipeRows();
  updateTightnessCalculation();
}

function ttGetPipeRows(){
  const rows=[]; let pipeVol=0;
  document.querySelectorAll('#ttPipeBody tr').forEach((tr,i)=>{
    const material = tr.querySelector('.ttMat').value;
    const size = tr.querySelector('.ttSize').value;
    const length = parseFloat(tr.querySelector('.ttLen').value)||0;
    const manualDia = 0;
    const idmm = ((HBS_PIPE_DATA[material]||{})[size]||0);
    const volumePerM = ttPerM(idmm);
    const volume = volumePerM * length;
    pipeVol += volume;
    tr.querySelector('.ttDiaOut').textContent = idmm.toFixed(1);
    tr.querySelector('.ttPerMOut').textContent = volumePerM.toFixed(6);
    tr.querySelector('.ttVolOut').textContent = volume.toFixed(6);
    rows.push({section:i+1, material, size, length_m:length, manual_diameter_mm:manualDia, internal_diameter_mm:idmm, volume_per_m:volumePerM, volume_m3:volume});
  });
  return {rows, pipeVol};
}

function ttCalculateMeterVolume(){
  const type = ttVal('ttMeterType');
  const standardName = ttVal('ttMeterStd');
  const standardVolume = HBS_METER_STD[standardName] || 0;
  const flangeDiaMm = ttNum('ttMeterFlangeDia');
  const meterLengthMm = ttNum('ttMeterLength');
  const manualVolume = ttNum('ttMeterManual');
  const cylindricalVolume = flangeDiaMm > 0 && meterLengthMm > 0 ? ttPerM(flangeDiaMm) * (meterLengthMm/1000) : 0;
  let source = 'None';
  let volume = 0;

  if(manualVolume > 0){ volume = manualVolume; source = 'Manual / manufacturer meter volume'; }
  else if((type === 'Rotary' || type === 'Turbine') && cylindricalVolume > 0){ volume = cylindricalVolume; source = 'Calculated from flange internal diameter and meter length'; }
  else if(standardVolume > 0){ volume = standardVolume; source = 'Standard meter volume'; }

  return {type, standard_name:standardName, standard_volume:standardVolume, flange_diameter_mm:flangeDiaMm, meter_length_mm:meterLengthMm, calculated_cylindrical_volume:cylindricalVolume, manual_volume:manualVolume, volume, source};
}

function calculateTightnessResult(){
  const pipe = ttGetPipeRows();
  const meter = ttCalculateMeterVolume();
  const fittingsMode = ttVal('ttFittingsMode');
  const manualFittings = ttNum('ttManualFittings');
  const fittingsVol = fittingsMode === '10' ? pipe.pipeVol * 0.10 : (fittingsMode === 'manual' ? manualFittings : 0);
  const manualIV = ttNum('ttManualIV');
  const iv = pipe.pipeVol + meter.volume + fittingsVol + manualIV;

  const gasName = ttVal('ttGas') || 'Natural Gas';
  const gas = HBS_TT_GASES[gasName] || HBS_TT_GASES['Natural Gas'];
  const installationType = ttVal('ttInstallType') || 'Existing';
  const area = ttVal('ttArea') || 'B';
  const roomVol = ttNum('ttRoomVol') || 60;
  const grm = ttNum('ttGauge') || 0.01;
  const testPressure = ttNum('ttPressure') || 21;
  const measuredDrop = ttNum('ttMeasuredDrop');
  const standard = ttStandard(iv, ttVal('ttStandard') || 'auto');

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

  const f3 = 0.059;
  let permittedDrop = iv > 0 ? (mplr * testDuration) / (f3 * iv) : 0;
  if (permittedDrop > testPressure) permittedDrop = testPressure;

  let outcome = 'CHECK';
  if (iv > 0) outcome = measuredDrop <= permittedDrop ? 'PASS' : 'FAIL / INVESTIGATE';

  return {
    site_name: ttVal('ttSite'), client: ttVal('ttClient'), engineer_name: ttVal('ttEngineer') || ttUser().name,
    audit_ref: ttVal('ttRef'), test_date: ttVal('ttDate') || new Date().toISOString().slice(0,10), area_tested: ttVal('ttAreaTested'),
    gas_type: gasName, installation_type: installationType, test_area: area, standard,
    pipe_rows: pipe.rows, pipework_volume: pipe.pipeVol, meter, fittings_mode: fittingsMode, fittings_volume: fittingsVol, manual_fittings_volume: manualFittings,
    manual_installation_volume: manualIV, installation_volume: iv, room_volume: roomVol, gauge_resolution: grm,
    test_pressure: testPressure, measured_drop: measuredDrop, stabilisation_time: stabilisation, test_duration: testDuration,
    total_test_time: stabilisation + testDuration, permitted_drop: permittedDrop, mplr, f1: gas.f1, f3, outcome,
    source_reference: 'IGE/UP/1 tables supplied by HBS: timing factor / F1 / MPLR / F3 logic'
  };
}

function updateTightnessCalculation(){
  const r = calculateTightnessResult();
  ttSet('ttPipeVolOut', `${r.pipework_volume.toFixed(6)} m³`);
  ttSet('ttMeterVolOut', `${r.meter.volume.toFixed(6)} m³`);
  ttSet('ttFittingsVolOut', `${r.fittings_volume.toFixed(6)} m³`);
  ttSet('ttManualIVOut', `${r.manual_installation_volume.toFixed(6)} m³`);
  ttSet('ttIVOut', `${r.installation_volume.toFixed(6)} m³`);
  ttSet('ttStdOut', r.standard);
  ttSet('ttStabOut', `${r.stabilisation_time} minutes`);
  ttSet('ttDurOut', `${r.test_duration} minutes`);
  ttSet('ttTotalOut', `${r.total_test_time} minutes`);
  ttSet('ttDropOut', `${r.permitted_drop.toFixed(3)} mbar`);
  ttSet('ttOutcomeOut', r.outcome);
  const oc = ttEl('ttOutcomeCard');
  if(oc){ oc.classList.remove('tt-outcome-pass','tt-outcome-fail'); if(r.outcome==='PASS') oc.classList.add('tt-outcome-pass'); if(String(r.outcome).startsWith('FAIL')) oc.classList.add('tt-outcome-fail'); }

  const report = `HBS Commercial Gas Tightness Test Record\nSite: ${r.site_name}\nClient: ${r.client}\nJob / Audit Ref: ${r.audit_ref}\nEngineer: ${r.engineer_name}\nDate: ${r.test_date}\nArea Tested: ${r.area_tested}\nGas Type: ${r.gas_type}\nInstallation Type: ${r.installation_type}\nTest Area: ${r.test_area}\nStandard: ${r.standard}\n\nPipework Volume: ${r.pipework_volume.toFixed(6)} m³\nMeter Volume: ${r.meter.volume.toFixed(6)} m³ (${r.meter.source})\nFittings Volume: ${r.fittings_volume.toFixed(6)} m³\nManual Additional IV: ${r.manual_installation_volume.toFixed(6)} m³\nTotal Installation Volume: ${r.installation_volume.toFixed(6)} m³\n\nRoom Volume: ${r.room_volume.toFixed(3)} m³\nGauge Resolution: ${r.gauge_resolution} mbar\nTest Pressure: ${r.test_pressure} mbar\nStabilisation Time: ${r.stabilisation_time} minutes\nTest Duration: ${r.test_duration} minutes\nTotal Time: ${r.total_test_time} minutes\nPermitted Drop: ${r.permitted_drop.toFixed(3)} mbar\nMeasured Drop: ${r.measured_drop.toFixed(3)} mbar\nOutcome: ${r.outcome}\nSource: ${r.source_reference}`;
  const out = ttEl('ttReport'); if(out) out.textContent = report;
  return r;
}

function clearTightnessForm(){
  ['ttSite','ttClient','ttRef','ttAreaTested'].forEach(id=>{const e=ttEl(id);if(e)e.value='';});
  ['ttMeasuredDrop','ttMeterFlangeDia','ttMeterLength','ttMeterManual','ttManualIV','ttManualFittings'].forEach(id=>{const e=ttEl(id);if(e)e.value='0';});
  document.querySelectorAll('#ttPipeBody .ttLen').forEach(e=>e.value='0');
  updateTightnessCalculation();
}

async function saveTightness(){
  try{
    const r = updateTightnessCalculation();
    if(!r.site_name) throw new Error('Enter a site name before saving.');
    if(!r.installation_volume || r.installation_volume <= 0) throw new Error('Enter pipework, meter or manual installation volume before saving.');
    const u = ttUser();
    const body = {
      engineer_name: r.engineer_name || u.name, role: u.role, site_name: r.site_name, client: r.client, audit_ref: r.audit_ref,
      test_date: r.test_date, area_tested: r.area_tested || r.test_area, test_type: r.standard, installation_volume: r.installation_volume,
      test_pressure: r.test_pressure, stabilisation_time: r.stabilisation_time, test_duration: r.test_duration, measured_drop: r.measured_drop,
      permitted_leak_rate: r.mplr, calculated_leak_rate: r.permitted_drop, outcome: r.outcome,
      notes: ttEl('ttReport')?.textContent || '', details_json: JSON.stringify(r)
    };
    const j = await api('/api/tightness',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    ttEl('ttMsg').textContent = 'Saved tightness test record ID ' + j.id;
    await loadTightnessRecords();
  } catch(e){ ttEl('ttMsg').textContent = e.message; }
}

async function loadTightnessRecords(){
  try{
    const u = ttUser();
    const j = await api(`/api/tightness?role=${encodeURIComponent(u.role||'engineer')}&engineer=${encodeURIComponent(u.name||'')}`);
    window._tightnessRecords = j.records || [];
    const rows = window._tightnessRecords.map(r => {
      let d={}; try{d=JSON.parse(r.details_json||'{}')}catch(e){}
      return `<tr><td>${ttSafe(r.id)}</td><td>${ttSafe(r.test_date)}</td><td>${ttSafe(r.engineer_name)}</td><td>${ttSafe(r.site_name)}</td><td>${ttSafe(d.gas_type||'')}</td><td>${Number(r.installation_volume||0).toFixed(6)}</td><td>${ttSafe(r.stabilisation_time)}</td><td>${ttSafe(r.test_duration)}</td><td>${Number(r.measured_drop||0).toFixed(3)}</td><td>${ttSafe(r.outcome)}</td><td><button onclick="viewTightnessDetail(${Number(r.id)})">View</button></td></tr>`;
    }).join('');
    ttEl('ttRows').innerHTML = rows || '<tr><td colspan="11">No saved tightness test records.</td></tr>';
  } catch(e){ ttEl('ttRows').innerHTML = `<tr><td colspan="11">${ttSafe(e.message)}</td></tr>`; }
}

function viewTightnessDetail(id){
  const r=(window._tightnessRecords||[]).find(x=>Number(x.id)===Number(id));
  if(!r)return;
  let d={}; try{d=JSON.parse(r.details_json||'{}')}catch(e){}
  const pipeRows=(d.pipe_rows||[]).map(p=>`<tr><td>${ttSafe(p.section)}</td><td>${ttSafe(p.material)}</td><td>${ttSafe(p.size)}</td><td>${Number(p.length_m||0).toFixed(2)}</td><td>${Number(p.internal_diameter_mm||0).toFixed(1)}</td><td>${Number(p.volume_m3||0).toFixed(6)}</td></tr>`).join('');
  ttEl('ttDetail').innerHTML = `<table><tr><th>ID</th><td>${ttSafe(r.id)}</td></tr><tr><th>Date</th><td>${ttSafe(r.test_date)}</td></tr><tr><th>Engineer</th><td>${ttSafe(r.engineer_name)}</td></tr><tr><th>Site</th><td>${ttSafe(r.site_name)}</td></tr><tr><th>Client</th><td>${ttSafe(r.client)}</td></tr><tr><th>Gas Type</th><td>${ttSafe(d.gas_type)}</td></tr><tr><th>Standard</th><td>${ttSafe(r.test_type)}</td></tr><tr><th>Installation Volume</th><td>${Number(r.installation_volume||0).toFixed(6)} m³</td></tr><tr><th>Meter Volume</th><td>${Number(d.meter?.volume||0).toFixed(6)} m³ - ${ttSafe(d.meter?.source||'')}</td></tr><tr><th>Stabilisation</th><td>${ttSafe(r.stabilisation_time)} minutes</td></tr><tr><th>Test Duration</th><td>${ttSafe(r.test_duration)} minutes</td></tr><tr><th>Permitted Drop</th><td>${Number(r.calculated_leak_rate||0).toFixed(3)} mbar</td></tr><tr><th>Measured Drop</th><td>${Number(r.measured_drop||0).toFixed(3)} mbar</td></tr><tr><th>Outcome</th><td>${ttSafe(r.outcome)}</td></tr></table><h4>Pipework Sections</h4><table><thead><tr><th>No</th><th>Material</th><th>Size</th><th>Length m</th><th>ID mm</th><th>Volume m³</th></tr></thead><tbody>${pipeRows || '<tr><td colspan="6">No pipe rows recorded.</td></tr>'}</tbody></table><h4>Report</h4><pre>${ttSafe(r.notes||'')}</pre>`;
}
