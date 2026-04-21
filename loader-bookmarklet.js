javascript:(function(){
  var CACHE='ds_app_prod_cache';
  var SRC='https://raw.githubusercontent.com/BasEijserCB/DS_callscript_app/main/ds-logboek.js';
  var cached=localStorage.getItem(CACHE);
  if(cached)eval(cached);
  fetch(SRC+'?t='+Date.now(),{cache:'no-store'})
    .then(function(r){return r.ok?r.text():null;})
    .then(function(code){
      if(!code||code===cached)return;
      localStorage.setItem(CACHE,code);
      if(!cached){eval(code);return;}
      var t=document.createElement('div');
      t.textContent='DS Logboek: nieuwe versie gedownload — sluit en heropen om te laden';
      t.style.cssText='position:fixed;bottom:16px;right:16px;z-index:99999;background:#1A1A2E;color:#fff;padding:10px 14px;border-radius:6px;font:13px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.4);max-width:320px;';
      document.body.appendChild(t);
      setTimeout(function(){t.remove();},6000);
    })
    .catch(function(){});
})();
