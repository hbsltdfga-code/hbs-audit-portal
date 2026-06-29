function toCsv(rows){
  if(!rows.length) return '';
  const headers=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  return headers.join(',')+'\n'+rows.map(r=>headers.map(h=>esc(r[h])).join(',')).join('\n');
}
export async function onRequestGet({ request, env }) {
  try {
    const url=new URL(request.url);
    const type=url.searchParams.get('type')||'audit';
    const engineer=(url.searchParams.get('engineer')||'').toLowerCase();
    const format=url.searchParams.get('format')||'json';
    const q=async(sql)=>{try{return(await env.DB.prepare(sql).all()).results||[]}catch(e){return[]}};
    let data=[];
    if(type==='audit') data=await q('SELECT * FROM audits ORDER BY id DESC');
    else if(type==='training') data=await q('SELECT * FROM training_records ORDER BY id DESC');
    else if(type==='tightness') data=await q('SELECT * FROM tightness_records ORDER BY id DESC');
    else if(type==='competency'){
      const res=await fetch(new URL('/api/competency', url.origin)).then(r=>r.json()).catch(()=>({engineers:[]}));
      data=res.engineers||[];
    } else {
      data=await q('SELECT * FROM audits ORDER BY id DESC');
    }
    if(engineer) data=data.filter(r=>String(r.engineer_name||r.engineer||r.name||'').toLowerCase().includes(engineer));
    if(format==='csv') return new Response(toCsv(data),{headers:{'content-type':'text/csv','content-disposition':`attachment; filename="hbs-${type}-report.csv"`}});
    return Response.json({ok:true,type,count:data.length,data});
  } catch(e) {
    return Response.json({ok:false,error:e.message},{status:500});
  }
}
