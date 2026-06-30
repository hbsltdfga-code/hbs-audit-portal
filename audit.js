document.addEventListener('DOMContentLoaded', function(){
  var lb = $('loginBtn');
  var tb = $('testLoginBtn');
  var pin = $('loginPin');
  if(lb) lb.onclick = login;
  if(tb) tb.onclick = testLoginApi;
  if(pin) pin.addEventListener('keydown', function(e){ if(e.key === 'Enter') login(); });

  // If the user is already in the page from a previous login, rebuild nav safely.
  if(HBS && HBS.user){
    try { buildNav(); } catch(e) { console.error(e); }
  }
});
