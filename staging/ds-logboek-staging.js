// ds-logboek-staging.js
// Staging build of the DS Logboek widget — new "side panel" design.
// Loaded by the staging loader bookmarklet (separate cache key).
//
// Architecture: this file is eval'd directly into the DireXtion page by the
// loader bookmarklet, just like ds-logboek.js. To keep the design portable
// from the React prototype, we boot React + Babel from CDN, mount into a
// scoped <div id="ds-logboek-root">, and run the JSX inline.
//
// IMPORTANT: scrape + paste integration is NOT yet wired in this staging
// build. Order data is mocked, and the "Loggen" button shows the JSON it
// WOULD send to GAS / clipboard — review the design first, then we'll wire
// up scrapeOrder() / kopieerNaarKlembord() / GAS-fetch from the production
// ds-logboek.js in a follow-up pass.

(function () {
  const STAGING_VERSION = "0.1.0-staging";
  const ROOT_ID = "ds-logboek-staging-root";
  const STYLE_ID = "ds-logboek-staging-style";

  // Guard against double-mount (bookmarklet clicked twice)
  if (document.getElementById(ROOT_ID)) {
    document.getElementById(ROOT_ID).style.display = "block";
    console.log("[DS Logboek staging] already mounted");
    return;
  }

  // ─────────────────────────────────────────────────────────
  // 1. Inject scoped stylesheet
  //    Every selector is namespaced under #ds-logboek-staging-root so we
  //    don't bleed into DireXtion's DevExtreme styles.
  // ─────────────────────────────────────────────────────────
  const css = `
  #${ROOT_ID} {
    --cb-blue:#0090e3;--cb-blue-deep:#007ec7;--cb-blue-darker:#005a92;
    --cb-blue-bg:#eaf5fc;--cb-blue-line:#cfe6f5;
    --accent:#f7a81b;--accent-dark:#e89400;
    --ink-1:#0e2540;--ink-2:#2a3a4f;--ink-3:#5a6a7f;--ink-4:#8b9bad;
    --paper:#fff;--line:#e2e7ec;--line-soft:#eef1f4;
    --ok:#2c8a4a;--ok-bg:#e6f4ec;--warn:#b85c00;--warn-bg:#fdf1de;
    --r-sm:4px;--r-md:6px;--r-lg:10px;
    position:fixed;top:16px;right:16px;width:460px;
    max-height:calc(100vh - 32px);
    z-index:2147483645;
    font:13.5px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;
    color:var(--ink-1);
    background:var(--paper);
    border-radius:8px;
    box-shadow:0 6px 24px rgba(10,30,60,.18),0 2px 6px rgba(10,30,60,.08);
    display:flex;flex-direction:column;overflow:hidden;
    -webkit-font-smoothing:antialiased;
  }
  #${ROOT_ID} *,#${ROOT_ID} *::before,#${ROOT_ID} *::after{box-sizing:border-box}
  #${ROOT_ID} button{font:inherit;cursor:pointer;margin:0}
  #${ROOT_ID} kbd{display:inline-block;font:600 10px ui-monospace,Menlo,monospace;
    padding:1px 5px;border:1px solid var(--line);border-bottom-width:2px;
    border-radius:3px;background:#fafbfc;color:var(--ink-2);margin:0 2px}

  #${ROOT_ID} .ds-header{background:linear-gradient(180deg,var(--cb-blue),var(--cb-blue-deep));
    color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
  #${ROOT_ID} .ds-header__brand{display:flex;align-items:center;gap:10px}
  #${ROOT_ID} .ds-logo{display:inline-flex;align-items:center;gap:7px;
    background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);
    border-radius:999px;padding:4px 10px 4px 6px;font-weight:700;font-size:12px;letter-spacing:.02em}
  #${ROOT_ID} .ds-logo__dot{width:14px;height:14px;border-radius:50%;background:var(--accent);
    box-shadow:0 0 0 2px rgba(255,255,255,.35) inset}
  #${ROOT_ID} .ds-header__sub{font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:.12em}
  #${ROOT_ID} .ds-header__right{display:flex;align-items:center;gap:10px}
  #${ROOT_ID} .ds-iconbtn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
    color:#fff;border-radius:var(--r-sm);width:24px;height:24px;display:inline-flex;
    align-items:center;justify-content:center;padding:0}
  #${ROOT_ID} .ds-iconbtn:hover{background:rgba(255,255,255,.22)}
  #${ROOT_ID} .ds-version{font:600 10px ui-monospace,monospace;opacity:.65;letter-spacing:.03em}

  #${ROOT_ID} .ds-stage-banner{background:#fff7e2;border-bottom:1px solid #f4dca0;color:#7a5300;
    font-size:11px;padding:6px 12px;display:flex;align-items:center;gap:6px;font-weight:600}

  #${ROOT_ID} .ds-order{background:var(--cb-blue-bg);border-bottom:1px solid var(--cb-blue-line);flex-shrink:0}
  #${ROOT_ID} .ds-order__head{width:100%;background:transparent;border:0;text-align:left;
    padding:10px 14px;position:relative;display:flex;flex-direction:column;gap:3px}
  #${ROOT_ID} .ds-order__top{display:flex;align-items:center;gap:8px;font-size:11px;
    color:var(--cb-blue-darker);font-weight:600;letter-spacing:.03em;text-transform:uppercase}
  #${ROOT_ID} .ds-order__nr{font-family:ui-monospace,monospace}
  #${ROOT_ID} .ds-order__country{display:inline-flex;align-items:center;gap:4px;margin-left:auto;
    font-weight:500;text-transform:none;color:var(--ink-3);font-size:11px;letter-spacing:0}
  #${ROOT_ID} .ds-flag{display:inline-block;width:14px;height:10px;
    background:linear-gradient(to bottom,#ae1c28 33%,#fff 33% 66%,#21468b 66%);
    border-radius:1.5px;border:.5px solid rgba(0,0,0,.1)}
  #${ROOT_ID} .ds-order__name{display:flex;align-items:center;gap:6px;font-weight:700;font-size:14px}
  #${ROOT_ID} .ds-order__phone{margin-left:auto;font-weight:500;font-size:12px;color:var(--ink-2);
    font-family:ui-monospace,monospace;display:inline-flex;align-items:center;gap:4px}
  #${ROOT_ID} .ds-order__chev{position:absolute;right:10px;bottom:8px;font-size:10px;color:var(--ink-3)}
  #${ROOT_ID} .ds-order__body{padding:0 14px 12px;display:grid;gap:4px;
    border-top:1px dashed var(--cb-blue-line);margin-top:4px;padding-top:8px}
  #${ROOT_ID} .ds-row{display:grid;grid-template-columns:78px 1fr;gap:8px;font-size:12px}
  #${ROOT_ID} .ds-row__l{color:var(--ink-3)}
  #${ROOT_ID} .ds-row__v{color:var(--ink-1);font-weight:500}
  #${ROOT_ID} .ds-row__v.is-mono{font-family:ui-monospace,monospace;font-size:11.5px}

  #${ROOT_ID} .ds-body{flex:1;overflow-y:auto;padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px}
  #${ROOT_ID} .ds-body::-webkit-scrollbar{width:8px}
  #${ROOT_ID} .ds-body::-webkit-scrollbar-thumb{background:#d9dfe5;border-radius:4px}

  #${ROOT_ID} .ds-step-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
  #${ROOT_ID} .ds-back{background:transparent;border:1px solid transparent;
    color:var(--cb-blue-darker);font-weight:600;font-size:12px;padding:3px 6px 3px 4px;
    border-radius:var(--r-sm);display:inline-flex;align-items:center;gap:3px}
  #${ROOT_ID} .ds-back:hover{background:var(--cb-blue-bg)}
  #${ROOT_ID} .ds-trail{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px;
    font-size:11px;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;margin-left:auto}
  #${ROOT_ID} .ds-trail li::after{content:"›";padding:0 4px;color:var(--ink-4)}
  #${ROOT_ID} .ds-trail li:last-child::after{content:""}
  #${ROOT_ID} .ds-trail li.is-current{color:var(--cb-blue-darker);font-weight:700}

  #${ROOT_ID} .ds-h4{font-size:14px;font-weight:700;margin:4px 0 2px;letter-spacing:-.005em}
  #${ROOT_ID} .ds-p{margin:0 0 4px;color:var(--ink-2);font-size:12.5px}

  #${ROOT_ID} .ds-stack{display:flex;flex-direction:column;gap:6px}
  #${ROOT_ID} .ds-grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  #${ROOT_ID} .ds-callergrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  #${ROOT_ID} .ds-callergrid > .ds-opt:first-child{grid-column:1 / -1}

  #${ROOT_ID} .ds-opt{display:flex;align-items:center;gap:10px;background:#fff;
    border:1px solid var(--line);border-left:3px solid var(--line);border-radius:var(--r-md);
    padding:9px 12px;text-align:left;font-weight:500;font-size:13.5px;color:var(--ink-1);
    transition:border-color .12s,background .12s;position:relative;width:100%}
  #${ROOT_ID} .ds-opt:hover{border-color:var(--cb-blue);border-left-color:var(--cb-blue);background:#f7fbfe}
  #${ROOT_ID} .ds-opt.is-selected{border-color:var(--cb-blue-deep);
    border-left-color:var(--accent);background:var(--cb-blue-bg)}
  #${ROOT_ID} .ds-opt.is-big{padding:12px 14px;font-size:14px}
  #${ROOT_ID} .ds-opt__icon{width:32px;height:32px;border-radius:6px;background:var(--cb-blue-bg);
    color:var(--cb-blue-darker);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
  #${ROOT_ID} .ds-opt__label{flex:1}
  #${ROOT_ID} .ds-opt__sub{font-size:11px;color:var(--ink-3);font-weight:500;
    background:var(--line-soft);padding:2px 8px;border-radius:999px}
  #${ROOT_ID} .ds-opt.is-ok .ds-opt__sub{background:var(--ok-bg);color:var(--ok)}
  #${ROOT_ID} .ds-opt.is-warn .ds-opt__sub{background:var(--warn-bg);color:var(--warn)}

  #${ROOT_ID} .ds-disclose{border-top:1px dashed var(--line);padding-top:8px;margin-top:4px}
  #${ROOT_ID} .ds-disclose > summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;
    gap:4px;color:var(--cb-blue-darker);font-weight:600;font-size:12px;padding:4px 6px;border-radius:var(--r-sm)}
  #${ROOT_ID} .ds-disclose > summary::-webkit-details-marker{display:none}
  #${ROOT_ID} .ds-disclose > summary:hover{background:var(--cb-blue-bg)}
  #${ROOT_ID} .ds-disclose[open] > summary{margin-bottom:6px}

  #${ROOT_ID} .ds-note{display:flex;gap:8px;padding:8px 10px;border-radius:var(--r-md);
    font-size:12.5px;border:1px solid;align-items:flex-start}
  #${ROOT_ID} .ds-note.is-info{background:var(--cb-blue-bg);border-color:var(--cb-blue-line);color:var(--cb-blue-darker)}
  #${ROOT_ID} .ds-note.is-warn{background:var(--warn-bg);border-color:#f4dca0;color:var(--warn)}
  #${ROOT_ID} .ds-note.is-ok{background:var(--ok-bg);border-color:#b9dfc7;color:var(--ok)}
  #${ROOT_ID} .ds-note strong{display:block;margin-bottom:2px;font-weight:700}

  #${ROOT_ID} .ds-field{display:flex;flex-direction:column;gap:3px}
  #${ROOT_ID} .ds-field__l{font-size:11px;font-weight:600;text-transform:uppercase;
    letter-spacing:.04em;color:var(--ink-3)}
  #${ROOT_ID} .ds-field__hint{font-size:11px;color:var(--ink-3)}
  #${ROOT_ID} .ds-input{width:100%;padding:7px 10px;border:1px solid var(--line);
    border-radius:var(--r-md);font:inherit;color:var(--ink-1);background:#fff;outline:none;
    transition:border-color .12s,box-shadow .12s}
  #${ROOT_ID} .ds-input:focus{border-color:var(--cb-blue);box-shadow:0 0 0 3px rgba(0,144,227,.18)}
  #${ROOT_ID} .ds-input.is-route{font-family:ui-monospace,monospace;font-size:14px;
    letter-spacing:.04em;font-weight:600}

  #${ROOT_ID} .ds-route-preview{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}
  #${ROOT_ID} .ds-route-preview > div{background:var(--cb-blue-bg);border:1px solid var(--cb-blue-line);
    border-radius:var(--r-md);padding:8px 10px;display:flex;flex-direction:column;gap:1px}
  #${ROOT_ID} .ds-route-preview span{font-size:10px;color:var(--cb-blue-darker);
    text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  #${ROOT_ID} .ds-route-preview strong{font:700 16px ui-monospace,monospace;color:var(--ink-1)}

  #${ROOT_ID} .ds-summary{border:1px solid var(--line);border-radius:var(--r-md);
    background:#fafbfd;padding:8px 12px 10px}
  #${ROOT_ID} .ds-summary__head{display:flex;justify-content:space-between;align-items:center;
    margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed var(--line)}
  #${ROOT_ID} .ds-summary__cat{font-size:11px;color:var(--ink-3)}
  #${ROOT_ID} .ds-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;
    font-weight:700;padding:2px 8px;border-radius:999px}
  #${ROOT_ID} .ds-pill.is-ok{background:var(--ok-bg);color:var(--ok)}
  #${ROOT_ID} .ds-srow{display:grid;grid-template-columns:80px 1fr;gap:8px;font-size:12px;padding:3px 0}
  #${ROOT_ID} .ds-srow > span{color:var(--ink-3)}
  #${ROOT_ID} .ds-srow > strong{font-weight:600}
  #${ROOT_ID} .ds-actions{display:flex;flex-direction:column;gap:6px}
  #${ROOT_ID} .ds-code{background:#0e2540;color:#d6e4f0;border-radius:var(--r-md);
    padding:10px 12px;font:500 11px/1.5 ui-monospace,Menlo,monospace;margin:6px 0 0;
    overflow-x:auto;max-height:200px;white-space:pre-wrap}

  #${ROOT_ID} .ds-btn{border:1px solid var(--line);background:#fff;border-radius:var(--r-md);
    padding:7px 12px;font-weight:600;font-size:12.5px;color:var(--ink-1);display:inline-flex;
    align-items:center;gap:6px;transition:background .12s,border-color .12s}
  #${ROOT_ID} .ds-btn:hover{background:var(--line-soft)}
  #${ROOT_ID} .ds-btn:disabled{opacity:.45;cursor:not-allowed}
  #${ROOT_ID} .ds-btn--primary{background:var(--accent);border-color:var(--accent-dark);color:#fff}
  #${ROOT_ID} .ds-btn--primary:hover{background:var(--accent-dark)}
  #${ROOT_ID} .ds-btn--secondary{background:var(--cb-blue);border-color:var(--cb-blue-deep);color:#fff}
  #${ROOT_ID} .ds-btn--secondary:hover{background:var(--cb-blue-deep)}
  #${ROOT_ID} .ds-btn--ghost{background:transparent;border-color:transparent;color:var(--ink-3)}
  #${ROOT_ID} .ds-btn--ghost:hover{background:var(--line-soft);color:var(--ink-1)}
  #${ROOT_ID} .ds-btn--lg{padding:11px 14px;font-size:13.5px;justify-content:center}

  #${ROOT_ID} .ds-footer{border-top:1px solid var(--line);padding:8px 14px;display:flex;
    align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;background:#fbfcfd}
  #${ROOT_ID} .ds-hint{font-size:11px;color:var(--ink-4)}
  `;

  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ID;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Mount node
  const rootEl = document.createElement("div");
  rootEl.id = ROOT_ID;
  document.body.appendChild(rootEl);

  // ─────────────────────────────────────────────────────────
  // 2. Boot React + Babel from CDN, then run JSX
  //    (Cached by the browser after the first load.)
  // ─────────────────────────────────────────────────────────
  const REACT_URL = "https://unpkg.com/react@18.3.1/umd/react.production.min.js";
  const REACT_DOM_URL = "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js";
  const BABEL_URL = "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Re-use if already on the page
      if (Array.from(document.scripts).some(s => s.src === src)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function boot() {
    if (!window.React) await loadScript(REACT_URL);
    if (!window.ReactDOM) await loadScript(REACT_DOM_URL);
    if (!window.Babel) await loadScript(BABEL_URL);
    runApp();
  }

  // ─────────────────────────────────────────────────────────
  // 3. The app — Babel-transpiled JSX, then evaluated.
  //    Mirrors the prototype in DS Logboek.html almost 1-for-1.
  // ─────────────────────────────────────────────────────────
  function runApp() {
    const JSX_SOURCE = `
      const { useState, useMemo } = React;

      const MOCK_ORDER = ${JSON.stringify(window.__DS_STAGING_ORDER__ || {
        orderNr: "84291637", name: "Sanne de Vries", phone: "06 24 81 09 55",
        zip: "3014 JT", city: "Rotterdam", address: "Weena 88",
        country: "Nederland", language: "nl",
        product: "Koelkast", productDetail: "ETNA KCV343WIT",
        ritnummer: "1M-NLRC-03", zendingnummer: "A-96948813-475126177", taak: "Afleveren"
      })};

      const PRIMARY_CALLERS = [
        { id:"CBB", label:"CBB belt", sub:"Coolblue Bezorgt" },
        { id:"CBF", label:"CBF belt", sub:"Coolblue Fiets" },
        { id:"Teamleider", label:"Teamleider belt", sub:"Depot teamleider" },
      ];
      const LOCATIONS_CBB = [
        { id:"Onderweg", label:"Onderweg", icon:"truck" },
        { id:"BijDeKlant", label:"Bij de klant", icon:"home" },
        { id:"Depot", label:"Vraag voor het depot", icon:"warehouse" },
      ];
      const ONDERWEG_PROBLEMEN = [
        "Adres niet gevonden / niet bereikbaar","Adres klopt niet",
        "Klant niet bereikbaar / verkeerd nummer","Klant niet thuis",
        "Vraag over product / installatie","Vraag over tijdvak","Anders",
      ];
      const UITKOMSTEN_KNT = [
        "Klant alsnog bereikt — held wacht",
        "Helden stellen stop uit en gaan later terug",
        "Niet opgelost — afgemeld in Jerney",
      ];

      const Icon = ({ name, size = 16 }) => {
        const s = { width:size, height:size, display:"inline-block", flexShrink:0 };
        const stroke = "currentColor";
        const props = { style:s, viewBox:"0 0 24 24", fill:"none", stroke,
          strokeWidth:"1.8", strokeLinecap:"round", strokeLinejoin:"round" };
        switch (name) {
          case "truck": return <svg {...props}><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>;
          case "home": return <svg {...props}><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>;
          case "warehouse": return <svg {...props}><path d="M3 9l9-5 9 5v11H3z"/><path d="M7 20v-6h10v6"/><path d="M7 17h10"/></svg>;
          case "phone": return <svg {...props}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>;
          case "user": return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
          case "back": return <svg {...props} strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>;
          case "x": return <svg {...props} strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>;
          case "check": return <svg {...props} strokeWidth="2.2"><polyline points="4 12 10 18 20 6"/></svg>;
          case "park": return <svg {...props}><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
          case "copy": return <svg {...props}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>;
          case "external": return <svg {...props}><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>;
          case "info": return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>;
          case "warn": return <svg {...props}><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></svg>;
          default: return null;
        }
      };

      const OptBtn = ({ children, onClick, sub, big, selected, icon, tone }) => (
        <button className={"ds-opt " + (big?"is-big ":"") + (selected?"is-selected ":"") + (tone?("is-"+tone+" "):"")} onClick={onClick}>
          {icon && <span className="ds-opt__icon"><Icon name={icon} size={18}/></span>}
          <span className="ds-opt__label">{children}</span>
          {sub && <span className="ds-opt__sub">{sub}</span>}
        </button>
      );

      const Row = ({ label, value, mono }) => (
        <div className="ds-row">
          <span className="ds-row__l">{label}</span>
          <span className={"ds-row__v " + (mono?"is-mono":"")}>{value}</span>
        </div>
      );

      const SummaryRow = ({ label, value, mono }) => (
        <div className="ds-srow"><span>{label}</span><strong className={mono?"is-mono":""}>{value}</strong></div>
      );

      function App() {
        const [step, setStep] = useState("caller");
        const [bellerType, setBellerType] = useState(null);
        const [orderCollapsed, setOrderCollapsed] = useState(false);
        const [route, setRoute] = useState("2M-NLOV-07");
        const [copied, setCopied] = useState(false);

        const trail = useMemo(() => {
          if (step === "caller") return ["Wie belt er?"];
          if (step === "location") return [bellerType, "Locatie"];
          if (step === "problem") return [bellerType, "Onderweg", "Probleem"];
          if (step === "outcome") return [bellerType, "Klant niet thuis", "Uitkomst"];
          if (step === "route") return [bellerType, "Same day", "Route"];
          if (step === "submit") return ["Afronden"];
          return ["—"];
        }, [step, bellerType]);

        const onClose = () => {
          const r = document.getElementById("${ROOT_ID}");
          if (r) r.style.display = "none";
        };

        return (
          <>
            <header className="ds-header">
              <div className="ds-header__brand">
                <div className="ds-logo"><span className="ds-logo__dot"/><span>Delivery Support</span></div>
                <span className="ds-header__sub">Logboek</span>
              </div>
              <div className="ds-header__right">
                <button className="ds-iconbtn" title="Sessie pauzeren"><Icon name="park" size={14}/></button>
                <span className="ds-version">v${STAGING_VERSION}</span>
                <button className="ds-iconbtn" title="Sluiten" onClick={onClose}><Icon name="x" size={14}/></button>
              </div>
            </header>

            <div className="ds-stage-banner">
              <Icon name="warn" size={12}/> STAGING — design preview, scrape/paste niet aangesloten
            </div>

            <section className={"ds-order " + (orderCollapsed?"is-collapsed":"")}>
              <button className="ds-order__head" onClick={() => setOrderCollapsed(c => !c)}>
                <div className="ds-order__top">
                  <span className="ds-order__nr">#{MOCK_ORDER.orderNr}</span>
                  <span className="ds-order__country"><span className="ds-flag"/>{MOCK_ORDER.country}</span>
                </div>
                <div className="ds-order__name">
                  <Icon name="user" size={13}/><span>{MOCK_ORDER.name}</span>
                  <span className="ds-order__phone"><Icon name="phone" size={12}/>{MOCK_ORDER.phone}</span>
                </div>
                <span className="ds-order__chev">{orderCollapsed?"▾":"▴"}</span>
              </button>
              {!orderCollapsed && (
                <div className="ds-order__body">
                  <Row label="Adres" value={\`\${MOCK_ORDER.address}, \${MOCK_ORDER.zip} \${MOCK_ORDER.city}\`}/>
                  <Row label="Product" value={\`\${MOCK_ORDER.product} — \${MOCK_ORDER.productDetail}\`}/>
                  <Row label="Rit / Taak" value={\`\${MOCK_ORDER.ritnummer} · \${MOCK_ORDER.taak}\`}/>
                  <Row label="Zending" value={MOCK_ORDER.zendingnummer} mono/>
                </div>
              )}
            </section>

            <div className="ds-body">
              <div className="ds-step-head">
                {step !== "caller" && (
                  <button className="ds-back" onClick={() => {
                    const order = ["caller","location","problem","outcome","route","submit"];
                    const i = order.indexOf(step);
                    if (i > 0) setStep(order[i-1]);
                  }}><Icon name="back" size={14}/>Terug</button>
                )}
                <ol className="ds-trail">
                  {trail.map((t,i) => <li key={i} className={i===trail.length-1?"is-current":""}>{t}</li>)}
                </ol>
              </div>

              {step === "caller" && (
                <>
                  <h4 className="ds-h4">Wie belt er?</h4>
                  <div className="ds-callergrid">
                    {PRIMARY_CALLERS.map(c => (
                      <OptBtn key={c.id} sub={c.sub} big
                        onClick={() => { setBellerType(c.id); setStep(c.id === "Teamleider" ? "outcome" : "location"); }}>
                        {c.label}
                      </OptBtn>
                    ))}
                  </div>
                </>
              )}

              {step === "location" && (
                <>
                  <h4 className="ds-h4">Waar is de held?</h4>
                  <div className="ds-stack">
                    {LOCATIONS_CBB.map(l => (
                      <OptBtn key={l.id} icon={l.icon} big onClick={() => setStep("problem")}>{l.label}</OptBtn>
                    ))}
                  </div>
                </>
              )}

              {step === "problem" && (
                <>
                  <h4 className="ds-h4">Wat is het probleem?</h4>
                  <div className="ds-stack">
                    {ONDERWEG_PROBLEMEN.map(p => (
                      <OptBtn key={p} onClick={() => setStep("outcome")}>{p}</OptBtn>
                    ))}
                  </div>
                </>
              )}

              {step === "outcome" && (
                <>
                  <div className="ds-note is-info">
                    <span><Icon name="info" size={14}/></span>
                    <div>
                      <strong>Checklist klant niet thuis</strong>
                      Held aangebeld? Klant gebeld? Stop binnen tijdvak?
                    </div>
                  </div>
                  <h4 className="ds-h4">Wat is de uitkomst?</h4>
                  <div className="ds-stack">
                    {UITKOMSTEN_KNT.map(u => (
                      <OptBtn key={u} onClick={() => setStep("route")}>{u}</OptBtn>
                    ))}
                  </div>
                </>
              )}

              {step === "route" && (
                <>
                  <h4 className="ds-h4">Geplande route</h4>
                  <label className="ds-field">
                    <span className="ds-field__l">Route alias</span>
                    <input className="ds-input is-route" value={route} onChange={e => setRoute(e.target.value)}/>
                    <span className="ds-field__hint">Formaat: netwerk-depot-rit · 1X / 1M / 2M / BI / BK</span>
                  </label>
                  <div className="ds-route-preview">
                    <div><span>Netwerk</span><strong>{route.split("-")[0]||"—"}</strong></div>
                    <div><span>Depot</span><strong>{route.split("-")[1]||"—"}</strong></div>
                    <div><span>Rit</span><strong>{route.split("-")[2]||"—"}</strong></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                    <button className="ds-btn ds-btn--ghost" onClick={() => setStep("outcome")}>Terug</button>
                    <button className="ds-btn ds-btn--primary" onClick={() => setStep("submit")}>Doorgaan</button>
                  </div>
                </>
              )}

              {step === "submit" && (
                <>
                  <div className="ds-summary">
                    <div className="ds-summary__head">
                      <span className="ds-pill is-ok"><Icon name="check" size={11}/> Klaar om te loggen</span>
                      <span className="ds-summary__cat">Categorie: <strong>Same day gepland</strong></span>
                    </div>
                    <SummaryRow label="Beller" value={bellerType || "CBB"}/>
                    <SummaryRow label="Locatie" value="Onderweg → Klant niet thuis"/>
                    <SummaryRow label="Uitkomst" value="Helden stellen stop uit en gaan later terug"/>
                    <SummaryRow label="Route" value={route} mono/>
                    <SummaryRow label="Product" value={\`\${MOCK_ORDER.product} — \${MOCK_ORDER.productDetail}\`}/>
                  </div>
                  <div className="ds-actions">
                    <button className="ds-btn ds-btn--primary ds-btn--lg" onClick={() => {
                      const payload = {
                        orderNr: MOCK_ORDER.orderNr, name: MOCK_ORDER.name,
                        product: MOCK_ORDER.product, probleem: "Klant niet thuis",
                        uitkomst: "Helden stellen stop uit en gaan later terug",
                        geplandeRoute: route, time: Date.now()
                      };
                      console.log("[DS staging] would log + copy:", payload);
                      try { navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch(e){}
                      setCopied(true);
                    }}><Icon name="copy" size={16}/>Loggen &amp; kopiëren naar klembord</button>
                  </div>
                  {copied && (
                    <div className="ds-note is-ok">
                      <span><Icon name="check" size={14}/></span>
                      <div><strong>Payload gekopieerd</strong>Plak in DireXtion via de paste-bookmarklet.</div>
                    </div>
                  )}
                  <details className="ds-disclose">
                    <summary>Klembord payload ▾</summary>
                    <pre className="ds-code">{JSON.stringify({
                      orderNr: MOCK_ORDER.orderNr, name: MOCK_ORDER.name, phone: MOCK_ORDER.phone,
                      zip: MOCK_ORDER.zip, city: MOCK_ORDER.city, address: MOCK_ORDER.address,
                      product: MOCK_ORDER.product, probleem: "Klant niet thuis",
                      uitkomst: "Helden stellen stop uit en gaan later terug",
                      geplandeRoute: route, dienstType: "Nazorg (gratis)",
                      serviceTypeId: 51072, time: Date.now()
                    }, null, 2)}</pre>
                  </details>
                </>
              )}
            </div>

            <footer className="ds-footer">
              <span className="ds-hint">Staging build — niet voor productie</span>
              <span className="ds-hint">v${STAGING_VERSION}</span>
            </footer>
          </>
        );
      }

      const root = ReactDOM.createRoot(document.getElementById("${ROOT_ID}"));
      root.render(<App/>);
    `;

    try {
      const compiled = window.Babel.transform(JSX_SOURCE, { presets: ["react"] }).code;
      // eslint-disable-next-line no-new-func
      new Function("React", "ReactDOM", compiled)(window.React, window.ReactDOM);
      console.log("[DS Logboek staging] mounted v" + STAGING_VERSION);
    } catch (err) {
      console.error("[DS Logboek staging] mount failed:", err);
      rootEl.innerHTML =
        '<div style="padding:16px;color:#b8243a;font:13px sans-serif">' +
        'DS Logboek staging — mount failed. Zie console.</div>';
    }
  }

  boot().catch(err => {
    console.error("[DS Logboek staging] boot failed:", err);
  });
})();
