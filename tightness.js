const HBS_MANUFACTURERS=['ACV','Adveco','Andrews','AO Smith','Atag','Baxi','Buderus','Carrier','De Dietrich','Elco','Ferroli','Hamworthy','Hoval','Ideal','Intergas','Keston','Lochinvar','MHS','Nu-Way','Potterton','Powrmatic','Remeha','Riello','Robur','Stokvis','Strebel','Vaillant','Viessmann','Worcester Bosch','Worcester/Buderus','Wolf','Other'];
async function loadKnowledge(){
  setHtml('knowledgeCentre',`
    <h2>Knowledge Centre</h2>
    <p><button onclick="loadKnowledge()">Refresh</button></p>
    <div class="toolbar">
      <button onclick="setKnowledgeCategory('')">All Documents</button>
      <button onclick="setKnowledgeCategory('IGEM Standards')">IGEM Standards</button>
      <button onclick="setKnowledgeCategory('Manufacturer Manuals')">Manufacturer Manuals</button>
      <button onclick="setKnowledgeCategory('HBS Bulletins')">HBS Bulletins</button>
      <button onclick="setKnowledgeCategory('Gas Safe Guidance')">Gas Safe Guidance</button>
      <button onclick="setKnowledgeCategory('Gas Installer Magazine')">Gas Installer Magazine</button>
    </div>
    <h3>Manufacturers</h3>
    <div class="toolbar">${HBS_MANUFACTURERS.filter(m=>m!=='Other').map(m=>`<button class="secondary" onclick="setKnowledgeSearch('${m.replace(/'/g, "\\'")}')">${m}</button>`).join('')}</div>
    <div class="grid">
      <label>Search<br><input id="kcSearch"></label>
      <label>Category<br><select id="kcFilter"><option value="">All Categories</option><option>IGEM Standards</option><option>Manufacturer Manuals</option><option>HBS Bulletins</option><option>Gas Safe Guidance</option><option>Gas Installer Magazine</option><option>Technical Images</option><option>Training Videos</option><option>Fault Library</option></select></label>
    </div>
    <p><button onclick="loadKnowledgeRows()">Search</button></p>
    <div style="overflow-x:auto"><table><thead><tr><th>Title</th><th>Category</th><th>Reference</th><th>Keywords</th><th>Uploaded</th><th>Action</th></tr></thead><tbody id="kcRows"></tbody></table></div>
    <p id="kcMsg" class="muted"></p>`);
  await loadKnowledgeRows();
}
function setKnowledgeCategory(cat){if($('kcFilter'))$('kcFilter').value=cat;loadKnowledgeRows()}
function setKnowledgeSearch(term){if($('kcSearch'))$('kcSearch').value=term;if($('kcFilter'))$('kcFilter').value='Manufacturer Manuals';loadKnowledgeRows()}
async function loadKnowledgeRows(){try{const q=encodeURIComponent($('kcSearch')?.value||''),cat=encodeURIComponent($('kcFilter')?.value||'');const j=await api(`/api/library?q=${q}&category=${cat}`);const docs=j.documents||[];$('kcMsg').textContent=`${docs.length} document(s) found.`;$('kcRows').innerHTML=docs.map(d=>`<tr><td>${safe(d.title)}</td><td>${safe(d.category)}</td><td>${safe(d.reference)}</td><td>${safe(d.keywords)}</td><td>${safe(d.created_at)}</td><td><button onclick="openDoc(${d.id})">Open</button></td></tr>`).join('')}catch(e){$('kcRows').innerHTML='<tr><td colspan="6">'+e.message+'</td></tr>'}}
async function openDoc(id){const j=await api('/api/library?id='+id+'&open_by='+encodeURIComponent(HBS.user.name));if(j.document?.file_url)window.open(j.document.file_url,'_blank')}
