// Optional helper for v6 portal.
// If included in index.html after the main app scripts, it adds a Knowledge Centre button to the existing navigation.
(function(){
  function addKnowledgeButton(){
    const bars = document.querySelectorAll('.toolbar, .nav, .card');
    let target = null;
    for (const b of bars) {
      if (b.textContent && b.textContent.includes('My Dashboard') && b.textContent.includes('Logout')) {
        target = b; break;
      }
    }
    if (!target || document.getElementById('hbsKnowledgeBtn')) return;
    const btn=document.createElement('button');
    btn.id='hbsKnowledgeBtn';
    btn.textContent='Knowledge Centre';
    btn.onclick=function(){ window.open('/knowledge/','_blank'); };
    target.insertBefore(btn, target.querySelector('button:last-child'));
  }
  setTimeout(addKnowledgeButton, 800);
})();
