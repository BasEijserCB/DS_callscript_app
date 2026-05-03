// loader-staging-bookmarklet.js
// Leesbare broncode van de STAGING loader bookmarklet.
//
// Werkt identiek aan loader-bookmarklet.js, maar:
//  - haalt ds-logboek-staging.js op (i.p.v. ds-logboek.js)
//  - gebruikt eigen localStorage cache key (ds_app_staging_cache_v2)
//  - toast-melding label is "DS Logboek staging" (zodat je niet verwart welke versie geüpdatet is)
//
// Hoe te bookmarklet-iseren:
//  1. Minify deze functie (single line, geen comments).
//  2. Prefix met "javascript:".
//  3. URL-encode whitespace en special chars zoals gebruikelijk.
//     (Of laat install.html dit voor je doen — zie de andere bookmarklets daar.)
//
// LET OP: pas SCRIPT_URL aan naar je eigen GitHub raw URL voor het staging bestand.

(function () {
  const SCRIPT_URL  = "https://raw.githubusercontent.com/BasEijserCB/DS_callscript_app/main/staging/ds-logboek-staging.js";
  const CACHE_KEY   = "ds_app_staging_cache_v2";
  const TOAST_LABEL = "DS Logboek staging";

  function cleanupOldStagingUi() {
    ["ds-logboek-staging-root", "ds-logboek-staging-style", "ds-combi-staging-wrapper"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  // 1. Run cached versie direct (instant boot)
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try { (0, eval)(cached); }
    catch (e) { console.error("[" + TOAST_LABEL + "] cached eval failed:", e); }
  }

  // 2. Stale-while-revalidate fetch (geen CDN-cache, vergelijk en update)
  fetch(SCRIPT_URL, { cache: "no-store" })
    .then(r => r.ok ? r.text() : Promise.reject(r.status))
    .then(fresh => {
      if (fresh === cached) return; // niets veranderd

      localStorage.setItem(CACHE_KEY, fresh);

      if (cached) {
        cleanupOldStagingUi();
        try { (0, eval)(fresh); }
        catch (e) { console.error("[" + TOAST_LABEL + "] fresh eval failed:", e); }

        // Toon update-toast (alleen als er al een vorige versie was)
        const toast = document.createElement("div");
        toast.textContent = "↻ " + TOAST_LABEL + ": nieuwe versie geladen";
        toast.style.cssText = [
          "position:fixed","right:16px","bottom:16px","z-index:1000001",
          "background:#0090e3","color:#fff","padding:10px 14px","border-radius:6px",
          "font:600 12px -apple-system,sans-serif","box-shadow:0 4px 16px rgba(0,0,0,.2)",
          "cursor:pointer"
        ].join(";");
        toast.onclick = () => toast.remove();
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 8000);
      } else {
        // Eerste keer — direct booten
        try { (0, eval)(fresh); }
        catch (e) { console.error("[" + TOAST_LABEL + "] fresh eval failed:", e); }
      }
    })
    .catch(err => {
      if (!cached) {
        alert(TOAST_LABEL + ": kan staging script niet ophalen.\n" + err);
      } else {
        console.warn("[" + TOAST_LABEL + "] update fetch failed (using cached):", err);
      }
    });
})();
