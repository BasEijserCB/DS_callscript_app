# Staging build — DS Logboek widget (nieuwe design)

Deze map bevat een **parallelle staging-versie** van de DS Logboek widget met
het nieuwe side-panel design. De productie-bestanden (`ds-logboek.js`,
`loader-bookmarklet.js`, `paste-bookmarklet.js`) blijven onaangeroerd zodat het
DS team kan blijven werken terwijl je het nieuwe design test.

## Bestanden

| Bestand | Rol |
|---|---|
| `ds-logboek-staging.js` | Volledige staging widget. Boot React + Babel uit de CDN, mount in een gescopeerde `#ds-logboek-staging-root`. **DOM-scrape, GAS-logging en clipboard-paste zijn nog niet aangesloten** — alleen design preview. |
| `loader-staging-bookmarklet.js` | Leesbare broncode van de staging loader bookmarklet. Aparte cache-key (`ds_app_staging_cache`), aparte toast-tekst, aparte raw URL. |
| `install-staging.html` | Installatiepagina met de staging loader als sleepbare knop. Voeg deze knop toe naast je bestaande prod-knoppen, of host losse pagina. |

## Hoe te testen

1. **Push deze map naar je GitHub repo** (bv. `staging/ds-logboek-staging.js`).
2. **Pas in `loader-staging-bookmarklet.js` de `SCRIPT_URL`** aan naar je eigen
   raw GitHub URL voor `ds-logboek-staging.js`. Voorbeeld:
   ```
   https://raw.githubusercontent.com/jouw-username/ds-logboek/main/staging/ds-logboek-staging.js
   ```
3. **Open `install-staging.html`** in de browser en sleep de "DS Logboek
   (staging)" knop naar je bookmarkbalk — naast je bestaande prod-loader.
4. **Open een DireXtion order**, klik op de staging bookmarklet. Het nieuwe
   design verschijnt rechts; de prod-loader werkt onveranderd in een ander
   tabblad.

## A/B testen

Open twee DireXtion-tabs naast elkaar:
- Tab 1 → klik prod loader → huidige widget
- Tab 2 → klik staging loader → nieuwe design

Beide schrijven naar verschillende localStorage cache-keys (`ds_app_prod_cache`
vs. `ds_app_staging_cache`) en verschillende DOM-roots, dus ze interfereren
niet.

## Wat MIST nog (TODO voordat staging productie kan worden)

De staging build is bewust **alleen-design** — om volledig te werken moet je
het volgende uit `ds-logboek.js` (productie) overnemen in
`ds-logboek-staging.js`:

- [ ] `scrapeOrder()` — DOM scrape voor zowel `coolbluebezorgt.dirextion.nl`
      (Knockout `data-bind`) als `coolblue.dirextion.nl/Basic` (`.details-field`)
- [ ] `effectiefProduct()`, `detecteerType()`, `artikelsoortNaarProduct()`
- [ ] `bouwLogParams()` + GAS fetch (Google Sheets logging)
- [ ] `kopieerNaarKlembord()` — bouw de exacte clipboard JSON die
      `paste-bookmarklet.js` verwacht (zie CLAUDE.md voor schema)
- [ ] `parkeerSessie()` / `herstelSessie()` — sessie-pauze flow
- [ ] `berekenCategorie()` — categorie-toewijzing voor Google Sheets
- [ ] Alle volledige flows: CBF (drie locaties), Teamleider, Andere bellers,
      Algemeen gesprek, milieuretour Pick-up, dienstType skip-conditie,
      tvNetwerk auto-selectie, etc.
- [ ] DireXtion auto-open na loggen (behalve op Basic-pagina)
- [ ] Tel.nr. normalisatie per land

Op dit moment toont de staging widget alleen mock-orderdata en doet `console.log`
+ `navigator.clipboard.writeText` met een voorbeeld payload op submit.

## Workflow voor over te zetten naar productie

Als de design goedgekeurd is door het team:
1. Port de scrape/log/paste integratie van `ds-logboek.js` naar
   `ds-logboek-staging.js`.
2. Test minimaal 1 week parallel naast prod.
3. Hernoem `staging/ds-logboek-staging.js` → `ds-logboek.js` (vervangt prod),
   of maak een PR met de diff.
4. Bump versie in `ds-logboek.js`, run `python3 build.py`, push.
5. Verwijder of archiveer de staging bookmarklet.

## React + Babel uit de CDN — overwegingen

De staging build laadt React 18 en Babel Standalone runtime uit unpkg. Dit:
- Voegt ~150kB gzipped toe aan de eerste boot (gecached daarna).
- Vertraagt de eerste mount met ~500ms.
- Vereist een internetverbinding bij eerste gebruik.

Voor productie raden we aan om óf de JSX te porten naar vanilla DOM
(zoals de huidige `ds-logboek.js`), óf React/ReactDOM mee te bundelen in een
single-file build (esbuild/rollup) zodat de bookmarklet zelf-bevattend blijft.
