// Vanessa Refurbished — kopie van ~/Documents/Vanessa-Refurbished/vanessa-refurbished.js, geladen door de DS Tools-launcher.
// NIET hier bewerken: daar wijzigen (VERSIE ophogen) en opnieuw hierheen kopiëren.
/*
 * Vanessa Refurbished — factuurorder per levering, via AppStream.
 *
 * Draait als bookmarklet op het AppStream-tabblad, naast (niet samen met) de
 * factuurorders-tool uit ../Vanessa. Bouwstenen zijn daaruit gekopieerd, met
 * eigen namen (window.__vr, vr-paneel, vanessa_refurb_*), zodat beide
 * bookmarklets tegelijk open kunnen staan.
 *
 * v0.1.0: testknop 1, stap 0 "levering inlezen". Plak één rij uit de
 * Leveringslijst en het bereik A1:K215 uit de Rita Mastersheet; de tool
 * controleert of de levering klaar is om te factureren, en zet Reference,
 * orderregels, taaktekst en de uitvoerregel voor AF:AH + J klaar. Nog geen
 * toetsen of klikken naar Vanessa.
 *
 * v0.2.0: testmodus. Een al gefactureerde levering mag ingelezen worden
 * (Gefactureerd en Order ID worden een waarschuwing), om de uitkomst te
 * vergelijken met de bestaande order en AH. Zo'n levering heet test: de
 * kopieerknoppen voor de sheet staan uit, en de onomkeerbare stappen
 * (5, 9, 10) zullen hem weigeren.
 *
 * v0.3.0: testknop 2, controle op melding. Merkteken op het klembord, Cmd+C
 * naar Vanessa, klembord teruglezen: een Vanessa-dialoog geeft zijn hele tekst
 * ("[Window Title] … [Content] … "). Toetslaag, slaap() in een Worker,
 * voerUit, stoorder en klembord uit ../Vanessa (zonder klikken, die komen met
 * de klikreeksen). Herkent de opslaan-vraag van W.
 *
 * v0.3.1: eerste proef gaf "geen melding" terwijl de opslaan-vraag openstond
 * (met de hand gaf Cmd+C wel de tekst; Ctrl+C niets). Vermoedelijk gingen de
 * toetsen naar de pagina in plaats van de stream: het doel-element werd alleen
 * bij het openen van de bookmarklet bepaald. Nu leert de tool het stream-element
 * van elke eigen klik/toets/focus in AppStream, weigert hij als hij het niet
 * kent, en toont hij waar de toetsen heen gingen. Klembord 3 s lezen i.p.v. 1,5 s.
 *
 * v0.3.2: tweede proef: toetsen gingen naar div#dcv-input (de AppStream/DCV-
 * client), toch geen dialoogtekst. Vermoeden: de client haalt het Windows-
 * klembord pas op bij een echte kopieer-gebeurtenis van de browser, en die
 * komt niet bij een synthetische toets. Experiment: komt er na Cmd+C niets,
 * dan ook document.execCommand('copy') op het stream-element. Het paneel toont
 * welke manier werkte.
 *
 * v0.3.3: derde proef: ook de kopieeropdracht gaf niets. Nieuw experiment:
 * Cmd+C langzaam (Cmd neer, 150 ms, C, 100 ms, Cmd op), zoals een mens hem
 * aanslaat. Volgorde: Cmd+C, langzaam, kopieeropdracht; het paneel toont welke
 * werkte.
 *
 * v0.3.4: de langzame Cmd+C werkt (opslaan-vraag gelezen, 02-11-2026); snelle
 * Cmd+C en de kopieeropdracht niet. De controle doet nu alleen de langzame.
 *
 * v0.4.0: testknop 3, weggooien (W): controle, klikreeks "weggooien" (kruisje
 * rechtsboven), controle; alleen bij precies de opslaan-vraag N, daarna nog een
 * controle. Klikreeks-recorder, schermprofielen en maatcontrole uit ../Vanessa
 * (nog zonder export/import en pauzes aanpassen).
 *
 * v0.5.0: testbank voor alle stappen tegelijk. Elke stap heeft een eigen
 * knop met een aanpasbaar sjabloon (toetsen, tekst met {plaatshouders} uit de
 * levering, klikreeksen, "lees" = langzame Cmd+C + klembord teruglezen), en na
 * afloop een controle op melding. De gebruiker past een sjabloon aan tot de
 * stap werkt; daarna wordt hij als bewezen in de code vastgezet. Stap 5, 9 en
 * 10 (onomkeerbaar) weigeren een testlevering en vragen eerst bevestiging.
 * Ook: vrije toetsreeks om open vragen uit te proberen, nieuwe klikreeksnamen,
 * hogere balk (↕).
 *
 * v0.6.0: sjabloon opnemen per stap (●): de gebruiker doet de stap zelf in
 * Vanessa, de tool schrijft het sjabloon. Getypte tekst wordt "tekst", speciale
 * toetsen en combinaties hun naam, herhalingen Tab*3, pauzes > 1,5 s wacht:,
 * klikken een klikreeks <stap>-<n> (reeks:…). Waarden van de ingelezen levering
 * worden plaatshouders; blijft er een lang getal over, dan wordt het sjabloon
 * niet bewaard (geen klantdata in localStorage).
 *
 * v0.6.1: opnemen toets voor toets: het sjabloon groeit live in het veld, ⌫
 * haalt de laatste toets/klik eruit, en pauzes worden standaard niet meer als
 * wacht: opgenomen (bij uitzoeken is een pauze denktijd); vinkje om dat aan
 * te zetten.
 *
 * v0.7.0: opnemen van sjablonen weer weg (gebruiker maakt de acties in de
 * Stream Deck en exporteert die; daaruit worden de sjablonen geschreven).
 * Klikreeks-recorder (voor W) en de testbank met sjablonen blijven.
 *
 * v0.7.1: standaardsjablonen stap 1 en 2 uit de Deck (gebruiker, 03-11-2026):
 * F3, Cmd+Insert = nieuwe order; Tab×4 = Customer, Alt+Down = lookup, cursor
 * staat in het zoekveld, nummer + Enter = zoeken, Tab×3 + Enter = klant kiezen.
 * De wachttijden zijn toegevoegd (nog niet afgesteld).
 *
 * v0.7.2: een bewaard leeg sjabloon (overblijfsel van een opname in 0.6.x)
 * verborg de nieuwe standaard van stap 1. Nu: leeg = standaard, en een eigen
 * sjabloon onthoudt op welke standaard het gebaseerd was; is de standaard
 * sindsdien veranderd, dan meldt de stap dat (↺ neemt de nieuwe).
 *
 * v0.7.3: standaardsjabloon stap 3 (gebruiker, 03-11-2026): na het kiezen van
 * de klant staat de cursor in Customer; Shift+Tab×2 = Channel ("b" + Enter =
 * B2B), Tab = Reference, Tab×3 = Payment method ("op" + Enter = Op rekening).
 * Telefoon (29 Tabs verder) zit er nog niet in.
 * Nieuw sjabloonwoord alsleeg:{x} of alsleeg:"tekst": lees het veld (langzame
 * Cmd+C); leeg → typen, gevuld → niets (inhoud niet tonen). Bewezen dat lees
 * op een gevuld telefoonveld de inhoud geeft (03-11-2026).
 *
 * v0.7.4: stap 3 bleef staan na "op" (Enter kwam niet aan): wacht tussen de
 * getypte keuze en Enter in Channel en Payment method. Telefoon erbij:
 * Tab×29 vanaf Payment method, alsleeg:{telefoon} (gebruiker: 29 Tabs en het
 * teruglezen werken, getest met de Deck).
 *
 * v0.7.5: kiezen in de keuzelijst Klikreeksen sprong terug naar de eerste naam
 * (de lijst werd bij elke keuze opnieuw opgebouwd zonder de keuze te
 * onthouden). Merkbaar sinds er meer namen dan weggooien in staan.
 *
 * v0.8.0: stap 4 = sjabloon van de gebruiker (eindigt met Enter; dat slaat
 * niet op). Cmd+Enter slaat de order op en geeft de btw-vraag ("The customer
 * has a valid VAT number. Do you want to set the VAT free indicator?", Yes
 * heeft de focus). Stap 5 = Cmd+Enter + nieuw sjabloonwoord
 * melding:"tekst"=Toets (bij precies die melding die toets, andere melding =
 * stoppen, geen melding = door). De controle na een stap wacht eerst 1 s.
 *
 * v0.8.1: de gebruiker zette Cmd+Enter in het sjabloon van stap 4 en dat
 * maakte een echte order (10-11-2026): stap 4 is niet als onomkeerbaar
 * gemarkeerd, dus geen bevestiging en geen blokkade voor een testlevering.
 * Nu wordt Cmd+Enter (opslaan) geweigerd in elke stap die niet onomkeerbaar
 * is, ook in de vrije toetsreeks.
 *
 * v0.8.2: orderregel (gebruiker, 10-11-2026): Product is een lookup, Tab×2 =
 * Quantity, Tab = Sales price, Alt+Down = "Specify amount" met vinkje
 * "Including 21% VAT" (staat altijd aan) en Amount (cursor erin). Uitvinken
 * rekent Amount om (÷ 1,21). Nieuw sjabloonwoord exclbtw: Amount lezen,
 * Shift+Tab Space Tab, opnieuw lezen; ÷ 1,21 = goed, × 1,21 = stond al uit →
 * nog een keer omzetten en controleren. Standaardsjabloon stap 6 bijgewerkt.
 *
 * v0.9.0: stap 6 slaat de regel pas op met Tab Enter na de prijs (gebruiker,
 * 10-11-2026); in de standaard opgenomen. Knop "▶ Alle regels": het sjabloon
 * voor elke orderregel van de gekozen regel t/m de laatste, met controle na
 * elke regel; stopt bij een melding, fout of Stop.
 *
 * v0.9.1: stap 7. Het totaal in Vanessa is een label (niet te kopiëren). Tab
 * Space na de laatste regel zet "Display including VAT" uit (Total = excl.,
 * gebruiker, 10-11-2026). Daarna toont het paneel het verwachte totaal en
 * vraagt de gebruiker "Klopt" / "Klopt niet". Stap 9 weigert zolang het totaal
 * van deze levering niet als kloppend is bevestigd.
 */
(function () {
  'use strict';

  var W = window;
  var VERSIE = '0.9.1';
  var PANEEL_ID = 'vr-paneel';
  var KEY_DICHT = 'vanessa_refurb_dicht';
  var KEY_KANT = 'vanessa_refurb_positie';   // onder (standaard) / rechts / links
  var KEY_PROFIELEN = 'vanessa_refurb_profielen';  // klikreeksen per schermprofiel
  var MAAT_MARGE = 0.02;                            // stream > 2 % anders dan bij de opname: niet klikken
  var REEKSEN = ['weggooien', 'b2bTab', 'totaal', 'ordernummer', 'afsluiten'];
  var WACHT_CONTROLE_MS = 1000;  // na de laatste toets van een teststap, vóór de controle op melding (× tempo)  // altijd in de keuzelijst

  /*
   * Teststappen. std = eerste gok voor het sjabloon (niet bewezen, behalve waar
   * het in CLAUDE.md onder Bewezen staat). lees: wat de laatste "lees" moet
   * opleveren. regel: gebruikt de gekozen orderregel. onomkeerbaar: weigert een
   * testlevering en vraagt bevestiging.
   */
  var TESTSTAPPEN = [
    { id: 'vrij', label: 'Vrije toetsreeks', std: '', uitleg: 'Om open vragen uit te proberen, bijv. Ctrl+Tab of Tab*3 lees.' },
    { id: 'nieuw', label: '1 · Nieuwe order openen', std: 'F3 wacht:500 Cmd+Insert wacht:1000' },
    { id: 'klant', label: '2 · Klant kiezen', std: 'Tab*4 Alt+Down wacht:1000 {klant} Enter wacht:1500 Tab*3 Enter' },
    { id: 'kop', label: '3 · Kopvelden', std: 'Shift+Tab*2 "b" wacht:500 Enter Tab {reference} Tab*3 "op" wacht:500 Enter wacht:500 Tab*29 alsleeg:{telefoon}' },
    { id: 'b2b', label: '4 · Tabblad B2B', std: 'reeks:b2bTab Tab "." Tab "." Tab {datum} Enter' },
    { id: 'bevestig', label: '5 · Order bevestigen', std: 'Cmd+Enter wacht:1500 melding:"VAT free indicator"=N', onomkeerbaar: true },
    { id: 'regel', label: '6 · Orderregel', std: 'Ctrl+Shift+Insert wacht:1000 Alt+Down wacht:1800 {product} Enter wacht:1300 Enter Tab*2 {aantal} Tab Alt+Down wacht:1000 exclbtw {prijs} Enter Tab Enter', regel: true },
    { id: 'totaal', label: '7 · Ordertotaal controleren', std: 'Tab Space', handcontrole: 'totaal' },
    { id: 'ordernummer', label: '8 · Ordernummer lezen', std: 'reeks:ordernummer lees', lees: 'ordernummer' },
    { id: 'packing', label: '9 · Allow packing', std: '', onomkeerbaar: true },
    { id: 'taak', label: '10 · Finance-taak', std: '', onomkeerbaar: true },
    { id: 'afsluiten', label: '11 · Order sluiten', std: 'reeks:afsluiten' }
  ];
  var WACHT_DIALOOG_MS = 800;                       // na het kruisje, vóór de controle, × tempo
  var KANTEN = ['onder', 'rechts', 'links'];
  var KEY_HOOGTE = 'vanessa_refurb_hoogte';
  var HOOGTES = [380, 640];
  var KEY_SJABLONEN = 'vanessa_refurb_sjablonen';  // sjablonen per teststap (alleen toetsen en {plaatshouders}, geen klantdata)

  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'];
  var TAAK_KOP = 'Graag een invoice maken voor de volgende product ID:';

  var GAT_MS = 80;          // tussen twee losse toetsen (Tab, Enter, ...), × tempo
  var TYP_BLOK = 40;        // tekens die in één keer verstuurd worden
  var TYP_PAUZE_MS = 5;     // tussen twee blokjes tekens, los van het tempo
  var TEMPO = 1.5;          // nog geen keuze in het paneel; zelfde standaard als ../Vanessa

  /* ---------- toetsen (uit ../Vanessa) ---------- */

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

  /* [key, code, mods] voor één teken, of null als het niet kan. */
  function tekenNaarToets(c) {
    if (c === '\n') return ['Enter', 'Enter', []];
    if (/[a-z]/.test(c)) return [c, 'Key' + c.toUpperCase(), []];
    if (/[A-Z]/.test(c)) return [c, 'Key' + c, ['shift']];
    if (/[0-9]/.test(c)) return [c, 'Digit' + c, []];
    var t = TEKEN[c];
    return t ? [c, t[0], t[1] ? ['shift'] : []] : null;
  }

  /* Tekens die niet getypt kunnen worden, zonder dubbele. */
  function nietTypbaar(s) {
    var uit = [];
    for (var i = 0; i < s.length; i++) if (!tekenNaarToets(s[i]) && uit.indexOf(s[i]) < 0) uit.push(s[i]);
    return uit;
  }

  /* Het element van de AppStream-client. Staat de focus in het paneel, dan het laatst bekende. */
  /* Niet de pagina zelf, niet ons paneel en niet dat van de factuurorders-tool (vo-paneel). */
  var GEEN_STREAM = [PANEEL_ID, 'vo-paneel'];
  function isStreamKandidaat(a) {
    return !!(a && a.nodeType === 1 && a !== document.body && a !== document.documentElement &&
      GEEN_STREAM.indexOf(a.id) < 0 && a.isConnected);
  }

  /* null als de tool het stream-element nog niet kent: dan niets sturen. */
  function doelElement() {
    var a = document.activeElement;
    if (isStreamKandidaat(a) && W.__vr) W.__vr.doel = a;
    var d = isStreamKandidaat(a) ? a : W.__vr && W.__vr.doel;
    return isStreamKandidaat(d) ? d : null;
  }

  /* Korte omschrijving voor in het paneel, bijv. "canvas#stream.appstream". */
  function beschrijf(el) {
    if (!el) return 'niets';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  }

  function stuur(doel, type, key, code, m) {
    doel.dispatchEvent(new KeyboardEvent(type, {
      key: key, code: code,
      ctrlKey: !!m.ctrl, metaKey: !!m.meta, altKey: !!m.alt, shiftKey: !!m.shift,
      bubbles: true, cancelable: true
    }));
  }

  /* Modifiers neer, keydown/keypress/keyup, modifiers op. */
  function druk(doel, key, code, mods) {
    var m = {};
    mods.forEach(function (x) { m[x] = true; stuur(doel, 'keydown', MODS[x][0], MODS[x][1], m); });
    stuur(doel, 'keydown', key, code, m);
    stuur(doel, 'keypress', key, code, m);
    stuur(doel, 'keyup', key, code, m);
    mods.slice().reverse().forEach(function (x) { delete m[x]; stuur(doel, 'keyup', MODS[x][0], MODS[x][1], m); });
  }

  /* Zoals een mens: modifiers neer, even wachten, toets, even wachten, modifiers op. */
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

  /* Bouwstenen van een plan: toets, tekst, wacht, label. */
  function K(naam, mods, n) {
    var key = NAAM[naam] || naam;
    var code = NAAM[naam] || (/^[a-z]$/i.test(naam) ? 'Key' + naam.toUpperCase() : naam);
    var uit = [];
    for (var i = 0; i < (n || 1); i++) uit.push({ soort: 'toets', key: key, code: code, mods: mods || [] });
    return uit;
  }
  /*
   * Langzaam: modifier neer, 150 ms, toets, modifier op. Nodig voor Cmd+C op een
   * Vanessa-dialoog (snel aangeslagen komt er niets op het klembord, 02-11-2026).
   */
  function KL(naam, mods) { return K(naam, mods).map(function (x) { x.langzaam = true; return x; }); }
  function T(s) { return [{ soort: 'tekst', s: s }]; }
  function Z(ms) { return [{ soort: 'wacht', ms: ms }]; }
  function L(s) { return [{ soort: 'label', s: s }]; }
  function reeks() { return [].concat.apply([], arguments); }

  /* ---------- Vanessa-meldingen ---------- */
  /*
   * Een Windows-dialoog zet met Ctrl/Cmd+C zijn hele tekst op het klembord
   * ("[Window Title]\nInformation\n\n[Content]\n…\n\n[OK]", getest in
   * ../Vanessa). Zonder dialoog doet Cmd+C in Vanessa niets schadelijks.
   */
  function isDialoog(t) { return /\[Content\]|\[Window Title\]/.test(String(t)); }
  function dialoogTekst(t) {
    var m = String(t).match(/\[Content\]\s*([\s\S]*?)\s*(\[[^\]]+\]|$)/);
    return (m ? m[1] : String(t)).replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  /* De vraag na het kruisje op een niet-opgeslagen order (W): alleen dan N. */
  function isOpslaanVraag(t) { return isDialoog(t) && /Save changes to current record\?/.test(String(t)); }

  /* ---------- sjablonen voor de testbank ---------- */
  /*
   * Een sjabloon is een reeks woorden, gescheiden door spaties:
   *   Tab  Enter  Down  F4  Ctrl+Shift+Insert  Alt+Down  Cmd+C   toets (met modifiers: langzaam)
   *   Tab*3                                                       toets 3 keer
   *   "tekst"  of  {klant}                                        typen (plaatshouders uit de levering)
   *   wacht:500                                                   500 ms wachten
   *   reeks:naam                                                  opgenomen klikreeks afspelen
   *   lees                                                        langzame Cmd+C en het klembord teruglezen
   *   alsleeg:{telefoon}  alsleeg:"..."                           lees; leeg → typen, gevuld → niets
   *   melding:"VAT free indicator"=N                              staat precies die melding open: die toets;
   *                                                               andere melding: stoppen; geen melding: door
   *   exclbtw                                                     in "Specify amount": vinkje incl. btw uit,
   *                                                               gecontroleerd aan het omgerekende Amount
   */
  var TOETSNAMEN = {
    tab: ['Tab', 'Tab'], enter: ['Enter', 'Enter'], home: ['Home', 'Home'], end: ['End', 'End'],
    esc: ['Escape', 'Escape'], escape: ['Escape', 'Escape'], insert: ['Insert', 'Insert'],
    delete: ['Delete', 'Delete'], del: ['Delete', 'Delete'], backspace: ['Backspace', 'Backspace'],
    space: [' ', 'Space'], spatie: [' ', 'Space'], pageup: ['PageUp', 'PageUp'], pagedown: ['PageDown', 'PageDown'],
    up: ['ArrowUp', 'ArrowUp'], down: ['ArrowDown', 'ArrowDown'], left: ['ArrowLeft', 'ArrowLeft'], right: ['ArrowRight', 'ArrowRight']
  };
  var MODNAMEN = { ctrl: 'ctrl', control: 'ctrl', cmd: 'meta', command: 'meta', meta: 'meta', alt: 'alt', option: 'alt', shift: 'shift' };

  /* "Ctrl+Shift+Insert" → { key, code, mods } of null. */
  function toetsVan(woord) {
    var delen = woord.split('+'), naam = delen.pop(), mods = [];
    for (var i = 0; i < delen.length; i++) {
      var m = MODNAMEN[delen[i].toLowerCase()];
      if (!m || mods.indexOf(m) >= 0) return null;
      mods.push(m);
    }
    var t = TOETSNAMEN[naam.toLowerCase()];
    if (!t && /^f([1-9]|1[0-2])$/i.test(naam)) t = [naam.toUpperCase(), naam.toUpperCase()];
    if (!t && /^[a-z]$/i.test(naam)) t = [naam.toLowerCase(), 'Key' + naam.toUpperCase()];
    if (!t && /^[0-9]$/.test(naam)) t = [naam, 'Digit' + naam];
    if (!t && naam.length === 1 && TEKEN[naam]) {
      t = [naam, TEKEN[naam][0]];
      if (TEKEN[naam][1] && mods.indexOf('shift') < 0) mods.push('shift');
    }
    return t ? { key: t[0], code: t[1], mods: mods } : null;
  }

  /*
   * Geeft { stappen, fout }. stappen = plan-stappen voor voerUit, plus
   * { soort: 'lees' }. Fouten vóór de start, nooit halverwege.
   */
  function parseSjabloon(tekst, waarden) {
    var stappen = [], re = /melding:"([^"]+)"=(\S+)|"([^"]*)"|(\S+)/g, m;
    function vul(s) {
      var fout = '';
      var uit = s.replace(/\{(\w+)\}/g, function (_, n) {
        if (!(n in waarden)) { fout = fout || 'onbekende plaatshouder {' + n + '}'; return ''; }
        if (waarden[n] === '' || waarden[n] === null || waarden[n] === undefined) { fout = fout || '{' + n + '} heeft geen waarde (lees eerst een levering in; testmodus mag)'; return ''; }
        return String(waarden[n]);
      });
      return { tekst: uit, fout: fout };
    }
    function typ(s) {
      var v = vul(s);
      if (v.fout) return v.fout;
      var nt = nietTypbaar(v.tekst);
      if (nt.length) return 'deze tekens kunnen niet getypt worden: ' + nt.join(' ');
      if (v.tekst) stappen.push({ soort: 'tekst', s: v.tekst });
      return '';
    }
    while ((m = re.exec(String(tekst || '')))) {
      var fout = '';
      if (m[1] !== undefined) {
        var antwoord = toetsVan(m[2]);
        if (!antwoord) fout = 'melding:"…"=' + m[2] + ': onbekende toets';
        else if (m[2].toLowerCase() === 'enter') fout = 'melding:"…"=Enter mag niet (Enter kiest de knop met de focus, vaak Yes)';
        else stappen.push({ soort: 'melding', fragment: m[1], toets: antwoord, naam: m[2] });
      }
      else if (m[3] !== undefined) fout = typ(m[3]);
      else {
        var w = m[4], herhaal = 1, h = w.match(/^(.+?)\*(\d{1,2})$/);
        if (h) { w = h[1]; herhaal = parseInt(h[2], 10); }
        if (/^\{\w+\}$/.test(w) && herhaal === 1) fout = typ(w);
        else if (/^wacht:\d{1,5}$/i.test(w)) stappen.push({ soort: 'wacht', ms: parseInt(w.slice(6), 10), vast: true });
        else if (/^reeks:[\w-]{1,30}$/i.test(w)) {
          var plan = reeksPlan(w.slice(6));
          if (!plan) fout = 'klikreeks "' + w.slice(6) + '" is nog niet opgenomen';
          else for (var x = 0; x < herhaal; x++) stappen = stappen.concat(plan);
        }
        else if (/^lees$/i.test(w)) stappen.push({ soort: 'lees' });
        else if (/^exclbtw$/i.test(w)) stappen.push({ soort: 'exclbtw' });
        else if (/^alsleeg:/i.test(w) && herhaal === 1) {
          var inhoud = w.slice(8).replace(/^"(.*)"$/, '$1');
          var v = vul(inhoud);
          if (!inhoud) fout = 'alsleeg: zonder tekst (bijv. alsleeg:{telefoon})';
          else if (v.fout) fout = v.fout;
          else if (nietTypbaar(v.tekst).length) fout = 'deze tekens kunnen niet getypt worden: ' + nietTypbaar(v.tekst).join(' ');
          else stappen.push({ soort: 'alsleeg', s: v.tekst });
        }
        else {
          var t = toetsVan(w);
          if (!t) fout = 'onbekend woord "' + m[4] + '"';
          else for (var y = 0; y < herhaal; y++) stappen.push({ soort: 'toets', key: t.key, code: t.code, mods: t.mods, langzaam: t.mods.length > 0 });
        }
      }
      if (fout) return { fout: fout };
    }
    return { stappen: stappen };
  }

  /* Bevat het sjabloon een lang getal buiten plaatshouders (mogelijk klantgegevens)? */
  function heeftLosGetal(sjabloon) { return /\d{5,}/.test(String(sjabloon).replace(/\{\w+\}/g, '').replace(/wacht:\d+/g, '')); }

  /* Plaatshouders. regel = index in lev.regels (stap 6). */
  function waardenVan(lev, regel) {
    var r = lev && lev.regels[regel || 0];
    var datum = lev ? lev.ophaal : '';
    return {
      klant: lev ? lev.klantId : '', levering: lev ? lev.nummer : '', reference: lev ? lev.reference : '',
      datum: datum, datum_slash: datum ? datum.replace(/-/g, '/') : '', vestiging: lev ? lev.vestiging : '',
      telefoon: '0000000000', taaktekst: lev ? lev.taaktekst : '',
      product: r ? r.productId : '', omschrijving: r ? r.omschrijving : '', aantal: r ? String(r.aantal) : '',
      prijs: r ? r.prijs : '', prijs_punt: r ? r.prijs.replace(',', '.') : ''
    };
  }

  /* ---------- plakken uit Google Sheets ---------- */

  /* Uit ../Vanessa: tab-gescheiden, cellen met regeleinden staan tussen aanhalingstekens. */
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

  /* Uit ../Vanessa. Geeft "1234,50" of null (leeg, geen getal, of ≤ 0). */
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

  function centen(prijs) { return Math.round(parseFloat(prijs.replace(',', '.')) * 100); }
  function bedrag(c) { return (c / 100).toFixed(2).replace('.', ','); }

  /* Ja/JA/ja/`JA → true. */
  function isJa(s) { return /^`?ja$/i.test(String(s || '').trim()); }
  function isNvt(s) { return /^n\.?\s*[vt]\.?\s*[tv]\.?$/i.test(String(s || '').trim()); }

  /* "1-10-2026" of "01-10-2026" → "01-10-2026", anders null. */
  function normDatum(s) {
    var m = String(s || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!m) return null;
    var d = +m[1], mnd = +m[2];
    if (d < 1 || d > 31 || mnd < 1 || mnd > 12) return null;
    return (d < 10 ? '0' : '') + d + '-' + (mnd < 10 ? '0' : '') + mnd + '-' + m[3];
  }

  function factuurMaand(nu) { return MAANDEN[nu.getMonth()] + ' ' + nu.getFullYear(); }

  /*
   * Eén rij uit het tabblad Leveringslijst, hele rij (vanaf kolom A), met of
   * zonder kopregel. Kolommen: A levering, C klant, D KlantID, F ophaaldatum,
   * H Uitgeleverd?, J Gefactureerd, AF/AG/AH factuurmaand/Order ID/bedrag.
   */
  var KOL = { levering: 0, klant: 2, klantId: 3, ophaal: 5, uitgeleverd: 7, gefactureerd: 9, maand: 31, orderId: 32, bedrag: 33 };

  function parseLeveringsrij(tekst) {
    var rijen = leesTsv(tekst).filter(function (r) { return !r.some(function (c) { return /^klantid$/i.test(c.trim()); }); });
    if (!rijen.length) return { fout: 'Plak een rij uit de Leveringslijst.' };
    if (rijen.length > 1) return { fout: 'Plak één rij uit de Leveringslijst (er staan er ' + rijen.length + ').' };
    var r = rijen[0];
    if (r.length < KOL.gefactureerd + 1) return { fout: 'Te weinig kolommen. Kopieer de hele rij: klik op het rijnummer links.' };
    var cel = function (k) { return (r[KOL[k]] || '').trim(); };
    var rij = {};
    Object.keys(KOL).forEach(function (k) { rij[k] = cel(k); });
    return { rij: rij };
  }

  /*
   * Bereik A1:K215 uit "Leveringslijst print - Categori". Op labels gezocht,
   * niet op rijnummers: "Levering:" (I2), de kopregel met "Prijs 1" (rij 193,
   * met links daarvan RataPlan-vlag / korting / staffeltekst), de groepen
   * eronder tot "Totaal", en "Controle".
   */
  function parseRita(tekst) {
    var rijen = leesTsv(tekst);
    if (!rijen.length) return { fout: 'Plak het bereik A1:K215 uit de Rita Mastersheet.' };
    var uit = { levering: '', regels: [], totaal: null, controle: '', rata: '', korting: '', staffel: '', voorlopig: [] };
    var j = -1, kopRij = -1;
    rijen.forEach(function (r, i) {
      r.forEach(function (c, k) {
        c = c.trim();
        if (c === 'Levering:' && !uit.levering) {
          for (var x = k + 1; x < r.length; x++) if (r[x].trim()) { uit.levering = r[x].trim(); break; }
        }
        if (c === 'Prijs 1' && j < 0) { j = k; kopRij = i; }
        if (/^Voorlopig/.test(c) && uit.voorlopig.indexOf(c) < 0) uit.voorlopig.push(c);
      });
    });
    if (!uit.levering) return { fout: 'In het Rita-blok staat geen "Levering:". Kopieer vanaf cel A1.' };
    if (j < 5) return { fout: 'In het Rita-blok staat de kopregel "Prijs 1" niet (of te ver links). Kopieer A1:K215.' };
    var kop = rijen[kopRij];
    uit.rata = (kop[j - 5] || '').trim();
    uit.korting = (kop[j - 4] || '').trim();
    uit.staffel = (kop[j - 3] || '').trim();
    for (var i = kopRij + 1; i < rijen.length; i++) {
      var r = rijen[i], cat = (r[j - 2] || '').trim();
      if (cat === 'Totaal') { uit.totaal = (r[j - 1] || '').trim(); continue; }
      if (cat === 'Controle') { uit.controle = (r[j - 1] || '').trim(); break; }
      if (!cat || uit.totaal !== null) continue;
      uit.regels.push({
        productId: (r[j - 3] || '').trim().replace(/[.,]0+$/, ''),
        omschrijving: cat,
        aantal: (r[j - 1] || '').trim(),
        prijzen: r.slice(j, j + 5).map(function (p) { return (p || '').trim(); }),
        opmerking: (r[j + 5] || '').trim()
      });
    }
    return uit;
  }

  /* Leveringsnummer in Rita kan alleen het cijferdeel zijn ("710" bij "ABC-710"). */
  function zelfdeLevering(a, rita) {
    a = a.toUpperCase(); rita = rita.toUpperCase();
    return a === rita || (/^\d+$/.test(rita) && a.slice(-(rita.length + 1)) === '-' + rita);
  }

  function route(klant, rita) {
    if (/troostwijk/i.test(klant)) return { weiger: 'Troostwijk: geen factuurorder, de beheerder van Troostwijk regelt dit (werkinstructie 5.2).' };
    if (/productpine/i.test(klant)) return { weiger: 'Productpine: geen factuurorder; J, AF, AG en AH worden n.v.t. (werkinstructie 5.3).' };
    if (/cb\s*deals|stekkerstore/i.test(klant)) return { weiger: 'CB Deals: geen factuurorder; maand en bedrag uit Verkoopsheet (werkinstructie 5.4).' };
    if (/stocklear/i.test(klant)) return { weiger: 'Stocklear komt in een latere versie (bedragen uit het portaal, J blijft Nee).' };
    if (/rata\s*plan|noppes/i.test(klant) || rita.rata === 'RataPlan') return { soort: 'rataplan' };
    return { soort: 'regulier' };
  }

  /*
   * Stap 0. Geeft { levering, controles: [{ok, let, tekst}] }. levering is null
   * als er een controle faalt. Alles wat de latere stappen nodig hebben, staat
   * in de levering; zo kan een wachtrij later een lijst leveringen worden.
   * test: al gefactureerd mag (waarschuwing in plaats van fout); de levering
   * krijgt dan test = true.
   */
  function leesLevering(rijTekst, ritaTekst, vestiging, nu, test) {
    var controles = [];
    function c(ok, tekst) { controles.push({ ok: !!ok, tekst: tekst }); return !!ok; }
    /* Alleen in testmodus: niet goed is een waarschuwing, geen fout. */
    function cTest(ok, tekst) {
      if (ok || !test) return c(ok, tekst);
      controles.push({ ok: true, let: true, tekst: 'Test: ' + tekst });
      return false;
    }

    var pr = parseLeveringsrij(rijTekst);
    if (pr.fout) { c(false, pr.fout); return { levering: null, controles: controles }; }
    var ri = parseRita(ritaTekst);
    if (ri.fout) { c(false, ri.fout); return { levering: null, controles: controles }; }
    var rij = pr.rij;

    c(/^[A-Z]+-\d+$/i.test(rij.levering), 'Leveringsnummer ' + (rij.levering || '(leeg)') +
      (/^[A-Z]+-\d+$/i.test(rij.levering) ? '' : ' niet herkend (meerdere leveringen in één rij? Dan zelf doen).'));
    c(zelfdeLevering(rij.levering, ri.levering), zelfdeLevering(rij.levering, ri.levering) ?
      'Rita staat op dezelfde levering.' : 'Rita staat op levering ' + ri.levering + ', de rij is ' + rij.levering + '. Typ de juiste levering in Rita I2.');

    var rt = route(rij.klant, ri);
    if (!c(!rt.weiger, rt.weiger || (rt.soort === 'rataplan' ? 'RataPlan-levering.' : 'Reguliere afnemer.'))) {
      return { levering: null, controles: controles };
    }

    c(/^\d{8}$/.test(rij.klantId), /^\d{8}$/.test(rij.klantId) ? 'KlantID ' + rij.klantId + '.' : 'KlantID is geen 8 cijfers (' + (rij.klantId || 'leeg') + ').');
    var datum = normDatum(rij.ophaal);
    c(datum, datum ? 'Ophaaldatum ' + datum + '.' : 'Ophaaldatum niet herkend (' + (rij.ophaal || 'leeg') + '), verwacht d-m-jjjj.');
    c(isJa(rij.uitgeleverd), isJa(rij.uitgeleverd) ? 'Uitgeleverd.' : 'Uitgeleverd? staat op "' + (rij.uitgeleverd || 'leeg') + '": pas factureren na uitlevering.');
    var alGefactureerd = isJa(rij.gefactureerd) || isNvt(rij.gefactureerd);
    cTest(!alGefactureerd, alGefactureerd ? 'Gefactureerd staat al op "' + rij.gefactureerd + '".' : 'Nog niet gefactureerd.');
    var orderLeeg = !rij.orderId || rij.orderId === '-';
    cTest(orderLeeg, orderLeeg ? 'Nog geen Order ID.' : 'Er staat al een Order ID (' + rij.orderId + '). Geen tweede order zonder afstemming met Finance.');

    c(ri.controle === 'Klopt', ri.controle === 'Klopt' ? 'Rita-controle: Klopt.' : 'Rita-controle zegt "' + (ri.controle || 'niets') + '". Eerst RITA en de leveringslijst laten aansluiten.');
    ri.voorlopig.forEach(function (v) { c(false, 'Rita: ' + v + '.'); });

    var vest = String(vestiging || '').trim();
    if (rt.soort === 'rataplan') {
      c(/^Definitief/.test(ri.staffel), /^Definitief/.test(ri.staffel) ? 'Staffel: ' + ri.staffel + '.' : 'Staffel is niet definitief (' + (ri.staffel || 'leeg') + ').');
      c(vest, vest ? 'Vestiging: ' + vest + '.' : 'RataPlan: vul de vestiging in (komt in de Reference).');
    }

    /* Orderregels: alleen groepen met aantal > 0; elk met product-ID en één prijs. */
    var regels = [], som = 0, totaalCenten = 0, regelsOk = true;
    ri.regels.forEach(function (g) {
      var n = parseInt(g.aantal, 10);
      if (!(n > 0)) return;
      som += n;
      var naam = n + '× ' + g.omschrijving;
      if (!/^\d{5,7}$/.test(g.productId)) { regelsOk = c(false, naam + ': geen product-ID in Rita.') && regelsOk; return; }
      if (g.opmerking) { regelsOk = c(false, naam + ': ' + g.opmerking + '. Eerst oplossen (verschillende prijzen = splitsen, werkinstructie 4.3).') && regelsOk; return; }
      var prijs = normPrijs(g.prijzen[0]);
      if (!prijs) { regelsOk = c(false, naam + ': geen geldige prijs (' + (g.prijzen[0] || 'leeg') + ').') && regelsOk; return; }
      var extra = g.prijzen.slice(1).filter(function (p) { return p; });
      if (extra.length) { regelsOk = c(false, naam + ': meer dan één prijs in Rita. Eerst splitsen.') && regelsOk; return; }
      regels.push({ productId: g.productId, omschrijving: g.omschrijving, aantal: n, prijs: prijs, centen: centen(prijs) });
      totaalCenten += n * centen(prijs);
    });
    c(regels.length || !regelsOk, regels.length || !regelsOk ? '' : 'Geen producten in Rita.');
    var totaal = parseInt(ri.totaal, 10);
    c(som === totaal, som === totaal ? 'Aantallen: ' + som + ' = totaal in Rita.' : 'Aantallen tellen op tot ' + som + ', Rita-totaal is ' + (ri.totaal || 'leeg') + '.');

    var reference = rij.levering + (rt.soort === 'rataplan' ? ' - ' + vest : '') + ' (' + (datum || '') + ')';
    var taaktekst = TAAK_KOP + '\n' + regels.map(function (r) { return r.aantal + 'x ' + r.productId + ' - ' + r.omschrijving; }).join('\n');
    var nt = nietTypbaar(reference);
    c(!nt.length, nt.length ? 'Reference bevat tekens die niet getypt kunnen worden: ' + nt.join(' ') : 'Reference: ' + reference);
    nt = nietTypbaar(taaktekst);
    c(!nt.length, nt.length ? 'Taaktekst bevat tekens die niet getypt kunnen worden: ' + nt.join(' ') : 'Taaktekst typbaar.');

    controles = controles.filter(function (x) { return x.tekst; });
    if (controles.some(function (x) { return !x.ok; })) return { levering: null, controles: controles };
    return {
      controles: controles,
      levering: {
        nummer: rij.levering, klant: rij.klant, klantId: rij.klantId, ophaal: datum,
        soort: rt.soort, vestiging: vest, regels: regels, totaalCenten: totaalCenten,
        reference: reference, taaktekst: taaktekst, maand: factuurMaand(nu || new Date()),
        stap: 0, ordernummer: '', test: !!test,
        /* Wat er al in de sheet staat, om in testmodus te vergelijken. */
        bestaand: { orderId: orderLeeg ? '' : rij.orderId, bedrag: rij.bedrag, maand: rij.maand }
      }
    };
  }

  /* Uitvoer: één regel voor AF:AH, en J apart. */
  function uitvoerAF(lev) { return [lev.maand, lev.ordernummer, bedrag(lev.totaalCenten)].join('\t'); }
  function uitvoerJ(lev) { return lev.soort === 'stocklear' ? 'Nee' : 'Ja'; }

  /* ---------- gedeelde staat ---------- */

  var vr = W.__vr || (W.__vr = { levering: null, bezig: false, stop: false });
  var focusBijStart = document.activeElement;
  if (focusBijStart && focusBijStart !== document.body && focusBijStart.id !== PANEEL_ID) vr.doel = focusBijStart;

  /* ---------- wachten zonder throttling (uit ../Vanessa) ---------- */
  /*
   * Chrome remt setTimeout af in een venster dat verborgen is. Timers in een
   * Worker hebben daar geen last van. Lukt de Worker niet (CSP), dan gewoon
   * setTimeout.
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

  /* ---------- klikreeksen (uit ../Vanessa) ---------- */
  /*
   * De gebruiker doet een klikreeks één keer voor; de tool legt elke klik vast
   * als fractie van het element waarop geklikt werd, plus de maat van dat
   * element, toetsen en de pauzes ertussen. Per schermprofiel, want op een
   * ander scherm schuiven Vanessa's knoppen anders op. Vóór elke klik een
   * maatcontrole. Opgeslagen in localStorage: alleen posities en toetsen.
   */
  function schermSleutel() {
    return W.screen.width + 'x' + W.screen.height + '@' + Math.round((W.devicePixelRatio || 1) * 100) / 100;
  }
  function leesProfielen() {
    try { return JSON.parse(localStorage.getItem(KEY_PROFIELEN) || '{}') || {}; } catch (e) { return {}; }
  }
  function bewaarProfielen(p) { try { localStorage.setItem(KEY_PROFIELEN, JSON.stringify(p)); } catch (e) { /* niet erg */ } }
  function leesReeksen() {
    var p = leesProfielen()[schermSleutel()];
    return (p && p.reeksen) || {};
  }
  function bewaarReeksen(r) {
    var ps = leesProfielen(), k = schermSleutel();
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
          Math.round(stap.mw) + '×' + Math.round(stap.mh) + '. Zet AppStream op dezelfde venstergrootte, of neem opnieuw op');
      }
    }
    return { el: el, fx: stap.fx, fy: stap.fy };
  }

  /* Muisklik op een punt, als fractie van het element. detail 2 = tweede klik van een dubbelklik. */
  function klikOp(pos, detail) {
    detail = detail || 1;
    var el = pos.el;
    if (!el || !el.isConnected) throw new Error('het doel-element bestaat niet meer, neem de reeks opnieuw op');
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

  function neemOp(e) {
    if (!vr.opname || !e.isTrusted) return;
    var nu = Date.now(), wacht = nu - vr.opname.laatst;
    vr.opname.laatst = nu;
    if (e.type === 'pointerdown') {
      var el = e.target, r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      vr.opname.stappen.push({ soort: 'klik', sel: selectorVan(el), fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height,
        mw: Math.round(r.width), mh: Math.round(r.height), wacht: wacht });
    } else {
      if (/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) return;
      var mods = [];
      if (e.ctrlKey) mods.push('ctrl');
      if (e.metaKey) mods.push('meta');
      if (e.altKey) mods.push('alt');
      if (e.shiftKey) mods.push('shift');
      vr.opname.stappen.push({ soort: 'toets', key: e.key, code: e.code, mods: mods, wacht: wacht });
    }
    if (vr.ui) {
      var k = vr.opname.stappen.filter(function (x) { return x.soort === 'klik'; }).length;
      vr.ui.status('Opname "' + vr.opname.naam + '" loopt: ' + k + ' klikken, ' + (vr.opname.stappen.length - k) +
        ' toetsen gezien. Druk hier Stop opname als je klaar bent.', 'bezig');
    }
  }

  var DUBBEL_MS = 400;
  /* Twee klikken vlak na elkaar op dezelfde plek: dat was een dubbelklik. */
  function isDubbel(a, b) {
    return a && b && a.soort === 'klik' && b.soort === 'klik' && a.sel === b.sel &&
      (b.wacht || 0) < DUBBEL_MS && Math.abs(a.fx - b.fx) < 0.01 && Math.abs(a.fy - b.fy) < 0.01;
  }
  /* Opgenomen pauzes zoals ze waren, min. 300 ms, max. 10 s; de eerste (vóór de eerste klik) 300 ms. */
  function pauzeVan(st, i) { return i === 0 ? 300 : Math.min(10000, Math.max(300, st.wacht || 0)); }

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

  function beschrijfReeks(r) {
    var dub = r.filter(function (x, i) { return isDubbel(r[i - 1], x); }).length;
    var k = r.filter(function (x) { return x.soort === 'klik'; }).length - dub;
    var t = r.filter(function (x) { return x.soort === 'toets'; }).length;
    return k + ' klik' + (k === 1 ? '' : 'ken') + (dub ? ' (waarvan ' + dub + ' dubbel)' : '') + ', ' + t + ' toets' + (t === 1 ? '' : 'en');
  }

  function toonMarkers(naam) {
    Array.prototype.forEach.call(document.querySelectorAll('.vr-marker'), function (m) { m.remove(); });
    if (!naam) return 0;
    var n = 0, r = leesReeksen()[naam] || [];
    r.forEach(function (st, i) {
      if (st.soort !== 'klik' || isDubbel(r[i - 1], st)) return;
      n++;
      var el; try { el = document.querySelector(st.sel); } catch (e) { el = null; }
      if (!el) return;
      var b = el.getBoundingClientRect();
      var m = document.createElement('div');
      m.className = 'vr-marker';
      m.textContent = n;
      m.style.cssText = 'position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,102,0,.85);' +
        'color:#fff;font:bold 11px/18px sans-serif;text-align:center;pointer-events:none;z-index:2147483646;' +
        'left:' + (b.left + st.fx * b.width) + 'px;top:' + (b.top + st.fy * b.height) + 'px';
      document.body.appendChild(m);
    });
    return n;
  }

  /* ---------- uitvoeren (uit ../Vanessa) ---------- */

  function meld(tekst, soort) { if (vr.ui) vr.ui.status(tekst, soort); }

  /* Wie zelf in AppStream klikt of typt terwijl een stap loopt, stopt hem.
     Klikken in het paneel komt hier niet langs, dat is een eigen frame. */
  function stoorder(e) {
    if (vr.bezig && e.isTrusted) { vr.stop = true; vr.reden = 'je klikte of typte zelf in AppStream'; }
  }
  /* pointerdown, niet alleen mousedown: de AppStream-client onderdrukt pointerdown.
     Luisteraars van een eerdere versie eerst weg. */
  /* Elke eigen klik, toets of focus in AppStream wijst het stream-element aan. */
  function leerDoel(e) { if (isStreamKandidaat(e.target)) vr.doel = e.target; }
  if (vr.luisteraars) vr.luisteraars.forEach(function (l) { W.removeEventListener(l[0], l[1], true); });
  vr.luisteraars = [['keydown', stoorder], ['pointerdown', stoorder], ['mousedown', stoorder],
    ['focusin', leerDoel], ['pointerdown', leerDoel], ['mousedown', leerDoel], ['keydown', leerDoel],
    ['pointerdown', neemOp], ['keydown', neemOp]];
  vr.luisteraars.forEach(function (l) { W.addEventListener(l[0], l[1], true); });

  function voerUit(plan, tempo) {
    var doel = doelElement();
    vr.laatsteDoel = doel;
    if (!doel) {
      meld('De tool weet nog niet waar de toetsen heen moeten. Klik één keer in Vanessa (op een lege plek) en probeer opnieuw.', 'fout');
      return Promise.resolve(false);
    }
    /* Wie in het paneel klikte, haalde de focus weg bij de stream: teruggeven. */
    if (document.activeElement !== doel && doel.focus) { try { doel.focus(); } catch (e) { /* niet erg */ } }
    vr.bezig = true; vr.stop = false; vr.reden = '';
    var label = '';
    var i = 0;

    function volgende() {
      if (vr.stop) return Promise.reject(new Error(vr.reden || 'gestopt'));
      if (i >= plan.length) return Promise.resolve();
      var s = plan[i++];
      if (s.soort === 'label') { label = s.s; meld(label + '…'); return volgende(); }
      if (s.soort === 'wacht') return slaap(s.vast ? s.ms : s.ms * tempo).then(volgende);
      if (s.soort === 'klik') {
        var pos;
        try { pos = zoekPos(s); klikOp(pos, 1); } catch (e) { return Promise.reject(e); }
        if (s.aantal !== 2) return slaap(GAT_MS * tempo).then(volgende);
        return slaap(60).then(function () { klikOp(pos, 2); return slaap(GAT_MS * tempo); }).then(volgende);
      }
      if (s.soort === 'toets' && s.langzaam) {
        return drukLangzaam(doel, s.key, s.code, s.mods).then(function () { return slaap(GAT_MS * tempo); }).then(volgende);
      }
      if (s.soort === 'toets') {
        druk(doel, s.key, s.code, s.mods);
        return slaap(GAT_MS * tempo).then(volgende);
      }
      if (s.soort === 'tekst') {
        var j = 0;
        var typ = function () {
          if (vr.stop) return Promise.reject(new Error(vr.reden || 'gestopt'));
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
      vr.bezig = false;
      return true;
    }, function (err) {
      vr.bezig = false;
      vr.laatsteFout = err.message;
      laatModsLos(doel);
      meld('Gestopt bij "' + label + '": ' + err.message + '. Kijk in Vanessa wat er al gedaan is.', 'fout');
      return false;
    });
  }

  /* ---------- paneel ---------- */
  /*
   * Een iframe in de pagina zelf (zoals ../Vanessa). Geen gewone div: klikken
   * en toetsen daarin zouden opborrelen naar de AppStream-client en in Vanessa
   * belanden.
   */

  function lees(k, std) { try { var v = localStorage.getItem(k); return v === null ? std : v; } catch (e) { return std; } }
  function bewaar(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* niet erg */ } }

  var CSS = [
    'html,body{margin:0;background:#fff}',
    'body{font:13px -apple-system,Segoe UI,sans-serif;color:#333333}',
    '.header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;background:#0090e3;color:#fff;padding:8px 10px 8px 14px}',
    '.titel{font-size:15px;font-weight:700;white-space:nowrap}',
    '.kop-versie{font-size:11px;opacity:.75;margin-left:-3px}',
    '#kopstatus{flex:1;font-size:11px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.toggle-btn{flex-shrink:0;background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:4px;width:24px;height:24px;font:inherit;font-size:14px;cursor:pointer;padding:0}',
    '.toggle-btn:hover{background:rgba(255,255,255,.32)}',
    '.content{padding:4px 14px 12px}',
    'label{display:block;font-size:13px;font-weight:600;margin:10px 0 5px}',
    '.section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999999;margin:14px 0 2px;border-top:1px solid #DDDDDD;padding-top:10px}',
    'input,textarea{box-sizing:border-box;width:100%;padding:6px 8px;border:1px solid #DDDDDD;border-radius:6px;font:inherit}',
    'textarea{height:54px;resize:vertical;font-size:11px}',
    '.rij{display:flex;gap:6px;margin-bottom:5px;align-items:center}',
    '.ux-btn{flex:1;padding:6px 8px;border:1px solid #cce9f9;background:#F2F7FC;color:#285dab;border-radius:8px;font:inherit;cursor:pointer}',
    '.ux-btn:disabled{opacity:.45;cursor:default}',
    '.ux-btn.selected{background:#d4edda;border-color:#00B900;color:#155724;font-weight:600}',
    '.klein{flex:0 0 auto;padding:4px 7px;font-size:12px}',
    'select{box-sizing:border-box;width:100%;padding:6px 8px;border:1px solid #DDDDDD;border-radius:6px;font:inherit;background:#fff}',
    '.submit-btn{flex:1;padding:9px;border:0;border-radius:8px;background:#0090e3;color:#fff;font:inherit;font-weight:600;cursor:pointer}',
    '.submit-btn:hover{background:#007bc4}',
    '.gedempt{color:#999999;font-size:11px}',
    '.controles{list-style:none;margin:6px 0;padding:0;font-size:12px}',
    '.controles li{padding:2px 0 2px 20px;position:relative;line-height:1.4}',
    '.controles li:before{position:absolute;left:2px;font-weight:700}',
    '.controles li.ok:before{content:"\\2713";color:#00B900}',
    '.controles li.fout{color:#E50000}',
    '.controles li.fout:before{content:"\\2717"}',
    '.controles li.let{color:#856404}',
    '.controles li.let:before{content:"!";color:#ffc107;left:5px}',
    '.vink{display:flex;gap:6px;align-items:flex-start;font-weight:400;font-size:12px;margin:10px 0 0}',
    '.vink input{width:auto;margin:2px 0 0}',
    '.pill-amber{background:#fff8e1;color:#856404;border-radius:4px;padding:1px 5px;font-size:11px;font-weight:700;letter-spacing:0;text-transform:none}',
    '.kop-stop{flex-shrink:0;background:#E50000;border:0;color:#fff;border-radius:4px;height:24px;padding:0 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
    '.uitslag{border-radius:6px;padding:7px 9px;font-size:12px;margin-top:6px;line-height:1.45}',
    '.uitslag.geen{background:#d4edda;border:1px solid #00B900;color:#155724}',
    '.uitslag.melding{background:#fff8e1;border:1px solid #ffc107;color:#856404}',
    '.uitslag.fout{background:#fff0f0;border:1px solid #E50000;color:#E50000}',
    '.uitslag pre{background:rgba(255,255,255,.6);color:#333333}',
    '.testblok{background:#fff8e1;border:1px solid #ffc107;color:#856404;border-radius:6px;padding:7px 9px;font-size:12px;margin-top:6px;line-height:1.45}',
    'table{border-collapse:collapse;width:100%;font-size:12px;margin:4px 0}',
    'td,th{text-align:left;padding:3px 6px;border-bottom:1px solid #EEEEEE}',
    'td.getal,th.getal{text-align:right;font-variant-numeric:tabular-nums}',
    'details summary{cursor:pointer;font-size:12px;color:#285dab;margin-top:8px}',
    'pre{background:#F3F3F3;border-radius:6px;padding:6px 8px;font-size:11px;white-space:pre-wrap;margin:4px 0}',
    '.info-box{background:#F2F7FC;border:1px solid #cce9f9;border-radius:6px;padding:7px 9px;font-size:11px;margin-top:8px;line-height:1.45}',
    '#status{margin-top:10px;font-size:12px;padding:7px 9px;border-radius:6px;display:none;line-height:1.45}',
    '#status.bezig{display:block;background:#fff8e1;border:1px solid #ffc107;color:#856404}',
    '#status.ok{display:block;background:#d4edda;border:1px solid #00B900;color:#155724}',
    '#status.fout{display:block;background:#fff0f0;border:1px solid #E50000;color:#E50000}',
    'body.dicht .content{display:none}',
    'body.onder{height:100vh;display:flex;flex-direction:column;overflow:hidden}',
    'body.onder .header{position:static;flex:0 0 auto}',
    'body.onder .content{flex:1;min-height:0;padding:0 14px}',
    'body.onder .kolommen{display:grid;grid-template-columns:minmax(240px,1fr) minmax(300px,1.6fr) minmax(320px,1.5fr);gap:16px;height:100%}',
    'body.onder .kol{overflow:auto;min-height:0;padding:6px 2px 10px}',
    'body.onder .kol-levering,body.onder .kol-test{border-left:1px solid #DDDDDD;padding-left:16px}',
    '.stap{border:1px solid #EEEEEE;border-radius:6px;padding:6px 8px;margin-top:6px}',
    '.stap.onomkeerbaar{border-color:#ffc107}',
    '.stap-kop{display:flex;gap:6px;align-items:center;font-size:12px;font-weight:600;color:#285dab}',
    '.stap-kop span{flex:1}',
    '.stap input{font-family:Menlo,monospace;font-size:11px;padding:4px 6px}',
    '.stap .uitslag{font-size:11px;padding:5px 7px}',
    '.uitslag .lijn{white-space:pre-wrap;word-break:break-all}',
    'code{font-family:Menlo,monospace;font-size:11px;background:#F3F3F3;border-radius:3px;padding:0 3px}',
    'body:not(.onder) #kopstatus,body:not(.onder) .kop-versie{display:none}',
    'body:not(.onder) .header .titel{flex:1}'
  ].join('');

  var HTML = '<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>' +
    '<div class="header"><span class="titel">Refurbished</span><span class="kop-versie">v' + VERSIE + '</span><span id="kopstatus"></span>' +
    '<button class="kop-stop" id="stop-kop" title="Stop wat er nu loopt">Stop</button>' +
    '<button class="toggle-btn" id="hoogte" title="Lagere of hogere balk">↕</button>' +
    '<button class="toggle-btn" id="kant" title="Positie: onder, rechts, links">⇆</button>' +
    '<button class="toggle-btn" id="vouw" title="In-/uitklappen">–</button>' +
    '<button class="toggle-btn" id="sluit" title="Sluiten">×</button></div>' +
    '<div class="content"><div class="kolommen"><div class="kol kol-invoer">' +
    '<div class="section-label" style="border:0;margin-top:6px;padding-top:0">0 · Levering inlezen</div>' +
    '<label for="rij">Rij uit de Leveringslijst</label>' +
    '<textarea id="rij" placeholder="Klik op het rijnummer links, Cmd+C, hier Cmd+V"></textarea>' +
    '<label for="rita">Rita Mastersheet, Leveringslijst print - Categori</label>' +
    '<textarea id="rita" placeholder="Levering in I2, dan A1:K215 selecteren, Cmd+C, hier Cmd+V"></textarea>' +
    '<label for="vestiging">Vestiging <span class="gedempt">(alleen RataPlan)</span></label>' +
    '<input id="vestiging" placeholder="bijv. Voorbeeldstad">' +
    '<label class="vink"><input type="checkbox" id="testmodus"><span>Testmodus: al gefactureerde levering toestaan ' +
    '<span class="gedempt">(om te vergelijken met de bestaande order; niets terug naar de sheet)</span></span></label>' +
    '<div class="rij" style="margin-top:8px"><button class="submit-btn" id="b-inlezen">Inlezen en controleren</button><button class="ux-btn" id="b-wis" style="flex:0 0 auto">Wis</button></div>' +
    '<div id="status"></div>' +
    '</div><div class="kol kol-levering"><div id="levering"><div class="gedempt" style="margin-top:8px">Nog geen levering ingelezen.</div></div></div>' +
    '<div class="kol kol-test">' +
    '<div class="section-label" style="border:0;margin-top:6px;padding-top:0">Testbank (Vanessa)</div>' +
    '<div class="info-box" style="margin-top:4px">Klik niet in Vanessa terwijl een knop loopt, dan stopt hij. Het AppStream-tabblad moet voorop staan (klembord).</div>' +
    '<div class="rij" style="margin-top:6px"><button class="ux-btn" id="b-melding" title="Merkteken op het klembord, Cmd+C naar Vanessa, klembord teruglezen">2 · Controle op melding</button></div>' +
    '<div id="melding"></div>' +
    '<div class="rij" style="margin-top:10px"><button class="ux-btn" id="b-weggooien" title="Controle, kruisje rechtsboven (klikreeks weggooien), alleen bij de opslaan-vraag N, controle">3 · Weggooien (W)</button></div>' +
    '<div class="gedempt">Gooit een <b>niet-opgeslagen</b> order weg: kruisje, dan N op "Save changes to current record?". Bij elke andere melding drukt hij niets.</div>' +
    '<div id="w-uitslag"></div>' +
    '<details id="reeksen"><summary>Klikreeksen</summary>' +
    '<div class="rij" style="margin-top:6px"><select id="reeks-naam"></select><input id="reeks-nieuw" placeholder="of nieuwe naam"></div>' +
    '<div class="rij"><button class="ux-btn" id="b-opname">● Opnemen</button><button class="ux-btn" id="b-speel">▶ Afspelen</button></div>' +
    '<div class="rij"><button class="ux-btn" id="b-markers">Toon posities</button><button class="ux-btn klein" id="b-wisreeks">Wis reeks</button></div>' +
    '<div class="gedempt" id="reeksinfo"></div>' +
    '<div class="info-box"><b>weggooien</b> = één klik op het kruisje rechtsboven van het ordervenster. Opnemen: druk Opnemen, klik in Vanessa op het kruisje, ' +
    'druk N als de opslaan-vraag komt (of laat die staan), druk hier Stop opname. De N hoort niet in de reeks: die drukt knop 3 zelf, na de controle. ' +
    'Typ tijdens opnemen geen klantgegevens. Reeksen horen bij dit scherm (<span id="profielinfo"></span>).</div>' +
    '</details>' +
    '<div class="section-label">Stappen, elk los te testen</div>' +
    '<div class="rij"><label for="regel-keuze" style="margin:0;flex:0 0 auto;font-size:12px">Orderregel</label><select id="regel-keuze"></select></div>' +
    '<div id="teststappen"></div>' +
    '<details id="sjabloonhulp"><summary>Hoe schrijf je een sjabloon</summary><div class="info-box">' +
    'Woorden met spaties ertussen. <code>Tab</code> <code>Enter</code> <code>Down</code> <code>F4</code> <code>Esc</code> <code>Space</code> · ' +
    'met modifiers (langzaam aangeslagen): <code>Ctrl+Shift+Insert</code> <code>Alt+Down</code> <code>Ctrl+Tab</code> · herhalen: <code>Tab*3</code> · ' +
    'typen: <code>"tekst"</code> of een plaatshouder <code>{klant}</code> · wachten: <code>wacht:500</code> · klikreeks: <code>reeks:naam</code> · ' +
    'lezen: <code>lees</code> (langzame Cmd+C, toont wat er op het klembord komt: veldinhoud of melding).<br>' +
    'Plaatshouders: <code>{klant}</code> <code>{levering}</code> <code>{reference}</code> <code>{datum}</code> <code>{datum_slash}</code> <code>{vestiging}</code> ' +
    '<code>{telefoon}</code> (tien nullen) <code>{product}</code> <code>{omschrijving}</code> <code>{aantal}</code> <code>{prijs}</code> <code>{prijs_punt}</code> ' +
    '<code>{taaktekst}</code> (regeleinden worden Enter). Alleen invullen als het veld leeg is: <code>alsleeg:{telefoon}</code>. Melding beantwoorden: <code>melding:"VAT free indicator"=N</code> (alleen bij precies die melding). In "Specify amount": <code>exclbtw</code> zet "Including 21% VAT" uit en controleert dat. Typ nooit klantgegevens letterlijk in een sjabloon: sjablonen worden bewaard.</div></details>' +
    '</div>' +
    '</div></div></body></html>';

  /* Onder: volle breedte tegen de onderrand. Rechts/links: smalle kolom. */
  function plaats(f, kant) {
    if (KANTEN.indexOf(kant) < 0) kant = 'onder';
    f.setAttribute('data-kant', kant);
    var s = f.style;
    if (kant === 'onder') {
      s.top = ''; s.bottom = '0'; s.left = '8px'; s.right = ''; s.width = 'calc(100% - 16px)';
      s.borderRadius = '10px 10px 0 0';
    } else {
      s.top = '70px'; s.bottom = ''; s.width = '360px'; s.borderRadius = '10px';
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
    f.style.cssText = 'position:fixed;top:70px;width:360px;height:200px;border:0;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.28);z-index:2147483647;background:#fff;color-scheme:light';
    plaats(f, lees(KEY_KANT, 'onder'));
    document.body.appendChild(f);

    var d = f.contentDocument;
    d.open(); d.write(HTML); d.close();
    plaats(f, f.getAttribute('data-kant'));

    var $ = function (id) { return d.getElementById(id); };
    function el(tag, cls, tekst) {
      var e = d.createElement(tag);
      if (cls) e.className = cls;
      if (tekst !== undefined) e.textContent = tekst;
      return e;
    }

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
    /* De levering staat in vr, dus sluiten en opnieuw openen verliest hem niet. */
    $('sluit').onclick = function () { vr.ui = null; f.remove(); };

    vr.ui = {
      status: function (tekst, soort) {
        if (!f.isConnected) return;
        var s = $('status');
        s.className = soort || 'bezig';
        s.textContent = tekst;
        $('kopstatus').textContent = tekst;
        maatPaneel(f);
      }
    };

    function kopieer(tekst, melding) {
      var klaar = function () { vr.ui.status(melding, 'ok'); };
      var terug = function () {
        var t = d.createElement('textarea'); t.value = tekst; d.body.appendChild(t); t.select();
        try { d.execCommand('copy'); klaar(); } catch (e) { vr.ui.status('Kopiëren lukte niet.', 'fout'); }
        t.remove();
      };
      if (f.contentWindow.navigator.clipboard) f.contentWindow.navigator.clipboard.writeText(tekst).then(klaar, terug);
      else terug();
    }

    /*
     * Klembord lezen/schrijven mag alleen als het tabblad voorop staat. Eerst via
     * het paneel, anders via de pagina zelf. Lukt geen van beide, dan wachten
     * tot het tabblad voorop komt, max. 60 s. (Uit ../Vanessa.)
     */
    function klembord(methode, arg) {
      var bronnen = [f.contentWindow.navigator.clipboard, W.navigator.clipboard].filter(function (c) { return c && c[methode]; });
      if (!bronnen.length) return Promise.reject(new Error('geen klembord'));
      var pogingen = 0;
      function poging() {
        return bronnen[0][methode](arg).catch(function () {
          return bronnen[1] ? bronnen[1][methode](arg) : Promise.reject();
        }).catch(function () {
          if (++pogingen > 200 || vr.stop) return Promise.reject(new Error('focus'));
          vr.ui.status('Wacht op het klembord: zet het AppStream-tabblad voorop.', 'bezig');
          return slaap(300).then(poging);
        });
      }
      return poging();
    }

    /*
     * Controle op melding: merkteken op het klembord, Cmd+C, en kijken wat er
     * terugkomt. Geeft { soort: 'geen' | 'melding' | 'fout', tekst, ruw }.
     * Kan het klembord niet gelezen worden, dan 'fout': liever stoppen dan
     * blind doorgaan.
     */
    /* Klembord lezen tot er iets anders dan het merkteken staat, max. n × 300 ms. */
    function leesTot(merk, n) {
      var pogingen = 0;
      return (function lees() {
        return klembord('readText').then(function (t) {
          t = String(t);
          if (t === merk && ++pogingen < n) return slaap(300).then(lees);
          return t;
        });
      })();
    }

    function uitslag(t) {
      var merkteken = /^vr-controle-\d+$/.test(t);
      if (isDialoog(t)) return { soort: 'melding', tekst: dialoogTekst(t), ruw: t, opslaanVraag: isOpslaanVraag(t) };
      return { soort: 'geen', ruw: merkteken ? '' : t };
    }

    function controleerDialoog() {
      var merk = 'vr-controle-' + Date.now();
      vr.leest = true;
      vr.laatsteDoel = undefined;
      return klembord('writeText', merk).then(function () {
        return voerUit(reeks(L('Controle op meldingen'), KL('c', ['meta'])), TEMPO);
      }).then(function (gelukt) {
        if (!gelukt && !vr.laatsteDoel) return { soort: 'fout', tekst: 'De tool weet nog niet waar de toetsen heen moeten. Klik één keer in Vanessa (op een lege plek) en probeer opnieuw.' };
        if (!gelukt) return { soort: 'fout', tekst: 'Cmd+C werd onderbroken (' + (vr.reden || 'gestopt') + ').' };
        return leesTot(merk, 10).then(uitslag);
      }).catch(function () {
        return { soort: 'fout', tekst: 'Klembord niet bereikbaar. Sta klembordtoegang toe en zet het AppStream-tabblad voorop.' };
      }).then(function (uit) { vr.leest = false; return uit; });
    }

    function toonMelding(uit) {
      var box = $('melding');
      box.innerHTML = '';
      var u = el('div', 'uitslag ' + uit.soort);
      if (uit.soort === 'geen') {
        u.appendChild(el('div', '', 'Geen melding open in Vanessa.'));
        if (uit.ruw) u.appendChild(el('div', 'gedempt', 'Wel iets anders gekopieerd (' + uit.ruw.length + ' tekens): het veld met de cursor?'));
      } else if (uit.soort === 'melding') {
        u.appendChild(el('div', '', 'Melding: ' + uit.tekst));
        if (uit.opslaanVraag) u.appendChild(el('div', '', 'Dit is de opslaan-vraag: W drukt hier N.'));
        u.appendChild(el('div', 'gedempt', 'Zo staat hij op het klembord:'));
        /* Regeleinden zichtbaar maken, zodat het formaat te zien is. */
        u.appendChild(el('pre', '', uit.ruw.replace(/\r/g, '\\r').replace(/\n/g, '\\n\n')));
      } else {
        u.appendChild(el('div', '', uit.tekst));
      }
      if (vr.laatsteDoel !== undefined) u.appendChild(el('div', 'gedempt', 'Toetsen gestuurd naar: ' + beschrijf(vr.laatsteDoel)));
      box.appendChild(u);
      maatPaneel(f);
    }

    $('b-melding').onclick = function () {
      if (vr.bezig || vr.leest) return;
      bezigKnoppen(true);
      vr.ui.status('Controle op melding…', 'bezig');
      controleerDialoog().then(function (uit) {
        bezigKnoppen(false);
        toonMelding(uit);
        vr.ui.status(uit.soort === 'geen' ? 'Geen melding.' : uit.soort === 'melding' ? 'Vanessa toont een melding.' : 'Controle niet gelukt.',
          uit.soort === 'geen' ? 'ok' : 'fout');
      });
    };

    /* afbreken: ook tussen twee regels van "Alle regels" (voerUit zet vr.stop bij elke start terug). */
    $('stop-kop').onclick = function () { vr.stop = true; vr.afbreken = true; vr.reden = 'gestopt met de knop'; };

    /* Alle knoppen die iets naar Vanessa sturen: dicht zolang er iets loopt. */
    var vanessaKnoppen = ['b-melding', 'b-weggooien', 'b-speel', 'b-opname'];
    function bezigKnoppen(aan) {
      vanessaKnoppen.forEach(function (id) { $(id).disabled = aan; });
      Array.prototype.forEach.call(d.querySelectorAll('.vb'), function (b) { b.disabled = aan; });
    }

    /*
     * W: een niet-opgeslagen order weggooien. Bewezen met de hand: kruisje
     * rechtsboven, dan N op "Save changes to current record?" (Yes heeft de
     * focus: nooit Enter). De tool drukt alleen N als precies die vraag openstaat.
     * Geeft { soort: 'ok' | 'let' | 'fout', tekst }.
     */
    function weggooien() {
      var plan = reeksPlan('weggooien');
      if (!plan) return Promise.resolve({ soort: 'fout', tekst: 'Neem eerst de klikreeks "weggooien" op (Klikreeksen hieronder): één klik op het kruisje rechtsboven van de order.' });
      return controleerDialoog().then(function (voor) {
        if (voor.soort === 'fout') return { soort: 'fout', tekst: voor.tekst };
        if (voor.soort === 'melding') return { soort: 'fout', tekst: 'Er staat al een melding open (' + voor.tekst + '). Niets gedaan; eerst zelf afhandelen.' };
        return voerUit(plan, TEMPO).then(function (gelukt) {
          if (!gelukt) return { soort: 'fout', tekst: 'Klik op het kruisje niet gelukt: ' + (vr.laatsteFout || 'gestopt') + '.' };
          return slaap(WACHT_DIALOOG_MS * TEMPO).then(controleerDialoog).then(function (na) {
            if (na.soort === 'fout') return { soort: 'fout', tekst: na.tekst };
            if (na.soort === 'geen') return { soort: 'let', tekst: 'Na het kruisje kwam geen opslaan-vraag. Of de order was ongewijzigd en is zonder vraag gesloten, of de klik viel naast het kruisje. Kijk in Vanessa.' };
            if (!na.opslaanVraag) return { soort: 'fout', tekst: 'Na het kruisje een andere melding: ' + na.tekst + '. Niets gedrukt; zelf afhandelen.' };
            vr.ui.status('Opslaan-vraag gezien: N…', 'bezig');
            return voerUit(reeks(L('N: niet opslaan'), K('n')), TEMPO).then(function (g2) {
              if (!g2) return { soort: 'fout', tekst: 'N niet verstuurd (' + (vr.laatsteFout || 'gestopt') + '). De opslaan-vraag staat nog open: druk zelf N.' };
              return slaap(500 * TEMPO).then(controleerDialoog).then(function (eind) {
                if (eind.soort === 'geen') return { soort: 'ok', tekst: 'Order weggegooid: opslaan-vraag beantwoord met N, geen melding meer.' };
                if (eind.soort === 'melding') return { soort: 'fout', tekst: 'Na N staat er nog een melding: ' + eind.tekst + '.' };
                return { soort: 'fout', tekst: 'N gedrukt, maar de controle daarna lukte niet: ' + eind.tekst };
              });
            });
          });
        });
      });
    }

    $('b-weggooien').onclick = function () {
      if (vr.bezig || vr.leest) return;
      bezigKnoppen(true);
      $('w-uitslag').innerHTML = '';
      vr.ui.status('Weggooien…', 'bezig');
      weggooien().then(function (uit) {
        bezigKnoppen(false);
        var u = el('div', 'uitslag ' + { ok: 'geen', let: 'melding', fout: 'fout' }[uit.soort], uit.tekst);
        $('w-uitslag').appendChild(u);
        vr.ui.status(uit.soort === 'ok' ? 'Weggegooid.' : uit.soort === 'let' ? 'Weggooien: kijk in Vanessa.' : 'Weggooien niet gelukt.', uit.soort === 'ok' ? 'ok' : 'fout');
      });
    };

    /* ---------- klikreeksen opnemen en afspelen ---------- */

    function vulReeksen(kies) {
      var namen = REEKSEN.concat(Object.keys(leesReeksen()).filter(function (n) { return REEKSEN.indexOf(n) < 0; }));
      $('reeks-naam').innerHTML = '';
      namen.forEach(function (n) { var o = d.createElement('option'); o.value = n; o.textContent = n; $('reeks-naam').appendChild(o); });
      if (kies) $('reeks-naam').value = kies;
      $('reeks-nieuw').value = '';
      var r = leesReeksen()[$('reeks-naam').value];
      $('reeksinfo').textContent = r && r.length ? 'Opgenomen: ' + beschrijfReeks(r) + '.' : 'Nog niet opgenomen.';
      $('profielinfo').textContent = schermSleutel();
      maatPaneel(f);
    }
    var markersAan = false;
    $('reeks-naam').onchange = function () { vulReeksen($('reeks-naam').value); if (markersAan) markersAan = !!toonMarkers($('reeks-naam').value); };
    vulReeksen();
    if (vr.opname) { $('b-opname').textContent = '■ Stop opname'; $('b-opname').classList.add('selected'); }

    $('b-opname').onclick = function () {
      if (vr.bezig || vr.leest) return;
      if (!vr.opname) {
        var naam = $('reeks-nieuw').value.trim() || $('reeks-naam').value;
        if (!/^[\w-]{1,30}$/.test(naam)) return vr.ui.status('Naam van een klikreeks: letters, cijfers, - en _, zonder spaties.', 'fout');
        vr.opname = { naam: naam, stappen: [], laatst: Date.now() };
        $('b-opname').textContent = '■ Stop opname';
        $('b-opname').classList.add('selected');
        vr.ui.status('Opname "' + vr.opname.naam + '" loopt: doe het nu in Vanessa, druk daarna hier Stop opname.', 'bezig');
        return;
      }
      var klaar = vr.opname; vr.opname = null;
      $('b-opname').textContent = '● Opnemen';
      $('b-opname').classList.remove('selected');
      /* Een N (of n) aan het eind hoort niet in "weggooien": die drukt knop 3 zelf, na de controle. */
      if (klaar.naam === 'weggooien') {
        while (klaar.stappen.length && klaar.stappen[klaar.stappen.length - 1].soort === 'toets' && /^n$/i.test(klaar.stappen[klaar.stappen.length - 1].key)) klaar.stappen.pop();
      }
      if (!klaar.stappen.length) return vr.ui.status('Niets opgenomen: de tool zag geen klikken of toetsen in Vanessa. Herlaad de AppStream-pagina, open het paneel opnieuw en probeer nog eens.', 'fout');
      var alle = leesReeksen();
      if (alle[klaar.naam] && !f.contentWindow.confirm('Reeks "' + klaar.naam + '" bestaat al. Overschrijven?')) return;
      alle[klaar.naam] = klaar.stappen;
      bewaarReeksen(alle);
      vulReeksen(klaar.naam);
      vr.ui.status('Reeks "' + klaar.naam + '" opgeslagen: ' + beschrijfReeks(klaar.stappen) + '.', 'ok');
    };

    $('b-speel').onclick = function () {
      if (vr.bezig || vr.leest) return;
      var plan = reeksPlan($('reeks-naam').value);
      if (!plan) return vr.ui.status('Reeks "' + $('reeks-naam').value + '" is nog niet opgenomen.', 'fout');
      bezigKnoppen(true);
      vr.ui.status('Klikreeks ' + $('reeks-naam').value + '…', 'bezig');
      voerUit(plan, TEMPO).then(function (gelukt) {
        bezigKnoppen(false);
        if (gelukt) vr.ui.status('Klikreeks ' + $('reeks-naam').value + ' afgespeeld.', 'ok');
      });
    };

    $('b-markers').onclick = function () {
      markersAan = !markersAan && !!toonMarkers($('reeks-naam').value);
      if (!markersAan) toonMarkers(null);
      $('b-markers').textContent = markersAan ? 'Verberg posities' : 'Toon posities';
    };

    $('b-wisreeks').onclick = function () {
      var n = $('reeks-naam').value, alle = leesReeksen();
      if (!alle[n]) return;
      if (!f.contentWindow.confirm('Reeks "' + n + '" wissen?')) return;
      delete alle[n]; bewaarReeksen(alle); toonMarkers(null); markersAan = false;
      $('b-markers').textContent = 'Toon posities';
      vulReeksen();
    };

    $('hoogte').onclick = function () {
      var nu = parseInt(lees(KEY_HOOGTE, HOOGTES[0]), 10);
      bewaar(KEY_HOOGTE, nu === HOOGTES[0] ? HOOGTES[1] : HOOGTES[0]);
      d.body.classList.remove('dicht');
      bewaar(KEY_DICHT, '0');
      maatPaneel(f);
    };

    /* ---------- testbank: elke stap los, met een aanpasbaar sjabloon ---------- */

    function leesSjablonen() { try { return JSON.parse(lees(KEY_SJABLONEN, '{}')) || {}; } catch (e) { return {}; } }
    /*
     * Bewaard per stap: { t: eigen sjabloon, std: de standaard van toen }. Oude
     * versies bewaarden alleen de tekst. Leeg = de standaard.
     */
    function eigenSjabloon(st) {
      var e = leesSjablonen()[st.id];
      if (e === undefined || e === null) return null;
      var t = typeof e === 'string' ? e : e.t;
      if (!t || t === st.std) return null;
      return { t: t, std: typeof e === 'string' ? null : e.std };
    }
    function sjabloonVan(st) { var e = eigenSjabloon(st); return e ? e.t : st.std; }
    /* Eigen sjabloon terwijl de standaard sindsdien veranderd is (of onbekend is waarop het gebaseerd was). */
    function standaardVeranderd(st) { var e = eigenSjabloon(st); return !!(e && st.std && e.std !== st.std); }
    function bewaarSjabloon(st, tekst) {
      /* Geen klantgegevens in localStorage: een sjabloon met een los lang getal wordt niet bewaard. */
      if (heeftLosGetal(tekst)) { vr.ui.status(st.label + ': sjabloon niet bewaard, er staat een lang getal in. Gebruik een plaatshouder ({klant}, {product} …).', 'fout'); return; }
      var s2 = leesSjablonen();
      if (!tekst || tekst === st.std) delete s2[st.id]; else s2[st.id] = { t: tekst, std: st.std };
      bewaar(KEY_SJABLONEN, JSON.stringify(s2));
    }

    function vulRegels() {
      var sel = $('regel-keuze'), lev = vr.levering, oud = sel.value;
      sel.innerHTML = '';
      if (!lev || !lev.regels.length) { var o0 = el('option', '', 'geen levering ingelezen'); o0.value = ''; sel.appendChild(o0); return; }
      lev.regels.forEach(function (r, i) {
        var o = el('option', '', (i + 1) + ' · ' + r.productId + ' ' + r.omschrijving + ' (' + r.aantal + '× ' + r.prijs + ')');
        o.value = String(i);
        sel.appendChild(o);
      });
      if (oud && +oud < lev.regels.length) sel.value = oud;
    }

    /* Langzame Cmd+C en het klembord teruglezen. Geeft de tekst ('' als er niets kwam). */
    function leesVeld() {
      var merk = 'vr-lees-' + Date.now();
      return klembord('writeText', merk).then(function () {
        return voerUit(reeks(L('Lees (Cmd+C)'), KL('c', ['meta'])), TEMPO);
      }).then(function (gelukt) {
        if (!gelukt) throw new Error(vr.laatsteFout || 'Cmd+C niet verstuurd');
        return leesTot(merk, 10);
      }).then(function (t) { return t === merk ? '' : t; });
    }

    function zichtbaar(t) { return String(t).replace(/\r/g, '\\r').replace(/\n/g, '\\n\n').slice(0, 400); }

    /* Wat een lees-stap moet opleveren: ordernummer (8+ cijfers) of totaal (bedrag). */
    function beoordeelLees(st, t, lev) {
      if (st.lees === 'ordernummer') {
        var m = String(t).match(/\d{8,}/);
        if (!m) return { soort: 'fout', tekst: 'Geen ordernummer (8+ cijfers) gelezen.' };
        if (lev && lev.bestaand && lev.bestaand.orderId) {
          var zelfde = m[0] === lev.bestaand.orderId.replace(/\D/g, '');
          return { soort: zelfde ? 'ok' : 'fout', tekst: 'Ordernummer ' + m[0] + (zelfde ? ' = Order ID in de sheet.' : ', in de sheet staat ' + lev.bestaand.orderId + '.') };
        }
        if (lev && !lev.test) { lev.ordernummer = m[0]; toonLevering(null); }
        return { soort: 'ok', tekst: 'Ordernummer ' + m[0] + (lev && !lev.test ? ' (ingevuld bij stap 12).' : '.') };
      }
      if (st.lees === 'totaal') {
        var p = normPrijs(t);
        if (!p) return { soort: 'fout', tekst: 'Geen bedrag gelezen.' };
        if (!lev) return { soort: 'ok', tekst: 'Bedrag ' + p + ' (geen levering om mee te vergelijken).' };
        var c = centen(p);
        if (c === lev.totaalCenten) return { soort: 'ok', tekst: 'Totaal ' + p + ' = berekend totaal excl. btw.' };
        if (Math.abs(Math.round(lev.totaalCenten * 1.21) - c) <= 1) return { soort: 'let', tekst: 'Totaal ' + p + ' is het bedrag incl. btw (excl. = ' + bedrag(lev.totaalCenten) + ').' };
        return { soort: 'fout', tekst: 'Totaal ' + p + ', berekend excl. btw ' + bedrag(lev.totaalCenten) + '.' };
      }
      return null;
    }

    /*
     * Eén teststap: sjabloon ontleden (fouten vóór de start), stukken tussen
     * "lees" uitvoeren, na elke lees het klembord tonen, en zonder lees aan het
     * eind een controle op melding. Geeft { soort, regels: [[soort, tekst]] }.
     */
    function voerTeststapUit(st, tekst, regelIdx) {
      var lev = vr.levering;
      if (regelIdx === undefined) regelIdx = parseInt($('regel-keuze').value, 10) || 0;
      var p = parseSjabloon(tekst, waardenVan(lev, regelIdx));
      if (p.fout) return Promise.resolve({ soort: 'fout', regels: [['fout', 'Sjabloon: ' + p.fout + '.']] });
      if (!p.stappen.length) return Promise.resolve({ soort: 'fout', regels: [['fout', 'Sjabloon is leeg.']] });
      /* Opslaan (Cmd+Enter) maakt een echte order: alleen in een onomkeerbare stap, met bevestiging (0.8.1). */
      var slaatOp = p.stappen.some(function (x) { return x.soort === 'toets' && x.key === 'Enter' && x.mods.indexOf('meta') >= 0; });
      if (slaatOp && !st.onomkeerbaar) {
        return Promise.resolve({ soort: 'fout', regels: [['fout', 'Cmd+Enter slaat de order op (maakt een echte order); dat hoort in stap 5 · Order bevestigen. Haal Cmd+Enter uit dit sjabloon (↺ zet de standaard terug).']] });
      }
      if (st.onomkeerbaar) {
        if (!lev) return Promise.resolve({ soort: 'fout', regels: [['fout', 'Onomkeerbare stap: lees eerst de levering in waarvoor je echt factureert.']] });
        /* Allow packing pas als het totaal (stap 7) als kloppend is bevestigd (0.9.1). */
        if (st.id === 'packing' && !lev.totaalOk) return Promise.resolve({ soort: 'fout', regels: [['fout', 'Eerst stap 7: het totaal in Vanessa controleren en op "Klopt" drukken.']] });
        if (lev.test) return Promise.resolve({ soort: 'fout', regels: [['fout', 'Onomkeerbare stap: niet bij een testlevering.']] });
        if (!f.contentWindow.confirm(st.label + ' voor levering ' + lev.nummer + '.\n\nDit maakt iets in Vanessa dat je niet zomaar terugdraait. Sjabloon:\n' + tekst + '\n\nDoorgaan?')) {
          return Promise.resolve({ soort: 'fout', regels: [['fout', 'Niet gedaan.']] });
        }
      }
      var stukken = [[]];
      p.stappen.forEach(function (x) {
        if (x.soort === 'lees' || x.soort === 'alsleeg' || x.soort === 'melding' || x.soort === 'exclbtw') stukken.push(x, []); else stukken[stukken.length - 1].push(x);
      });
      var regels = [], laatsteLees = null;
      var heeftLees = p.stappen.some(function (x) { return x.soort === 'lees'; });
      var i = 0;
      function volgende() {
        if (i >= stukken.length) return Promise.resolve(true);
        var stuk = stukken[i++];
        if (stuk.soort === 'lees') {
          return leesVeld().then(function (t) {
            laatsteLees = t;
            if (isDialoog(t)) { regels.push(['melding', 'Melding: ' + dialoogTekst(t)]); return false; }
            regels.push(['lijn', 'Gelezen: ' + (t ? zichtbaar(t) : '(niets)')]);
            return volgende();
          });
        }
        /* alsleeg: alleen typen als het veld leeg is. De inhoud niet tonen (bijv. een telefoonnummer). */
        /*
         * melding:"fragment"=Toets: staat er een melding met dat fragment, dan die
         * toets en opnieuw kijken (max. 3 keer). Andere melding: stoppen. Geen: door.
         */
        if (stuk.soort === 'melding') {
          var keer = 0;
          return (function kijk() {
            return leesVeld().then(function (t) {
              if (!isDialoog(t)) {
                regels.push(['lijn', keer ? 'Melding "' + stuk.fragment + '" beantwoord met ' + stuk.naam + '.' : 'Geen melding "' + stuk.fragment + '" (kwam niet).']);
                return volgende();
              }
              if (String(t).indexOf(stuk.fragment) < 0 || ++keer > 3) {
                regels.push(['melding', 'Melding: ' + dialoogTekst(t) + (keer > 3 ? ' (bleef staan na ' + stuk.naam + ')' : '') + '. Niets gedrukt; zelf afhandelen.']);
                return false;
              }
              return voerUit(reeks(L(st.label + ' (melding: ' + stuk.naam + ')'), [{ soort: 'toets', key: stuk.toets.key, code: stuk.toets.code, mods: stuk.toets.mods, langzaam: stuk.toets.mods.length > 0 }]), TEMPO)
                .then(function (gelukt) {
                  if (!gelukt) { regels.push(['fout', 'Gestopt: ' + (vr.laatsteFout || 'onbekend') + '.']); return false; }
                  return slaap(800 * TEMPO).then(kijk);
                });
            });
          })();
        }
        /*
         * exclbtw: in "Specify amount" staat de cursor in Amount (geselecteerd). Lezen,
         * vinkje omzetten (Shift+Tab Space Tab), opnieuw lezen. Uitvinken rekent
         * Amount om naar ÷ 1,21; gaat het × 1,21, dan stond het vinkje al uit: nog een
         * keer omzetten en controleren dat het oude bedrag terug is (0.8.2).
         */
        if (stuk.soort === 'exclbtw') {
          var omzetten = reeks(L(st.label + ' (btw-vinkje)'), [{ soort: 'toets', key: 'Tab', code: 'Tab', mods: ['shift'], langzaam: true }],
            K('Space'), K('Tab'));
          omzetten.forEach(function (x) { if (x.key === 'Space') { x.key = ' '; x.code = 'Space'; } });
          var bedragUit = function (t) { var b = normPrijs(t); return b ? centen(b) : null; };
          var bijna = function (a, b) { return Math.abs(a - b) <= 2; };
          var voor;
          return leesVeld().then(function (t) {
            if (isDialoog(t)) { regels.push(['melding', 'Melding: ' + dialoogTekst(t)]); return false; }
            voor = bedragUit(t);
            return voerUit(omzetten, TEMPO).then(function (g) { if (!g) throw new Error(vr.laatsteFout || 'gestopt'); return slaap(300).then(leesVeld); });
          }).then(function (t) {
            if (t === false) return false;
            if (isDialoog(t)) { regels.push(['melding', 'Melding: ' + dialoogTekst(t)]); return false; }
            var na = bedragUit(t);
            if (voor === null || na === null) {
              regels.push(['let', 'Btw-vinkje omgezet, maar niet te controleren (Amount leeg of geen bedrag). Kijk zelf: "Including 21% VAT" moet uit staan.']);
              return volgende();
            }
            if (bijna(Math.round(voor / 1.21), na)) { regels.push(['lijn', 'Incl. btw uit: Amount ' + bedrag(voor) + ' → ' + bedrag(na) + ' (÷ 1,21).']); return volgende(); }
            if (bijna(Math.round(voor * 1.21), na)) {
              /* Stond al uit en is nu aan: terugzetten. */
              return voerUit(omzetten, TEMPO).then(function (g) { if (!g) throw new Error(vr.laatsteFout || 'gestopt'); return slaap(300).then(leesVeld); }).then(function (t3) {
                var terug = bedragUit(t3);
                if (terug !== null && bijna(terug, voor)) { regels.push(['lijn', 'Incl. btw stond al uit; twee keer omgezet, weer uit (Amount ' + bedrag(terug) + ').']); return volgende(); }
                regels.push(['fout', 'Btw-vinkje niet zeker uit (Amount ' + bedrag(voor) + ' → ' + bedrag(na) + ' → ' + (terug === null ? '?' : bedrag(terug)) + '). Niets getypt; zelf controleren.']);
                return false;
              });
            }
            regels.push(['fout', 'Amount veranderde niet zoals verwacht (' + bedrag(voor) + ' → ' + bedrag(na) + '). Niets getypt; zelf controleren of "Including 21% VAT" uit staat.']);
            return false;
          }).catch(function (e) { regels.push(['fout', 'Gestopt: ' + e.message + '.']); return false; });
        }
        if (stuk.soort === 'alsleeg') {
          return leesVeld().then(function (t) {
            if (isDialoog(t)) { regels.push(['melding', 'Melding: ' + dialoogTekst(t)]); return false; }
            if (t.replace(/\s+/g, '')) { regels.push(['lijn', 'Veld al gevuld (' + t.trim().length + ' tekens): niets getypt.']); return volgende(); }
            regels.push(['lijn', 'Veld leeg: "' + stuk.s + '" getypt.']);
            return voerUit(reeks(L(st.label + ' (alsleeg)'), T(stuk.s)), TEMPO).then(function (gelukt) {
              if (!gelukt) { regels.push(['fout', 'Gestopt: ' + (vr.laatsteFout || 'onbekend') + '.']); return false; }
              return volgende();
            });
          });
        }
        if (!stuk.length) return volgende();
        return voerUit(reeks(L(st.label)).concat(stuk), TEMPO).then(function (gelukt) {
          if (!gelukt) { regels.push(['fout', 'Gestopt: ' + (vr.laatsteFout || 'onbekend') + '.']); return false; }
          return volgende();
        });
      }
      return volgende().then(function (doorgelopen) {
        if (!doorgelopen) return;
        var oordeel = laatsteLees !== null && beoordeelLees(st, laatsteLees, lev);
        if (oordeel) regels.push([oordeel.soort, oordeel.tekst]);
        if (heeftLees) return;
        /* Even wachten: een melding komt vaak net na de laatste toets (0.8.0). */
        return slaap(WACHT_CONTROLE_MS * TEMPO).then(controleerDialoog).then(function (c) {
          if (c.soort === 'melding') regels.push(['melding', 'Melding: ' + c.tekst]);
          else if (c.soort === 'fout') regels.push(['fout', c.tekst]);
          /* Geen veldinhoud tonen (kan klantgegevens zijn); alleen dat er iets gekopieerd werd. */
          else regels.push(['ok', 'Uitgevoerd, geen melding' + (c.ruw ? ' (Cmd+C kopieerde wel ' + c.ruw.length + ' tekens: het veld met de cursor)' : '') + '.']);
        });
      }).catch(function (e) {
        regels.push(['fout', 'Niet gelukt: ' + e.message + '.']);
      }).then(function () {
        var erg = regels.some(function (r) { return r[0] === 'fout'; }) ? 'fout' : regels.some(function (r) { return r[0] === 'melding' || r[0] === 'let'; }) ? 'melding' : 'ok';
        return { soort: erg, regels: regels };
      });
    }

    /*
     * Stap 7: het totaal in Vanessa is niet te kopiëren. De gebruiker vergelijkt het
     * met wat de tool verwacht en bevestigt; stap 9 wacht daarop (lev.totaalOk).
     */
    function toonTotaalVraag(uit) {
      var lev = vr.levering;
      if (!lev) { uit.appendChild(el('div', 'uitslag melding', 'Geen levering ingelezen: niets om het totaal mee te vergelijken.')); return; }
      var box = el('div', 'uitslag melding');
      box.appendChild(el('div', 'lijn', 'Verwacht in Vanessa: Total ' + bedrag(lev.totaalCenten) + ' (excl. btw, "Display including VAT" uit). ' +
        'Staat het vinkje nog aan, dan ' + bedrag(Math.round(lev.totaalCenten * 1.21)) + '. Klopt het Total in Vanessa?'));
      var rij = el('div', 'rij');
      rij.style.marginTop = '6px';
      var ja = el('button', 'ux-btn', '✓ Klopt'), nee = el('button', 'ux-btn', '✗ Klopt niet');
      ja.id = 'totaal-klopt'; nee.id = 'totaal-klopt-niet';
      rij.appendChild(ja); rij.appendChild(nee);
      box.appendChild(rij);
      ja.onclick = function () {
        lev.totaalOk = true;
        box.className = 'uitslag geen';
        box.innerHTML = '';
        box.appendChild(el('div', 'lijn', 'Totaal ' + bedrag(lev.totaalCenten) + ' excl. btw bevestigd. Stap 9 (Allow packing) mag nu.'));
        vr.ui.status('Totaal bevestigd.', 'ok');
      };
      nee.onclick = function () {
        lev.totaalOk = false;
        box.className = 'uitslag fout';
        box.innerHTML = '';
        box.appendChild(el('div', 'lijn', 'Totaal klopt niet. Vergelijk de regels in Vanessa met de tabel (ontbrekende of dubbele regel, aantal, prijs incl./excl.) en herstel dat eerst. Stap 9 blijft geblokkeerd.'));
        vr.ui.status('Totaal klopt niet: eerst herstellen.', 'fout');
      };
      uit.appendChild(box);
    }

    function toonTeststappen() {
      var box = $('teststappen');
      box.innerHTML = '';
      TESTSTAPPEN.forEach(function (st) {
        var blok = el('div', 'stap' + (st.onomkeerbaar ? ' onomkeerbaar' : ''));
        var kop = el('div', 'stap-kop');
        kop.appendChild(el('span', '', st.label + (st.onomkeerbaar ? ' ⚠ onomkeerbaar' : '')));
        var terug = el('button', 'ux-btn klein', '↺');
        terug.title = 'Terug naar het standaardsjabloon: ' + (st.std || '(leeg)');
        var speel = el('button', 'ux-btn klein vb', '▶ Test');
        speel.id = 'test-' + st.id;
        kop.appendChild(terug); kop.appendChild(speel);
        var alle = null;
        if (st.regel) {
          alle = el('button', 'ux-btn klein vb', '▶ Alle regels');
          alle.id = 'test-' + st.id + '-alle';
          alle.title = 'Het sjabloon voor elke orderregel, van de gekozen regel t/m de laatste. Stopt bij een melding of fout.';
          kop.appendChild(alle);
        }
        blok.appendChild(kop);
        var inp = el('input');
        inp.id = 'sjabloon-' + st.id;
        inp.value = sjabloonVan(st);
        inp.placeholder = st.onomkeerbaar ? 'nog onbekend: vul in als je het weet' : st.uitleg || 'sjabloon';
        inp.spellcheck = false;
        blok.appendChild(inp);
        var nieuweStd = el('div', 'gedempt');
        function toonNieuweStd() {
          nieuweStd.innerHTML = '';
          if (!standaardVeranderd(st)) return;
          nieuweStd.appendChild(d.createTextNode('Eigen sjabloon; de standaard is nu '));
          nieuweStd.appendChild(el('code', '', st.std));
          nieuweStd.appendChild(d.createTextNode(' (↺ om die te nemen).'));
        }
        toonNieuweStd();
        blok.appendChild(nieuweStd);
        var uit = el('div');
        blok.appendChild(uit);
        inp.onchange = function () { bewaarSjabloon(st, inp.value.trim()); toonNieuweStd(); };
        terug.onclick = function () { inp.value = st.std; bewaarSjabloon(st, st.std); toonNieuweStd(); };
        speel.onclick = function () {
          if (vr.bezig || vr.leest) return;
          bewaarSjabloon(st, inp.value.trim());
          bezigKnoppen(true);
          uit.innerHTML = '';
          vr.ui.status(st.label + '…', 'bezig');
          voerTeststapUit(st, inp.value.trim()).then(function (r) {
            bezigKnoppen(false);
            var u = el('div', 'uitslag ' + { ok: 'geen', melding: 'melding', fout: 'fout' }[r.soort]);
            r.regels.forEach(function (x) { u.appendChild(el('div', 'lijn', x[1])); });
            uit.appendChild(u);
            vr.ui.status(st.label + ': ' + (r.soort === 'ok' ? 'klaar.' : r.soort === 'melding' ? 'kijk naar de uitslag.' : 'niet gelukt.'), r.soort === 'ok' ? 'ok' : 'fout');
            if (st.handcontrole === 'totaal' && r.soort === 'ok') toonTotaalVraag(uit);
            maatPaneel(f);
          });
        };
        /* Alle regels: van de gekozen regel t/m de laatste; na een melding/fout of Stop niet verder. */
        if (alle) alle.onclick = function () {
          var lev = vr.levering;
          if (vr.bezig || vr.leest) return;
          if (!lev || !lev.regels.length) return vr.ui.status('Lees eerst een levering in.', 'fout');
          var van = parseInt($('regel-keuze').value, 10) || 0, tot = lev.regels.length;
          var tekst = inp.value.trim();
          bewaarSjabloon(st, tekst);
          bezigKnoppen(true);
          vr.afbreken = false;
          uit.innerHTML = '';
          var u = el('div', 'uitslag geen');
          uit.appendChild(u);
          var slecht = null;
          (function regel(i) {
            if (i >= tot || slecht) return Promise.resolve();
            if (vr.afbreken) { slecht = 'fout'; u.appendChild(el('div', 'lijn', 'Gestopt met de knop vóór regel ' + (i + 1) + '/' + tot + '.')); return Promise.resolve(); }
            var r = lev.regels[i];
            var naam = (i + 1) + '/' + tot + ' · ' + r.productId + ' ' + r.omschrijving + ' (' + r.aantal + '×)';
            $('regel-keuze').value = String(i);
            vr.ui.status(st.label + ': regel ' + naam + '…', 'bezig');
            return voerTeststapUit(st, tekst, i).then(function (res) {
              var kort = res.soort === 'ok' ? 'ok' : res.regels.filter(function (x) { return x[0] !== 'lijn' && x[0] !== 'ok'; }).map(function (x) { return x[1]; }).join(' ');
              u.appendChild(el('div', 'lijn', naam + ': ' + kort));
              if (res.soort !== 'ok') slecht = res.soort;
              maatPaneel(f);
              return regel(i + 1);
            });
          })(van).then(function () {
            bezigKnoppen(false);
            u.className = 'uitslag ' + (slecht === 'fout' ? 'fout' : slecht ? 'melding' : 'geen');
            if (!slecht) u.appendChild(el('div', 'lijn', 'Alle ' + (tot - van) + ' regels toegevoegd. Controleer de regels en het totaal in Vanessa (stap 7).'));
            else u.appendChild(el('div', 'lijn', 'Gestopt. Los het op, kies de volgende regel onder Orderregel en druk weer op ▶ Alle regels.'));
            vr.ui.status(st.label + ': ' + (slecht ? 'gestopt.' : 'alle regels klaar.'), slecht ? 'fout' : 'ok');
            maatPaneel(f);
          });
        };
        box.appendChild(blok);
      });
    }
    toonTeststappen();
    vulRegels();

    function toonControles(box, controles) {
      var ul = el('ul', 'controles');
      controles.forEach(function (x) { ul.appendChild(el('li', x.let ? 'let' : x.ok ? 'ok' : 'fout', x.tekst)); });
      box.appendChild(ul);
    }

    function toonLevering(controles) {
      var box = $('levering'), lev = vr.levering;
      box.innerHTML = '';
      vulRegels();
      if (controles && !lev) {
        box.appendChild(el('div', 'section-label', 'Controles'));
        toonControles(box, controles);
      }
      if (!lev) { maatPaneel(f); return; }
      /* Alles goed: de levering bovenaan, de controles ingeklapt (waarschuwingen staan in de samenvatting). */
      if (controles) {
        var nLet = controles.filter(function (x) { return x.let; }).length;
        var det = el('details');
        var sam = el('summary', '', nLet ? 'Controles: ' + (controles.length - nLet) + ' in orde, ' + nLet + ' waarschuwing' + (nLet > 1 ? 'en' : '') :
          'Controles: alle ' + controles.length + ' in orde');
        if (nLet) sam.style.color = '#856404';
        det.appendChild(sam);
        toonControles(det, controles);
        box.appendChild(det);
      }

      var titel = el('div', 'section-label', 'Levering ' + lev.nummer + ' ');
      if (lev.test) titel.appendChild(el('span', 'pill-amber', 'TEST'));
      box.appendChild(titel);
      box.appendChild(el('div', '', lev.klant + ' · klant ' + lev.klantId + ' · opgehaald ' + lev.ophaal +
        (lev.soort === 'rataplan' ? ' · RataPlan, ' + lev.vestiging : '')));
      box.appendChild(el('div', 'gedempt', 'Reference: ' + lev.reference));

      var tabel = el('table');
      var kop = el('tr');
      [['Product-ID'], ['Omschrijving'], ['Aantal', 'getal'], ['Prijs excl.', 'getal'], ['Regel', 'getal']].forEach(function (k) { kop.appendChild(el('th', k[1], k[0])); });
      tabel.appendChild(kop);
      lev.regels.forEach(function (r) {
        var tr = el('tr');
        tr.appendChild(el('td', '', r.productId));
        tr.appendChild(el('td', '', r.omschrijving));
        tr.appendChild(el('td', 'getal', String(r.aantal)));
        tr.appendChild(el('td', 'getal', r.prijs));
        tr.appendChild(el('td', 'getal', bedrag(r.aantal * r.centen)));
        tabel.appendChild(tr);
      });
      var tot = el('tr');
      tot.appendChild(el('th', '', ''));
      tot.appendChild(el('th', '', 'Totaal excl. btw'));
      tot.appendChild(el('th', 'getal', String(lev.regels.reduce(function (s, r) { return s + r.aantal; }, 0))));
      tot.appendChild(el('th', '', ''));
      tot.appendChild(el('th', 'getal', bedrag(lev.totaalCenten)));
      tabel.appendChild(tot);
      box.appendChild(tabel);

      /* Test: wat de tool berekent naast wat er al in de sheet staat. */
      if (lev.test) {
        var b = lev.bestaand, ah = normPrijs(b.bedrag);
        var tb = el('div', 'testblok');
        tb.appendChild(el('div', '', 'Testlevering: vergelijk met de bestaande order' + (b.orderId ? ' ' + b.orderId : '') +
          ' in Vanessa (product-ID, aantal en prijs per regel).'));
        tb.appendChild(el('div', '', !ah ? 'AH in de sheet is leeg of geen bedrag (' + (b.bedrag || 'leeg') + ').' :
          centen(ah) === lev.totaalCenten ? '✓ AH in de sheet (' + ah + ') = berekend totaal.' :
          '✗ AH in de sheet is ' + ah + ', berekend ' + bedrag(lev.totaalCenten) + ' (verschil ' + bedrag(lev.totaalCenten - centen(ah)) + ')' +
          /* Oude registraties staan soms incl. 21% btw (werkinstructie 2.4). */
          (Math.abs(Math.round(lev.totaalCenten * 1.21) - centen(ah)) <= 1 ? ': AH lijkt het bedrag incl. btw.' : '.')));
        box.appendChild(tb);
      }

      box.appendChild(el('div', 'section-label', 'Taaktekst (stap 10)'));
      box.appendChild(el('pre', '', lev.taaktekst));

      box.appendChild(el('div', 'section-label', 'Terug naar de leveringslijst (stap 12)'));
      var lbl = el('label', '', 'Ordernummer');
      lbl.appendChild(el('span', 'gedempt', ' (testwaarde; later gelezen uit Vanessa)'));
      box.appendChild(lbl);
      var inp = el('input');
      inp.id = 'ordernummer'; inp.inputMode = 'numeric'; inp.placeholder = '8 cijfers';
      inp.value = lev.ordernummer;
      box.appendChild(inp);
      var rij = el('div', 'rij');
      rij.style.marginTop = '6px';
      var bAF = el('button', 'ux-btn', 'Kopieer voor AF:AH');
      bAF.id = 'b-af';
      var bJ = el('button', 'ux-btn', 'Kopieer voor J');
      bJ.id = 'b-j';
      rij.appendChild(bAF); rij.appendChild(bJ);
      box.appendChild(rij);
      box.appendChild(el('div', 'info-box', 'AF:AH: klik in de leveringslijst op AF van deze levering en plak. Factuur maand = ' + lev.maand +
        ' (de maand waarin je de Finance-taak maakt), bedrag excl. btw. J: ' + uitvoerJ(lev) + '.'));
      /* Een testlevering staat al in de sheet: niets overschrijven. */
      if (lev.test) {
        inp.disabled = bAF.disabled = bJ.disabled = true;
        bAF.title = bJ.title = 'Uit bij een testlevering: die staat al in de sheet.';
      }

      bAF.onclick = function () {
        if (lev.test) return;
        var nr = inp.value.replace(/\D/g, '');
        if (!/^\d{8,}$/.test(nr)) return vr.ui.status('Vul eerst het ordernummer in (minstens 8 cijfers).', 'fout');
        lev.ordernummer = nr;
        kopieer(uitvoerAF(lev), 'Gekopieerd voor AF:AH: ' + uitvoerAF(lev).replace(/\t/g, ' | ') + '.');
      };
      bJ.onclick = function () { if (lev.test) return; kopieer(uitvoerJ(lev), 'Gekopieerd voor J: ' + uitvoerJ(lev) + '.'); };
      maatPaneel(f);
    }

    $('b-inlezen').onclick = function () {
      var uit = leesLevering($('rij').value, $('rita').value, $('vestiging').value, new Date(), $('testmodus').checked);
      vr.levering = uit.levering;
      toonLevering(uit.controles);
      if (uit.levering) vr.ui.status((uit.levering.test ? 'Testlevering ' : 'Levering ') + uit.levering.nummer + ' ingelezen: ' + uit.levering.regels.length + ' orderregels, € ' + bedrag(uit.levering.totaalCenten) + ' excl. btw.', 'ok');
      else vr.ui.status('Deze levering kan nog niet gefactureerd worden; zie de controles.', 'fout');
    };
    /* Plakvelden leeg, zodat er geen klantdata in het paneel blijft staan. */
    $('b-wis').onclick = function () {
      $('rij').value = ''; $('rita').value = ''; $('vestiging').value = ''; $('testmodus').checked = false;
      vr.levering = null;
      toonLevering(null);
      vr.ui.status('Gewist.', 'ok');
    };

    if (vr.levering) toonLevering(null);
  }

  if (!/appstream/i.test(location.hostname) && !document.getElementById(PANEEL_ID)) {
    if (!confirm('Vanessa Refurbished: dit lijkt geen AppStream-pagina (' + location.hostname + '). Toch openen?')) return;
  }
  openPaneel();
})();
