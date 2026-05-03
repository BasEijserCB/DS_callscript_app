# Staging build - DS Logboek widget

Deze map bevat een parallelle staging-versie van de DS Logboek widget. De
productie-bestanden (`ds-logboek.js`, `loader-bookmarklet.js`,
`paste-bookmarklet.js`) blijven onaangeroerd zodat het DS team kan blijven
werken terwijl staging apart getest wordt.

## Status

`ds-logboek-staging.js` is nu een functionele staging-baseline op basis van de
productie-widget, met de panelstijl uit de nieuwe design-preview:

- DOM-scrape voor `coolbluebezorgt.dirextion.nl` en
  `coolblue.dirextion.nl/Basic`
- productdetectie en productverfijning
- volledige gespreksflows uit productie
- Google Sheets logging via GAS
- clipboard-payload voor `paste-bookmarklet.js`
- DireXtion auto-open na loggen, behalve op Basic-pagina's
- aparte staging wrapper en aparte staging localStorage keys voor vensterformaat

De oude parkeer-/hervat-flow is bewust verwijderd uit staging.

Let op: de eerdere React/Babel mock-preview is niet meer de runtime. Staging
gebruikt nu de productieflow met een nieuwe side-panel stylinglaag, zodat er
geen mockdata zoals "Sanne de Vries" meer in de tool zit.

## Bestanden

| Bestand | Rol |
|---|---|
| `ds-logboek-staging.js` | Functionele staging-widget. Gebaseerd op productiegedrag, met staging wrapper `#ds-combi-staging-wrapper` en zonder parkeerfunctie. |
| `loader-staging-bookmarklet.js` | Leesbare broncode van de staging loader bookmarklet. Aparte cache-key (`ds_app_staging_cache_v3`), aparte toast-tekst, aparte raw URL. |
| `install-staging.html` | Installatiepagina met de staging loader als sleepbare knop. |

## Hoe te testen

1. Push deze map naar de GitHub repo.
2. Controleer in `loader-staging-bookmarklet.js` dat `SCRIPT_URL` naar de raw
   GitHub URL van `staging/ds-logboek-staging.js` wijst.
3. Open `install-staging.html` in de browser en sleep de "DS Logboek
   (staging)" knop naar je bookmarkbalk.
4. Open een DireXtion order en klik op de staging bookmarklet.

## A/B testen

Open twee DireXtion-tabs naast elkaar:

- Tab 1: klik prod loader
- Tab 2: klik staging loader

Staging gebruikt een eigen loader-cache (`ds_app_staging_cache_v3`) en eigen DOM
wrapper (`#ds-combi-staging-wrapper`). Formaatvoorkeuren staan ook los van prod:
`ds_staging_height` en `ds_staging_wide`.

## Nog te doen

- Test de volledige flow-matrix op echte DireXtion orders.
- Vergelijk de styling met de oorspronkelijke design-preview en verfijn waar
  nodig per onderdeel.
- Voeg `staging/ds-logboek-staging.js` toe aan een syntax-check of aparte
  staging buildstap zodra Node lokaal beschikbaar is.

## Productie-overzet

Als staging akkoord is:

1. Test minimaal 1 week parallel naast prod.
2. Verwerk de gewenste staging-wijzigingen in `ds-logboek.js`.
3. Bump versie in `ds-logboek.js`.
4. Run `python3 build.py`.
5. Push naar GitHub.
