async function columnExists(env, table, column) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (info.results || []).some(c => c.name === column);
}

async function ensureTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tightness_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    role TEXT,
    site_name TEXT,
    client TEXT,
    audit_ref TEXT,
    test_date TEXT,
    area_tested TEXT,
    test_type TEXT,
    installation_volume REAL,
    test_pressure REAL,
    stabilisation_time REAL,
    test_duration REAL,
    measured_drop REAL,
    permitted_leak_rate REAL,
    calculated_leak_rate REAL,
    outcome TEXT,
    notes TEXT,
    details_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  if (!(await columnExists(env,'tightness_records','details_json'))) {
    await env.DB.prepare(`ALTER TABLE tightness_records ADD COLUMN details_json TEXT`).run();
  }
}

export async function onRequestGet({ request, env }) {
  try {
    await ensureTable(env);

    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'engineer';
    const engineer = url.searchParams.get('engineer') || '';

    let rows;

    if (role === 'manager') {
      rows = await env.DB.prepare(`
        SELECT * FROM tightness_records
        ORDER BY id DESC
        LIMIT 500
      `).all();
    } else {
      // Privacy rule: engineers and senior engineers can only view their own tightness test records.
      rows = await env.DB.prepare(`
        SELECT * FROM tightness_records
        WHERE lower(engineer_name)=lower(?)
        ORDER BY id DESC
        LIMIT 200
      `).bind(engineer).all();
    }

    return Response.json({ ok:true, records: rows.results || [] });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureTable(env);
    const b = await request.json();

    const ins = await env.DB.prepare(`INSERT INTO tightness_records (
      engineer_name, role, site_name, client, audit_ref, test_date, area_tested, test_type,
      installation_volume, test_pressure, stabilisation_time, test_duration, measured_drop,
      permitted_leak_rate, calculated_leak_rate, outcome, notes, details_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        b.engineer_name || '',
        b.role || '',
        b.site_name || '',
        b.client || '',
        b.audit_ref || '',
        b.test_date || new Date().toISOString().slice(0,10),
        b.area_tested || '',
        b.test_type || '',
        Number(b.installation_volume || 0),
        Number(b.test_pressure || 0),
        Number(b.stabilisation_time || 0),
        Number(b.test_duration || 0),
        Number(b.measured_drop || 0),
        Number(b.permitted_leak_rate || 0),
        Number(b.calculated_leak_rate || 0),
        b.outcome || '',
        b.notes || '',
        b.details_json || ''
      ).run();

    return Response.json({ ok:true, id: ins.meta?.last_row_id });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
