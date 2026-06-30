/* HBS Compliance Manager v11.1
   Role-based Engineer and Manager Dashboard Experience.
   This file intentionally overrides loadDashboard(), buildNav() and startApp()
   from the legacy inline script without changing the other modules. */
(function(){
  function esc(v){
    return (v === undefined || v === null ? '' : String(v)).replace(/[<>&"]/g, function(c){
      return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];
    });
  }
  function num(v){ return Number(v || 0); }
  function pct(v){ return (Number(v || 0)) + '%'; }
  function statusClass(score, result){
    const r = String(result || '').toLowerCase();
    if (r.includes('fail') || score < 75) return 'dash-red';
    if (r.includes('improvement') || (score >= 75 && score < 85)) return 'dash-amber';
    return 'dash-green';
  }
  function statusLabel(score, result){
    if (result) return result;
    if (score >= 95) return 'Excellent';
    if (score >= 85) return 'Pass';
    if (score >= 75) return 'Improvement Required';
    if (score > 0) return 'Fail';
    return 'No audit yet';
  }
  function injectDashboardStyles(){
    if (document.getElementById('v11DashboardStyles')) return;
    const css = document.createElement('style');
    css.id = 'v11DashboardStyles';
    css.textContent = `
      .v11-home{max-width:1440px;margin:0 auto;}
      .v11-hero{background:linear-gradient(135deg,#0f3c69,#2472b5);color:#fff;border-radius:18px;padding:22px;margin-bottom:16px;display:grid;grid-template-columns:1.4fr .8fr;gap:18px;align-items:center;box-shadow:0 8px 24px #0b2d4d22;}
      .v11-hero h2{margin:0 0 6px;font-size:30px;color:#fff}.v11-hero p{margin:0;color:#dceeff}.v11-hero-badge{background:#ffffff18;border:1px solid #ffffff44;border-radius:14px;padding:14px;}
      .dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:12px 0}.dash-card{background:#fff;border:1px solid #d7e4f2;border-radius:15px;padding:16px;box-shadow:0 1px 5px #00000010;}.dash-card h3{margin:0 0 7px;color:#123f6d}.dash-card .big{font-size:30px;font-weight:800;margin-top:4px}.dash-card p{margin:4px 0;color:#52677f}.dash-card.action{border-left:7px solid #2369a7}.dash-card button{width:auto;min-width:120px}.dash-green{border-left:7px solid #228a46!important}.dash-amber{border-left:7px solid #d49100!important}.dash-red{border-left:7px solid #b3261e!important}.dash-blue{border-left:7px solid #2369a7!important}
      .dash-section{background:#fff;border:1px solid #d7e4f2;border-radius:16px;padding:16px;margin:14px 0;box-shadow:0 1px 5px #00000010}.dash-section h3{margin:0 0 10px;color:#123f6d}.dash-table-wrap{overflow-x:auto}.dash-table-wrap table{min-width:820px}.dash-pill{display:inline-block;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;background:#eef4fb;color:#123f6d;border:1px solid #d2e2f2}.dash-pill.red{background:#fff1f1;color:#8b1e1e;border-color:#f0c4c4}.dash-pill.amber{background:#fff7de;color:#7a5200;border-color:#ecd080}.dash-pill.green{background:#eaf8ee;color:#176a35;border-color:#bce5c8}.dash-empty{padding:18px;border:1px dashed #cbd9e7;border-radius:14px;color:#52677f;background:#f8fbff}.dash-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.dash-list{display:grid;gap:10px}.dash-item{display:flex;gap:12px;justify-content:space-between;align-items:center;border:1px solid #dbe7f2;border-radius:13px;padding:12px;background:#fbfdff}.dash-item strong{color:#123f6d}.dash-item small{display:block;color:#52677f;margin-top:3px}.dash-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.dash-tabs button{background:#eef4fb;color:#123f6d;border:1px solid #cadbeb}.dash-tabs button.primary{background:#123f6d;color:#fff}
      @media(max-width:840px){.v11-hero{grid-template-columns:1fr}.v11-hero h2{font-size:24px}.dash-item{display:block}.dash-item .dash-actions{margin-top:10px}.dash-card .big{font-size:24px}}
    `;
    document.head.appendChild(css);
  }

  window.buildNav = function(){
    const nav = $('nav');
    if (!nav) return;
    const base = [
      ['Home','dashboard',loadDashboard,'all'],
      ['New Audit','conductAudit',loadConductAudit,'audit'],
      ['Audit History','auditHistory',loadAuditHistory,'all'],
      ['Engineer Performance','competency',loadCompetency,'manager'],
      ['Training Centre','training',loadTraining,'all'],
      ['Tightness Test Centre','tightness',loadTightness,'all'],
      ['Knowledge Centre','knowledge',loadKnowledge,'all'],
      ['Administration','users',loadUsers,'manager'],
      ['Logout','logout',logout,'all']
    ];
    nav.innerHTML = '';
    base.forEach(function(item){
      const label=item[0], id=item[1], fn=item[2], perm=item[3];
      if (perm === 'manager' && !isManager()) return;
      if (perm === 'audit' && !(isManager() || isSenior())) return;
      const b=document.createElement('button');
      b.textContent=label;
      b.onclick=function(){ if(id==='logout') fn(); else { show(id); fn(); } };
      nav.appendChild(b);
    });
  };

  window.startApp = function(){
    $('loginCard').classList.add('hide');
    $('app').classList.remove('hide');
    $('loginStatus').textContent='Logged in: '+user.name+' ('+roleLabel(user.role)+')';
    buildNav();
    show('dashboard');
    loadDashboard();
  };

  function actionButtonForTraining(record){
    const type = String(record.training_type || '').toLowerCase();
    let key = '';
    if (type.includes('level 2') || type.includes('advanced') || type.includes('unsafe') || type.includes('gas safety')) key = 'level2';
    if (type.includes('level 1') || type.includes('refresher') || type.includes('post-audit')) key = 'level1';
    if (window.startTrainingTest && key) {
      return `<button onclick="show('training');loadTraining().then(()=>startTrainingTest('${key}',${Number(record.id)||0}))">Take Test</button>`;
    }
    return `<button onclick="show('training');loadTraining()">Open Training</button>`;
  }

  function renderEngineerDashboard(data){
    const e = data.engineer || {};
    const latest = e.latest_audit || {};
    const avg = num(e.average_score);
    const status = statusLabel(avg, e.status || latest.result);
    const openTraining = e.open_training || [];
    const openReaudits = e.open_reaudits || [];
    const tests = e.tests || [];
    const audits = e.audits || [];
    const className = statusClass(avg, status);
    const primaryAction = openTraining.length ? actionButtonForTraining(openTraining[0]) : `<button onclick="show('auditHistory');loadAuditHistory()">Review Audits</button>`;

    setHtml('dashboard', `
      <div class="v11-home">
        <div class="v11-hero">
          <div>
            <h2>Welcome, ${esc(user.name)}</h2>
            <p>Commercial Gas Compliance Platform · Engineer Home</p>
          </div>
          <div class="v11-hero-badge">
            <b>Current Competency</b><br>
            <span style="font-size:34px;font-weight:800">${avg ? pct(avg) : 'No score'}</span><br>
            <span>${esc(status)}</span>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card ${className}"><h3>Competency Status</h3><div class="big">${avg ? pct(avg) : '-'}</div><p>${esc(status)}</p></div>
          <div class="dash-card dash-blue"><h3>Latest Audit</h3><div class="big">${esc(latest.score || '-')}%</div><p>${esc(latest.ref || 'No audit found')} ${latest.site ? '· '+esc(latest.site) : ''}</p></div>
          <div class="dash-card ${openTraining.length?'dash-amber':'dash-green'}"><h3>Open Training</h3><div class="big">${openTraining.length}</div><p>${openTraining.length?'Action required':'No open training'}</p></div>
          <div class="dash-card ${openReaudits.length?'dash-amber':'dash-green'}"><h3>Re-audits Due</h3><div class="big">${openReaudits.length}</div><p>${openReaudits.length?'Review required':'None open'}</p></div>
        </div>

        <div class="dash-section">
          <h3>Outstanding Actions</h3>
          ${openTraining.length ? `<div class="dash-list">${openTraining.map(function(t){return `<div class="dash-item"><div><strong>${esc(t.training_type)}</strong><small>Audit: ${esc(t.audit_ref || '')} · Assigned: ${esc(t.assigned_date || '')} · Status: ${esc(t.status || 'Open')}</small></div><div class="dash-actions">${actionButtonForTraining(t)}</div></div>`;}).join('')}</div>` : `<div class="dash-empty">No outstanding test or training actions.</div>`}
        </div>

        <div class="dash-grid">
          <div class="dash-card action"><h3>Review Latest Audit</h3><p>Open your most recent audit and review findings, notes and corrective actions.</p><button onclick="show('auditHistory');loadAuditHistory()">Review Audit History</button></div>
          <div class="dash-card action"><h3>Start Tightness Test</h3><p>Open the native HBS Tightness Test Centre for IGEM-based calculations and saved records.</p><button onclick="show('tightness');loadTightness()">Start Test</button></div>
          <div class="dash-card action"><h3>Knowledge Centre</h3><p>Search manufacturer manuals, technical bulletins and HBS guidance.</p><button onclick="show('knowledge');loadKnowledge()">Open Library</button></div>
        </div>

        <div class="dash-section">
          <h3>Recent Tests</h3>
          ${tests.length ? `<div class="dash-table-wrap"><table><thead><tr><th>Date</th><th>Test</th><th>Score</th><th>Result</th><th>Status</th></tr></thead><tbody>${tests.slice(0,6).map(function(t){return `<tr><td>${esc(t.created_at || '')}</td><td>${esc(t.test_type)}</td><td>${esc(t.score)}%</td><td>${esc(t.result)}</td><td>${esc(t.status)}</td></tr>`;}).join('')}</tbody></table></div>` : `<div class="dash-empty">No test results recorded yet.</div>`}
        </div>

        <div class="dash-section">
          <h3>Recent Audit History</h3>
          ${audits.length ? `<div class="dash-table-wrap"><table><thead><tr><th>Ref</th><th>Date</th><th>Site</th><th>Manufacturer</th><th>Score</th><th>Result</th><th>Action</th></tr></thead><tbody>${audits.slice(0,8).map(function(a){return `<tr><td>${esc(a.ref)}</td><td>${esc(a.date)}</td><td>${esc(a.site)}</td><td>${esc(a.manufacturer)}</td><td>${esc(a.score)}%</td><td>${esc(a.result)}</td><td><button onclick="show('auditHistory');loadAuditHistory().then(()=>viewAuditDetail(${Number(a.id)||0}))">Review</button></td></tr>`;}).join('')}</tbody></table></div>` : `<div class="dash-empty">No audits found.</div>`}
        </div>
      </div>
    `);
  }

  function renderManagerDashboard(data){
    const s = data.summary || {};
    const attention = data.engineers_attention || [];
    const audits = data.audits || [];
    const training = data.open_training || [];
    const reaudits = data.open_reaudits || [];
    setHtml('dashboard', `
      <div class="v11-home">
        <div class="v11-hero">
          <div>
            <h2>Manager Compliance Dashboard</h2>
            <p>Company-wide commercial gas compliance status, training actions and re-audits.</p>
          </div>
          <div class="v11-hero-badge"><b>Company Compliance</b><br><span style="font-size:34px;font-weight:800">${pct(s.average_score)}</span><br><span>${esc(s.total_audits || 0)} audits recorded</span></div>
        </div>

        <div class="dash-grid">
          <div class="dash-card dash-blue"><h3>Total Audits</h3><div class="big">${esc(s.total_audits || 0)}</div><p>All recorded audits</p></div>
          <div class="dash-card ${num(s.average_score)>=85?'dash-green':'dash-amber'}"><h3>Average Score</h3><div class="big">${pct(s.average_score)}</div><p>Rolling company average</p></div>
          <div class="dash-card ${num(s.fail)?'dash-red':'dash-green'}"><h3>Failed Audits</h3><div class="big">${esc(s.fail || 0)}</div><p>Requires management attention</p></div>
          <div class="dash-card ${num(s.open_training)?'dash-amber':'dash-green'}"><h3>Open Training</h3><div class="big">${esc(s.open_training || 0)}</div><p>Assigned tests/training</p></div>
          <div class="dash-card ${num(s.open_reaudits)?'dash-amber':'dash-green'}"><h3>Open Re-audits</h3><div class="big">${esc(s.open_reaudits || 0)}</div><p>Follow-up audit actions</p></div>
          <div class="dash-card ${attention.length?'dash-amber':'dash-green'}"><h3>Engineers Below Target</h3><div class="big">${attention.length}</div><p>Below 85% or open actions</p></div>
        </div>

        <div class="dash-section">
          <h3>Engineers Requiring Attention</h3>
          ${attention.length ? `<div class="dash-table-wrap"><table><thead><tr><th>Engineer</th><th>Audits</th><th>Average</th><th>Fails</th><th>Open Training</th><th>Open Re-audits</th><th>Status</th></tr></thead><tbody>${attention.map(function(e){return `<tr><td>${esc(e.engineer)}</td><td>${esc(e.audits)}</td><td>${esc(e.avg_score)}%</td><td>${esc(e.fails)}</td><td>${esc(e.open_training)}</td><td>${esc(e.open_reaudits)}</td><td><span class="dash-pill ${e.avg_score<75?'red':'amber'}">${esc(e.status)}</span></td></tr>`;}).join('')}</tbody></table></div>` : `<div class="dash-empty">No engineers currently below target.</div>`}
        </div>

        <div class="dash-section">
          <h3>Open Training Actions</h3>
          ${training.length ? `<div class="dash-list">${training.slice(0,8).map(function(t){return `<div class="dash-item"><div><strong>${esc(t.engineer_name)}</strong><small>${esc(t.training_type)} · ${esc(t.audit_ref || '')} · ${esc(t.status || 'Open')}</small></div><div class="dash-actions"><button onclick="show('training');loadTraining()">Open Training</button></div></div>`;}).join('')}</div>` : `<div class="dash-empty">No open training records.</div>`}
        </div>

        <div class="dash-section">
          <h3>Recent Audit Activity</h3>
          ${audits.length ? `<div class="dash-table-wrap"><table><thead><tr><th>Ref</th><th>Date</th><th>Engineer</th><th>Site</th><th>Manufacturer</th><th>Score</th><th>Result</th><th>Action</th></tr></thead><tbody>${audits.slice(0,12).map(function(a){return `<tr><td>${esc(a.ref)}</td><td>${esc(a.date)}</td><td>${esc(a.engineer)}</td><td>${esc(a.site)}</td><td>${esc(a.manufacturer)}</td><td>${esc(a.score)}%</td><td>${esc(a.result)}</td><td><button onclick="openAuditFromDashboard('${esc(a.id || String(a.ref).replace('HBS-',''))}')">Review</button></td></tr>`;}).join('')}</tbody></table></div>` : `<div class="dash-empty">No recent audits found.</div>`}
        </div>
      </div>
    `);
  }

  window.loadDashboard = async function(){
    injectDashboardStyles();
    setHtml('dashboard', '<h2>Dashboard</h2><p class="muted">Loading compliance dashboard...</p>');
    try{
      const url = '/api/dashboard?role=' + encodeURIComponent(user && user.role || 'engineer') + '&engineer=' + encodeURIComponent(user && user.name || '');
      const data = await api(url);
      if (isManager()) renderManagerDashboard(data);
      else renderEngineerDashboard(data);
    }catch(e){
      setHtml('dashboard', '<h2>Dashboard</h2><p class="muted">'+esc(e.message)+'</p>');
    }
  };

  window.openAuditFromDashboard = async function(id){
    show('auditHistory');
    await loadAuditHistory();
    viewAuditDetail(id);
  };
})();
