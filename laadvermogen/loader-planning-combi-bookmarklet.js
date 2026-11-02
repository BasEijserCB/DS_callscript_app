javascript:(function(){
  // Eén klik in de planningsmodule: eerst de vaste instellingen
  // (planning-instellingen.js), daarna de laadvermogen-correctie
  // (laadvermogen.js). Per bestand dezelfde geharde stale-while-revalidate
  // als de andere loaders, met eigen cache keys: de losse Laadvermogen-
  // bookmarklet heeft zo nergens last van.
  if(!/ModulePlanningBeta/i.test(location.href)){alert('Activeer deze bookmarklet op de Planning Beta pagina.');return;}
  var BASE='https://raw.githubusercontent.com/BasEijserCB/DS_callscript_app/main/laadvermogen/';
  function laad(naam,CACHE,SRC,VERSIE,ONDER){
    function getVersion(code){var m=code&&code.match(new RegExp(VERSIE+'\\s*=\\s*[\'"]([^\'"]+)[\'"]'));return m?m[1]:'?';}
    function bewaar(code){try{localStorage.setItem(CACHE,code);return 1;}catch(e){try{localStorage.removeItem(CACHE);localStorage.setItem(CACHE,code);return 1;}catch(e2){return 0;}}}
    var cached=localStorage.getItem(CACHE);
    var stuk=0;
    if(cached){try{eval(cached);}catch(e){stuk=1;console.error('['+naam+'] gecachete versie faalt:',e);}}
    fetch(BASE+SRC+'?t='+Date.now(),{cache:'no-store'})
      .then(function(r){return r.ok?r.text():null;})
      .then(function(code){
        if(!code)return;
        if(code===cached){if(stuk)console.error('['+naam+'] ook de nieuwste versie faalt');return;}
        var ok=bewaar(code);
        if(!cached||stuk){eval(code);return;}
        var t=document.createElement('div');
        t.innerHTML='↻ <b>'+naam+' '+getVersion(code)+' gedownload</b><br><span style="font-weight:400;">'+(ok?'Nu actief: '+getVersion(cached)+' — druk opnieuw om de nieuwe versie te laden':'Opslaan mislukt — draai localStorage.removeItem(\''+CACHE+'\')')+'</span><button onclick="this.parentNode.remove()" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;opacity:0.8;">×</button>';
        t.style.cssText='position:fixed;bottom:'+ONDER+'px;right:20px;z-index:1000001;background:'+(ok?'#6f42c1':'#c0392b')+';color:#fff;padding:12px 36px 12px 14px;border-radius:8px;font:13px "Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:300px;line-height:1.5;';
        document.body.appendChild(t);
      })
      .catch(function(e){console.error('['+naam+'] update ophalen mislukt:',e);});
  }
  laad('Planning-instellingen','ds_planning_combi_inst_cache','planning-instellingen.js','PLANNING_VERSION',20);
  laad('Laadvermogen','ds_planning_combi_lv_cache','laadvermogen.js','LAADVERMOGEN_VERSION',100);
})();
