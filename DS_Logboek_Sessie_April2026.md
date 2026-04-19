# DS Logboek — Sessielog April 2026

**Versie aan begin sessie:** v1.11.27  
**Versie aan einde sessie:** v1.12.3  
**Bestanden gewijzigd:** `ds-logboek.js`, nieuw bestand `paste-bookmarklet.js`

---

## Overzicht van wijzigingen

Deze sessie had twee grote thema's:

1. **Uitbreiding van de clipboard payload** zodat de paste bookmarklet meer context heeft
2. **Nieuwe paste bookmarklet** die op basis van die context automatisch een ordersjabloon selecteert in DireXtion's Import module

---

## 1. Nieuwe clipboard payload velden

De functie `kopieerNaarKlembord()` in `ds-logboek.js` stuurt nu de volgende extra velden mee:

| Veld | Beschrijving |
|---|---|
| `product` | Effectief product na eventuele verfijning (`effectiefProduct()`) |
| `probleem` | `callData.probleem` — de geselecteerde taak |
| `dienstType` | `'Nazorg (gratis)'` of `'Extra dienst (betaald)'` — alleen aanwezig bij Next day |
| `formaatTV` | `'Ja (>= 55 inch)'` of `'Nee (< 55 inch)'` — voor TV sjabloon selectie |

---

## 2. Nieuwe flow stappen in ds-logboek.js

### 2a. Productverfijningsstap

Wanneer het product handmatig gekozen wordt als een ambigue categorie, verschijnt er direct daarna een verfijningsvraag. Dit geldt voor drie categorieën:

| Ruwe keuze | Verfijningsopties |
|---|---|
| `Koelkast / Vriezer` | Koelkast, Vriezer, Amerikaanse koelkast, Amerikaanse koelkast met waterdispenser, Side-by-side koelkast, Inbouw koelkast |
| `Vaatwasser` | Vrijstaande vaatwasser, Inbouw vaatwasser |
| `Oven / Magnetron` | Inbouw oven, Inbouw magnetron, Magnetron |

De verfijning wordt opgeslagen in `callData.productVerfijnd`. De functie `effectiefProduct()` geeft altijd de meest granulaire waarde terug.

De verfijningsstap is op 4 plekken ingevoegd in `bepaalStappen()` — direct ná elke handmatige productkeuze stap, vóór de verdere flow, met een `return s` zodat de flow stopt totdat het beantwoord is.

### 2b. DienstType stap

Na "Next day gepland" (op alle 5 plekken in de flow) verschijnt een nieuwe stap:

- **Key:** `dienstType`
- **Type:** `dienst-select` (eigen renderer)
- **Opties:** `Nazorg (gratis)` / `Extra dienst (betaald)`
- **Volgorde:** productVerfijnd (indien nodig) → dienstType → next_day_reden

De renderer toont een blauw info paneeltje: *"Nazorg is gratis en hoort bij de originele bestelling. Extra dienst brengt extra kosten met zich mee voor de klant."*

### 2c. skipDienstType()

Voor deur omdraaien bij koelkast/vriezer-types bestaat er geen Nazorg sjabloon — alleen Extra dienst. In dat geval wordt de dienstType vraag overgeslagen via de functie `skipDienstType()`. De bookmarklet gebruikt dan automatisch de Extra dienst variant.

---

## 3. Nieuwe paste bookmarklet

Het bestand `paste-bookmarklet.js` vervangt de oude paste bookmarklet volledig. De volgorde van uitvoering is bewust:

1. **Sjabloon selecteren eerst** (via `setDxDropdown('_orderTemplateId', id)`) + 800ms wachten — zodat het sjabloon geen later ingevulde velden overschrijft
2. Adres splitsen in straat + huisnummer
3. Standaard velden invullen (naam, telefoon, email, postcode, straat, huisnummer, woonplaats)
4. Land en taal instellen
5. Show on device checkbox aanvinken
6. Opmerkingenveld invullen met `product - probleem` (bijv. "Wasmachine - Plaatsen / Naar boven tillen")

### Sjabloon selectie logica

De sjabloon wordt alleen geselecteerd als `orderData.dienstType` aanwezig is (dus alleen bij Next day flows). De selectie werkt via twee normalisatiefuncties:

**`normaliseerProduct(p)`** — mapt `callData.product` naar een mapping-sleutel:
- `wasdroogcombinatie` / `wasmachine` / `droger`
- `amerikaanse koelkast met waterdispenser` / `amerikaanse koelkast` / `side-by-side koelkast` / `inbouw koelkast` / `inbouw vriezer` / `koelkast`
- `inbouw vaatwasser` / `vrijstaande vaatwasser`
- `inbouw magnetron` / `inbouw oven` / `magnetron`
- `televisie` / `soundbar` / `stapelkit`

**`normaliseerProbleem(p)`** — mapt `callData.probleem` naar een mapping-sleutel:
- `trekschakelaar` — Trekschakelaar aansluiten
- `stapelkit` — Stapelkit plaatsen
- `milieuretour` — Milieuretour / Pick-up ophalen
- `inbouwen` — Apparaat inbouwen (Keuken)
- `frontpaneel` — Frontpaneel monteren
- `deur omdraaien` — Deur omdraaien
- `plaatsen` — Plaatsen / Naar boven tillen → mapt naar "Aansluiten en plaatsen" sjablonen
- `aansluiting` — Aansluiting controleren
- `tv installeren` / `tv ophangen` / `tv + soundbar` / `tv + soundbar ophang`

De mapping tabel bevat voor NL, BE en DE per product per probleem twee IDs: `N` (Nazorg) en `E` (Extra dienst). TV sjablonen zijn gesplitst op `groot` (> 50 inch, bepaald via `formaatTV`).

### Opmerkingenveld

Het opmerkingenveld in DireXtion is een DX Form field gebonden aan een Knockout observable. Gewone DOM manipulatie werkt niet. De juiste methode:

```javascript
const remarkForms = document.querySelectorAll('.dx-form');
const formData = $(remarkForms[1]).dxForm('instance').option('formData');
formData.remark(remarkText);
```

Belangrijk: `querySelectorAll('.dx-form')[1]` — de tweede form op de pagina. De eerste form (index 0) is de eerste wizard stap, de tweede is de Order tab met het opmerkingenveld.

---

## 4. Viewport-aware hoogte (v1.12.2)

De tool past nu de hoogte dynamisch aan op basis van `window.innerHeight`:

- `maxViewportHeight()` = `window.innerHeight - 40` (20px marge boven en onder)
- `clampHeight(h)` = `Math.min(h, maxViewportHeight())`
- Bij initialisatie wordt de opgeslagen hoogte direct geclampt
- De resize-knop filtert de stappen `[620, 760, 900]` — alleen stappen die binnen het viewport passen zijn beschikbaar
- `window.addEventListener('resize')` reageert op venstergrootte-wijzigingen

---

## 5. Bugfixes

### Telefoonnummer binding (v1.12.3)

De `data-bind` selector voor het telefoonnummer was verkeerd. De correcte binding op de consumer portal is `Static.Visit.Phone`, niet `Static.Visit.PhoneNumber`. De fallback keten is nu:

```javascript
gs('Static.Visit.Phone') || gs('Static.Visit.PhoneNumber') || gs('PhoneNumber')
```

### Plaatsen/tillen mapping (paste bookmarklet)

`Plaatsen / Naar boven tillen` werd onterecht gemapped naar "Aansluiting controleren" sjablonen. Opgelost door een aparte `'plaatsen'` sleutel in `normaliseerProbleem` en de mapping tabel, die verwijst naar "Aansluiten en plaatsen" sjablonen (bijv. NL Wasmachine Nazorg → `1714165`).

---

## 6. Nieuwe callData keys

```javascript
dienstType: '',       // 'Nazorg (gratis)' | 'Extra dienst (betaald)'
productVerfijnd: ''   // verfijnd product bij ambigue handmatige keuze
```

---

## 7. Nieuwe hulpfuncties in ds-logboek.js

```javascript
getProductVerfijningOpties(product)  // geeft verfijningsopties voor ambigue producten, anders null
productNeedsVerfijning()             // true als product ambigu én nog niet verfijnd
effectiefProduct()                   // productVerfijnd || product
isNextDay()                          // true bij uitkomst Next day gepland/visit gepland of ks_uitkomst
skipDienstType()                     // true bij deur omdraaien + koelkast/vriezer-type
maxViewportHeight()                  // window.innerHeight - 40
clampHeight(h)                       // Math.min(h, maxViewportHeight())
```

---

## 8. Bekende DireXtion DOM eigenaardigheden (ontdekt deze sessie)

| Element | Hoe bereikbaar |
|---|---|
| Ordersjabloon dropdown | `setDxDropdown('_orderTemplateId', value)` via `dxSelectBox` instance |
| Opmerkingenveld | `$(querySelectorAll('.dx-form')[1]).dxForm('instance').option('formData').remark(value)` — Knockout observable |
| Telefoonnummer binding | `data-bind="text: Static.Visit.Phone"` (niet PhoneNumber) |
| Sjabloon overschrijft velden | Sjabloon altijd eerst selecteren, daarna pas andere velden invullen, met 800ms wachttijd |

---

*Sessielog DS Logboek — April 2026 — Coolblue DS-team*
