export async function onRequestGet({ env }) {
  try {
    const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const result = {};
    for (const t of (tables.results || [])) {
      try {
        const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${t.name}`).first();
        const sample = await env.DB.prepare(`SELECT * FROM ${t.name} LIMIT 3`).all();
        result[t.name] = { count: count?.count || 0, sample: sample.results || [] };
      } catch (e) {
        result[t.name] = { error: e.message };
      }
    }
    return Response.json({ ok:true, tables: result });
  } catch (e) {
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
