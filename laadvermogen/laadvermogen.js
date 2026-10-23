/* ─────────────────────────────────────────────────────────────
   LAADVERMOGEN — het echte maximale gewicht per bus in de planningsmodule
   Draait op coolblue.dirextion.nl/ModulePlanningBeta.
   Staat volledig los van het DS Logboek en de Extra rijtijd-tool.

   WAAROM
   Sinds de overstap naar Fleetio toont DireXtion voor elke bus 730 kg als
   "Maximale gewicht voertuig", en kleurt de rit daarop rood. Het echte
   laadvermogen staat in de sheet "Unplanneds tool Delivery Support"
   (ververst elke nacht tussen 04 en 05). Deze tool zet die waarde in de
   bestaande kolom, alsof DireXtion hem zelf zo leverde.

   HOE
   - De Rit overzicht is een DevExpress MVC GridView (window.TourGrid). De
     server rendert de HTML bij elke actie opnieuw, dus de correctie wordt
     na elke callback opnieuw toegepast (TourGrid.EndCallback).
   - Koppelen op route-id: elke rij is <tr data-id="1361842">, en dat is
     route_id in de sheet. Geen kenteken- of aliasgepuzzel.
   - Kolommen op veldnaam (GetColumnByField), niet op positie: de gebruiker
     kan kolommen verslepen en verbergen.
   - De kleur van de twee gewichtskolommen wordt opnieuw berekend; die
     kwam van de server en was op de 730 kg gebaseerd.

   HERKENBAAR GECORRIGEERD
   Een gecorrigeerde cel staat cursief, met de oude waarde in de tooltip.
   Een route zonder Fleetio-voertuig houdt de waarde van DireXtion en krijgt
   een gestippelde rand. Het pilletje linksonder zegt hoeveel er klopt.

   NIET TOEGEPAST ALS
   de sheet van een andere dag is dan de planningsdatum — vóór 05:00, of
   bij het plannen van morgen. Dan meldt het pilletje dat, en blijft alles
   staan zoals DireXtion het gaf.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var LAADVERMOGEN_VERSION = '1.0.0';

  // /exec-URL van gas-laadvermogen.js. Leeg = de tool meldt dat en doet niets.
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbxcg30KXrBjnnnt2e8wb_ThaLP43LkvMuKrUFdQ8Y11ZjkJC6GcwIjUFc_bWFRxQS_EtA/exec';

  var KEY_DATA = 'laadvermogen_data';
  var DATA_MAX_MIN = 30;       // daarna opnieuw ophalen; de sheet ververst 's nachts
  var TIMEOUT_MS = 15000;

  // Drempels voor de kleur, als fractie van het laadvermogen. Afgeleid uit
  // wat DireXtion op 23-10-2026 toonde: groen t/m 32 %, oranje vanaf 52 %,
  // rood boven 100 %. Dat de grens op 50 % ligt is een aanname.
  var ORANJE_VANAF = 0.5;
  var ROOD_BOVEN = 1.0;
  var KLEUR = { groen: '#51A351', oranje: '#F89406', rood: '#FF5046' };

  // Veldnamen uit de kolomdefinitie van TourGrid; koptekst als terugval.
  var VELD = {
    max:     { veld: 'MaxLoadCapacity',                 kop: 'Maximale gewicht voertuig' },
    totaal:  { veld: 'TotalWeight',                     kop: 'Totaal gewicht' },
    beschik: { veld: 'AvailableLoadCapacity',           kop: 'Beschikbaar gewicht' },
    pct:     { veld: 'AvailableLoadCapacityPercentage', kop: null }
  };

  var PILL_ID = 'laadvermogen-pill';

  // ── Opslag ────────────────────────────────────────────────────────────────
  function lees(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function bewaar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ── Getallen in DireXtion-notatie ("1.287,12 kg") ─────────────────────────
  function leesGetal(tekst) {
    var m = String(tekst).match(/-?\d[\d.]*(?:,\d+)?/);
    return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : NaN;
  }
  function nlGetal(n, dec) {
    var s = Math.abs(n).toFixed(dec).split('.');
    return (n < 0 ? '-' : '') + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + s[1] : '');
  }
  // Vervangt alleen het getal en laat eenheid en decimalen zoals ze waren.
  function vervangGetal(tekst, n) {
    return String(tekst).replace(/-?\d[\d.]*(?:,(\d+))?/, function (_, dec) {
      return nlGetal(n, dec ? dec.length : 0);
    });
  }

  // ── Planningsdatum ────────────────────────────────────────────────────────
  function planDatum() {
    var el = document.getElementById('FilterDate_I');
    var v = el ? el.value : '';
    if (!v) { el = document.getElementById('filter-date'); v = el ? el.textContent : ''; }
    var m = String(v).match(/(\d{2})-(\d{2})-(\d{4})/);
    return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }

  // ── Data ophalen (JSONP) ──────────────────────────────────────────────────
  var data = null, fout = '', bezig = false;

  function haalData(forceer, klaar) {
    var c = lees(KEY_DATA);
    if (!forceer && c && c.data && c.data.ok && Date.now() - c.tijd < DATA_MAX_MIN * 60000) {
      data = c.data; fout = ''; klaar(); return;
    }
    if (!GAS_URL) { fout = 'GAS_URL is nog niet ingevuld'; klaar(); return; }
    if (bezig) return;
    bezig = true;
    var naam = '__laadvermogenCb' + Date.now();
    var s = document.createElement('script');
    var timer = setTimeout(function () { af('geen antwoord van de sheet binnen ' + TIMEOUT_MS / 1000 + ' s'); }, TIMEOUT_MS);
    function af(melding, d) {
      clearTimeout(timer);
      bezig = false;
      try { delete window[naam]; } catch (e) { window[naam] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
      if (d && d.ok) {
        data = d; fout = '';
        bewaar(KEY_DATA, { tijd: Date.now(), data: d });
      } else {
        fout = melding || (d && d.fout) || 'onbekende fout';
        // Een eerdere geslaagde ophaling blijft bruikbaar; die heeft zijn
        // eigen datum en wordt daarop gecontroleerd.
        if (!data && c && c.data && c.data.ok) data = c.data;
        console.error('[Laadvermogen] ophalen mislukt:', fout);
      }
      klaar();
    }
    window[naam] = function (d) { af(null, d); };
    s.onerror = function () { af('sheet niet bereikbaar (netwerk of deployment)'); };
    s.src = GAS_URL + (GAS_URL.indexOf('?') < 0 ? '?' : '&') + 'callback=' + naam + '&t=' + Date.now();
    document.head.appendChild(s);
  }

  // ── Kolommen vinden ───────────────────────────────────────────────────────
  // Geeft de cellIndex van de kolom in de koprij; die komt overeen met de
  // positie in de datarijen (zelfde aantal cellen, zelfde volgorde — ook de
  // selectiekolom heeft een kop, TourGrid_col0). -1 = niet zichtbaar.
  function kolomPositie(def) {
    var grid = window.TourGrid, kop = null;
    try {
      var kol = grid && grid.GetColumnByField ? grid.GetColumnByField(def.veld) : null;
      if (kol) kop = document.getElementById('TourGrid_col' + kol.index);
    } catch (e) {}
    if (!kop && def.kop) {
      var koppen = document.querySelectorAll('#TourGrid_DXHeaderTable td.dxgvHeader');
      for (var i = 0; i < koppen.length; i++) {
        if (koppen[i].textContent.replace(/\s+/g, ' ').trim() === def.kop) { kop = koppen[i]; break; }
      }
    }
    return kop ? kop.cellIndex : -1;
  }

  // ── Toepassen ─────────────────────────────────────────────────────────────
  var stand = { goed: 0, zonder: 0, onbekend: 0, rijen: 0, reden: '' };

  function kleurVoor(fractie) {
    return fractie > ROOD_BOVEN ? KLEUR.rood : fractie >= ORANJE_VANAF ? KLEUR.oranje : KLEUR.groen;
  }
  function zetKleur(cel, kleur) {
    if (cel) cel.style.setProperty('background-color', kleur, 'important');
  }
  // De oorspronkelijke tekst bewaren we op de cel zelf: toepassen kan twee
  // keer draaien zonder dat de server de rij opnieuw rendert, en dan mag
  // de oude waarde niet onze eigen correctie zijn.
  function origineel(cel) {
    if (!cel.hasAttribute('data-lv-orig')) cel.setAttribute('data-lv-orig', cel.textContent.trim());
    return cel.getAttribute('data-lv-orig');
  }

  function pasToe() {
    stand = { goed: 0, zonder: 0, onbekend: 0, rijen: 0, reden: '' };
    var rijen = document.querySelectorAll('#TourGrid_DXMainTable tr.dxgvDataRow[data-id]');
    stand.rijen = rijen.length;

    if (!data) { stand.reden = fout || 'nog geen data'; return toonPill(); }
    var dag = planDatum();
    if (dag && data.datum && dag !== data.datum) {
      stand.reden = 'sheet is van ' + nlDatum(data.datum) + ', planning staat op ' + nlDatum(dag);
      return toonPill();
    }

    var pMax = kolomPositie(VELD.max);
    if (pMax < 0) { stand.reden = 'kolom "Maximale gewicht voertuig" staat niet in beeld'; return toonPill(); }
    var pTot = kolomPositie(VELD.totaal);
    var pBes = kolomPositie(VELD.beschik);
    var pPct = kolomPositie(VELD.pct);

    for (var i = 0; i < rijen.length; i++) {
      var tr = rijen[i], id = tr.getAttribute('data-id');
      var cMax = tr.cells[pMax];
      if (!cMax || !/kg\s*$/.test(cMax.textContent.trim())) { stand.onbekend++; continue; }
      var oudTekst = origineel(cMax);
      var oud = leesGetal(oudTekst);
      var kg = data.routes && data.routes[id];

      if (!kg) {
        var reden = data.zonder && data.zonder[id];
        cMax.style.outline = '1px dashed #856404';
        cMax.style.outlineOffset = '-3px';
        cMax.title = (reden ? 'Sheet: ' + reden : 'Route niet in de sheet') + ' — waarde van DireXtion';
        if (reden) stand.zonder++; else stand.onbekend++;
        continue;
      }

      cMax.textContent = vervangGetal(oudTekst, kg);
      cMax.style.fontStyle = 'italic';
      cMax.style.outline = '';
      var zelf = data.aangevuld && data.aangevuld.indexOf(id) >= 0;
      cMax.title = 'Laadvermogen uit Fleetio (via sheet ' + nlDatum(data.datum) + ')' +
        (zelf ? '\nKolom I was leeg — opgezocht op kenteken in Fleetio Data' : '') +
        '\nDireXtion gaf: ' + oudTekst;
      stand.goed++;

      var cTot = pTot >= 0 ? tr.cells[pTot] : null;
      var tot = cTot ? leesGetal(cTot.textContent) : NaN;
      if (isNaN(tot)) continue;   // zonder totaal geen kleur en geen beschikbaar
      var kleur = kleurVoor(tot / kg);
      zetKleur(cMax, kleur);
      zetKleur(cTot, kleur);

      // Beschikbaar gewicht en -percentage: alleen overschrijven als de
      // oude waarde aantoonbaar uit dezelfde 730 kg kwam. Anders rekent
      // DireXtion iets wat we niet kennen, en blijft het staan.
      var cBes = pBes >= 0 ? tr.cells[pBes] : null;
      if (cBes) {
        var besOud = origineel(cBes), besGetal = leesGetal(besOud);
        if (Math.abs(besGetal - (oud - tot)) < 1) {
          cBes.textContent = vervangGetal(besOud, kg - tot);
          cBes.style.fontStyle = 'italic';
        }
      }
      var cPct = pPct >= 0 ? tr.cells[pPct] : null;
      if (cPct && oud > 0) {
        var pctOud = origineel(cPct), pctGetal = leesGetal(pctOud);
        if (Math.abs(pctGetal - (oud - tot) / oud * 100) < 1) {
          cPct.textContent = vervangGetal(pctOud, (kg - tot) / kg * 100);
          cPct.style.fontStyle = 'italic';
        }
      }
    }
    toonPill();
  }

  function nlDatum(iso) {
    var m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '-' + m[2] : iso;
  }

  // ── Pilletje linksonder ───────────────────────────────────────────────────
  function toonPill() {
    var p = document.getElementById(PILL_ID);
    if (!p) {
      p = document.createElement('div');
      p.id = PILL_ID;
      p.style.cssText = 'position:fixed;left:44px;bottom:8px;z-index:100000;padding:4px 8px 4px 10px;' +
        'border-radius:4px;font:11px "Segoe UI",sans-serif;color:#333;box-shadow:0 1px 4px rgba(0,0,0,.25);' +
        'display:flex;gap:8px;align-items:center;';
      document.body.appendChild(p);
    }
    var tekst, achter, rand;
    if (stand.reden) {
      tekst = 'Laadvermogen niet toegepast: ' + stand.reden;
      achter = '#fff8e1'; rand = '#ffc107';
    } else {
      tekst = 'Laadvermogen uit Fleetio: ' + stand.goed + ' van ' + stand.rijen + ' ritten' +
        (stand.zonder ? ' · ' + stand.zonder + ' zonder Fleetio-voertuig' : '') +
        (stand.onbekend ? ' · ' + stand.onbekend + ' niet in de sheet' : '');
      achter = stand.goed ? '#d4edda' : '#fff8e1';
      rand = stand.goed ? '#00B900' : '#ffc107';
    }
    if (fout && !stand.reden) tekst += ' · ⚑ ' + fout;
    p.style.background = achter;
    p.style.border = '1px solid ' + rand;
    p.innerHTML = '';
    var t = document.createElement('span');
    t.textContent = tekst;
    t.title = 'Laadvermogen v' + LAADVERMOGEN_VERSION + (data ? ' · sheet ' + data.datum + ', opgehaald ' + data.opgehaald : '');
    var ver = document.createElement('button');
    ver.textContent = '↻';
    ver.title = 'Opnieuw ophalen uit de sheet';
    var weg = document.createElement('button');
    weg.textContent = '×';
    weg.title = 'Verbergen (correcties blijven tot de volgende callback)';
    [ver, weg].forEach(function (b) {
      b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:13px;line-height:1;padding:0;color:#333;';
    });
    ver.onclick = function () { haalData(true, pasToe); };
    weg.onclick = function () { p.remove(); };
    p.appendChild(t); p.appendChild(ver); p.appendChild(weg);
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  if (!/ModulePlanning/i.test(location.pathname) || !window.TourGrid) {
    alert('Laadvermogen werkt alleen in de planningsmodule (ModulePlanningBeta), met de Rit overzicht in beeld.');
    return;
  }

  // Globaal aanspreekpunt: een nieuwe versie (opnieuw klikken na een
  // update) vervangt dit, en de handler hieronder roept altijd de nieuwste
  // aan. Daarom wordt de handler maar één keer gekoppeld.
  window.__laadvermogen = { pasToe: pasToe, versie: LAADVERMOGEN_VERSION };
  if (!window.__laadvermogenGekoppeld) {
    window.__laadvermogenGekoppeld = true;
    window.TourGrid.EndCallback.AddHandler(function () {
      setTimeout(function () { if (window.__laadvermogen) window.__laadvermogen.pasToe(); }, 0);
    });
  }

  haalData(false, pasToe);
})();
