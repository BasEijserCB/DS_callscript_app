javascript:(function(){
  var CACHE='ds_paste_prod_cache';
  var SRC='https://raw.githubusercontent.com/BasEijserCB/DS_callscript_app/main/paste-bookmarklet.js';
  function getVersion(code){var m=code&&code.match(/PASTE_VERSION\s*=\s*['"]([^'"]+)['"]/);return m?m[1]:'?';}
  var cached=localStorage.getItem(CACHE);
  if(cached)eval(cached);
  fetch(SRC+'?t='+Date.now(),{cache:'no-store'})
    .then(function(r){return r.ok?r.text():null;})
    .then(function(code){
      if(!code)return;
      var normalized=code.startsWith('javascript:')?code.slice('javascript:'.length):code;
      if(normalized===cached)return;
      localStorage.setItem(CACHE,normalized);
      if(!cached){eval(normalized);return;}
      var freshVer=getVersion(normalized);
      var cachedVer=getVersion(cached);
      var t=document.createElement('div');
      t.innerHTML='↻ <b>DS Paste '+freshVer+' gedownload</b><br><span style="font-weight:400;">Nu actief: '+cachedVer+' — druk opnieuw om nieuwe versie te laden</span><button onclick="this.parentNode.remove()" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;opacity:0.8;">×</button>';
      t.style.cssText='position:fixed;bottom:20px;right:20px;z-index:1000001;background:#e67e22;color:#fff;padding:12px 36px 12px 14px;border-radius:8px;font:13px "Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:300px;line-height:1.5;';
      document.body.appendChild(t);
    })
    .catch(function(){});
})();
