/*
  DS Tools — één bookmarklet voor alle tools
  ==========================================
  Schuift een balk bovenin de pagina, als een tweede bladwijzerbalk, met de tools
  die bij deze pagina horen; de rest zit achter "Andere tools ▾". Een klik laadt de
  tool precies zoals zijn eigen loader dat doet: zelfde cache key, zelfde geharde
  stale-while-revalidate, zelfde toastkleur.

  Productie of test. Elke tool heeft een status. De team-bookmarklet toont alleen
  productie; de dev-bookmarklet (loader zet DS_TOOLS_MODUS = 'dev') toont alles,
  test-tools met een label. De status in TOOLS is de standaard; launcher/status.json
  overschrijft hem en wordt beheerd via launcher/beheer.html (GitHub Pages).

  Een tool toevoegen = een regel in TOOLS (met een vaste id). Geen nieuwe bookmarklet
  nodig: de launcher haalt zichzelf ook via stale-while-revalidate op.

  De balk is een iframe, geen gewone div: op AppStream zouden klikken en toetsen in
  een div doorlekken naar Vanessa (zelfde reden als de Vanessa-panelen).

  Sneltoetsen zolang de balk open is: 1–9 start de zoveelste tool in de balk, Esc
  sluit. Niet op AppStream: daar typ je in Vanessa. Na het starten van een tool gaat
  de balk dicht; nog een klik op de bookmarklet ook.
*/
(function () {
  var LAUNCHER_VERSION = '1.2.2';
  var ID = 'ds-tools-launcher';
  var BASE = 'https://raw.githubusercontent.com/BasEijserCB/DS_callscript_app/main/';
  var BEHEER_URL = 'https://baseijsercb.github.io/DS_callscript_app/launcher/beheer.html';
  var STATUS_CACHE = 'ds_tools_status';
  // DS_TOOLS_MODUS komt uit de loader (direct eval ziet zijn variabelen): 'dev' of 'lijst'.
  var MODUS = typeof DS_TOOLS_MODUS !== 'undefined' ? DS_TOOLS_MODUS : '';
  var DEV = MODUS === 'dev';

  var pad = location.pathname, host = location.hostname;
  var opPlanning = /ModulePlanning/i.test(pad);
  var opRitmonitor = /ModuleTourMonitor/i.test(pad);
  var opPortal = /coolbluebezorgt\.dirextion\.nl$/i.test(host);
  var opDirextion = /dirextion\.nl$/i.test(host);
  var opBasicOrders = opDirextion && /^\/Basic\/orders/i.test(pad);
  var opCoolblue = /(^|\.)coolblue\.(nl|be|de)$/i.test(host);
  var opSophia = /sophia\.mendixcloud\.com$/i.test(host);
  var opAppStream = /\.appstream2\.[a-z0-9-]+\.aws\.amazon\.com$/i.test(host);

  // id: vast, want status.json verwijst ernaar. status: de standaard als status.json
  // de tool niet noemt of niet te laden is.
  // bestanden: één of meer scripts, in volgorde geladen. Elk met de cache key en de
  // versieconstante van zijn eigen loader, zodat de caches gedeeld worden.
  // start: in plaats van bestanden, een functie die de tool zelf start.
  // alleenHier: nergens anders tonen, ook niet onder "Andere tools".
  // waar: voor mensen, op de installatiepagina (index.html).
  var TOOLS = [
    { id: 'ds-logboek', waar: 'DireXtion Basic en de consumer portal', status: 'productie', naam: 'DS Logboek', icoon: '📋', uitleg: 'Gesprek registreren',
      hier: opPortal || (opDirextion && /\/basic/i.test(pad)),
      kleur: '#285dab',
      bestanden: [{ naam: 'DS Logboek', cache: 'ds_app_prod_cache', src: 'ds-logboek.js', versie: /DS Logboek (v\d+\.\d+\.\d+)/ }] },
    { id: 'ds-plakken', waar: 'Import-formulier (Import → ShipmentFiles)', status: 'productie', naam: 'DS Plakken', icoon: '🚀', uitleg: 'Import-formulier invullen vanuit het logboek',
      hier: opDirextion && /^\/Import\//i.test(pad),
      kleur: '#e67e22',
      bestanden: [{ naam: 'DS Paste', cache: 'ds_paste_prod_cache', src: 'paste-bookmarklet.js', versie: /PASTE_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },
    { id: 'planning-combi', waar: 'Planningsmodule', status: 'productie', naam: 'Planning-combi', icoon: '⚙️', uitleg: 'Vaste instellingen + echt laadvermogen',
      hier: opPlanning,
      kleur: '#6f42c1',
      bestanden: [
        { naam: 'Planning-instellingen', cache: 'ds_planning_combi_inst_cache', src: 'laadvermogen/planning-instellingen.js', versie: /PLANNING_VERSION\s*=\s*['"]([^'"]+)['"]/ },
        { naam: 'Laadvermogen', cache: 'ds_planning_combi_lv_cache', src: 'laadvermogen/laadvermogen.js', versie: /LAADVERMOGEN_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },
    { id: 'schuifalias', waar: 'Planningsmodule', status: 'productie', naam: 'Schuifritten alias', icoon: '🔁', uitleg: 'Sturend depot achter de alias',
      hier: opPlanning,
      kleur: '#0f766e',
      bestanden: [{ naam: 'Schuifalias', cache: 'ds_schuifalias_prod_cache', src: 'schuifalias/schuifalias.js', versie: /SCHUIFALIAS_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },
    { id: 'extra-rijtijd', waar: 'Ritmonitor', status: 'productie', naam: 'Extra rijtijd', icoon: '🚚', uitleg: 'Wat kost een extra stop aan rijtijd',
      hier: opRitmonitor,
      kleur: '#1a7f37',
      bestanden: [{ naam: 'Extra rijtijd', cache: 'ds_rijtijd_prod_cache', src: 'tourtool/extra-rijtijd.js', versie: /RIJTIJD_VERSION\s*=\s*['"]([^'"]+)['"]/ }] },
    { id: 'same-day-text', waar: 'Order in Basic', status: 'productie', naam: 'Same day text', icoon: '🎉', uitleg: 'Opmerking: wordt vandaag nog opgelost',
      hier: opBasicOrders,
      start: function () { opmerkingTekst('Wordt al opgelost, via nieuw bezoek van bezorger(s) op dezelfde dag'); } },
    { id: 'next-day-text', waar: 'Order in Basic', status: 'productie', naam: 'Next day text', icoon: '🥲', uitleg: 'Opmerking: vervolgstop ingepland',
      hier: opBasicOrders,
      start: function () { opmerkingTekst('Vervolg stop al ingepland door Delivery Support'); } },
    { id: 'service-check', waar: 'Order in Basic, en Coolblue-productpagina’s', status: 'productie', naam: 'Service Check', icoon: '⇢', uitleg: 'Welke services Coolblue aanbiedt voor dit product',
      hier: opBasicOrders || opCoolblue,
      kleur: '#333333',
      bestanden: [{ naam: 'Service Check', cache: 'ds_servicecheck_cache', src: 'extern/service-check.js', versie: /SERVICECHECK_VERSION = '([^']+)'/ }] },
    // Sophia Filter Tool (~/Documents/Sophia tool). Hoort bij een ander team, dus alleen
    // zichtbaar op Sophia zelf. Hun loaders draaien ongewijzigd: eigen GAS-bron en cache.
    { id: 'sft', waar: 'Sophia', status: 'productie', naam: 'SFT', icoon: '🤚', uitleg: 'Sophia Filter Tool',
      hier: opSophia, alleenHier: true,
      start: function () { (function(){var U='https://script.google.com/a/macros/coolblue.nl/s/AKfycbwXqmqcF-y0skdfEcAGkcDGJM-t9WIa9sJVi8pWyoUJT8vdaOTWqklkUYKf_ECsDPzWNA/exec';var c=localStorage.getItem('sft_code_cache');if(c){try{eval(c)}catch(e){}}fetch(U).then(function(r){return r.text()}).then(function(t){if(t&&t.indexOf('javascript:')!==-1&&t!==c){localStorage.setItem('sft_code_cache',t);var m=t.match(/Sophia Filter Tool v([0-9.]+)/);if(m){localStorage.setItem('sft_version',m[1])}if(!c){try{eval(t)}catch(e){alert('SFT fout: '+e.message)}}}}).catch(function(e){if(!c){alert('SFT kon niet laden: '+e.message)}})})(); } },
    { id: 'sft-autopilot', waar: 'Sophia', status: 'test', naam: 'SFT autopilot', icoon: '🤖', uitleg: 'Persoonlijke build',
      hier: opSophia, alleenHier: true,
      start: function () { (function(){var U='https://script.google.com/a/macros/coolblue.nl/s/AKfycbzvJcH6rRJNkWjepNzg6Ohuua0zNU95s31cBBY5XdlT5wxJkGaiOZGnMY0YSM1vBAjdmw/exec';var c=localStorage.getItem('sft_p_code_cache');if(c){try{eval(c)}catch(e){}}fetch(U).then(function(r){return r.text()}).then(function(t){if(t&&t.indexOf('javascript:')!==-1&&t!==c){localStorage.setItem('sft_p_code_cache',t);var m=t.match(/Sophia Filter Tool v([0-9.]+)/);if(m){localStorage.setItem('sft_p_version',m[1])}if(!c){try{eval(t)}catch(e){alert('SFT fout: '+e.message)}}}}).catch(function(e){if(!c){alert('SFT kon niet laden: '+e.message)}})})(); } },
    // Vanessa (~/Documents/Vanessa en Vanessa-Refurbished): bedient Vanessa via AppStream.
    // Ze sturen hun toetsen naar het element dat focus heeft bij het starten; sluit()
    // zet die focus daarom eerst terug op de stream.
    { id: 'vanessa-orders', waar: 'Vanessa (AppStream)', status: 'test', naam: 'Vanessa orders', icoon: '🧾', uitleg: 'Factuurorders witgoedreparaties',
      hier: opAppStream, alleenHier: true,
      kleur: '#333333',
      bestanden: [{ naam: 'Vanessa orders', cache: 'ds_vanessa_orders_cache', src: 'extern/vanessa-order.js', versie: /VERSIE\s*=\s*'([^']+)'/ }] },
    { id: 'vanessa-refurbished', waar: 'Vanessa (AppStream)', status: 'test', naam: 'Vanessa Refurbished', icoon: '♻️', uitleg: 'Factuurorder per levering',
      hier: opAppStream, alleenHier: true,
      kleur: '#333333',
      bestanden: [{ naam: 'Vanessa Refurbished', cache: 'ds_vanessa_refurbished_cache', src: 'extern/vanessa-refurbished.js', versie: /VERSIE\s*=\s*'([^']+)'/ }] },
    { id: 'vanessa-deck', waar: 'Vanessa (AppStream)', status: 'test', naam: 'Vanessa Deck', icoon: '🎛️', uitleg: 'Knoppen met toetsreeksen',
      hier: opAppStream, alleenHier: true,
      kleur: '#333333',
      bestanden: [{ naam: 'Vanessa Deck', cache: 'ds_vanessa_deck_cache', src: 'extern/vanessa-deck.js', versie: /VERSIE\s*=\s*'([^']+)'/ }] },
  ];

  // Beheerpagina: alleen de lijst, geen balk.
  if (MODUS === 'lijst') {
    window.__dsToolsLijst = TOOLS.map(function (t) { return { id: t.id, naam: t.naam, icoon: t.icoon, uitleg: t.uitleg, waar: t.waar, status: t.status }; });
    return;
  }

  // Nog een klik op de bookmarklet = balk dicht.
  var oud = document.getElementById(ID);
  if (oud) { oud.remove(); return; }

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

  // ── Status: standaard uit TOOLS, overschreven door launcher/status.json ──────
  // De balk wacht op de verse status (max. STATUS_WACHT ms) voordat hij verschijnt.
  // Eerst tekenen en daarna bijwerken liet een uitgezette tool even zien — en klikbaar —
  // vooral bij een eerste keer op een origin, waar alleen de standaard uit TOOLS bekend is.
  // Komt GitHub niet op tijd, dan de laatst bekende status (cache), anders de standaard;
  // een late status tekent de balk alsnog opnieuw.
  var STATUS_WACHT = 1500;
  var statusTekst = null;
  try { statusTekst = localStorage.getItem(STATUS_CACHE); } catch (e) {}
  var override = leesStatus(statusTekst);
  function leesStatus(t) { try { var j = JSON.parse(t); return (j && j.tools) || {}; } catch (e) { return {}; } }
  function statusVan(t) { var s = override[t.id]; return s === 'productie' || s === 'test' ? s : t.status; }
  fetch(BASE + 'launcher/status.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (t) {
      if (t && t !== statusTekst && Object.keys(leesStatus(t)).length) {
        try { localStorage.setItem(STATUS_CACHE, t); } catch (e) {}
        override = leesStatus(t);
        if (getoond && frame.isConnected) { menuOpen = false; verdeel(); teken(); return; }
      }
      toon();
    })
    .catch(function (e) { console.error('[DS Tools] status ophalen mislukt:', e); toon(); });

  function start(tool) {
    sluit();
    if (tool.start) { try { tool.start(); } catch (e) { alert(tool.naam + ' fout: ' + (e && e.message)); } return; }
    tool.bestanden.forEach(function (b, i) { laad(b, tool.kleur, 20 + i * 80); });
  }

  // ── Balk bovenin de pagina, als een tweede bladwijzerbalk ────────────────────
  var zichtbaar, inBalk, inMenu, menuOpen = false;
  function verdeel() {
    zichtbaar = TOOLS.filter(function (t) { return (DEV || statusVan(t) === 'productie') && (t.hier || !t.alleenHier); });
    var hier = zichtbaar.filter(function (t) { return t.hier; });
    // Herkent de launcher de pagina niet, dan staat alles in de balk.
    inBalk = hier.length ? hier : zichtbaar;
    inMenu = hier.length ? zichtbaar.filter(function (t) { return !t.hier; }) : [];
  }
  verdeel();

  // Wie had de focus toen de bookmarklet geklikt werd? Op AppStream is dat de stream,
  // en daar moeten de toetsen van Vanessa straks heen.
  var focusBijOpenen = document.activeElement;

  var CSS =
    'html,body{margin:0;padding:0;background:transparent;overflow:hidden;height:100%}' +
    '.b{position:relative;display:flex;align-items:center;gap:2px;height:34px;padding:0 6px;background:#fff;border-bottom:1px solid #DDDDDD;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.12);font:13px "Segoe UI",Arial,sans-serif;color:#333333}' +
    '.r{display:flex;align-items:center;gap:2px;min-width:0;overflow-x:auto;scrollbar-width:none}' +
    '.c{display:flex;align-items:center;gap:6px;flex:none;height:28px;padding:0 10px;border:none;border-radius:14px;' +
      'background:none;font:inherit;color:inherit;cursor:pointer;white-space:nowrap}' +
    '.c:hover,.c:focus-visible{background:#F2F7FC;outline:none}' +
    '.c.o{background:#F2F7FC;color:#285dab}' +
    '.m1{color:#285dab;font-weight:600;padding-right:8px;cursor:default}' +
    '.m1:hover{background:none}' +
    '.tag{font-size:10px;font-weight:600;color:#856404;background:#fff8e1;border:1px solid #ffc107;border-radius:4px;padding:0 4px;line-height:14px}' +
    '.sep{flex:none;width:1px;height:18px;background:#DDDDDD;margin:0 4px}' +
    '.g{flex:1}' +
    '.v{flex:none;font-size:10px;color:#999999;margin:0 4px}' +
    '.x{flex:none;width:26px;height:26px;border:none;border-radius:13px;background:none;font-size:17px;line-height:1;color:#999999;cursor:pointer}' +
    '.x:hover{background:#F3F3F3;color:#333333}' +
    '.d{position:absolute;top:36px;width:280px;background:#fff;border:1px solid #DDDDDD;border-radius:8px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px;font:13px "Segoe UI",Arial,sans-serif;color:#333333}' +
    '.t{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border:none;border-radius:6px;background:none;' +
      'font:inherit;color:inherit;text-align:left;cursor:pointer}' +
    '.t:hover,.t:focus-visible{background:#F2F7FC;outline:none}' +
    '.t .i{font-size:16px;width:20px;text-align:center}' +
    '.u{font-size:11px;color:#999999}';

  var frame = document.createElement('iframe');
  frame.id = ID;
  frame.setAttribute('title', 'DS Tools');
  frame.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:35px;border:0;margin:0;padding:0;' +
    'z-index:2147483000;background:transparent;color-scheme:light;visibility:hidden;';
  document.body.appendChild(frame);
  var fdoc = frame.contentDocument;
  fdoc.open();
  fdoc.write('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body></body></html>');
  fdoc.close();

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function testTag(tool) { return statusVan(tool) === 'test' ? '<span class="tag">test</span>' : ''; }

  function chip(tool, nr) {
    var tip = tool.uitleg + (nr <= 9 && !opAppStream ? ' — toets ' + nr : '');
    return '<button class="c" data-t="' + zichtbaar.indexOf(tool) + '" title="' + esc(tip) + '">' +
      '<span>' + tool.icoon + '</span><span>' + esc(tool.naam) + '</span>' + testTag(tool) + '</button>';
  }

  function regel(tool) {
    return '<button class="t" data-t="' + zichtbaar.indexOf(tool) + '"><span class="i">' + tool.icoon + '</span>' +
      '<span><div>' + esc(tool.naam) + ' ' + testTag(tool) + '</div><div class="u">' + esc(tool.uitleg) + '</div></span></button>';
  }

  function teken() {
    var h = '<div class="b"><div class="r">' +
      '<span class="c m1">🧰 DS Tools' + (DEV ? ' <span class="tag">dev</span>' : '') + '</span><span class="sep"></span>' +
      inBalk.map(function (t, i) { return chip(t, i + 1); }).join('');
    if (inMenu.length) h += '<span class="sep"></span><button class="c' + (menuOpen ? ' o' : '') + '" data-a="menu">Andere tools ▾</button>';
    h += '</div><span class="g"></span>' +
      (DEV ? '<button class="c" data-a="beheer" title="Per tool: productie of test">⚙ Beheer</button>' : '') +
      '<span class="v">v' + LAUNCHER_VERSION + '</span>' +
      '<button class="x" data-a="sluit" title="Sluiten (Esc)">×</button></div>';
    if (menuOpen) h += '<div class="d">' + inMenu.map(regel).join('') + '</div>';
    fdoc.body.innerHTML = h;
    // Open menu: het iframe beslaat even het hele venster (doorzichtig), zodat een
    // klik ernaast het menu kan sluiten zonder dat die klik in de pagina belandt.
    frame.style.height = menuOpen ? '100%' : '35px';
    if (menuOpen) {
      var k = fdoc.querySelector('[data-a="menu"]').getBoundingClientRect();
      fdoc.querySelector('.d').style.left = Math.max(4, Math.min(k.left, frame.clientWidth - 288)) + 'px';
    }
  }

  fdoc.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('button');
    if (!el) {
      if (menuOpen && !e.target.closest('.b,.d')) { menuOpen = false; teken(); }
      return;
    }
    if (el.dataset.a === 'sluit') return sluit();
    if (el.dataset.a === 'menu') { menuOpen = !menuOpen; return teken(); }
    if (el.dataset.a === 'beheer') { window.open(BEHEER_URL, '_blank'); return sluit(); }
    if (el.dataset.t != null) start(zichtbaar[+el.dataset.t]);
  });

  function toets(e) {
    if (e.key === 'Escape') { if (menuOpen) { menuOpen = false; teken(); } else sluit(); return; }
    // Typen in een veld van de pagina mag geen tool starten.
    var doel = e.target;
    if (doel && (doel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(doel.tagName))) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && n <= inBalk.length) {
      e.preventDefault();
      start(inBalk[n - 1]);
    }
  }
  // In de balk zelf altijd; in de pagina niet op AppStream (daar typ je in Vanessa).
  // Die laatste pas in toon(): vóór die tijd staat er nog geen balk om uit te kiezen.
  fdoc.addEventListener('keydown', toets, true);

  function sluit() {
    document.removeEventListener('keydown', toets, true);
    frame.remove();
    // Focus terug naar de pagina: de paste-tool leest het klembord en dat mag alleen
    // als het document focus heeft; Vanessa stuurt toetsen naar het element met focus.
    try { window.focus(); } catch (e) {}
    if (focusBijOpenen && focusBijOpenen !== document.body && focusBijOpenen.focus) {
      try { focusBijOpenen.focus(); } catch (e) {}
    }
  }

  // Het iframe staat er al (onzichtbaar), zodat een tweede klik op de bookmarklet hem
  // ook tijdens het wachten weghaalt. toon() maakt hem zichtbaar: na de status, of na
  // STATUS_WACHT als GitHub niet op tijd antwoordt.
  var getoond = false;
  function toon() {
    if (getoond || !frame.isConnected) return;
    getoond = true;
    verdeel();
    teken();
    frame.style.visibility = 'visible';
    if (!opAppStream) document.addEventListener('keydown', toets, true);
    // Eén keer inschuiven; teken() bouwt de inhoud opnieuw op, dus de animatie hoort op het iframe.
    try { frame.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 120, easing: 'ease-out' }); } catch (e) {}
  }
  setTimeout(toon, STATUS_WACHT);
})();
