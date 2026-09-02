/* ─────────────────────────────────────────────────────────────
   PROBE — Ritmonitor (DireXtion tour monitor)
   Alleen lezen. Verandert niets aan de pagina.

   GEBRUIK
   1. Open de Ritmonitor, selecteer een rit zodat de stoplijst gevuld is.
   2. Open DevTools (F12) → tabblad Console.
   3. Plak dit hele bestand en druk Enter.
   4. Klik daarna een paar keer rond (andere rit, een stop aanklikken)
      en typ opnieuw:   __probe()
      Zo zien we ook welke netwerkcalls het klikken veroorzaakt.
   5. Resultaat kopiëren:   copy(__probeResult)
      en hier terugplakken.
   ───────────────────────────────────────────────────────────── */
(function () {
  var NET = [];
  var MAX_SAMPLES = 6;

  // ── 1. Netwerkverkeer opnemen (fetch + XHR) ──────────────────
  if (!window.__probeNetPatched) {
    window.__probeNetPatched = true;
    var of = window.fetch;
    if (of) {
      window.fetch = function (input) {
        try { NET.push({ via: 'fetch', url: String(input && input.url ? input.url : input) }); } catch (e) {}
        return of.apply(this, arguments);
      };
    }
    var oo = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      try { NET.push({ via: 'xhr', method: method, url: String(url) }); } catch (e) {}
      return oo.apply(this, arguments);
    };
    window.__probeNet = NET;
  } else {
    NET = window.__probeNet;
  }

  // ── helpers ──────────────────────────────────────────────────
  function pad(el, levels) {
    var parts = [], n = el, i = 0;
    while (n && n.nodeType === 1 && i < levels) {
      var s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      if (n.className && typeof n.className === 'string') {
        var c = n.className.trim().split(/\s+/).slice(0, 3).join('.');
        if (c) s += '.' + c;
      }
      parts.unshift(s);
      n = n.parentElement; i++;
    }
    return parts.join(' > ');
  }
  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  // Diepste elementen die de regex matchen (geen kind dat ook matcht)
  function deepest(re, limit) {
    var all = document.querySelectorAll('*'), out = [];
    for (var i = 0; i < all.length && out.length < limit; i++) {
      var el = all[i], t = txt(el);
      if (!t || t.length > 300 || !re.test(t)) continue;
      var childMatch = false;
      for (var j = 0; j < el.children.length; j++) {
        if (re.test(txt(el.children[j]))) { childMatch = true; break; }
      }
      if (!childMatch) out.push(el);
    }
    return out;
  }
  function rowOf(el) {
    return el.closest('tr, li, [role="row"], .dx-row, [class*="row"]') || el.parentElement;
  }

  // ── 2. Welke frameworks draaien er ───────────────────────────
  function globals() {
    return {
      knockout: typeof window.ko !== 'undefined',
      jquery: typeof window.jQuery !== 'undefined',
      devextreme: typeof window.DevExpress !== 'undefined',
      devexpress_aspx: typeof window.ASPx !== 'undefined',
      leaflet: typeof window.L !== 'undefined',
      angular: typeof window.angular !== 'undefined' || !!document.querySelector('[ng-version]'),
      react: !!document.querySelector('#root, [data-reactroot]')
    };
  }

  // ── 3. Ritaliassen (1X-NLRO-03 etc) — de linkerlijst ─────────
  function aliases() {
    var re = /\b(1X|1M|2M|BI|BK)-[A-Z]{4}-\d{1,2}\b/;
    return deepest(re, MAX_SAMPLES).map(function (el) {
      var row = rowOf(el);
      return { tekst: txt(el).slice(0, 120), pad: pad(el, 4), rijTekst: txt(row).slice(0, 200), rijPad: pad(row, 3) };
    });
  }

  // ── 4. Adressen (NL/BE/DE postcode) — de stoplijst ───────────
  function adressen() {
    var re = /\b\d{4}\s?[A-Z]{2}\b/;
    return deepest(re, MAX_SAMPLES).map(function (el) {
      var row = rowOf(el);
      var cells = row ? Array.prototype.slice.call(row.children).map(function (c) { return txt(c).slice(0, 60); }) : [];
      return { adres: txt(el).slice(0, 120), pad: pad(el, 4), rijPad: pad(row, 3), rijCellen: cells, rijTekst: txt(row).slice(0, 250) };
    });
  }

  // ── 5. Tijden (hh:mm) ────────────────────────────────────────
  function tijden() {
    var re = /^\d{1,2}:\d{2}$/;
    var all = document.querySelectorAll('td, div, span'), out = [];
    for (var i = 0; i < all.length && out.length < MAX_SAMPLES; i++) {
      var t = txt(all[i]);
      if (re.test(t) && all[i].children.length === 0) out.push({ tijd: t, pad: pad(all[i], 4) });
    }
    return out;
  }

  // ── 6. Leaflet — zitten er coördinaten in de kaart? ──────────
  function leaflet() {
    if (typeof window.L === 'undefined') return { aanwezig: false };
    var res = { aanwezig: true, containers: document.querySelectorAll('.leaflet-container').length,
                markersInDom: document.querySelectorAll('.leaflet-marker-icon').length, mapGevonden: false, coords: [] };
    // Zoek een Leaflet Map instance ergens op window
    for (var k in window) {
      try {
        var v = window[k];
        if (v && typeof v === 'object' && v._container && v._layers && typeof v.getCenter === 'function') {
          res.mapGevonden = true; res.mapVariabele = k;
          res.center = v.getCenter(); res.zoom = v.getZoom();
          var n = 0;
          for (var id in v._layers) {
            var lyr = v._layers[id];
            if (lyr && lyr._latlng && n < 10) { res.coords.push({ lat: lyr._latlng.lat, lon: lyr._latlng.lng, tooltip: (lyr.getTooltip && lyr.getTooltip() ? String(lyr.getTooltip().getContent()).slice(0, 60) : '') }); n++; }
          }
          break;
        }
      } catch (e) {}
    }
    return res;
  }

  // ── 7. Knockout — hangt er een viewmodel achter een adresrij? ─
  function knockout() {
    if (typeof window.ko === 'undefined') return { aanwezig: false };
    var hits = deepest(/\b\d{4}\s?[A-Z]{2}\b/, 1);
    if (!hits.length) return { aanwezig: true, viewmodel: null };
    try {
      var d = window.ko.dataFor(hits[0]);
      if (!d) return { aanwezig: true, viewmodel: null };
      var keys = [];
      for (var k in d) { keys.push(k); if (keys.length > 60) break; }
      return { aanwezig: true, viewmodelKeys: keys, voorbeeld: JSON.parse(JSON.stringify(window.ko.toJS(d))) };
    } catch (e) { return { aanwezig: true, fout: String(e) }; }
  }

  // ── 8. DevExtreme grid — dataSource uitlezen ─────────────────
  function dxgrid() {
    if (typeof window.jQuery === 'undefined' || typeof window.DevExpress === 'undefined') return { aanwezig: false };
    var out = [];
    document.querySelectorAll('.dx-datagrid, .dx-list, .dx-treelist').forEach(function (el) {
      try {
        var root = el.closest('.dx-widget') || el;
        var inst = window.jQuery(root).data('dxDataGrid') || window.jQuery(root).data('dxList');
        if (inst && inst.getDataSource) {
          var items = inst.getDataSource().items();
          out.push({ pad: pad(root, 2), aantal: items.length, eersteItem: items[0] ? JSON.parse(JSON.stringify(items[0])) : null });
        }
      } catch (e) {}
    });
    return { aanwezig: out.length > 0, grids: out };
  }

  // ── uitvoeren ────────────────────────────────────────────────
  function run() {
    var R = {
      url: location.href,
      globals: globals(),
      ritAliassen: aliases(),
      adresRijen: adressen(),
      tijdCellen: tijden(),
      leaflet: leaflet(),
      knockout: knockout(),
      devextremeGrids: dxgrid(),
      netwerk: NET.slice(-40)
    };
    window.__probeResult = R;
    console.log('%c── PROBE RITMONITOR ──', 'font-weight:bold;color:#285dab');
    console.log(R);
    console.log('%cKopieer met:  copy(__probeResult)', 'color:#b25e00');
    return R;
  }

  window.__probe = run;
  run();
})();
