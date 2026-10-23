/* ─────────────────────────────────────────────────────────────
   LAADVERMOGEN — GAS-endpoint voor laadvermogen.js
   Hoort in het Apps Script-project van de sheet "Unplanneds tool
   Delivery Support". Handmatig kopiëren: een commit hier verandert
   niets in productie.

   WAT HET DOET
   Leest het tabblad "Unplanneds Potentieel" en geeft per route_id het
   maximale laadvermogen uit Fleetio terug, in kg. Meer niet: geen
   kentekens, geen depots, geen gewichten — die heeft de planningsmodule
   zelf al, en dit endpoint is anoniem bereikbaar.

   ANTWOORD
   { ok: true, datum: '2026-10-23', opgehaald: '2026-10-23T07:41:02+02:00',
     routes: { '1361842': 1008, ... },        // kg
     zonder: { '1361670': 'geen Fleetio voertuig', ... } }

   Met ?callback=naam komt het terug als JavaScript (JSONP). Dat moet:
   fetch kan de uitvoer van een web-app cross-origin niet lezen (zie
   v1.35.0 in CLAUDE.md), een <script>-tag wel.

   DEPLOY
   Implementeren → Nieuwe implementatie → Web-app
     Uitvoeren als: ik      Toegang: Iedereen
   De /exec-URL gaat in GAS_URL bovenin laadvermogen.js.

   LET OP: heeft het project al een doGet, dan botsen ze — Apps Script
   kent er maar één. Hernoem deze dan en roep hem aan vanuit de
   bestaande doGet, bijvoorbeeld op ?actie=laadvermogen.
   ───────────────────────────────────────────────────────────── */

var LAADVERMOGEN = {
  TABBLAD: 'Unplanneds Potentieel',
  // Kolommen op kopnaam, niet op letter: het tabblad heeft formules en
  // vrije kolommen ernaast, en een ingevoegde kolom mag dit niet breken.
  KOP_DATUM: 'delivery_date',
  KOP_ROUTE: 'route_id',
  KOP_MAX: 'Max laadvermogen bus',   // begint met; de rest is "(vanuit Fleetio)"
  KOP_KENTEKEN: 'license_plate',
  // Vangnet voor een lege kolom I: dezelfde opzoeking als de formule,
  // tegen het tabblad met de Fleetio-export.
  FLEETIO_TABBLAD: 'Fleetio Data',
  FLEETIO_KENTEKEN: 'License Plate',
  FLEETIO_GEWICHT: 'Capacity #1 - Weight (kg)',
  TZ: 'Europe/Amsterdam',
  CACHE_SEC: 300
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  var data;
  try {
    data = laadvermogenData_();
  } catch (err) {
    console.error('laadvermogen: ' + err);
    data = { ok: false, fout: String(err) };
  }
  var json = JSON.stringify(data);
  // Alleen een kale functienaam als callback: anders is dit een open
  // deur om willekeurige JavaScript op andermans pagina te laten draaien.
  if (p.callback && /^[A-Za-z_$][\w$]{0,63}$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function laadvermogenData_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('laadvermogen');
  if (hit) return JSON.parse(hit);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LAADVERMOGEN.TABBLAD);
  if (!sheet) throw new Error('Tabblad "' + LAADVERMOGEN.TABBLAD + '" niet gevonden');

  var rijen = sheet.getDataRange().getValues();
  var kop = rijen[0].map(function (k) { return String(k).trim(); });
  var iDatum = kop.indexOf(LAADVERMOGEN.KOP_DATUM);
  var iRoute = kop.indexOf(LAADVERMOGEN.KOP_ROUTE);
  var iKenteken = kop.indexOf(LAADVERMOGEN.KOP_KENTEKEN);
  var iMax = -1;
  kop.forEach(function (k, i) { if (iMax < 0 && k.indexOf(LAADVERMOGEN.KOP_MAX) === 0) iMax = i; });
  if (iDatum < 0 || iRoute < 0 || iMax < 0) {
    throw new Error('Kolom ontbreekt: ' + [
      iDatum < 0 ? LAADVERMOGEN.KOP_DATUM : '',
      iRoute < 0 ? LAADVERMOGEN.KOP_ROUTE : '',
      iMax < 0 ? LAADVERMOGEN.KOP_MAX : ''
    ].filter(String).join(', '));
  }

  // Het tabblad hoort maar één dag te bevatten (de query filtert op
  // CURRENT_DATE). Mocht er toch meer in staan, dan wint de meest
  // voorkomende datum en vallen de rest weg — de client vergelijkt die
  // datum met de planningsdatum en past niets toe als ze verschillen.
  var perDatum = {};
  var regels = [];
  for (var r = 1; r < rijen.length; r++) {
    var rij = rijen[r];
    var id = rij[iRoute];
    if (id === '' || id === null) continue;
    id = String(Math.round(Number(id)));
    if (id === 'NaN') continue;
    var datum = rij[iDatum] instanceof Date
      ? Utilities.formatDate(rij[iDatum], LAADVERMOGEN.TZ, 'yyyy-MM-dd')
      : String(rij[iDatum]);
    perDatum[datum] = (perDatum[datum] || 0) + 1;
    regels.push({ id: id, datum: datum, max: rij[iMax], kenteken: iKenteken >= 0 ? rij[iKenteken] : '' });
  }
  var dag = Object.keys(perDatum).sort(function (a, b) { return perDatum[b] - perDatum[a]; })[0] || '';

  // Kolom I is een formule die naar beneden doorgetrokken moet zijn. Levert
  // de query meer rijen dan de formule dekt (23-10-2026: formule t/m rij 344,
  // data t/m 349), dan blijft I leeg terwijl Fleetio de bus wél kent. Voor
  // een lege cel doen we dezelfde opzoeking zelf. Een tekst in I ("geen
  // Fleetio voertuig", "Geen match…") is een echt antwoord en blijft staan.
  var fleetio = null;
  var aangevuld = [];

  var routes = {}, zonder = {};
  regels.forEach(function (x) {
    if (x.datum !== dag) return;
    if (x.max === '' && x.kenteken) {
      if (!fleetio) fleetio = leesFleetio_();
      var g = fleetio[kaalKenteken_(x.kenteken)];
      if (g) { x.max = g; aangevuld.push(x.id); }
    }
    var n = Number(x.max);
    if (x.max !== '' && isFinite(n) && n > 0) {
      // Fleetio levert grammen (1008000 = 1008 kg). Een getal onder de
      // 5000 is al kg — mocht de sheet ooit omgezet worden.
      routes[x.id] = Math.round((n > 5000 ? n / 1000 : n) * 100) / 100;
    } else {
      zonder[x.id] = String(x.max || 'leeg');
    }
  });

  var data = {
    ok: true,
    datum: dag,
    opgehaald: Utilities.formatDate(new Date(), LAADVERMOGEN.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    routes: routes,
    zonder: zonder,
    aangevuld: aangevuld
  };
  cache.put('laadvermogen', JSON.stringify(data), LAADVERMOGEN.CACHE_SEC);
  return data;
}

// "04. 2JWL091" → "2JWL091", "59-BVX-5" → "59BVX5". Zelfde normalisatie als
// de REGEXREPLACE in de formule, plus streepjes en spaties eruit.
function kaalKenteken_(k) {
  return String(k).trim().replace(/^\d+\.\s*/, '').replace(/[\s-]/g, '').toUpperCase();
}

function leesFleetio_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LAADVERMOGEN.FLEETIO_TABBLAD);
  if (!sheet) return {};
  var rijen = sheet.getDataRange().getValues();
  var kop = rijen[0].map(function (k) { return String(k).trim(); });
  var iK = kop.indexOf(LAADVERMOGEN.FLEETIO_KENTEKEN);
  var iG = kop.indexOf(LAADVERMOGEN.FLEETIO_GEWICHT);
  if (iK < 0 || iG < 0) return {};
  var uit = {};
  for (var r = 1; r < rijen.length; r++) {
    var g = Number(rijen[r][iG]);
    if (rijen[r][iK] && isFinite(g) && g > 0) uit[kaalKenteken_(rijen[r][iK])] = g;
  }
  return uit;
}

// Om in de editor te draaien: laat zien wat de client zou krijgen.
function testLaadvermogen() {
  CacheService.getScriptCache().remove('laadvermogen');
  var d = laadvermogenData_();
  console.log('datum ' + d.datum + ' · ' + Object.keys(d.routes).length + ' routes · ' +
              Object.keys(d.zonder).length + ' zonder Fleetio · ' +
              d.aangevuld.length + ' zelf aangevuld (kolom I leeg): ' + d.aangevuld.join(', '));
  console.log(JSON.stringify(d).slice(0, 800));
}
