/*
  DS Tools — één bookmarklet voor alle tools
  ==========================================
  Opent een klein paneel met de tools. Bovenaan wat bij deze pagina hoort,
  daaronder (ingeklapt) de rest. Een klik laadt de tool precies zoals zijn eigen
  loader dat doet: zelfde cache key, zelfde geharde stale-while-revalidate,
  zelfde toastkleur. De losse bookmarklets blijven dus werken en delen hun cache
  met deze launcher.

  Een tool toevoegen = een regel in TOOLS. Geen nieuwe bookmarklet nodig: de
  launcher haalt zichzelf ook via stale-while-revalidate op.

  Sneltoetsen zolang het paneel open is: 1–9 start de zoveelste tool, Esc sluit.
*/
(function () {
  var LAUNCHER_VERSION = '1.0.0';
  var ID = 'ds-tools-launcher';
  var BASE = 'https://raw.githubusercontent.com/BasEijserCB/DS_callscript_app/main/';

  // Nog een klik op de bookmarklet = paneel dicht.
  var oud = document.getElementById(ID);
  if (oud) { oud.remove(); return; }

  var pad = location.pathname, host = location.hostname;
  var opPlanning = /ModulePlanning/i.test(pad);
  var opRitmonitor = /ModuleTourMonitor/i.test(pad);
  var opPortal = /coolbluebezorgt\.dirextion\.nl$/i.test(host);
  var opDirextion = /dirextion\.nl$/i.test(host);
  var opBasicOrders = opDirextion && /^\/Basic\/orders/i.test(pad);
  var opCoolblue = /(^|\.)coolblue\.(nl|be|de)$/i.test(host);
  var opSophia = /sophia\.mendixcloud\.com$/i.test(host);
  function heeft(k) { try { return !!localStorage.getItem(k); } catch (e) { return false; } }

  // bestanden: één of meer scripts, in volgorde geladen. Elk met de cache key en
  // de versieconstante van zijn eigen loader, zodat de caches gedeeld worden.
  var TOOLS = [
    { naam: 'DS Logboek', icoon: '📋', uitleg: 'Gesprek registreren',
      hier: opPortal || (opDirextion && /\/basic/i.test(pad)),
      kleur: '#285dab',
      bestanden: [{ naam: 'DS Logboek', cache: 'ds_app_prod_cache', src: 'ds-logboek.js', versie: /DS Logboek (v\d+\.\d+\.\d+)/ }] },
    { naam: 'DS Plakken', icoon: '🚀', uitleg: 'Import-formulier invullen vanuit het logboek',
      hier: opDirextion && /^\/Import\//i.test(pad),
      kleur: '#e67e22',
      bestanden: [{ naam: 'DS Paste', cache: 'ds_paste_prod_cache', src: 'paste-bookmarklet.js', versie: /PASTE_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },
    { naam: 'Planning-combi', icoon: '⚙️', uitleg: 'Vaste instellingen + echt laadvermogen',
      hier: opPlanning,
      kleur: '#6f42c1',
      bestanden: [
        { naam: 'Planning-instellingen', cache: 'ds_planning_combi_inst_cache', src: 'laadvermogen/planning-instellingen.js', versie: /PLANNING_VERSION\s*=\s*['"]([^'"]+)['"]/ },
        { naam: 'Laadvermogen', cache: 'ds_planning_combi_lv_cache', src: 'laadvermogen/laadvermogen.js', versie: /LAADVERMOGEN_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },
    { naam: 'Schuifritten alias', icoon: '🔁', uitleg: 'Sturend depot achter de alias',
      hier: opPlanning,
      kleur: '#0f766e',
      bestanden: [{ naam: 'Schuifalias', cache: 'ds_schuifalias_prod_cache', src: 'schuifalias/schuifalias.js', versie: /SCHUIFALIAS_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },
    { naam: 'Extra rijtijd', icoon: '🚚', uitleg: 'Wat kost een extra stop aan rijtijd',
      hier: opRitmonitor,
      kleur: '#1a7f37',
      bestanden: [{ naam: 'Extra rijtijd', cache: 'ds_rijtijd_prod_cache', src: 'tourtool/extra-rijtijd.js', versie: /RIJTIJD_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },    { naam: 'Same day text', icoon: '🎉', uitleg: 'Opmerking: wordt vandaag nog opgelost',
      hier: opBasicOrders,
      start: function () { opmerkingTekst('Wordt al opgelost, via nieuw bezoek van bezorger(s) op dezelfde dag'); } },
    { naam: 'Next day text', icoon: '🥲', uitleg: 'Opmerking: vervolgstop ingepland',
      hier: opBasicOrders,
      start: function () { opmerkingTekst('Vervolg stop al ingepland door Delivery Support'); } },
    { naam: 'Service Check', icoon: '⇢', uitleg: 'Welke services Coolblue aanbiedt voor dit product',
      hier: opBasicOrders || opCoolblue,
      kleur: '#333333',
      bestanden: [{ naam: 'Service Check', cache: 'ds_servicecheck_cache', src: 'extern/service-check.js', versie: /SERVICECHECK_VERSION = '([^']+)'/ }] },
    // Sophia Filter Tool (~/Documents/Sophia tool). Hoort bij een ander team, dus alleen
    // zichtbaar op Sophia zelf. Hun loaders draaien ongewijzigd: eigen GAS-bron en cache.
    { naam: 'SFT', icoon: '🤚', uitleg: 'Sophia Filter Tool',
      hier: opSophia, alleenHier: true,
      start: function () { (function(){var U='https://script.google.com/a/macros/coolblue.nl/s/AKfycbwXqmqcF-y0skdfEcAGkcDGJM-t9WIa9sJVi8pWyoUJT8vdaOTWqklkUYKf_ECsDPzWNA/exec';var c=localStorage.getItem('sft_code_cache');if(c){try{eval(c)}catch(e){}}fetch(U).then(function(r){return r.text()}).then(function(t){if(t&&t.indexOf('javascript:')!==-1&&t!==c){localStorage.setItem('sft_code_cache',t);var m=t.match(/Sophia Filter Tool v([0-9.]+)/);if(m){localStorage.setItem('sft_version',m[1])}if(!c){try{eval(t)}catch(e){alert('SFT fout: '+e.message)}}}}).catch(function(e){if(!c){alert('SFT kon niet laden: '+e.message)}})})(); } },
    // Persoonlijke autopilot: alleen in een browser waar hij al eens gedraaid heeft.
    { naam: 'SFT autopilot', icoon: '🤖', uitleg: 'Persoonlijke build',
      hier: opSophia, alleenHier: true, verborgen: !heeft('sft_p_version'),
      start: function () { (function(){var U='https://script.google.com/a/macros/coolblue.nl/s/AKfycbzvJcH6rRJNkWjepNzg6Ohuua0zNU95s31cBBY5XdlT5wxJkGaiOZGnMY0YSM1vBAjdmw/exec';var c=localStorage.getItem('sft_p_code_cache');if(c){try{eval(c)}catch(e){}}fetch(U).then(function(r){return r.text()}).then(function(t){if(t&&t.indexOf('javascript:')!==-1&&t!==c){localStorage.setItem('sft_p_code_cache',t);var m=t.match(/Sophia Filter Tool v([0-9.]+)/);if(m){localStorage.setItem('sft_p_version',m[1])}if(!c){try{eval(t)}catch(e){alert('SFT fout: '+e.message)}}}}).catch(function(e){if(!c){alert('SFT kon niet laden: '+e.message)}})})(); } },
  ];

  // Same day / Next day text — de bladwijzers van vóór DS Tools, letterlijk; alleen de
  // tekst is een parameter geworden. Klikt op +, vult Remark en drukt op Opslaan.
  function opmerkingTekst(TXT) {function C(n){try{return ASPx.GetControlCollection().Get(n);}catch(e){return null;}}function memo(){var t=document.getElementById('Remark_I');return(t&&t.offsetParent!==null)?t:null;}function vis(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;}function waitFor(fn,ms,cb){var t0=Date.now();(function l(){var r=fn();if(r)return cb(r);if(Date.now()-t0>ms)return cb(0);setTimeout(l,100);})();}function ensureBox(cb){if(memo())return cb(1);var p=[].slice.call(document.querySelectorAll('svg[data-icon="plus"]')).filter(vis)[0];if(!p){alert('Geen + gevonden op de pagina.');return cb(0);}(p.closest('a,button,[onclick],[role=button],td,div[id]')||p).click();waitFor(memo,6000,function(ok){if(!ok)alert('Remark-veld verscheen niet op tijd.');cb(ok);});}function fire(ev,s,a){try{if(ev&&ev.FireEvent){ev.FireEvent(s,a||{});}}catch(e){}}function fill(t){var ta=memo();if(!ta)return 0;var c=C('Remark');ta.focus();ta.select();var ty=false;try{ty=document.execCommand('insertText',false,t);}catch(e){}if(!ty||ta.value!==t){var s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;s.call(ta,t);ta.dispatchEvent(new InputEvent('input',{bubbles:true,data:t,inputType:'insertText'}));}ta.dispatchEvent(new KeyboardEvent('keyup',{key:'a',keyCode:65,which:65,bubbles:true}));if(c){try{if(c.SetText)c.SetText(t);}catch(e){}fire(c.KeyUp,c,{htmlEvent:{keyCode:65}});fire(c.TextChanged,c,{});fire(c.ValueChanged,c,{});}try{ASPx.EKeyUp('Remark',{keyCode:65});}catch(e){}try{ASPx.EValueChanged('Remark');}catch(e){}ta.dispatchEvent(new Event('change',{bubbles:true}));return 1;}function btnRoot(){var cd=document.getElementById('btnUpdate_CD');if(cd)return document.getElementById('btnUpdate')||cd.parentElement||cd;var s=[].slice.call(document.querySelectorAll('span.dx-vam')).filter(function(x){return x.textContent.trim().toLowerCase()=='opslaan'&&vis(x);})[0];return s?(s.closest('div[id]')||s):null;}function isDis(r){var i=document.getElementById('btnUpdate_I');if(i&&i.disabled)return true;for(var e=r;e&&e!==document.body;e=e.parentElement){if(e.disabled===true)return true;if(e.getAttribute&&e.getAttribute('aria-disabled')==='true')return true;if(typeof e.className=='string'&&/disabled/i.test(e.className))return true;}return false;}function doClick(r){var b=C('btnUpdate');if(b&&b.DoClick){try{b.DoClick();return;}catch(e){}}var i=document.getElementById('btnUpdate_I');if(i){i.click();return;}r.click();}function save(t){var r=btnRoot();if(!r){alert('Opslaan-knop niet gevonden');return;}waitFor(function(){return isDis(r)?0:1;},2000,function(ok){if(ok)return doClick(r);var c=C('Remark');var sy=c&&c.GetText?(c.GetText()===t):(memo()&&memo().value===t);if(!sy){alert('Tekst niet goed doorgekomen — controleer het veld en sla zelf op.');return;}var b=C('btnUpdate');if(b&&b.SetEnabled){try{b.SetEnabled(true);}catch(e){}}var i=document.getElementById('btnUpdate_I');if(i)i.disabled=false;for(var e=r;e&&e!==document.body;e=e.parentElement){if(typeof e.className=='string'&&/disabled/i.test(e.className))e.className=e.className.replace(/\S*[Dd]isabled\S*/g,'').trim();}doClick(r);});}ensureBox(function(ok){if(ok&&fill(TXT))setTimeout(function(){save(TXT);},300);});}


  // ── Laden: dezelfde geharde stale-while-revalidate als de losse loaders ──────
  function laad(b, kleur, onder) {
    function versie(code) { var m = code && code.match(b.versie); return m ? m[1] : '?'; }
    function bewaar(code) {
      try { localStorage.setItem(b.cache, code); return 1; }
      catch (e) { try { localStorage.removeItem(b.cache); localStorage.setItem(b.cache, code); return 1; } catch (e2) { return 0; } }
    }
    // paste-bookmarklet.js begint met 'javascript:'; de paste-loader knipt dat eraf.
    function kaal(code) { return code.indexOf('javascript:') === 0 ? code.slice(11) : code; }
    var cached = null;
    try { cached = localStorage.getItem(b.cache); } catch (e) {}
    var stuk = 0;
    // Synchroon, binnen de klik: de paste-tool leest het klembord en heeft die gebruikersactie nodig.
    if (cached) { try { eval(cached); } catch (e) { stuk = 1; console.error('[' + b.naam + '] gecachete versie faalt:', e); } }
    fetch(BASE + b.src + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (code) {
        if (!code) return;
        code = kaal(code);
        if (code === cached) { if (stuk) console.error('[' + b.naam + '] ook de nieuwste versie faalt'); return; }
        var ok = bewaar(code);
        if (!cached || stuk) { eval(code); return; }
        var t = document.createElement('div');
        t.innerHTML = '↻ <b>' + b.naam + ' ' + versie(code) + ' gedownload</b><br><span style="font-weight:400;">' +
          (ok ? 'Nu actief: ' + versie(cached) + ' — start de tool opnieuw om de nieuwe versie te laden'
              : 'Opslaan mislukt — draai localStorage.removeItem(\'' + b.cache + '\')') +
          '</span><button style="position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;opacity:0.8;">×</button>';
        t.querySelector('button').onclick = function () { t.remove(); };
        t.style.cssText = 'position:fixed;bottom:' + onder + 'px;right:20px;z-index:1000001;background:' + (ok ? kleur : '#c0392b') +
          ';color:#fff;padding:12px 36px 12px 14px;border-radius:8px;font:13px "Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:300px;line-height:1.5;';
        document.body.appendChild(t);
      })
      .catch(function (e) { console.error('[' + b.naam + '] update ophalen mislukt:', e); });
  }

  function start(tool) {
    sluit();
    if (tool.start) { try { tool.start(); } catch (e) { alert(tool.naam + ' fout: ' + (e && e.message)); } return; }
    tool.bestanden.forEach(function (b, i) { laad(b, tool.kleur, 20 + i * 80); });
  }

  // ── Paneel (shadow DOM: de pagina-CSS van DireXtion kan er niet bij) ─────────
  var zichtbaar = TOOLS.filter(function (t) { return !t.verborgen && (t.hier || !t.alleenHier); });
  var hier = zichtbaar.filter(function (t) { return t.hier; });
  var rest = zichtbaar.filter(function (t) { return !t.hier; });
  var volgorde = hier.concat(rest);
  var openRest = !hier.length;

  var host_ = document.createElement('div');
  host_.id = ID;
  host_.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1000002;';
  var root = host_.attachShadow({ mode: 'open' });

  var CSS =
    ':host{all:initial}' +
    '.p{width:280px;background:#fff;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.25);font:13px "Segoe UI",Arial,sans-serif;color:#333333;overflow:hidden}' +
    '.h{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #DDDDDD}' +
    '.h b{font-size:15px;color:#285dab}' +
    '.x{background:none;border:none;font-size:18px;color:#999999;cursor:pointer;line-height:1;padding:0 2px}' +
    '.x:hover{color:#333333}' +
    '.k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#999999;padding:10px 12px 4px}' +
    '.l{padding:0 8px 8px}' +
    '.t{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:#fff;border:1px solid #DDDDDD;border-radius:8px;padding:8px 10px;margin-top:6px;cursor:pointer;font:inherit;color:inherit}' +
    '.t:hover,.t:focus{border-color:#0090e3;background:#F2F7FC;outline:none}' +
    '.i{font-size:18px;width:22px;text-align:center}' +
    '.n{font-weight:600}' +
    '.u{font-size:11px;color:#999999}' +
    '.s{margin-left:auto;font-size:11px;color:#999999;border:1px solid #DDDDDD;border-radius:4px;padding:0 5px}' +
    '.m{display:block;width:100%;background:none;border:none;border-top:1px solid #DDDDDD;padding:8px 12px;text-align:left;color:#0090e3;cursor:pointer;font:inherit;font-size:12px}' +
    '.m:hover{background:#F2F7FC}' +
    '.v{background:#F3F3F3;color:#999999;font-size:10px;padding:4px 12px;text-align:right}';

  function knop(tool) {
    var nr = volgorde.indexOf(tool) + 1;
    return '<button class="t" data-i="' + (nr - 1) + '"><span class="i">' + tool.icoon + '</span>' +
      '<span><div class="n">' + tool.naam + '</div><div class="u">' + tool.uitleg + '</div></span>' +
      (nr <= 9 ? '<span class="s">' + nr + '</span>' : '') + '</button>';
  }

  function teken() {
    var h = '<div class="p"><div class="h"><b>DS Tools</b><button class="x" data-a="sluit" title="Sluiten (Esc)">×</button></div>';
    if (hier.length) h += '<div class="k">Op deze pagina</div><div class="l">' + hier.map(knop).join('') + '</div>';
    if (rest.length) {
      if (hier.length) h += '<button class="m" data-a="rest">' + (openRest ? '▾' : '▸') + ' Andere tools (' + rest.length + ')</button>';
      if (openRest) h += (hier.length ? '' : '<div class="k">Geen tool voor deze pagina — alle tools</div>') +
        '<div class="l">' + rest.map(knop).join('') + '</div>';
    }
    h += '<div class="v">v' + LAUNCHER_VERSION + '</div></div>';
    root.innerHTML = '<style>' + CSS + '</style>' + h;
    var eerste = root.querySelector('.t');
    if (eerste) eerste.focus();
  }

  root.addEventListener('click', function (e) {
    var el = e.target.closest('button');
    if (!el) return;
    if (el.dataset.a === 'sluit') return sluit();
    if (el.dataset.a === 'rest') { openRest = !openRest; return teken(); }
    if (el.dataset.i != null) start(volgorde[+el.dataset.i]);
  });

  function toets(e) {
    if (e.key === 'Escape') { sluit(); return; }
    // Typen in een veld van de pagina mag geen tool starten.
    var doel = e.target;
    if (doel !== host_ && doel && (doel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(doel.tagName))) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= volgorde.length && n <= 9) {
      // Een tool uit de ingeklapte groep alleen als die zichtbaar is.
      if (n > hier.length && !openRest && hier.length) return;
      e.preventDefault();
      start(volgorde[n - 1]);
    }
  }

  function sluit() {
    document.removeEventListener('keydown', toets, true);
    host_.remove();
  }

  document.addEventListener('keydown', toets, true);
  document.body.appendChild(host_);
  teken();
})();
