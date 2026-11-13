// Vanessa orders — kopie van ~/Documents/Vanessa/vanessa-order.js, geladen door de DS Tools-launcher.
// NIET hier bewerken: daar wijzigen (VERSIE ophogen) en opnieuw hierheen kopiëren.
/*
 * Vanessa — factuurorder witgoed-reparatie, via AppStream.
 *
 * Draait als bookmarklet op het AppStream-tabblad. Vanessa zelf is een
 * gestreamd Windows-programma zonder DOM; deze tool stuurt daarom
 * toetsaanslagen (KeyboardEvents) naar het element waar de AppStream-client
 * op luistert. Getest 14-10-2026: die client neemt synthetische events aan,
 * ook als het venster geen focus heeft.
 *
 * De reeksen zijn één-op-één overgenomen uit de Stream Deck multi-actions
 * (Make / artikel / prijs / Betaald / Niet betaald). Pauzes worden met het
 * tempo vermenigvuldigd.
 *
 * v0.2.0: elke knop draait alleen zijn eigen blok, zoals op de Stream Deck.
 * Er zit een handmatige klik in de flow die met toetsen niet lukte; eerst
 * de losse blokken bewijzen, daarna pas aan elkaar knopen.
 *
 * v0.4.0: het paneel is een iframe in het AppStream-tabblad zelf (was een
 * popup), en tekst gaat in blokjes van TYP_BLOK tekens tegelijk.
 *
 * v0.5.0: wachtrij uit geplakte sheetrijen (tabblad Orders), ordernummer per
 * order terug naar kolom G, en een klik-test voor synthetische muisklikken.
 *
 * v0.6.0: knop "Volgende actie": de tool bepaalt per order de volgende stap,
 * de gebruiker drukt hem nog zelf in.
 *
 * v0.7.0: klikreeksen opnemen en afspelen (navigeren tussen orders), met
 * markers op de stream om te zien of vensters op dezelfde plek landen.
 *
 * v0.8.0: klikreeksen exporteren en importeren (delen met collega's, back-up).
 *
 * v0.9.0: stap 7 leest het ordernummer via het klembord (klikreeks "ordernummer").
 *
 * v0.10.0: automatische stand gebouwd (hele order / alle orders, stopt bij de
 * eerste stap die niet lukt) maar uitgezet met AUTOMATISCH_AAN: eerst een
 * proefrit met Volgende.
 *
 * v0.11.0: automatische knoppen aan.
 *
 * v0.12.0: klikreeksen per schermprofiel (automatisch op schermresolutie,
 * handmatig te kiezen) en een maatcontrole vóór elke klik.
 *
 * v0.13.0: paneel standaard als balk onderin over de volle breedte (drie
 * kolommen); ⇆ wisselt onder/rechts/links, ↕ de hoogte van de balk.
 *
 * v0.14.0: instellingen in de balk onderin krijgen de breedte (wachtrij wijkt,
 * inhoud in kolommen naast elkaar), één sectie tegelijk open.
 *
 * v0.15.0: instellingen achter een tandwiel in de kopbalk; normaal twee kolommen
 * (wachtrij en huidige order). Tweede Stop-knop weg, die in de kopbalk blijft.
 *
 * v0.16.0: prijs uit kolom Q (Bedrag Vanessa) als die gevuld is, anders P.
 *
 * v0.17.0: huidige order in de breedte (voortgangsstrook, nu/daarna, knoppen op
 * één rij), tempo in de kopbalk, wachtrij scrollt mee naar de huidige order.
 *
 * v0.18.0: Vanessa-meldingen herkennen na stap 1, 2, 4, 5 en 8 (Cmd+C op een
 * dialoog geeft de tekst), stoppen met "Sla deze order over" / "Opgelost".
 * Stap 1 selecteert eerst het veld (Ctrl+A).
 *
 * v0.19.0: Pauze-knop voor de automatische run (maakt de lopende stap af,
 * wacht tot Hervat; tijdens de pauze mag je in Vanessa werken).
 *
 * v0.20.0: pauzes in klikreeksen per stap aan te passen (Instellingen →
 * Klikreeksen → Pauzes); de eerste pauze telt de tijd vóór je eerste klik niet
 * meer mee. Na een fout of stop: "Stap N zelf gedaan, verder met N+1",
 * "Stap N opnieuw" of "Sla deze order over"; een automatische run gaat daarna
 * automatisch verder (eerst een controle op een openstaande melding).
 *
 * v0.21.0: logboek ordernummers in localStorage (RepairID → ordernummer, 14 dagen).
 * Loopt de tool vast, dan gaan de nummers van al gemaakte orders niet meer
 * verloren: opnieuw plakken vult ze in, of kopieer ze uit Instellingen → Logboek.
 * Een gelezen ordernummer dat in het logboek al bij een andere repair staat,
 * wordt geweigerd (oud klembord).
 *
 * Bekende beperking: " en ' zijn dode toetsen in de Windows-layout en komen
 * dubbel aan. De tool weigert ze in plaats van ze verkeerd te typen.
 */
(function () {
  'use strict';

  var W = window;
  var VERSIE = '0.21.0';
  var KEY_TEMPO = 'vanessa_order_tempo';
  var KEY_DICHT = 'vanessa_order_dicht';
  var KEY_KANT = 'vanessa_order_positie';    // onder (standaard) / rechts / links
  var KEY_KANT_OUD = 'vanessa_order_kant';   // tot 0.13.0: rechts/links; genegeerd, zodat iedereen onderin begint
  var KEY_HOOGTE = 'vanessa_order_hoogte';   // hoogte van de balk onderin
  var HOOGTES = [230, 380];
  var KANTEN = ['onder', 'rechts', 'links'];
  var KEY_SECTIE = 'vanessa_order_sectie';   // laatst geopende instellingen-sectie
  var PANEEL_ID = 'vo-paneel';
  var KEY_REEKSEN = 'vanessa_order_reeksen';        // tot 0.12.0: reeksen zonder schermprofiel
  var KEY_PROFIELEN = 'vanessa_order_profielen';
  var KEY_PROFIELKEUZE = 'vanessa_order_profielkeuze'; // leeg = automatisch op scherm
  var MAAT_MARGE = 0.02;

  var ARTIKELEN = ['870672', '870673', '870674'];
  var PRIJZEN = ['89,00', '118,50', '148,00'];

  var TEKST_BETAALD = 'Deze order is aangemaakt omdat er een monteur is langsgekomen om het witgoed product bij jou thuis te repareren. Omdat hier nog een factuur voor moest worden aangemaakt is deze order in je account gezet. \nDe order is al betaald aan de deur dus je hoeft hier verder niks meer voor te betalen.';
  var TEKST_NIET_BETAALD = 'Deze order is aangemaakt omdat er een monteur is langsgekomen om het witgoed product bij jou thuis te repareren. Omdat hier nog een factuur voor moest worden aangemaakt is deze order in je account gezet. De order is destijds niet voldaan, dus hier heb je een betaalverzoek voor ontvangen';

  var GAT_MS = 80;          // tussen twee losse toetsen (Tab, Enter, ...), × tempo
  var TYP_BLOK = 40;        // tekens die in één keer verstuurd worden
  var TYP_PAUZE_MS = 5;     // tussen twee blokjes tekens, los van het tempo
  var KLANT_LADEN_MS = 3000;
  var AUTOMATISCH_AAN = true;  // knoppen "Hele order" / "Alle orders" (aan sinds 0.11.0, na geslaagde proefrit met Volgende)
  var TUSSEN_STAP_MS = 1500;  // pauze tussen twee stappen in de automatische stand, × tempo

  /* ---------- toetsen ---------- */

  var MODS = {
    ctrl: ['Control', 'ControlLeft'],
    meta: ['Meta', 'MetaLeft'],
    alt: ['Alt', 'AltLeft'],
    shift: ['Shift', 'ShiftLeft']
  };
  var NAAM = {
    Tab: 'Tab', Enter: 'Enter', Home: 'Home', Esc: 'Escape', Insert: 'Insert',
    Down: 'ArrowDown', Up: 'ArrowUp', Left: 'ArrowLeft', Right: 'ArrowRight'
  };
  var TEKEN = {
    ' ': ['Space', 0], ',': ['Comma', 0], '.': ['Period', 0], '-': ['Minus', 0],
    '/': ['Slash', 0], ';': ['Semicolon', 0], ':': ['Semicolon', 1], '@': ['Digit2', 1],
    '!': ['Digit1', 1], '?': ['Slash', 1], '(': ['Digit9', 1], ')': ['Digit0', 1],
    '&': ['Digit7', 1], '+': ['Equal', 1], '=': ['Equal', 0]
  };

  /* Het element van de AppStream-client. Staat de focus in het paneel, dan het laatst bekende. */
  function doelElement() {
    var a = document.activeElement;
    var ok = a && a !== document.body && a.id !== PANEEL_ID;
    if (ok && W.__vo) W.__vo.doel = a;
    return ok ? a : (W.__vo && W.__vo.doel) || document.body;
  }

  function stuur(doel, type, key, code, m) {
    doel.dispatchEvent(new KeyboardEvent(type, {
      key: key, code: code,
      ctrlKey: !!m.ctrl, metaKey: !!m.meta, altKey: !!m.alt, shiftKey: !!m.shift,
      bubbles: true, cancelable: true
    }));
  }

  /* Zelfde patroon als de tests: modifiers neer, keydown/keypress/keyup, modifiers op. */
  function druk(doel, key, code, mods) {
    var m = {};
    mods.forEach(function (x) { m[x] = true; stuur(doel, 'keydown', MODS[x][0], MODS[x][1], m); });
    stuur(doel, 'keydown', key, code, m);
    stuur(doel, 'keypress', key, code, m);
    stuur(doel, 'keyup', key, code, m);
    mods.slice().reverse().forEach(function (x) { delete m[x]; stuur(doel, 'keyup', MODS[x][0], MODS[x][1], m); });
  }

  function laatModsLos(doel) {
    Object.keys(MODS).forEach(function (x) { stuur(doel, 'keyup', MODS[x][0], MODS[x][1], {}); });
  }

  /* [key, code, mods] voor één teken, of null als het niet kan. */
  function tekenNaarToets(c) {
    if (c === '\n') return ['Enter', 'Enter', []];
    if (/[a-z]/.test(c)) return [c, 'Key' + c.toUpperCase(), []];
    if (/[A-Z]/.test(c)) return [c, 'Key' + c, ['shift']];
    if (/[0-9]/.test(c)) return [c, 'Digit' + c, []];
    var t = TEKEN[c];
    return t ? [c, t[0], t[1] ? ['shift'] : []] : null;
  }

  /* ---------- stappen ---------- */

  function K(naam, mods, n) {
    var key = NAAM[naam] || naam;
    var code = NAAM[naam] || (/^[a-z]$/i.test(naam) ? 'Key' + naam.toUpperCase() : naam);
    var uit = [];
    for (var i = 0; i < (n || 1); i++) uit.push({ soort: 'toets', key: key, code: code, mods: mods || [] });
    return uit;
  }
  function T(s) { return [{ soort: 'tekst', s: s }]; }
  function Z(ms) { return [{ soort: 'wacht', ms: ms }]; }
  function L(s) { return [{ soort: 'label', s: s }]; }
  function reeks() { return [].concat.apply([], arguments); }

  /* Eerst Ctrl+A: staat er nog een oud nummer in het veld, dan wordt het vervangen in plaats van aangevuld. */
  function blokKlant(nr) {
    return reeks(L('Klant ' + nr + ' opzoeken'), K('a', ['ctrl']), T(nr), K('Enter'), Z(KLANT_LADEN_MS));
  }

  /*
   * Vanessa-meldingen herkennen. Een Windows-dialoog zet met Ctrl+C zijn hele
   * tekst op het klembord ("[Window Title] … [Content] … [OK]", getest
   * 16-10-2026 met "Customer … does not exist"). Zonder dialoog doet Cmd+C in
   * Vanessa niets schadelijks.
   */
  function isDialoog(t) { return /\[Content\]|\[Window Title\]/.test(String(t)); }
  function dialoogTekst(t) {
    var m = String(t).match(/\[Content\]\s*([\s\S]*?)\s*(\[[^\]]+\]|$)/);
    return (m ? m[1] : String(t)).replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  /* Stream Deck "Make" */
  function blokMake() {
    return reeks(
      L('Order aanmaken'),
      K('C', ['meta', 'shift']), Z(1000),
      K('Tab', [], 2), T('t'), Z(500),
      K('Enter'), K('Tab', [], 4), Z(1000),
      K('n'), K('Down'), K('Enter'),
      K('Tab', [], 12),
      K('Down', ['alt']), K('Right', [], 9), K('Enter'),
      K('Enter', ['meta']), Z(1000),
      K('Enter')
    );
  }

  /*
   * De klik die de Stream Deck niet kon: Ctrl+Shift+Insert. Een Mac heeft geen
   * Insert-toets, maar een synthetisch event met code 'Insert' wel (werkt, 14-10-2026).
   * Hoort direct na Make.
   */
  function blokInsert() {
    return reeks(L('Ctrl+Shift+Insert'), K('Insert', ['ctrl', 'shift']));
  }

  /* Stream Deck 870672 / 870673 / 870674 */
  function blokArtikel(art) {
    return reeks(
      L('Artikel ' + art),
      K('Down', ['alt']), Z(1800),
      T(art), K('Enter'), Z(1300),
      K('Enter'), K('Tab', [], 3),
      K('Down', ['alt'])
    );
  }

  /* Stream Deck 89 / 118,50 / 148 */
  function blokPrijs(prijs) {
    return reeks(L('Prijs ' + prijs), T(prijs), K('Enter'), K('Enter'));
  }

  /* Stream Deck Betaald / Niet betaald */
  function blokAnnotatie(betaald) {
    return reeks(
      L(betaald ? 'Annotatie: betaald' : 'Annotatie: niet betaald'),
      K('i', ['ctrl']),
      T(betaald ? TEKST_BETAALD : TEKST_NIET_BETAALD),
      K('Tab'), K('Enter'), K('Home')
    );
  }

  /* Gooit vóór de start, nooit halverwege. */
  function controleerPlan(plan) {
    plan.forEach(function (s) {
      if (s.soort !== 'tekst') return;
      for (var i = 0; i < s.s.length; i++) {
        if (!tekenNaarToets(s.s[i])) throw new Error('Dit teken kan niet getypt worden: ' + s.s[i]);
      }
    });
  }

  function duurMs(plan, tempo) {
    var t = 0;
    plan.forEach(function (s) {
      if (s.soort === 'wacht') t += s.vast ? s.ms : s.ms * tempo;
      else if (s.soort === 'toets' || s.soort === 'klik') t += GAT_MS * tempo;
      else if (s.soort === 'tekst') t += Math.ceil(s.s.length / TYP_BLOK) * TYP_PAUZE_MS;
    });
    return t;
  }

  /* ---------- wachten zonder throttling ---------- */
  /*
   * Chrome remt setTimeout af in een venster dat verborgen is (tot 1x per
   * seconde, na 5 min nog veel sterker). Timers in een Worker hebben daar
   * geen last van. Lukt de Worker niet (CSP), dan gewoon setTimeout.
   */
  var worker = null;
  var wachtend = {};
  var volgnr = 0;
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

  /* ---------- uitvoeren ---------- */

  var vo = W.__vo || (W.__vo = { bezig: false, stop: false });
  var nu = document.activeElement;
  if (nu && nu !== document.body && nu.id !== PANEEL_ID) vo.doel = nu;

  function meld(tekst, soort) {
    if (vo.ui) vo.ui.status(tekst, soort);
  }

  /* Wie zelf in AppStream klikt of typt, stoort de reeks: dan direct stoppen.
     Klikken in het paneel komt hier niet langs, dat is een eigen frame. */
  function stoorder(e) {
    /* Tijdens een pauze (en geen stap bezig) mag de gebruiker gewoon in Vanessa werken. */
    if ((vo.bezig || (vo.auto && !vo.pauze)) && e.isTrusted) { vo.stop = true; vo.auto = false; vo.reden = 'je klikte of typte zelf in AppStream'; }
  }
  /*
   * pointerdown, niet alleen mousedown: de AppStream-client onderdrukt
   * pointerdown, en dan stuurt Chrome geen mousedown meer. Luisteraars van een
   * eerdere versie (bookmarklet opnieuw geklikt zonder herladen) eerst weg,
   * anders blijven die actief en komen de nieuwe er nooit bij.
   */
  if (vo.luisteraars) vo.luisteraars.forEach(function (l) { W.removeEventListener(l[0], l[1], true); });
  vo.luisteraars = [
    ['keydown', stoorder], ['pointerdown', stoorder], ['mousedown', stoorder],
    ['pointerdown', neemOp], ['keydown', neemOp]
  ];
  vo.luisteraars.forEach(function (l) { W.addEventListener(l[0], l[1], true); });

  function voerUit(plan, tempo) {
    var doel = doelElement();
    /* Wie in het paneel klikte, haalde de focus weg bij de stream: teruggeven. */
    if (document.activeElement !== doel && doel.focus) { try { doel.focus(); } catch (e) { /* niet erg */ } }
    vo.bezig = true; vo.stop = false; vo.reden = '';
    var label = '';
    var totaal = plan.length;
    var i = 0;

    function volgende() {
      if (vo.stop) return Promise.reject(new Error(vo.reden || 'gestopt'));
      if (i >= totaal) return Promise.resolve();
      var s = plan[i++];
      var pct = Math.round(i / totaal * 100) + '%';
      if (s.soort === 'label') { label = s.s; meld(label + ' · ' + pct); return volgende(); }
      if (s.soort === 'wacht') { meld(label + ' · ' + pct); return slaap(s.vast ? s.ms : s.ms * tempo).then(volgende); }
      if (s.soort === 'klik') {
        var pos;
        try { pos = zoekPos(s); klikOp(pos, 1); } catch (e) { return Promise.reject(e); }
        if (s.aantal !== 2) return slaap(GAT_MS * tempo).then(volgende);
        return slaap(60).then(function () { klikOp(pos, 2); return slaap(GAT_MS * tempo); }).then(volgende);
      }
      if (s.soort === 'toets') {
        druk(doel, s.key, s.code, s.mods);
        return slaap(GAT_MS * tempo).then(volgende);
      }
      if (s.soort === 'tekst') {
        var j = 0;
        var typ = function () {
          if (vo.stop) return Promise.reject(new Error(vo.reden || 'gestopt'));
          if (j >= s.s.length) return slaap(GAT_MS * tempo).then(volgende);
          for (var k = 0; k < TYP_BLOK && j < s.s.length; k++) {
            var t = tekenNaarToets(s.s[j++]);
            druk(doel, t[0], t[1], t[2]);
          }
          return slaap(TYP_PAUZE_MS).then(typ);
        };
        return typ();
      }
      return volgende();
    }

    return volgende().then(function () {
      vo.bezig = false;
      meld('klaar: ' + label + '.', 'ok');
      return true;
    }, function (err) {
      vo.bezig = false;
      vo.laatsteFout = err.message;
      laatModsLos(doel);
      meld('gestopt bij "' + label + '": ' + err.message + '. Controleer wat er al ingevuld is.', 'fout');
      return false;
    });
  }

  /* ---------- stappen per order ---------- */
  /*
   * Wat "Volgende actie" achter elkaar doet. Handmatige stappen draaien niets:
   * de knop bevestigt dan alleen dat de gebruiker het gedaan heeft. Sluiten en
   * terug naar Customer nr is handmatig tot de klikposities vastliggen.
   */
  var STAPPEN = [
    { label: function (o) { return 'Klant ' + o.klant + ' zoeken'; }, eerst: 'Cursor in het veld Customer nr.', controle: true, plan: function (o) { return blokKlant(o.klant); } },
    { label: function () { return 'Make'; }, eerst: 'Klantscherm staat open.', controle: true, plan: function () { return blokMake(); } },
    { label: function () { return 'Ctrl+Shift+Insert'; }, plan: function () { return blokInsert(); } },
    { label: function (o) { return 'Artikel ' + o.artikel; }, controle: true, plan: function (o) { return blokArtikel(o.artikel); } },
    { label: function (o) { return 'Prijs € ' + o.prijs; }, controle: true, plan: function (o) { return blokPrijs(o.prijs); } },
    { label: function (o) { return o.betaald ? 'Annotatie: betaald' : 'Annotatie: niet betaald'; }, plan: function (o) { return blokAnnotatie(o.betaald); } },
    { label: function () { return 'Ordernummer kopiëren'; }, reeks: 'ordernummer', kopieer: true,
      eerst: 'Kopieer het ordernummer in Vanessa en zet het in het veld bij de order hierboven. (Of neem een klikreeks "ordernummer" op: dubbelklik in het veld Order nr, Cmd+C. Dan doet de tool het.)' },
    { label: function () { return 'Order en klant sluiten'; }, reeks: 'afsluiten', controle: true, eerst: 'Doe dit zelf in Vanessa en zet de cursor in Customer nr. (Of neem een klikreeks "afsluiten" op, dan doet de tool het.)' }
  ];

  /* ---------- klikreeksen ---------- */
  /*
   * Navigeren tussen orders kost veel klikken op vaste plekken. De gebruiker
   * doet het één keer voor; de tool legt elke klik vast als fractie van het
   * element waarop geklikt werd (overleeft een ander venstermaat), plus toetsen
   * en de pauzes ertussen. Opgeslagen in localStorage: alleen posities en
   * toetsen, geen klantdata (daarom: tijdens opnemen niets typen dat dat is).
   */
  /*
   * Schermprofielen. Op een ander scherm geeft AppStream Windows een andere
   * resolutie; Vanessa's knoppen houden hun pixelmaat en schuiven dus anders op
   * dan de fractie aanneemt. Daarom reeksen per scherm: sleutel = resolutie en
   * pixeldichtheid van het scherm. De gebruiker kan een ander profiel kiezen.
   */
  function schermSleutel() {
    return W.screen.width + 'x' + W.screen.height + '@' + Math.round((W.devicePixelRatio || 1) * 100) / 100;
  }

  function leesProfielen() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(KEY_PROFIELEN) || 'null'); } catch (e) { p = null; }
    if (p) return p;
    /* Eenmalig: reeksen van vóór de profielen apart zetten. Van welk scherm ze zijn weten we niet. */
    p = {};
    var oud = {};
    try { oud = JSON.parse(localStorage.getItem(KEY_REEKSEN) || '{}'); } catch (e) { oud = {}; }
    if (Object.keys(oud).length) p.oud = { label: 'Eerdere opname', reeksen: oud };
    bewaarProfielen(p);
    try { localStorage.removeItem(KEY_REEKSEN); } catch (e) { /* niet erg */ }
    return p;
  }
  function bewaarProfielen(p) { try { localStorage.setItem(KEY_PROFIELEN, JSON.stringify(p)); } catch (e) { /* niet erg */ } }

  function actiefProfiel() { return lees(KEY_PROFIELKEUZE, '') || schermSleutel(); }

  function profielLabel(k, p) {
    p = p || leesProfielen()[k];
    return (p && p.label) || (k === schermSleutel() ? 'Dit scherm' : k);
  }

  function leesReeksen() {
    var p = leesProfielen()[actiefProfiel()];
    return (p && p.reeksen) || {};
  }
  function bewaarReeksen(r) {
    var ps = leesProfielen(), k = actiefProfiel();
    ps[k] = ps[k] || {};
    ps[k].reeksen = r;
    bewaarProfielen(ps);
  }

  function selectorVan(el) {
    var esc = function (x) { return W.CSS && W.CSS.escape ? W.CSS.escape(x) : x; };
    if (el.id) return '#' + esc(el.id);
    var pad = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var i = 1, sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) i++;
      pad.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
      el = el.parentElement;
      if (el && el.id) { pad.unshift('#' + esc(el.id)); return pad.join(' > '); }
    }
    return 'body > ' + pad.join(' > ');
  }

  function zoekPos(stap) {
    var el = null;
    try { el = document.querySelector(stap.sel); } catch (e) { el = null; }
    if (!el) throw new Error('klikdoel niet gevonden (' + stap.sel + '), neem de reeks opnieuw op');
    /* Ander formaat dan bij de opname: dan raakt elke klik net naast. Niet klikken. */
    if (stap.mw && stap.mh) {
      var r = el.getBoundingClientRect();
      if (Math.abs(r.width - stap.mw) / stap.mw > MAAT_MARGE || Math.abs(r.height - stap.mh) / stap.mh > MAAT_MARGE) {
        throw new Error('het beeld is ' + Math.round(r.width) + '×' + Math.round(r.height) + ', bij de opname was het ' +
          Math.round(stap.mw) + '×' + Math.round(stap.mh) + '. Kies het juiste schermprofiel, zet AppStream op volledig scherm, of neem opnieuw op');
      }
    }
    return { el: el, fx: stap.fx, fy: stap.fy };
  }

  function neemOp(e) {
    if (!vo.opname || !e.isTrusted) return;
    var nu = Date.now(), wacht = nu - vo.opname.laatst;
    vo.opname.laatst = nu;
    if (e.type === 'pointerdown') {
      var el = e.target, r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      vo.opname.stappen.push({ soort: 'klik', sel: selectorVan(el), fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height,
        mw: Math.round(r.width), mh: Math.round(r.height), wacht: wacht });
    } else {
      if (/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) return;
      var mods = [];
      if (e.ctrlKey) mods.push('ctrl');
      if (e.metaKey) mods.push('meta');
      if (e.altKey) mods.push('alt');
      if (e.shiftKey) mods.push('shift');
      vo.opname.stappen.push({ soort: 'toets', key: e.key, code: e.code, mods: mods, wacht: wacht });
    }
    if (vo.ui) {
      var k = vo.opname.stappen.filter(function (x) { return x.soort === 'klik'; }).length;
      vo.ui.status('Opname "' + vo.opname.naam + '" loopt: ' + k + ' klikken, ' + (vo.opname.stappen.length - k) +
        ' toetsen gezien. Druk hier Stop opname als je klaar bent.', 'bezig');
    }
  }

  var DUBBEL_MS = 400;

  /* Twee klikken vlak na elkaar op dezelfde plek: dat was een dubbelklik. */
  function isDubbel(a, b) {
    return a && b && a.soort === 'klik' && b.soort === 'klik' && a.sel === b.sel &&
      (b.wacht || 0) < DUBBEL_MS && Math.abs(a.fx - b.fx) < 0.01 && Math.abs(a.fy - b.fy) < 0.01;
  }

  /*
   * Opgenomen pauzes worden afgespeeld zoals ze waren, minimaal 300 ms, maximaal 10 s,
   * tenzij de gebruiker de pauze heeft aangepast (st.speel, 50 ms – 10 s). De eerste
   * pauze is de tijd tussen "Opnemen" en de eerste klik: die is nooit nodig.
   * Een dubbelklik niet: die 300 ms zou er voor Windows twee losse klikken van maken.
   */
  var PAUZE_MIN = 50;
  function opgenomenPauze(st, i) { return i === 0 ? 300 : Math.min(10000, Math.max(300, st.wacht || 0)); }
  function pauzeVan(st, i) { return typeof st.speel === 'number' ? st.speel : opgenomenPauze(st, i); }

  function reeksPlan(naam) {
    var r = leesReeksen()[naam];
    if (!r || !r.length) return null;
    var plan = L('Klikreeks ' + naam);
    for (var i = 0; i < r.length; i++) {
      var st = r[i];
      plan.push({ soort: 'wacht', ms: pauzeVan(st, i), vast: true });
      if (st.soort === 'klik') {
        var dubbel = isDubbel(st, r[i + 1]);
        plan.push({ soort: 'klik', sel: st.sel, fx: st.fx, fy: st.fy, mw: st.mw, mh: st.mh, aantal: dubbel ? 2 : 1 });
        if (dubbel) i++;
      } else plan.push({ soort: 'toets', key: st.key, code: st.code, mods: st.mods || [] });
    }
    return plan;
  }

  /*
   * Delen tussen collega's: alle reeksen als tekst. Bij inlezen wordt elke stap
   * gecontroleerd; alleen klikken (fractie 0–1) en toetsen komen erdoor.
   */
  var EXPORT_SOORT = 'vanessa-klikreeksen';

  function exporteerReeksen() {
    return JSON.stringify({ _soort: EXPORT_SOORT, versie: VERSIE, profielen: leesProfielen() });
  }

  function geldigeStap(st) {
    if (!st || typeof st !== 'object') return false;
    var wacht = typeof st.wacht === 'number' && st.wacht >= 0 &&
      (st.speel === undefined || (typeof st.speel === 'number' && st.speel >= PAUZE_MIN && st.speel <= 10000));
    if (st.soort === 'klik') {
      return wacht && typeof st.sel === 'string' && st.sel.length < 500 &&
        [st.fx, st.fy].every(function (v) { return typeof v === 'number' && v >= 0 && v <= 1; }) &&
        [st.mw, st.mh].every(function (v) { return v === undefined || (typeof v === 'number' && v > 0 && v < 20000); });
    }
    if (st.soort === 'toets') {
      return wacht && typeof st.key === 'string' && st.key.length <= 20 && typeof st.code === 'string' &&
        Array.isArray(st.mods) && st.mods.every(function (m) { return MODS.hasOwnProperty(m); });
    }
    return false;
  }

  function geldigeReeksen(reeksen) {
    if (!reeksen || typeof reeksen !== 'object') return 'geen reeksen';
    var namen = Object.keys(reeksen);
    for (var i = 0; i < namen.length; i++) {
      var r = reeksen[namen[i]];
      if (!/^[\w -]{1,40}$/.test(namen[i]) || !Array.isArray(r) || !r.length || !r.every(geldigeStap)) {
        return 'reeks "' + namen[i].slice(0, 40) + '" is beschadigd of ongeldig';
      }
    }
    return '';
  }

  /*
   * Geeft { profielen } of { fout }. Een export van vóór 0.12.0 (alleen
   * "reeksen") komt in het actieve profiel terecht.
   */
  function leesExport(tekst) {
    var data;
    try { data = JSON.parse(String(tekst).trim()); } catch (e) { return { fout: 'Dit is geen export van klikreeksen.' }; }
    if (!data || data._soort !== EXPORT_SOORT) return { fout: 'Dit is geen export van klikreeksen.' };
    var profielen = data.profielen;
    if (!profielen && data.reeksen) { profielen = {}; profielen[actiefProfiel()] = { reeksen: data.reeksen }; }
    if (!profielen || typeof profielen !== 'object' || !Object.keys(profielen).length) return { fout: 'De export bevat geen reeksen.' };
    var schoon = {};
    for (var k in profielen) {
      if (!profielen.hasOwnProperty(k)) continue;
      var p = profielen[k];
      if (!/^[\w.@ -]{1,40}$/.test(k) || !p || typeof p !== 'object') return { fout: 'Profiel "' + String(k).slice(0, 40) + '" is ongeldig; niets ingelezen.' };
      var fout = geldigeReeksen(p.reeksen || {});
      if (fout) return { fout: 'Profiel "' + k + '": ' + fout + '; niets ingelezen.' };
      schoon[k] = { label: typeof p.label === 'string' ? p.label.slice(0, 40) : undefined, reeksen: p.reeksen || {} };
    }
    return { profielen: schoon };
  }

  function beschrijfReeks(r) {
    var dub = r.filter(function (x, i) { return isDubbel(r[i - 1], x); }).length;
    var k = r.filter(function (x) { return x.soort === 'klik'; }).length - dub;
    var t = r.filter(function (x) { return x.soort === 'toets'; }).length;
    var ms = r.reduce(function (a, x, i) { return a + (isDubbel(r[i - 1], x) ? 60 : pauzeVan(x, i)); }, 0);
    var zonderMaat = r.some(function (x) { return x.soort === 'klik' && !x.mw; });
    var aangepast = r.some(function (x) { return typeof x.speel === 'number'; });
    return k + ' klikken' + (dub ? ' (waarvan ' + dub + ' dubbel)' : '') + ', ' + t + ' toetsen, ongeveer ' +
      (Math.round(ms / 100) / 10).toString().replace('.', ',') + ' s' + (aangepast ? ' (pauzes aangepast)' : '') +
      (zonderMaat ? '. ⚠ Opgenomen vóór v0.12.0: zonder maatcontrole, neem hem opnieuw op' : '');
  }

  function toonMarkers(naam) {
    var oud = document.querySelectorAll('.vo-marker');
    Array.prototype.forEach.call(oud, function (m) { m.remove(); });
    if (!naam) return 0;
    var n = 0;
    var reeks = leesReeksen()[naam] || [];
    reeks.forEach(function (st, i) {
      if (st.soort !== 'klik' || isDubbel(reeks[i - 1], st)) return;
      n++;
      var el; try { el = document.querySelector(st.sel); } catch (e) { el = null; }
      if (!el) return;
      var r = el.getBoundingClientRect();
      var m = document.createElement('div');
      m.className = 'vo-marker';
      m.textContent = n;
      m.style.cssText = 'position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,102,0,.85);' +
        'color:#fff;font:bold 11px/18px sans-serif;text-align:center;pointer-events:none;z-index:2147483646;' +
        'left:' + (r.left + st.fx * r.width) + 'px;top:' + (r.top + st.fy * r.height) + 'px';
      document.body.appendChild(m);
    });
    return n;
  }

  /* ---------- wachtrij uit de sheet ---------- */
  /*
   * De gebruiker kopieert zelf rijen uit het tabblad Orders (filteren en kiezen
   * doet hij zelf) en plakt ze in het paneel. Google Sheets levert dat als
   * tab-gescheiden tekst. Kolommen: met kopregel op naam, anders vanaf kolom A.
   */
  /*
   * prijs = P (Bedrag Sophia). Staat er in Q (Bedrag Vanessa) een bedrag, dan
   * wint dat: zo wordt een verkeerd Sophia-bedrag in de sheet gecorrigeerd
   * (P doorgestreept, juiste bedrag in Q; doorhalen komt niet mee met kopiëren).
   */
  var KOLOM = { betaalverzoek: 2, repair: 4, ordernr: 6, klant: 8, prijs: 15, prijsVanessa: 16, artikel: 19 };
  var KOP = {
    betaalverzoek: /betaalverzoek/i, repair: /repair\s*id/i, ordernr: /^ordernummer$/i,
    klant: /customer\s*id/i, prijs: /bedrag\s*sophia/i, artikel: /product\s*id/i,
    prijsVanessa: /bedrag\s*vanessa/i
  };
  var KOP_OPTIONEEL = ['prijsVanessa'];

  function leesTsv(tekst) {
    var rijen = [], rij = [], cel = '', i = 0, inQuote = false;
    tekst = tekst.replace(/\r\n?/g, '\n');
    for (; i < tekst.length; i++) {
      var c = tekst[i];
      if (inQuote) {
        if (c === '"' && tekst[i + 1] === '"') { cel += '"'; i++; }
        else if (c === '"') inQuote = false;
        else cel += c;
      } else if (c === '"' && cel === '') inQuote = true;
      else if (c === '\t') { rij.push(cel); cel = ''; }
      else if (c === '\n') { rij.push(cel); rijen.push(rij); rij = []; cel = ''; }
      else cel += c;
    }
    if (cel !== '' || rij.length) { rij.push(cel); rijen.push(rij); }
    return rijen.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
  }

  function isWaar(s) { return /^(true|waar|1|ja|yes)$/i.test(String(s).trim()); }
  function cijfers(s) { var m = String(s).match(/\d+/g); return m ? m.join('') : ''; }

  /* Geeft { orders, regels, fout }. regels = alle geplakte datarijen, voor kolom G terug. */
  function parseWachtrij(tekst) {
    var rijen = leesTsv(tekst);
    if (!rijen.length) return { fout: 'Niets geplakt.' };

    var kol = KOLOM;
    var kopIdx = -1;
    rijen.forEach(function (r, i) { if (kopIdx < 0 && r.some(function (c) { return KOP.repair.test(c.trim()); })) kopIdx = i; });
    if (kopIdx >= 0) {
      kol = {};
      Object.keys(KOP).forEach(function (k) {
        var j = rijen[kopIdx].findIndex(function (c) { return KOP[k].test(c.trim()); });
        if (j >= 0) kol[k] = j;
      });
      var mist = Object.keys(KOP).filter(function (k) { return kol[k] === undefined && KOP_OPTIONEEL.indexOf(k) < 0; });
      if (mist.length) return { fout: 'Kopregel herkend, maar deze kolommen ontbreken: ' + mist.join(', ') + '.' };
      rijen = rijen.slice(kopIdx + 1);
    }

    var cel = function (r, k) { return (r[kol[k]] || '').trim(); };
    var herkend = rijen.filter(function (r) { return /^\d{5,7}([.,]0+)?$/.test(cel(r, 'repair')) && /^\d{6}$/.test(cijfers(cel(r, 'artikel'))); }).length;
    if (!herkend) {
      return { fout: 'Geen orderregels herkend. Kopieer hele rijen (klik op de rijnummers links) of neem de kopregel mee.' };
    }

    var gemaakt = {};
    rijen.forEach(function (r) { if (cijfers(cel(r, 'ordernr'))) gemaakt[cijfers(cel(r, 'repair'))] = true; });

    var gezien = {};
    var orders = [];
    var regels = rijen.map(function (r, i) {
      var repair = cijfers(cel(r, 'repair').replace(/[.,]0+$/, ''));
      var bestaand = cel(r, 'ordernr');
      var regel = { bestaandG: bestaand, order: null, reden: '' };
      var prijsSophia = normPrijs(cel(r, 'prijs'));
      var prijsVanessa = kol.prijsVanessa !== undefined ? normPrijs(cel(r, 'prijsVanessa')) : null;
      var prijs = prijsVanessa || prijsSophia;
      var klant = cel(r, 'klant');
      if (cijfers(bestaand)) regel.reden = 'heeft al ordernummer';
      else if (!repair) regel.reden = 'geen RepairID';
      else if (gemaakt[repair]) regel.reden = 'RepairID al gemaakt in andere rij';
      else if (gezien[repair]) regel.reden = 'dubbel in de plak';
      else if (!prijs) regel.reden = 'geen bedrag (' + (cel(r, 'prijs') || 'leeg') + ')';
      else if (!/^\d+$/.test(klant)) regel.reden = 'ongeldig klantnummer (' + (klant || 'leeg') + ')';
      else if (!/^\d{6}$/.test(cijfers(cel(r, 'artikel')))) regel.reden = 'ongeldig artikel';
      if (!regel.reden) {
        gezien[repair] = true;
        regel.order = {
          nr: orders.length + 1, regel: i, repair: repair, klant: klant,
          artikel: cijfers(cel(r, 'artikel')), prijs: prijs,
          prijsAfwijkend: prijsVanessa && prijsSophia && prijsVanessa !== prijsSophia ? prijsSophia : '',
          betaald: !isWaar(cel(r, 'betaalverzoek')),
          ordernummer: '', klaar: false
        };
        orders.push(regel.order);
      } else if (repair) regel.repair = repair;
      return regel;
    });
    return { orders: orders, regels: regels };
  }

  /* ---------- paneel ---------- */
  /*
   * Een iframe in de pagina zelf. Geen gewone div: klikken en toetsen daarin
   * zouden opborrelen naar de AppStream-client en in Vanessa belanden. Events
   * in een iframe komen niet in het document eromheen.
   */

  function lees(k, std) { try { var v = localStorage.getItem(k); return v === null ? std : v; } catch (e) { return std; } }
  function bewaar(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* niet erg */ } }

  /* ---------- logboek ordernummers (sinds 0.21.0) ---------- */
  /*
   * De wachtrij leeft alleen in het geheugen. Loopt het tabblad vast of herlaadt
   * AppStream, dan waren de ordernummers van de al gemaakte orders weg. Daarom per
   * order RepairID → ordernummer in localStorage: géén klantnummer, bedrag of naam.
   * Bewaard voor LOG_DAGEN. Een order komt erin zodra Make start (dan kan hij in
   * Vanessa bestaan), en krijgt zijn nummer zodra dat bekend is.
   * Per RepairID: n = ordernummer, s = hoogste gestarte/gedane stap (index),
   * k = klaar, ov = reden overgeslagen, t = eerste keer, u = laatste wijziging.
   */
  var KEY_LOG = 'vanessa_order_logboek';
  var LOG_DAGEN = 14;
  var LOG_MAX = 1000;

  function leesLog() {
    var l;
    try { l = JSON.parse(localStorage.getItem(KEY_LOG) || '{}'); } catch (e) { l = {}; }
    if (!l || typeof l !== 'object' || Array.isArray(l)) l = {};
    var grens = Date.now() - LOG_DAGEN * 864e5;
    Object.keys(l).forEach(function (k) { if (!l[k] || !(l[k].u > grens)) delete l[k]; });
    return l;
  }
  function bewaarLog(l) {
    var k = Object.keys(l);
    if (k.length > LOG_MAX) {
      k.sort(function (a, b) { return l[a].u - l[b].u; }).slice(0, k.length - LOG_MAX).forEach(function (x) { delete l[x]; });
    }
    try { localStorage.setItem(KEY_LOG, JSON.stringify(l)); return true; } catch (e) { return false; }
  }
  /* gestart: index van de stap die nu begint (vóór het uitvoeren), anders weglaten. */
  function logOrders(orders, gestart) {
    var l = leesLog(), gewijzigd = false;
    orders.forEach(function (o) {
      if (!o || !o.repair) return;
      var e = l[o.repair];
      var nr = /^\d{8,}$/.test(o.ordernummer || '') ? o.ordernummer : '';
      /* Teruggezet uit het logboek en niets nieuws: niet overschrijven (anders wordt "begonnen" of "sluiten niet bevestigd" ongemerkt "klaar"). */
      if (o.uitLog && e && nr === (e.n || '')) return;
      var s = Math.max(e ? e.s || 0 : 0, Math.min(o.stap || 0, STAPPEN.length), typeof gestart === 'number' ? gestart : 0);
      if (!e && !nr && s < 1) return;
      var nieuw = {
        n: nr || (e && e.n) || '', s: s, k: !!(o.klaar && !o.overgeslagen) || !!(e && e.k),
        ov: o.overgeslagen || '', t: e ? e.t : Date.now(), u: e ? e.u : Date.now()
      };
      if (e && e.n === nieuw.n && e.s === nieuw.s && e.k === nieuw.k && (e.ov || '') === nieuw.ov) return;
      nieuw.u = Date.now();
      l[o.repair] = nieuw;
      gewijzigd = true;
    });
    if (gewijzigd) bewaarLog(l);
  }
  /* Na het plakken: wat het logboek al weet, zetten we terug. Geeft { nummers, begonnen }. */
  function pasLogToe(orders) {
    var l = leesLog(), uit = { nummers: 0, begonnen: 0 };
    orders.forEach(function (o) {
      var e = l[o.repair];
      if (!e) return;
      if (e.n) {
        o.ordernummer = e.n; o.klaar = true; o.stap = STAPPEN.length; o.uitLog = e;
        uit.nummers++;
      } else if (e.s >= 1) {
        o.klaar = true; o.stap = e.s; o.uitLog = e;
        o.overgeslagen = (e.ov ? e.ov + '; ' : '') + 'al begonnen op ' + logTijd(e.u) + ' (tot stap ' + Math.min(e.s + 1, STAPPEN.length) +
          '), geen ordernummer bewaard. Kijk in Vanessa of de order al bestaat; zo niet: klik hier en dan Heropen.';
        uit.begonnen++;
      }
    });
    return uit;
  }
  function logTijd(ms) {
    var d = new Date(ms), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return p(d.getDate()) + '-' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function normPrijs(s) {
    s = String(s).replace(/[^\d.,-]/g, '');
    if (!s) return null;
    var komma = s.lastIndexOf(','), punt = s.lastIndexOf('.');
    /* Het laatste scheidingsteken is het decimale; het andere zijn duizendtallen. */
    if (komma > punt) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    if (!isFinite(n) || n <= 0) return null;
    return n.toFixed(2).replace('.', ',');
  }

  var CSS = [
    'html,body{margin:0;background:#fff}',
    'body{font:13px -apple-system,Segoe UI,sans-serif;color:#333333}',
    '.header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;background:#0090e3;color:#fff;padding:8px 10px 8px 14px}',
    '.titel{font-size:15px;font-weight:700;white-space:nowrap}',
    '#kopstatus{flex:1;font-size:11px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.toggle-btn{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:4px;width:24px;height:24px;font:inherit;font-size:14px;cursor:pointer;padding:0}',
    '.toggle-btn:hover{background:rgba(255,255,255,.32)}',
    '.content{padding:4px 14px 12px}',
    'label{display:block;font-size:13px;font-weight:600;margin:10px 0 5px}',
    '.section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999999;margin:14px 0 2px;border-top:1px solid #DDDDDD;padding-top:10px}',
    'input,select,textarea{box-sizing:border-box;width:100%;padding:6px 8px;border:1px solid #DDDDDD;border-radius:6px;font:inherit}',
    'textarea{height:54px;resize:vertical;font-size:11px}',
    '.rij{display:flex;gap:6px;margin-bottom:5px;align-items:center}',
    '.ux-btn{flex:1;padding:6px 8px;border:1px solid #cce9f9;background:#F2F7FC;color:#285dab;border-radius:8px;font:inherit;cursor:pointer}',
    '.ux-btn.selected{background:#d4edda;border-color:#00B900;color:#155724;font-weight:600}',
    '.rij input{flex:2;min-width:0}',
    '.rij select{flex:1.4;width:auto;min-width:0}',
    '.ux-btn:disabled{opacity:.45;cursor:default}',
    '.klein{flex:0 0 auto;padding:4px 7px;font-size:12px}',
    '.order{border:1px solid #DDDDDD;border-radius:6px;padding:6px 8px;margin-bottom:5px;cursor:pointer;font-size:12px}',
    '.order.huidig{border-color:#0090e3;background:#F2F7FC}',
    '.order.klaar{opacity:.55}',
    '.order .kop{display:flex;gap:6px;align-items:center}',
    '.order .kop b{color:#285dab}',
    '.order .rij{margin:5px 0 0}',
    '.order input{padding:4px 6px;font-size:12px}',
    '.pill-green{background:#d4edda;color:#155724;border-radius:4px;padding:1px 5px;font-size:11px}',
    '.pill-amber{background:#fff8e1;color:#856404;border-radius:4px;padding:1px 5px;font-size:11px}',
    '.gedempt{color:#999999;font-size:11px}',
    '.overgeslagen{font-size:11px;color:#856404;background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:6px 8px;margin:6px 0;line-height:1.45}',
    '.info-box{background:#F2F7FC;border:1px solid #cce9f9;border-radius:6px;padding:7px 9px;font-size:11px;margin-top:8px;line-height:1.45}',
    '.knoppen{display:flex;gap:8px;margin-top:10px}',
    '.back-btn{flex:1;padding:8px;border:1px solid #E50000;border-radius:8px;background:#fff0f0;color:#E50000;font:inherit;cursor:pointer}',
    '#status{margin-top:10px;font-size:12px;padding:7px 9px;border-radius:6px;display:none;line-height:1.45}',
    '#status.bezig{display:block;background:#fff8e1;border:1px solid #ffc107;color:#856404}',
    '#status.ok{display:block;background:#d4edda;border:1px solid #00B900;color:#155724}',
    '#status.fout{display:block;background:#fff0f0;border:1px solid #E50000;color:#E50000}',
    '.submit-btn{flex:3;padding:9px;border:0;border-radius:8px;background:#0090e3;color:#fff;font:inherit;font-weight:600;cursor:pointer}',
    '.submit-btn:hover{background:#007bc4}',
    '.submit-btn:disabled{background:#999999;cursor:default}',
    'details summary{cursor:pointer;font-size:12px;color:#285dab;margin-top:12px}',
    '.version-bar{background:#F3F3F3;color:#999999;font-size:11px;padding:3px 14px;text-align:right}',
    'body.dicht .content,body.dicht .version-bar{display:none}',
    /* Balk onderin: drie kolommen naast elkaar, elk met een eigen schuifbalk. */
    'body.onder{height:100vh;display:flex;flex-direction:column;overflow:hidden}',
    'body.onder .header{position:static;flex:0 0 auto}',
    'body.onder .content{flex:1;min-height:0;padding:0 14px}',
    'body.onder .kolommen{display:grid;grid-template-columns:minmax(260px,1fr) minmax(300px,2fr);gap:16px;height:100%}',
    'body.onder .kol{overflow:auto;min-height:0;padding:6px 2px 10px}',
    'body.onder .kol-order,body.onder .kol-inst{border-left:1px solid #DDDDDD;padding-left:16px}',
    'body.onder.inst .kol-order{border-left:0;padding-left:2px}',
    /* Instellingen alleen via het tandwiel; ze nemen dan de plek van de wachtrij in. */
    '.kol-inst{display:none}',
    'body.inst .kol-inst{display:block}',
    'body.inst .kol-wachtrij{display:none}',
    '.toggle-btn.aan{background:#fff;color:#0090e3}',
    '#tandwiel{font-size:17px;line-height:24px}',
    'body.onder .version-bar{display:none}',
    '#hoogte{display:none}',
    'body.onder #hoogte{display:inline-block}',
    'body.onder.dicht .content{display:none}',
    /* In de lage balk moeten de knoppen boven de vouw staan: eerst knoppen, dan de stappenlijst. */
    /* Instellingen open: wachtrij weg, instellingen breed en in kolommen naast elkaar. */
    'body.onder.inst .kolommen{grid-template-columns:minmax(300px,1fr) 2.6fr}',
    'body.onder.inst details[open]{columns:4 200px;column-gap:18px;column-rule:1px solid #DDDDDD}',
    'body.onder.inst details:not([open]){display:inline-block;margin-right:18px}',
    'body.onder.inst details:not([open]) > summary{margin-top:4px}',
    'body.onder.inst details[open] > summary{column-span:all;margin:4px 0 6px;font-weight:600}',
    'body.onder.inst details[open] > *{break-inside:avoid}',
    'body.onder.inst .groep > label:first-child{margin-top:0}',
    '.groep{margin-bottom:6px}',
    '.log-lijst{font-size:11px;margin-top:6px;max-height:220px;overflow:auto;line-height:1.5}',
    '.log-lijst .log-rij{display:flex;gap:8px;border-bottom:1px solid #eee;padding:2px 0}',
    '.log-lijst .log-rij span:first-child{color:#999;flex:0 0 72px}',
    '.log-hint{font-size:11px;margin:6px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    'body.onder.inst details[open] > label{break-after:avoid;margin-top:4px}',
    'body.onder.inst details[open] > .info-box{margin-top:0}',
    '.stap-kop{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;margin:4px 0 6px}',
    '.stap-kop b{color:#285dab;font-size:13px}',
    '.strook{display:flex;gap:3px}',
    '.seg{flex:1;text-align:center;font-size:11px;padding:3px 0;border-radius:4px;background:#F3F3F3;color:#999999;cursor:default}',
    '.seg.gedaan{background:#d4edda;color:#155724}',
    '.seg.nu{background:#0090e3;color:#fff;font-weight:700}',
    '.nu-regel{font-size:15px;font-weight:700;color:#285dab;margin-top:7px}',
    '.daarna{font-size:12px;color:#999999;margin-top:1px}',
    '.hint{font-size:11px;color:#856404;margin-top:3px}',
    '.stap-knoppen{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.stap-knoppen .submit-btn{flex:3 1 220px}',
    '.stap-knoppen .auto-knop{flex:1 1 120px}',
    /* Aan de zijkant: smalle kopbalk, eigen schuifvak voor de orders. */
    'body:not(.onder) #kopstatus{display:none}',
    'body:not(.onder) .header{gap:5px;padding-left:12px}',
    'body:not(.onder) .header .titel{flex:1}',
    /* Versie in de kopbalk onderin (daar is de grijze versiestrook weg); aan de zijkant staat hij onderaan. */
    '.kop-versie{font-size:11px;opacity:.75;margin-left:-3px}',
    'body:not(.onder) .kop-versie{display:none}',
    '.kop-label{font-size:12px;opacity:.9;margin-right:-4px}',
    'body:not(.onder) .kop-label{display:none}',
    '.header .toggle-btn,.kop-stop,.kop-pauze{flex-shrink:0}',
    'body:not(.onder) .orderlijst{max-height:190px;overflow:auto}',
    '.kop-tempo{height:24px;width:auto;border:0;border-radius:4px;padding:0 4px;font-size:12px;background:rgba(255,255,255,.18);color:#fff;cursor:pointer}',
    '.kop-tempo option{color:#333333}',
    '.foutblok{background:#fff0f0;border:1px solid #E50000;color:#E50000;border-radius:6px;padding:7px 9px;font-size:12px;margin-top:6px}',
    '.pill-rood{display:inline-block;background:#fff0f0;color:#E50000;border-radius:4px;padding:1px 5px;font-size:11px;margin-top:3px}',
    '.kop-pauze{display:none;background:#ffc107;border:0;color:#333333;border-radius:4px;height:24px;padding:0 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
    'body.auto .kop-pauze{display:inline-block}',
    'body:not(.onder) .kop-pauze .lbl{display:none}',
    'body:not(.onder) .kop-pauze{padding:0 7px}',
    '.pauzerij{display:flex;gap:6px;align-items:center;font-size:11px;margin-bottom:3px}',
    '.pauzerij span{flex:1;min-width:0}',
    '.pauzerij input{flex:0 0 70px;width:70px;padding:3px 5px;font-size:11px;text-align:right}',
    '.foutblok .uitleg{margin-top:4px;font-size:11px}',
    '.foutblok .rij input{flex:0 0 130px;width:130px;padding:4px 6px;font-size:12px}',
    '.foutblok .submit-btn{flex:2;padding:6px 8px}',
    '.pauzeblok{background:#fff8e1;border:1px solid #ffc107;color:#856404;border-radius:6px;padding:7px 9px;font-size:12px;margin-top:6px}',
    '.kop-stop{background:#E50000;border:0;color:#fff;border-radius:4px;height:24px;padding:0 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}'
  ].join('');

  var HTML = '<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>' +
    '<div class="header"><span class="titel">Vanessa</span><span class="kop-versie">v' + VERSIE + '</span><span id="kopstatus"></span>' +
    '<span class="kop-label">Tempo</span><select class="kop-tempo" id="tempo" title="Tempo: hoe lang de tool wacht op Vanessa (×3 = drie keer zo lang)"><option value="1">×1</option><option value="1.5">×1,5</option><option value="2">×2</option><option value="3">×3</option></select>' +
    '<button class="kop-pauze" id="pauze-kop" title="Pauzeer de automatische run na de stap die nu loopt">⏸ Pauze</button>' +
    '<button class="kop-stop" id="stop-kop" title="Stop wat er nu loopt">Stop</button>' +
    '<button class="toggle-btn" id="tandwiel" title="Instellingen: losse stappen, klikreeksen, schermprofielen">⚙</button>' +
    '<button class="toggle-btn" id="hoogte" title="Lagere of hogere balk">↕</button>' +
    '<button class="toggle-btn" id="kant" title="Positie: onder, rechts, links">⇆</button>' +
    '<button class="toggle-btn" id="vouw" title="In-/uitklappen">–</button>' +
    '<button class="toggle-btn" id="sluit" title="Sluiten">×</button></div>' +
    '<div class="content"><div class="kolommen"><div class="kol kol-wachtrij">' +
    '<div class="section-label" style="border:0;margin-top:6px;padding-top:0">Wachtrij</div>' +
    '<textarea id="plak" placeholder="Plak hier rijen uit het tabblad Orders (hele rijen, of met kopregel)"></textarea>' +
    '<div id="wachtrij"></div>' +
    '</div><div class="kol kol-order">' +
    '<div id="stapper"></div>' +
    '<div id="status"></div>' +
    '</div><div class="kol kol-inst">' +
    '<details id="losse"><summary>Losse stappen (handmatig)</summary>' +
    '<div class="info-box">Voor herstel: elke knop doet alleen zijn eigen stap. Zet in Vanessa eerst zelf de cursor goed. Klik of typ <b>niet in Vanessa terwijl een stap loopt</b>, dan stopt hij.</div>' +
    '<label>1 · Klant</label><div class="rij"><input id="klant" inputmode="numeric" placeholder="klantnummer"><button class="ux-btn" id="b-klant">Zoek</button></div>' +
    '<label>2 · Order</label><div class="rij"><button class="ux-btn" id="b-make">Make</button></div>' +
    '<label>3 · Na Make</label><div class="rij"><button class="ux-btn" id="b-insert">Ctrl+Shift+Insert</button></div>' +
    '<label>4 · Artikel</label><div class="rij" id="art-knoppen"></div><div class="rij"><input id="artikel" inputmode="numeric" placeholder="ander artikel"><button class="ux-btn" id="b-artikel">Typ</button></div>' +
    '<label>5 · Prijs</label><div class="rij" id="prijs-knoppen"></div><div class="rij"><input id="prijs" placeholder="andere prijs, bijv. 104,95"><button class="ux-btn" id="b-prijs">Typ</button></div>' +
    '<label>6 · Annotatie</label><div class="rij"><button class="ux-btn" id="b-betaald">Betaald</button><button class="ux-btn" id="b-niet">Niet betaald</button></div>' +
    '</details>' +
    '<details id="reeksen"><summary>Klikreeksen (navigeren tussen orders)</summary>' +
    '<div class="groep"><label>Reeks</label><div class="rij"><select id="reeks-naam"></select><input id="reeks-nieuw" placeholder="of nieuwe naam"></div>' +
    '<div class="rij"><button class="ux-btn" id="b-opname">● Opnemen</button><button class="ux-btn" id="b-speel">▶ Afspelen</button></div>' +
    '<div class="rij"><button class="ux-btn" id="b-markers">Toon posities</button><button class="ux-btn klein" id="b-wisreeks">Wis reeks</button></div>' +
    '<div class="gedempt" id="reeksinfo"></div>' +
    '<div class="rij" style="margin-top:5px"><button class="ux-btn" id="b-pauzes">Pauzes aanpassen</button></div>' +
    '<div id="pauzes" style="display:none"></div></div>' +
    '<div class="groep"><label>Schermprofiel</label><div class="rij"><select id="profiel"></select></div>' +
    '<div class="rij"><input id="profiel-naam" placeholder="naam, bijv. Laptop of Monitor"><button class="ux-btn klein" id="b-profielnaam">Bewaar naam</button></div>' +
    '<div class="gedempt" id="profielinfo"></div>' +
    '<div class="rij" id="oud-rij" style="display:none;margin-top:5px"><button class="ux-btn" id="b-koppel">Eerdere opnames horen bij dit profiel</button></div></div>' +
    '<div class="groep"><label>Delen en back-up</label><div class="rij"><button class="ux-btn" id="b-export">Exporteer alle profielen</button><button class="ux-btn" id="b-import">Importeer</button></div>' +
    '<textarea id="reeks-import" style="display:none" placeholder="Plak hier een export van een collega (Cmd+V)"></textarea></div>' +
    '<div class="info-box">Opnemen: druk <b>Opnemen</b>, doe het zelf in Vanessa, druk <b>Stop opname</b>. Typ daarbij geen klantgegevens.<br>' +
    'Volgende actie gebruikt <b>ordernummer</b> (stap 7: dubbelklik in Order nr, Cmd+C) en <b>afsluiten</b> (stap 8).</div>' +
    '</details>' +
    '<details id="logboek"><summary>Logboek ordernummers</summary>' +
    '<div class="info-box">Elk ordernummer dat de tool leest of dat je invult, wordt hier bewaard (' + LOG_DAGEN + ' dagen, alleen RepairID en ordernummer). ' +
    'Loopt de tool vast: open hem opnieuw en plak dezelfde rijen; wat al gemaakt is, krijgt zijn nummer terug en staat op klaar. Of kopieer de lijst hieronder.</div>' +
    '<div class="rij" style="margin-top:6px"><button class="ux-btn" id="b-logkopie">Kopieer (RepairID, ordernummer, tijd)</button><button class="ux-btn klein" id="b-logwis">Wis logboek</button></div>' +
    '<div id="log-lijst" class="log-lijst"></div>' +
    '</details>' +
    '</div></div></div><div class="version-bar">v' + VERSIE + '</div></body></html>';

  /* Onder: volle breedte tegen de onderrand. Rechts/links: smalle kolom zoals voorheen. */
  function plaats(f, kant) {
    if (KANTEN.indexOf(kant) < 0) kant = 'onder';
    f.setAttribute('data-kant', kant);
    var s = f.style;
    if (kant === 'onder') {
      s.top = ''; s.bottom = '0'; s.left = '8px'; s.right = ''; s.width = 'calc(100% - 16px)';
      s.borderRadius = '10px 10px 0 0';
    } else {
      s.top = '70px'; s.bottom = ''; s.width = '340px'; s.borderRadius = '10px';
      s.left = kant === 'links' ? '16px' : ''; s.right = kant === 'links' ? '' : '16px';
    }
    var body = f.contentDocument && f.contentDocument.body;
    if (body) body.classList.toggle('onder', kant === 'onder');
  }

  function maatPaneel(f) {
    var d = f.contentDocument;
    var dicht = d.body.classList.contains('dicht');
    var kop = d.querySelector('.header').offsetHeight;
    if (f.getAttribute('data-kant') === 'onder') {
      f.style.height = (dicht ? kop : Math.min(parseInt(lees(KEY_HOOGTE, HOOGTES[0]), 10) || HOOGTES[0], W.innerHeight - 40)) + 'px';
      return;
    }
    var h = dicht ? kop : d.documentElement.scrollHeight;
    f.style.height = Math.min(h, W.innerHeight - 90) + 'px';
  }

  /* ---------- klik-test ---------- */

  /* Muisklik op een punt, als fractie van het element (overleeft een ander venstermaat).
     detail 2 = tweede klik van een dubbelklik. */
  function klikOp(pos, detail) {
    detail = detail || 1;
    var el = pos.el;
    if (!el || !el.isConnected) throw new Error('het doel-element bestaat niet meer, leg de positie opnieuw vast');
    var r = el.getBoundingClientRect();
    var x = r.left + pos.fx * r.width, y = r.top + pos.fy * r.height;
    var basis = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, detail: detail, view: W };
    var P = W.PointerEvent || W.MouseEvent;
    function ev(Soort, type, extra) { el.dispatchEvent(new Soort(type, Object.assign({}, basis, extra))); }
    ev(P, 'pointermove', { buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
    ev(W.MouseEvent, 'mousemove', { buttons: 0 });
    ev(P, 'pointerdown', { buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true });
    ev(W.MouseEvent, 'mousedown', { buttons: 1 });
    ev(P, 'pointerup', { buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
    ev(W.MouseEvent, 'mouseup', { buttons: 0 });
    ev(W.MouseEvent, 'click', { buttons: 0 });
    if (detail === 2) ev(W.MouseEvent, 'dblclick', { buttons: 0 });
  }

  function openPaneel() {
    var bestaand = document.getElementById(PANEEL_ID);
    if (bestaand && bestaand.getAttribute('data-versie') !== VERSIE) {
      /* Paneel van een oudere versie: weg, en opnieuw opbouwen. */
      bestaand.remove();
      bestaand = null;
    }
    if (bestaand) {
      /* Tweede klik op de bookmarklet: tonen of verbergen. */
      bestaand.style.display = bestaand.style.display === 'none' ? '' : 'none';
      return;
    }

    var f = document.createElement('iframe');
    f.id = PANEEL_ID;
    f.setAttribute('data-versie', VERSIE);
    f.style.cssText = 'position:fixed;top:70px;width:340px;height:200px;border:0;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.28);z-index:2147483647;background:#fff;color-scheme:light';
    try { localStorage.removeItem(KEY_KANT_OUD); } catch (e) { /* niet erg */ }
    plaats(f, lees(KEY_KANT, 'onder'));
    document.body.appendChild(f);

    var d = f.contentDocument;
    d.open(); d.write(HTML); d.close();
    plaats(f, f.getAttribute('data-kant'));

    var $ = function (id) { return d.getElementById(id); };
    var alleKnoppen = [];

    if (lees(KEY_DICHT, '0') === '1') d.body.classList.add('dicht');
    maatPaneel(f);

    $('vouw').onclick = function () {
      var dicht = d.body.classList.toggle('dicht');
      bewaar(KEY_DICHT, dicht ? '1' : '0');
      maatPaneel(f);
    };
    $('kant').onclick = function () {
      var kant = KANTEN[(KANTEN.indexOf(f.getAttribute('data-kant')) + 1) % KANTEN.length];
      bewaar(KEY_KANT, kant);
      plaats(f, kant);
      maatPaneel(f);
    };
    $('hoogte').onclick = function () {
      var nu = parseInt(lees(KEY_HOOGTE, HOOGTES[0]), 10);
      bewaar(KEY_HOOGTE, nu === HOOGTES[0] ? HOOGTES[1] : HOOGTES[0]);
      d.body.classList.remove('dicht');
      bewaar(KEY_DICHT, '0');
      maatPaneel(f);
    };
    /* De wachtrij staat in vo, dus sluiten en opnieuw openen verliest hem niet. */
    $('sluit').onclick = function () { vo.ui = null; f.remove(); };
    /*
     * Instellingen achter het tandwiel. Open: ze nemen de plek van de wachtrij in,
     * één sectie tegelijk, en de laatst gebruikte gaat vanzelf open.
     */
    var secties = d.querySelectorAll('details');
    Array.prototype.forEach.call(secties, function (el) {
      el.addEventListener('toggle', function () {
        if (el.open) {
          Array.prototype.forEach.call(secties, function (ander) { if (ander !== el) ander.open = false; });
          bewaar(KEY_SECTIE, el.id);
        }
        maatPaneel(f);
      });
    });
    $('tandwiel').onclick = function () {
      var open = d.body.classList.toggle('inst');
      $('tandwiel').classList.toggle('aan', open);
      if (open) {
        if (d.body.classList.contains('dicht')) { d.body.classList.remove('dicht'); bewaar(KEY_DICHT, '0'); }
        var laatst = $(lees(KEY_SECTIE, 'reeksen')) || $('reeksen');
        if (!Array.prototype.some.call(secties, function (x) { return x.open; })) laatst.open = true;
      }
      maatPaneel(f);
    };

    $('tempo').value = String(parseFloat(lees(KEY_TEMPO, '1.5')) || 1.5);
    $('tempo').onchange = function () { bewaar(KEY_TEMPO, parseFloat($('tempo').value)); };

    function bezigKnoppen(aan) {
      alleKnoppen.forEach(function (b) { b.disabled = aan; });
      Array.prototype.forEach.call(d.querySelectorAll('.stap-knop'), function (b) { b.disabled = aan; });
    }

    vo.ui = {
      status: function (tekst, soort) {
        if (!f.isConnected) return;
        var s = $('status');
        s.className = soort || 'bezig';
        s.textContent = tekst;
        $('kopstatus').textContent = tekst;
        bezigKnoppen(vo.bezig || vo.leest || vo.auto);
        maatPaneel(f);
      }
    };

    /* maakBlok() geeft een stappenlijst, of een string met een foutmelding. */
    function koppel(knop, maakBlok) {
      alleKnoppen.push(knop);
      knop.onclick = function () {
        if (vo.bezig) return;
        var plan = maakBlok();
        if (typeof plan === 'string') return vo.ui.status(plan, 'fout');
        try { controleerPlan(plan); } catch (e) { return vo.ui.status(e.message, 'fout'); }
        var tempo = parseFloat($('tempo').value) || 1.5;
        bezigKnoppen(true);
        vo.ui.status('Bezig, ongeveer ' + Math.max(1, Math.round(duurMs(plan, tempo) / 1000)) + ' s…', 'bezig');
        voerUit(plan, tempo).then(function () { bezigKnoppen(false); });
      };
    }

    koppel($('b-klant'), function () {
      var nr = $('klant').value.replace(/\D/g, '');
      return nr ? blokKlant(nr) : 'Vul een klantnummer in.';
    });
    koppel($('b-make'), blokMake);
    koppel($('b-insert'), blokInsert);

    ARTIKELEN.forEach(function (a) {
      var b = d.createElement('button');
      b.className = 'ux-btn'; b.textContent = a; b.setAttribute('data-art', a);
      $('art-knoppen').appendChild(b);
      koppel(b, function () { return blokArtikel(a); });
    });
    koppel($('b-artikel'), function () {
      var a = $('artikel').value.replace(/\D/g, '');
      return a ? blokArtikel(a) : 'Vul een artikelnummer in.';
    });

    PRIJZEN.forEach(function (p) {
      var b = d.createElement('button');
      b.className = 'ux-btn'; b.textContent = p;
      $('prijs-knoppen').appendChild(b);
      koppel(b, function () { return blokPrijs(p); });
    });
    koppel($('b-prijs'), function () {
      var p = normPrijs($('prijs').value);
      if (!p) return 'Vul een geldige prijs in.';
      $('prijs').value = p;
      return blokPrijs(p);
    });

    koppel($('b-betaald'), function () { return blokAnnotatie(true); });
    koppel($('b-niet'), function () { return blokAnnotatie(false); });

    $('stop-kop').onclick = function () { vo.stop = true; vo.auto = false; vo.pauze = false; vo.reden = 'gestopt met de knop'; toonPauze(); };

    /*
     * Pauze (voor een binnenkomend gesprek): de stap die loopt maakt hij af,
     * daarna wacht de automatische run tot Hervat. Stop blijft werken.
     */
    function toonPauze() {
      d.body.classList.toggle('auto', !!vo.auto);
      $('pauze-kop').innerHTML = vo.pauze ? '▶<span class="lbl"> Hervat</span>' : '⏸<span class="lbl"> Pauze</span>';
      $('pauze-kop').title = vo.pauze ? 'Verder met de automatische run' : 'Pauzeer de automatische run na de stap die nu loopt';
    }
    $('pauze-kop').onclick = function () {
      if (!vo.auto) return;
      vo.pauze = !vo.pauze;
      toonPauze();
      toonStapper();
      if (vo.pauze) vo.ui.status(vo.bezig || vo.leest ? 'Pauze: de stap die nu loopt wordt eerst afgemaakt…' : 'Gepauzeerd.', 'bezig');
    };

    /* ----- wachtrij ----- */

    function zetHuidig(o) {
      vo.huidig = o ? o.nr : null;
      if (o) {
        $('klant').value = o.klant;
        $('artikel').value = o.artikel;
        $('prijs').value = o.prijs;
      }
      Array.prototype.forEach.call(d.querySelectorAll('[data-art]'), function (b) {
        b.classList.toggle('selected', !!o && b.getAttribute('data-art') === o.artikel);
      });
      $('b-betaald').classList.toggle('selected', !!o && o.betaald);
      $('b-niet').classList.toggle('selected', !!o && !o.betaald);
      toonWachtrij();
      toonStapper();
    }

    function huidigeOrder() {
      return vo.wachtrij && vo.wachtrij.orders.filter(function (o) { return o.nr === vo.huidig; })[0];
    }

    function volgendeOpen(o) {
      var w = vo.wachtrij.orders;
      return w.filter(function (x) { return !x.klaar && x.nr > o.nr; })[0] || w.filter(function (x) { return !x.klaar; })[0] || null;
    }

    /* Melding wegklikken (Enter = OK), order als overgeslagen markeren, door naar de volgende. */
    function slaOrderOver(o) {
      if (vo.bezig || vo.leest) return;
      var reden = o.fout ? o.fout.tekst : 'overgeslagen';
      bezigKnoppen(true);
      var tempo = parseFloat($('tempo').value) || 1.5;
      /* Alleen OK drukken als de melding er nog staat: anders landt de Enter in Vanessa. */
      (o.fout && !o.fout.gestopt ? controleerDialoog(tempo) : Promise.resolve(null)).then(function (open) {
        return open === null ? true : voerUit(reeks(L('Melding sluiten'), K('Enter')), tempo);
      }).then(function () {
        o.overgeslagen = reden;
        o.fout = null;
        o.klaar = true;
        var v = volgendeOpen(o);
        bezigKnoppen(false);
        zetHuidig(v);
        vo.ui.status('Order ' + (vo.wachtrij.orders.indexOf(o) + 1) + ' overgeslagen (' + reden + '). Controleer dat de cursor in Customer nr staat' +
          (v ? ' en ga verder met de volgende order.' : '.'), 'ok');
      });
    }

    /* Order af: markeren en door naar de volgende open order. */
    function rondAf(o) {
      o.klaar = true;
      o.stap = STAPPEN.length;
      var v = volgendeOpen(o);
      zetHuidig(v);
      vo.ui.status(v ? 'Order ' + o.nr + ' klaar. Volgende: order ' + v.nr + '.' : 'Alle orders in de wachtrij zijn klaar. Kopieer nu kolom G.', 'ok');
    }

    /* Handmatig: altijd, of een klikreeks-stap waarvan de reeks nog niet is opgenomen. */
    function zelfStap(st) { return st.handmatig || (st.reeks && !reeksPlan(st.reeks)); }

    /*
     * Huidige order, gebouwd voor de breedte: één regel met de order, een
     * voortgangsstrook van acht blokjes, groot wat nu komt en klein wat daarna
     * komt, en alle knoppen op één rij.
     */
    function stapNaam(st, o) {
      return st.label(o) + (zelfStap(st) ? ' (zelf)' : st.reeks ? ' (klikreeks)' : '');
    }

    function toonStapper() {
      var box = $('stapper');
      box.innerHTML = '';
      var o = huidigeOrder();
      if (!o) { maatPaneel(f); return; }
      o.stap = o.stap || 0;
      logOrders([o]);
      var orders = vo.wachtrij.orders;
      var st = STAPPEN[o.stap];
      var vast = vo.bezig || vo.leest || vo.auto;
      var geblokt = vast || !!o.fout;

      var kop = d.createElement('div');
      kop.className = 'stap-kop';
      kop.innerHTML = '<b>Order ' + (orders.indexOf(o) + 1) + ' van ' + orders.length + '</b>' +
        '<span>klant ' + o.klant + ' · ' + o.artikel + ' · € ' + o.prijs + '</span>' +
        '<span class="' + (o.betaald ? 'pill-green">Betaald' : 'pill-amber">Niet betaald') + '</span>';
      box.appendChild(kop);

      var strook = d.createElement('div');
      strook.className = 'strook';
      STAPPEN.forEach(function (s, i) {
        var seg = d.createElement('span');
        seg.className = 'seg' + (i < o.stap ? ' gedaan' : i === o.stap ? ' nu' : '');
        seg.textContent = (i < o.stap ? '✓ ' : '') + (i + 1);
        seg.title = (i + 1) + '. ' + stapNaam(s, o);
        strook.appendChild(seg);
      });
      box.appendChild(strook);

      var nu = d.createElement('div');
      nu.className = 'nu-regel';
      nu.textContent = st ? 'Nu: ' + (o.stap + 1) + '. ' + stapNaam(st, o) : 'Alle stappen gedaan';
      box.appendChild(nu);

      var volgendeSt = STAPPEN[o.stap + 1];
      var na = d.createElement('div');
      na.className = 'daarna';
      if (volgendeSt) na.textContent = 'Daarna: ' + (o.stap + 2) + '. ' + stapNaam(volgendeSt, o);
      else {
        var v = volgendeOpen(o);
        na.textContent = v && v !== o ? 'Daarna: order ' + (orders.indexOf(v) + 1) + ' (klant ' + v.klant + ')' : 'Daarna: wachtrij klaar';
      }
      box.appendChild(na);

      if (o.fout) box.appendChild(herstelBlok(o, st, vast));

      if (st && st.eerst && (zelfStap(st) || !st.reeks)) {
        var hint = d.createElement('div');
        hint.className = 'hint';
        hint.textContent = 'Eerst: ' + st.eerst;
        box.appendChild(hint);
      }

      var rij = d.createElement('div'); rij.className = 'stap-knoppen';
      function knop(cls, tekst, titel, uit, klik) {
        var b = d.createElement('button');
        b.className = cls + ' stap-knop'; b.textContent = tekst; b.title = titel || '';
        b.disabled = uit; b.onclick = klik;
        rij.appendChild(b);
        return b;
      }
      knop('ux-btn klein', '← Terug', 'Een stap terug', vast || o.stap === 0, function () { o.stap = Math.max(0, o.stap - 1); toonStapper(); });
      knop('submit-btn', st ? (zelfStap(st) ? 'Gedaan: ' : 'Volgende: ') + st.label(o) : 'Order afronden →', '', geblokt, function () { voerStapUit(o); });
      knop('ux-btn klein', 'Overslaan', 'Deze stap niet uitvoeren en door naar de volgende', geblokt || !st, function () { o.stap++; toonStapper(); });
      if (AUTOMATISCH_AAN) {
        knop('ux-btn auto-knop', '▶▶ Hele order', 'Alle stappen van deze order achter elkaar, daarna stoppen', geblokt, function () { automatisch(false); });
        knop('ux-btn auto-knop', '▶▶ Alle orders', 'Doorgaan tot de wachtrij leeg is', geblokt, function () { automatisch(true); });
      }
      box.appendChild(rij);

      if (vo.auto && vo.pauze) {
        var pb = d.createElement('div'); pb.className = 'pauzeblok';
        pb.innerHTML = '<b>Gepauzeerd.</b> Je mag nu in Vanessa werken. Zet het vóór <b>▶ Hervat</b> terug zoals het was: ' +
          'zelfde scherm, cursor op dezelfde plek' + (st ? ', klaar voor stap ' + (o.stap + 1) + ' (' + st.label(o) + ')' : '') + '.';
        box.appendChild(pb);
      } else if (vo.auto) {
        var loopt = d.createElement('div'); loopt.className = 'gedempt'; loopt.style.marginTop = '4px';
        loopt.textContent = 'Automatisch bezig. Niet klikken of typen in Vanessa; Pauze en Stop staan in de blauwe balk.';
        box.appendChild(loopt);
      }
      maatPaneel(f);
    }

    /*
     * Na een melding of stop: de gebruiker lost het in Vanessa op en kiest hoe het
     * verder gaat. Liep er een automatische run, dan gaat die daarna vanzelf door
     * (zelfde stand: hele order of alle orders).
     */
    function herstelBlok(o, st, vast) {
      var fb = d.createElement('div');
      fb.className = 'foutblok';
      var n = o.stap + 1, auto = o.fout.auto;
      fb.innerHTML = o.fout.gestopt ? '<b>Gestopt bij stap ' + n + ':</b> ' : '<b>Vanessa meldt bij stap ' + n + ':</b> ';
      fb.appendChild(d.createTextNode(o.fout.tekst));
      var laatste = o.stap >= STAPPEN.length - 1;
      var verder = laatste ? (auto === 'alles' ? 'verder met de volgende order' : 'order afronden') : 'verder met stap ' + (n + 1);
      var uitleg = d.createElement('div'); uitleg.className = 'uitleg';
      uitleg.textContent = (o.fout.gestopt ? 'Kijk in Vanessa hoe ver stap ' + n + ' kwam. ' : 'Los het op in Vanessa (de melding mag je zelf sluiten). ') +
        'Kies dan:' + (auto ? ' de automatische run gaat daarna vanzelf verder.' : '');
      fb.appendChild(uitleg);
      var fr = d.createElement('div'); fr.className = 'rij'; fr.style.marginTop = '6px'; fr.style.flexWrap = 'wrap';
      var nrInp = null;
      if (st && st.kopieer && !o.ordernummer) {
        nrInp = d.createElement('input'); nrInp.placeholder = 'ordernummer'; nrInp.inputMode = 'numeric';
        nrInp.title = 'Kopieer het ordernummer zelf uit Vanessa en plak het hier';
        fr.appendChild(nrInp);
      }
      function knop(cls, tekst, titel, klik) {
        var b = d.createElement('button'); b.className = cls + ' stap-knop'; b.textContent = tekst; b.title = titel;
        b.disabled = vast; b.onclick = klik; fr.appendChild(b);
      }
      knop('submit-btn', '✓ Stap ' + n + ' zelf gedaan, ' + (auto ? '▶▶ ' : '') + verder,
        'Je hebt stap ' + n + ' (' + (st ? st.label(o) : '') + ') zelf in Vanessa afgemaakt; de tool gaat door met wat erna komt',
        function () {
          if (nrInp) {
            var m = cijfers(nrInp.value);
            if (m.length < 8) { nrInp.focus(); return vo.ui.status('Plak eerst het ordernummer (minstens 8 cijfers) in het veld naast de knop.', 'fout'); }
            o.ordernummer = m;
            logOrders([o]);
          }
          hervat(o, true);
        });
      knop('ux-btn', '↻ Stap ' + n + ' opnieuw', 'Stap ' + n + ' nog een keer laten doen door de tool' + (auto ? ', daarna automatisch verder' : ''),
        function () { hervat(o, false); });
      knop('ux-btn', 'Sla deze order over', o.fout.gestopt ? 'Markeert de order als overgeslagen en gaat naar de volgende' :
        'Drukt OK op de melding, markeert de order als overgeslagen en gaat naar de volgende', function () { slaOrderOver(o); });
      fb.appendChild(fr);
      return fb;
    }

    /* Eerst kijken of er nog een melding openstaat; pas dan de stap afvinken en verder. */
    function hervat(o, stapGedaan) {
      if (vo.bezig || vo.leest || vo.auto || !o.fout) return;
      var auto = o.fout.auto, tempo = parseFloat($('tempo').value) || 1.5;
      bezigKnoppen(true);
      vo.ui.status('Eerst kijken of er nog een melding in Vanessa openstaat…', 'bezig');
      slaap(300 * tempo).then(function () { return controleerDialoog(tempo); }).then(function (melding) {
        bezigKnoppen(false);
        if (melding !== null) {
          o.fout = { stap: o.stap, tekst: melding, auto: auto };
          toonStapper();
          return vo.ui.status('Er staat nog een melding open in Vanessa: ' + melding + '. Sluit die eerst.', 'fout');
        }
        o.fout = null;
        verderNaHerstel(o, stapGedaan, auto);
      });
    }

    function verderNaHerstel(o, stapGedaan, auto) {
      if (stapGedaan) {
        o.stap++;
        if (o.stap >= STAPPEN.length) {
          rondAf(o);
          toonWachtrij();
          if (auto !== 'alles') { toonStapper(); return; }
          if (!huidigeOrder()) { toonStapper(); return; }
        }
      }
      toonWachtrij();
      toonStapper();
      if (auto) return automatisch(auto === 'alles');
      if (!stapGedaan) return voerStapUit(o);
      vo.ui.status('Stap ' + o.stap + ' gedaan. Volgende: ' + STAPPEN[o.stap].label(o) + '.', 'ok');
    }

    /* Mislukte stap vastleggen, zodat het herstelblok verschijnt. Een melding van Vanessa staat er al. */
    function markeerFout(o, tekst) {
      if (o.fout) return;
      o.fout = { stap: o.stap, tekst: tekst || 'onbekende reden', gestopt: true };
    }

    /* Voert de huidige stap uit. Geeft altijd een Promise: true als de stap gelukt is. */
    function voerStapUit(o) {
      if (vo.bezig || vo.leest || o.fout) return Promise.resolve(false);
      var st = STAPPEN[o.stap];
      if (!st) { rondAf(o); return Promise.resolve(true); }
      if (zelfStap(st)) {
        if (vo.auto) {
          vo.ui.status('Stap ' + (o.stap + 1) + ' (' + st.label(o) + ') moet je zelf doen; automatisch kan pas als de klikreeks is opgenomen.', 'fout');
          return Promise.resolve(false);
        }
        if (st.kopieer && !o.ordernummer) {
          vo.ui.status('Vul eerst het ordernummer in bij de order hierboven (of druk Overslaan).', 'fout');
          var inp = d.querySelector('.order.huidig input');
          if (inp) inp.focus();
          return Promise.resolve(false);
        }
        o.stap++;
        if (o.stap >= STAPPEN.length) rondAf(o); else toonStapper();
        return Promise.resolve(true);
      }
      /* Vóór het uitvoeren in het logboek: loopt de tool tijdens Make vast, dan weten we dat de order misschien al bestaat. */
      logOrders([o], o.stap);
      if (st.kopieer) return kopieerOrdernummer(o, st);
      var plan = st.reeks ? reeksPlan(st.reeks) : st.plan(o);
      try { controleerPlan(plan); } catch (e) { vo.ui.status(e.message, 'fout'); return Promise.resolve(false); }
      var tempo = parseFloat($('tempo').value) || 1.5;
      bezigKnoppen(true);
      vo.ui.status(st.label(o) + ', ongeveer ' + Math.max(1, Math.round(duurMs(plan, tempo) / 1000)) + ' s…', 'bezig');
      return voerUit(plan, tempo).then(function (gelukt) {
        if (!gelukt) { markeerFout(o, vo.laatsteFout); return false; }
        if (!st.controle) return true;
        return controleerDialoog(tempo).then(function (melding) {
          if (melding === null) return true;
          o.fout = { stap: o.stap, tekst: melding };
          vo.ui.status('Vanessa meldt: ' + melding, 'fout');
          return false;
        });
      }).then(function (gelukt) {
        if (gelukt) o.stap++;
        bezigKnoppen(vo.auto);
        /* Laatste stap gelukt: order meteen afronden, geen extra klik op "afronden". */
        if (gelukt && o.stap >= STAPPEN.length) rondAf(o); else { toonWachtrij(); toonStapper(); }
        return gelukt;
      });
    }

    /*
     * Na een stap: staat er een Vanessa-melding open? Merkteken op het klembord,
     * Cmd+C, en kijken wat er terugkomt. Geeft de meldingstekst, of null als er
     * geen melding is. Kan het klembord niet gelezen worden, dan geldt dat als
     * melding: liever stoppen dan blind doorgaan.
     */
    function controleerDialoog(tempo) {
      var merk = 'vo-controle-' + Date.now();
      vo.leest = true;
      return klembord('writeText', merk).then(function () {
        return voerUit(reeks(L('Controle op meldingen'), K('c', ['meta'])), tempo);
      }).then(function () {
        var pogingen = 0;
        return (function lees() {
          return klembord('readText').then(function (t) {
            if (isDialoog(t)) return dialoogTekst(t);
            if (String(t) === merk && ++pogingen < 5) return slaap(300).then(lees);
            return null;
          });
        })();
      }).catch(function () {
        return 'controle op meldingen niet gelukt (klembord niet bereikbaar). Kijk zelf in Vanessa.';
      }).then(function (uit) { vo.leest = false; return uit; });
    }

    /*
     * Klembord lezen/schrijven mag alleen als het tabblad voorop staat. Eerst via
     * het paneel, anders via de pagina zelf (na een klikreeks heeft die de focus).
     * Lukt geen van beide, dan wachten tot het tabblad voorop komt, max. 60 s.
     */
    function klembord(methode, arg) {
      var bronnen = [f.contentWindow.navigator.clipboard, W.navigator.clipboard].filter(function (c) { return c && c[methode]; });
      if (!bronnen.length) return Promise.reject(new Error('geen klembord'));
      var pogingen = 0;
      function poging() {
        return bronnen[0][methode](arg).catch(function () {
          return bronnen[1] ? bronnen[1][methode](arg) : Promise.reject();
        }).catch(function () {
          if (++pogingen > 200 || vo.stop) return Promise.reject(new Error('focus'));
          vo.ui.status('Wacht op het klembord: zet het AppStream-tabblad voorop.', 'bezig');
          return slaap(300).then(poging);
        });
      }
      return poging();
    }

    /*
     * Ordernummer uit Vanessa via het klembord. AppStream zet wat in Windows
     * gekopieerd wordt op het Mac-klembord (getest, 15-10-2026). Eerst een
     * merkteken op het klembord, zodat een kopie die niet doorkomt niet
     * stilletjes het nummer van de vórige order oplevert.
     */
    function kopieerOrdernummer(o, st) {
      if (o.ordernummer) { o.stap++; toonStapper(); return Promise.resolve(true); }
      var merk = 'vo-wacht-' + Date.now();
      var plan = reeksPlan(st.reeks);
      var tempo = parseFloat($('tempo').value) || 1.5;
      /* Na de klikreeks staat vo.bezig weer uit, maar het lezen loopt nog: knoppen dicht houden. */
      vo.leest = true;
      bezigKnoppen(true);
      vo.ui.status('Ordernummer kopiëren…', 'bezig');

      function klaar(gelukt, melding) {
        vo.leest = false;
        bezigKnoppen(vo.auto);
        toonWachtrij();
        toonStapper();
        vo.ui.status(melding, gelukt ? 'ok' : 'fout');
        return gelukt;
      }
      function mislukt(reden) {
        markeerFout(o, 'ordernummer niet gelezen: ' + reden);
        return klaar(false, 'Ordernummer niet gelezen: ' + reden + ' Kopieer het zelf uit Vanessa en plak het hieronder bij "Stap 7 zelf gedaan".');
      }

      return klembord('writeText', merk).then(function () {
        return voerUit(plan, tempo).then(function (gelukt) {
          if (!gelukt) return mislukt('de klikreeks werd onderbroken.');
          var pogingen = 0;
          return (function lees() {
            return klembord('readText').then(function (t) {
              t = String(t);
              if (isDialoog(t)) {
                o.fout = { stap: o.stap, tekst: dialoogTekst(t) };
                return mislukt('Vanessa toont een melding: ' + dialoogTekst(t) + '.');
              }
              var m = t.match(/\d{8,}/);
              if (t === merk || !m) {
                if (++pogingen < 13) return slaap(300).then(lees);
                return mislukt(t === merk ? 'er kwam niets nieuws op het klembord.' : 'op het klembord staat geen ordernummer (' + t.slice(0, 30) + ').');
              }
              var dubbel = vo.wachtrij.orders.filter(function (x) { return x !== o && x.ordernummer === m[0]; })[0];
              if (dubbel) return mislukt(m[0] + ' is al het ordernummer van order ' + dubbel.nr + '.');
              var log = leesLog(), ander = Object.keys(log).filter(function (r) { return r !== o.repair && log[r].n === m[0]; })[0];
              if (ander) return mislukt(m[0] + ' staat in het logboek al bij repair ' + ander + ' (' + logTijd(log[ander].u) + ').');
              o.ordernummer = m[0];
              o.stap++;
              logOrders([o]);
              return klaar(true, 'Ordernummer ' + m[0] + ' gelezen.');
            });
          })();
        });
      }).catch(function () {
        return mislukt('het klembord was niet bereikbaar (sta klembordtoegang toe en zet het AppStream-tabblad voorop).');
      });
    }

    /*
     * Automatisch: stap na stap, met een pauze ertussen. Stopt bij de eerste stap
     * die niet lukt; de order blijft dan op die stap staan, zodat de gebruiker
     * kan herstellen en verder kan.
     */
    function automatisch(alles) {
      if (vo.bezig || vo.leest || vo.auto) return;
      var mist = ['ordernummer', 'afsluiten'].filter(function (n) { return !reeksPlan(n); });
      if (mist.length) return vo.ui.status('Neem eerst de klikreeks(en) op: ' + mist.join(', ') + '.', 'fout');
      var start = huidigeOrder();
      if (!start) return vo.ui.status('Kies eerst een order in de wachtrij.', 'fout');
      if (start.fout) return vo.ui.status('Kies eerst hoe het verder moet bij de melding van deze order.', 'fout');
      vo.auto = true;
      vo.autoAlles = alles;
      vo.stop = false;
      vo.pauze = false;
      toonPauze();
      bezigKnoppen(true);
      toonStapper();
      var tempo = function () { return parseFloat($('tempo').value) || 1.5; };

      function eind(melding, soort) {
        vo.auto = false;
        vo.pauze = false;
        toonPauze();
        bezigKnoppen(false);
        toonStapper();
        if (melding) vo.ui.status(melding, soort);
      }

      function lus() {
        if (!vo.auto || vo.stop) return eind('Automatisch gestopt. Druk opnieuw om verder te gaan vanaf deze stap.', 'fout');
        if (vo.pauze) {
          var p = huidigeOrder();
          vo.ui.status('Gepauzeerd' + (p ? ' vóór stap ' + (p.stap + 1) + ' van order ' + (vo.wachtrij.orders.indexOf(p) + 1) : '') +
            '. Druk ▶ Hervat als je klaar bent.', 'bezig');
          return (function wacht() {
            if (!vo.auto || vo.stop) return lus();
            if (vo.pauze) return slaap(300).then(wacht);
            vo.ui.status('Hervat. Over een paar seconden verder.', 'bezig');
            return slaap(2000 * tempo()).then(lus);
          })();
        }
        var o = huidigeOrder();
        if (!o) return eind('Alle orders in de wachtrij zijn klaar. Kopieer nu kolom G.', 'ok');
        voerStapUit(o).then(function (gelukt) {
          if (!gelukt) {
            if (o.fout) o.fout.auto = alles ? 'alles' : 'order';
            return eind(null);
          }
          if (o.klaar && (!alles || !huidigeOrder())) {
            return eind(huidigeOrder() ? 'Order ' + o.nr + ' klaar (ordernummer ' + o.ordernummer + '). Volgende staat klaar.' :
              'Alle orders in de wachtrij zijn klaar. Kopieer nu kolom G.', 'ok');
          }
          return slaap(TUSSEN_STAP_MS * tempo()).then(lus);
        });
      }
      lus();
    }

    function kolomG() {
      return vo.wachtrij.regels.map(function (r) {
        return r.order && r.order.ordernummer ? r.order.ordernummer : r.bestaandG;
      }).join('\n');
    }

    function kopieer(tekst, melding) {
      var klaar = function () { vo.ui.status(melding, 'ok'); };
      var terug = function () {
        var t = d.createElement('textarea'); t.value = tekst; d.body.appendChild(t); t.select();
        try { d.execCommand('copy'); klaar(); } catch (e) { vo.ui.status('Kopiëren lukte niet.', 'fout'); }
        t.remove();
      };
      if (f.contentWindow.navigator.clipboard) f.contentWindow.navigator.clipboard.writeText(tekst).then(klaar, terug);
      else terug();
    }

    function toonWachtrij() {
      var w = vo.wachtrij, box = $('wachtrij');
      box.innerHTML = '';
      if (!w) { toonLogHint(box); maatPaneel(f); return; }
      logOrders(w.orders);
      var klaar = w.orders.filter(function (o) { return o.klaar; }).length;
      var kop = d.createElement('div');
      kop.className = 'gedempt';
      kop.style.margin = '6px 0';
      kop.textContent = w.orders.length + ' orders · ' + klaar + ' klaar' +
        (w.overgeslagen.length ? ' · ' + w.overgeslagen.length + ' overgeslagen' : '');
      box.appendChild(kop);

      var lijst = d.createElement('div');
      lijst.className = 'orderlijst';
      box.appendChild(lijst);
      w.orders.forEach(function (o) {
        var div = d.createElement('div');
        div.className = 'order' + (o.nr === vo.huidig ? ' huidig' : '') + (o.klaar ? ' klaar' : '');
        div.innerHTML = '<div class="kop"><b>' + o.nr + '</b><span style="flex:1">klant ' + o.klant + ' · ' + o.artikel + ' · € ' + o.prijs + '</span>' +
          '<span class="' + (o.betaald ? 'pill-green">Betaald' : 'pill-amber">Niet betaald') + '</span></div>' +
          '<div class="gedempt">Repair ' + o.repair + (o.klaar && !o.overgeslagen ? ' · klaar' : '') +
          (o.uitLog && o.ordernummer ? ' · uit logboek (' + logTijd(o.uitLog.u) + (o.uitLog.k ? '' : ', sluiten niet bevestigd') + ')' : '') + '</div>' +
          (o.overgeslagen ? '<div class="pill-rood">Overgeslagen: ' + o.overgeslagen.replace(/</g, '&lt;') + '</div>' : '') +
          (o.fout ? '<div class="pill-rood">Melding: ' + o.fout.tekst.replace(/</g, '&lt;') + '</div>' : '') +
          (o.prijsAfwijkend ? '<div class="pill-amber" style="display:inline-block;margin-top:3px">Bedrag uit kolom Q; Sophia (P) was € ' + o.prijsAfwijkend + '</div>' : '');
        div.onclick = function () { zetHuidig(o); };
        if (o.nr === vo.huidig || o.ordernummer) {
          var rij = d.createElement('div'); rij.className = 'rij';
          var inp = d.createElement('input'); inp.placeholder = 'ordernummer uit Vanessa'; inp.value = o.ordernummer;
          inp.onclick = function (e) { e.stopPropagation(); };
          inp.oninput = function () { o.ordernummer = cijfers(inp.value); logOrders([o]); };
          var plak = d.createElement('button'); plak.className = 'ux-btn klein'; plak.textContent = 'Plak';
          plak.title = 'Ordernummer van het klembord';
          plak.onclick = function (e) {
            e.stopPropagation();
            var cb = f.contentWindow.navigator.clipboard;
            if (!cb || !cb.readText) return vo.ui.status('Klembord lezen kan hier niet: plak met Cmd+V in het veld.', 'fout');
            cb.readText().then(function (t) {
              var m = String(t).match(/\d{8,}/);
              if (!m) return vo.ui.status('Geen ordernummer op het klembord (' + String(t).slice(0, 30) + ').', 'fout');
              o.ordernummer = m[0]; inp.value = m[0];
              logOrders([o]);
            }, function () { vo.ui.status('Klembord lezen geweigerd: plak met Cmd+V in het veld.', 'fout'); });
          };
          var vink = d.createElement('button'); vink.className = 'ux-btn klein'; vink.textContent = o.klaar ? 'Heropen' : 'Klaar →';
          vink.onclick = function (e) {
            e.stopPropagation();
            if (!o.klaar) return rondAf(o);
            o.klaar = false;
            o.stap = 0;
            o.overgeslagen = '';
            o.uitLog = null;
            zetHuidig(o);
          };
          rij.appendChild(inp); rij.appendChild(plak); rij.appendChild(vink);
          div.appendChild(rij);
        }
        lijst.appendChild(div);
      });

      if (w.overgeslagen.length) {
        var ov = d.createElement('div'); ov.className = 'overgeslagen';
        var metNr = w.overgeslagen.filter(function (r) { return r.reden === 'heeft al ordernummer'; }).length;
        var rest = w.overgeslagen.filter(function (r) { return r.reden !== 'heeft al ordernummer'; });
        ov.textContent = 'Overgeslagen: ' + [metNr ? metNr + '× heeft al ordernummer' : ''].concat(rest.map(function (r) {
          return (r.repair ? 'repair ' + r.repair : 'regel ' + (r.idx + 1)) + ' (' + r.reden + ')';
        })).filter(Boolean).join(' · ');
        box.appendChild(ov);
      }

      var rij2 = d.createElement('div'); rij2.className = 'rij'; rij2.style.marginTop = '6px';
      var g = d.createElement('button'); g.className = 'ux-btn'; g.textContent = 'Kopieer voor kolom G';
      g.onclick = function () {
        kopieer(kolomG(), 'Gekopieerd: ' + w.regels.length + ' regels. Plak in kolom G op de eerste rij van je plak. ' +
          'Alleen goed als je een aaneengesloten blok plakte (geen verborgen rijen ertussen).');
      };
      var leeg = d.createElement('button'); leeg.className = 'ux-btn klein'; leeg.textContent = 'Wis';
      leeg.onclick = function () {
        var open = w.orders.filter(function (o) { return o.ordernummer; }).length;
        if (open && !f.contentWindow.confirm('Er staan ' + open + ' ordernummers in de wachtrij. Toch wissen?')) return;
        vo.wachtrij = null; vo.huidig = null; zetHuidig(null);
      };
      rij2.appendChild(g); rij2.appendChild(leeg);
      box.appendChild(rij2);
      maatPaneel(f);
      scrollNaarHuidig();
      toonLog();
    }

    /* ----- logboek ----- */

    function logRijen() {
      var l = leesLog();
      return Object.keys(l).map(function (r) { var e = l[r]; e.r = r; return e; })
        .sort(function (a, b) { return b.u - a.u; });
    }

    function toonLog() {
      var box = $('log-lijst');
      if (!box || !$('logboek').open) return;
      box.innerHTML = '';
      var rijen = logRijen();
      if (!rijen.length) { box.innerHTML = '<div class="gedempt">Nog niets in het logboek.</div>'; return; }
      rijen.forEach(function (e) {
        var div = d.createElement('div'); div.className = 'log-rij';
        [logTijd(e.u), 'Repair ' + e.r,
          e.n ? e.n + (e.k ? '' : ' (sluiten niet bevestigd)') :
            'geen ordernummer, tot stap ' + Math.min(e.s + 1, STAPPEN.length) + (e.ov ? ' · ' + e.ov : '')
        ].forEach(function (t, i) {
          var sp = d.createElement('span'); sp.textContent = t;
          if (i === 2 && !e.n) sp.className = 'pill-amber';
          div.appendChild(sp);
        });
        box.appendChild(div);
      });
      maatPaneel(f);
    }

    /* Geen wachtrij (bijv. net opnieuw geopend na vastlopen): wijs op het logboek. */
    function toonLogHint(box) {
      var n = logRijen().filter(function (e) { return e.n; }).length;
      if (!n) return;
      var h = d.createElement('div'); h.className = 'log-hint';
      h.appendChild(d.createTextNode('Logboek: ' + n + ' ordernummer(s) van de laatste ' + LOG_DAGEN + ' dagen. Plak je rijen opnieuw, dan worden ze ingevuld.'));
      var b = d.createElement('button'); b.className = 'ux-btn klein'; b.textContent = 'Toon logboek';
      b.onclick = openLog;
      h.appendChild(b);
      box.appendChild(h);
    }

    function openLog() {
      /* Eerst de sectiekeuze, anders opent het tandwiel de vorige sectie en sluit die (via toggle) het logboek weer. */
      bewaar(KEY_SECTIE, 'logboek');
      if (!d.body.classList.contains('inst')) $('tandwiel').onclick();
      $('logboek').open = true;
      toonLog();
    }

    $('logboek').addEventListener('toggle', toonLog);
    $('b-logkopie').onclick = function () {
      var rijen = logRijen().filter(function (e) { return e.n; });
      if (!rijen.length) return vo.ui.status('Geen ordernummers in het logboek.', 'fout');
      kopieer(['RepairID\tordernummer\ttijd'].concat(rijen.map(function (e) { return e.r + '\t' + e.n + '\t' + logTijd(e.u); })).join('\n'),
        rijen.length + ' ordernummer(s) gekopieerd (met kopregel).');
    };
    $('b-logwis').onclick = function () {
      var n = logRijen().length;
      if (n && !f.contentWindow.confirm('Logboek met ' + n + ' regel(s) wissen? Zet eerst de ordernummers in de sheet.')) return;
      try { localStorage.removeItem(KEY_LOG); } catch (e) { /* niet erg */ }
      toonLog(); toonWachtrij();
    };

    /* De wachtrij schuift mee: de huidige order staat altijd in beeld. */
    function scrollNaarHuidig() {
      var el = d.querySelector('.order.huidig');
      if (!el) return;
      /* Onderin scrollt de kolom; aan de zijkant alleen de orderlijst, zodat de knoppen in beeld blijven. */
      var bak = [el.closest('.orderlijst'), el.closest('.kol')].filter(function (x) {
        return x && x.scrollHeight > x.clientHeight + 1;
      })[0];
      if (!bak) return;
      bak.scrollTop += el.getBoundingClientRect().top - bak.getBoundingClientRect().top - (bak.classList.contains('kol') ? 34 : 4);
    }

    $('plak').addEventListener('paste', function () {
      setTimeout(function () {
        var r = parseWachtrij($('plak').value);
        $('plak').value = '';
        if (r.fout) return vo.ui.status(r.fout, 'fout');
        if (vo.wachtrij && vo.wachtrij.orders.some(function (o) { return o.ordernummer; }) &&
            !f.contentWindow.confirm('De huidige wachtrij heeft al ordernummers. Vervangen?')) return;
        var uitLog = pasLogToe(r.orders);
        vo.wachtrij = {
          orders: r.orders, regels: r.regels,
          overgeslagen: r.regels.map(function (x, i) { x.idx = i; return x; }).filter(function (x) { return x.reden && x.reden !== 'geen RepairID'; })
        };
        var open = r.orders.filter(function (o) { return !o.klaar; });
        vo.ui.status(r.orders.length + ' orders ingelezen' +
          (uitLog.nummers ? '; ' + uitLog.nummers + ' daarvan al gemaakt volgens het logboek (ordernummer ingevuld, staan op klaar)' : '') +
          (uitLog.begonnen ? '; ' + uitLog.begonnen + ' al begonnen zonder ordernummer: controleer die in Vanessa' : '') + '.',
          !r.orders.length || uitLog.begonnen ? 'fout' : 'ok');
        zetHuidig(open[0] || null);
      }, 0);
    });

    if (vo.wachtrij) {
      var huidig = vo.wachtrij.orders.filter(function (o) { return o.nr === vo.huidig; })[0];
      zetHuidig(huidig || null);
    } else toonWachtrij();

    /* ----- klikreeksen ----- */

    function vulProfielen() {
      var ps = leesProfielen(), hier = schermSleutel(), keuze = lees(KEY_PROFIELKEUZE, '');
      var sel = $('profiel');
      sel.innerHTML = '';
      var auto = d.createElement('option');
      auto.value = '';
      auto.textContent = 'Automatisch: ' + profielLabel(hier, ps[hier]) + ' (' + hier + ')';
      sel.appendChild(auto);
      Object.keys(ps).forEach(function (k) {
        if (k === 'oud') return;
        var o = d.createElement('option');
        o.value = k;
        o.textContent = profielLabel(k, ps[k]) + (k === hier ? ' (dit scherm)' : ' (' + k + ')');
        sel.appendChild(o);
      });
      sel.value = ps[keuze] ? keuze : '';
      var k = actiefProfiel(), aantal = Object.keys((ps[k] && ps[k].reeksen) || {}).length;
      $('profiel-naam').value = (ps[k] && ps[k].label) || '';
      $('profielinfo').textContent = 'Dit scherm: ' + hier + '. Actief: ' + profielLabel(k, ps[k]) + ', ' +
        (aantal ? aantal + ' reeks(en).' : 'nog geen opnames: neem ordernummer en afsluiten op voor dit scherm.');
      $('oud-rij').style.display = ps.oud ? '' : 'none';
    }

    function profielGewisseld() {
      vulProfielen();
      vulReeksen();
      toonStapper();
      if (markersAan) markersAan = !!toonMarkers($('reeks-naam').value);
    }

    $('profiel').onchange = function () { bewaar(KEY_PROFIELKEUZE, $('profiel').value); profielGewisseld(); };

    $('b-profielnaam').onclick = function () {
      var ps = leesProfielen(), k = actiefProfiel();
      ps[k] = ps[k] || { reeksen: {} };
      ps[k].label = $('profiel-naam').value.trim().slice(0, 40) || undefined;
      bewaarProfielen(ps);
      vulProfielen();
      vo.ui.status('Naam bewaard.', 'ok');
    };

    $('b-koppel').onclick = function () {
      var ps = leesProfielen(), k = actiefProfiel();
      if (!ps.oud) return;
      ps[k] = ps[k] || { reeksen: {} };
      ps[k].reeksen = ps[k].reeksen || {};
      var namen = Object.keys(ps.oud.reeksen), gedaan = [];
      namen.forEach(function (n) {
        if (ps[k].reeksen[n] && !f.contentWindow.confirm('Dit profiel heeft al een reeks "' + n + '". Vervangen door de eerdere opname?')) return;
        ps[k].reeksen[n] = ps.oud.reeksen[n];
        gedaan.push(n);
      });
      delete ps.oud;
      bewaarProfielen(ps);
      profielGewisseld();
      vo.ui.status('Gekoppeld aan ' + profielLabel(k, ps[k]) + ': ' + (gedaan.join(', ') || 'niets') + '.', 'ok');
    };

    function gekozenReeks() { return $('reeks-nieuw').value.trim() || $('reeks-naam').value || 'afsluiten'; }

    function vulReeksen(kies) {
      var namen = Object.keys(leesReeksen());
      ['ordernummer', 'afsluiten'].forEach(function (n) { if (namen.indexOf(n) < 0) namen.unshift(n); });
      $('reeks-naam').innerHTML = '';
      namen.forEach(function (n) {
        var o = d.createElement('option'); o.value = n; o.textContent = n; $('reeks-naam').appendChild(o);
      });
      if (kies) $('reeks-naam').value = kies;
      toonReeksInfo();
    }

    function toonReeksInfo() {
      var r = leesReeksen()[$('reeks-naam').value];
      $('reeksinfo').textContent = r && r.length ? beschrijfReeks(r) + '.' : 'Nog niet opgenomen.';
      $('b-pauzes').disabled = !(r && r.length);
      toonPauzes();
      maatPaneel(f);
    }

    /*
     * Pauzes per stap. Bij de opname zit in elke pauze ook hoe lang jij nodig had
     * om naar de volgende knop te gaan; korter maken mag, zolang Vanessa het scherm
     * op tijd klaar heeft. Stap 1 is de pauze vóór de eerste klik.
     */
    function toonPauzes() {
      var box = $('pauzes'), naam = $('reeks-naam').value, r = leesReeksen()[naam];
      box.innerHTML = '';
      if (box.style.display === 'none' || !r || !r.length) return;
      var n = 0;
      r.forEach(function (st, i) {
        if (isDubbel(r[i - 1], st)) return;
        n++;
        var wat = st.soort === 'klik' ? (isDubbel(st, r[i + 1]) ? 'dubbelklik' : 'klik') :
          'toets ' + st.mods.map(function (m) { return { ctrl: 'Ctrl+', meta: 'Cmd+', alt: 'Alt+', shift: 'Shift+' }[m]; }).join('') + st.key;
        var rij = d.createElement('div'); rij.className = 'pauzerij';
        var t = d.createElement('span');
        t.textContent = n + '. ' + wat + ' · opgenomen ' + opgenomenPauze(st, i) + ' ms';
        var inp = d.createElement('input');
        inp.type = 'number'; inp.min = PAUZE_MIN; inp.max = 10000; inp.step = 50;
        inp.value = pauzeVan(st, i);
        inp.title = 'Pauze vóór deze ' + (st.soort === 'klik' ? 'klik' : 'toets') + ', in ms (' + PAUZE_MIN + '–10000)';
        inp.onchange = function () {
          var v = Math.round(parseFloat(inp.value));
          var alle = leesReeksen(), doel = alle[naam] && alle[naam][i];
          if (!doel) return;
          if (isNaN(v)) v = opgenomenPauze(doel, i);
          v = Math.min(10000, Math.max(PAUZE_MIN, v));
          if (v === opgenomenPauze(doel, i)) delete doel.speel; else doel.speel = v;
          bewaarReeksen(alle);
          inp.value = v;
          $('reeksinfo').textContent = beschrijfReeks(alle[naam]) + '.';
        };
        rij.appendChild(t); rij.appendChild(inp); box.appendChild(rij);
      });
      var knoppen = d.createElement('div'); knoppen.className = 'rij'; knoppen.style.marginTop = '4px';
      function alles(tekst, titel, f2) {
        var b = d.createElement('button'); b.className = 'ux-btn klein'; b.textContent = tekst; b.title = titel;
        b.onclick = function () {
          var alle = leesReeksen();
          alle[naam].forEach(function (st, i) {
            var v = f2(st, i);
            if (v === null || v === opgenomenPauze(st, i)) delete st.speel; else st.speel = Math.min(10000, Math.max(PAUZE_MIN, Math.round(v / 10) * 10));
          });
          bewaarReeksen(alle);
          toonReeksInfo();
        };
        knoppen.appendChild(b);
      }
      alles('Alles ×½', 'Elke pauze half zo lang (minimaal ' + PAUZE_MIN + ' ms)', function (st, i) { return pauzeVan(st, i) / 2; });
      alles('Zoals opgenomen', 'Alle aanpassingen terugdraaien', function () { return null; });
      box.appendChild(knoppen);
      var uitleg = d.createElement('div'); uitleg.className = 'gedempt';
      uitleg.textContent = 'Pauze vóór elke stap, in ms. Een dubbelklik telt als één stap. Te kort = Vanessa is nog niet klaar en de klik valt verkeerd: test met ▶ Afspelen.';
      box.appendChild(uitleg);
    }
    $('b-pauzes').onclick = function () {
      var box = $('pauzes'), open = box.style.display === 'none';
      box.style.display = open ? '' : 'none';
      $('b-pauzes').textContent = open ? 'Pauzes verbergen' : 'Pauzes aanpassen';
      toonPauzes();
      maatPaneel(f);
    };
    var markersAan = false;
    $('reeks-naam').onchange = function () { $('reeks-nieuw').value = ''; toonReeksInfo(); if (markersAan) markersAan = !!toonMarkers($('reeks-naam').value); };
    vulProfielen();
    vulReeksen();

    $('b-opname').onclick = function () {
      if (vo.bezig) return;
      if (!vo.opname) {
        vo.opname = { naam: gekozenReeks(), stappen: [], laatst: Date.now() };
        $('b-opname').textContent = '■ Stop opname';
        $('b-opname').classList.add('selected');
        vo.ui.status('Opname "' + vo.opname.naam + '" voor profiel ' + profielLabel(actiefProfiel()) + ' loopt: doe het nu in Vanessa, druk daarna hier Stop opname.', 'bezig');
        return;
      }
      var klaar = vo.opname; vo.opname = null;
      vulProfielen();
      $('b-opname').textContent = '● Opnemen';
      $('b-opname').classList.remove('selected');
      if (!klaar.stappen.length) return vo.ui.status('Niets opgenomen: de tool zag geen klikken of toetsen in Vanessa. Herlaad de AppStream-pagina, open het paneel opnieuw en probeer nog eens.', 'fout');
      var alle = leesReeksen();
      if (alle[klaar.naam] && !f.contentWindow.confirm('Reeks "' + klaar.naam + '" bestaat al. Overschrijven?')) return;
      alle[klaar.naam] = klaar.stappen;
      bewaarReeksen(alle);
      $('reeks-nieuw').value = '';
      vulReeksen(klaar.naam);
      toonStapper();
      vo.ui.status('Reeks "' + klaar.naam + '" opgeslagen: ' + beschrijfReeks(klaar.stappen) + '.', 'ok');
    };

    koppel($('b-speel'), function () {
      return reeksPlan($('reeks-naam').value) || 'Reeks "' + $('reeks-naam').value + '" is nog niet opgenomen.';
    });

    $('b-markers').onclick = function () {
      markersAan = !markersAan && !!toonMarkers($('reeks-naam').value);
      if (!markersAan) toonMarkers(null);
      $('b-markers').textContent = markersAan ? 'Verberg posities' : 'Toon posities';
    };

    $('b-export').onclick = function () {
      var ps = leesProfielen(), n = Object.keys(ps).length;
      if (!n) return vo.ui.status('Er zijn nog geen reeksen om te exporteren.', 'fout');
      kopieer(exporteerReeksen(), n + ' profiel(en) gekopieerd. Stuur de tekst naar je collega, of bewaar hem als back-up.');
    };

    $('b-import').onclick = function () {
      var t = $('reeks-import');
      t.style.display = t.style.display === 'none' ? '' : 'none';
      if (t.style.display === '') t.focus();
      maatPaneel(f);
    };

    $('reeks-import').addEventListener('paste', function () {
      setTimeout(function () {
        var t = $('reeks-import'), r = leesExport(t.value);
        t.value = '';
        if (r.fout) return vo.ui.status(r.fout, 'fout');
        var ps = leesProfielen(), gedaan = [];
        Object.keys(r.profielen).forEach(function (k) {
          var nieuw = r.profielen[k];
          ps[k] = ps[k] || { reeksen: {} };
          ps[k].reeksen = ps[k].reeksen || {};
          if (nieuw.label && !ps[k].label) ps[k].label = nieuw.label;
          Object.keys(nieuw.reeksen).forEach(function (n) {
            var waar = profielLabel(k, ps[k]);
            if (ps[k].reeksen[n] && !f.contentWindow.confirm('Profiel "' + waar + '" heeft al een reeks "' + n + '". Vervangen door de geïmporteerde?')) return;
            ps[k].reeksen[n] = nieuw.reeksen[n];
            gedaan.push(waar + ': ' + n);
          });
        });
        bewaarProfielen(ps);
        t.style.display = 'none';
        profielGewisseld();
        vo.ui.status(gedaan.length ? 'Ingelezen: ' + gedaan.join(', ') + '. Controleer met Toon posities of de punten op de juiste knoppen vallen.' :
          'Niets ingelezen.', gedaan.length ? 'ok' : 'fout');
      }, 0);
    });

    $('b-wisreeks').onclick = function () {
      var n = $('reeks-naam').value, alle = leesReeksen();
      if (!alle[n]) return;
      if (!f.contentWindow.confirm('Reeks "' + n + '" wissen?')) return;
      delete alle[n]; bewaarReeksen(alle); toonMarkers(null); markersAan = false;
      $('b-markers').textContent = 'Toon posities';
      vulReeksen(); toonStapper();
    };
  }

  if (!/appstream/i.test(location.hostname) && !document.getElementById(PANEEL_ID)) {
    if (!confirm('Vanessa: dit lijkt geen AppStream-pagina (' + location.hostname + '). Toch openen?')) return;
  }
  openPaneel();
})();
