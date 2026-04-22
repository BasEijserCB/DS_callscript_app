# DS Logboek — Ontwikkelgids

Browsergebaseerde widget voor het Coolblue Delivery Support team. Draait bovenop DireXtion en begeleidt medewerkers door het registreren van telefonische contacten. Twee bookmarklets: één laadt de widget, één vult het DireXtion Import formulier in.

---

## Bestanden

| Bestand | Rol |
|---|---|
| `ds-logboek.js` | Volledige widget: UI, gespreksflow, DOM-scraping, clipboard output. Gehost op GitHub, geladen via raw URL met cache-busting. |
| `loader-bookmarklet.js` | Leesbare broncode van de loader bookmarklet. Haalt `ds-logboek.js` op, cached in localStorage (`ds_app_prod_cache`), stale-while-revalidate met `{cache:'no-store'}` om CDN-cache te omzeilen. |
| `loader-bookmarklet-min.txt` | Gegenereerde URL-geëncodeerde loader bookmarklet URL (regel 2). Output van `build.py`. |
| `paste-bookmarklet.js` | Leesbare broncode van de paste bookmarklet. Leest clipboard JSON en vult DireXtion Import formulier in. |
| `paste-bookmarklet-min.txt` | Gegenereerde URL-geëncodeerde paste bookmarklet URL (regel 2). Output van `build.py`. |
| `install.html` | Installatiepagina. Bevat **beide** bookmarklets als sleepbare knoppen — moet altijd in sync zijn met `loader-bookmarklet-min.txt` en `paste-bookmarklet-min.txt`. |
| `build.py` | Minificeert beide bookmarklets → `*-min.txt`. Detecteert versienummer automatisch. |

---

## Build & deploy

```bash
python3 build.py
git add . && git commit -m "beschrijving, bump to vX.X.X" && git push
```

De loader bookmarklet haalt de nieuwe `ds-logboek.js` automatisch op in de achtergrond (stale-while-revalidate + `{cache:'no-store'}`). Bij de volgende klik op de bookmarklet krijg je de nieuwe versie. Cache handmatig legen is alleen nodig als fallback:
```javascript
localStorage.removeItem('ds_app_prod_cache')
```

**Versienummer** alleen ophogen bij wijzigingen aan `ds-logboek.js` — zonder te vragen. Patch voor bugfix, minor voor nieuwe feature.

**BELANGRIJK:** `install.html` moet altijd **beide** bookmarklets up-to-date bevatten. Na `python3 build.py` moet je `install.html` updaten:
- Versie in badge en footer → hoogste versie uit de min.txt bestanden (regel 1)
- Loader-bookmarklet `href` → `loader-bookmarklet-min.txt` regel 2 (volledige URL)
- Paste-bookmarklet `href` → `paste-bookmarklet-min.txt` regel 2 (volledige URL)

Controleer dat beide `href`-waarden in `install.html` exact overeenkomen met regel 2 van de bijbehorende `*-min.txt`.

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
- `coolbluebezorgt.dirextion.nl` — Knockout.js `data-bind` selectors
- `coolblue.dirextion.nl/Basic` — `.details-field` CSS klassen

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
  uitkomst,           // bijv. 'Same day gepland'
  geplandeRoute,      // bijv. '2M-NLOV-07'
  serviceTypeId,      // numerieke service ID voor same-day TagBox (51072 voor plaatsen)
  time                // Date.now() — payload vervalt na 5 minuten
}
```

---

## Paste bookmarklet — volgorde van uitvoering

1. **Sjabloon eerst** (`_orderTemplateId`) + 800ms wacht — anders overschrijft sjabloon later ingevulde velden. Alleen bij next-day (`dienstType` aanwezig).
2. **Same-day: shipper + depot** — shipper altijd `1012729` (Coolblue DeliverySupport); depot via 4-letter routecode uit `geplandeRoute` (bijv. `NLOV` → depot ID).
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

Twee varianten op basis van `serviceTypeId`:

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

```javascript
// SelectBox (dropdowns)
const setDxDropdown = (fieldId, value) => {
  const input = document.querySelector(`input[id$="${fieldId}"]`);
  const container = input?.closest('.dx-selectbox');
  const instance = $(container).dxSelectBox('instance');
  if (instance) instance.option('value', value);
};

// TagBox (multi-select, services veld)
const setDxTagBox = (fieldId, valueArray) => {
  const input = document.querySelector(`input[id$="${fieldId}"]`);
  const container = input?.closest('.dx-tagbox');
  const instance = $(container).dxTagBox('instance');
  if (instance) instance.option('value', valueArray);
};
```

**Belangrijk:** TagBox `valueExpr` is `Id` (hoofdletter, numeriek). Altijd `[parseInt(id)]` doorgeven — nooit een string.

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

---

## Console commands — DOM selectors ontdekken

Gebruik browser DevTools console op de DireXtion Import formulierpagina om selectors te testen:

```javascript
// Vind alle elementen die voldoen aan een selector
document.querySelectorAll('[data-options*="dxTemplate"][data-options*="article"]')

// Inspecteer wat er in een attribuut zit
document.querySelector('input[id$="_services"]')?.getAttribute('id')

// Test DevExtreme instance ophalen (bijv. SelectBox, TagBox, Form)
const input = document.querySelector('input[id$="_countryId"]');
const container = input?.closest('.dx-selectbox');
const instance = $(container).dxSelectBox('instance');
instance?.option('value')  // huidige waarde

// Vind de tweede form (voor remark/opmerking veld)
document.querySelectorAll('.dx-form')[1]

// Test artikel elementen klikken en hun index bepalen
const articles = document.querySelectorAll('[data-options*="dxTemplate"][data-options*="article"]');
articles[0].click();  // klik op artikel 1
articles[1].click();  // klik op artikel 2 (na add-button klik)

// Vind de add-button (voor meerdere artikelen)
document.querySelector('.dx-icon-add')?.closest('.dx-button')
```

**Workflow voor nieuwe DOM manipulatie:**
1. Open DevTools (F12), ga naar Console tab
2. Voer `document.querySelectorAll('...')` uit om elementen te vinden
3. Test selectors met verschillende attributen: `[id$="..."]`, `[data-bind*="..."]`, `[data-options*="..."]`, etc.
4. Zodra je de juiste selector hebt, test je de manipulatie: `element.click()`, `instance.option('value', x)`
5. Gebruik `await new Promise(resolve => setTimeout(resolve, 500))` voor async operaties
6. Implementeer in paste-bookmarklet.js en test met bookmarklet op echte DireXtion pagina

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
```

**`isAlgemeen`** (module-scope, gezet na scrape): `true` wanneer geen ordernummer gescrapet kon worden → activeert de Algemeen-gesprek modus (zie beneden).

**serviceTypeId mapping** (in `kopieerNaarKlembord()`): bepaalt welke DireXtion service geselecteerd wordt voor same-day. Meeste services hebben één ID voor zowel Nazorg als Extra dienst (geen aparte Extra dienst variant beschikbaar). Uitzonderingen:
- `stapelkit`: Nazorg=727124, Extra dienst=727123
- Alle anderen: Nazorg-ID ook gebruikt als Extra dienst default

---

## Gespreksflow — bellerType

Eerste keuze in de flow (`bellerType` in `callData`). Bepaalt de rest van de vragen:

| Waarde | Betekenis | Knop-ingang |
|---|---|---|
| `CBB` | Coolblue Bezorgt (eigen bezorger) | hoofdknop "CBB belt" |
| `CBF` | Coolblue Fiets | hoofdknop "CBF belt" |
| `Anders` | Externe bezorgpartner (Technische Dienst / Yeply / G4S) — valt in "Andere bellers ▾" dropdown, eigen locatie-keuze | "Andere bellers ▾" → locatie-keuze |
| `Andere beller` | Beller gaat niet over een bezorging (bv. klantenservice, winkel) — submit screen toont info-box dat probleem-log niet nodig is | "Andere bellers ▾" → "Andere beller" |
| `Algemeen` | **Auto-gezet** als geen orderdata gescrapet kon worden (`isAlgemeen`) | n.v.t. — activeert aparte flow |

De "Andere bellers ▾" dropdown heette vóór v1.13.0 "Externe partner ▾".

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

## Gespreksflow — dienstType vraag

Wordt gevraagd na:
- "Next day gepland" (alle flow-paden)
- "Same day gepland" → na `geplandeRoute` (toegevoegd v1.12.14)

Wordt **overgeslagen** (`skipDienstType()`) bij: deur omdraaien + koelkast/vriezer-types (alleen Extra dienst sjabloon beschikbaar voor die combinatie).

---

## Telefoonnummer normalisatie

Prefixen worden gestript naar lokaal formaat: NL (+31/0031), BE (+32/0032), DE (+49/0049), PL (+48/0048).

---

## Versiegeschiedenis (recent)

| Versie | Wijziging |
|---|---|
| v1.16.0 | Add: loggen opent automatisch DireXtion-order in nieuw tabblad (Same/Next day gepland). Aparte link uit controle-box verwijderd |
| v1.15.4 | Fix: leading postcode uit city-scrape strippen (BE/DE geven soms `"1000 Brussel"` als Woonplaats terug → belandde als `residence` in DireXtion) |
| v1.15.3 | Fix: DireXtion email-filter gebruikt juiste key `EmailAddress` + `StartDate`/`EndDate` op vandaag, URL pad `/Basic/Orders` (hoofdletter) |
| v1.15.2 | Update: DireXtion link op submit-scherm filtert nu op email i.p.v. ordernummer — betrouwbaarder |
| v1.15.1 | Add: derde uitkomst "Helden stellen stop uit en gaan later terug" bij onderweg_type "Klant niet thuis" |
| v1.15.0 | Add: onderweg_type "Klant niet thuis" (CBB + CBF) — uitkomsten Advies gegeven/Geen oplossing, info-box met checklist (aangebeld, klant gebeld, binnen tijdvak) + Jerney afmeldinstructie |
| v1.14.2 | Update: duplicate uitkomst-optie "Correct nummer doorgegeven aan Held" verwijderd uit onderweg flow (Klant niet bereikbaar / verkeerd nummer) |
| v1.14.1 | Fix: `parseToTourAlias` herkent nu ook `built in` / `built-in` als netwerk BI |
| v1.14.0 | Add: "Algemeen gesprek" modus — flow zonder orderdata (alleen fname/lname + advies/afhandeling-blokken), bellerType='Algemeen' |
| v1.13.2 | Add: info box op submit screen voor andere bellers |
| v1.13.1 | Update: footer versie-bump (geen functionele wijziging) |
| v1.13.0 | Update: bellerType knop "Externe partner" hernoemd naar "Andere bellers"; structuurrefactor |
| v1.12.19 | Fix: straat/woonplaats invullen 400ms uitstellen na postcode om DireXtion autocomplete-overwrite te voorkomen |
| v1.12.18 | Fix: articleTypeId+services ingesteld ná channelId (STAP 1c Fase 2) — voorkomt dat herrender velden wist |
| v1.12.17 | Fix: article rij klikken ook voor 1e product (niet alleen 2e+) om DX velden te activeren |
| v1.12.16 | Add: meerdere producten ondersteuning voor plaatsen service (product_keuze → products array) |
| v1.12.15 | Fix: plaatsen Extra dienst mapping teruggedraaid naar Nazorg default (51072) |
| v1.12.14 | Add: dienstType vraag in same-day flow; serviceTypeId stapelkit N/E onderscheid |
| v1.12.13 | Fix: volgorde kanaal/service/netwerk hersteld; builtInServices branch terug |
| v1.12.12 | Fix: TagBox value als parseInt i.p.v. string; setDxTagBox vereenvoudigd |
| v1.12.11 | Fix: setDxTagBox via dxComponents walk-up; same-day kanaal/service/netwerk flow |
| v1.12.9 | Fix: telefoonnummer cleanup generiek voor elk landprefixformaat |
| v1.12.8 | Add: kanaal/netwerk/service autofill uitgebreid voor same-day |
| v1.12.7 | Update: toast melding top-right, groter |
| v1.12.6 | Add: toast notification in paste bookmarklet; build.py opruiming |
| v1.12.5 | Add: same-day ondersteuning (shipper + depot autofill) |
