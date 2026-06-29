document.addEventListener('DOMContentLoaded',()=>{$('loginBtn').onclick=login;$('testLoginBtn').onclick=testLoginApi;$('loginPin').addEventListener('keydown',e=>{if(e.key==='Enter')login()})});
