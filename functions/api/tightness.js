async function ensure(env){
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
}

export async function onRequestGet({request,env}){
  try{
    await ensure(env);
    const u=new URL(request.url);
    const role=u.searchParams.get('role')||'engineer';
    const eng=u.searchParams.get('engineer')||'';
    let rows;
    if(['manager','director','admin'].includes(String(role).toLowerCase())){
      rows=await env.DB.prepare('SELECT * FROM tightness_records ORDER BY id DESC LIMIT 500').all();
    }else{
      rows=await env.DB.prepare(`SELECT * FROM tightness_records
        WHERE lower(trim(COALESCE(engineer_name,'')))=lower(trim(?))
           OR trim(COALESCE(engineer_name,''))=''
        ORDER BY id DESC LIMIT 200`).bind(eng).all();
    }
    return Response.json({ok:true,records:rows.results||[]});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500});}
}

export async function onRequestPost({request,env}){
  try{
    await ensure(env);
    const b=await request.json();
    const engineerName=String(b.engineer_name||b.current_user_name||'').trim();
    if(!b.site_name) return Response.json({ok:false,error:'Site name is required.'},{status:400});
    if(!Number(b.installation_volume||0)) return Response.json({ok:false,error:'Installation volume is required.'},{status:400});
    const recent = await env.DB.prepare(`SELECT id FROM tightness_records
      WHERE lower(trim(engineer_name))=lower(trim(?))
        AND lower(trim(site_name))=lower(trim(?))
        AND COALESCE(test_date,'')=COALESCE(?, '')
        AND ABS(COALESCE(installation_volume,0)-?) < 0.000001
        AND ABS(COALESCE(measured_drop,0)-?) < 0.000001
        AND datetime(created_at) >= datetime('now','-2 minutes')
      ORDER BY id DESC LIMIT 1`).bind(
        engineerName, b.site_name||'', b.test_date||new Date().toISOString().slice(0,10),
        Number(b.installation_volume||0), Number(b.measured_drop||0)
      ).first().catch(()=>null);
    if(recent && recent.id) return Response.json({ok:true,id:recent.id,duplicate:true});
    const ins=await env.DB.prepare(`INSERT INTO tightness_records (engineer_name,role,site_name,client,audit_ref,test_date,area_tested,test_type,installation_volume,test_pressure,stabilisation_time,test_duration,measured_drop,permitted_leak_rate,calculated_leak_rate,outcome,notes,details_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      engineerName,
      b.role||'',
      b.site_name||'',
      b.client||'',
      b.audit_ref||'',
      b.test_date||new Date().toISOString().slice(0,10),
      b.area_tested||'',
      b.test_type||'',
      Number(b.installation_volume||0),
      Number(b.test_pressure||0),
      Number(b.stabilisation_time||0),
      Number(b.test_duration||0),
      Number(b.measured_drop||0),
      Number(b.permitted_leak_rate||0),
      Number(b.calculated_leak_rate||0),
      b.outcome||'',
      b.notes||'',
      b.details_json||''
    ).run();
    return Response.json({ok:true,id:ins.meta?.last_row_id});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500});}
}
