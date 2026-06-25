export async function onRequestGet({ env }) {
  try {
    const tables = ['users','audits','audit_photos','training_records','reaudits','toolbox_results'];
    const backup = { exported_at: new Date().toISOString(), tables: {} };
    for (const t of tables) {
      try {
        const rows = await env.DB.prepare(`SELECT * FROM ${t}`).all();
        backup.tables[t] = rows.results || [];
      } catch (e) {
        backup.tables[t] = { error: e.message };
      }
    }
    return Response.json({ ok:true, backup });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
