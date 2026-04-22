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
      localStorage.setItem('ds_update_pending','1');
    })
    .catch(function(){});
})();
