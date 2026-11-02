/* ─────────────────────────────────────────────────────────────
   PLANNING-INSTELLINGEN — vaste instellingen in de planningsmodule
   Draait op coolblue.dirextion.nl/ModulePlanningBeta.

   Leesbare versie van de losse bookmarklet "planning refresh"
   (planning refresh/planning_refresh.gs). Wordt geladen door de
   combi-loader (loader-planning-combi-bookmarklet.js), samen met
   laadvermogen.js. De losse bookmarklet blijft ongewijzigd bestaan.

   WAT HET ZET
   - Vinkjes "rit op kaart" en "visit op kaart" (showTourOnMap,
     showVisitOnMap) aan.
   - Kanaalfilter op 2mans levering (id 16). Dit triggert een callback
     van TourGrid; laadvermogen.js hangt aan EndCallback en past zich
     daarna vanzelf opnieuw toe.
   - Auto-reload aan.
   - Werkperiode 3 uur, eerste pauze 20 minuten.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var PLANNING_VERSION = '1.0.0';

  if (!/ModulePlanningBeta/i.test(location.href)) return;

  function vm(selector, ctx) {
    var el = document.querySelector(selector);
    if (!el || !window.ko) return null;
    var c = ko.contextFor(el);
    return c ? c[ctx] : null;
  }

  ['showTourOnMap', 'showVisitOnMap'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el.checked) {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  var hidden = document.getElementById('FilterChannel_VI');
  var display = document.getElementById('FilterChannel_I');
  if (hidden && display) {
    hidden.value = '16';
    display.value = '2mans levering';
    if (typeof ASPx !== 'undefined') ASPx.ETextChanged('FilterChannel');
  }

  var root = vm('[data-bind*="toggleAutoReload"]', '$root');
  if (root && typeof root.autoReload === 'function' && !root.autoReload()) root.toggleAutoReload();

  var uren = vm('select[data-bind*="workingPeriodHours"]', '$data');
  if (uren && typeof uren.workingPeriodHours === 'function') uren.workingPeriodHours(3);

  var pauze = vm('select[data-bind*="firstWorkingBreakPeriodMinutes"]', '$data');
  if (pauze && typeof pauze.firstWorkingBreakPeriodMinutes === 'function') pauze.firstWorkingBreakPeriodMinutes(20);

  console.log('[Planning-instellingen] v' + PLANNING_VERSION + ' toegepast');
})();
