javascript:(function(){
  var CACHE='ds_paste_prod_cache';
  var SRC='https://raw.githubusercontent.com/BasEijserCB/DS_callscript_app/main/paste-bookmarklet.js';
  function getVersion(code){var m=code&&code.match(/PASTE_VERSION\s*=\s*['"]([^'"]+)['"]/);return m?m[1]:'?';}
  function bewaar(code){try{localStorage.setItem(CACHE,code);return 1;}catch(e){try{localStorage.removeItem(CACHE);localStorage.setItem(CACHE,code);return 1;}catch(e2){return 0;}}}
  var cached=localStorage.getItem(CACHE);
  var stuk=0;
  // De eval van de cache MOET in een try: gooit een kapotte versie een fout,
  // dan stopte het hele script hier en werd er nooit meer een update gehaald.
  if(cached){try{eval(cached);}catch(e){stuk=1;console.error('[DS Paste] gecachete versie faalt:',e);}}
  fetch(SRC+'?t='+Date.now(),{cache:'no-store'})
    .then(function(r){return r.ok?r.text():null;})
    .then(function(code){
      if(!code)return;
      var normalized=code.indexOf('javascript:')===0?code.slice('javascript:'.length):code;
      if(normalized===cached){if(stuk)console.error('[DS Paste] ook de nieuwste versie faalt');return;}
      var ok=bewaar(normalized);
      if(!cached||stuk){eval(normalized);return;}
      var t=document.createElement('div');
      t.innerHTML='↻ <b>DS Paste '+getVersion(normalized)+' gedownload</b><br><span style="font-weight:400;">'+(ok?'Nu actief: '+getVersion(cached)+' — druk opnieuw om nieuwe versie te laden':'Opslaan mislukt — draai localStorage.removeItem(\''+CACHE+'\')')+'</span><button onclick="this.parentNode.remove()" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;opacity:0.8;">×</button>';
      t.style.cssText='position:fixed;bottom:20px;right:20px;z-index:1000001;background:'+(ok?'#e67e22':'#c0392b')+';color:#fff;padding:12px 36px 12px 14px;border-radius:8px;font:13px "Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:300px;line-height:1.5;';
      document.body.appendChild(t);
    })
    .catch(function(e){console.error('[DS Paste] update ophalen mislukt:',e);});
})();
