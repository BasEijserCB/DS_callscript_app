# DS Logboek

Browsergebaseerd hulpmiddel voor het Delivery Support team van Coolblue. De tool draait als een zwevende widget bovenop DireXtion en begeleidt medewerkers door het registreren van telefonische contacten met bezorgers, klantenservice, winkels en fietsers.

**Huidige versie:** v1.12.7  
**Volledige documentatie:** zie `DS_Logboek_Projectoverzicht.md`

---

## Bestanden

| Bestand | Rol |
|---|---|
| `ds-logboek.js` | De volledige tool — UI, gespreksflow, DOM-scraping, clipboard output. Wordt geladen door de bookmarklet via GitHub raw hosting. |
| `paste-bookmarklet.js` | Leesbare broncode van de paste bookmarklet. Leest de clipboard payload en vult het DireXtion Import formulier in, inclusief sjabloon selectie. |
| `paste-bookmarklet-min.txt` | Gegenereerde output van `build.py` — de URL-geëncodeerde versie van de paste bookmarklet die je als bookmarklet URL instelt in de browser. |
| `build.py` | Buildscript. Voert syntax checks uit op beide JS bestanden en genereert `paste-bookmarklet-min.txt` met versie header. |
| `DS_Logboek_Projectoverzicht.md` | Volledige technische en praktische documentatie. Bedoeld als startpunt voor AI-tools en opvolgers. |
| `DS_Logboek_Sessie_April2026.md` | Sessielog van de ontwikkelsessie in april 2026. Beschrijft alle wijzigingen t.o.v. v1.11.27, inclusief nieuwe flow stappen, sjabloon mapping logica en DireXtion DOM eigenaardigheden. |

---

## Bouwen en deployen

Bij elke wijziging aan `ds-logboek.js` of `paste-bookmarklet.js`:

```bash
python3 build.py
git add . && git commit -m "versie X.X.X" && git push
```

Daarna in de browser op de DireXtion pagina:

```javascript
localStorage.removeItem('ds_app_prod_cache')
```

Pagina herladen — de tool laadt dan de nieuwe versie.

---

## Twee bookmarklets

De tool bestaat uit twee losse bookmarklets die elk een andere functie hebben:

**1. DS Logboek bookmarklet** — activeert de widget in DireXtion. Laadt `ds-logboek.js` via GitHub raw hosting met cache-busting. Staat opgeslagen bij de DS medewerkers in hun bladwijzerbalk.

**2. Paste bookmarklet** — gebruik je ná de tool, in het DireXtion Import formulier. Leest de clipboard payload die de tool heeft klaargezet en vult het formulier in. De URL voor deze bookmarklet staat in `paste-bookmarklet-min.txt`.

---

## Architectuur in het kort

```
DireXtion pagina
    ↓ (bookmarklet 1)
ds-logboek.js              ← gehost op GitHub, geladen via raw URL
    ↓ scrapet DOM
    ↓ begeleidt gespreksflow
    ↓ twee outputs:
    ├── Google Sheets      ← via GAS backend (logging)
    └── Clipboard JSON     ← voor paste bookmarklet
            ↓ (bookmarklet 2)
        paste-bookmarklet.js
            ↓ vult in:
        DireXtion Import formulier
            ├── Klantgegevens
            ├── Ordersjabloon
            └── Opmerking
```

---

## Belangrijke technische details

- **GAS backend deployment** moet ingesteld zijn op toegang "Iedereen" (niet "Iedereen binnen Coolblue") anders blokkeren CORS-restricties de logging fetch.
- **DireXtion heeft twee varianten** met verschillende DOM structuren: consumer portal (`coolbluebezorgt.dirextion.nl`) gebruikt Knockout.js `data-bind` selectors, Basic module (`coolblue.dirextion.nl/Basic`) gebruikt `.details-field` CSS klassen.
- **Sjabloon moet als eerste ingevuld worden** in het Import formulier — daarna pas de overige velden — anders overschrijft het sjabloon de ingevulde waarden.
- **Opmerkingenveld** in DireXtion is een Knockout observable, niet aanroepbaar via gewone DOM manipulatie. Gebruik: `$(document.querySelectorAll('.dx-form')[1]).dxForm('instance').option('formData').remark(value)`.
- **Same Day support** — voor same-day planning worden shipper (Coolblue DeliverySupport) en depot automatisch ingevuld op basis van de gebruiker-opgegeven route, zonder sjabloon selectie.
- **Telefoonnummer normalisatie** — nummers van NL, BE, DE en Polen worden gestript naar lokaal formaat (0xxxxxxxxx).
- **Paste bookmarklet melding** — toont een toast notification in de top-right hoek met de instructie om ingevulde velden te controleren.

---

*DS Logboek — Coolblue Delivery Support — intern gebruik*
