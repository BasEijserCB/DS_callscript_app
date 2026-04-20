# DS Logboek — Ontwikkelgids

Browsergebaseerde widget voor het Coolblue Delivery Support team. Draait bovenop DireXtion en begeleidt medewerkers door het registreren van telefonische contacten. Twee bookmarklets: één laadt de widget, één vult het DireXtion Import formulier in.

---

## Bestanden

| Bestand | Rol |
|---|---|
| `ds-logboek.js` | Volledige widget: UI, gespreksflow, DOM-scraping, clipboard output. Gehost op GitHub, geladen via raw URL met cache-busting. |
| `paste-bookmarklet.js` | Leesbare broncode van de paste bookmarklet. Leest clipboard JSON en vult DireXtion Import formulier in. |
| `paste-bookmarklet-min.txt` | Gegenereerde URL-geëncodeerde bookmarklet URL (regel 2). Output van `build.py`. |
| `build.py` | Minificeert `paste-bookmarklet.js` → `paste-bookmarklet-min.txt`. Detecteert versienummer automatisch. |

---

## Build & deploy

```bash
python3 build.py
git add . && git commit -m "beschrijving, bump to vX.X.X" && git push
```

Daarna cache legen in browser op DireXtion-pagina:
```javascript
localStorage.removeItem('ds_app_prod_cache')
```

**Versienummer** alleen ophogen bij wijzigingen aan `ds-logboek.js` — zonder te vragen. Patch voor bugfix, minor voor nieuwe feature.

---

## Architectuur

```
DireXtion pagina
    ↓ bookmarklet 1
ds-logboek.js  (scrapet DOM → gespreksflow → twee outputs)
    ├── Google Sheets  (via GAS backend, logging)
    └── Clipboard JSON (voor paste bookmarklet)
            ↓ bookmarklet 2
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
  probleem,           // geselecteerde taak
  dienstType,         // 'Nazorg (gratis)' | 'Extra dienst (betaald)' | ''
  formaatTV,          // 'Ja (>= 55 inch)' | 'Nee (< 55 inch)'
  uitkomst,           // bijv. 'Same day gepland'
  geplandeRoute,      // bijv. '2M-NLOV-07'
  serviceTypeId,      // numerieke service ID voor same-day TagBox
  time                // Date.now() — payload vervalt na 5 minuten
}
```

---

## Paste bookmarklet — volgorde van uitvoering

1. **Sjabloon eerst** (`_orderTemplateId`) + 800ms wacht — anders overschrijft sjabloon later ingevulde velden. Alleen bij next-day (`dienstType` aanwezig).
2. **Same-day: shipper + depot** — shipper altijd `1012729` (Coolblue DeliverySupport); depot via 4-letter routecode uit `geplandeRoute` (bijv. `NLOV` → depot ID).
3. Standaard velden: naam, telefoon, email, postcode, straat, huisnummer, woonplaats.
4. Land (`_countryId`) + 500ms wacht.
5. Taal (`_language`).
6. **Same-day: kanaal / service / netwerk** (zie hieronder).
7. Show on device checkbox.
8. Opmerkingenveld: `product - probleem`.

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

---

## ds-logboek.js — relevante functies

```javascript
effectiefProduct()              // productVerfijnd || product
skipDienstType()                // true bij deur omdraaien + koelkast/vriezer → dienstType vraag overslaan
isNextDay()                     // true bij Next day uitkomst
getProductVerfijningOpties(p)   // verfijningsopties voor ambigue producten (Koelkast/Vriezer, Vaatwasser, Oven/Magnetron)
productNeedsVerfijning()        // true als product ambigu en nog niet verfijnd
```

**serviceTypeId mapping** (in `kopieerNaarKlembord()`): bepaalt welke DireXtion service geselecteerd wordt voor same-day. Meeste services hebben één ID voor zowel Nazorg als Extra dienst (geen aparte Extra dienst variant beschikbaar). Uitzonderingen:
- `stapelkit`: Nazorg=727124, Extra dienst=727123
- Alle anderen: Nazorg-ID ook gebruikt als Extra dienst default

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
