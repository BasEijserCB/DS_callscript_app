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

  var RIJTIJD_VERSION = 'v1.4.0';

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

  // ── rittenlijst ──────────────────────────────────────────────
  function normTour(t) {
    var id = uw(t.id); if (id == null) id = uw(t.TourId); if (id == null) id = uw(t.Id);
    if (id == null) return null;
    var naam = uw(t.name) || uw(t.Name) || uw(t.Alias) || '';
    var ref = uw(t.referenceId) || uw(t.ReferenceId) || '';
    return { id: id, naam: String(naam || ref || id), ref: String(ref || '') };
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
  function haalTours() {
    var root = koRoot();
    var fallback = uitObservable(root);
    var f = root && root.tourFilter;
    if (!f || !window.ko) return Promise.resolve(fallback);
    var url;
    try {
      var stat = JSON.stringify(window.ko.toJS(f.staticFilter));
      var state = JSON.stringify(window.ko.toJS(f.stateFilter));
      var orde = String(uw(root.sortProperty) || 'referenceId');
      url = TOURS_URL + '?filter=' + encodeURIComponent(stat) +
            '&stateFilter=' + encodeURIComponent(state) +
            '&orderField=' + encodeURIComponent(orde) + '&skip=0&take=300';
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
  function vergelijkGaten(a, b) {
    if (a.past !== b.past) return a.past ? -1 : 1;
    if (a.risico !== b.risico) return a.risico ? 1 : -1;
    return a.totaal - b.totaal;
  }

  function scan(adres, service, eigenRit, netwerken) {
    status('Adres opzoeken…');
    return geocode(adres).then(function (nieuw) {
      status('Ritten ophalen…');
      return haalTours().then(function (alleTours) {
        if (!alleTours.length) throw new Error('Geen ritten in de lijst gevonden.');

        // Eerst schiften, dan pas stops ophalen — scheelt tientallen requests.
        var eigenKern = ritKern(eigenRit);
        overslag = { eigen: 0, netwerk: 0, netwerken: netwerken, eigenRit: eigenKern, geo: nieuw, orsLoos: !ORS_KEY };
        var tours = alleTours.filter(function (t) {
          if (eigenKern && ritKern(t.naam) === eigenKern) { overslag.eigen++; return false; }
          var nw = netwerkVan(t.naam);
          if (nw && netwerken.indexOf(nw) === -1) { overslag.netwerk++; return false; }
          return true;
        });
        if (!tours.length) throw new Error('Geen ritten over in de aangevinkte netwerken.');
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
          kandidaten.sort(function (a, b) { return a.dichtst - b.dichtst; });
          var kort = kandidaten.slice(0, MAX_ROUTE_RITTEN);
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
                vanafSeq: k.toekomst[0].SequenceNumber, overgeslagen: k.gehad,
                voorsprong: k.voorsprong, service: service, onderweg: k.onderweg,
                afstand: Math.round(k.dichtst * 10) / 10, gaps: gaps
              };
            });
          }, function (k, n) { status('Rijtijden ' + k + '/' + n + '…'); })
          .then(function (res) {
            resultaten = res.filter(Boolean);
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
        resultaten.forEach(function (r, idx) {
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
            '<div class="er-detail">' + g.basis + ' \u2192 ' + g.via + ' min rijden \u00b7 ' +
            r.afstand + ' km \u00b7 vanaf stop ' + r.vanafSeq +
            (r.overgeslagen ? ' (' + r.overgeslagen + ' gehad)' : '') + '</div></div>';
        });
        var uitleg = [];
        if (overslag.geo && overslag.geo.label) {
          uitleg.push('adres via ' + esc(overslag.geo.bron) + ': ' + esc(overslag.geo.label));
        }
        if (overslag.eigen) uitleg.push('eigen rit ' + esc(overslag.eigenRit) + ' overgeslagen' + (overslag.auto ? ' (zelf herkend op het adres)' : ''));
        if (overslag.netwerk) uitleg.push(overslag.netwerk + ' rit(ten) buiten het netwerkfilter');
        if (overslag.netwerken && overslag.netwerken.length < NETWERKEN.length) {
          uitleg.push('alleen ' + overslag.netwerken.join(', '));
        }
        if (uitleg.length) html += '<div class="er-status">' + uitleg.join(' \u00b7 ') + '</div>';
        if (overslag.orsLoos) {
          html += '<div class="park-melding er-depot">\u2691 Nog geen OpenRouteService-sleutel \u2014 ' +
                  'rijtijden komen van de OSRM-demoserver, die daar niet voor bedoeld is. ' +
                  'Vul ORS_KEY in bovenaan het bestand.</div>';
        }
        body.innerHTML = html;
        Array.prototype.forEach.call(body.querySelectorAll('.er-rij'), function (el) {
          el.onclick = function () { selecteerRit(parseInt(el.getAttribute('data-tour'), 10)); };
        });
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

  // Na een berekening is het invulblok bijzaak: de ranglijst is waar het om
  // gaat, en die stond bij vier velden plus vier vinkjes ruim onder de vouw.
  // Het blok klapt daarom dicht tot één regel met wat er is doorgerekend, en
  // gaat weer open zodra je erop klikt, op Wissen drukt, of het logboek een
  // nieuw adres aanlevert.
  function samenvatting() {
    var adres = (document.getElementById('er-adres') || {}).value || '';
    var st = parseInt((document.getElementById('er-servicetijd') || {}).value, 10);
    var nets = gekozenNetwerken();
    var delen = [adres || 'geen adres'];
    if (!isNaN(st) && st > 0) delen.push(st + ' min service');
    if (nets.length && nets.length < NETWERKEN.length) delen.push(nets.join(', '));
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
    '#' + PANEL_ID + ' .er-detail{margin-top:2px;font-size:11px;color:#999999;}',
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
      '</div>' +
      '<div class="er-knoppen">' +
        '<button class="action-btn er-bereken">Bereken</button>' +
        '<button class="back-btn active er-wis" title="Resultaten wissen">Wissen</button></div>' +
      '<div id="er-status" class="er-status"></div><div id="er-resultaten"></div>' +
      '<details class="er-uitleg"><summary>Hoe werkt dit?</summary><ul>' +
        '<li><b>Ritten</b> \u2014 alle ritten uit de lijst; de ' + MAX_ROUTE_RITTEN +
          ' dichtstbijzijnde gaan echt de router in.</li>' +
        '<li><b>Volgorde</b> \u2014 1. past binnen de voorsprong \u00b7 2. niet krap \u00b7 ' +
          '3. lichtste ploeg \u00b7 4. kortste omweg.</li>' +
        '<li><b>Eerstvolgende stop</b> \u2014 kan niet: die haalt de sync naar de werktelefoon ' +
          'niet. De stop daarna kan wel, maar staat als \u26A0 krap.</li>' +
        '<li><b>Nog op het depot</b> \u2014 dan geldt die beperking niet, maar moet je de TL ' +
          'informeren na het inplannen.</li>' +
        '<li><b>Eigen rit</b> \u2014 de rit van de klant valt af: meegegeven door het logboek, ' +
          'of herkend doordat het adres er als stop in staat.</li>' +
        '<li><b>Netwerken</b> \u2014 vink zelf aan welke ploegen het werk mogen doen.</li>' +
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

  document.getElementById('er-logboek').onclick = function (e) {
    e.preventDefault();
    var v = null;
    try { v = leesVerzoek(localStorage.getItem(REISTIJD_KEY)); } catch (er) {}
    if (versGenoeg(v)) { pasVerzoekToe(v, 'logboek'); return; }
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (t) {
        var w = leesVerzoek(t);
        if (versGenoeg(w)) { pasVerzoekToe(w, 'klembord'); return; }
        if (w || v) teOud(); else nietsKlaar();
      }).catch(function () {
        status('Klembord lezen mag niet \u2014 plak het adres handmatig.', true);
      });
    } else if (v) { teOud(); } else { nietsKlaar(); }
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
    scan(a, (isNaN(s) || s < 0) ? 0 : s, eigenRitInput.value.trim(), nets);
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
  adresInput.addEventListener('input', function () { laatsteTaak = ''; laatsteFormaat = ''; });
  // Vinkjes meteen onthouden, niet pas bij Bereken.
  NETWERKEN.forEach(function (n) {
    var el = document.getElementById('er-net-' + n);
    if (el) el.addEventListener('change', function () {
      markeerNetwerken();
      bewaar(KEY_NETWERKEN, gekozenNetwerken());
    });
  });

  vouwForm(!resultaten.length);
  render();
  console.log('[Extra rijtijd] geladen — scant alle ritten, voorsprong telt mee');
})();
