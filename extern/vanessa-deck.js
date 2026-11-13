// Vanessa Deck — kopie van ~/Documents/Vanessa-Refurbished/vanessa-deck.js, geladen door de DS Tools-launcher.
// NIET hier bewerken: daar wijzigen (VERSIE ophogen) en opnieuw hierheen kopiëren.
/*
 * Vanessa Deck — knoppen met toetsreeksen, zoals een Stream Deck, maar vanuit
 * de browser naar AppStream.
 *
 * Waarom: de Stream Deck kan op de Mac geen Insert sturen (Cmd+Help komt niet
 * als Insert in Vanessa aan, 03-11-2026), en uitzoeken gaat makkelijker als je
 * elke toets apart kunt sturen. Deze bookmarklet stuurt toetsen zoals in
 * AppStream bewezen is (synthetische KeyboardEvents naar div#dcv-input,
 * combinaties met modifiers langzaam), en exporteert de knoppen als
 * sjablonen voor de testbank van vanessa-refurbished.js.
 *
 * Bouwstenen gekopieerd uit vanessa-refurbished.js (die ze uit ../Vanessa
 * heeft), met eigen namen (window.__vd, vd-paneel, vanessa_deck_*), zodat hij
 * naast de andere bookmarklets kan draaien.
 *
 * v0.1.0: knoppen met acties (toets met modifiers en herhaling, tekst met
 * {plaatshouders}, wacht, lees), "Stuur nu" per toets/tekst, ▶ per actie en
 * per knop, export/import als sjablonen, testwaarden alleen in het geheugen.
 */
(function () {
  'use strict';

  var W = window;
  var VERSIE = '0.1.0';
  var PANEEL_ID = 'vd-paneel';
  var KEY_KNOPPEN = 'vanessa_deck_knoppen';   // knoppen en acties (geen klantdata: tekst met 5+ cijfers wordt geweigerd)
  var KEY_HOOGTE = 'vanessa_deck_hoogte';
  var KEY_DICHT = 'vanessa_deck_dicht';
  var HOOGTES = [360, 600];
  var GEEN_STREAM = [PANEEL_ID, 'vr-paneel', 'vo-paneel'];

  var GAT_MS = 80;          // tussen twee losse toetsen, × tempo
  var TYP_BLOK = 40;        // tekens die in één keer verstuurd worden
  var TYP_PAUZE_MS = 5;
  var TEMPO = 1.5;

  /* ---------- toetsen (uit vanessa-refurbished.js) ---------- */

  var MODS = {
    ctrl: ['Control', 'ControlLeft'],
    meta: ['Meta', 'MetaLeft'],
    alt: ['Alt', 'AltLeft'],
    shift: ['Shift', 'ShiftLeft']
  };
  var TEKEN = {
    ' ': ['Space', 0], ',': ['Comma', 0], '.': ['Period', 0], '-': ['Minus', 0],
    '/': ['Slash', 0], ';': ['Semicolon', 0], ':': ['Semicolon', 1], '@': ['Digit2', 1],
    '!': ['Digit1', 1], '?': ['Slash', 1], '(': ['Digit9', 1], ')': ['Digit0', 1],
    '&': ['Digit7', 1], '+': ['Equal', 1], '=': ['Equal', 0]
  };

  function tekenNaarToets(c) {
    if (c === '\n') return ['Enter', 'Enter', []];
    if (/[a-z]/.test(c)) return [c, 'Key' + c.toUpperCase(), []];
    if (/[A-Z]/.test(c)) return [c, 'Key' + c, ['shift']];
    if (/[0-9]/.test(c)) return [c, 'Digit' + c, []];
    var t = TEKEN[c];
    return t ? [c, t[0], t[1] ? ['shift'] : []] : null;
  }
  function nietTypbaar(s) {
    var uit = [];
    for (var i = 0; i < s.length; i++) if (!tekenNaarToets(s[i]) && uit.indexOf(s[i]) < 0) uit.push(s[i]);
    return uit;
  }

  /* Toetsen in de keuzelijst: naam zoals in de sjabloontaal → [key, code]. */
  var TOETSEN = [
    ['Tab', 'Tab', 'Tab'], ['Enter', 'Enter', 'Enter'], ['Esc', 'Escape', 'Escape'], ['Space', ' ', 'Space'],
    ['Backspace', 'Backspace', 'Backspace'], ['Delete', 'Delete', 'Delete'], ['Insert', 'Insert', 'Insert'],
    ['Home', 'Home', 'Home'], ['End', 'End', 'End'], ['PageUp', 'PageUp', 'PageUp'], ['PageDown', 'PageDown', 'PageDown'],
    ['Up', 'ArrowUp', 'ArrowUp'], ['Down', 'ArrowDown', 'ArrowDown'], ['Left', 'ArrowLeft', 'ArrowLeft'], ['Right', 'ArrowRight', 'ArrowRight']
  ];
  for (var fi = 1; fi <= 12; fi++) TOETSEN.push(['F' + fi, 'F' + fi, 'F' + fi]);
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (c) { TOETSEN.push([c, c.toLowerCase(), 'Key' + c]); });
  '0123456789'.split('').forEach(function (c) { TOETSEN.push([c, c, 'Digit' + c]); });
  Object.keys(TEKEN).filter(function (c) { return c !== ' '; }).forEach(function (c) { TOETSEN.push([c, c, TEKEN[c][0], TEKEN[c][1]]); });
  var TOETS_PER_NAAM = {};
  TOETSEN.forEach(function (t) { TOETS_PER_NAAM[t[0].toLowerCase()] = t; });
  var ALIAS = { escape: 'esc', spatie: 'space', del: 'delete', arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
  var MODNAMEN = { ctrl: 'ctrl', control: 'ctrl', cmd: 'meta', command: 'meta', meta: 'meta', alt: 'alt', option: 'alt', shift: 'shift' };
  var MODLABEL = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Cmd' };
  var MODVOLGORDE = ['ctrl', 'alt', 'shift', 'meta'];

  function isStreamKandidaat(a) {
    return !!(a && a.nodeType === 1 && a !== document.body && a !== document.documentElement &&
      GEEN_STREAM.indexOf(a.id) < 0 && a.isConnected);
  }
  function doelElement() {
    var a = document.activeElement;
    if (isStreamKandidaat(a) && W.__vd) W.__vd.doel = a;
    var d = isStreamKandidaat(a) ? a : W.__vd && W.__vd.doel;
    return isStreamKandidaat(d) ? d : null;
  }
  function beschrijf(el) {
    if (!el) return 'niets';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
  }

  function stuur(doel, type, key, code, m) {
    doel.dispatchEvent(new KeyboardEvent(type, {
      key: key, code: code,
      ctrlKey: !!m.ctrl, metaKey: !!m.meta, altKey: !!m.alt, shiftKey: !!m.shift,
      bubbles: true, cancelable: true
    }));
  }
  function druk(doel, key, code, mods) {
    var m = {};
    mods.forEach(function (x) { m[x] = true; stuur(doel, 'keydown', MODS[x][0], MODS[x][1], m); });
    stuur(doel, 'keydown', key, code, m);
    stuur(doel, 'keypress', key, code, m);
    stuur(doel, 'keyup', key, code, m);
    mods.slice().reverse().forEach(function (x) { delete m[x]; stuur(doel, 'keyup', MODS[x][0], MODS[x][1], m); });
  }
  /* Zoals een mens: modifiers neer, 150 ms, toets, modifiers op (nodig voor Cmd+C op een dialoog, 02-11-2026). */
  function drukLangzaam(doel, key, code, mods) {
    var m = {};
    mods.forEach(function (x) { m[x] = true; stuur(doel, 'keydown', MODS[x][0], MODS[x][1], m); });
    return slaap(150).then(function () {
      stuur(doel, 'keydown', key, code, m);
      stuur(doel, 'keypress', key, code, m);
      return slaap(60);
    }).then(function () {
      stuur(doel, 'keyup', key, code, m);
      return slaap(100);
    }).then(function () {
      mods.slice().reverse().forEach(function (x) { delete m[x]; stuur(doel, 'keyup', MODS[x][0], MODS[x][1], m); });
    });
  }
  function laatModsLos(doel) {
    Object.keys(MODS).forEach(function (x) { stuur(doel, 'keyup', MODS[x][0], MODS[x][1], {}); });
  }

  /* ---------- acties en sjablonen ---------- */
  /*
   * Actie: { soort: 'toets', toets: 'Insert', mods: ['ctrl','shift'], n: 1 }
   *      | { soort: 'tekst', s: 'ABC {klant}' } | { soort: 'wacht', ms: 500 } | { soort: 'lees' }
   * Sjabloon (zelfde taal als de testbank): Ctrl+Shift+Insert  Tab*3  "tekst"  {klant}  wacht:500  lees
   */
  function toetsNaam(a) {
    var mods = MODVOLGORDE.filter(function (m) { return a.mods.indexOf(m) >= 0; }).map(function (m) { return MODLABEL[m] + '+'; }).join('');
    return mods + a.toets + (a.n > 1 ? '*' + a.n : '');
  }
  function actieNaarWoord(a) {
    if (a.soort === 'toets') return toetsNaam(a);
    if (a.soort === 'wacht') return 'wacht:' + a.ms;
    if (a.soort === 'lees') return 'lees';
    return /^\{\w+\}$/.test(a.s) ? a.s : '"' + a.s + '"';
  }
  function naarSjabloon(acties) { return acties.map(actieNaarWoord).join(' '); }
  function beschrijfActie(a) {
    if (a.soort === 'toets') return 'Toets ' + toetsNaam(a);
    if (a.soort === 'wacht') return 'Wacht ' + a.ms + ' ms';
    if (a.soort === 'lees') return 'Lees (Cmd+C, klembord tonen)';
    return 'Tekst "' + a.s + '"';
  }

  /* "Ctrl+Shift+Insert*2" → actie, of null. */
  function woordNaarToets(woord) {
    var n = 1, h = woord.match(/^(.+?)\*(\d{1,2})$/);
    if (h) { woord = h[1]; n = parseInt(h[2], 10); }
    var delen = woord.split('+'), naam = delen.pop(), mods = [];
    if (naam === '' && delen.length) { delen.pop(); naam = '+'; }
    for (var i = 0; i < delen.length; i++) {
      var m = MODNAMEN[delen[i].toLowerCase()];
      if (!m || mods.indexOf(m) >= 0) return null;
      mods.push(m);
    }
    var l = naam.toLowerCase();
    var t = TOETS_PER_NAAM[ALIAS[l] || l];
    return t ? { soort: 'toets', toets: t[0], mods: mods, n: n } : null;
  }

  /* Sjabloon → { acties, fout }. "reeks:" kan hier niet (klikreeksen horen bij de Refurbished-tool). */
  function sjabloonNaarActies(tekst) {
    var acties = [], re = /"([^"]*)"|(\S+)/g, m;
    while ((m = re.exec(String(tekst || '')))) {
      if (m[1] !== undefined) { acties.push({ soort: 'tekst', s: m[1] }); continue; }
      var w = m[2];
      if (/^\{\w+\}$/.test(w)) acties.push({ soort: 'tekst', s: w });
      else if (/^wacht:\d{1,5}$/i.test(w)) acties.push({ soort: 'wacht', ms: parseInt(w.slice(6), 10) });
      else if (/^lees$/i.test(w)) acties.push({ soort: 'lees' });
      else {
        var t = woordNaarToets(w);
        if (!t) return { fout: 'onbekend woord "' + w + '"' + (/^reeks:/i.test(w) ? ' (klikreeksen kan de Deck niet)' : '') };
        acties.push(t);
      }
    }
    return { acties: acties };
  }

  /* Geen klantgegevens in localStorage: tekst met 5+ cijfers achter elkaar (buiten {plaatshouders}). */
  function heeftLosGetal(s) { return /\d{5,}/.test(String(s).replace(/\{\w+\}/g, '')); }

  /* Testwaarden "klant=12345678" per regel → { klant: '12345678' }. Alleen in het geheugen. */
  function leesTestwaarden(tekst) {
    var uit = {};
    String(tekst || '').split(/\n/).forEach(function (r) {
      var m = r.match(/^\s*\{?(\w+)\}?\s*[=:]\s*(.*?)\s*$/);
      if (m && m[2] !== '') uit[m[1]] = m[2];
    });
    return uit;
  }

  /* Acties → plan voor voerUit, met plaatshouders ingevuld. Geeft { plan, fout }. */
  function maakPlan(acties, waarden) {
    var plan = [];
    for (var i = 0; i < acties.length; i++) {
      var a = acties[i];
      if (a.soort === 'toets') {
        var t = TOETS_PER_NAAM[a.toets.toLowerCase()];
        if (!t) return { fout: 'onbekende toets ' + a.toets };
        var mods = a.mods.slice();
        if (t[3] && mods.indexOf('shift') < 0) mods.push('shift');
        for (var k = 0; k < (a.n || 1); k++) plan.push({ soort: 'toets', key: t[1], code: t[2], mods: mods, langzaam: a.mods.length > 0 });
      } else if (a.soort === 'tekst') {
        var fout = '';
        var s = a.s.replace(/\{(\w+)\}/g, function (_, n) {
          if (!(n in waarden)) { fout = fout || '{' + n + '} heeft geen testwaarde (vul rechts in: ' + n + '=…)'; return ''; }
          return waarden[n];
        });
        if (fout) return { fout: fout };
        var nt = nietTypbaar(s);
        if (nt.length) return { fout: 'deze tekens kunnen niet getypt worden: ' + nt.join(' ') };
        plan.push({ soort: 'tekst', s: s });
      } else if (a.soort === 'wacht') plan.push({ soort: 'wacht', ms: a.ms });
      else plan.push({ soort: 'lees' });
    }
    return { plan: plan };
  }

  /* ---------- gedeelde staat, wachten, uitvoeren ---------- */

  var vd = W.__vd || (W.__vd = { bezig: false, stop: false });
  var focusBijStart = document.activeElement;
  if (isStreamKandidaat(focusBijStart)) vd.doel = focusBijStart;

  var worker = null, wachtend = {}, volgnr = 0;
  try {
    var src = 'onmessage=function(e){setTimeout(function(){postMessage(e.data.id)},e.data.ms)}';
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = function (e) { var f = wachtend[e.data]; delete wachtend[e.data]; if (f) f(); };
  } catch (e) { worker = null; }
  function slaap(ms) {
    return new Promise(function (klaar) {
      if (!worker) return setTimeout(klaar, ms);
      var id = ++volgnr;
      wachtend[id] = klaar;
      worker.postMessage({ id: id, ms: ms });
    });
  }

  /* Zelf klikken of typen in AppStream terwijl een knop loopt: stoppen. Elke eigen klik/toets wijst ook het stream-element aan. */
  function stoorder(e) { if (vd.bezig && e.isTrusted) { vd.stop = true; vd.reden = 'je klikte of typte zelf in AppStream'; } }
  function leerDoel(e) { if (isStreamKandidaat(e.target)) vd.doel = e.target; }
  if (vd.luisteraars) vd.luisteraars.forEach(function (l) { W.removeEventListener(l[0], l[1], true); });
  vd.luisteraars = [['keydown', stoorder], ['pointerdown', stoorder], ['mousedown', stoorder],
    ['focusin', leerDoel], ['pointerdown', leerDoel], ['mousedown', leerDoel], ['keydown', leerDoel]];
  vd.luisteraars.forEach(function (l) { W.addEventListener(l[0], l[1], true); });

  function lees(k, std) { try { var v = localStorage.getItem(k); return v === null ? std : v; } catch (e) { return std; } }
  function bewaar(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* niet erg */ } }
  function leesKnoppen() {
    try { var k = JSON.parse(lees(KEY_KNOPPEN, '[]')); return Array.isArray(k) ? k : []; } catch (e) { return []; }
  }
  function bewaarKnoppen(k) { bewaar(KEY_KNOPPEN, JSON.stringify(k)); }

  function isDialoog(t) { return /\[Content\]|\[Window Title\]/.test(String(t)); }
  function dialoogTekst(t) {
    var m = String(t).match(/\[Content\]\s*([\s\S]*?)\s*(\[[^\]]+\]|$)/);
    return (m ? m[1] : String(t)).replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  /* ---------- paneel ---------- */

  var CSS = [
    'html,body{margin:0;background:#fff}',
    'body{font:13px -apple-system,Segoe UI,sans-serif;color:#333333;height:100vh;display:flex;flex-direction:column;overflow:hidden}',
    '.header{display:flex;align-items:center;gap:8px;background:#333333;color:#fff;padding:7px 10px 7px 14px;flex:0 0 auto}',
    '.titel{font-size:15px;font-weight:700;white-space:nowrap}',
    '.kop-versie{font-size:11px;opacity:.75;margin-left:-3px}',
    '#kopstatus{flex:1;font-size:11px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.toggle-btn{flex-shrink:0;background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:4px;width:24px;height:24px;font:inherit;font-size:14px;cursor:pointer;padding:0}',
    '.kop-stop{flex-shrink:0;background:#E50000;border:0;color:#fff;border-radius:4px;height:24px;padding:0 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
    'body.dicht .content{display:none}',
    '.content{flex:1;min-height:0;padding:0 14px}',
    '.kolommen{display:grid;grid-template-columns:minmax(220px,1fr) minmax(360px,1.7fr) minmax(260px,1.1fr);gap:16px;height:100%}',
    '.kol{overflow:auto;min-height:0;padding:8px 2px 10px}',
    '.kol + .kol{border-left:1px solid #DDDDDD;padding-left:16px}',
    '.section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999999;margin:0 0 6px}',
    '.section-label.los{margin-top:14px;border-top:1px solid #DDDDDD;padding-top:10px}',
    'input,select,textarea{box-sizing:border-box;padding:5px 7px;border:1px solid #DDDDDD;border-radius:6px;font:inherit;background:#fff}',
    'textarea{width:100%;height:70px;resize:vertical;font:11px Menlo,monospace}',
    '.rij{display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap}',
    '.rij > .groei{flex:1;min-width:80px}',
    '.knop{padding:5px 9px;border:1px solid #cce9f9;background:#F2F7FC;color:#285dab;border-radius:7px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}',
    '.knop:disabled{opacity:.45;cursor:default}',
    '.knop.groot{background:#0090e3;border-color:#0090e3;color:#fff;font-weight:600}',
    '.knop.rood{border-color:#f3c0c0;background:#fff0f0;color:#E50000}',
    '.tegels{display:flex;flex-wrap:wrap;gap:8px}',
    '.tegel{width:92px;height:72px;border-radius:10px;background:#2b2b2b;color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:6px;box-sizing:border-box;cursor:pointer;border:2px solid transparent}',
    '.tegel.gekozen{border-color:#0090e3}',
    '.tegel .naam{font-size:11px;font-weight:600;line-height:1.2;overflow:hidden;max-height:40px;word-break:break-word}',
    '.tegel .speel{align-self:flex-end;background:#0090e3;border:0;color:#fff;border-radius:5px;font-size:11px;padding:2px 7px;cursor:pointer}',
    '.tegel .speel:disabled{opacity:.45}',
    '.tegel.nieuw{background:#F2F7FC;color:#285dab;border:2px dashed #cce9f9;align-items:center;justify-content:center;font-size:12px}',
    '.acties{list-style:none;margin:0 0 8px;padding:0;counter-reset:a}',
    '.acties li{display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid #F3F3F3;font-size:12px}',
    '.acties li span{flex:1;font-family:Menlo,monospace;font-size:11px}',
    '.acties li .knop{padding:1px 6px}',
    '.leeg{color:#999999;font-size:12px;margin:4px 0 8px}',
    '.vinkjes label{font-size:12px;display:flex;gap:3px;align-items:center}',
    '.vinkjes input{margin:0}',
    'code{font-family:Menlo,monospace;font-size:11px;background:#F3F3F3;border-radius:3px;padding:1px 4px;word-break:break-all}',
    '.gedempt{color:#999999;font-size:11px}',
    '#log{font:11px Menlo,monospace;white-space:pre-wrap;word-break:break-all}',
    '#log div{padding:2px 0;border-bottom:1px solid #F3F3F3}',
    '#log .fout{color:#E50000}',
    '#log .ok{color:#155724}',
    '#log .melding{color:#856404}'
  ].join('');

  var HTML = '<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>' +
    '<div class="header"><span class="titel">Deck</span><span class="kop-versie">v' + VERSIE + '</span><span id="kopstatus">Knoppen met toetsreeksen voor Vanessa</span>' +
    '<button class="kop-stop" id="stop" title="Stop wat er nu loopt">Stop</button>' +
    '<button class="toggle-btn" id="hoogte" title="Lagere of hogere balk">↕</button>' +
    '<button class="toggle-btn" id="vouw" title="In-/uitklappen">–</button>' +
    '<button class="toggle-btn" id="sluit" title="Sluiten">×</button></div>' +
    '<div class="content"><div class="kolommen">' +
    '<div class="kol"><div class="section-label">Knoppen</div><div class="tegels" id="tegels"></div>' +
    '<div class="section-label los">Delen</div>' +
    '<div class="rij"><button class="knop" id="b-export" title="Alle knoppen als sjablonen naar het klembord">Exporteer</button><button class="knop" id="b-import">Importeer</button></div>' +
    '<textarea id="import" style="display:none" placeholder="Plak hier een export (# naam, daaronder het sjabloon) en druk nog eens op Importeer"></textarea>' +
    '<div class="gedempt">Export = per knop <code># naam</code> met daaronder het sjabloon, zoals de testbank van de Refurbished-tool het leest.</div></div>' +
    '<div class="kol" id="bewerk"></div>' +
    '<div class="kol"><div class="section-label">Testwaarden <span style="text-transform:none;letter-spacing:0">(niet bewaard)</span></div>' +
    '<textarea id="testwaarden" placeholder="klant=12345678&#10;reference=ABC-123 (01-10-2026)&#10;product=924953"></textarea>' +
    '<div class="gedempt">Voor tekst met <code>{naam}</code>. Verdwijnt als je de pagina herlaadt.</div>' +
    '<div class="section-label los">Log</div><div id="log"></div></div>' +
    '</div></div></body></html>';

  function maatPaneel(f) {
    var d = f.contentDocument;
    var kop = d.querySelector('.header').offsetHeight;
    f.style.height = (d.body.classList.contains('dicht') ? kop : Math.min(parseInt(lees(KEY_HOOGTE, HOOGTES[0]), 10) || HOOGTES[0], W.innerHeight - 40)) + 'px';
  }

  function openPaneel() {
    var bestaand = document.getElementById(PANEEL_ID);
    if (bestaand && bestaand.getAttribute('data-versie') !== VERSIE) { bestaand.remove(); bestaand = null; }
    if (bestaand) { bestaand.style.display = bestaand.style.display === 'none' ? '' : 'none'; return; }

    var f = document.createElement('iframe');
    f.id = PANEEL_ID;
    f.setAttribute('data-versie', VERSIE);
    f.style.cssText = 'position:fixed;bottom:0;left:8px;width:calc(100% - 16px);height:360px;border:0;border-radius:10px 10px 0 0;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.28);z-index:2147483646;background:#fff;color-scheme:light';
    document.body.appendChild(f);
    var d = f.contentDocument;
    d.open(); d.write(HTML); d.close();
    var $ = function (id) { return d.getElementById(id); };
    function el(tag, cls, tekst) {
      var e = d.createElement(tag);
      if (cls) e.className = cls;
      if (tekst !== undefined) e.textContent = tekst;
      return e;
    }
    if (lees(KEY_DICHT, '0') === '1') d.body.classList.add('dicht');
    maatPaneel(f);

    $('vouw').onclick = function () { bewaar(KEY_DICHT, d.body.classList.toggle('dicht') ? '1' : '0'); maatPaneel(f); };
    $('hoogte').onclick = function () {
      bewaar(KEY_HOOGTE, parseInt(lees(KEY_HOOGTE, HOOGTES[0]), 10) === HOOGTES[0] ? HOOGTES[1] : HOOGTES[0]);
      d.body.classList.remove('dicht'); bewaar(KEY_DICHT, '0'); maatPaneel(f);
    };
    $('sluit').onclick = function () { f.remove(); };
    $('stop').onclick = function () { vd.stop = true; vd.reden = 'gestopt met de knop'; };

    function status(t) { $('kopstatus').textContent = t; }
    function log(soort, t) {
      var r = el('div', soort, new Date().toTimeString().slice(0, 8) + '  ' + t);
      $('log').insertBefore(r, $('log').firstChild);
      while ($('log').children.length > 60) $('log').removeChild($('log').lastChild);
      status(t);
    }

    function klembord(methode, arg) {
      var bronnen = [f.contentWindow.navigator.clipboard, W.navigator.clipboard].filter(function (c) { return c && c[methode]; });
      if (!bronnen.length) return Promise.reject(new Error('geen klembord'));
      var pogingen = 0;
      function poging() {
        return bronnen[0][methode](arg).catch(function () {
          return bronnen[1] ? bronnen[1][methode](arg) : Promise.reject();
        }).catch(function () {
          if (++pogingen > 200 || vd.stop) return Promise.reject(new Error('klembord niet bereikbaar (tabblad voorop, toegang toegestaan?)'));
          return slaap(300).then(poging);
        });
      }
      return poging();
    }

    /* Langzame Cmd+C, dan het klembord lezen tot er iets anders dan het merkteken staat (max. 3 s). */
    function leesKlembord(doel) {
      var merk = 'vd-lees-' + Date.now(), pogingen = 0;
      return klembord('writeText', merk).then(function () {
        return drukLangzaam(doel, 'c', 'KeyC', ['meta']);
      }).then(function lus() {
        return klembord('readText').then(function (t) {
          t = String(t);
          if (t === merk && ++pogingen < 10) return slaap(300).then(lus);
          return t === merk ? '' : t;
        });
      });
    }

    function bezig(aan) {
      Array.prototype.forEach.call(d.querySelectorAll('.vb'), function (b) { b.disabled = aan; });
    }

    /* Acties uitvoeren. Fouten (plaatshouder zonder waarde, niet typbaar) vóór de start. */
    function speel(acties, naam) {
      if (vd.bezig) return Promise.resolve(false);
      var p = maakPlan(acties, leesTestwaarden($('testwaarden').value));
      if (p.fout) { log('fout', naam + ': ' + p.fout + '.'); return Promise.resolve(false); }
      var doel = doelElement();
      if (!doel) { log('fout', 'De Deck weet nog niet waar de toetsen heen moeten. Klik één keer in Vanessa (op een lege plek) en probeer opnieuw.'); return Promise.resolve(false); }
      if (document.activeElement !== doel && doel.focus) { try { doel.focus(); } catch (e) { /* niet erg */ } }
      vd.bezig = true; vd.stop = false; vd.reden = '';
      bezig(true);
      status(naam + '…');
      var i = 0;
      function volgende() {
        if (vd.stop) return Promise.reject(new Error(vd.reden || 'gestopt'));
        if (i >= p.plan.length) return Promise.resolve();
        var s = p.plan[i++];
        if (s.soort === 'wacht') return slaap(s.ms).then(volgende);
        if (s.soort === 'lees') {
          return leesKlembord(doel).then(function (t) {
            if (isDialoog(t)) log('melding', 'Melding: ' + dialoogTekst(t));
            else log('ok', 'Gelezen: ' + (t ? t.replace(/\r/g, '\\r').replace(/\n/g, '\\n').slice(0, 300) : '(niets)'));
            return volgende();
          });
        }
        if (s.soort === 'toets' && s.langzaam) return drukLangzaam(doel, s.key, s.code, s.mods).then(function () { return slaap(GAT_MS * TEMPO); }).then(volgende);
        if (s.soort === 'toets') { druk(doel, s.key, s.code, s.mods); return slaap(GAT_MS * TEMPO).then(volgende); }
        var j = 0;
        return (function typ() {
          if (vd.stop) return Promise.reject(new Error(vd.reden || 'gestopt'));
          if (j >= s.s.length) return slaap(GAT_MS * TEMPO).then(volgende);
          for (var k = 0; k < TYP_BLOK && j < s.s.length; k++) { var t = tekenNaarToets(s.s[j++]); druk(doel, t[0], t[1], t[2]); }
          return slaap(TYP_PAUZE_MS).then(typ);
        })();
      }
      return volgende().then(function () {
        log('ok', naam + ': gestuurd (' + naarSjabloon(acties) + ') naar ' + beschrijf(doel) + '.');
        return true;
      }, function (e) {
        laatModsLos(doel);
        log('fout', naam + ': gestopt, ' + e.message + '.');
        return false;
      }).then(function (r) { vd.bezig = false; bezig(false); return r; });
    }

    /* ---------- knoppen en bewerken ---------- */

    var knoppen = leesKnoppen();
    var gekozen = knoppen.length ? 0 : -1;
    function opslaan() { bewaarKnoppen(knoppen); }

    function toonTegels() {
      var box = $('tegels');
      box.innerHTML = '';
      knoppen.forEach(function (k, i) {
        var t = el('div', 'tegel' + (i === gekozen ? ' gekozen' : ''));
        t.appendChild(el('div', 'naam', k.naam || '(zonder naam)'));
        var s = el('button', 'speel vb', '▶');
        s.title = 'Afspelen: ' + naarSjabloon(k.acties);
        s.onclick = function (e) { e.stopPropagation(); speel(k.acties, k.naam); };
        t.appendChild(s);
        t.onclick = function () { gekozen = i; toonTegels(); toonBewerk(); };
        box.appendChild(t);
      });
      var n = el('div', 'tegel nieuw', '+ Nieuwe knop');
      n.onclick = function () {
        knoppen.push({ naam: 'Knop ' + (knoppen.length + 1), acties: [] });
        gekozen = knoppen.length - 1;
        opslaan(); toonTegels(); toonBewerk();
        var inp = $('naam'); if (inp) { inp.focus(); inp.select(); }
      };
      box.appendChild(n);
    }

    function toetsUitInvoer() {
      var mods = MODVOLGORDE.filter(function (m) { return $('mod-' + m).checked; });
      var n = Math.max(1, Math.min(50, parseInt($('herhaal').value, 10) || 1));
      return { soort: 'toets', toets: $('toets').value, mods: mods, n: n };
    }

    function voegToe(a) {
      if (gekozen < 0) { log('fout', 'Kies of maak eerst een knop (links).'); return; }
      if (a.soort === 'tekst' && heeftLosGetal(a.s)) { log('fout', 'Niet toegevoegd: "' + a.s + '" bevat een lang getal. Gebruik een plaatshouder, bijv. {klant}, en zet de waarde bij Testwaarden.'); return; }
      knoppen[gekozen].acties.push(a);
      opslaan(); toonTegels(); toonBewerk();
    }

    function toonBewerk() {
      var box = $('bewerk');
      box.innerHTML = '';
      var k = knoppen[gekozen];
      box.appendChild(el('div', 'section-label', k ? 'Knop bewerken' : 'Knop bewerken (maak links een knop)'));
      if (k) {
        var r1 = el('div', 'rij');
        var naam = el('input', 'groei'); naam.id = 'naam'; naam.value = k.naam; naam.placeholder = 'naam, bijv. 6 Orderregel';
        naam.onchange = function () { k.naam = naam.value.trim(); opslaan(); toonTegels(); };
        var speelAlles = el('button', 'knop groot vb', '▶ Afspelen');
        speelAlles.onclick = function () { speel(k.acties, k.naam); };
        var wis = el('button', 'knop rood', 'Wis knop');
        wis.onclick = function () {
          if (!f.contentWindow.confirm('Knop "' + k.naam + '" wissen?')) return;
          knoppen.splice(gekozen, 1); gekozen = knoppen.length ? 0 : -1; opslaan(); toonTegels(); toonBewerk();
        };
        r1.appendChild(naam); r1.appendChild(speelAlles); r1.appendChild(wis);
        box.appendChild(r1);

        if (!k.acties.length) box.appendChild(el('div', 'leeg', 'Nog geen acties. Voeg ze hieronder toe; met "Stuur nu" probeer je eerst los.'));
        var ul = el('ul', 'acties');
        k.acties.forEach(function (a, i) {
          var li = el('li');
          li.appendChild(el('span', '', (i + 1) + '. ' + beschrijfActie(a)));
          function kn(t, titel, doe, vb) { var b = el('button', 'knop' + (vb ? ' vb' : ''), t); b.title = titel; b.onclick = doe; li.appendChild(b); }
          kn('▶', 'Alleen deze actie sturen', function () { speel([a], k.naam + ' · actie ' + (i + 1)); }, true);
          kn('▶…', 'Vanaf hier tot het eind sturen', function () { speel(k.acties.slice(i), k.naam + ' · vanaf ' + (i + 1)); }, true);
          kn('↑', 'Omhoog', function () { if (i) { k.acties.splice(i - 1, 0, k.acties.splice(i, 1)[0]); opslaan(); toonBewerk(); } });
          kn('↓', 'Omlaag', function () { if (i < k.acties.length - 1) { k.acties.splice(i + 1, 0, k.acties.splice(i, 1)[0]); opslaan(); toonBewerk(); } });
          kn('✕', 'Weghalen', function () { k.acties.splice(i, 1); opslaan(); toonTegels(); toonBewerk(); });
          ul.appendChild(li);
        });
        box.appendChild(ul);
        var sj = el('div', 'gedempt', 'Sjabloon: ');
        sj.appendChild(el('code', '', naarSjabloon(k.acties) || '(leeg)'));
        box.appendChild(sj);
      }

      box.appendChild(el('div', 'section-label los', 'Actie toevoegen of los proberen'));
      /* Toets */
      var rt = el('div', 'rij');
      rt.appendChild(el('b', '', 'Toets'));
      var sel = el('select'); sel.id = 'toets';
      TOETSEN.forEach(function (t) { var o = el('option', '', t[0]); o.value = t[0]; sel.appendChild(o); });
      sel.value = vd.laatsteToets || 'Tab';
      sel.onchange = function () { vd.laatsteToets = sel.value; };
      rt.appendChild(sel);
      var vk = el('span', 'rij vinkjes'); vk.style.margin = '0';
      MODVOLGORDE.forEach(function (m) {
        var l = el('label'); var c = el('input'); c.type = 'checkbox'; c.id = 'mod-' + m;
        c.checked = !!(vd.laatsteMods && vd.laatsteMods.indexOf(m) >= 0);
        c.onchange = function () { vd.laatsteMods = MODVOLGORDE.filter(function (x) { return $('mod-' + x).checked; }); };
        l.appendChild(c); l.appendChild(d.createTextNode(MODLABEL[m])); vk.appendChild(l);
      });
      rt.appendChild(vk);
      rt.appendChild(el('span', '', '×'));
      var h = el('input'); h.id = 'herhaal'; h.type = 'number'; h.min = 1; h.max = 50; h.value = 1; h.style.width = '52px';
      rt.appendChild(h);
      var s1 = el('button', 'knop vb', 'Stuur nu'); s1.onclick = function () { speel([toetsUitInvoer()], 'Toets'); };
      var t1 = el('button', 'knop', '+ Voeg toe'); t1.onclick = function () { voegToe(toetsUitInvoer()); };
      rt.appendChild(s1); rt.appendChild(t1);
      box.appendChild(rt);
      /* Tekst */
      var rx = el('div', 'rij');
      rx.appendChild(el('b', '', 'Tekst'));
      var tx = el('input', 'groei'); tx.id = 'tekst'; tx.placeholder = 'bijv. {klant} of "."';
      rx.appendChild(tx);
      var s2 = el('button', 'knop vb', 'Stuur nu'); s2.onclick = function () { if (tx.value) speel([{ soort: 'tekst', s: tx.value }], 'Tekst'); };
      var t2 = el('button', 'knop', '+ Voeg toe'); t2.onclick = function () { if (tx.value) { voegToe({ soort: 'tekst', s: tx.value }); } };
      rx.appendChild(s2); rx.appendChild(t2);
      box.appendChild(rx);
      /* Wacht en lees */
      var rw = el('div', 'rij');
      rw.appendChild(el('b', '', 'Wacht'));
      var ms = el('input'); ms.id = 'wacht'; ms.type = 'number'; ms.min = 50; ms.max = 10000; ms.step = 100; ms.value = 500; ms.style.width = '80px';
      rw.appendChild(ms); rw.appendChild(el('span', 'gedempt', 'ms'));
      var t3 = el('button', 'knop', '+ Voeg toe'); t3.onclick = function () { voegToe({ soort: 'wacht', ms: Math.max(50, Math.min(10000, parseInt(ms.value, 10) || 500)) }); };
      rw.appendChild(t3);
      rw.appendChild(el('b', '', ' Lees'));
      var s4 = el('button', 'knop vb', 'Lees nu'); s4.title = 'Langzame Cmd+C en het klembord tonen: veldinhoud of melding';
      s4.onclick = function () { speel([{ soort: 'lees' }], 'Lees'); };
      var t4 = el('button', 'knop', '+ Voeg toe'); t4.onclick = function () { voegToe({ soort: 'lees' }); };
      rw.appendChild(s4); rw.appendChild(t4);
      box.appendChild(rw);
      box.appendChild(el('div', 'gedempt', 'Combinaties met Ctrl/Shift/Alt/Cmd gaan langzaam (modifier eerst, dan de toets), zoals een mens. " en \' kunnen niet (dode toetsen).'));
      bezig(vd.bezig);
    }

    /* ---------- export / import ---------- */

    function exportTekst() {
      return knoppen.map(function (k) { return '# ' + (k.naam || '(zonder naam)') + '\n' + naarSjabloon(k.acties); }).join('\n\n');
    }
    $('b-export').onclick = function () {
      var t = exportTekst();
      if (!knoppen.length) return log('fout', 'Nog geen knoppen om te exporteren.');
      klembord('writeText', t).then(function () { log('ok', 'Export op het klembord (' + knoppen.length + ' knoppen). Plak hem in het gesprek met Claude of in een bestand.'); },
        function () { $('import').style.display = ''; $('import').value = t; log('melding', 'Klembord lukte niet; de export staat in het veld hieronder, kopieer hem zelf.'); });
    };
    $('b-import').onclick = function () {
      var box = $('import');
      if (box.style.display === 'none') { box.style.display = ''; box.value = ''; box.focus(); return; }
      var blokken = box.value.split(/^#\s*/m).map(function (b) { return b.trim(); }).filter(Boolean);
      var nieuw = [];
      for (var i = 0; i < blokken.length; i++) {
        var regels = blokken[i].split('\n'), naam = regels.shift().trim();
        var r = sjabloonNaarActies(regels.join(' '));
        if (r.fout) return log('fout', 'Import: knop "' + naam + '": ' + r.fout + '. Niets ingelezen.');
        if (r.acties.some(function (a) { return a.soort === 'tekst' && heeftLosGetal(a.s); })) return log('fout', 'Import: knop "' + naam + '" bevat een lang getal (klantgegevens?). Niets ingelezen.');
        nieuw.push({ naam: naam, acties: r.acties });
      }
      if (!nieuw.length) return log('fout', 'Import: niets gevonden. Formaat: "# naam" en daaronder het sjabloon.');
      nieuw.forEach(function (n) {
        var j = knoppen.map(function (k) { return k.naam; }).indexOf(n.naam);
        if (j >= 0) knoppen[j] = n; else knoppen.push(n);
      });
      opslaan(); gekozen = knoppen.length - 1; box.style.display = 'none';
      toonTegels(); toonBewerk();
      log('ok', 'Import: ' + nieuw.length + ' knop(pen) ingelezen (zelfde naam = vervangen).');
    };

    toonTegels();
    toonBewerk();
  }

  if (!/appstream/i.test(location.hostname) && !document.getElementById(PANEEL_ID)) {
    if (!confirm('Vanessa Deck: dit lijkt geen AppStream-pagina (' + location.hostname + '). Toch openen?')) return;
  }
  openPaneel();
})();
