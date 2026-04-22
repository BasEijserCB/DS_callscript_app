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
      var w=document.getElementById('ds-combi-wrapper');
      var r=w?w.getBoundingClientRect():null;
      var t=document.createElement('div');
      t.innerHTML='↻ <b>Nieuwe versie gedownload</b><br><span style="font-weight:400;">Sluit en heropen de widget om te laden</span><button onclick="this.parentNode.remove()" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;opacity:0.8;">×</button>';
      t.style.cssText='position:fixed;z-index:9999999;background:#285dab;color:#fff;padding:10px 36px 10px 14px;font:13px "Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);line-height:1.5;'+(r?'top:'+r.top+'px;left:'+r.left+'px;width:'+r.width+'px;box-sizing:border-box;border-radius:8px 8px 0 0;':'bottom:20px;right:20px;max-width:300px;border-radius:8px;');
      document.body.appendChild(t);
    })
    .catch(function(){});
})();
