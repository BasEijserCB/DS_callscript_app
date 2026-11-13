/* ─────────────────────────────────────────────────────────────
   SCHUIFALIAS — sturend depot achter de alias van een schuifrit
   Draait op coolblue.dirextion.nl/ModulePlanningBeta.
   Staat los van het DS Logboek; de data komt uit het Schuifritten-project
   (Alias.gs, aangeroepen als <web-app>?format=alias).

   WAT
   Elke ochtend krijgt de alias van een schuifrit de code van het sturende
   depot erachter:  2M-DETR-04  →  2M-DETR-04 (DEDU)
   Code = land + eerste twee letters van de depotnaam; Hamburg = DEHM,
   Hamm = DEHA. De codes komen uit het endpoint, niet uit dit bestand.

   WELKE RIT IS DE SCHUIFRIT
   Dezelfde regel als Rapport.gs: ontvangend depot (aliascode) + netwerk
   (aliasprefix) + Geplande starttijd = starttijd bezorgrit, op de minuut.
   Alle routes staan onder kanaal 2Mans, ook 1M/1X/BI (cross-network
   optimalisatie). De tool zet het kanaal daarom zelf op 2Mans en maakt
   netwerk en postcodes leeg; na het herladen staat het op "1M doorstep".

   NIET VANZELF AANGEPAST ALS
   - er meer ritten in het slot staan dan er gepland zijn: dan kiest de
     gebruiker met een vinkje welke het is ("Bekijk" markeert ze)
   - twee sturende depots hetzelfde slot delen
   - de alias de code al heeft
   Een oude handmatige toevoeging als "(DUS)" wordt vervangen.

   HOE
   1. Controleren: per ontvangend depot het filter zetten, op ↻ drukken,
      alle pagina's van de Rit overzicht lezen. Er wordt niets gewijzigd.
   2. Opslaan: zelfde ronde, nu per pagina de aliassen zetten via de
      batch-edit-API van TourGrid en UpdateEdit() — hetzelfde als typen in
      de cel en "Wijzigingen opslaan". Daarna teruglezen.
   3. Versturen: de gewijzigde ritten aanvinken, "Verstuur naar mobiel
      apparaat" en in het venster "Versturen" — anders ziet de Ritmonitor
      de nieuwe alias niet.
   Aan het eind staat het depotfilter weer op wat het was, of op het depot
   waar nog een keuze open staat.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SCHUIFALIAS_VERSION = '1.1.0';

  // /exec-URL van de Schuifritten web-app. Leeg = de tool meldt dat en doet niets.
  // Toegang "Iedereen binnen Coolblue": de <script>-tag stuurt de Google-login mee.
  var GAS_URL = 'https://script.google.com/a/macros/coolblue.nl/s/AKfycby2EaH5n_ANfaBdnLdXtm6doQYA5MxVWk6osVa3NsmnxOod8ZJUfqLUajz9wKJYexEFng/exec';

  var TIMEOUT_MS = 30000;
  var PANEL_ID = 'schuifalias-panel';

  // ── Hulpjes ───────────────────────────────────────────────────────────────
  function naamNorm(s) {
    return String(s || '').replace(/\(.*?\)/g, '').normalize('NFD').toLowerCase().replace(/[^a-z]/g, '');
  }
  function haakjes(s) { var m = String(s || '').match(/\(([^)]*)\)/); return m ? m[1].trim().toUpperCase() : ''; }
  function wacht(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function planDatum() {
    var el = document.getElementById('FilterDate_I');
    var m = String(el ? el.value : '').match(/(\d{2})-(\d{2})-(\d{4})/);
    return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }

  // ── Data ophalen (JSONP) ──────────────────────────────────────────────────
  function haalData() {
    return new Promise(function (resolve, reject) {
      if (!GAS_URL) return reject(new Error('GAS_URL is nog niet ingevuld in schuifalias.js'));
      var naam = '__schuifaliasCb' + Date.now();
      var s = document.createElement('script');
      var timer = setTimeout(function () { af(new Error('geen antwoord van de Schuifritten-sheet')); }, 20000);
      function af(err, d) {
        clearTimeout(timer);
        try { delete window[naam]; } catch (e) { window[naam] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
        if (err) return reject(err);
        if (!d || !d.ok) return reject(new Error((d && d.fout) || 'onbekende fout in het endpoint'));
        resolve(d);
      }
      window[naam] = function (d) { af(null, d); };
      s.onerror = function () { af(new Error('Schuifritten web-app niet bereikbaar (deployment of toegang)')); };
      s.src = GAS_URL + (GAS_URL.indexOf('?') < 0 ? '?' : '&') + 'format=alias&callback=' + naam + '&t=' + Date.now();
      document.head.appendChild(s);
    });
  }

  // ── Grid ──────────────────────────────────────────────────────────────────
  var G = function () { return window.TourGrid; };

  // Wacht op de eerstvolgende EndCallback van TourGrid na actie().
  function metCallback(actie) {
    return new Promise(function (resolve, reject) {
      var klaar = false;
      var timer = setTimeout(function () { if (!klaar) { klaar = true; reject(new Error('Rit overzicht laadt niet (time-out)')); } }, TIMEOUT_MS);
      window.__schuifaliasWacht = function () {
        if (klaar) return;
        klaar = true; clearTimeout(timer); window.__schuifaliasWacht = null;
        rustig().then(resolve);
      };
      try { actie(); } catch (e) { klaar = true; clearTimeout(timer); reject(e); }
    });
  }

  // DireXtion hangt zelf aan EndCallback: 100 ms later slaat het de kolomstand op en kan
  // het TourGrid.Refresh() doen. Komt die refresh op een niet-opgeslagen alias, dan vraagt
  // DevExpress "Alle niet-opgeslagen rastergegevens zullen verloren gaan". Dus: pas verder
  // als de grid 400 ms geen callback meer heeft gehad.
  function rustig() {
    var pogingen = 0;
    function kijk() {
      var n0 = window.__schuifaliasCbN || 0;
      return wacht(400).then(function () {
        var bezigGrid = false;
        try { bezigGrid = G().InCallback(); } catch (e) {}
        if ((window.__schuifaliasCbN || 0) === n0 && !bezigGrid) return;
        if (++pogingen >= 15) return;   // ~6 s: dan maar door, de teruglezing vangt het op
        return kijk();
      });
    }
    return kijk();
  }

  function kolom(veld) {
    try {
      var k = G().GetColumnByField(veld);
      var kop = k && document.getElementById('TourGrid_col' + k.index);
      return kop ? kop.cellIndex : -1;
    } catch (e) { return -1; }
  }

  // Leest de rijen die nu in beeld staan.
  function leesPagina() {
    var pA = kolom('Alias'), pS = kolom('PlanStartDrivingTime');
    if (pA < 0) throw new Error('kolom Alias staat niet in beeld');
    if (pS < 0) throw new Error('kolom Geplande starttijd staat niet in beeld');
    var uit = [];
    var rijen = document.querySelectorAll('#TourGrid_DXMainTable tr.dxgvDataRow[data-id]');
    for (var i = 0; i < rijen.length; i++) {
      var tr = rijen[i];
      var vi = Number((tr.id.match(/DXDataRow(\d+)$/) || [])[1]);
      var alias = (tr.cells[pA] ? tr.cells[pA].textContent : '').trim();
      var start = (tr.cells[pS] ? tr.cells[pS].textContent : '').trim().slice(0, 5);
      uit.push({ id: tr.getAttribute('data-id'), vi: vi, alias: alias, naam: tr.getAttribute('data-tourname') || '', start: start });
    }
    return uit;
  }

  // Loopt alle pagina's af; fn(rijen) mag een Promise geven.
  function perPagina(fn) {
    var n = 1;
    try { n = G().GetPageCount() || 1; } catch (e) {}
    var p = 0;
    function volgende() {
      if (p >= n) return Promise.resolve();
      var huidig = 0;
      try { huidig = G().GetPageIndex(); } catch (e) {}
      var stap = huidig === p ? Promise.resolve() : metCallback(function () { G().GotoPage(p); });
      // De grid scrollt eindeloos: na GotoPage staan de rijen van eerdere pagina's er nog.
      // Elke rit maar één keer doorgeven, anders telt een slot dubbel.
      return stap.then(function () {
        var nieuw = leesPagina().filter(function (r) { if (gezien[r.id]) return false; gezien[r.id] = 1; return true; });
        return fn(nieuw);
      }).then(function () { p++; return volgende(); });
    }
    var gezien = {};
    return volgende();
  }

  // ── Depotfilter ───────────────────────────────────────────────────────────
  function depotItem(naam, land) {
    var cb = window.FilterDepot, doel = naamNorm(naam), gevonden = null;
    for (var i = 0; i < cb.GetItemCount(); i++) {
      var it = cb.GetItem(i);
      if (naamNorm(it.text) !== doel) continue;
      var h = haakjes(it.text);           // "Venlo (NL)" / "Venlo (DE)"
      if (h && land && h !== land) continue;
      gevonden = it; break;
    }
    return gevonden;
  }

  // Na het herladen staat het filter op "1M doorstep". Alle routes zijn gepland onder 2Mans (16),
  // ook 1M/1X/BI (cross-network optimalisatie). Netwerk en postcodes leeg: die versmallen alleen.
  var KANAAL_2MANS = '16';
  function zetFilters() {
    var ch = window.FilterChannel;
    if (ch && String(ch.GetValue()) !== KANAAL_2MANS) {
      ch.SetValue(KANAAL_2MANS);
      if (String(ch.GetValue()) !== KANAAL_2MANS) throw new Error('kanaal 2Mans (16) niet te kiezen in het filter');
    }
    var nw = window.FilterNetworks;
    try {
      if (nw && nw.GetSelectedItems().length) {
        if (nw.UnselectAll) nw.UnselectAll();
        else if (nw.SetValue) nw.SetValue(null);
      }
    } catch (e) {}
    try { if (nw && nw.GetSelectedItems().length) throw 0; } catch (e) {
      throw new Error('het netwerkfilter staat aan — maak het leeg en start opnieuw');
    }
    ['ZipcodeRangeStart', 'ZipcodeRangeEnd'].forEach(function (k) {
      try { if (window[k] && window[k].GetText()) window[k].SetText(''); } catch (e) {}
    });
  }

  // Ook als het filter er al op staat wordt er ververst: dan lezen we verse aliassen.
  function naarDepot(item) {
    return metCallback(function () {
      zetFilters();
      window.FilterDepot.SetValue(item.value);
      document.getElementById('quick-refresh').click();
    }).then(function () {
      var t = (document.getElementById('filter-depot') || {}).textContent || '';
      if (naamNorm(t) !== naamNorm(item.text)) throw new Error('depotfilter staat op "' + t + '" in plaats van "' + item.text + '"');
      try { if (G().GetPageIndex() !== 0) return metCallback(function () { G().GotoPage(0); }); } catch (e) {}
    });
  }

  // Na een depotwissel kan de grid nog even de vorige (of een lege) lijst tonen.
  // Wacht tot er een rit met de aliascode van dit depot in beeld is, max. 5 s.
  function wachtOpDepot(code) {
    var tot = Date.now() + 5000;
    function kijk() {
      var ok = false;
      try { ok = leesPagina().some(function (r) { return r.alias.indexOf('-' + code + '-') > 0; }); } catch (e) {}
      if (ok || Date.now() > tot) return Promise.resolve();
      return wacht(300).then(kijk);
    }
    return kijk();
  }

  // Wat de tool zag, voor als er niets gevonden wordt.
  function diagnose(rijen) {
    var n = '?', pi = '?';
    try { n = G().GetPageCount(); pi = G().GetPageIndex(); } catch (e) {}
    var dom = document.querySelectorAll('#TourGrid_DXMainTable tr.dxgvDataRow').length;
    return 'diagnose: ' + rijen.length + ' ritten gelezen (' + dom + ' rijen in beeld, pagina ' + pi + ' van ' + n +
      ', filter "' + ((document.getElementById('filter-depot') || {}).textContent || '') + '", kolommen alias ' +
      kolom('Alias') + ' / start ' + kolom('PlanStartDrivingTime') + '). Eerste: ' +
      (rijen.slice(0, 3).map(function (r) { return r.alias + ' ' + r.start; }).join(', ') || '—');
  }

  // ── Plan maken ────────────────────────────────────────────────────────────
  // Groepeert de ritten per ontvangend depot en per slot (netwerk + start).
  function groepeer(ritten) {
    var depots = {};
    ritten.forEach(function (r) {
      var d = depots[r.naarCode] || (depots[r.naarCode] = { naar: r.naar, code: r.naarCode, land: r.land, slots: {} });
      var k = r.netwerk + '|' + r.start;
      var s = d.slots[k] || (d.slots[k] = { netwerk: r.netwerk, start: r.start, aantal: 0, van: [] });
      s.aantal += r.aantal;
      if (s.van.indexOf(r.vanCode) < 0) s.van.push(r.vanCode);
    });
    return Object.keys(depots).sort().map(function (k) { return depots[k]; });
  }

  function nieuweAlias(alias, code) {
    var kaal = alias.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return kaal + ' (' + code + ')';
  }

  // Bepaalt per gevonden rij wat er moet gebeuren. rijen = alle rijen van het depot.
  function beoordeel(depot, rijen) {
    var uit = { wijzig: [], meldingen: [] };
    var eigen = rijen.filter(function (r) { return r.alias.indexOf('-' + depot.code + '-') > 0; });
    if (!eigen.length) uit.meldingen.push('geen enkele rit met ' + depot.code + ' in de alias — verkeerd depot of nog niet gepland?');
    Object.keys(depot.slots).forEach(function (k) {
      var s = depot.slots[k];
      var label = s.netwerk + ' ' + s.start + ' (' + s.aantal + '× van ' + s.van.join(' + ') + ')';
      var hits = eigen.filter(function (r) { return r.start === s.start && r.alias.split('-')[0].toUpperCase() === s.netwerk.toUpperCase(); });
      if (s.van.length > 1) { uit.meldingen.push(label + ': meerdere sturende depots in één slot — niet aangepast'); return; }
      if (!hits.length) { uit.meldingen.push(label + ': geen rit gevonden met deze starttijd'); return; }
      // Al genoeg ritten in dit slot met de juiste code (eerder gekozen)? Dan is er niets te twijfelen.
      var alGedaan = hits.filter(function (h) { return nieuweAlias(h.alias, s.van[0]) === h.alias; });
      if (hits.length > s.aantal && alGedaan.length >= s.aantal) {
        alGedaan.forEach(function (h) { uit.wijzig.push({ id: h.id, oud: h.alias, nieuw: h.alias, klaar: true }); });
        return;
      }
      if (hits.length > s.aantal) {
        // Welke het is, beslist de gebruiker: kandidaten met een vinkje, standaard uit.
        uit.meldingen.push(label + ': ' + hits.length + ' ritten in dit slot, ' + s.aantal + ' gepland — vink aan welke ' +
          (s.aantal === 1 ? 'de schuifrit is' : 'de schuifritten zijn') + '. "Bekijk" zet ze in de Rit overzicht.');
        hits.forEach(function (h) {
          var nieuw = nieuweAlias(h.alias, s.van[0]);
          uit.wijzig.push({ id: h.id, oud: h.alias, nieuw: nieuw, klaar: nieuw === h.alias, twijfel: true, aan: false });
        });
        return;
      }
      if (hits.length < s.aantal) uit.meldingen.push(label + ': ' + hits.length + ' van ' + s.aantal + ' gevonden');
      hits.forEach(function (h) {
        var nieuw = nieuweAlias(h.alias, s.van[0]);
        uit.wijzig.push({ id: h.id, oud: h.alias, nieuw: nieuw, klaar: nieuw === h.alias });
      });
    });
    return uit;
  }

  // ── Rondes ────────────────────────────────────────────────────────────────
  var data = null, plan = [], bezig = false, origDepot = null, bekeken = '';

  function controleer() {
    if (bezig) return;
    bezig = true;
    plan = [];
    toon('Gegevens ophalen uit de Schuifritten-sheet…');
    var dag = planDatum();
    haalData().then(function (d) {
      data = d;
      if (dag && dag !== d.datum) throw new Error('planning staat op ' + dag + ', de sheet geeft ritten van ' + d.datum);
      var depots = groepeer(d.ritten);
      if (!depots.length) return;   // toonPlan() meldt "Geen schuifritten vandaag"
      var i = 0;
      function volgende() {
        if (i >= depots.length) return Promise.resolve();
        var dep = depots[i++];
        var item = depotItem(dep.naar, dep.land);
        if (!item) { plan.push({ depot: dep, meldingen: ['depot "' + dep.naar + '" niet gevonden in het depotfilter'], wijzig: [] }); return volgende(); }
        toon('Controleren: ' + dep.naar + ' (' + i + '/' + depots.length + ')…');
        var rijen = [];
        return naarDepot(item)
          .then(function () { return wachtOpDepot(dep.code); })
          .then(function () { return perPagina(function (r) { rijen = rijen.concat(r); }); })
          .then(function () {
            var b = beoordeel(dep, rijen);
            if (!rijen.some(function (r) { return r.alias.indexOf('-' + dep.code + '-') > 0; })) b.meldingen.push(diagnose(rijen));
            plan.push({ depot: dep, item: item, wijzig: b.wijzig, meldingen: b.meldingen });
          })
          .catch(function (e) { plan.push({ depot: dep, wijzig: [], meldingen: ['fout: ' + e.message] }); })
          .then(volgende);
      }
      return volgende();
    }).then(function () {
      return terug();
    }).then(function () { bezig = false; toonPlan(); }, function (e) {
      bezig = false; console.error('[Schuifalias]', e); toon('⚑ ' + e.message, true);
    });
  }

  // Wat bij "opslaan" meegaat: alles wat zeker is, plus aangevinkte twijfelgevallen.
  function teOpslaan(w) { return !w.klaar && (!w.twijfel || w.aan); }
  function openTwijfel(w) { return w.twijfel && !w.klaar && !w.aan; }

  function opslaan() {
    if (bezig) return;
    var werk = plan.filter(function (p) { return p.item && p.wijzig.some(teOpslaan); });
    if (!werk.length) return;
    bezig = true;
    var i = 0;
    function volgende() {
      if (i >= werk.length) return Promise.resolve();
      var p = werk[i++];
      var teDoen = {};
      p.wijzig.forEach(function (w) { if (teOpslaan(w)) { delete w.fout; teDoen[w.id] = w; } });
      toon('Opslaan: ' + p.depot.naar + ' (' + i + '/' + werk.length + ')…');
      return naarDepot(p.item).then(function () {
        return perPagina(function (rijen) {
          var hier = rijen.filter(function (r) { return teDoen[r.id]; });
          if (!hier.length) return;
          hier.forEach(function (r) {
            // Alleen als de alias nog is wat we bij het controleren zagen.
            if (r.alias !== teDoen[r.id].oud) { teDoen[r.id].fout = 'alias intussen gewijzigd naar "' + r.alias + '"'; return; }
            G().batchEditApi.SetCellValue(r.vi, 'Alias', teDoen[r.id].nieuw);
          });
          if (!G().batchEditApi.HasChanges()) return;
          return metCallback(function () { G().UpdateEdit(); });
        });
      }).then(function () {
        // Teruglezen: staat het er echt?
        var gezien = {};
        return perPagina(function (rijen) { rijen.forEach(function (r) { gezien[r.id] = r.alias; }); }).then(function () {
          Object.keys(teDoen).forEach(function (id) {
            var w = teDoen[id];
            if (w.fout) return;
            if (gezien[id] === w.nieuw) w.klaar = true; else w.fout = 'na opslaan staat er "' + (gezien[id] || '?') + '"';
          });
        });
      }).then(function () {
        // Opnieuw naar het mobiele apparaat, anders ziet de Ritmonitor de nieuwe alias niet.
        var ids = Object.keys(teDoen).filter(function (id) { return teDoen[id].klaar; });
        if (ids.length) return verstuur(p, ids);
      }).catch(function (e) {
        p.meldingen.push('fout bij opslaan: ' + e.message);
        try { if (G().batchEditApi.HasChanges()) G().CancelEdit(); } catch (x) {}
      }).then(volgende);
    }
    // Staat er nog iets open om te kiezen? Dan daarheen, met de kandidaten gemarkeerd.
    // Anders terug naar het depot waar de gebruiker begon.
    volgende().then(function () {
      var open = plan.filter(function (p) { return p.item && p.wijzig.some(openTwijfel); })[0];
      return open ? bekijkStap(open) : terug();
    }).then(function () { bezig = false; toonPlan(); }, function (e) {
      bezig = false; console.error('[Schuifalias]', e); toon('⚑ ' + e.message, true);
    });
  }

  // Vinkt precies deze ritten aan in de Rit overzicht en drukt op "Verstuur naar mobiel apparaat".
  // Die knop pakt TourGrid.GetSelectedKeysOnPage() en opent een DireXtion-venster (Tour/SendToMobile).
  // In dat venster klikt verstuurKlik() op "Versturen"; lukt dat niet, dan rondt de gebruiker het af (handmatig()).
  var verderNa = null;
  function verstuur(p, ids) {
    var g = G();
    try { if (g.GetSelectedRowCount && g.GetSelectedRowCount() > 0) g.UnselectRows(); } catch (e) {}
    // Zoals de gebruiker het doet: klik op de vinkjescel van precies die rij.
    var diag = [];
    ids.forEach(function (id) {
      var tr = document.querySelector('#TourGrid_DXMainTable tr.dxgvDataRow[data-id="' + id + '"]');
      var cel = tr && tr.querySelector('td.dxgvCommandColumn');
      diag.push(id + ':' + (tr ? tr.id.replace('TourGrid_', '') : 'geen rij') + (cel ? '' : '/geen vinkje'));
      if (cel) cel.click();
    });
    return wacht(300).then(function () {
      var gekozen = [], dom = [];
      try { gekozen = (g.GetSelectedKeysOnPage() || []).map(String); } catch (e) { diag.push('GetSelectedKeysOnPage: ' + e.message); }
      var sel = document.querySelectorAll('#TourGrid_DXMainTable tr.dxgvSelectedRow[data-id]');
      for (var i = 0; i < sel.length; i++) dom.push(sel[i].getAttribute('data-id'));
      var mist = ids.filter(function (id) { return gekozen.indexOf(String(id)) < 0; });
      var extra = gekozen.filter(function (id) { return ids.indexOf(id) < 0; });
      if (mist.length || extra.length) {
        var tekst = 'gezocht ' + ids.join(',') + ' · rij ' + diag.join(' ') + ' · grid zegt [' + gekozen.join(',') +
          '] · in beeld aangevinkt [' + dom.join(',') + ']';
        console.warn('[Schuifalias] aanvinken klopt niet:', tekst);
        try { g.UnselectRows(); } catch (e) {}
        p.meldingen.push('niet verstuurd naar mobiel apparaat: aanvinken klopt niet — doe het met de hand. (' + tekst + ')');
        return;
      }
      return verstuurKlik(p, ids);
    });
  }

  // De knop "Versturen" in het DireXtion-venster ("Rit zal worden verstuurd naar externe API").
  // Het venster wordt asynchroon geladen (popup.showPopupUrl → Tour/SendToMobile).
  function versturenKnop() {
    var kand = document.querySelectorAll('.dxbButton, input[type=button], input[type=submit], button, a');
    for (var i = 0; i < kand.length; i++) {
      var el = kand[i];
      if (el.closest('#' + PANEL_ID)) continue;
      var t = (el.value || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t !== 'Versturen') continue;
      if (!el.offsetParent) continue;                      // niet zichtbaar
      // Bij een DevExpress-knop de buitenste .dxbButton klikken.
      var dx = el.closest('.dxbButton');
      return dx || el;
    }
    return null;
  }

  function wachtOp(fn, ms) {
    var tot = Date.now() + ms;
    function kijk() {
      var r = fn();
      if (r || Date.now() > tot) return Promise.resolve(r);
      return wacht(200).then(kijk);
    }
    return kijk();
  }

  function verstuurKlik(p, ids) {
    var knopEl = document.getElementById('SendToMobile');
    if (!knopEl) { p.meldingen.push('knop "Verstuur naar mobiel apparaat" niet gevonden — doe het met de hand'); return Promise.resolve(); }
    knopEl.click();
    var namen = p.wijzig.filter(function (w) { return ids.indexOf(w.id) >= 0; }).map(function (w) { return w.nieuw; });
    return wachtOp(versturenKnop, 10000).then(function (btn) {
      if (!btn) return handmatig(p, namen);
      btn.click();
      // Klaar = de knop is weg (venster dicht). Blijft hij staan, dan meldt de tool de tekst van het venster.
      return wachtOp(function () { return !versturenKnop(); }, 15000).then(function (dicht) {
        try { G().UnselectRows(); } catch (e) {}
        if (dicht) { p.meldingen.push('verstuurd naar mobiel apparaat: ' + namen.join(', ')); return; }
        var b = versturenKnop();
        var venster = b && (b.closest('.dxpc-mainDiv') || b.closest('.dxpc-content') || b.parentNode);
        var tekst = venster ? venster.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
        p.meldingen.push('versturen naar mobiel apparaat niet bevestigd — controleer het venster' + (tekst ? ' ("' + tekst + '")' : ''));
      });
    });
  }

  // Vangnet: "Versturen" niet gevonden. Dan rondt de gebruiker het venster zelf af.
  function handmatig(p, namen) {
    return new Promise(function (resolve) {
      verderNa = function (gedaan) {
        verderNa = null;
        p.meldingen.push(gedaan ? 'verstuurd naar mobiel apparaat: ' + namen.join(', ') : 'versturen naar mobiel apparaat overgeslagen: ' + namen.join(', '));
        try { G().UnselectRows(); } catch (e) {}
        resolve();
      };
      var pnl = paneel();
      pnl.innerHTML = kop() + '<div style="padding:12px;">' +
        '<div style="font-weight:600;margin-bottom:6px;">' + esc(p.depot.naar) + ': versturen naar mobiel apparaat</div>' +
        '<div style="font-size:12px;margin-bottom:8px;">Aangevinkt en "Verstuur naar mobiel apparaat" geopend voor:<br>' +
        namen.map(esc).join('<br>') + '</div>' +
        '<div style="font-size:12px;color:#856404;background:#fff8e1;border-left:3px solid #ffc107;padding:4px 6px;margin-bottom:10px;">' +
        'Knop "Versturen" niet gevonden. Rond het DireXtion-venster zelf af en klik dan op Verder.</div>' +
        '<button data-a="verder" style="' + knop(true) + '">Verder</button> ' +
        '<button data-a="overslaan" style="' + knop(false) + '">Overslaan</button></div>';
      koppel(pnl);
    });
  }

  // Zet de Rit overzicht op dit depot en markeert de twijfelgevallen (of anders de te wijzigen ritten).
  function bekijkStap(p) {
    var ids = p.wijzig.filter(function (w) { return w.twijfel && !w.klaar; }).map(function (w) { return w.id; });
    if (!ids.length) ids = p.wijzig.map(function (w) { return w.id; });
    window.__schuifaliasMarkeer = ids;
    bekeken = p.depot.code;
    return naarDepot(p.item).then(function () {
      // Naar de pagina met de eerste kandidaat.
      var n = 1;
      try { n = G().GetPageCount() || 1; } catch (e) {}
      var p0 = 0;
      function zoek() {
        markeer();
        if (document.querySelector('#TourGrid_DXMainTable tr[data-id="' + ids[0] + '"]') || p0 >= n - 1) return Promise.resolve();
        p0++;
        return metCallback(function () { G().GotoPage(p0); }).then(zoek);
      }
      return zoek();
    });
  }

  function bekijk(code) {
    if (bezig) return;
    var p = plan.filter(function (x) { return x.depot.code === code; })[0];
    if (!p || !p.item) return;
    bezig = true;
    toon('Rit overzicht naar ' + p.depot.naar + '…');
    bekijkStap(p).then(function () { bezig = false; toonPlan(); }, function (e) {
      bezig = false; toon('⚑ ' + e.message, true);
    });
  }

  function markeer() {
    var ids = window.__schuifaliasMarkeer || [];
    var rijen = document.querySelectorAll('#TourGrid_DXMainTable tr.dxgvDataRow[data-id]');
    for (var i = 0; i < rijen.length; i++) {
      var aan = ids.indexOf(rijen[i].getAttribute('data-id')) >= 0;
      rijen[i].style.outline = aan ? '2px solid #ffc107' : '';
      rijen[i].style.outlineOffset = aan ? '-2px' : '';
    }
  }

  function terug() {
    window.__schuifaliasMarkeer = null;
    bekeken = '';
    markeer();
    if (!origDepot) return Promise.resolve();
    if (String(window.FilterDepot.GetValue()) === String(origDepot.value)) return Promise.resolve();
    return naarDepot(origDepot).catch(function () {});
  }

  // ── Paneel ────────────────────────────────────────────────────────────────
  function paneel() {
    var p = document.getElementById(PANEL_ID);
    if (p) return p;
    p = document.createElement('div');
    p.id = PANEL_ID;
    p.style.cssText = 'position:fixed;right:16px;top:70px;z-index:100000;width:380px;max-height:70vh;overflow:auto;' +
      'background:#fff;border:1px solid #cce9f9;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.25);' +
      'font:13px "Segoe UI",sans-serif;color:#333;';
    document.body.appendChild(p);
    return p;
  }

  function kop() {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #DDDDDD;">' +
      '<b style="color:#285dab;font-size:14px;">Schuifritten → alias</b>' +
      '<span><span style="color:#999999;font-size:11px;margin-right:8px;">v' + SCHUIFALIAS_VERSION + '</span>' +
      '<button data-a="sluit" style="background:none;border:none;font-size:16px;cursor:pointer;color:#333;">×</button></span></div>';
  }

  function toon(tekst, fout) {
    var p = paneel();
    p.innerHTML = kop() + '<div style="padding:12px;' + (fout ? 'color:#E50000;' : '') + '">' + esc(tekst) + '</div>' +
      (fout ? '<div style="padding:0 12px 12px;"><button data-a="controleer" style="' + knop(false) + '">Opnieuw</button></div>' : '');
    koppel(p);
  }

  function knop(primair) {
    return 'padding:6px 12px;border-radius:8px;cursor:pointer;font:13px "Segoe UI",sans-serif;' +
      (primair ? 'background:#0090e3;color:#fff;border:1px solid #0090e3;' : 'background:#F2F7FC;color:#285dab;border:1px solid #cce9f9;');
  }

  // Statusregel: zijn de aantallen al gecontroleerd met het rittenrapport (Rapport.gs)?
  // Het endpoint geeft de corrigeerde aantallen; dit zegt of die correctie vandaag gedraaid heeft.
  function controleRegel() {
    var c = data && data.controle;
    if (!c) return '';
    var blok = function (kleur, vlak, rand, tekst) {
      return '<div style="margin:0 12px 8px;padding:6px 8px;font-size:12px;color:' + kleur + ';background:' + vlak +
        ';border-left:3px solid ' + rand + ';border-radius:0 6px 6px 0;">' + tekst + '</div>';
    };
    if (c.status === 'gedaan') {
      var delen = [];
      if (c.gebruikt) delen.push(c.gebruikt + ' gebruikt');
      if (c.verlaagd) delen.push(c.verlaagd + ' verlaagd');
      if (c.onduidelijk) delen.push(c.onduidelijk + ' onduidelijk');
      return blok('#155724', '#d4edda', '#00B900', '✓ Aantallen gecontroleerd met het rittenrapport' +
        (c.tijd ? ' om ' + esc(c.tijd) : '') + (c.ritten ? ' — ' + c.ritten + ' ritten' + (delen.length ? ': ' + delen.join(', ') : '') : '') + '.');
    }
    if (c.status === 'mislukt') return blok('#856404', '#fff8e1', '#ffc107',
      '⚠ De rittenrapport-controle is vandaag gestopt zonder aanpassingen. De aantallen zijn zoals gepland, niet gecontroleerd.');
    if (c.status === 'nog niet') return blok('#856404', '#fff8e1', '#ffc107',
      '⚠ De rittenrapport-controle heeft vandaag nog niet gedraaid. De aantallen zijn nog niet gecontroleerd.');
    return blok('#856404', '#fff8e1', '#ffc107', 'Stand van de rittenrapport-controle onbekend' + (c.fout ? ' (' + esc(c.fout) + ')' : '') + '.');
  }

  function toonPlan() {
    var p = paneel(), h = kop(), open = 0;
    h += '<div style="padding:8px 12px;font-size:11px;color:#999999;">Sheet ' + esc(data ? data.datum + ', opgehaald ' + data.opgehaald : '') + '</div>';
    h += controleRegel();
    if (!plan.length) h += '<div style="padding:4px 12px 10px;">Geen schuifritten vandaag.</div>';
    plan.forEach(function (d, di) {
      var hier = bekeken === d.depot.code;
      h += '<div style="padding:6px 12px;border-top:1px solid #F3F3F3;' + (hier ? 'background:#F2F7FC;' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:600;">' + esc(d.depot.naar) +
        ' <span style="color:#999999;font-weight:400;">' + esc(d.depot.code) + '</span></span>' +
        '<span>' +
        (d.item ? (hier ? '<span style="font-size:11px;color:#285dab;">in beeld</span>'
          : '<button data-a="bekijk" data-d="' + esc(d.depot.code) + '" style="' + knop(false) + 'padding:2px 8px;font-size:11px;">Bekijk</button>') : '') +
        '</span></div>';
      d.wijzig.forEach(function (w, wi) {
        var kleur = w.fout ? '#E50000' : w.klaar ? '#155724' : '#333333';
        if (teOpslaan(w)) open++;
        var tekst = esc(w.klaar && w.oud === w.nieuw ? w.nieuw + ' (stond er al)' : w.oud + '  →  ' + w.nieuw);
        var fout = w.fout ? '<br><span style="font-size:11px;">' + esc(w.fout) + '</span>' : '';
        if (w.twijfel && !w.klaar) {
          h += '<label style="display:block;font-size:12px;color:' + kleur + ';cursor:pointer;margin:2px 0;">' +
            '<input type="checkbox" data-a="kies" data-p="' + di + '" data-w="' + wi + '"' + (w.aan ? ' checked' : '') +
            ' style="margin:0 6px 0 0;vertical-align:-2px;">' + tekst + fout + '</label>';
        } else {
          h += '<div style="font-size:12px;color:' + kleur + ';">' + (w.klaar ? '✓ ' : w.fout ? '⚑ ' : '→ ') + tekst + fout + '</div>';
        }
      });
      d.meldingen.forEach(function (m) {
        h += '<div style="font-size:11px;color:#856404;background:#fff8e1;border-left:3px solid #ffc107;padding:3px 6px;margin-top:3px;">' + esc(m) + '</div>';
      });
      h += '</div>';
    });
    h += '<div style="padding:10px 12px;border-top:1px solid #DDDDDD;display:flex;gap:8px;">' +
      (open ? '<button data-a="opslaan" style="' + knop(true) + '">' + open + ' alias' + (open === 1 ? '' : 'sen') + ' opslaan</button>'
        : plan.some(function (d) { return d.wijzig.some(openTwijfel); })
          ? '<span style="color:#856404;align-self:center;font-size:12px;">Vink aan welke rit het is.</span>'
          : '<span style="color:#155724;align-self:center;">Niets meer te doen.</span>') +
      '<button data-a="controleer" style="' + knop(false) + '">Opnieuw controleren</button></div>';
    p.innerHTML = h;
    koppel(p);
  }

  function koppel(p) {
    p.onclick = function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'sluit' && !bezig) { window.__schuifaliasMarkeer = null; markeer(); p.remove(); }
      if (a === 'bekijk') bekijk(e.target.getAttribute('data-d'));
      if ((a === 'verder' || a === 'overslaan') && verderNa) verderNa(a === 'verder');
      if (a === 'kies' && !bezig) {
        var w = plan[+e.target.getAttribute('data-p')].wijzig[+e.target.getAttribute('data-w')];
        w.aan = e.target.checked;
        toonPlan();
      }
      if (a === 'controleer') controleer();
      if (a === 'opslaan') opslaan();
    };
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  if (!/ModulePlanning/i.test(location.pathname) || !window.TourGrid || !window.FilterDepot || !document.getElementById('quick-refresh')) {
    alert('Schuifalias werkt alleen in de planningsmodule (ModulePlanningBeta), met de Rit overzicht in beeld.');
    return;
  }
  try {
    if (window.TourGrid.batchEditApi.HasChanges()) {
      alert('Er staan nog niet-opgeslagen wijzigingen in de Rit overzicht. Sla die eerst op of annuleer ze.');
      return;
    }
  } catch (e) {}

  // Eén handler, die altijd de nieuwste versie aanroept (opnieuw klikken vervangt window.__schuifalias).
  // De markering moet na elke callback terug: de server rendert de rijen opnieuw.
  window.__schuifalias = { markeer: markeer, versie: SCHUIFALIAS_VERSION };
  // v2 van de handler: telt ook de callbacks (voor rustig()). Een handler van een oudere
  // versie op dezelfde pagina telt niet; daarom een nieuwe vlag.
  if (!window.__schuifaliasGekoppeld2) {
    window.__schuifaliasGekoppeld2 = true;
    window.__schuifaliasGekoppeld = true;
    window.TourGrid.EndCallback.AddHandler(function () {
      window.__schuifaliasCbN = (window.__schuifaliasCbN || 0) + 1;
      if (window.__schuifaliasWacht) window.__schuifaliasWacht();
      setTimeout(function () { if (window.__schuifalias) window.__schuifalias.markeer(); }, 0);
    });
  }
  try {
    var v = window.FilterDepot.GetValue();
    for (var i = 0; i < window.FilterDepot.GetItemCount(); i++) {
      var it = window.FilterDepot.GetItem(i);
      if (String(it.value) === String(v)) { origDepot = it; break; }
    }
  } catch (e) {}

  controleer();
})();
