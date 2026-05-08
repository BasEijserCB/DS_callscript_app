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

## DevExtreme widget helpers (paste-bookmarklet.js)

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
LEGACY_LABEL_ALIASES            // mapping van oude → nieuwe label-waarden; toegepast in herstelSessie() om geparkeerde sessies te migreren na hernoemen van keuze-opties
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
| `Anders` | Externe bezorgpartner (Technische Dienst / Yeply / G4S) — valt in "Andere bellers ▾" dropdown, eigen locatie-keuze | "Andere bellers ▾" → locatie-keuze |
| `Andere beller` | Beller gaat niet over een bezorging (bv. klantenservice, winkel) — submit screen toont info-box dat probleem-log niet nodig is | "Andere bellers ▾" → "Andere beller" |
| `Algemeen` | **Auto-gezet** als geen orderdata gescrapet kon worden (`isAlgemeen`) | n.v.t. — activeert aparte flow |

De "Andere bellers ▾" dropdown heette vóór v1.13.0 "Externe partner ▾".

---

## CBF flow — locatie-keuzes

Vier locaties: `'Onderweg'` (zelfde flow als CBB), `'Bij de klant'`, `'Stop aanpassen / verwijderen'`, `'Depot / Hub vraag'`.

**Bij de klant** → `cbf_pakket_reden`:
- `'Pakket niet meegenomen (manco)'` / `'Pakket verkeerd / beschadigd'` / `'Overige vraag over pakket'` → uitkomsten: `'Klant geïnformeerd, manco geregistreerd'` / `'Klant geïnformeerd, held regelt verder'` / `'Nee, geen oplossing door DS'`
- `'Pakje niet ingeladen'` → uitkomsten: `'Pakje wordt later afgeleverd (afleverbewijs)'` / `'Niet opgelost — instructie gegeven in Jerney'`. Bij "Niet opgelost" toont het submit-scherm een info-blokje met Jerney-instructie.
- `'Spullen achtergelaten bij klant'` → uitkomst-keuze: `'Same day gepland'` / `'Next day gepland'` / `'Helden lossen het zelf op (geen DS-visit gepland)'`

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

## Algemeen gesprek (geen orderdata)

Wanneer `ds-logboek.js` wordt geladen op een pagina zonder ordernummer (`!scrapedOrder`), schakelt de widget over op een kortere flow:

1. Voornaam / achternaam
2. `algemeen-blocks` stap met twee blokken:
   - **Advies gegeven** → `Ja, service uitgevoerd` / `Nee, geen oplossing door DS` (zet `advies_gelukt` + `locatie='Bij de klant'`)
   - **Afhandeling buiten DS** (afwijkend_reden) → keuzes + optioneel `afwijkend_toelichting` bij `Overig`
3. Submit

Bovenin het blok staat een oranje waarschuwing: *"Geen orderdata gevonden — log bij voorkeur altijd op een order, gebruik deze modus alleen zonder ordernummer/referentie."*

De flow slaat `bellerType` / `probleem` / `uitkomst` / adres-velden over. Logging gebeurt via `bouwLogParams()` zoals normaal, maar met beperkte data.

---

## CBB Bij de klant — bijzondere probleem-gevallen

Enkele `probleem`-waarden bij CBB `'Bij de klant'` resulteren in een directe submit zonder stop te plannen:

| Probleem | Gedrag |
|---|---|
| `'Product past niet op gewenste plek'` | Direct log, submit-scherm toont Jerney-afmelding instructie |
| `'Nazorg niet gelukt / swap aanvragen'` | Direct log, submit-scherm toont instructie om notitie te maken en swap via KS aan te vragen |
| Milieuretour Pick-up → `pick_up_status='Pick-up niet gelukt — swap nodig'` | Direct log, categorie `Geen oplossing` |

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
| `Advies gegeven` | Advies of info verstrekt zonder bezoek in te plannen: KS/Winkel geholpen, externe partners (TD/Yeply/G4S), CBF depot/pakket, Interne leveringen, geen actie nodig, visit verwijderd, algemeen gesprek afgerond |
| `Geen oplossing` | DS kon geen oplossing bieden, of klant ziet af van service. Ook: CBF stop `'Aanpassing niet mogelijk'`, pick-up `'Pick-up niet gelukt — swap nodig'` |
| `Buiten DS scope` | `locatie='Afhandeling buiten DS'` of `bellerType='Andere beller'` (beller buiten DS-context) |

Bij het toevoegen van een nieuwe uitkomst: controleer of `berekenCategorie()` de nieuwe waarde correct afvangt op basis van de bestaande logica, of voeg een expliciete check toe.
