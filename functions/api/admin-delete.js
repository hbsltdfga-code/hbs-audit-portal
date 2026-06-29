const tableMap = {
  audit: { table:'audits', id:'id' },
  training: { table:'training_records', id:'id' },
  reaudit: { table:'reaudits', id:'id' },
  toolbox: { table:'toolbox_results', id:'id' },
  tightness: { table:'tightness_records', id:'id' },
  library: { table:'technical_library', id:'id' }
};
export async function onRequestPost({ request, env }) {
  try{
    const b=await request.json();
    if(b.role && b.role!=='manager') return Response.json({ok:false,error:'Manager access only'},{status:403});
    const type=b.type, id=Number(b.id);
    if(!tableMap[type]) throw new Error('Unknown record type');
    if(!id) throw new Error('Missing record id');
    const {table}=tableMap[type];

    if(type==='audit'){
      try{ await env.DB.prepare('DELETE FROM audit_photos WHERE audit_id=?').bind(id).run(); }catch(e){}
    }
    if(type==='library'){
      try{
        const doc=await env.DB.prepare('SELECT file_key FROM technical_library WHERE id=?').bind(id).first();
        if(doc?.file_key && env.LIBRARY_BUCKET) await env.LIBRARY_BUCKET.delete(doc.file_key);
      }catch(e){}
    }
    const res=await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
    return Response.json({ok:true,deleted:res.meta?.changes||0,message:`Deleted ${type} record ${id}`});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
