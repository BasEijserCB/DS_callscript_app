# DS Logboek — Ontwikkelgids

Browsergebaseerde widget voor het Coolblue Delivery Support team. Draait bovenop DireXtion en begeleidt medewerkers door het registreren van telefonische contacten. Twee bookmarklets: één laadt de widget, één vult het DireXtion Import formulier in.

---

## Productie vs. Staging — werkregel

**Functionele wijzigingen worden altijd in BEIDE bestanden doorgevoerd:** `ds-logboek.js` én `staging/ds-logboek-staging.js`. De data-laag (scraping, flow engine, gespreksflow, logging, clipboard payload) is identiek — alleen de UI verschilt. Behandel ze als twee implementaties van dezelfde logica.

**Cosmetische wijzigingen** (UI, layout, stijl, teksten, kleuren) gelden alleen voor het bestand waarop de vraag betrekking heeft — niet automatisch voor het andere.

Uitzondering op de functionele regel: als uitdrukkelijk gevraagd wordt om een wijziging alleen in productie of alleen in staging door te voeren, geldt dat specifiek voor dat bestand.

---

## Bestanden

| Bestand | Rol |
|---|---|
| `ds-logboek.js` | Volledige widget: UI, gespreksflow, DOM-scraping, clipboard output. Gehost op GitHub, geladen via raw URL met cache-busting. |
| `loader-bookmarklet.js` | Leesbare broncode van de loader bookmarklet. Haalt `ds-logboek.js` op, cached in localStorage (`ds_app_prod_cache`), stale-while-revalidate met `{cache:'no-store'}` om CDN-cache te omzeilen. |
| `paste-bookmarklet.js` | Volledige paste logica. Bevat `PASTE_VERSION` constante. Gehost op GitHub, geladen via raw URL door de paste loader. |
| `paste-loader-bookmarklet.js` | Leesbare broncode van de paste bookmarklet loader. Haalt `paste-bookmarklet.js` op, cached in localStorage (`ds_paste_prod_cache`), stale-while-revalidate. Toont oranje toast als nieuwe versie gedownload is. |
| `install.html` | Installatiepagina. Bevat **beide** bookmarklets als sleepbare knoppen. |
| `build.py` | Syntax-checkt `ds-logboek.js` en `paste-bookmarklet.js`, detecteert versienummer uit `ds-logboek.js` en synchroniseert `PASTE_VERSION` in `paste-bookmarklet.js`. |
| `gas-backend.js` | Broncode van het Google Apps Script backend (`doGet`). Schrijft elke log-entry als rij naar de actieve Google Sheet. Moet handmatig gekopieerd worden naar de GAS editor bij wijzigingen. |
| `staging/ds-logboek-staging.js` | Staging build van de widget: zelfde data-laag (scraping, flow engine, logging, clipboard) als `ds-logboek.js`, maar met een volledig nieuwe React+Babel UI (side-panel design). Bevat `STAGING_VERSION` constante (`vX.X.X-staging`). |
| `staging/loader-staging-bookmarklet.js` | Loader bookmarklet voor de staging widget. Haalt `ds-logboek-staging.js` op via raw GitHub URL, cached in localStorage (`ds_app_staging_cache`), stale-while-revalidate. Toont eigen toast bij update. |
| `staging/install-staging.html` | Installatiepagina voor de staging bookmarklet. |

---

## Build & deploy

```bash
python3 build.py
git add . && git commit -m "beschrijving, bump to vX.X.X" && git push
```

De loader bookmarklet haalt de nieuwe `ds-logboek.js` automatisch op in de achtergrond (stale-while-revalidate + `{cache:'no-store'}`). Als de code gewijzigd is, toont de loader een blauwe toast rechtsonder ("↻ DS Logboek: nieuwe versie gedownload"). Bij de volgende klik op de bookmarklet krijg je de nieuwe versie. Cache handmatig legen is alleen nodig als fallback:
```javascript
localStorage.removeItem('ds_app_prod_cache')
```

**Versienummer** alleen ophogen bij wijzigingen aan `ds-logboek.js` — zonder te vragen. Patch voor bugfix, minor voor nieuwe feature. `build.py` synchroniseert `PASTE_VERSION` in `paste-bookmarklet.js` automatisch naar hetzelfde versienummer.

---

## Versiegeschiedenis

Nieuwste bovenaan. Alleen `ds-logboek.js` versies (productie).

| Versie | Wijziging |
|---|---|
| v1.28.0 | Add: CBF "Pakket niet meegenomen / niet ingeladen" extra uitkomst `'Product is al afgeleverd'`. Fix: `'KS:'` en `'Winkel:'` prefixes uit probleem-kolom verwijderd (beller-kolom maakt onderscheid al — voorkomt dubbele data). Ook in staging. |
| v1.27.1 | Fix: bevestiging bij naam wijzigen is nu inline in de widget (Ja/Nee in footer) i.p.v. browser `confirm()` popup. Ook in staging. |
| v1.27.0 | Add: subtiel pencil-icoontje (✎) naast naam in footer — gebruiker kan opgeslagen naam wijzigen (clear `ds_fname`/`ds_lname` + flow stelt vraag opnieuw). Ook in staging build. |
| v1.26.0 | Feat: KS/Winkel "held terug sturen" → Same day/Next day vraagt nu product + "Wat moet er gebeuren bij de klant?" voor correcte service-configuratie |
| v1.25.0 | Fix: product-selectie logica verfijnd (multi-product flow) |
| v1.24.1 | Add: `'Pick-up niet nodig'` als derde `pick_up_status` optie |
| v1.24.0 | Fix: CBF pakket-opties samengevoegd tot `'Pakket niet meegenomen / niet ingeladen'`; LEGACY_LABEL_ALIASES uitgebreid |
| v1.23.2 | Fix: terugmeldteksten interne leveringen aangescherpt |
| v1.23.1 | Add: `'Hub niet gevonden'` optie in interne leveringen flow; vrij tekstveld verwijderd |
| v1.23.0 | Add: Interne leveringen beller-type; Fornuis/Kookplaat log-only modus; deur-omdraaien sjabloon-fix; inbouw koelkast aansluiting → inbouwen sjabloon |
| v1.22.0 | Fix: drie label-hernamingen; CBF stop `'Aanpassing niet mogelijk'`; Winkel bezorgadres optie |
| v1.21.2 | Fix: probleem-afhandeling en gebruikersinstructies verfijnd |
| v1.21.1 | Fix: secties labels verduidelijkt |
| v1.21.0 | Add: zes nieuwe flow-paden; vindbaarheid verbeterd |
| v1.20.6 | Fix: Miele WEC prefix toegevoegd (wasmachine) |
| v1.20.5 | Fix: BK-routes loggen als `Fietshub [stad]` i.p.v. regulier depot |
| v1.20.4 | Fix: `isAlgemeen` → `scrapedOrder` (variabele bestond niet meer) |
| v1.20.3 | Refactor: Parkeer-knop vervangen door `geenOrderMode` pill-toggle in footer |
| v1.20.2 | Fix: geen-order toggle als pill-switch |
| v1.20.1 | Fix: geen-order knop als kleine tekstlink onderaan beller-select |
| v1.20.0 | Add: Blijverkoop vergeten; depot/hub vraag (CBB+CBF alarm/sleutelkastje) |
| v1.19.0 | Refactor: `build.py` synchroniseert nu `PASTE_VERSION` in `paste-bookmarklet.js` (vervangt `-min.txt` generatie) |
| v1.18.1 | Fix: Pick-up `serviceTypeId` (427807) ingevuld; Pick-up shipper landafhankelijk |
| v1.18.0 | Add: Teamleider belt; CBF pakje niet ingeladen; Basic no-auto-open; multi-product scraper |
| v1.17.2 | Fix: straat nogmaals invullen na country-load op Basic |
| v1.17.1 | Fix: straatnaam dubbel invullen na DireXtion autocomplete |
| v1.17.0 | Add: `tvNetwerk` vraag (Built in/1X) voor TV-services; auto-selectie bij bekende route |
| v1.16.16 | Fix: uitkomst `'Straat afgesloten of onvoldoende EV-rijkwijdte'` |
| v1.16.15 | Update: onderweg adresflow samengevoegd; `'Adres klopt niet'` toegevoegd |
| v1.16.14 | Fix: categorie `'Advies gegeven'` (was `'Advies / Info gegeven'` — `%2F` brak GAS kolom) |
| v1.16.13 | Add: uitkomst-categorieën kolom (kolom U) in Google Sheets logging |
| v1.16.11 | Fix: updatemelding toast blauw met sluitknop (definitieve versie) |
| v1.16.7–v1.16.10 | Iteraties updatebanner (amber/toast/polling) — zie commits |
| v1.16.6 | Fix: Wisberg prefixlijst volledig herschreven |
| v1.16.5 | Fix: Wisberg WBTTKK als koelkast |
| v1.16.4 | Add: info-paneel bij route-invoer |
| v1.16.3 | Fix: artikelsoort-veld op Basic vóór prefix-detectie gebruiken |
| v1.16.2 | Fix: verzameldoos filteren op coolbluebezorgt variant |
| v1.16.0–v1.16.1 | Add: DireXtion-order auto-open na loggen; product-rijen alleen bij same-day |
| v1.15.4 | Fix: strip leading postcode uit city-scrape (BE/DE) |
| v1.15.3 | Fix: DireXtion email-filter sleutel `EmailAddress` + datumvelden |
| v1.15.2 | Update: DireXtion link filtert op email i.p.v. ordernummer |
| v1.15.1 | Add: derde uitkomst "Helden stellen stop uit" bij klant niet thuis |
| v1.15.0 | Add: onderweg-optie `'Klant niet thuis'` met Jerney-instructie |
| v1.14.2 | Fix: dubbele onderweg-uitkomst verwijderd |
| v1.14.1 | Fix: `built-in` key in `parseToTourAlias` |
| v1.13.2 | Add: info-box voor andere bellers op submit-scherm |
| v1.13.1 | Fix: versienummer footer |
| v1.13.0 | Fix: `bellerType` hernoemd van `'Externe partner'` naar `'Andere beller'`; knop hernoemd naar "Andere bellers ▾" |
| v1.12.19 | Fix: adresveld 400ms vertraagd na postcode om DireXtion autocomplete te voorkomen |
| v1.12.17 | Fix: article-rij klikken voor 1e product; `articleTypeId`+`services` na `channelId` instellen |
| v1.12.16 | Add: meerdere producten bij plaatsen service (`products` array in payload) |
| v1.12.15 | Fix: plaatsen Extra dienst mapping terug naar Nazorg default (51072) |
| v1.12.14 | Add: `dienstType` vraag ook in same-day flow |
| v1.12.13–v1.12.12 | Fix: service/kanaal volgorde en timing |
| v1.12.11 | Fix: dxTagBox instance opzoeken via DOM-boom |
| v1.12.9 | Fix: telefoonnummer cleanup generiek (elk landnummer) |
| v1.12.8 | Add: kanaal/netwerk/service autofill voor same-day |
| v1.12.5 | Add: same-day shipper/depot autofill |
| v1.12.4 | Add: Polen (+48/0048) in telefoonnummer normalisatie |
| v1.12.0 | Add: product-verfijning opties; service-type selectie |
| v1.11.0–v1.11.26 | Iteraties witgoed-flow, product-herkenning, layout-verbeteringen |
| v1.10.0–v1.10.4 | Add: KS advies-flow; CBF pakket-opties uitgebreid; AEG prefix-fixes |
| v1.9.2–v1.9.8 | Initiële opzet: scraping, DOM-detectie, ordernummer-extractie, GAS logging |

---

## Staging — wat het is en hoe het werkt

De staging build (`staging/ds-logboek-staging.js`) is een volledig werkende alternatieve versie van de widget bedoeld om nieuwe UI-ontwerpen te testen zonder de productieversie te raken. De data-laag (scraping, flow engine, `bouwLogParams`, `kopieerNaarKlembord`, GAS logging) is identiek aan `ds-logboek.js` en wordt samen bijgehouden. De UI is volledig herschreven in React+Babel (via CDN) en draait als side-panel in de browser.

**Verschillen met productie:**
- UI: React+Babel side-panel i.p.v. vanilla JS widget
- Toont een gele "⚠ STAGING — design preview" banner bovenin
- Root element: `#ds-logboek-staging-root` (apart van productie, kan naast elkaar draaien)
- Cache key: `ds_app_staging_cache` (apart van `ds_app_prod_cache`)
- Versie-suffix: `-staging` (bijv. `v0.3.0-staging`)

**Versienummer staging** ophogen bij elke wijziging aan `staging/ds-logboek-staging.js` — zonder te vragen, zelfde regels als productie (patch voor bugfix, minor voor nieuwe feature/UI-wijziging). De `STAGING_VERSION` constante staat bovenin het bestand. `build.py` raakt de staging versie **niet** — handmatig bijwerken in het bestand zelf.

**Deploy staging:**
```bash
# Na wijziging in staging/ds-logboek-staging.js:
git add staging/ds-logboek-staging.js && git commit -m "staging: beschrijving, bump to vX.X.X-staging" && git push
```

De staging loader haalt de nieuwe versie automatisch op via stale-while-revalidate. Cache handmatig legen als fallback:
```javascript
localStorage.removeItem('ds_app_staging_cache')
```

---

## Architectuur

```
DireXtion pagina
    ↓ loader-bookmarklet (bookmarklet 1)
  - eval(localStorage['ds_app_prod_cache'])  → widget direct zichtbaar
  - fetch(ds-logboek.js, {cache:'no-store'}) → achtergrond, update cache bij diff
ds-logboek.js  (scrapet DOM → gespreksflow → twee outputs)
    ├── Google Sheets  (via GAS backend, logging)
    └── Clipboard JSON (voor paste bookmarklet)
            ↓ paste-bookmarklet (bookmarklet 2)
        paste-bookmarklet.js
            ↓ vult DireXtion Import formulier in
```

**DireXtion heeft twee varianten:**
- `coolbluebezorgt.dirextion.nl` — Knockout.js `data-bind` selectors; producttype via prefix-detectie (`detecteerType`)
- `coolblue.dirextion.nl/Basic` — `.details-field` CSS klassen; producttype via `artikelsoort`-kolom in tabel (gebruikt `artikelsoortNaarProduct`), prefix-detectie als fallback

**GAS backend** moet deployment staan op toegang "Iedereen" (niet "Iedereen binnen Coolblue") anders blokkeert CORS.

**GAS backend kolommen** (`doGet` → `appendRow`):

| Kolom | Parameter | Inhoud |
|---|---|---|
| A | datum | dd-MM-yyyy |
| B | tijd | HH:mm |
| C | user | DS medewerker |
| D | route | route (bezorger) |
| E | depot | depotlocatie |
| F | driver1 | chauffeur 1 |
| G | driver2 | bijrijder |
| H | orderBron | ordernummer (bron) |
| I | product | product / formaat |
| J | probleem | taak / klacht |
| K | redenGeenOplossing | waarom geen opl? |
| L | redenNextDay | waarom next day? |
| M | orderOplossing | ordernummer-DS |
| N | geplandeRoute | nieuwe route |
| O | dsWaarde | DS waarde (uitkomst) |
| P | bellerType | wie belde er? |
| Q | tijdvak | gecommuniceerd tijdvak |
| R | aankomsttijd | aankomsttijd |
| S | extra_info | toelichting afwijkend |
| T | extra_dienst | extra dienst nodig? (Ja / leeg) |
| U | categorie | uitkomstcategorie |
| V | tijdBlok | uurblok, bijv. `"08:00 - 08:59"` (server-side berekend) |

---

## Clipboard payload (ds-logboek.js → paste-bookmarklet.js)

```javascript
{
  orderNr, name, phone, email, zip, city, address,
  detectedCountry,    // 'Nederland' | 'België' | 'Duitsland'
  detectedLanguage,   // 'nl' | 'de'
  product,            // effectiefProduct() — meest granulaire waarde
  products,           // [array] — alleen bij plaatsen service met meerdere producten (product_keuze)
  probleem,           // geselecteerde taak
  dienstType,         // 'Nazorg (gratis)' | 'Extra dienst (betaald)' | ''
  formaatTV,          // 'Ja (>= 55 inch)' | 'Nee (< 55 inch)'
  tvNetwerk,          // 'Built in (BI)' | '1X' — alleen bij TV-installatie next-day, kleine TV
  uitkomst,           // bijv. 'Same day gepland'
  geplandeRoute,      // bijv. '2M-NLOV-07'
  serviceTypeId,      // numerieke service ID voor same-day TagBox (51072 voor plaatsen)
  time                // Date.now() — payload vervalt na 5 minuten
}
```

---

## Paste bookmarklet — volgorde van uitvoering

1. **Sjabloon eerst** (`_orderTemplateId`) + 800ms wacht — anders overschrijft sjabloon later ingevulde velden. Alleen bij next-day (`dienstType` aanwezig) én niet bij Pick-up (`isPickup`).
2. **Same-day + Pick-up: shipper + depot** — bij same-day is shipper altijd `1012729` (Coolblue DeliverySupport); bij Pick-up is shipper landafhankelijk (NL=`246477`, BE=`246481`, DE=`419436`). Depot via 4-letter routecode uit `geplandeRoute` (bijv. `NLOV` → depot ID).
3. **STAP 1c FASE 1: Productrijen toevoegen** — loop voor elk product in `products` array: click add-button, click article item (ook voor 1e product), vul code="1". `articleTypeId` en `services` worden hier NIET ingesteld — dat gebeurt in Fase 2.
4. Standaard velden: naam, telefoon, email, postcode, straat, huisnummer, woonplaats.
5. Land (`_countryId`) + 500ms wacht.
6. Taal (`_language`).
7. **Same-day: kanaal / service / netwerk** (zie hieronder).
8. **STAP 1c FASE 2: Article DX velden instellen** — ná kanaal/service/netwerk: stel per product `articleTypeId` (via `normaliseerProduct()`) en `services` TagBox (51072) in. Volgorde is kritisch: als dit vóór kanaalwissel gebeurt, wist DireXtion herrender de waarden.
9. Show on device checkbox.
10. Opmerkingenveld: `product(s) - probleem` (multiple products als comma-separated).

---

## Same-day kanaal / service / netwerk flow

Geldt voor zowel `isSameDay` als `isPickup` (Pick-up handmatig gepland). Twee varianten op basis van `serviceTypeId`:

**Normale services** (niet in `builtInServices` lijst):
```
kanaal = 16 (2mans) → wacht 800ms → netwerk = 12 → wacht 400ms → service (last)
```

**Built-in services** `[277249, 51068, 322997, 277248, 254509, 254508, 490316, 490317]`:
```
kanaal = 132134 → wacht 800ms → service → wacht 400ms → netwerk = 12 → wacht 400ms → kanaal = 16 (last)
```

Service moet als laatste worden ingesteld voor normale services (timing — anders wordt het gewist). Voor built-in is kanaal-reset naar 16 het laatste.

---

## DireXtion DOM eigenaardigheden

| Situatie | Oplossing |
|---|---|
| Opmerkingenveld | Knockout observable: `$(document.querySelectorAll('.dx-form')[1]).dxForm('instance').option('formData').remark(value)` — tweede form op de pagina |
| Telefoonnummer binding | `data-bind="text: Static.Visit.Phone"` (niet `PhoneNumber`) |
| Sjabloon overschrijft velden | Sjabloon altijd eerst, daarna pas andere velden, 800ms wachttijd |
| Service TagBox leeg na setValue | Items laden async na kanaalwissel — wacht minstens 800ms na `_channelId` zetten |
| TagBox instance zoeken | `input.closest('.dx-tagbox')` → `dxTagBox('instance')` (widget root heeft `.dx-tagbox` class) |
| articleTypeId/services gewist na kanaalwissel | Kanaal triggert herrender van article-sectie — stel DX velden altijd in NADAT kanaal is gezet (STAP 1c Fase 2) |
| Article rij activeren | Altijd article rij klikken na add-button (ook voor 1e product) — anders zijn DX velden niet actief |
| Product rijen toevoegen | Alleen bij same-day — bij next-day worden producten via sjablonen ingevuld, handmatig toevoegen overschrijft het sjabloon |
| Verzameldoos filteren | Filteren op zowel naam (`verzameldoos`) als artikelsoort (`barcodes`) — beide varianten (coolbluebezorgt en Basic) leveren verzameldozen op |
| Woonplaats met voorlooppostcode | BE/DE scrapen soms `"1000 Brussel"` — strip leading postcode uit city vóór invullen in DireXtion |
| DireXtion auto-open onderdrukt op Basic | Na loggen opent de widget automatisch DireXtion in nieuw tabblad — maar NIET op de Basic variant (`isBasicPage`). Op Basic staat in plaats daarvan een handmatige herinnering in de controle-box. |
| TagBox waarde instellen | Altijd `[parseInt(id)]` doorgeven — `valueExpr` is `Id` (hoofdletter, numeriek), nooit een string |

---

## ds-logboek.js — relevante functies

```javascript
effectiefProduct()              // productVerfijnd || product
skipDienstType()                // true bij deur omdraaien + koelkast/vriezer → dienstType vraag overslaan
isNextDay()                     // true bij Next day uitkomst
getProductVerfijningOpties(p)   // verfijningsopties voor ambigue producten (Koelkast/Vriezer, Vaatwasser, Oven/Magnetron)
productNeedsVerfijning()        // true als product ambigu en nog niet verfijnd
parseToTourAlias(input)         // parseert routetekst → 'netwerk-depot-nr' (bijv. '2M-NLOV-07'). Netwerken: 1X, 1M, 2M, BI (keys: 'bi','inbouw','built in','built-in'), BK (fiets)
parkeerSessie() / herstelSessie(staat) // sessie pauzeren/hervatten via localStorage (PARK_KEY per order)
detecteerType(naam)             // detecteert merk + producttype via prefixTabel (voor coolbluebezorgt variant)
artikelsoortNaarProduct(soort)  // converteert artikelsoort-tekst (uit Basic tabel) naar widget-productnaam
isLogOnlyProduct()              // true als effectiefProduct() 'Fornuis' of 'Kookplaat' is — geen stop plannen
LEGACY_LABEL_ALIASES            // mapping van oude → nieuwe label-waarden; toegepast in herstelSessie() om geparkeerde sessies te migreren na hernoemen van keuze-opties. Huidig: 'Pakket niet meegenomen (manco)' + 'Pakje niet ingeladen' → 'Pakket niet meegenomen / niet ingeladen', plus eerder hernoemde uitkomsten
```

**serviceTypeId mapping** (in `kopieerNaarKlembord()`): bepaalt welke DireXtion service geselecteerd wordt voor same-day/pick-up. Meeste services hebben één ID voor zowel Nazorg als Extra dienst (geen aparte Extra dienst variant beschikbaar). Uitzonderingen:
- `stapelkit`: Nazorg=727124, Extra dienst=727123
- `Pick-up` (milieuretour_type=Pick-up): 427807
- Alle anderen: Nazorg-ID ook gebruikt als Extra dienst default

---

## Gespreksflow — bellerType

Eerste keuze in de flow (`bellerType` in `callData`). Bepaalt de rest van de vragen:

| Waarde | Betekenis | Knop-ingang |
|---|---|---|
| `CBB` | Coolblue Bezorgt (eigen bezorger) | hoofdknop "CBB belt" |
| `CBF` | Coolblue Fiets | hoofdknop "CBF belt" |
| `Teamleider` | Teamleider van een depot belt — eigen korte flow (reden + uitkomst) | hoofdknop "Teamleider belt" |
| `Interne leveringen` | Bezorger van interne leveringen belt — eigen korte flow (`intern_reden`). `locatie` auto-gezet op `'Interne leveringen'` | hoofdknop "Interne leveringen — Bezorger belt" |
| `Anders` | Klantenservice of Winkel belt. `locatie` direct meegezet (`'Klantenservice'` resp. `'Winkel'`). Knoppen staan in de "Anders" sectie van de beller-select. | "Anders" → "Klantenservice belt" / "Winkel belt" |
| `Andere beller` | Externe bezorgpartner (Technische Dienst / Yeply / G4S) belt. `locatie` wordt direct meegezet. Submit-scherm toont info-box dat probleem-log niet nodig is. | "Andere bellers ▾" → "Technische Dienst belt" / "Yeply belt" / "G4S belt" |

De "Andere bellers ▾" dropdown heette vóór v1.13.0 "Externe partner ▾". Bevat uitsluitend TD/Yeply/G4S (→ `bellerType='Andere beller'`). KS en Winkel staan als losse knoppen direct in de "Anders" sectie (→ `bellerType='Anders'`).

---

## CBF flow — locatie-keuzes

Vier locaties: `'Onderweg'` (zelfde flow als CBB), `'Bij de klant'`, `'Stop aanpassen / verwijderen'`, `'Depot / Hub vraag'`.

**Bij de klant** → `cbf_pakket_reden`:
- `'Pakket niet meegenomen / niet ingeladen'` → uitkomsten: `'Klant geïnformeerd, manco geregistreerd'` / `'Pakje wordt later afgeleverd (afleverbewijs)'` / `'Product is al afgeleverd'` / `'Niet opgelost — instructie gegeven in Jerney'`. Bij "Niet opgelost" toont het submit-scherm een info-blokje met Jerney-instructie.
- `'Pakket verkeerd / beschadigd'` / `'Overige vraag over pakket'` → uitkomsten: `'Klant geïnformeerd, manco geregistreerd'` / `'Klant geïnformeerd, held regelt verder'` / `'Nee, geen oplossing door DS'`
- `'Spullen achtergelaten bij klant'` → uitkomst-keuze: `'Same day gepland'` / `'Next day gepland'` / `'Helden lossen het zelf op (geen DS-visit gepland)'`

Vóór v1.24.0 bestonden `'Pakket niet meegenomen (manco)'` en `'Pakje niet ingeladen'` als aparte opties — beide zijn samengevoegd tot `'Pakket niet meegenomen / niet ingeladen'`. `LEGACY_LABEL_ALIASES` migreert geparkeerde sessies.

**Stop aanpassen / verwijderen** → `cbf_stop_uitkomst`: `'Stop verwijderd — bevestigd'` / `'Stop doorgepland naar andere route'` / `'Aanpassing niet mogelijk'`. `'Aanpassing niet mogelijk'` valt in categorie `'Geen oplossing'`.

**Depot / Hub vraag** → `cbf_depot_reden`: `'Ziekmelding'` / `'Fiets kapot / incident'` / `'Informeren waar de vracht is'` / `'Alarm / sleutelkastje hub'` / `'Andere vraag'`. Bij `'Andere vraag'` vrij tekstveld `cbf_depot_toelichting`.

---

## Teamleider flow (bellerType = 'Teamleider')

Korte flow, toegevoegd v1.18.0. Twee vragen:

1. `tl_reden` — "Waar gaat de vraag over?": `'Vraag om aanpassingen in rit'` of `'Andere vraag'`
2. `tl_uitkomst` — afhankelijk van reden:
   - Aanpassingen in rit → `'Aanpassing doorgegeven / bevestigd'` of `'Niet mogelijk'`
   - Andere vraag → `'Vraag beantwoord'` of `'Geen oplossing'`

Categorie: `Advies gegeven` bij positieve uitkomst, `Geen oplossing` bij `'Niet mogelijk'` of `'Geen oplossing'`. Uitkomst-string in log: `tl_uitkomst || tl_reden || 'Teamleider belt'`.

---

## Interne leveringen flow (bellerType = 'Interne leveringen')

Korte flow, toegevoegd v1.23.0. Eén vraag:

1. `intern_reden` — "Waar gaat de vraag over?": `'Bezorger meldt ETA / is bijna er'` of `'Hub niet gevonden'`

Geen vervolgvraag. Uitkomst: `'ETA melding ontvangen'` of `'Hub niet gevonden — advies gegeven'`. Categorie: altijd `Advies gegeven`. Log: `'Interne levering: ' + intern_reden`.

---

## Geen-order modus

Wanneer `scrapedOrder` aanwezig is, toont de widget-footer een **"Geen order"** toggle (pill-schakelaar). Activeren wist alle order-gebonden velden (`route`, `orderBron`, `driver1/2`, `model`, `tijdvak`, `aankomsttijd`, `product`, `formaatTV`, `productVerfijnd`) en reset `answeredKeys` (behoudt naam). De widget gaat daarna door de normale gespreksflow zonder ordercontext.

De toggle is **niet** zichtbaar als er geen ordernummer gevonden is (`!scrapedOrder`) — in dat geval start de widget direct zonder orderdata en is een aparte modus niet nodig.

Vóór v1.20.x bestond een `bellerType='Algemeen'`-flow met een `algemeen-blocks`-stap. Die is vervangen door de huidige `geenOrderMode` toggle in v1.20.1–v1.20.4.

---

## CBB Bij de klant — bijzondere probleem-gevallen

Enkele `probleem`-waarden bij CBB `'Bij de klant'` resulteren in een directe submit zonder stop te plannen:

| Probleem | Gedrag |
|---|---|
| `'Product past niet op gewenste plek'` | Direct log, submit-scherm toont Jerney-afmelding instructie |
| `'Nazorg niet gelukt / swap aanvragen'` | Direct log, submit-scherm toont instructie om notitie te maken en swap via KS aan te vragen |
| Milieuretour Pick-up → `pick_up_status='Pick-up niet gelukt — swap nodig'` | Direct log, categorie `Geen oplossing` |
| Milieuretour Pick-up → `pick_up_status='Pick-up niet nodig'` | Direct log, categorie `Advies gegeven`; log: `'Pick-up niet nodig — held geïnformeerd'` |

Vóór v1.21.0 heetten sommige van deze problemen anders (`'Niet bereikbaar'` → `'Product past niet op gewenste plek'`, `'Nazorg niet gelukt'` → `'Nazorg niet gelukt / swap aanvragen'`); de `LEGACY_LABEL_ALIASES` map verzorgt de migratie van geparkeerde sessies.

**KS/Winkel: Tijdslot aanpassing / stop aanpassen** → `ks_tijdslot_uitkomst`: `'Aanpassing doorgegeven aan held'` / `'Aanpassing niet mogelijk'`. Altijd gevolgd door `product_mee_terug`: `'Nee'` / `'Ja'`.

**Fornuis / Kookplaat — log-only**: Als `effectiefProduct()` `'Fornuis'` of `'Kookplaat'` is, toont de widget een rode waarschuwing ("DS voert geen service-visits uit") zowel in de productkiezer als op het submit-scherm. Loggen is mogelijk, maar er wordt geen stop gepland en er zijn geen sjablonen voor.

---

## Gespreksflow — dienstType en tvNetwerk vragen

**dienstType** wordt gevraagd na:
- "Next day gepland" (alle flow-paden)
- "Same day gepland" → na `geplandeRoute` (toegevoegd v1.12.14)

Wordt **overgeslagen** (`skipDienstType()`) bij: deur omdraaien + koelkast/vriezer-types (alleen Extra dienst sjabloon beschikbaar voor die combinatie).

**Sjabloon-workarounds (paste-bookmarklet):**
- **Deur omdraaien + Nazorg**: geen eigen Nazorg-sjabloon beschikbaar → paste-bookmarklet gebruikt het Extra dienst-sjabloon. Submit-scherm toont rode waarschuwing. Controleer de geplaste stop in DireXtion.
- **Inbouw koelkast/vriezer + Aansluiting**: `kopieerNaarKlembord()` stuurt `probleem='inbouwen'` door naar de paste-bookmarklet zodat het Inbouwen-sjabloon wordt gebruikt (betere sjabloonmatch dan Aansluiting voor inbouw koelkast).

**tvNetwerk** wordt gevraagd na dienstType (of na skipDienstType) bij next-day + TV-installatie-probleem + `formaatTV !== 'Ja (>= 55 inch)'`:
- Opties: `'Built in (BI)'` of `'1X'`
- Auto-selectie: als routenetwerk al `1X` is (uit `geplandeRoute`), wordt `tvNetwerk='Built in (BI)'` automatisch ingevuld (geen vraag)
- Bepaalt het sjabloon-ID voor TV-installatie in de paste bookmarklet (`groot`-vlag)

---

## Uitkomst-categorieën (Google Sheets `categorie` kolom)

Elke uitkomst wordt automatisch ingedeeld in één van zes vaste categorieën via `berekenCategorie()` in `ds-logboek.js`. De waarde wordt als `&categorie=` meegestuurd naar het GAS-backend. **Elke nieuwe uitkomst die in de toekomst wordt toegevoegd, MOET in een van deze zes categorieën passen.**

| Categorie | Wanneer |
|---|---|
| `Same day gepland` | Bezoek/oplossing voor vandaag ingepland |
| `Next day gepland` | Bezoek/oplossing voor een andere dag ingepland |
| `Onderweg opgelost` | Held geholpen terwijl onderweg (`locatie='Onderweg'`): adres gevonden, route, tel.nr., stop uitgesteld, etc. |
| `Advies gegeven` | Advies of info verstrekt zonder bezoek in te plannen: KS/Winkel geholpen, Teamleider, Interne leveringen, CBF depot/pakket, geen actie nodig, visit verwijderd, Pick-up niet nodig |
| `Geen oplossing` | DS kon geen oplossing bieden, of klant ziet af van service. Ook: CBF stop `'Aanpassing niet mogelijk'`, pick-up `'Pick-up niet gelukt — swap nodig'` |
| `Buiten DS scope` | `locatie='Afhandeling buiten DS'` of `bellerType='Andere beller'` (TD/Yeply/G4S — externe bezorgpartner) |

Bij het toevoegen van een nieuwe uitkomst: controleer of `berekenCategorie()` de nieuwe waarde correct afvangt op basis van de bestaande logica, of voeg een expliciete check toe.
