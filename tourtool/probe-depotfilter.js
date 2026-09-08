/* ─────────────────────────────────────────────────────────────
   PROBE — depotfilter op de Ritmonitor
   Test of het depot-filterveld via DOM/DevExtreme te vullen is en
   of de Filteren-knop daarna te bedienen is.

   GEBRUIK
   1. Open de Ritmonitor en klap het filterpaneel open (zodat het
      depotveld en de Filteren-knop echt in de DOM staan).
   2. DevTools (F12) → Console → dit hele bestand plakken.
   3. __filterProbe()          — inventariseert velden en knoppen.
   4. __opties(<i>, 'zoek')    — alle opties van veld <i>, id + naam.
   5. __zetVeld(<i>, [ids])    — zet waarde; ids of (deel van) namen.
   6. __klikFilter()           — drukt op #filter-submit.
   7. __test(<i>, [ids])       — 5 + 6 achter elkaar, met voor/na-telling.

   Alleen 5, 6 en 7 veranderen iets; __filterProbe() en __opties() lezen.

   Op de Ritmonitor is veld 5 het depotfilter (dxTagBox, ids als string).
   ───────────────────────────────────────────────────────────── */
(function () {
  var $ = window.jQuery;
  if (!$ || !window.DevExpress) {
    console.warn('jQuery/DevExtreme niet gevonden — sta je wel op de Ritmonitor?');
  }

  // ── netwerkverkeer meelezen, zodat we zien of Filteren echt een call doet ──
  var NET = window.__filterNet || (window.__filterNet = []);
  if (!window.__filterNetPatched) {
    window.__filterNetPatched = true;
    var of = window.fetch;
    if (of) window.fetch = function (i) {
      try { NET.push({ t: Date.now(), via: 'fetch', url: String(i && i.url ? i.url : i) }); } catch (e) {}
      return of.apply(this, arguments);
    };
    var oo = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      try { NET.push({ t: Date.now(), via: 'xhr', method: m, url: String(u) }); } catch (e) {}
      return oo.apply(this, arguments);
    };
  }

  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

  // Label van een DevExtreme-veld: eerst de formulier-/fieldlabels in de
  // voorouders, anders de tekst links ervan in dezelfde regel.
  function labelVan(root) {
    var n = root, i = 0;
    while (n && i++ < 6) {
      var l = n.previousElementSibling;
      while (l) {
        var t = txt(l);
        if (t && t.length < 60) return t;
        l = l.previousElementSibling;
      }
      var lab = n.parentElement && n.parentElement.querySelector(
        ':scope > label, :scope > .dx-field-item-label, :scope > .dx-field-label');
      if (lab && txt(lab)) return txt(lab);
      n = n.parentElement;
    }
    return '';
  }

  function pad(el, n) {
    var p = [], x = el, i = 0;
    while (x && x.nodeType === 1 && i++ < n) {
      var s = x.tagName.toLowerCase();
      if (x.id) s += '#' + x.id;
      var c = typeof x.className === 'string' ? x.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      if (c) s += '.' + c;
      p.unshift(s); x = x.parentElement;
    }
    return p.join(' > ');
  }

  // Opties van een tagbox/selectbox: uit items() of via load() van de store.
  function opties(inst) {
    try {
      var ds = inst.getDataSource && inst.getDataSource();
      var arr = (ds && ds.items && ds.items()) || inst.option('items') || [];
      if ((!arr || !arr.length) && ds && ds.store) {
        var geladen = ds.store().load();
        if (geladen && geladen.done) {
          geladen.done(function (d) { inst.__probeItems = d; });
          return { status: 'store().load() loopt — draai __filterProbe() zo nog eens' };
        }
      }
      if ((!arr || !arr.length) && inst.__probeItems) arr = inst.__probeItems;
      var ve = inst.option('valueExpr'), de = inst.option('displayExpr');
      return {
        aantal: arr.length,
        valueExpr: ve, displayExpr: de,
        voorbeeld: arr.slice(0, 40).map(function (o) {
          if (o === null || typeof o !== 'object') return o;
          return {
            value: typeof ve === 'string' ? o[ve] : (o.Id != null ? o.Id : o.id),
            display: typeof de === 'string' ? o[de] : (o.Name || o.name || o.Text || o.text),
            ruw: Object.keys(o).slice(0, 8)
          };
        })
      };
    } catch (e) { return { fout: String(e) }; }
  }

  // Alle tagboxes en selectboxes op de pagina, in DOM-volgorde.
  function velden() {
    var uit = [];
    document.querySelectorAll('.dx-tagbox, .dx-selectbox').forEach(function (root) {
      // Geneste widgets (een selectbox binnen een tagbox-dropdown) overslaan.
      if (root.parentElement && root.parentElement.closest('.dx-tagbox, .dx-selectbox')) return;
      var soort = root.classList.contains('dx-tagbox') ? 'dxTagBox' : 'dxSelectBox';
      var inst = null;
      try { inst = $(root)[soort]('instance'); } catch (e) {}
      uit.push({
        i: uit.length,
        soort: soort,
        label: labelVan(root),
        zichtbaar: !!(root.offsetWidth || root.offsetHeight),
        placeholder: txt(root.querySelector('.dx-placeholder')),
        waarde: inst ? inst.option('value') : '(geen instance)',
        opties: inst ? opties(inst) : null,
        pad: pad(root, 4),
        el: root
      });
    });
    return uit;
  }

  // Kandidaat-knoppen: alles wat op Filteren/Zoeken/Toepassen lijkt.
  function knoppen() {
    var re = /^(filter|filteren|zoek|zoeken|toepassen|apply|search|ok)$/i;
    var uit = [];
    document.querySelectorAll('.dx-button, button, input[type=submit], a[role=button]').forEach(function (el) {
      var t = txt(el);
      if (!t || t.length > 30) return;
      uit.push({
        tekst: t, match: re.test(t),
        zichtbaar: !!(el.offsetWidth || el.offsetHeight),
        pad: pad(el, 3), el: el
      });
    });
    uit.sort(function (a, b) { return (b.match ? 1 : 0) - (a.match ? 1 : 0); });
    return uit;
  }

  function ritTelling() {
    var r = document.querySelectorAll('table.tourlist tr.icons').length;
    if (r) return r;
    return document.querySelectorAll('table.tourlist tr').length;
  }

  window.__filterVelden = [];
  window.__filterKnoppen = [];

  window.__filterProbe = function () {
    var v = velden(), k = knoppen();
    window.__filterVelden = v;
    window.__filterKnoppen = k;
    console.log('%c── VELDEN (tagbox/selectbox) ──', 'font-weight:bold;color:#285dab');
    console.table(v.map(function (x) {
      return { i: x.i, soort: x.soort, label: x.label, zichtbaar: x.zichtbaar,
               waarde: JSON.stringify(x.waarde), opties: x.opties && x.opties.aantal };
    }));
    console.log('volledig:', v);
    console.log('%c── KNOPPEN ──', 'font-weight:bold;color:#285dab');
    console.table(k.map(function (x) { return { tekst: x.tekst, match: x.match, zichtbaar: x.zichtbaar, pad: x.pad }; }));
    console.log('ritten in de lijst nu:', ritTelling());
    console.log('%cZet een waarde met:  __zetVeld(<i>, [id, id])   daarna  __klikFilter()', 'color:#b25e00');
    return { velden: v, knoppen: k };
  };

  // Alle opties van een veld, id + naam. Met zoek: __opties(5, 'rotter')
  window.__opties = function (i, zoek) {
    var v = window.__filterVelden[i];
    if (!v) { console.warn('geen veld ' + i + ' — draai eerst __filterProbe()'); return; }
    var inst = $(v.el)[v.soort]('instance');
    var ds = inst.getDataSource && inst.getDataSource();
    var arr = (ds && ds.items && ds.items()) || inst.option('items') || inst.__probeItems || [];
    var ve = inst.option('valueExpr'), de = inst.option('displayExpr');
    var lijst = arr.map(function (o) {
      if (o === null || typeof o !== 'object') return { value: o, naam: String(o) };
      return {
        value: typeof ve === 'string' ? o[ve] : (o.Id != null ? o.Id : o.id),
        naam: typeof de === 'function' ? de(o)
            : typeof de === 'string' ? o[de]
            : (o.Name || o.name || o.Text || o.text || '')
      };
    });
    if (zoek) {
      var q = String(zoek).toLowerCase();
      lijst = lijst.filter(function (o) {
        return String(o.naam).toLowerCase().indexOf(q) >= 0 ||
               String(o.value).toLowerCase().indexOf(q) >= 0;
      });
    }
    console.table(lijst);
    window.__laatsteOpties = lijst;
    console.log('%ckopieer met:  copy(__laatsteOpties)', 'color:#b25e00');
    return lijst;
  };

  // Waarde zetten via de instance — niet via het input-element. DevExtreme
  // leest de tekst in dat input alleen voor zoeken; de echte waarde zit in
  // de option, en alleen die triggert de knockout-binding eronder.
  //
  // Waarde mag ids zijn (['13','14']) of namen ('Rotterdam'); namen worden
  // via de optielijst opgezocht, hoofdletterongevoelig en op deel van de
  // naam. De ids van dit filter zijn strings — geen parseInt, anders dan
  // de TagBoxes in het Import-formulier.
  window.__zetVeld = function (i, waarde) {
    var v = window.__filterVelden[i];
    if (!v) { console.warn('geen veld ' + i + ' — draai eerst __filterProbe()'); return; }
    var inst = $(v.el)[v.soort]('instance');
    var lijst = window.__opties ? (function () {
      var stil = console.table; console.table = function () {};
      var l = window.__opties(i); console.table = stil; return l || [];
    })() : [];
    var ids = (Array.isArray(waarde) ? waarde : [waarde]).map(function (w) {
      var direct = lijst.filter(function (o) { return String(o.value) === String(w); })[0];
      if (direct) return direct.value;
      var q = String(w).toLowerCase();
      var opNaam = lijst.filter(function (o) { return String(o.naam).toLowerCase().indexOf(q) >= 0; });
      if (opNaam.length === 1) return opNaam[0].value;
      if (opNaam.length > 1) {
        console.warn('"' + w + '" past op ' + opNaam.length + ' depots:',
          opNaam.map(function (o) { return o.naam; }).join(', ') + ' — wees specifieker of geef het id');
        return null;
      }
      console.warn('"' + w + '" niet gevonden in de optielijst; ongewijzigd doorgegeven');
      return w;
    }).filter(function (x) { return x !== null; });
    var voor = inst.option('value');
    inst.option('value', v.soort === 'dxTagBox' ? ids : ids[0]);
    var na = inst.option('value');
    console.log('veld ' + i + ' (' + (v.label || v.soort) + '):', voor, '→', na);
    return na;
  };

  window.__klikFilter = function (index) {
    var k = window.__filterKnoppen;
    if (!k.length) { console.warn('draai eerst __filterProbe()'); return; }
    var vast = document.getElementById('filter-submit');   // de echte knop op de Ritmonitor
    var doel = index != null ? k[index]
             : vast ? { tekst: 'Filteren', pad: '#filter-submit', el: vast }
             : k.filter(function (x) { return x.match && x.zichtbaar; })[0];
    if (!doel) { console.warn('geen Filteren-knop gevonden; kies er zelf een met __klikFilter(<index>)'); return; }
    var voorRitten = ritTelling(), voorNet = NET.length;
    console.log('klik op "' + doel.tekst + '" (' + doel.pad + ')');
    try {
      var inst = $(doel.el).dxButton && $(doel.el).dxButton('instance');
      if (inst) {
        // De dxButton-instance kent geen click(); het onderliggende element
        // klikken laat DevExtreme zijn eigen handler gewoon draaien.
        doel.el.click();
      } else {
        doel.el.click();
      }
    } catch (e) { console.warn('klik faalde:', e); }
    setTimeout(function () {
      console.log('ritten:', voorRitten, '→', ritTelling());
      console.log('netwerkcalls sinds de klik:', NET.slice(voorNet));
    }, 1500);
  };

  window.__test = function (i, waarde) {
    window.__filterProbe();
    window.__zetVeld(i, waarde);
    setTimeout(function () { window.__klikFilter(); }, 300);
  };

  console.log('%c── PROBE DEPOTFILTER geladen ──', 'font-weight:bold;color:#285dab');
  console.log('Start met:  __filterProbe()');
  window.__filterProbe();
})();
