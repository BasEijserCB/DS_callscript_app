/* ─────────────────────────────────────────────────────────────
   EXTRA RIJTIJD — waar past een extra stop, en wat kost dat?
   Draait op de Ritmonitor (coolblue.dirextion.nl/ModuleTourMonitor).
   Staat volledig los van het DS Logboek.

   GEBRUIK
   1. Open de Ritmonitor.
   2. Plak dit bestand in de console (F12).
   3. Plak het adres van de nieuwe stop. Servicetijd is optioneel:
      leeg = alleen extra rijtijd, ingevuld = rijtijd + service samen.
   4. Klik een rit in de uitslag aan: DireXtion springt naar die rit en
      de stoplijst krijgt een kolom "+ rijtijd" op de regel van de stop
      waarná je invoegt.

   NETWERKEN
   Vier vinkjes, één per netwerk (1M / 1X / 2M / BI). Aangevinkt = die ritten
   mogen de aftercare doen. Je keuze blijft bewaard tussen sessies. Tijdelijke
   oplossing: zodra de tabel TAKEN gevuld is, zet een taak uit het logboek de
   vinkjes zelf goed.

   HET GROTE GETAL = UITLOOP
   Niet hoe lang de klus duurt, maar wat de rit er netto bij krijgt:
   benodigde tijd min de voorsprong. Rood +12 min = de rit loopt 12 minuten
   uit. Groen −19 min = het past ruim, er blijft 19 minuten voorsprong over.
   De opbouw (rijden + service) staat op de regel eronder.

   VOLGORDE VAN DE UITSLAG
   1. Past het binnen de voorsprong van de rit? Dan kost het de planning
      niets, en dat weegt zwaarder dan welk netwerk dan ook.
   2. Is het gat niet krap (zie hieronder)?
   3. De lichtste aangevinkte ploeg — BI-tijd is te duur voor werk dat een
      2M ook doet.
   4. Netto tijd (benodigd min voorsprong), dan de kortste omweg.
   De ★ staat dus niet per se bij de kortste omweg.

   EIGEN RIT
   De rit waar de klant nu op staat kan de aftercare niet zelf doen. Die komt
   uit het logboek mee, en anders herkent de tool hem doordat het adres binnen
   100 m van een stop in die rit ligt.

   ALLEEN DE TOEKOMST
   Stops die de bezorger al gehad heeft doen niet mee. De laatste stop
   met een echte aankomsttijd (het ↑/↓-pijltje) geldt als huidige positie.

   NIET DE EERSTVOLGENDE STOP
   Een toegevoegde stop is niet op tijd naar de werktelefoon van de held
   gesynchroniseerd, dus het gat direct na de huidige positie valt af. Het
   gat daarna kan wel, maar krijgt het label ⚠ krap.
   Dit geldt alleen voor ritten die al rijden. Staat een rit nog op het
   depot, dan zijn alle gaten beschikbaar en meldt de uitslag dat de TL op
   het depot geïnformeerd moet worden na het inplannen.

   HOE DE DATA BINNENKOMT
   - Rittenlijst: Knockout-viewmodel achter table.tourlist, met
     /ModuleTourMonitor/TourMonitor/GetTours als bredere bron.
   - Stops per rit: /ModuleTourMonitor/TourMonitor/GetVisitsWithExecutionStateByTour?tourId=…
   - Geocoderen: PDOK Locatieserver (officiële BAG-bron, huisnummerniveau,
     alleen NL). Valt terug op Nominatim voor BE/DE en onbekende adressen.
   - Rijtijden: OpenRouteService (eigen sleutel in ORS_KEY), of de publieke
     OSRM-demoserver zolang die leeg is. Geen actuele filedruk. Er worden
     alleen de dichtstbijzijnde ritten doorgerekend, om zuinig te zijn met
     het dagquotum.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var RIJTIJD_VERSION = 'v1.10.1';

  var PANEL_ID = 'extra-rijtijd-panel';
  var PIL_ID = 'extra-rijtijd-pil';
  var KOLOM = 'extraRijtijd';
  var KEY_ADRES = 'rijtijd_adres';
  var KEY_RES = 'rijtijd_resultaten';
  var KEY_NETWERKEN = 'rijtijd_netwerken';
  var KEY_ORS = 'rijtijd_ors_key';

  // ── ROUTER ───────────────────────────────────────────────────
  // De OpenRouteService-sleutel staat bewust NIET in dit bestand: het staat
  // op GitHub en wordt via de loader-bookmarklet opgehaald. Iedereen zet zijn
  // eigen sleutel één keer via het veld in het paneel; hij blijft daarna in
  // localStorage staan. Zonder sleutel valt de tool terug op de publieke
  // OSRM-demoserver, en dat meldt het paneel dan ook.
  var ORS_KEY = laad(KEY_ORS, '') || '';
  // driving-car past bij bestelbussen. driving-hgv houdt rekening met
  // vrachtwagenbeperkingen — omzetten als dat beter blijkt te kloppen.
  var ORS = 'https://api.openrouteservice.org/v2/matrix/driving-car';
  var OSRM = 'https://router.project-osrm.org/table/v1/driving/';
  var PDOK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
  var NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  var VISITS_URL = '/ModuleTourMonitor/TourMonitor/GetVisitsWithExecutionStateByTour?tourId=';
  var TOURS_URL = '/ModuleTourMonitor/TourMonitor/GetTours';
  var MAX_ROUTE_RITTEN = 6;    // hoeveel ritten daadwerkelijk de router in
  var ALTIJD_DICHTSTBIJ = 3;   // daarvan gegarandeerd de dichtstbijzijnde
  var KM_NAAR_MIN = 3;         // ruwe omrekening voor de voorselectie, zie schatUitloop
  var PARALLEL_VISITS = 6;
  var EIGEN_RIT_M = 100;       // stop binnen 100 m van het adres = de rit van de klant zelf
  // De eerstvolgende stop kan technisch niet: een toegevoegde stop is niet op
  // tijd naar de werktelefoon van de held gesynchroniseerd. De stop daarna kan
  // wel, maar is krap — die wordt gemarkeerd.
  var NIET_PLANBAAR = 1;       // aantal gaten direct na de huidige positie dat afvalt
  var RISICOVOL = 1;           // aantal gaten daarna dat als risicovol geldt
  var UITLOOP_ROOD = 15;       // uitloop t/m 15 min oranje, daarboven rood
  var REISTIJD_KEY = 'ds_reistijd_verzoek';

  // ── NETWERKEN ────────────────────────────────────────────────
  //   1M  één man, alleen begane grond
  //   2M  twee man, kan naar boven tillen
  //   1X  één man installateur, inbouw maar alleen begane grond
  //   BI  twee man installatie, kan alles
  // Welke netwerken mogen, kies je met de vinkjes. Deze volgorde is tevens
  // de kostenvolgorde (licht → zwaar) en bepaalt de ranglijst: kan een
  // lichtere ploeg de klus ook, dan gaat die voor. BI-tijd is te duur om te
  // besteden aan werk dat een 2M ook aankan.
  // Let op de aanname 1X vóór 2M: één installateur is goedkoper geacht dan
  // twee man. Klopt dat niet, wissel ze hier om.
  var NETWERKEN = ['1M', '1X', '2M', 'BI'];

  // Zoveel ritten staan meteen in beeld. De rest is wel doorgerekend en blijft
  // achter een linkje staan: in de praktijk kies je uit de bovenste paar, en
  // een lijst van zes duwt de uitleg eronder van het scherm.
  var TOON_EERST = 3;

  function netwerkRang(nw) {
    var i = NETWERKEN.indexOf(nw);
    return i === -1 ? 99 : i;
  }

  // ── TAKEN ────────────────────────────────────────────────────
  // Eén tabel voor beide vragen die een taak oproept:
  //   minuten    → servicetijd ter plaatse. Getal, of per dienstType:
  //                { 'Nazorg (gratis)': 20, 'Extra dienst (betaald)': 30 }
  //   netwerken  → welke ploegen dit werk kunnen. Array, of per formaatTV:
  //                { 'Ja (>= 55 inch)': ['BI'], standaard: ['1X','BI'] }
  // Beide zetten alleen het formulier klaar zodra er een taak uit het
  // logboek binnenkomt. De vinkjes blijven altijd handmatig aan te passen —
  // dit is een voorzet, geen slot. null = geen voorzet.
  //
  // Minuten komen uit de servicecatalogus van DireXtion (overgenomen
  // 02-09-2026): geplande tijd ter plaatse, exclusief rijden.
  // Netwerken zijn aangeleverd door DS (02-09-2026).
  //
  // Sleutels zijn de kolom J-taken uit het DS Logboek. Taken waarvoor geen
  // bezoek gepland wordt, staan hier niet in.
  var TAKEN = {
    // AANSLUITEN — (Nazorg) product plaatsen/aansluiten
    'Plaatsen / Naar boven tillen':          { minuten: 9,  netwerken: ['2M', 'BI'] },
    // AANSLCONTR — (Nazorg) aansluiting controleren
    'Aansluiting controleren':               { minuten: 7,  netwerken: ['1M', '1X', '2M', 'BI'] },
    // NZ-ELECTR 17 / EX-TREKSCH 18
    'Trekschakelaar aansluiten':             { minuten: { 'Nazorg (gratis)': 17, 'Extra dienst (betaald)': 18 },
                                               netwerken: ['1X', 'BI'] },
    // NZ-INBOUW en EX-INBOUW, allebei 37
    'Apparaat inbouwen (Keuken)':            { minuten: 37, netwerken: ['1X', 'BI'] },
    // DEUROMDR 25. Alleen als Extra dienst; koel-vriescombinatie (DEURDR-KV)
    // duurt 35, maar het product is hier niet bekend.
    'Deur omdraaien':                        { minuten: 25, netwerken: ['BI'] },
    // NZ-STPLKT en EX-STPLKT, allebei 10
    'Stapelkit plaatsen':                    { minuten: 10, netwerken: ['2M', 'BI'] },
    // AansluitTV en EX-AANSLTV, allebei 32
    'TV installeren':                        { minuten: 32,
                                               netwerken: { 'Ja (>= 55 inch)': ['BI'], standaard: ['1X', 'BI'] } },
    // OphangenTV 46 / EX-MOUNTTV 50
    'TV ophangen en installeren':            { minuten: { 'Nazorg (gratis)': 46, 'Extra dienst (betaald)': 50 },
                                               netwerken: { 'Ja (>= 55 inch)': ['BI'], standaard: ['1X', 'BI'] } },
    // NZI-TVSBAR en EXI-TVSBAR, allebei 42
    'TV + Soundbar installeren':             { minuten: 42,
                                               netwerken: { 'Ja (>= 55 inch)': ['BI'], standaard: ['1X', 'BI'] } },
    // NZO-TVSBAR en EXO-TVSBAR, allebei 41 — let op: minder dan installeren
    // alleen (42). Ziet er als een fout in de catalogus uit.
    'TV + Soundbar ophangen en installeren': { minuten: 41,
                                               netwerken: { 'Ja (>= 55 inch)': ['BI'], standaard: ['1X', 'BI'] } },
    // MILIEURET — (Nazorg) milieuretour ophalen. 2M/BI is een voorkeur,
    // geen eis: de vinkjes blijven aanpasbaar.
    'Milieuretour ophalen':                  { minuten: 4,  netwerken: ['2M', 'BI'] },
    // NZ-PICKUP — (Nazorg) product ophalen. Idem: voorkeur, geen eis.
    'Pick-up ophalen':                       { minuten: 9,  netwerken: ['2M', 'BI'] },
    // SPULOPHALN — (Nazorg) ophalen achtergelaten spullen. Wordt af en toe
    // gepland, dus hoort er wel in.
    'Spullen achtergelaten bij klant':       { minuten: 3,  netwerken: ['1M', '1X', '2M', 'BI'] }
    // 'Blijverkoop vergeten' staat hier bewust niet in: dat is administratie,
    // daar komt geen bezoek voor.
  };

  function servicetijdVoor(taak, dienstType) {
    var t = taak ? TAKEN[taak] : null;
    if (!t || t.minuten === null || t.minuten === undefined) return null;
    if (typeof t.minuten === 'number') return t.minuten;
    if (typeof t.minuten === 'object') {
      if (typeof t.minuten[dienstType] === 'number') return t.minuten[dienstType];
      for (var k in t.minuten) if (typeof t.minuten[k] === 'number') return t.minuten[k];
    }
    return null;
  }

  function netwerkenVoor(taak, formaatTV) {
    var t = taak ? TAKEN[taak] : null;
    var n = t && t.netwerken;
    if (!n) return null;
    if (Object.prototype.toString.call(n) === '[object Array]') return n.length ? n : null;
    var v = n[formaatTV] || n.standaard;      // TV's: boven de 55 inch alleen BI
    return (v && v.length) ? v : null;
  }

  // '2M-NLRO-07-7' → '2M-NLRO-07' (ritnaam zonder staartnummer)
  function ritKern(naam) {
    if (!naam) return '';
    var m = /^([0-9A-Z]{2})-([A-Z]{4})-(\d{1,2})/i.exec(String(naam).trim());
    return m ? (m[1] + '-' + m[2] + '-' + m[3]).toUpperCase() : String(naam).trim().toUpperCase();
  }
  function netwerkVan(naam) {
    var m = /^([0-9A-Z]{2})-/i.exec(String(naam || '').trim());
    return m ? m[1].toUpperCase() : '';
  }

  // ── verzoek uit het DS Logboek ───────────────────────────────
  function leesVerzoek(json) {
    try {
      var v = JSON.parse(json);
      if (!v || v._soort !== 'ds-reistijd' || !v.zoekterm) return null;
      return v;
    } catch (e) { return null; }
  }

  function pasVerzoekToe(v, bron) {
    if (!v) return false;
    adresInput.value = v.zoekterm;
    if (v.route) eigenRitInput.value = v.route;
    laatsteTaak = v.taak || '';
    laatsteFormaat = v.formaatTV || '';
    var nets = netwerkenVoor(v.taak, laatsteFormaat);
    if (nets) zetNetwerken(nets);
    var st = servicetijdVoor(v.taak, v.dienstType);
    if (st !== null) serviceInput.value = st;
    status('Uit DS Logboek (' + bron + '): ' + v.zoekterm +
           (v.taak ? ' \u2014 ' + v.taak : '') +
           (v.taak && st === null ? ' \u00b7 servicetijd nog niet bekend' : ''));
    depotHandmatig = false; depotKeuze = []; tekenDepots();   // andere nazorg
    vouwForm(true);
    return true;
  }

  var oud = document.getElementById(PANEL_ID); if (oud) oud.remove();
  var oudePil = document.getElementById(PIL_ID); if (oudePil) oudePil.remove();

  // ── opslag ───────────────────────────────────────────────────
  function laad(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function bewaar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var resultaten = laad(KEY_RES, []);
  var kolomData = { tourId: null, perSeq: {}, risico: {}, beste: null };
  var overslag = { eigen: 0, netwerk: 0, keuze: null, eigenRit: '' };
  var laatsteTaak = '';   // uit het logboek; leeggemaakt zodra je zelf een adres typt
  var laatsteFormaat = '';   // formaatTV uit het logboek: bepaalt bij TV's het netwerk

  // ── knockout root ────────────────────────────────────────────
  function koRoot() {
    try {
      var rij = document.querySelector('table.tourlist tr.icons');
      if (!rij || !window.ko) return null;
      return window.ko.contextFor(rij).$root;
    } catch (e) { return null; }
  }
  function uw(v) { try { return window.ko ? window.ko.unwrap(v) : v; } catch (e) { return v; } }

  // ── depots ───────────────────────────────────────────────────
  // Het depotfilter van de Ritmonitor is in de praktijk een stadskeuze: sinds
  // een herinrichting vallen alle netwerken van een depot onder de naam van
  // de stad. De losse 'BuiltIn-…', '1M…' en '1M Installation …' ingangen zijn
  // resten van vroeger en blijven leeg.
  //
  // De optielijst houden we hier NIET bij. De dxTagBox 'Depots' in het
  // filterpaneel heeft alle ~116 depots met hun id al in zijn dataSource, dus
  // die lezen we uit. Een eigen tabel zou stil scheef gaan lopen zodra er een
  // depot bij komt, en de ids zijn hier strings — anders dan de TagBoxen in
  // het Import-formulier, die numeriek zijn.
  function tagBoxen() {
    var $ = window.jQuery, uit = [];
    if (!$) return uit;
    Array.prototype.forEach.call(document.querySelectorAll('.dx-tagbox'), function (el) {
      if (el.parentElement && el.parentElement.closest('.dx-tagbox')) return;
      var inst = null;
      try { inst = $(el).dxTagBox('instance'); } catch (e) {}
      if (inst) uit.push({ el: el, inst: inst });
    });
    return uit;
  }

  // De tekst links van een veld; DevExtreme hangt er zelf geen label aan.
  function labelVan(el) {
    var n = el, niveau = 0;
    while (n && niveau++ < 5) {
      var b = n.previousElementSibling;
      while (b) {
        var t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length < 40) return t;
        b = b.previousElementSibling;
      }
      n = n.parentElement;
    }
    return '';
  }

  // Waar de Ritmonitor nu op filtert. Leeg = geen depotfilter, dus alles.
  function filterDepots() {
    try {
      var root = koRoot();
      var f = root && root.tourFilter;
      var d = f && window.ko.toJS(f.staticFilter).depots;
      return (d || []).map(String);
    } catch (e) { return []; }
  }

  // 'Depots' — nadrukkelijk niet 'Begin depot' of 'Eind depot', dat zijn
  // andere velden in hetzelfde paneel met een bijna gelijk label.
  function depotBox() {
    var boxen = tagBoxen();
    var hit = boxen.filter(function (b) { return /^depots$/i.test(labelVan(b.el)); })[0];
    if (hit) return hit.inst;
    // Vangnet als dat label ooit anders heet: de box waarvan de waarde precies
    // de depots bevat waarop de Ritmonitor op dit moment filtert.
    var nu = filterDepots();
    if (nu.length) {
      hit = boxen.filter(function (b) {
        var v = (b.inst.option('value') || []).map(String);
        return v.length === nu.length && nu.every(function (id) { return v.indexOf(id) !== -1; });
      })[0];
    }
    return hit ? hit.inst : null;
  }

  // De Ritmonitor kent 116 depots, maar bruikbaar zijn er ruim twintig. Wat
  // eruit moet:
  //   · netwerkvarianten ('BuiltIn-Tilburg', '1MTilburg', '1M Installation
  //     Tilburg', 'Tilburg 2M (BE)') — resten van een oudere inrichting; alle
  //     netwerken van een depot zitten tegenwoordig in de stadsbak zelf;
  //   · fietsdepots ('Fietshub …', 'Bikedepot …') — daar is deze tool niet voor;
  //   · warehouses en interne leveringen — geen bezorgdepots.
  // Wat overblijft is het stamdepot: één bak per stad.
  var GEEN_STAMDEPOT = /^(1M|BuiltIn-|Bikedepot|Fietshub|Warehouse)|Interne leveringen| [12]M \(/i;

  // Bakken die er als stamdepot uitzien maar geen bezorgdepot zijn. Aan de
  // naam niet te zien, dus met de hand eruit:
  //   Amsterdam, Venlo (DE)  — dode bakken, blijven leeg
  //   WAD…                   — Waddeneilanden, puur administratief
  var UITGESLOTEN_DEPOTS = ['Amsterdam', 'Venlo (DE)', 'WADAmSch', 'WADTexel', 'WADVlieTer'];

  // Land en ligging per stamdepot. Het land houdt de keuze binnen de grens —
  // nazorg gaat nooit naar een depot in een ander land. De coördinaten zijn
  // er om automatisch te bepalen welke depots dicht genoeg bij de nazorg
  // liggen; het zijn stadscoördinaten, niet de exacte depotadressen, dus reken
  // op een afwijking van een kilometer of tien. Voor een straal van tientallen
  // kilometers is dat ruim genoeg.
  //
  // Een depotnaam die hier niet in staat (nieuw depot) blijft handmatig
  // aanvinkbaar maar doet niet mee in de automatische keuze — we weten niet
  // waar hij ligt.
  var DEPOTS = {
    'Almere':      { land: 'NL', lat: 52.370, lon: 5.220 },
    'Deventer':    { land: 'NL', lat: 52.250, lon: 6.160 },
    'Groningen':   { land: 'NL', lat: 53.220, lon: 6.570 },
    'Rotterdam':   { land: 'NL', lat: 51.920, lon: 4.480 },
    'Tilburg':     { land: 'NL', lat: 51.560, lon: 5.090 },
    'Utrecht':     { land: 'NL', lat: 52.090, lon: 5.110 },
    'Venlo (NL)':  { land: 'NL', lat: 51.370, lon: 6.170 },
    'Antwerpen':   { land: 'BE', lat: 51.220, lon: 4.400 },
    'Gent':        { land: 'BE', lat: 51.050, lon: 3.720 },
    'Nivelles':    { land: 'BE', lat: 50.600, lon: 4.330 },
    'Dusseldorf':  { land: 'DE', lat: 51.230, lon: 6.780 },
    'Hamburg':     { land: 'DE', lat: 53.550, lon: 10.000 },
    'Hamm':        { land: 'DE', lat: 51.680, lon: 7.820 },
    'Kelsterbach': { land: 'DE', lat: 50.070, lon: 8.530 },
    'Langenhagen': { land: 'DE', lat: 52.450, lon: 9.740 },
    'Leipzig':     { land: 'DE', lat: 51.340, lon: 12.370 },
    'Nurnberg':    { land: 'DE', lat: 49.450, lon: 11.080 },
    'Schonefeld':  { land: 'DE', lat: 52.390, lon: 13.520 },
    'Tamm':        { land: 'DE', lat: 48.920, lon: 9.110 },
    'Troisdorf':   { land: 'DE', lat: 50.820, lon: 7.150 }
  };

  // Hoe ver een depot van de nazorg mag liggen om vanzelf mee te doen. Bij 75
  // km pakt een adres in de Randstad er drie tot vijf, terwijl Groningen en
  // Venlo alleen blijven staan — die liggen nu eenmaal ver van de rest.
  var DEPOT_STRAAL_KM = 75;
  var MIN_DEPOTS = 3;          // ondergrens, ook als er niets binnen de straal ligt
  var DEPOT_MAX_KM = 100;      // maar nooit verder dan dit — zie autoDepots
  var MAX_VISIT_RITTEN = 60;   // noodrem op het aantal GetVisits per Bereken

  // Routecode in de ritnaam → stamdepot. Afgeleid uit de data zelf op
  // 09-09-2026 (`probe-depotfilter.js`-aanpak: per depot GetTours ophalen en
  // de codes uit de ritnamen tellen); elk depot bleek precies één code te
  // hebben, zonder overlap. Alleen NL en BE — de Duitse depots liggen zo ver
  // uit elkaar dat de straal daar volstaat, en een onbekende code valt netjes
  // terug op de afstand mét een melding onder de uitslag.
  //
  // NLOV, NLEI, NLDH, BEZA en BEWI staan er bewust niet in: dat zijn
  // fietshubcodes, en BK-ritten doen in deze tool niet mee. `parseToTourAlias()`
  // in ds-logboek.js zet NLOV voor niet-fietsnetwerken al om naar NLAL.
  var ROUTECODE_DEPOT = {
    NLAL: 'Almere',    NLDE: 'Deventer', NLGR: 'Groningen', NLRO: 'Rotterdam',
    NLTI: 'Tilburg',   NLUT: 'Utrecht',  NLVE: 'Venlo (NL)',
    BEAN: 'Antwerpen', BEGE: 'Gent',     BENI: 'Nivelles'
  };

  // Het land van de nazorg. De ritcode is exact ('2M-NLTI-07' → NL); staat die
  // er niet, dan de postcode in het adresveld, met dezelfde regel als het
  // logboek gebruikt: vijf cijfers = DE, vier cijfers = BE, anders NL.
  function landVanNazorg(adres, eigenRit) {
    var m = /-(NL|BE|DE)[A-Z]{2}-/i.exec(String(eigenRit || ''));
    if (m) return m[1].toUpperCase();
    var t = String(adres || '');
    if (/\b\d{4}\s?[A-Za-z]{2}\b/.test(t)) return 'NL';
    if (/\b\d{5}\b/.test(t)) return 'DE';
    if (/\b\d{4}\b/.test(t)) return 'BE';
    return '';
  }

  // [{id, naam}] uit de dataSource van die TagBox, op naam gesorteerd.
  function depotOpties() {
    var inst = depotBox();
    if (!inst) return [];
    try {
      var ds = inst.getDataSource && inst.getDataSource();
      var arr = (ds && ds.items && ds.items()) || inst.option('items') || [];
      var ve = inst.option('valueExpr'), de = inst.option('displayExpr');
      return arr.map(function (o) {
        if (!o || typeof o !== 'object') return { id: String(o), naam: String(o) };
        return {
          id: String(typeof ve === 'string' ? o[ve] : (o.Id != null ? o.Id : o.id)),
          naam: String(typeof de === 'function' ? de(o)
                     : typeof de === 'string' ? o[de]
                     : (o.Name || o.name || o.Text || o.text || ''))
        };
      }).filter(function (o) {
        return o.id && o.id !== 'undefined' && o.naam &&
               !GEEN_STAMDEPOT.test(o.naam) && UITGESLOTEN_DEPOTS.indexOf(o.naam) === -1;
      }).sort(function (a, b) { return a.naam.localeCompare(b.naam); });
    } catch (e) { return []; }
  }


  // ── rittenlijst ──────────────────────────────────────────────
  // Voorsprong uit de rittenlijst zelf, in minuten, positief = vóór op schema.
  // Het teken van TimelinessMinutes is niet gedocumenteerd — bij een rit met
  // label 'TooEarly' zagen we -43 — dus we leiden het af uit het label en niet
  // uit het teken. Zonder label vallen we terug op die waarneming.
  function voorsprongUitLijst(t) {
    var m = uw(t.TimelinessMinutes); if (m == null) m = uw(t.timelinessMinutes);
    if (typeof m !== 'number') return null;
    var label = String(uw(t.Timeliness) || uw(t.timeliness) || '');
    if (/late/i.test(label)) return -Math.abs(m);
    if (/early/i.test(label)) return Math.abs(m);
    return -m;
  }
  function getal(t, a, b) {
    var v = uw(t[a]); if (v == null) v = uw(t[b]);
    return typeof v === 'number' ? v : null;
  }

  function normTour(t) {
    var id = uw(t.id); if (id == null) id = uw(t.TourId); if (id == null) id = uw(t.Id);
    if (id == null) return null;
    var naam = uw(t.name) || uw(t.Name) || uw(t.Alias) || '';
    var ref = uw(t.referenceId) || uw(t.ReferenceId) || '';
    // stops/gedaan tellen ook activiteiten mee, dus ze zijn niet gelijk aan wat
    // verwerkStops() straks overhoudt. Ze worden alleen gebruikt om ritten over
    // te slaan die sowieso geen gat kunnen hebben — die kant op is het veilig.
    return {
      id: id, naam: String(naam || ref || id), ref: String(ref || ''),
      stops: getal(t, 'NumberOfVisits', 'numberOfVisits'),
      gedaan: getal(t, 'NumberOfVisitsCompleted', 'numberOfVisitsCompleted'),
      voorsprong: voorsprongUitLijst(t)
    };
  }

  function uitObservable(root) {
    var lijst = [];
    try {
      (uw(root && root.tours) || []).forEach(function (t) {
        var n = normTour(t); if (n) lijst.push(n);
      });
    } catch (e) {}
    return lijst;
  }

  // Probeert de volledige gefilterde set op te halen; valt terug op de
  // ritten die het viewmodel al geladen heeft (de zichtbare ~16).
  // depots: ids waarop gefilterd wordt. Leeg = geen depotfilter, dus alle
  // ritten van de dag. De rest van het filter blijft zoals de gebruiker het
  // in de Ritmonitor heeft staan — we sturen alleen een eigen `depots` mee in
  // onze eigen request. Het scherm van de gebruiker verandert daar niet van:
  // we raken de TagBox niet aan en drukken niet op Filteren.
  function haalTours(depots) {
    var root = koRoot();
    var fallback = uitObservable(root);
    var f = root && root.tourFilter;
    if (!f || !window.ko) return Promise.resolve(fallback);
    var url;
    try {
      // Alles wat ritten kan wegfilteren gaat op nul. Een verlader- of
      // uitvoerderfilter dat nog van een eerdere zoektocht in de Ritmonitor
      // stond, mag de beste rit niet stil buiten beeld houden. `date` blijft
      // staan — dat is geen versmalling maar de dag zelf.
      var filter = window.ko.toJS(f.staticFilter);
      filter.depots = (depots || []).map(String);
      filter.shippers = [];
      filter.tags = [];
      filter.searchTags = [];
      filter.depotBeginsWith = '';
      var stat = JSON.stringify(filter);
      var state = window.ko.toJS(f.stateFilter);
      state.finishedTours = 'show';
      state.inactiveTours = 'show';
      state.tourProblems = 'allTours';
      state.timeliness = 'allTours';
      state = JSON.stringify(state);
      var orde = String(uw(root.sortProperty) || 'referenceId');
      // Zonder depotfilter zijn het er een paar honderd; 300 was te krap.
      url = TOURS_URL + '?filter=' + encodeURIComponent(stat) +
            '&stateFilter=' + encodeURIComponent(state) +
            '&orderField=' + encodeURIComponent(orde) + '&skip=0&take=1000';
    } catch (e) { return Promise.resolve(fallback); }
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.Data || !j.Data.length) return fallback;
        var lijst = j.Data.map(normTour).filter(Boolean);
        return lijst.length ? lijst : fallback;
      })
      .catch(function () { return fallback; });
  }

  // Dezelfde keuze in de Ritmonitor zelf zetten en op Filteren drukken.
  //
  // Voor het zoeken is dit niet nodig — haalTours() doet zijn eigen request en
  // maakt daarin dezelfde filters leeg. Het gaat om wat er ná de uitslag
  // gebeurt: klikken op een regel roept `selectTourId()` aan, en een rit die
  // niet in de rittenlijst staat is niet te selecteren. Zoeken in Rotterdam
  // terwijl het scherm op Tilburg filtert levert dus een uitslag op waar je
  // niet doorheen kunt klikken. Door de UI mee te zetten kijken tool en
  // gebruiker naar hetzelfde.
  //
  // Best effort: lukt het niet, dan is er niets stuk — de zoektocht draait op
  // het eigen request en die is hoe dan ook volledig.
  function zetRitmonitorFilter(depots) {
    var root = koRoot();
    var f = root && root.tourFilter;
    if (!f || !window.ko) return false;
    var gezet = false;
    function zet(obj, sleutel, waarde) {
      try {
        var v = obj && obj[sleutel];
        if (window.ko.isObservable(v)) { v(waarde); gezet = true; }
      } catch (e) {}
    }
    zet(f.staticFilter, 'depots', (depots || []).map(String));
    zet(f.staticFilter, 'shippers', []);
    zet(f.staticFilter, 'tags', []);
    zet(f.staticFilter, 'searchTags', []);
    zet(f.staticFilter, 'depotBeginsWith', '');
    zet(f.stateFilter, 'finishedTours', 'show');
    zet(f.stateFilter, 'inactiveTours', 'show');
    zet(f.stateFilter, 'tourProblems', 'allTours');
    zet(f.stateFilter, 'timeliness', 'allTours');
    // Zijn het geen observables, dan de TagBox rechtstreeks. Die is aan
    // dezelfde waarde gebonden, dus het filterpaneel loopt daarna gelijk.
    if (!gezet) {
      var box = depotBox();
      if (!box) return false;
      try { box.option('value', (depots || []).map(String)); } catch (e) { return false; }
    }
    var knop = document.getElementById('filter-submit');
    if (!knop) return false;
    knop.click();   // laat DireXtion zijn eigen onFilter → loadTours draaien
    return true;
  }

  function even(ms) {
    return new Promise(function (klaar) { setTimeout(klaar, ms); });
  }

  // ── stops per rit ────────────────────────────────────────────
  function haalVisits(tourId) {
    return fetch(VISITS_URL + tourId, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (!j || !j.Success || !j.Data) throw new Error('geen data'); return j.Data; });
  }

  // "/Date(1788243209062)/" → ms, of null bij leeg/sentinel (DateTime.MinValue)
  function msUit(d) {
    if (!d) return null;
    var m = /\/Date\((-?\d+)/.exec(String(d));
    var ms = m ? parseInt(m[1], 10) : Date.parse(d);
    if (isNaN(ms) || ms < 946684800000) return null;
    return ms;
  }
  // Bezocht = er staat een echte aankomsttijd; precies de regels met ↑/↓.
  function isBezocht(v) { return msUit(v.RealArrivalDatestamp) !== null; }

  // Voorsprong in minuten: gepland min werkelijk op de huidige positie.
  // Positief = vóór op schema, negatief = achter. Valt terug op de
  // prognose van de eerstvolgende stop als de huidige geen echte tijd heeft.
  function voorsprongMin(stops, vanaf) {
    var s = stops[vanaf];
    if (s) {
      var p = msUit(s.PlanArrivalDatestamp), r = msUit(s.RealArrivalDatestamp);
      if (p !== null && r !== null) return Math.round((p - r) / 60000);
    }
    for (var i = vanaf + 1; i < stops.length; i++) {
      var pp = msUit(stops[i].PlanArrivalDatestamp), pg = msUit(stops[i].ArrivalPrognosis);
      if (pp !== null && pg !== null) return Math.round((pp - pg) / 60000);
    }
    return 0;
  }

  function verwerkStops(visits) {
    var stops = (visits || []).filter(function (v) {
      return !v.IsActivity && v.PlanCoordinates &&
             typeof v.PlanCoordinates.Latitude === 'number' &&
             typeof v.PlanCoordinates.Longitude === 'number';
    });
    if (stops.length < 2) return null;
    stops.sort(function (a, b) { return a.SequenceNumber - b.SequenceNumber; });
    var huidig = -1;
    for (var i = 0; i < stops.length; i++) if (isBezocht(stops[i])) huidig = i;
    var vanaf = Math.max(huidig, 0);
    if (vanaf >= stops.length - 1) return null;      // rit zo goed als klaar
    // Onderweg = er is al ergens echt aangekomen. Staat de rit nog op het
    // depot, dan speelt het sync-probleem niet en mag ook het eerste gat.
    return {
      stops: stops, vanaf: vanaf, onderweg: huidig >= 0,
      voorsprong: voorsprongMin(stops, vanaf)
    };
  }

  // ── externe calls ────────────────────────────────────────────
  // Zo weinig mogelijk over onszelf meesturen. referrerPolicy houdt
  // 'coolblue.dirextion.nl' uit de logs van PDOK/OSRM, credentials:'omit'
  // zorgt dat er nooit een cookie meegaat.
  // Let op: de Origin-header gaat wél mee — die hoort bij CORS en is vanuit
  // de browser niet uit te zetten zonder het antwoord onleesbaar te maken.
  // Volledig anoniem kan alleen via een eigen proxy of eigen OSRM.
  function externFetch(url) {
    return fetch(url, { referrerPolicy: 'no-referrer', credentials: 'omit', mode: 'cors' });
  }

  // Nominatim is de uitzondering: hun gebruiksvoorwaarden vragen dat je je
  // identificeert. Een User-Agent kun je vanuit de browser niet zetten, dus
  // dat gaat via de Referer — hier dus bewust GEEN no-referrer. Cookies gaan
  // nog steeds niet mee, en het blijft bij één verzoek per Bereken, ruim
  // binnen hun limiet van één per seconde.
  function nominatimFetch(url) {
    return fetch(url, { credentials: 'omit', mode: 'cors' });
  }

  // ── geo ──────────────────────────────────────────────────────
  // De hele berekening hangt aan dit ene punt: zit het adres 200 m verkeerd,
  // dan klopt elke omweg in de lijst niet. Daarom eerst PDOK — de officiële
  // BAG-bron, exact op huisnummerniveau, maar alleen Nederland. Levert die
  // niets op (BE/DE, of een adres dat de BAG niet kent), dan Nominatim.
  function geocodePdok(adres) {
    var url = PDOK + '?q=' + encodeURIComponent(adres) + '&rows=1&fq=type:adres';
    return externFetch(url).then(function (r) {
      if (!r.ok) throw new Error('PDOK gaf ' + r.status);
      return r.json();
    }).then(function (j) {
      var d = j && j.response && j.response.docs && j.response.docs[0];
      if (!d || !d.centroide_ll) return null;
      var m = /POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/.exec(d.centroide_ll);   // POINT(lon lat)
      if (!m) return null;
      return { lat: parseFloat(m[2]), lon: parseFloat(m[1]), bron: 'PDOK', label: d.weergavenaam || '' };
    });
  }

  function geocodeNominatim(adres) {
    var url = NOMINATIM + '?format=json&limit=1&countrycodes=nl,be,de&q=' + encodeURIComponent(adres);
    return nominatimFetch(url).then(function (r) {
      if (!r.ok) throw new Error('Geocoder gaf ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.length) throw new Error('Adres niet gevonden: ' + adres);
      return {
        lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon),
        bron: 'Nominatim', label: j[0].display_name || ''
      };
    });
  }

  function geocode(adres) {
    return geocodePdok(adres)
      .catch(function () { return null; })
      .then(function (p) { return p || geocodeNominatim(adres); });
  }

  function afstandKm(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Allebei leveren dezelfde vorm op: durations[i][j] in seconden.
  function matrix(punten) {
    return ORS_KEY ? matrixOrs(punten) : matrixOsrm(punten);
  }

  function matrixOrs(punten) {
    return fetch(ORS, {
      method: 'POST',
      headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: punten.map(function (p) { return [p.lon, p.lat]; }),   // [lon, lat]
        metrics: ['duration']
      }),
      referrerPolicy: 'no-referrer',
      credentials: 'omit'
    }).then(function (r) {
      if (r.ok) return r.json();
      return r.text().then(function (t) {
        throw new Error('ORS gaf ' + r.status + (t ? ': ' + t.slice(0, 140) : ''));
      });
    }).then(function (j) {
      if (!j || !j.durations) throw new Error('ORS gaf geen rijtijden terug');
      return j.durations;
    });
  }

  function matrixOsrm(punten) {
    var coords = punten.map(function (p) { return p.lon + ',' + p.lat; }).join(';');
    return externFetch(OSRM + coords + '?annotations=duration').then(function (r) {
      if (!r.ok) throw new Error('Router gaf ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j.code !== 'Ok' || !j.durations) throw new Error('Geen route gevonden');
      return j.durations;
    });
  }

  // ── hulpje: beperkt parallel uitvoeren ───────────────────────
  function inBatches(items, n, fn, voortgang) {
    if (!items.length) return Promise.resolve([]);
    return new Promise(function (resolve) {
      var uit = [], i = 0, klaar = 0;
      function volgende() {
        if (i >= items.length) return;
        var idx = i++;
        Promise.resolve(fn(items[idx]))
          .then(function (r) { uit[idx] = r; }, function () { uit[idx] = null; })
          .then(function () {
            klaar++;
            if (voortgang) voortgang(klaar, items.length);
            if (klaar === items.length) resolve(uit); else volgende();
          });
      }
      for (var k = 0; k < Math.min(n, items.length); k++) volgende();
    });
  }

  // ── rekenwerk ────────────────────────────────────────────────
  function straat(v) { return (v.Address || v.City || '?').split(',')[0]; }

  // Wat de rit er netto bij krijgt: benodigde tijd min de voorsprong.
  // Voorsprong kan de omweg hooguit helemaal opvangen (niet negatief maken);
  // achterstand (negatieve voorsprong) telt er juist bovenop.
  function netto(totaal, voorsprong) { return Math.max(0, totaal - voorsprong); }

  function maakGaps(toekomst, D, nieuwIndex, service, onderweg, voorsprong) {
    var gaps = [];
    // i telt vanaf de huidige positie: i = 0 zou de nieuwe stop de
    // eerstvolgende maken (kan niet, sync), i = 1 de tweede (krap).
    // Staat de rit nog op het depot, dan geldt die beperking niet.
    var eerste = onderweg ? NIET_PLANBAAR : 0;
    for (var i = eerste; i < toekomst.length - 1; i++) {
      var basis = D[i][i + 1], heen = D[i][nieuwIndex], terug = D[nieuwIndex][i + 1];
      if (basis == null || heen == null || terug == null) continue;
      var extra = Math.round((heen + terug - basis) / 60);
      var totaal = extra + service;
      gaps.push({
        van: straat(toekomst[i]), naar: straat(toekomst[i + 1]),
        vanSeq: toekomst[i].SequenceNumber, naarSeq: toekomst[i + 1].SequenceNumber,
        basis: Math.round(basis / 60), via: Math.round((heen + terug) / 60),
        extra: extra, totaal: totaal,
        // Wat de rit er netto bij krijgt. Negatief = past ruim, er blijft
        // zoveel voorsprong over. Dit is het getal dat de gebruiker wil zien.
        uitloop: totaal - voorsprong,
        past: voorsprong >= totaal,
        risico: onderweg && i < NIET_PLANBAAR + RISICOVOL
      });
    }
    gaps.sort(vergelijkGaten);
    return gaps;
  }

  // De ladder, in deze volgorde:
  //   1. past het binnen de voorsprong? (kost de rit niets)
  //   2. is het gat niet krap? (eerstvolgende-na-de-volgende)
  //   3. hoe lang duurt het
  // Netwerk komt pas daarna, en alleen tussen ritten onderling.
  // Ruwe schatting van wat deze rit eraan overhoudt, vóór de router. Bedoeld
  // om te kiezen wélke ritten de router in gaan, niet om iets te beweren over
  // de uitkomst — dat doet maakGaps() straks met echte rijtijden.
  //
  // Heen en terug over de hemelsbrede afstand tot de dichtstbijzijnde stop is
  // ruwweg 2 x afstand, en bij een stadssnelheid van zo'n 40 km/u komt dat op
  // 3 minuten per kilometer. Grof, maar het onderscheid dat het moet maken is
  // ook grof: een rit met veel voorsprong die wat verder ligt hoort mee te
  // doen, en dat zag de oude voorselectie op pure afstand niet.
  function schatUitloop(k, service) {
    return k.dichtst * KM_NAAR_MIN + service - k.voorsprong;
  }

  function vergelijkGaten(a, b) {
    if (a.past !== b.past) return a.past ? -1 : 1;
    if (a.risico !== b.risico) return a.risico ? 1 : -1;
    return a.totaal - b.totaal;
  }

  function scan(adres, service, eigenRit, netwerken, depots) {
    status('Adres opzoeken…');
    return geocode(adres).then(function (nieuw) {
      // Pas hier kan de depotkeuze automatisch: nu zijn de coördinaten van de
      // nazorg bekend. Een handmatige keuze in het paneel gaat voor.
      var gekozenDepots = (depots && depots.length)
        ? depots
        : autoDepots(nieuw, landVanNazorg(adres, eigenRit), eigenRit);
      // Kent de tabel de routecode niet, dan is er puur op afstand gezocht en
      // kan het depot van de klant gemist zijn. Dat hoort niet stil te blijven.
      var codeOnbekend = (eigenRit && !depotVanRit(eigenRit)) ? String(eigenRit).trim() : '';
      if (!depotHandmatig) { depotKeuze = gekozenDepots.slice(); tekenDepots(); }
      // Eerst de Ritmonitor gelijkzetten, dan pas ophalen. Even wachten tot
      // zijn eigen loadTours klaar is, anders klikt de gebruiker straks op een
      // rit die net weer uit de lijst valt.
      var uiGezet = zetRitmonitorFilter(gekozenDepots);
      status('Ritten ophalen…');
      return even(uiGezet ? 900 : 0).then(function () {
        return haalTours(gekozenDepots);
      }).then(function (alleTours) {
        if (!alleTours.length) throw new Error('Geen ritten in de lijst gevonden.');

        // Eerst schiften, dan pas stops ophalen — scheelt tientallen requests.
        var eigenKern = ritKern(eigenRit);
        overslag = { eigen: 0, netwerk: 0, klaar: 0, gekapt: 0, netwerken: netwerken,
                     eigenRit: eigenKern, geo: nieuw, orsLoos: !ORS_KEY,
                     codeOnbekend: codeOnbekend };
        var tours = alleTours.filter(function (t) {
          if (eigenKern && ritKern(t.naam) === eigenKern) { overslag.eigen++; return false; }
          var nw = netwerkVan(t.naam);
          if (nw && netwerken.indexOf(nw) === -1) { overslag.netwerk++; return false; }
          // Blijven er minder dan twee stops over, dan is er geen gat mogelijk.
          // Dat staat al in de rittenlijst, dus die GetVisits kunnen we sparen.
          if (t.stops !== null && t.gedaan !== null && t.stops - t.gedaan < 2) {
            overslag.klaar++; return false;
          }
          return true;
        });
        if (!tours.length) throw new Error('Geen ritten over in de aangevinkte netwerken.');
        // Noodrem. Normaal blijven er tientallen ritten over en gaan ze er alle
        // in, maar met een handvol depots aangevinkt kan dat oplopen tot ver
        // boven de honderd — evenzoveel GetVisits-calls op DireXtion. Dan
        // winnen de ritten met de meeste voorsprong, want dat is ook de eerste
        // sleutel van de ranglijst.
        if (tours.length > MAX_VISIT_RITTEN) {
          overslag.gekapt = tours.length - MAX_VISIT_RITTEN;
          tours = tours.slice().sort(function (a, b) {
            var va = a.voorsprong == null ? -9999 : a.voorsprong;
            var vb = b.voorsprong == null ? -9999 : b.voorsprong;
            return vb - va;
          }).slice(0, MAX_VISIT_RITTEN);
        }
        status('Stops ophalen 0/' + tours.length + '…');
        return inBatches(tours, PARALLEL_VISITS,
          function (t) { return haalVisits(t.id); },
          function (k, n) { status('Stops ophalen ' + k + '/' + n + '…'); }
        ).then(function (alle) {
          var kandidaten = [], autoEigen = null;
          tours.forEach(function (t, i) {
            var info = verwerkStops(alle[i]);
            if (!info) return;
            var toekomst = info.stops.slice(info.vanaf);
            if (toekomst.length < (info.onderweg ? NIET_PLANBAAR : 0) + 2) return;   // geen bruikbaar gat
            var dichtst = Infinity;
            toekomst.forEach(function (s) {
              var d = afstandKm(nieuw, { lat: s.PlanCoordinates.Latitude, lon: s.PlanCoordinates.Longitude });
              if (d < dichtst) dichtst = d;
            });
            // Staat het adres zelf als stop in deze rit? Dan is dit de rit van
            // de klant. Werkt ook als het logboek geen route meestuurde.
            if (dichtst * 1000 <= EIGEN_RIT_M && (!autoEigen || dichtst < autoEigen.dichtst)) {
              autoEigen = { naam: t.naam, dichtst: dichtst };
            }
            kandidaten.push({
              tour: t, toekomst: toekomst, dichtst: dichtst,
              gehad: info.vanaf, voorsprong: info.voorsprong, onderweg: info.onderweg
            });
          });

          // Geen eigen rit meegekregen, maar wel zelf herkend op het adres.
          if (!eigenKern && autoEigen) {
            eigenKern = ritKern(autoEigen.naam);
            overslag.eigenRit = eigenKern;
            overslag.auto = true;
            if (eigenRitInput) eigenRitInput.value = autoEigen.naam;
            kandidaten = kandidaten.filter(function (k) {
              if (ritKern(k.tour.naam) === eigenKern) { overslag.eigen++; return false; }
              return true;
            });
          }
          if (!kandidaten.length) throw new Error('Geen ritten met bruikbare toekomstige stops.');
          // Twee bakken. De dichtstbijzijnde ritten gaan er altijd in — een rit
          // die praktisch om de hoek rijdt mag nooit sneuvelen op een schatting.
          // De overige plaatsen gaan naar de laagste geschatte uitloop, zodat
          // een rit met flinke voorsprong die iets verder ligt alsnog meedoet.
          // Zonder die tweede bak sorteerde de voorselectie op afstand terwijl
          // de ranglijst erna op voorsprong sorteert — twee verschillende
          // vragen, en de beste rit viel daartussen weg.
          kandidaten.sort(function (a, b) { return a.dichtst - b.dichtst; });
          var kort = kandidaten.slice(0, ALTIJD_DICHTSTBIJ);
          kandidaten.slice(ALTIJD_DICHTSTBIJ).sort(function (a, b) {
            return schatUitloop(a, service) - schatUitloop(b, service);
          }).slice(0, MAX_ROUTE_RITTEN - kort.length).forEach(function (k) {
            kort.push(k);
          });
          status('Rijtijden 0/' + kort.length + '…');
          return inBatches(kort, 2, function (k) {
            var punten = k.toekomst.map(function (s) {
              return { lat: s.PlanCoordinates.Latitude, lon: s.PlanCoordinates.Longitude };
            });
            punten.push(nieuw);
            return matrix(punten).then(function (D) {
              var gaps = maakGaps(k.toekomst, D, punten.length - 1, service, k.onderweg, k.voorsprong);
              if (!gaps.length) return null;
              var nw = netwerkVan(k.tour.naam);
              return {
                rit: k.tour.naam, tourId: k.tour.id, ref: k.tour.ref,
                netwerk: nw, rang: netwerkRang(nw),
                voorsprong: k.voorsprong, service: service, onderweg: k.onderweg,
                gaps: gaps
              };
            });
          }, function (k, n) { status('Rijtijden ' + k + '/' + n + '…'); })
          .then(function (res) {
            resultaten = res.filter(Boolean);
            alleRittenTonen = false;   // nieuwe uitslag begint weer ingeklapt
            if (!resultaten.length) throw new Error('Geen rijtijden terug van de router.');
            // Zelfde ladder als binnen een rit, met het netwerk erachter:
            //   1. past binnen de voorsprong (kost de rit niets)
            //   2. niet krap
            //   3. lichtste ploeg — een 2M die het aankan gaat vóór een BI
            //   4. netto tijd, dan de kortste omweg
            // Een rit die het gratis kan opvangen wint dus van een lichter
            // netwerk dat er tijd bij krijgt.
            resultaten.sort(function (a, b) {
              var ga = a.gaps[0], gb = b.gaps[0];
              if (ga.past !== gb.past) return ga.past ? -1 : 1;
              if (ga.risico !== gb.risico) return ga.risico ? 1 : -1;
              if (a.rang !== b.rang) return a.rang - b.rang;
              var na = netto(ga.totaal, a.voorsprong), nb = netto(gb.totaal, b.voorsprong);
              return na !== nb ? na - nb : ga.totaal - gb.totaal;
            });
            bewaar(KEY_RES, resultaten); bewaar(KEY_ADRES, adres);
            status('');
            vouwForm(false);
            render();
            return huidigeTourId().then(function (id) {
              var hier = resultaten.filter(function (r) { return r.tourId === id; })[0];
              if (hier) zetKolom(hier.tourId, hier.gaps);
            });
          });
        });
      });
    }).catch(function (e) {
      var m = String(e && e.message ? e.message : e);
      if (/Failed to fetch|NetworkError/i.test(m)) {
        m = 'Netwerkverzoek geblokkeerd (waarschijnlijk CSP). Laat het weten — ' +
            'dan verhuist de berekening naar buiten de pagina.';
      }
      status(m, true);
    });
  }

  // ── kolom in de stoplijst ────────────────────────────────────
  // Groen betekent één ding: de rit loopt er niet door uit. Elke minuut
  // uitloop is minstens oranje — anders vervaagt precies het onderscheid
  // waar de ranglijst op sorteert.
  function kleurUitloop(u) {
    if (u <= 0) return '#155724';            // past binnen de voorsprong
    return u <= UITLOOP_ROOD ? '#856404' : '#E50000';
  }
  function uitloopTekst(u) { return (u > 0 ? '+' : (u < 0 ? '\u2212' : '')) + Math.abs(u) + ' min'; }

  function gridInstance() {
    if (!window.jQuery) return null;
    var g = window.jQuery('#visit-grid-container');
    return g.data('dxDataGrid') || g.data('dxList') || null;
  }

  function huidigeTourId() {
    var inst = gridInstance();
    if (!inst) return Promise.resolve(null);
    return Promise.resolve(inst.getDataSource().store().load())
      .then(function (a) { return (a && a.length) ? a[0].TourId : null; })
      .catch(function () { return null; });
  }

  function zetKolom(tourId, gaps) {
    kolomData = { tourId: tourId, perSeq: {}, risico: {}, beste: gaps.length ? gaps[0].uitloop : null };
    gaps.forEach(function (g) {          // hangt aan de stop wáárna je invoegt
      kolomData.perSeq[g.vanSeq] = g.uitloop;
      if (g.risico) kolomData.risico[g.vanSeq] = true;
    });
    var inst = gridInstance();
    if (!inst || typeof inst.addColumn !== 'function') return;
    var bestaat = false;
    try { bestaat = !!inst.columnOption(KOLOM); } catch (e) {}
    if (!bestaat) {
      try {
        inst.addColumn({
          name: KOLOM, caption: '+ rijtijd', width: 95,
          allowSorting: false, allowFiltering: false, allowResizing: true,
          cellTemplate: function (container, opts) {
            var el = container && container.get ? container.get(0) : container;
            if (!el) return;
            var v = opts && opts.data;
            if (!v || kolomData.tourId === null || v.TourId !== kolomData.tourId) return;
            var m = kolomData.perSeq[v.SequenceNumber];
            if (m === undefined) return;
            var span = document.createElement('span');
            span.textContent = uitloopTekst(m) + (kolomData.risico[v.SequenceNumber] ? ' \u26A0' : '') +
                               (m === kolomData.beste ? ' \u2605' : '');
            span.style.cssText = 'font-weight:700;white-space:nowrap;color:' + kleurUitloop(m);
            el.appendChild(span);
          }
        });
      } catch (e) { console.warn('[Extra rijtijd] kolom toevoegen mislukt:', e); return; }
    }
    try { inst.repaint(); } catch (e) {}
  }

  function verwijderKolom() {
    var inst = gridInstance();
    if (!inst || typeof inst.deleteColumn !== 'function') return;
    try { inst.deleteColumn(KOLOM); } catch (e) {}
  }

  function selecteerRit(tourId) {
    var res = resultaten.filter(function (r) { return r.tourId === tourId; })[0];
    var root = koRoot();
    try { if (root && typeof root.selectTourId === 'function') root.selectTourId(tourId); } catch (e) {}
    if (res) setTimeout(function () { zetKolom(tourId, res.gaps); }, 600);
  }

  // ── UI ───────────────────────────────────────────────────────
  function status(tekst, fout) {
    var el = document.getElementById('er-status');
    if (!el) return;
    el.textContent = tekst || '';
    el.className = fout ? 'er-status fout' : 'er-status';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function voorsprongTekst(v) {
    if (v > 0) return v + ' min vóór';
    if (v < 0) return (-v) + ' min achter';
    return 'op schema';
  }

  var alleRittenTonen = false;   // staat de rest van de ranglijst open?

  function render() {
    var body = document.getElementById('er-resultaten');
    if (body) {
      if (!resultaten.length) {
        body.innerHTML = '<div class="er-status">Nog niets berekend.</div>';
      } else {
        var html = '';
        var rangen = resultaten.map(function (r) { return r.rang; });
        var minRang = Math.min.apply(null, rangen);
        var gemengd = Math.max.apply(null, rangen) !== minRang;
        var zicht = alleRittenTonen ? resultaten : resultaten.slice(0, TOON_EERST);
        zicht.forEach(function (r, idx) {
          var g = r.gaps[0];
          var opbouw = r.service
            ? g.extra + ' rijden + ' + r.service + ' service = ' + g.totaal + ' min'
            : g.extra + ' min rijden';
          html += '<div class="er-rij" data-tour="' + r.tourId + '" title="Klik om deze rit te openen">' +
            '<div class="er-rij-kop"><span class="er-rit">' + esc(r.rit) +
              (gemengd && r.rang === minRang ? ' <span class="pill pill-green">lichtste ploeg</span>' : '') +
              (idx === 0 ? ' <span class="er-ster">★</span>' : '') + '</span>' +
            '<span class="er-uitloop"><span class="er-getal" style="color:' + kleurUitloop(g.uitloop) + '">' +
              uitloopTekst(g.uitloop) + '</span>' +
              '<span class="section-label">' + (g.uitloop > 0 ? 'uitloop' : 'speling over') + '</span></span></div>' +
            '<div class="er-rij-sub"><span class="pill pill-blue">' + g.vanSeq + ' → ' + g.naarSeq + '</span> ' +
            esc(g.van) + ' → ' + esc(g.naar) +
            (g.risico ? ' <span class="pill pill-amber">\u26A0 krap</span>' : '') + '</div>' +
            '<div class="er-opbouw">' + opbouw + ' · <span class="' +
              (r.voorsprong > 0 ? 'er-goed' : (r.voorsprong < 0 ? 'er-slecht' : '')) + '">' +
              voorsprongTekst(r.voorsprong) + '</span></div>' +
            (r.onderweg ? '' : '<div class="park-melding er-depot">\u2691 Rit staat nog op het depot \u2014 informeer de TL na het inplannen</div>') +
            '</div>';
        });
        if (resultaten.length > TOON_EERST) {
          html += '<div class="er-meer"><span class="toggle-link er-meer-link">' +
            (alleRittenTonen
              ? 'minder tonen'
              : '+ ' + (resultaten.length - TOON_EERST) + ' andere overwogen rit' +
                (resultaten.length - TOON_EERST === 1 ? '' : 'ten')) +
            '</span></div>';
        }
        var uitleg = [];
        if (overslag.geo && overslag.geo.label) {
          uitleg.push('adres via ' + esc(overslag.geo.bron) + ': ' + esc(overslag.geo.label));
        }
        if (overslag.eigen) uitleg.push('eigen rit ' + esc(overslag.eigenRit) + ' overgeslagen' + (overslag.auto ? ' (zelf herkend op het adres)' : ''));
        if (overslag.netwerk) uitleg.push(overslag.netwerk + ' rit(ten) buiten het netwerkfilter');
        if (overslag.klaar) uitleg.push(overslag.klaar + ' rit(ten) (bijna) klaar');
        if (overslag.gekapt) uitleg.push(overslag.gekapt + ' rit(ten) niet opgehaald (limiet ' + MAX_VISIT_RITTEN + ')');
        if (overslag.netwerken && overslag.netwerken.length < NETWERKEN.length) {
          uitleg.push('alleen ' + overslag.netwerken.join(', '));
        }
        if (uitleg.length) html += '<div class="er-status">' + uitleg.join(' \u00b7 ') + '</div>';
        if (overslag.codeOnbekend) {
          html += '<div class="park-melding er-depot">\u2691 Routecode van ' +
                  esc(overslag.codeOnbekend) + ' staat niet in de depottabel \u2014 ' +
                  'er is alleen op afstand tot het adres gezocht. Ligt het eigen depot ' +
                  'verder weg, vink het er dan zelf bij.</div>';
        }
        if (overslag.orsLoos) {
          html += '<div class="park-melding er-depot">\u2691 Nog geen OpenRouteService-sleutel \u2014 ' +
                  'rijtijden komen van de OSRM-demoserver, die daar niet voor bedoeld is. ' +
                  'Vul ORS_KEY in bovenaan het bestand.</div>';
        }
        body.innerHTML = html;
        Array.prototype.forEach.call(body.querySelectorAll('.er-rij'), function (el) {
          el.onclick = function () { selecteerRit(parseInt(el.getAttribute('data-tour'), 10)); };
        });
        var meer = body.querySelector('.er-meer-link');
        if (meer) meer.onclick = function () { alleRittenTonen = !alleRittenTonen; render(); };
      }
    }
    var b = resultaten.length ? resultaten[0] : null;
    var pt = document.getElementById('er-pil-tekst');
    if (pt) pt.textContent = b ? (b.rit + ' · ' + b.gaps[0].vanSeq + '→' + b.gaps[0].naarSeq + ' · ' + uitloopTekst(b.gaps[0].uitloop)) : 'Extra rijtijd';
    var pi = document.getElementById(PIL_ID);
    if (pi && b) pi.style.borderLeftColor = kleurUitloop(b.gaps[0].uitloop);
  }

  function gekozenNetwerken() {
    var uit = [];
    NETWERKEN.forEach(function (n) {
      var el = document.getElementById('er-net-' + n);
      if (el && el.checked) uit.push(n);
    });
    return uit;
  }

  // Het vinkje stuurt de klasse .selected aan, dezelfde die de widget voor een
  // gekozen knop gebruikt. Zo staat de groene keuzekleur op één plek (DS_UI).
  function markeerNetwerken() {
    NETWERKEN.forEach(function (n) {
      var vak = document.getElementById('er-net-' + n);
      var lbl = document.getElementById('er-net-lbl-' + n);
      if (!vak || !lbl) return;
      if (vak.checked) { if (lbl.className.indexOf(' selected') === -1) lbl.className += ' selected'; }
      else lbl.className = lbl.className.replace(' selected', '');
    });
  }

  function zetNetwerken(lijst) {
    NETWERKEN.forEach(function (n) {
      var el = document.getElementById('er-net-' + n);
      if (el) el.checked = lijst.indexOf(n) !== -1;
    });
    markeerNetwerken();
    bewaar(KEY_NETWERKEN, lijst);
  }

  // ── depotkeuze in het paneel ─────────────────────────────────
  // Normaal kiest de tool zelf, op afstand tot het adres (zie autoDepots).
  // Het lijstje in het paneel laat zien wat hij koos en is er om die keuze te
  // overrulen; zodra je zelf een vinkje zet blijft die keuze staan, tot je een
  // ander adres invult of op 'automatisch' klikt. Er wordt niets bewaard —
  // een depotkeuze van gisteren zegt niets over de nazorg van vandaag.
  var depotLijst = [];        // [{id, naam}] uit de TagBox van de Ritmonitor
  var depotKeuze = [];        // ids waarop gefilterd wordt
  var depotHandmatig = false; // heeft de gebruiker zelf ingegrepen?

  function depotNamen() {
    return depotKeuze.map(function (id) {
      var d = depotLijst.filter(function (o) { return o.id === id; })[0];
      return d ? d.naam : id;
    });
  }

  // De automatische keuze, en het hele punt van deze functie: bij een nazorg
  // hoort niet alleen het eigen depot maar ook wat er omheen ligt, want een
  // buurdepot kan dichterbij zijn of meer voorsprong hebben. Draait op de
  // coördinaten van het geocodeerde adres, dus altijd op de nazorg zelf en
  // niet op het depot waar de rit toevallig vandaan komt.
  //
  // België doet altijd voltallig mee: drie depots, en het land is te klein om
  // er met een straal iets zinnigs uit te zeven.
  // Welk depot rijdt deze rit? `2M-NLTI-07` → Tilburg. Leeg bij een onbekende
  // code — dan valt de keuze terug op afstand alleen.
  function depotVanRit(naam) {
    var m = /^[0-9A-Z]{2}-([A-Z]{4})-/i.exec(String(naam || '').trim());
    return m ? (ROUTECODE_DEPOT[m[1].toUpperCase()] || '') : '';
  }

  function autoDepots(punt, land, eigenRit) {
    if (!depotLijst.length) return [];
    var ids = [];
    function voegToe(id) { if (id && ids.indexOf(id) === -1) ids.push(id); }

    // 1. Het depot van de eigen rit doet altijd mee, hoe ver het ook ligt.
    //    Dat is geen schatting: die rit rijdt dit adres vandaag, dus dit ís het
    //    depot dat het gebied bedient. Sommige verzorgingsgebieden reiken
    //    verder dan DEPOT_STRAAL_KM, en dan viel juist het meest voor de hand
    //    liggende depot af.
    var eigenDepot = depotVanRit(eigenRit);
    if (eigenDepot) {
      depotLijst.forEach(function (d) { if (d.naam === eigenDepot) voegToe(d.id); });
    }

    // 2. Daarna op afstand, binnen hetzelfde land. Zonder land geen straal:
    //    dan weten we niet eens in welk land we mogen zoeken.
    if (!land || !punt) return ids;
    var mee = depotLijst.filter(function (d) {
      return (DEPOTS[d.naam] || {}).land === land;
    }).map(function (d) {
      var c = DEPOTS[d.naam];
      return { id: d.id, km: afstandKm(punt, { lat: c.lat, lon: c.lon }) };
    }).sort(function (a, b) { return a.km - b.km; });

    // België voltallig: drie depots, te klein land om uit te zeven.
    if (land === 'BE') { mee.forEach(function (d) { voegToe(d.id); }); return ids; }

    // Binnen de straal, en anders toch de MIN_DEPOTS dichtstbijzijnde. In
    // Zeeland en Zuid-Limburg ligt er geen enkel depot binnen 75 km; zonder
    // die ondergrens zocht de tool daar in één depot.
    mee.forEach(function (d, i) {
      // Het plafond geldt alleen voor de ondergrens, niet voor de straal zelf.
      // Zonder plafond sleepte de derde plek in Zeeland en Zuid-Limburg Utrecht
      // mee op 128 respectievelijk 144 km — daar komt nooit een rit vandaan,
      // en het kostte wel een GetVisits per rit van dat depot. 100 km in plaats
      // van 110 houdt ook Venlo weg bij Enschede (107).
      if (d.km <= DEPOT_STRAAL_KM || (i < MIN_DEPOTS && d.km <= DEPOT_MAX_KM)) voegToe(d.id);
    });
    // Ligt zelfs het dichtstbijzijnde depot buiten het plafond, dan toch dat
    // ene — een lege lijst betekent in dit filter 'alle depots'.
    if (!ids.length && mee.length) voegToe(mee[0].id);
    return ids;
  }

  // Stamdepots die voor deze nazorg in aanmerking komen: die in hetzelfde
  // land. Over de grens gaan we niet voor een nazorgje.
  function toegestaneDepots() {
    var land = landVanNazorg(
      (document.getElementById('er-adres') || {}).value,
      (document.getElementById('er-eigenrit') || {}).value);
    return depotLijst.filter(function (d) {
      var dl = (DEPOTS[d.naam] || {}).land || '';
      return !land || !dl || dl === land;
    });
  }

  function tekenDepots() {
    var blok = document.getElementById('er-depotblok');
    var vak = document.getElementById('er-depotlijst');
    var hint = document.getElementById('er-depothint');
    if (!blok || !vak || !hint) return;
    // Geen optielijst gevonden (geen filterpaneel, andere pagina-opbouw): dan
    // laten we het blok weg en blijft de tool doen wat hij altijd deed —
    // zoeken binnen het depotfilter van de Ritmonitor.
    if (!depotLijst.length) { blok.style.display = 'none'; return; }
    blok.style.display = 'block';
    var toegestaan = toegestaneDepots();
    // De keuze beweegt mee: een depot dat door een landwissel afvalt hoort
    // ook niet meer in het filter te zitten.
    depotKeuze = depotKeuze.filter(function (id) {
      return toegestaan.some(function (d) { return d.id === id; });
    });
    var q = ((document.getElementById('er-depotzoek') || {}).value || '').trim().toLowerCase();
    // Aangevinkte bovenaan, zodat je nooit hoeft te scrollen om te zien wat
    // er aan staat.
    var zicht = toegestaan.filter(function (d) {
      return !q || d.naam.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      var va = depotKeuze.indexOf(a.id) !== -1, vb = depotKeuze.indexOf(b.id) !== -1;
      if (va !== vb) return va ? -1 : 1;
      return a.naam.localeCompare(b.naam);
    });
    vak.innerHTML = zicht.length
      ? zicht.map(function (d) {
          var aan = depotKeuze.indexOf(d.id) !== -1;
          return '<label class="er-depotrij' + (aan ? ' aan' : '') + '">' +
            '<input type="checkbox" data-depot="' + d.id + '"' + (aan ? ' checked' : '') + '>' +
            d.naam.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</label>';
        }).join('')
      : '<div class="er-depotleeg">Geen depot met die naam.</div>';
    var land = landVanNazorg(
      (document.getElementById('er-adres') || {}).value,
      (document.getElementById('er-eigenrit') || {}).value);
    if (depotHandmatig) {
      hint.innerHTML = 'Zelf gekozen: ' +
        (depotKeuze.length ? depotNamen().join(', ') : 'niets \u2014 alle depots') +
        ' <span class="toggle-link er-depotauto">automatisch</span>';
    } else if (depotKeuze.length) {
      hint.textContent = 'Automatisch gekozen: ' + depotNamen().join(', ');
    } else {
      hint.textContent = land === 'BE'
        ? 'Bij Bereken doen alle Belgische depots mee.'
        : 'Bij Bereken worden de depots binnen ' + DEPOT_STRAAL_KM +
          ' km van het adres vanzelf gekozen.';
    }
  }

  // Direct na een berekening is het invulblok bijzaak: de ranglijst is waar
  // het om gaat, en die stond bij vier velden plus vier vinkjes ruim onder de
  // vouw. Het blok klapt daarom dicht tot één regel met wat er is doorgerekend,
  // en gaat weer open zodra je erop klikt, op Wissen drukt, of het logboek een
  // nieuw adres aanlevert. Bij het opstarten staat het altijd open — zie de
  // aanroep onderaan.
  function samenvatting() {
    var adres = (document.getElementById('er-adres') || {}).value || '';
    var st = parseInt((document.getElementById('er-servicetijd') || {}).value, 10);
    var nets = gekozenNetwerken();
    var deps = depotNamen();
    var delen = [adres || 'geen adres'];
    if (!isNaN(st) && st > 0) delen.push(st + ' min service');
    if (nets.length && nets.length < NETWERKEN.length) delen.push(nets.join(', '));
    if (deps.length) delen.push(deps.length > 2 ? deps.length + ' depots' : deps.join(' + '));
    return delen.join(' \u00b7 ');
  }

  function vouwForm(open) {
    var form = document.getElementById('er-form');
    var sam = document.getElementById('er-samenvatting');
    if (!form || !sam) return;
    form.style.display = open ? 'block' : 'none';
    sam.style.display = open ? 'none' : 'flex';
    if (!open) document.getElementById('er-sam-tekst').textContent = samenvatting();
  }

  function toonPil(aan) {
    document.getElementById(PIL_ID).style.display = aan ? 'flex' : 'none';
    document.getElementById(PANEL_ID).style.display = aan ? 'none' : 'block';
  }

  // ── DS UI · gedeelde stijl ────────────────────────────────────
  // Deze lijst staat LETTERLIJK ook in het andere bestand (ds-logboek.js ↔
  // tourtool/extra-rijtijd.js). De widget draait in een eigen iframe-document
  // en gebruikt de regels kaal; het rijtijd-paneel hangt in de DireXtion-pagina
  // zelf en zet er per regel '#<paneel-id> ' voor, anders lekken ze naar
  // DireXtion. build.py vergelijkt beide lijsten teken voor teken en faalt als
  // ze uit elkaar lopen — wijzig dus altijd allebei.
  //
  // Tokens: blauw #0090e3 (hover #007bc4) · donkerblauw #285dab · oranje #ff6600
  //   vlak #F2F7FC / rand #cce9f9 · rand #DDDDDD · gedempt #999999 · tekst #333333
  //   groen #155724 tekst / #d4edda vlak / #00B900 rand · rood #E50000
  //   amber #856404 tekst / #fff8e1 vlak / #ffc107 rand
  // Type:  17/700 kop · 14/600 vraag · 13 tekst en knop · 12 blok · 11 klein
  //        10 uppercase kapje (.6px spatiëring)
  // Maat:  14 padding · 10 blokafstand · 8 stapel · 5 dicht
  // Hoek:  10 paneel · 8 knop · 6 veld en blok · 4 pil
  var DS_UI = [
    '.header{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #DDDDDD;flex-shrink:0;background:#fff;}',
    '.header-title{color:#285dab;font-size:17px;font-weight:700;}',
    '.header-actions{display:flex;gap:6px;align-items:center;}',
    '.close-btn{font-size:16px;background:none;border:none;color:#999999;cursor:pointer;padding:0 4px;line-height:1;font-weight:300;}',
    '.close-btn:hover{color:#333333;}',
    '.toggle-btn{font-size:10px;background:#F3F3F3;border:1px solid #DDDDDD;color:#999999;padding:3px 9px;border-radius:4px;cursor:pointer;font-family:inherit;}',
    '.toggle-btn:hover{border-color:#0090e3;color:#0090e3;}',
    '.content{flex-shrink:0;padding:14px;}',
    '.status-bar{font-size:11px;background:#F2F7FC;border:1px solid #cce9f9;padding:8px 12px;border-radius:6px;margin-bottom:12px;color:#285dab;}',
    '.status-line{display:block;margin-bottom:2px;}',
    'label{font-size:14px;font-weight:600;color:#333333;display:block;margin-bottom:8px;}',
    '.section-label{display:block;font-size:10px;font-weight:400;color:#999999;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;}',
    'input[type=text],input[type=number]{width:100%;padding:9px 11px;border:1px solid #DDDDDD;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box;color:#333333;background:#fff;outline:none;}',
    'input[type=text]:focus,input[type=number]:focus{border-color:#0090e3;}',
    '.ux-btn{width:100%;text-align:left;padding:9px 13px;margin-bottom:5px;border:1px solid #DDDDDD;border-radius:8px;background:#F2F7FC;cursor:pointer;font-size:13px;font-family:inherit;color:#333333;font-weight:500;transition:0.12s;}',
    '.ux-btn:hover{border-color:#0090e3;}',
    '.ux-btn.selected{background:#d4edda;border-color:#00B900;color:#155724;font-weight:600;}',
    '.btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:0;}',
    '.btn-grid .ux-btn{margin-bottom:0;font-size:12px;padding:8px 10px;}',
    '.action-btn{width:100%;padding:11px;border:none;border-radius:8px;background:#0090e3;color:#fff;font-weight:600;cursor:pointer;font-size:14px;font-family:inherit;margin-top:8px;}',
    '.action-btn:hover{background:#007bc4;}',
    '.submit-btn{background:#00B900;}',
    '.submit-btn:hover{background:#009900;}',
    '.back-btn{width:100%;padding:9px;background:#fff;border:1px solid #DDDDDD;border-radius:8px;color:#DDDDDD;font-size:13px;font-family:inherit;cursor:default;}',
    '.back-btn.active{border-color:#0090e3;color:#0090e3;cursor:pointer;}',
    '.back-btn.active:hover{background:#F2F7FC;}',
    '.info-box{font-size:12px;background:#F2F7FC;border:1px solid #cce9f9;border-left:4px solid #0090e3;padding:10px 12px;border-radius:6px;color:#285dab;margin-bottom:10px;line-height:1.5;}',
    '.warning-box{font-size:12px;background:#fff0f0;border:1px solid #E50000;border-left:4px solid #E50000;padding:10px 12px;border-radius:6px;color:#E50000;margin-bottom:10px;line-height:1.5;}',
    '.park-melding{font-size:12px;background:#fff8e1;border:1px solid #ffc107;border-left:4px solid #ffc107;padding:10px 12px;border-radius:6px;color:#856404;margin-bottom:10px;line-height:1.5;}',
    '.park-melding b{color:#533f03;}',
    '.summary-box{font-size:12px;background:#F2F7FC;border-left:4px solid #cce9f9;padding:12px;border-radius:6px;color:#333333;margin-bottom:10px;line-height:1.6;}',
    '.section-divider{border:none;border-top:1px solid #DDDDDD;margin:10px 0 8px;}',
    '.toggle-link{font-size:12px;color:#0090e3;text-align:center;margin:6px 0;cursor:pointer;}',
    '.toggle-link:hover{text-decoration:underline;}',
    '.footer{padding:10px 14px;border-top:1px solid #DDDDDD;flex-shrink:0;background:#fff;}',
    '.footer-inner{display:flex;flex-direction:column;gap:6px;}',
    '.footer-hint{font-size:11px;color:#999999;text-align:center;line-height:1.4;}',
    '.version-bar{text-align:center;padding:5px 14px;background:#F3F3F3;border-top:1px solid #DDDDDD;font-size:11px;color:#999999;flex-shrink:0;}',
    '.pill{display:inline-block;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;white-space:nowrap;}',
    '.pill-blue{background:#F2F7FC;color:#285dab;}',
    '.pill-green{background:#d4edda;color:#155724;}',
    '.pill-amber{background:#fff8e1;color:#856404;}'
  ];

  // ── Alleen dit paneel ─────────────────────────────────────────
  // De omhulling en de uitslaglijst; alles wat de widget ook kent staat
  // hierboven in DS_UI. Elke regel hier is al voorzien van de #id-prefix.
  var DS_PANEEL = [
    '#' + PANEL_ID + '{position:fixed;top:70px;right:20px;width:360px;max-height:82vh;overflow:auto;' +
      'background:#fff;border:2px solid #0090e3;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.18);' +
      'font-family:"Segoe UI",Arial,sans-serif;font-size:13px;color:#333333;z-index:999999;}',
    '#' + PANEL_ID + ' .header{border-radius:8px 8px 0 0;}',
    '#' + PANEL_ID + ' .version-bar{border-radius:0 0 8px 8px;}',
    '#' + PANEL_ID + ' .er-veld{margin-bottom:10px;}',
    '#' + PANEL_ID + ' .er-samenvatting{display:flex;justify-content:space-between;align-items:baseline;' +
      'gap:10px;cursor:pointer;margin-bottom:10px;}',
    '#' + PANEL_ID + ' .er-samenvatting:hover{border-color:#0090e3;}',
    '#' + PANEL_ID + ' .er-sam-link{margin:0;white-space:nowrap;font-size:11px;}',
    '#' + PANEL_ID + ' .er-haal{text-align:center;margin:6px 0 0;}',
    '#' + PANEL_ID + ' .er-twee{display:flex;gap:8px;margin-bottom:10px;}',
    '#' + PANEL_ID + ' .er-twee > div{flex:1;min-width:0;}',
    '#' + PANEL_ID + ' .er-netwerken{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:0;}',
    '#' + PANEL_ID + ' .er-net{width:auto;margin-bottom:0;display:flex;align-items:center;justify-content:center;' +
      'gap:5px;padding:8px 4px;font-size:12px;text-align:center;text-transform:none;letter-spacing:0;}',
    '#' + PANEL_ID + ' .er-net input{width:auto;margin:0;padding:0;cursor:pointer;}',
    '#' + PANEL_ID + ' .er-depots{max-height:132px;overflow:auto;border:1px solid #DDDDDD;' +
      'border-radius:6px;margin-top:6px;}',
    '#' + PANEL_ID + ' .er-depotrij{display:flex;align-items:center;gap:7px;padding:5px 8px;' +
      'margin-bottom:0;font-size:12px;font-weight:400;cursor:pointer;border-bottom:1px solid #F3F3F3;}',
    '#' + PANEL_ID + ' .er-depotrij:last-child{border-bottom:none;}',
    '#' + PANEL_ID + ' .er-depotrij:hover{background:#F2F7FC;}',
    '#' + PANEL_ID + ' .er-depotrij.aan{background:#F2F7FC;font-weight:600;color:#285dab;}',
    '#' + PANEL_ID + ' .er-depotrij input{width:auto;margin:0;padding:0;cursor:pointer;}',
    '#' + PANEL_ID + ' .er-depotleeg{padding:7px 8px;font-size:11px;color:#999999;}',
    '#' + PANEL_ID + ' .er-depothint{margin-top:5px;font-size:11px;color:#999999;line-height:1.4;}',
    '#' + PANEL_ID + ' .er-knoppen{display:flex;gap:8px;margin-top:10px;}',
    '#' + PANEL_ID + ' .er-knoppen .action-btn{flex:1;margin-top:0;}',
    '#' + PANEL_ID + ' .er-knoppen .back-btn{flex:0 0 82px;padding:11px 0;}',
    '#' + PANEL_ID + ' .er-status{margin-top:10px;font-size:11px;color:#999999;line-height:1.4;min-height:15px;}',
    '#' + PANEL_ID + ' .er-status.fout{color:#E50000;}',
    '#' + PANEL_ID + ' .er-rij{padding:9px 8px;margin:0 -8px;border-bottom:1px solid #DDDDDD;border-radius:6px;cursor:pointer;}',
    '#' + PANEL_ID + ' .er-rij:hover{background:#F2F7FC;}',
    '#' + PANEL_ID + ' .er-rij-kop{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}',
    '#' + PANEL_ID + ' .er-rit{font-size:13px;font-weight:600;color:#285dab;}',
    '#' + PANEL_ID + ' .er-uitloop{text-align:right;line-height:1.15;white-space:nowrap;}',
    '#' + PANEL_ID + ' .er-getal{display:block;font-size:17px;font-weight:700;}',
    '#' + PANEL_ID + ' .er-uitloop .section-label{margin-bottom:0;text-align:right;}',
    '#' + PANEL_ID + ' .er-rij-sub{margin-top:4px;font-size:12px;line-height:1.4;}',
    '#' + PANEL_ID + ' .er-opbouw{margin-top:3px;font-size:11px;color:#999999;}',
    '#' + PANEL_ID + ' .er-meer{margin-top:9px;text-align:center;}',
    '#' + PANEL_ID + ' .er-goed{color:#155724;font-weight:600;}',
    '#' + PANEL_ID + ' .er-slecht{color:#E50000;font-weight:600;}',
    '#' + PANEL_ID + ' .er-ster{color:#ff6600;}',
    '#' + PANEL_ID + ' .er-depot{margin:6px 0 0;padding:6px 9px;font-size:11px;}',
    '#' + PANEL_ID + ' .er-sleutel-hint{margin-top:6px;font-size:11px;color:#856404;line-height:1.5;}',
    '#' + PANEL_ID + ' .er-uitleg{margin-top:14px;font-size:11px;color:#999999;}',
    '#' + PANEL_ID + ' .er-uitleg summary{cursor:pointer;color:#0090e3;font-size:12px;font-weight:600;list-style:none;outline:none;}',
    '#' + PANEL_ID + ' .er-uitleg summary:hover{text-decoration:underline;}',
    '#' + PANEL_ID + ' .er-uitleg summary::-webkit-details-marker{display:none;}',
    '#' + PANEL_ID + ' .er-uitleg summary:before{content:"\u25B8 ";}',
    '#' + PANEL_ID + ' .er-uitleg[open] summary:before{content:"\u25BE ";}',
    '#' + PANEL_ID + ' .er-uitleg ul{margin:7px 0 0;padding-left:15px;line-height:1.45;}',
    '#' + PANEL_ID + ' .er-uitleg li{margin-bottom:4px;}',
    '#' + PANEL_ID + ' .er-uitleg b{color:#333333;font-weight:600;}',
    '#' + PIL_ID + '{position:fixed;top:70px;right:20px;display:none;align-items:center;gap:8px;' +
      'background:#fff;border:1px solid #DDDDDD;border-left:4px solid #0090e3;border-radius:8px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:8px 11px;cursor:pointer;' +
      'font:600 12px "Segoe UI",Arial,sans-serif;color:#333333;z-index:999999;max-width:300px;}',
    '#' + PIL_ID + ':hover{background:#F2F7FC;}',
    '#' + PIL_ID + ' .er-pil-icoon{color:#ff6600;font-weight:700;}'
  ];

  // DS_UI staat kaal in ds-logboek.js (eigen iframe-document); hier moet elke
  // regel gescopet worden, anders herstijlt hij de DireXtion-pagina eromheen.
  var css = DS_UI.map(function (regel) {
    return '#' + PANEL_ID + ' ' + regel;
  }).join('') + DS_PANEEL.join('');

  var stijl = document.createElement('style');
  stijl.textContent = css;
  document.head.appendChild(stijl);

  var panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML =
    '<div class="header"><span class="header-title">Extra rijtijd</span>' +
      '<div class="header-actions">' +
        '<button class="toggle-btn er-klein" title="Inklappen tot pilletje">\u2212</button>' +
        '<button class="close-btn er-sluit" title="Sluiten">\u2715</button>' +
      '</div></div>' +
    '<div class="content">' +
      '<div id="er-sleutel" class="park-melding er-sleutel" style="display:none">' +
        '<label class="section-label">OpenRouteService-sleutel</label>' +
        '<input type="text" id="er-orskey" placeholder="plak hier je sleutel">' +
        '<button class="ux-btn er-haal" id="er-orsopslaan">Sleutel opslaan</button>' +
        '<div class="er-sleutel-hint">Gratis via openrouteservice.org \u2192 Dashboard. ' +
          'Zonder sleutel lopen de rijtijden via de OSRM-demoserver, die daar niet ' +
          'voor bedoeld is.</div>' +
      '</div>' +
      '<div id="er-samenvatting" class="status-bar er-samenvatting" style="display:none">' +
        '<span id="er-sam-tekst"></span>' +
        '<span class="toggle-link er-sam-link">Wijzigen</span></div>' +
      '<div id="er-form">' +
      '<div class="er-veld">' +
        '<label class="section-label" for="er-adres">Nieuwe stop \u2014 adres</label>' +
        '<input type="text" id="er-adres" placeholder="Kerkstraat 12, 2101 AB Heemstede">' +
        '<button class="ux-btn er-haal" id="er-logboek">\u2193 Adres uit DS Logboek</button>' +
      '</div>' +
      '<div class="er-twee">' +
        '<div><label class="section-label">Servicetijd (min)</label>' +
          '<input id="er-servicetijd" type="number" min="0" step="5" placeholder="0"></div>' +
        '<div><label class="section-label">Eigen rit</label>' +
          '<input type="text" id="er-eigenrit" placeholder="bijv. 2M-NLRO-07"></div>' +
      '</div>' +
      '<div class="er-veld">' +
        '<label class="section-label">Netwerken die de aftercare mogen doen</label>' +
        '<div class="er-netwerken">' +
          NETWERKEN.map(function (n) {
            return '<label class="ux-btn er-net" id="er-net-lbl-' + n + '">' +
              '<input type="checkbox" id="er-net-' + n + '"> ' + n + '</label>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="er-veld" id="er-depotblok" style="display:none">' +
        '<label class="section-label">Depots die doorzocht worden</label>' +
        '<input type="text" id="er-depotzoek" placeholder="zoek depot\u2026">' +
        '<div class="er-depots" id="er-depotlijst"></div>' +
        '<div class="er-depothint" id="er-depothint"></div>' +
      '</div>' +
      '</div>' +
      '<div class="er-knoppen">' +
        '<button class="action-btn er-bereken">Bereken</button>' +
        '<button class="back-btn active er-wis" title="Resultaten wissen">Wissen</button></div>' +
      '<div id="er-status" class="er-status"></div><div id="er-resultaten"></div>' +
      '<details class="er-uitleg"><summary>Hoe werkt dit?</summary><ul>' +
        '<li><b>Ritten</b> \u2014 van alle ritten gaan er ' + MAX_ROUTE_RITTEN + ' echt de ' +
          'router in: de ' + ALTIJD_DICHTSTBIJ + ' dichtstbijzijnde, plus de ritten waar ' +
          'de voorsprong de klus vermoedelijk opvangt.</li>' +
        '<li><b>Volgorde</b> \u2014 1. past binnen de voorsprong \u00b7 2. niet krap \u00b7 ' +
          '3. lichtste ploeg \u00b7 4. kortste omweg.</li>' +
        '<li><b>Eerstvolgende stop</b> \u2014 kan niet: die haalt de sync naar de werktelefoon ' +
          'niet. De stop daarna kan wel, maar staat als \u26A0 krap.</li>' +
        '<li><b>Nog op het depot</b> \u2014 dan geldt die beperking niet, maar moet je de TL ' +
          'informeren na het inplannen.</li>' +
        '<li><b>Eigen rit</b> \u2014 de rit van de klant valt af: meegegeven door het logboek, ' +
          'of herkend doordat het adres er als stop in staat.</li>' +
        '<li><b>Netwerken</b> \u2014 vink zelf aan welke ploegen het werk mogen doen.</li>' +
        '<li><b>Depots</b> \u2014 alle depots binnen ' + DEPOT_STRAAL_KM + ' km van het adres ' +
          'doen vanzelf mee (in Belgi\u00eb alle drie), dus ook een buurdepot met ruimte. ' +
          'Zelf aanvinken kan; je filter in de Ritmonitor blijft staan zoals het staat.</li>' +
        '<li><b>Adres</b> \u2014 PDOK (BAG) voor NL, Nominatim voor BE/DE. Welke bron ' +
          'het werd en wat hij vond, staat onder de uitslag.</li>' +
        '<li><b>Rijtijden</b> \u2014 OpenRouteService met eigen sleutel, of de OSRM-demo ' +
          'zolang die sleutel ontbreekt. Geen actuele filedruk.</li>' +
      '</ul></details>' +
    '</div>' +
    '<div class="version-bar">Extra rijtijd ' + RIJTIJD_VERSION + '</div>';
  document.body.appendChild(panel);

  var pil = document.createElement('div');
  pil.id = PIL_ID;
  pil.innerHTML = '<span class="er-pil-icoon">★</span><span id="er-pil-tekst">Extra rijtijd</span>';
  document.body.appendChild(pil);

  var adresInput = document.getElementById('er-adres');
  var serviceInput = document.getElementById('er-servicetijd');
  var eigenRitInput = document.getElementById('er-eigenrit');
  adresInput.value = laad(KEY_ADRES, '') || '';
  zetNetwerken(laad(KEY_NETWERKEN, NETWERKEN.slice()));

  // De depotlijst komt uit de TagBox van het filterpaneel. Die is bij het
  // openen meestal al gevuld, maar laadt zijn store soms net iets later —
  // vandaar één herkansing in plaats van meteen opgeven.
  function laadDepots() {
    depotLijst = depotOpties();
    tekenDepots();
  }
  laadDepots();
  if (!depotLijst.length) setTimeout(laadDepots, 1500);

  // Sleutelveld alleen tonen als er nog geen sleutel is.
  var sleutelBlok = document.getElementById('er-sleutel');
  function toonSleutelveld() { sleutelBlok.style.display = ORS_KEY ? 'none' : 'block'; }
  toonSleutelveld();
  document.getElementById('er-orsopslaan').onclick = function () {
    var v = document.getElementById('er-orskey').value.trim();
    if (!v) { status('Plak eerst een sleutel.', true); return; }
    ORS_KEY = v;
    bewaar(KEY_ORS, v);
    toonSleutelveld();
    status('Sleutel opgeslagen \u2014 rijtijden lopen nu via OpenRouteService.');
  };

  // Eén weg naar binnen, ongeacht waar het logboek draait. Het publiceert het
  // verzoek naar localStorage én naar het klembord. localStorage werkt alleen
  // op dezelfde origin (Basic \u2194 Ritmonitor) en zou zichzelf kunnen invullen;
  // het klembord werkt overal maar mag alleen na een gebruikersactie gelezen
  // worden. Dat zou twee verschillende ervaringen opleveren: op Basic staat
  // het adres er ineens, vanaf de consumer portal moet je klikken. Daarom
  // loopt het overal via deze knop — ook waar het automatisch zou kunnen.
  // Geen automatische invulling, geen storage-listener.
  var VERZOEK_MAX_MIN = 30;

  function versGenoeg(v) {
    return !!v && (Date.now() - (v.time || 0)) < VERZOEK_MAX_MIN * 60 * 1000;
  }

  function teOud() {
    status('Het klaargezette adres is ouder dan ' + VERZOEK_MAX_MIN +
           ' minuten \u2014 zet het opnieuw klaar in het logboek.', true);
  }

  function nietsKlaar() {
    status('Nog geen adres klaargezet. Klik in het logboek eerst op ' +
           '"Adres klaarzetten voor reistijd-check".', true);
  }

  // Beide bronnen lezen en de jongste laten winnen. Ze lopen namelijk uiteen:
  // draait het logboek op de consumer portal, dan schrijft het naar de
  // localStorage van d\u00ed\u00e9 origin en bereikt alleen het klembord de
  // Ritmonitor. De localStorage hier houdt dan nog het verzoek van een eerdere
  // casus op Basic vast \u2014 binnen het half uur "vers genoeg", en daarmee laadde
  // de tool de oude stop terwijl het klembord de nieuwe al klaar had staan.
  function kiesJongste(v, w) {
    if (w && (!v || (w.time || 0) > (v.time || 0))) return { v: w, bron: 'klembord' };
    return { v: v, bron: 'logboek' };
  }

  document.getElementById('er-logboek').onclick = function (e) {
    e.preventDefault();
    var v = null;
    try { v = leesVerzoek(localStorage.getItem(REISTIJD_KEY)); } catch (er) {}
    function beslis(w) {
      var k = kiesJongste(v, w);
      // De jongste is stale \u21d2 de ander ook: die is per definitie ouder.
      if (versGenoeg(k.v)) { pasVerzoekToe(k.v, k.bron); return; }
      if (k.v) teOud(); else nietsKlaar();
    }
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (t) {
        beslis(leesVerzoek(t));
      }).catch(function () {
        // Zonder klembord is localStorage het enige wat er is; dat kan het
        // verzoek van een eerdere casus zijn, dus de bron staat in de melding.
        if (versGenoeg(v)) { pasVerzoekToe(v, 'logboek'); return; }
        status('Klembord lezen mag niet \u2014 plak het adres handmatig.', true);
      });
    } else { beslis(null); }
  };

  panel.querySelector('.er-samenvatting').onclick = function () { vouwForm(true); };

  pil.onclick = function () { toonPil(false); };
  panel.querySelector('.er-klein').onclick = function () { toonPil(true); };
  panel.querySelector('.er-sluit').onclick = function () {
    verwijderKolom(); panel.remove(); pil.remove(); stijl.remove();
  };
  panel.querySelector('.er-bereken').onclick = function () {
    var a = adresInput.value.trim();
    if (!a) { status('Vul eerst een adres in.', true); return; }
    var nets = gekozenNetwerken();
    if (!nets.length) { status('Vink minstens één netwerk aan.', true); return; }
    bewaar(KEY_NETWERKEN, nets);
    var s = parseInt(serviceInput.value, 10);
    // Alleen een eigen keuze doorgeven; anders kiest scan() zelf op afstand.
    scan(a, (isNaN(s) || s < 0) ? 0 : s, eigenRitInput.value.trim(), nets,
         depotHandmatig ? depotKeuze.slice() : null);
  };
  panel.querySelector('.er-wis').onclick = function () {
    resultaten = []; bewaar(KEY_RES, resultaten);
    kolomData = { tourId: null, perSeq: {}, risico: {}, beste: null };
    var inst = gridInstance(); if (inst) { try { inst.repaint(); } catch (e) {} }
    vouwForm(true);
    render(); status('');
  };
  function opEnter(e) { if (e.key === 'Enter') panel.querySelector('.er-bereken').click(); }
  adresInput.addEventListener('keydown', opEnter);
  serviceInput.addEventListener('keydown', opEnter);
  eigenRitInput.addEventListener('keydown', opEnter);
  // Zelf een adres typen betekent: de taak uit het logboek hoort er niet meer bij.
  // Adres en ritcode bepalen ook het land, en dus welke depots mogen meedoen.
  // Een ander adres is een andere nazorg: de depotkeuze hoort dan weer uit
  // de afstand te volgen, ook als je hem daarvoor met de hand had gezet.
  function adresGewijzigd() { depotHandmatig = false; depotKeuze = []; tekenDepots(); }
  adresInput.addEventListener('input', function () {
    laatsteTaak = ''; laatsteFormaat = ''; adresGewijzigd();
  });
  eigenRitInput.addEventListener('input', adresGewijzigd);
  // Vinkjes meteen onthouden, niet pas bij Bereken.
  NETWERKEN.forEach(function (n) {
    var el = document.getElementById('er-net-' + n);
    if (el) el.addEventListener('change', function () {
      markeerNetwerken();
      bewaar(KEY_NETWERKEN, gekozenNetwerken());
    });
  });
  // Depotvinkjes gedelegeerd: de lijst wordt bij elke zoekactie hertekend,
  // dus losse listeners per regel zouden telkens weg zijn.
  document.getElementById('er-depotlijst').addEventListener('change', function (e) {
    var vak = e.target;
    if (!vak || !vak.getAttribute) return;
    var id = vak.getAttribute('data-depot');
    if (!id) return;
    var i = depotKeuze.indexOf(id);
    if (vak.checked && i === -1) depotKeuze.push(id);
    if (!vak.checked && i !== -1) depotKeuze.splice(i, 1);
    depotHandmatig = true;
    tekenDepots();
  });
  // Terug naar automatisch.
  document.getElementById('er-depothint').addEventListener('click', function (e) {
    if (!e.target || e.target.className.indexOf('er-depotauto') === -1) return;
    depotHandmatig = false; depotKeuze = []; tekenDepots();
  });
  document.getElementById('er-depotzoek').addEventListener('input', tekenDepots);

  // Altijd open beginnen, ook met bewaarde resultaten in beeld. Dichtklappen
  // is het gevolg van een berekening die je zojuist deed — geen toestand waar
  // je in belandt. Wie de tool opent wil een nieuw adres invoeren, en dan
  // horen het adresveld en de knop "Adres uit DS Logboek" er te staan in
  // plaats van verstopt achter een klik op de samenvattingsbalk.
  vouwForm(true);
  render();
  console.log('[Extra rijtijd] geladen — scant alle ritten, voorsprong telt mee');
})();
