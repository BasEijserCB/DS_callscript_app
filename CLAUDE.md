# DS Logboek — Ontwikkelgids

Browsergebaseerde widget voor het Coolblue Delivery Support team. Draait bovenop DireXtion en begeleidt medewerkers door het registreren van telefonische contacten. Twee bookmarklets: één laadt de widget, één vult het DireXtion Import formulier in.

---

## Bestanden

| Bestand | Rol |
|---|---|
| `ds-logboek.js` | Volledige widget: UI, gespreksflow, DOM-scraping, clipboard output. Gehost op GitHub, geladen via raw URL met cache-busting. |
| `loader-bookmarklet.js` | Leesbare broncode van de loader bookmarklet. Haalt `ds-logboek.js` op, cached in localStorage (`ds_app_prod_cache`), stale-while-revalidate met `{cache:'no-store'}` om CDN-cache te omzeilen. |
| `paste-bookmarklet.js` | Volledige paste logica. Bevat `PASTE_VERSION` constante. Gehost op GitHub, geladen via raw URL door de paste loader. |
| `paste-loader-bookmarklet.js` | Leesbare broncode van de paste bookmarklet loader. Haalt `paste-bookmarklet.js` op, cached in localStorage (`ds_paste_prod_cache`), stale-while-revalidate. Toont oranje toast als nieuwe versie gedownload is. |
| `install.html` | Installatiepagina voor de widget: de loader- en paste-bookmarklet als sleepbare knoppen, plus een doorverwijzing naar de installatiepagina van de Extra rijtijd-tool. |
| `build.py` | Syntax-checkt `ds-logboek.js` en `paste-bookmarklet.js`, detecteert versienummer uit `ds-logboek.js` en synchroniseert `PASTE_VERSION` in `paste-bookmarklet.js`. |
| `gas-backend.js` | Broncode van het Google Apps Script backend (`doGet`). Schrijft elke log-entry als rij naar de actieve Google Sheet. Moet handmatig gekopieerd worden naar de GAS editor bij wijzigingen — een commit hier verandert niets in productie. |
| `tourtool/extra-rijtijd.js` | **Losse tool**, geen onderdeel van de widget. Draait op de Ritmonitor en berekent wat een extra stop aan rijtijd kost, per gat en over meerdere ritten. Eigen `RIJTIJD_VERSION`, los van de widgetversie. Zie "Extra rijtijd-tool". |
| `tourtool/install-rijtijd.html` | Eigen installatiepagina voor de Extra rijtijd-tool: bookmarklet, instructie voor een eigen ORS-sleutel, gebruik en de regels die de tool zelf toepast. Bewust los van `install.html` — die gaat over de widget. Beide pagina's verwijzen naar elkaar en delen hetzelfde style-blok (gekopieerd, niet gedeeld). |
| `tourtool/loader-rijtijd-bookmarklet.js` | Leesbare broncode van de loader voor de Extra rijtijd-tool. Eigen cache key (`ds_rijtijd_prod_cache`), groene toast, versie uit `RIJTIJD_VERSION`. Zelfde stale-while-revalidate als de andere twee. |
| `tourtool/probe-ritmonitor.js` | Eenmalige recon van de Ritmonitor (frameworks, DOM, netwerk, viewmodels). Alleen lezen; bewaard als naslag voor als DireXtion verandert. |

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

`build.py` vergelijkt daarnaast het gedeelde stijlblok `DS_UI` in `ds-logboek.js` en `tourtool/extra-rijtijd.js` en stopt met exitcode 1 als de twee kopieën uiteengelopen zijn — zie **Gedeelde stijl**. Hij syntax-checkt ook `tourtool/extra-rijtijd.js`, maar synchroniseert `RIJTIJD_VERSION` bewust **niet**: die tool heeft een eigen levenscyclus. Hoog hem met de hand op bij elke wijziging, anders ziet niemand de updatetoast.

**Versienummer** alleen ophogen bij wijzigingen aan `ds-logboek.js` — zonder te vragen. Patch voor bugfix, minor voor nieuwe feature. `build.py` synchroniseert `PASTE_VERSION` in `paste-bookmarklet.js` automatisch naar hetzelfde versienummer.

---

## Versiegeschiedenis

Nieuwste bovenaan. Alleen `ds-logboek.js` versies (productie).

Tot en met v1.38.0 bestond er een parallelle staging build (`staging/ds-logboek-staging.js`, React+Babel side-panel) waarin elke functionele wijziging werd meegenomen. Dat experiment is op 02-09-2026 gestaakt en de map is verwijderd; de vermeldingen "ook in staging" zijn uit de regels hieronder gehaald. Terug te vinden in de git-historie tot commit `d96fd0d`.

| Versie | Wijziging |
|---|---|
| v1.41.2 | Update: de bevestiging onder "Adres klaarzetten voor reistijd-check" zei "open de Ritmonitor en klik Bereken". Dat klopte niet meer sinds `tourtool/extra-rijtijd.js` v1.4.0 het adres niet meer automatisch invult; de tekst verwijst nu naar de knop "Adres uit DS Logboek". Alleen een meldingstekst. |
| v1.41.1 | Fix: de knopvarianten in de "Anders"-lijst waren hun kleur kwijt na v1.41.0. `.advies-btn` (oranje), `.advies-knop` (bleekgroen) en `.afwijkend-knop` (bleekgeel) hebben dezelfde specificiteit als `.ux-btn`, dus de volgorde bepaalt wie wint — en het style-blok zette `DS_WIDGET` vóór `DS_UI`, waardoor de gedeelde `.ux-btn` ze alle drie overschreef en elke knop weer blauw werd. Nu `DS_UI.join('') + DS_WIDGET.join('')`: eerst de gedeelde basis, daarna de widget-eigen varianten. |
| v1.41.0 | Refactor (alleen vormgeving): het style-blok is gesplitst in `DS_UI` (42 regels die letterlijk ook in `tourtool/extra-rijtijd.js` staan) en `DS_WIDGET` (14 widget-eigen regels). Daarmee delen de widget en de Extra rijtijd-tool hun knoppen, velden, meldingsblokken en kleuren; `build.py` faalt als de twee kopieën uiteenlopen. Verder: paneelbreedte 340 → 360px (gelijk aan het rijtijd-paneel), de twee formaatknoppen in de kop gebruiken `.toggle-btn` in plaats van de verwijderde `.resize-btn`, de versiestrip onderaan is `.version-bar`, en losse inline kleuren (`#666`, `#888`, `#E63946`, `#C1121F`, `#FFE6E6`, `#FFD54F`, `#5D4037`, `#E0E0E0`, `#D50000`, `#008a00`) zijn op tokens gezet. De Fornuis/Kookplaat-melding gebruikt nu `.warning-box`, het "vermeld altijd"-blokje `.park-melding`. Geen flow-, log- of vocabulairewijziging. |
| v1.40.1 | Fix: het reistijd-verzoek stuurde `callData.probleem` ongewijzigd mee — het flow-label, niet de kolom J-waarde. `'Milieuretour / Pick-up ophalen'` matchte daardoor niets in de tabel `TAKEN` van `tourtool/extra-rijtijd.js` (die op het vocabulaire gesleuteld is), en servicetijd én netwerken bleven leeg. `bouwReistijdVerzoek()` draait het label nu door `taakNaarVocab()`, dezelfde normalisatie die `bouwLogParams()` voor kolom J gebruikt. |
| v1.40.0 | Add: `formaatTV` in het reistijd-verzoek. Bij TV-taken bepaalt het formaat welk netwerk het werk mag doen — vanaf 55 inch alleen BI, daaronder 1X of BI — en dat onderscheid kon `tourtool/extra-rijtijd.js` niet maken zonder dit veld. Alleen een extra veld in `bouwReistijdVerzoek()`. |
| v1.39.0 | Add: `route` (de rit van de klant zelf) in het reistijd-verzoek, zodat `tourtool/extra-rijtijd.js` die rit als kandidaat kan uitsluiten én uit het netwerkprefix kan afleiden welke andere netwerken het werk aankunnen. Alleen een extra veld in `bouwReistijdVerzoek()`; geen flow-, log- of vocabulairewijziging. |
| v1.38.0 | Add: knop **"Adres klaarzetten voor reistijd-check"** onder elke uitkomstvraag waar `Same day gepland` / `Next day gepland` (of de visit-varianten) een optie is. Publiceert adres + taak naar `localStorage['ds_reistijd_verzoek']` én het klembord, zodat `tourtool/extra-rijtijd.js` op de Ritmonitor weet welk adres het moet doorrekenen. Bewust vóór het loggen: de same day / next day keuze hangt juist af van die uitslag, dus de klembord-payload van `kopieerNaarKlembord()` bestaat op dat moment nog niet. Eén hook in de renderer (`renderReistijdKnop`, aangeroepen naast `renderAndersSection`) dekt alle zeven uitkomstschermen. `kopieerNaarKlembord()` is niet aangeraakt — de adresscrape is bewust gedupliceerd in `scrapeAdresVoorReistijd()` om het kritieke pad van de paste-bookmarklet met rust te laten. |
| v1.37.0 | Add: extra reden bij "Waarom niet same day?" (`next_day_reden`, kolom L): `'Playbook VT/route nog de weg op'`. Alleen een nieuwe waarde in de lijst `nextDayRedenen`; geen flow-, categorie- of vocabulairewijziging. |
| v1.36.0 | **Terugdraai van v1.34.0–v1.35.1.** De ontvangstbevestiging schreef elke logregel vier keer weg. `schrijfMetRetry()` controleerde de geschreven rij door kolom A en B terug te lezen met `getDisplayValues()` en te vergelijken met de weggeschreven strings — maar de sheet formatteert die cellen zelf, dus de vergelijking faalde altijd. Elke poging deed een eigen `appendRow`: vier rijen per gesprek, daarna een `Error` naar de client, die de regel in de buffer hield en bij elke widget-start opnieuw aanbood. Logging is terug op `fetch(...).catch(function(){})`, zonder buffer, zonder melding, zonder id. `gas-backend.js` is terug op de versie zonder retry, lock, ontdubbeling en foutenlogboek — **handmatig terugzetten in de GAS-editor is nodig**, een commit hier verandert niets in productie. |
| v1.35.1 | Fix: geslaagde herverzending is nu stil (alleen console). Wie de pagina sluit vlak na het loggen krijgt de bevestiging niet meer binnen; die regel wordt een sessie later alsnog bevestigd, en een ↻/✓-melding daarover zou dagelijkse ruis worden. Fix (backend): ontdubbeling verplaatst naar binnen de scriptlock — daarbuiten konden twee gelijktijdige herverzendingen van dezelfde id allebei een rij schrijven. |
| v1.35.0 | Fix: bevestiging werkte in de praktijk niet. `fetch` krijgt de output van een Apps Script web-app niet terug — de redirect naar `googleusercontent.com` vereist de sessiecookie, die cross-origin niet meegaat, en geeft anders een 404. De rij werd dus geschreven terwijl de client een fout meldde. Verzenden gaat nu via een `<script>`-tag (JSONP); `doGet` geeft JavaScript terug bij een `callback`-parameter. URL omgezet naar de anonieme vorm `macros/s/<ID>/exec`. Herhaalde waarschuwingen bundelen in één melding met teller. |
| v1.34.0 | Add: **logging met ontvangstbevestiging**. Elke logregel wordt eerst in `localStorage` (`ds_log_buffer`) vastgelegd en pas verwijderd als de backend bevestigt dat de rij geschreven én teruggelezen is. Zonder bevestiging blijft de regel staan, krijgt de medewerker een rode melding, en wordt hij bij de volgende widget-start opnieuw aangeboden (`DSLog.verwerkBuffer()`). De backend ontdubbelt op log-id via `CacheService` (6 uur), dus herverzending geeft geen dubbele rijen. Vervangt `fetch(...).catch(function(){})` — de constructie die het verlies van aug. 2026 onzichtbaar hield. |
| v1.33.1 | Rename: probleemcategorie (kolom AA) `'Taak bij de klant'` → `'Nazorg nodig'`. Alleen de groepsnaam in `PROBLEEM_CATEGORIEEN`; de 14 waarden in de groep en alle kolom J-waarden zijn ongewijzigd. Let op: `'Nazorg nodig'` komt daarmee ook voor in kolom Z (ingang, via `INGANG_MAP`) — zelfde term, andere betekenis: AA = wat voor werk het was, Z = hoe het belletje binnenkwam. Ook in `mapping-kolom-J.tsv` (52 regels). |
| v1.33.0 | Add: **kolom AA `probleemCategorie`** — de groep waartoe de kolom J-waarde behoort (`Taak bij de klant` / `Probleem bij de klant` / `Onderweg` / `Pakket` / `Depot / hub` / `Planning / administratie` / `Overig`). `PROBLEEM_VOCAB` is vervangen door `PROBLEEM_CATEGORIEEN` (groep → waarden); de platte lijst en de opzoektabel `PROBLEEM_CAT_VAN` worden daaruit afgeleid, zodat waarde en categorie niet uit elkaar kunnen lopen. Kolom U heet in de sheet voortaan **Oplossing categorie** (was: Categorie) — alleen een kopwijziging, de waarden en `berekenCategorie()` zijn ongewijzigd. `mapping-kolom-J.tsv` heeft een kolom C met de probleemcategorie. |
| v1.32.0 | Refactor (log-output, geen flow-wijziging): kolom J bevat voortaan uitsluitend **wat** er moest gebeuren, uit een gesloten vocabulaire van 44 waarden (`PROBLEEM_VOCAB`). Beller-/contextprefixen (`Onderweg:`, `KS:`, `Winkel:`), `ks_reden`-prefixen (`Nazorg nodig — `, `KS vraagt om held terug te sturen — `), uitkomst-suffixen en vrije tekst zijn uit J verwijderd. Twee nieuwe kolommen: **Y `locatie`** (Onderweg / Bij de klant / Depot / hub / Stop aanpassen / Buiten DS) en **Z `ingang`** (`ks_reden` / `tl_reden` genormaliseerd). Vrije tekst en losse details (depot/hub-toelichting, partnernaam, `product_mee_terug`, `intern_reden`) gaan nu naar kolom S, ` \| `-gescheiden. Milieuretour en Pick-up zijn twee aparte J-waarden; de vier TV-varianten blijven bestaan. `mapping-kolom-J.tsv` mapt de 161 historische labels naar de nieuwe 44. |
| v1.31.0 | Add: `'Schade / Defect'` is geen planbaar probleem meer. Bij CBB "Bij de klant" wordt voor schade géén same day/next day uitkomst meer gevraagd; uitkomst auto-gevuld `'Schade — advies gegeven'`, categorie `Advies gegeven`, dsWaarde `'Schade gemeld — klant geadviseerd (korting of nieuw product, held meldt in Jerney)'`. Submit-scherm toont info-blokje (klant kiest korting of nieuw product, bezorger geeft door in Jerney). Add: twee manieren om de automatische apparaatdetectie te overrulen — (1) productchip is klikbaar (`resetProductDetectie()`) en stuurt de gebruiker door de handmatige apparaatkeuze; (2) per taak-sectie een "Meer taken (filter negeren)"-toggle die de door type-filtering weggelaten taken alsnog toont. Fix (paste-bookmarklet): deur omdraaien + koelkast/vriezer next-day pakte geen sjabloon omdat `skipDienstType` de `dienstType` leeglaat en het sjabloon-blok `dienstType` vereiste; nu valt deur omdraaien zonder dienstType terug op het Extra dienst-sjabloon. |
| v1.30.4 | Fix: same-day "Deur omdraaien" service werd gewist bij terugzetten netwerk → 2Mans. Deur-omdraaien Extra-dienst services (`247513`/`301445`) bestaan alleen onder netwerk Coolblue Built-in (132137); paste-bookmarklet laat na kanaal-reset naar 2Mans het netwerk nu op Built-in staan (skip `netwerk → 12`) voor deze services. Wijziging alleen in `paste-bookmarklet.js`. |
| v1.30.3 | Fix: same-day "Deur omdraaien" selecteerde verkeerde service `51068` ("(Nazorg) - apparaat waterpas zetten"). Deur omdraaien heeft geen nazorg-variant; nu `247513` ("(Extra dienst) - deur omdraaien") of `301445` ("(Extra dienst) - deur omdraaien koel-vriescombinatie") bij koel-vries combo. `builtInServices` in paste-bookmarklet bijgewerkt. |
| v1.30.0 | Fix: "Blijverkoop vergeten" springt direct naar logging — geen uitkomstvraag meer. Held registreert administratie en gaat door; geen visit nodig. Uitkomst auto-gevuld als `'Administratie afgehandeld'`, dsWaarde altijd `'Blijverkoop vergeten — administratie afgehandeld'`, categorie `Advies gegeven`. Info-blokje op submit-scherm. |
| v1.29.0 | Refactor: Beller-kolom (P) in Google Sheets log beperkt tot vier waarden: `CBB`, `CBF`, `Klantenservice`, `Overig`. Winkel, Teamleider, Interne leveringen, Technische Dienst, Yeply, G4S en Andere beller worden allemaal als `Overig` gelogd — minder datapunten, simpelere analyse. |
| v1.28.0 | Add: CBF "Pakket niet meegenomen / niet ingeladen" extra uitkomst `'Product is al afgeleverd'`. Fix: `'KS:'` en `'Winkel:'` prefixes uit probleem-kolom verwijderd (beller-kolom maakt onderscheid al — voorkomt dubbele data). |
| v1.27.1 | Fix: bevestiging bij naam wijzigen is nu inline in de widget (Ja/Nee in footer) i.p.v. browser `confirm()` popup. |
| v1.27.0 | Add: subtiel pencil-icoontje (✎) naast naam in footer — gebruiker kan opgeslagen naam wijzigen (clear `ds_fname`/`ds_lname` + flow stelt vraag opnieuw). |
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

### Logging — fire-and-forget (stand na v1.36.0)

De client stuurt elke logregel met `fetch(GAS_URL + bouwLogParams()).catch(function(){})` en kijkt niet naar het antwoord. Dat is bewust weer de huidige situatie, niet een vergetelheid: de poging om er ontvangstbevestiging omheen te bouwen (v1.34.0–v1.35.1) is op 14-08-2026 teruggedraaid omdat hij vier rijen per gesprek schreef.

**Wat er misging, voor wie het opnieuw wil proberen.** De backend controleerde na `appendRow` of de rij er echt stond door kolom A en B terug te lezen met `getDisplayValues()` en te vergelijken met de weggeschreven datum- en tijdstring. De sheet formatteert die cellen zelf, dus de teruggelezen weergave kwam nooit exact overeen. Elke poging gold daardoor als mislukt, de retry-lus deed vier keer `appendRow` — vier identieke rijen — en gaf daarna `Error` terug. De client hield de regel dan in `localStorage['ds_log_buffer']` en bood hem bij elke widget-start opnieuw aan, wat er telkens vier bij deed. De ontdubbeling op log-id kwam niet aan bod: die zag alleen herhalingen, niet de vermenigvuldiging binnen één aanroep.

De les is niet dat bevestiging onmogelijk is, maar dat de terugleescontrole op geformatteerde cellen moest vergelijken op ruwe waarden (`getValues()`), of simpelweg op het rijnummer dat `appendRow` oplevert. En dat een retry-lus rond een niet-idempotente `appendRow` de schade vermenigvuldigt in plaats van hem te herstellen: eerst controleren óf er iets geschreven is, dan pas opnieuw schrijven.

**Restanten in het veld.** De sleutel `ds_log_buffer` staat nog in de localStorage van iedereen die met v1.34.0–v1.35.1 gewerkt heeft. De huidige code leest hem niet — dode data, ruimt zichzelf niet op. Wie nog een gecachete v1.35.1 in `ds_app_prod_cache` heeft, draait die bij de eerstvolgende klik nog één keer (stale-while-revalidate) en kan dan nog één ronde duplicaten produceren; de klik daarna is schoon.

### Incident 10/11-08-2026 — oorzaak niet gevonden (gesloten)

Tussen **10-08 13:58** (laatste geschreven rij) en **11-08 10:39** (eerste rij erna) is 21 uur lang geen enkele regel in de sheet beland, terwijl de web-app in die periode gewoon executies draaide — alle op "Voltooid". Grofweg 40 à 50 gesprekken zijn verloren. Wat onderzocht en uitgesloten is:

- **Verkeerd tabblad.** Uitgesloten: versiegeschiedenis zit op bestandsniveau, en het bestand kreeg in dat venster geen enkele wijziging. Het verborgen tabblad `Data fietsbelletjes` bevat geen logregels; het rijverschil met de export van 04-08 was toeval.
- **Weergaveprobleem (filter op kolom X).** Uitgesloten door de rijen langs de UI heen te tellen: 11-08 heeft 29 rijen, allemaal vanaf 10:39.
- **Cellimiet, beveiligde reeksen, te weinig kolommen in het grid.** Alle drie uitgesloten. Doorslaggevend: een kopie van de versie van 10-08 14:15 — exact de kapotte toestand — accepteert een `appendRow` van 27 waarden zonder problemen (29 kolommen, grid ruim voldoende).
- **Code- of deploywijziging.** Uitgesloten: alle executies draaiden op Versie 28, ook de geslaagde ervoor en erna.

Wat overblijft is iets in de omgeving — autorisatie, quota, of een serverstatus van het document — dat geen spoor in het bestand achterlaat. De `catch` in `doGet` schreef destijds wel `console.error`, maar die logs waren niet meer in te zien. Zonder foutmelding was verder zoeken gokken, en de zoektocht is bewust gestaakt ten gunste van de garanties hierboven.

**Leerpunt voor volgende keer:** de status in de Apps Script-executielijst zegt niets. Een `doGet` die zijn eigen exception afvangt en netjes returnt, staat daar op "Voltooid". Wie hier opnieuw naar kijkt, heeft dus eerst een expliciete `console.log`/`console.error` per uitvoering nodig — dát is het signaal, niet de statuskolom.

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
| J | probleem | taak / klacht — **gesloten vocabulaire**, zie `PROBLEEM_VOCAB` |
| K | redenGeenOplossing | waarom geen opl? |
| L | redenNextDay | waarom next day? |
| M | orderOplossing | ordernummer-DS |
| N | geplandeRoute | nieuwe route |
| O | dsWaarde | DS waarde (uitkomst) |
| P | bellerType | wie belde er? |
| Q | tijdvak | gecommuniceerd tijdvak |
| R | aankomsttijd | aankomsttijd |
| S | extra_info | vrije tekst en losse details, ` \| `-gescheiden (afwijkend-toelichting, depot/hub-toelichting, partnernaam, product mee terug, intern_reden) |
| T | extra_dienst | extra dienst nodig? (Ja / leeg) |
| U | categorie | **oplossing categorie** — hoe het afliep (zie `berekenCategorie()`) |
| V | tijdBlok | uurblok, bijv. `"08:00 - 08:59"` (server-side berekend) |
| W | weeknummer | ISO-weeknummer van de logdatum, integer (server-side via `isoWeekNumber()`) |
| X | laatste5Weken | live `=AND(...)`-formule: `TRUE`/`FALSE` of logdatum binnen de laatste 5 voltooide weken valt; logdatum als `DATE(y,m,d)` ingebed, `TODAY()` blijft live (herberekent dagelijks) |
| Y | locatie | waar het speelde: `Onderweg` / `Bij de klant` / `Depot / hub` / `Stop aanpassen` / `Buiten DS` / leeg |
| Z | ingang | reden van het belletje bij KS/Winkel/Teamleider (`ks_reden` / `tl_reden` via `INGANG_MAP`), anders leeg |
| AA | probleemCategorie | **probleem categorie** — de groep van kolom J (zie `PROBLEEM_CATEGORIEEN`) |

**Twee categoriekolommen, twee vragen.** Kolom U (`Oplossing categorie`) zegt *hoe het afliep*, kolom AA (`Probleem categorie`) zegt *waar het over ging*. Ze zijn onafhankelijk: een `Nazorg nodig` kan `Same day gepland` of `Geen oplossing` worden. De kruising AA × U is de kernanalyse.

**Let op — `Nazorg nodig` staat in twee kolommen met verschillende betekenis:** in Z (ingang) betekent het dat KS/Winkel mét een nazorgverzoek belde, in AA (probleemcategorie) dat het nazorgwerk betrof. In draaitabellen botsen ze niet, maar bouw je een rapport waarin beide voorkomen, benoem ze dan expliciet.

### Kolom J — gesloten vocabulaire (v1.32.0, gegroepeerd v1.33.0)

Kolom J beantwoordt uitsluitend de vraag **wat moest er gebeuren**. De andere dimensies staan elders: wie belde in P, waar het speelde in Y, de ingang van het belletje in Z, de afloop in O + U, de probleemgroep in AA, vrije tekst in S. `bouwLogParams()` plakt die dimensies dus nooit meer aan elkaar.

`PROBLEEM_CATEGORIEEN` (44 waarden in zeven groepen) is de bron. `PROBLEEM_VOCAB` (platte lijst) en `PROBLEEM_CAT_VAN` (waarde → groep) worden eruit afgeleid — één plek onderhouden dus.

| Groep = kolom AA | Waarden = kolom J |
|---|---|
| Nazorg nodig | Plaatsen / Naar boven tillen · Aansluiting controleren · Trekschakelaar aansluiten · Apparaat inbouwen (Keuken) · Deur omdraaien · Stapelkit plaatsen · TV installeren · TV ophangen en installeren · TV + Soundbar installeren · TV + Soundbar ophangen en installeren · Milieuretour ophalen · Pick-up ophalen · Spullen achtergelaten bij klant · Blijverkoop vergeten |
| Probleem bij de klant | Schade / Defect · Service niet uitvoerbaar · Product past niet op gewenste plek · Product niet aanwezig · Verkeerd gelabeld product · Onverwacht retour · Milieuretour past niet in bus · Nazorg niet gelukt / swap aanvragen |
| Onderweg | Adres niet gevonden / niet bereikbaar · Adres klopt niet · Klant niet bereikbaar / verkeerd nummer · Klant niet thuis · Vraag over service |
| Pakket | Pakket niet meegenomen / niet ingeladen · Pakket verkeerd / beschadigd · Overige vraag over pakket |
| Depot / hub | Depot/hub: ziekmelding · alarm of sleutelkastje · voertuig kapot of incident · waar is de vracht · overige vraag |
| Planning / administratie | Stop / tijdslot aanpassen · Adres of telefoonnummer doorgeven aan held · Held terugsturen (taak niet gespecificeerd) |
| Overig | Vraag / advies · Interne levering · Externe partner · Buiten DS: held regelt met TL · Buiten DS: klant doorverwezen naar KS · Buiten DS: overig |

**Bij het toevoegen van een nieuwe taak of klacht aan de flow: zet 'm ook in `PROBLEEM_CATEGORIEEN`, in de juiste groep**. Twee vangnetten maken het zichtbaar als dat vergeten wordt: `taakNaarVocab()` geeft onbekende waarden ongewijzigd door (er verschijnt een niet-vocabulaire waarde in kolom J) en `probleemCategorie()` geeft dan een lege kolom AA.

Helperfuncties in `bouwLogParams()`-blok: `taakNaarVocab()` (callData.probleem → J), `depotVraagNaarVocab()` (`cbf_depot_reden` + `cbb_hub_reden` → één gedeelde depot/hub-familie), `ingangNaarVocab()` (`INGANG_MAP`, → kolom Z), `probleemCategorie()` (J → kolom AA).

**De sheet is eenmalig gemigreerd (2026-08-04).** De 3.429 historische rijen zijn via een tijdelijk mapping- en analysetabblad omgezet en daarna als platte waarden over kolom J en AA heen geplakt; beide hulptabbladen zijn verwijderd. In het tabblad Database staan dus geen formules — dat moet zo blijven, want Sheets telt een cel met een formule (ook als die `""` teruggeeft) als gevuld, en `appendRow` schrijft na de laatste gevulde rij. Zet analyse-formules altijd in een apart tabblad.

`mapping-kolom-J.tsv` blijft in de repo als naslag: kolom A oud label, B genormaliseerd, C probleemcategorie, D aantal rijen in de export. De onderste 20 regels zijn identiteitsregels (telling 0) voor vocabulaire-waarden die niet als historisch label voorkwamen. Nodig als er ooit een oude backup teruggezet wordt of pre-v1.32.0 data geïmporteerd moet worden.

### Openstaand: de `Vraag / advies`-bucket (~25% van alle rijen)

Na de normalisatie is `Vraag / advies` met afstand de grootste waarde in kolom J: 866 van 3.429 historische rijen (25,3%), en dat blijft zo voor nieuwe rijen. Die rijen zeggen niets over het onderwerp van het gesprek.

Dit is **geen labelprobleem maar een meetprobleem**, en samenvoegen lost het niet op. De oorzaak zit in de flow: de probleemstap heeft onder "Andere opties ▾" een knop `Advies gegeven`, en dat is een *uitkomst*, geen probleem. Wie die kiest, legt nooit vast waar het gesprek over ging. Bronnen die erin samenkomen: `probleem='Advies gegeven'` (CBB), `ks_reden='Advies gegeven aan KS'`/`'aan Winkel'`, `tl_reden='Andere vraag'`, en de KS/Winkel-ingangen `'Informatie over vracht'` en `'Witgoed Demo Wissel'`.

Wat er inmiddels wél mee kan: kolom Y splitst de groep naar `Onderweg` / `Bij de klant` / leeg, en kolom Z naar de KS-ingang. Voor echt inzicht is een flowwijziging nodig — bijvoorbeeld een korte onderwerpvraag na `Advies gegeven`. Dat kost een extra klik voor de medewerker en is bewust nog niet gedaan; de opdracht in aug. 2026 was uitdrukkelijk alleen de log-output, zonder de frontend te raken.

`Vraag over service` (331 rijen, 9,7%) is bewust géén onderdeel van deze bucket: dat is een expliciete keuze in de onderweg-flow, geen escape-knop, en staat als eigen waarde in de groep `Onderweg`.

---

## Gedeelde stijl — `DS_UI` in twee bestanden

`ds-logboek.js` en `tourtool/extra-rijtijd.js` zien er hetzelfde uit omdat ze allebei dezelfde lijst met CSS-regels bevatten, teken voor teken gelijk:

```javascript
var DS_UI = [
  '.header{...}',
  '.ux-btn{...}',
  ...
];
```

**Waarom gekopieerd en niet gedeeld.** Beide bestanden worden los van elkaar door een eigen bookmarklet uit GitHub gehaald en met `eval` uitgevoerd. Er is geen bundler, geen module, geen derde bestand dat allebei kunnen laden — een import zou een extra netwerkverzoek en een extra faalpunt zijn in code die op andermans pagina draait. Kopiëren is hier de eenvoudigste werkende oplossing; de prijs is dat kopieën uit elkaar lopen.

**Daarom bewaakt `build.py` het.** Stap 1b knipt het `DS_UI`-blok uit beide bestanden en vergelijkt ze. Lopen ze uiteen, dan drukt hij een unified diff af en stopt met exitcode 1. Dat is de enige plek waar dit opgemerkt kan worden, dus draai `build.py` vóór elke push.

**Twee toepassingen, één verschil.** De widget rendert in een eigen iframe-document en gebruikt de regels kaal:

```javascript
idoc.head.innerHTML = '<style>' + DS_WIDGET.join('') + DS_UI.join('') + '</style>';
```

Het rijtijd-paneel hangt in de DireXtion-pagina zelf, dus daar moet elke regel gescopet worden — anders herstijlt `label{...}` de hele Ritmonitor:

```javascript
var css = DS_UI.map(function (regel) {
  return '#' + PANEL_ID + ' ' + regel;
}).join('') + DS_PANEEL.join('');
```

Gevolg voor die scoping: **regels in `DS_UI` mogen geen `#id` of `@media` bevatten**, want daar gaat het voorzetten van een prefix mis. Alles wat een id nodig heeft hoort in `DS_WIDGET` of `DS_PANEEL`.

**Bij het toevoegen van een onderdeel:** hoort het bij allebei, zet het in `DS_UI` van beide bestanden. Hoort het bij één, zet het in `DS_WIDGET` of `DS_PANEEL` — en in dat laatste geval mét de `'#' + PANEL_ID + ' '`-prefix, die wordt daar niet automatisch gezet.

**Het palet.** Elke kleur in `tourtool/extra-rijtijd.js` komt ook voor in `ds-logboek.js`; dat is te controleren met

```bash
comm -23 <(grep -oE '#[0-9a-fA-F]{6}' tourtool/extra-rijtijd.js | sort -u) \
         <(grep -oE '#[0-9a-fA-F]{6}' ds-logboek.js | sort -u)
```

Die regel hoort niets op te leveren. De widget heeft nog wel eigen tinten die de tool niet kent: de oranje `.advies-btn` (`#fff3eb` / `#ffe8d6` / `#cc5200`) en de bleke `.advies-knop` / `.afwijkend-knop` (`#F0FFF0` / `#b2dfb2`, `#FFFFF0` / `#e0e0a0`). Die staan bewust apart — met de tokengroenen en -gelen zouden ze niet meer te onderscheiden zijn van `.ux-btn.selected`.

**Let op de volgorde.** Deze varianten hebben dezelfde specificiteit als `.ux-btn` (één klasse), dus wint wie later staat. De widget zet daarom `DS_UI` eerst en `DS_WIDGET` erna; andersom overschrijft de gedeelde `.ux-btn` hun kleur en wordt elke knop in de "Anders"-lijst weer blauw. In de rijtijd-tool speelt dit niet: de regels in `DS_PANEEL` dragen een `#id` en winnen sowieso.

| Rol | Token |
|---|---|
| Accent / primaire knop | `#0090e3`, hover `#007bc4` |
| Donkerblauwe tekst (koppen, ritnaam) | `#285dab` |
| Blauw vlak / rand | `#F2F7FC` / `#cce9f9` |
| Neutrale rand · gedempt · tekst | `#DDDDDD` · `#999999` · `#333333` |
| Groen (tekst · vlak · rand) | `#155724` · `#d4edda` · `#00B900` |
| Rood (tekst en rand · vlak) | `#E50000` · `#fff0f0` |
| Amber (tekst · vlak · rand) | `#856404` · `#fff8e1` · `#ffc107` |
| Oranje (accentknop, ster) | `#ff6600` |
| Grijs vlak (versiestrip, chip) | `#F3F3F3` |
| Type | 17/700 kop · 14/600 vraag · 13 tekst en knop · 12 blok · 11 klein · 10 uppercase kapje |
| Hoek | paneel 10 · knop 8 · veld en blok 6 · pil 4 |

Beide panelen zijn 360px breed (de widget 600px in brede modus).

**Wat bewust verschillend blijft: de toastkleuren van de drie loaders.** Blauw (`#285dab`, widget), oranje (`#e67e22`, paste) en groen (`#1a7f37`, rijtijd). Dat is geen slordigheid maar een signaal — aan de kleur zie je welke tool een update binnenhaalde. Niet gelijktrekken.

---

## Extra rijtijd-tool (`tourtool/`) — los van de widget

Beantwoordt één vraag: als we deze aftercare tussen twee stops proppen, hoeveel rijtijd kost dat? Draait op de **Ritmonitor** (`coolblue.dirextion.nl/ModuleTourMonitor`) via een eigen loader-bookmarklet. Deelt geen code met `ds-logboek.js`.

**Vormgeving: één gedeeld stijlblok (v1.2.0).** De tool en de widget dragen allebei een letterlijk identieke lijst `DS_UI` — 42 CSS-regels met de onderdelen die ze delen: `.header`, `.content`, `label`, `.section-label`, `input`, `.ux-btn` (+ `.selected`), `.action-btn`, `.submit-btn`, `.back-btn`, `.info-box`, `.warning-box`, `.park-melding`, `.summary-box`, `.status-bar`, `.toggle-btn`, `.close-btn`, `.toggle-link`, `.footer`, `.version-bar` en `.pill-blue/-green/-amber`. Ze kunnen die code niet importeren: het zijn twee losse bestanden die elk apart door een bookmarklet geladen worden. Zie de sectie **Gedeelde stijl** hierboven.

Wat per tool verschilt staat in een eigen lijst: `DS_WIDGET` (14 regels — het iframe-document, de twee-koloms weergave, de knopvarianten in de "Anders"-lijst) en `DS_PANEEL` (45 regels — de omhulling, de uitslaglijst, de samenvattingsbalk, het pilletje).

**De ORS-sleutel staat niet in het bestand.** Dat bestand gaat naar GitHub en wordt door de loader opgehaald, dus een sleutel erin zou publiek zijn. Hij staat in `localStorage` (`rijtijd_ors_key`) en wordt gezet via een veld dat het paneel alleen toont zolang er geen sleutel is. Iedereen zet dus zijn eigen sleutel, één keer per browser. Lokaal staat er een gitignored `tourtool/zet-ors-sleutel.local.js` om dat in één plak te doen.

**Waar de data vandaan komt.** De Ritmonitor is Durandal + Knockout + DevExtreme met SignalR voor live updates; klikken op een rit doet géén XHR. Bruikbare ingangen, gevonden met `probe-ritmonitor.js`:

| Bron | Wat |
|---|---|
| `$('#visit-grid-container').dxDataGrid('instance').getDataSource()` | Stops van de geselecteerde rit. **`store().load()` gebruiken, niet `items()`** — het grid pagineert op 20 rijen. |
| `/ModuleTourMonitor/TourMonitor/GetVisitsWithExecutionStateByTour?tourId=<id>` | Stops van élke rit, `{Data:[…],Success:true}`. Same-origin GET, enige parameter is `tourId`. Zo scant de tool meerdere ritten zonder de UI aan te raken. |
| `/ModuleTourMonitor/TourMonitor/GetTours?filter=…&stateFilter=…&orderField=…&skip=&take=` | Volledige gefilterde rittenlijst. Valt terug op `ko.contextFor(rij).$root.tours()` (alleen de ~16 geladen ritten). |
| `ko.contextFor($('table.tourlist tr.icons')).$root` | Viewmodel: `tours`, `selectTourId()`, `tourFilter`, `sortProperty`. |

Elke visit heeft `PlanCoordinates` (lat/lon), `SequenceNumber`, `TourId`, `IsActivity`, tijdvenster en plan-/werkelijke aankomst- en vertrektijden. Geocoden van routestops is dus niet nodig — alleen het nieuwe adres wordt opgezocht.

**Externe calls lopen via `externFetch()`.** Alle drie de calls naar buiten (PDOK, Nominatim, OSRM) gaan door één functie met `referrerPolicy: 'no-referrer'` en `credentials: 'omit'`. Daarmee staat `coolblue.dirextion.nl` niet meer in hun logs en gaat er nooit een cookie mee. De **Origin-header gaat wél mee** — die hoort bij CORS en is vanuit de browser niet weg te krijgen zonder het antwoord onleesbaar te maken; volledig anoniem kan alleen via een eigen proxy of een zelf gedraaide OSRM. De DireXtion-calls houden bewust `credentials: 'same-origin'`, want die hebben de sessiecookie nodig.

Uitzondering: **Nominatim gaat via `nominatimFetch()`, zonder `no-referrer`.** Hun gebruiksvoorwaarden vragen dat je je identificeert, en een User-Agent kun je vanuit de browser niet zetten — dus dat moet via de Referer. Cookies gaan er nog steeds niet heen, en het blijft bij één verzoek per Bereken, ruim binnen hun limiet van één per seconde.

**Router: OpenRouteService, met de OSRM-demo als vangnet.** `matrix()` kiest op `ORS_KEY` bovenaan het bestand. Is die gevuld, dan gaat het naar OpenRouteService (`POST /v2/matrix/driving-car`, sleutel in de `Authorization`-header); is hij leeg, dan naar `router.project-osrm.org`. Allebei leveren `durations[i][j]` in seconden, dus de rest van de tool merkt het verschil niet.

Dat onderscheid bestaat omdat de OSRM-demoserver door het OSRM-project uitdrukkelijk bestemd is voor ontwikkelen en testen, niet voor dagelijks operationeel gebruik. Zolang `ORS_KEY` leeg is, meldt de tool dat zelf onder de uitslag — die afwijking hoort niet stil te zijn. De sleutel staat leesbaar in een script dat in de console geplakt wordt en is dus geen geheim; bij een gratis sleutel is dat te overzien en hij is opnieuw te genereren.

Let op bij het eerste gebruik: de ORS-call is een `POST` met een eigen header, en dat vraagt een CORS-preflight. Dat is een strengere test van de CSP van DireXtion dan de bestaande GET-calls. Wordt hij geblokkeerd, dan verschijnt de bestaande CSP-melding en moet de berekening alsnog naar een eigen pagina of proxy.

Voor later: OSRM zelf draaien (container met een NL-extract) lost naleving, privacy én beschikbaarheid in één keer op, en is sneller dan een gedeelde server.

**Geocoderen: PDOK eerst, Nominatim als vangnet.** De hele berekening hangt aan dat ene punt: zit het adres 200 m verkeerd, dan klopt geen enkele omweg in de lijst. PDOK Locatieserver is de officiële BAG-bron en zit op huisnummerniveau altijd goed, maar kent alleen Nederland; Nominatim zit op NL-adressen er soms een straat naast. Levert PDOK niets op (BE/DE, of een adres dat de BAG niet kent), dan valt `geocode()` terug op Nominatim. Welke bron het werd en welk adres hij vond, staat onder de uitslag — een misser is daarmee zichtbaar in plaats van stil.

**Rekenregels.** Per gat: `t(A→X) + t(X→B) − t(A→B)`, alle drie via dezelfde engine (publieke OSRM-demoserver). Alleen gaten vanaf de huidige positie van de bezorger tellen mee: de laatste stop met een echte `RealArrivalDatestamp` (de ↑/↓-pijltjes in de lijst) is waar de rit nu is. Ritten met **voorsprong** (gepland min werkelijk) komen boven: `netto = max(0, benodigde tijd − voorsprong)`. Voorafgaand aan het routeren worden ritten hemelsbreed gefilterd; alleen de zes dichtstbijzijnde gaan echt de router in — dat houdt het aantal calls naar een publieke demoserver fatsoenlijk.

**Niet de eerstvolgende stop.** Een toegevoegde stop wordt niet op tijd naar de werktelefoon van de held gesynchroniseerd, dus het gat direct na de huidige positie is geen optie: `NIET_PLANBAAR = 1` slaat het over. Het gat daarna kán wel, maar is krap — `RISICOVOL = 1` markeert het met `⚠ krap` in het paneel en een `⚠` in de kolom. Een risicovol gat kan nog steeds bovenaan staan; het is een waarschuwing, geen degradatie. Ritten waarin na deze regel geen bruikbaar gat overblijft, gaan de router niet eens in.

**Alleen voor ritten die rijden.** Een rit geldt als onderweg zodra één stop een echte `RealArrivalDatestamp` heeft. Staat de rit nog op het depot, dan speelt het sync-probleem niet: alle gaten doen mee, inclusief het eerste, en er wordt niets als krap gemarkeerd. In plaats daarvan toont die rij `⚑ Rit staat nog op het depot — informeer de TL na het inplannen`, want dan moet de teamleider op het depot de wijziging meekrijgen.

**Welke ritten meedoen.** Twee filters draaien vóór het ophalen van de stops, zodat er geen tientallen onnodige requests uitgaan:

1. **De eigen rit valt af.** De rit waar de klant nu op staat kan de aftercare niet zelf doen. Twee bronnen, in die volgorde:
   - `route` uit het reistijd-verzoek (v1.39.0), zichtbaar in het veld "Eigen rit" zodat je hem kunt aanpassen of wissen. Vergelijking op de ritkern, dus `2M-NLRO-07-7` matcht `2M-NLRO-07`.
   - **Zelf herkennen op coördinaat.** Ligt het gezochte adres binnen `EIGEN_RIT_M` (100 m) van een stop in een rit, dan ís dat de rit van de klant. Vangt het geval af waarin het logboek geen route meestuurde (oudere versie, geen-order modus, handmatig ingetypt adres). Gebeurt ná het ophalen van de stops, dus het netwerkfilter dat uit dat netwerk volgt wordt in een tweede schifting alsnog toegepast; het veld "Eigen rit" wordt gevuld met wat er gevonden is.
2. **Netwerkvinkjes.** Vier vinkjes, één per netwerk — `1M` (één man, begane grond), `1X` (één man installateur, inbouw maar begane grond), `2M` (twee man, tilt naar boven), `BI` (twee man installatie, kan alles). Aangevinkt = die ritten mogen de aftercare doen. De keuze wordt direct in `localStorage` (`rijtijd_netwerken`) bewaard. Bewust handmatig: het bronnetwerk van de klant zegt wat die ploeg kón, niet wat de aftercare nódig heeft, en die vertaling zit nog in niemands hoofd op papier.

**Het grote getal is de uitloop, niet de klusduur.** Per gat: `uitloop = benodigde tijd − voorsprong`. Rood `+12 min` betekent dat de rit twaalf minuten uitloopt; groen `−19 min` dat het ruim past en er negentien minuten voorsprong overblijft. Dat is het getal in het paneel, in de kolom `+ rijtijd` en op het pilletje. Kleur: groen alleen bij `≤ 0` (de rit loopt er niet door uit), oranje t/m `UITLOOP_ROOD` (15 min), daarboven rood — groen mag niet ook "een paar minuten te laat" betekenen, want dat is precies het onderscheid waar de ranglijst op sorteert. De opbouw (`10 rijden + 37 service = 47 min`) staat eronder, zodat de klusduur zichtbaar blijft zonder de hoofdvraag te verdringen.

**Ranglijst — vier sleutels op volgorde.** Dezelfde ladder geldt binnen een rit (welk gat) en tussen ritten onderling (`vergelijkGaten` en de sortering van `resultaten`):

1. **Past het binnen de voorsprong?** Kost de planning dan niets, en dat weegt zwaarder dan welk netwerk ook. Een BI-rit die de klus gratis opvangt gaat dus vóór een 2M-rit die er tijd bij krijgt.
2. **Is het gat niet krap?** Een `⚠ krap` gat zakt onder alles wat wél past en niet krap is.
3. **De lichtste aangevinkte ploeg.** `NETWERKEN` (`['1M','1X','2M','BI']`) is licht → zwaar. Kan een 2M het werk ook, dan gaat die vóór een BI — BI-tijd is te duur voor werk dat een lichtere ploeg aankan. Label `lichtste ploeg`, alleen zichtbaar als er meerdere netwerken in de uitslag staan. Aanname: **1X vóór 2M**, oftewel één installateur is goedkoper dan twee man — niet geverifieerd, omwisselen is één regel.
4. **Netto tijd**, dan de kortste omweg.

Netwerk weegt dus zwaarder dan rijtijd, maar lichter dan "past in de voorsprong" en "niet krap".

**`TAKEN` — servicetijd en netwerk per taak.** Eén tabel met per kolom J-taak twee velden:

- `minuten` — servicetijd ter plaatse, uit de servicecatalogus van DireXtion (overgenomen 02-09-2026). Een getal, of per `dienstType` als Nazorg en Extra dienst verschillen (`Trekschakelaar aansluiten` 17/18, `TV ophangen en installeren` 46/50).
- `netwerken` — welke ploegen dit werk kunnen. Een array, of per `formaatTV` als het formaat uitmaakt: `{ 'Ja (>= 55 inch)': ['BI'], standaard: ['1X','BI'] }`. Alle vier de TV-taken werken zo — vanaf 55 inch kan alleen BI het.

| Taak | Min | Netwerken |
|---|---|---|
| Plaatsen / Naar boven tillen | 9 | 2M, BI |
| Aansluiting controleren | 7 | alle |
| Trekschakelaar aansluiten | 17 / 18 | 1X, BI |
| Apparaat inbouwen (Keuken) | 37 | 1X, BI |
| Deur omdraaien | 25 | BI |
| Stapelkit plaatsen | 10 | 2M, BI |
| TV installeren | 32 | ≥55": BI · anders 1X, BI |
| TV ophangen en installeren | 46 / 50 | ≥55": BI · anders 1X, BI |
| TV + Soundbar installeren | 42 | ≥55": BI · anders 1X, BI |
| TV + Soundbar ophangen en installeren | 41 | ≥55": BI · anders 1X, BI |
| Milieuretour ophalen | 4 | 2M, BI (voorkeur) |
| Pick-up ophalen | 9 | 2M, BI (voorkeur) |
| Spullen achtergelaten bij klant | 3 | alle |

Een taak uit het logboek zet hiermee de servicetijd én de vinkjes klaar. Het blijft een voorzet: de vinkjes zijn altijd met de hand aan te passen, wat vooral bedoeld is voor milieuretour en pick-up. `Blijverkoop vergeten` staat niet in de tabel: dat is administratie, daar komt geen bezoek voor. Komt er toch een taak binnen die er niet in staat, dan blijft het formulier staan zoals het stond.

Let op: `41` voor TV + Soundbar ophangen én installeren is minder dan de `42` voor alleen installeren. Dat lijkt een fout in de catalogus, maar de waarden zijn overgenomen zoals ze er staan.

**Het invulblok klapt dicht na een berekening (v1.3.0).** Vier velden plus vier netwerkvinkjes namen zo'n 270px in beslag, waardoor de ranglijst — waar het de tool om te doen is — onder de vouw begon. Zodra `scan()` slaagt vouwt het formulier zich op tot één `.status-bar`-regel met wat er is doorgerekend (`Kaakberg 2, 1121RG Landsmeer · 37 min service · 2M, BI`) plus een "Wijzigen"-link. Klikken op die balk vouwt hem weer open; dat gebeurt ook bij **Wissen** en zodra het logboek een nieuw adres aanlevert — een binnengekomen adres hoort zichtbaar te zijn, niet weggeklapt.

**Bij het opstarten staat het invulblok altijd open (v1.4.1).** Tot v1.4.0 begon het paneel compact als er nog bewaarde resultaten in `localStorage` stonden — en dan zat de knop "Adres uit DS Logboek" verstopt in het dichtgeklapte blok, terwijl dat juist het eerste is wat je nodig hebt als je de tool opent. Dichtklappen is nu uitsluitend het gevolg van een berekening die je zojuist deed, niet een toestand waarin je belandt. `vouwForm(false)` staat daarom nog op precies één plek: aan het eind van een geslaagde `scan()`.

De knop "↓ Adres uit DS Logboek" staat gewoon onder het adresveld; dat mag, want in ingeklapte toestand is hij toch niet zichtbaar. (In v1.3.0 was hij even een linkje op de labelregel — teruggedraaid in v1.4.0.)

**Servicetijd.** Optioneel veld, start altijd op leeg (= 0). Leeg = alleen rijtijd. Ingevuld = rijtijd + service, en dat totaal wordt overal gebruikt: ranglijst, groot getal, kolom in de stoplijst, pilletje. De waarde komt uit `TAKEN[taak].minuten`. Overweging voor later: die tabel hoort eigenlijk in de Google Sheet, zodat planners hem kunnen bijstellen zonder commit.

**Staande koppeling: `taak` is altijd kolom J-vocabulaire.** `bouwReistijdVerzoek()` draait `callData.probleem` door `taakNaarVocab()`, dezelfde normalisatie die `bouwLogParams()` voor kolom J gebruikt. De tabel `TAKEN` in de tool is daarop gesleuteld en mag dus nooit flow-labels bevatten. Gevolg voor onderhoud, twee kanten op:

- Krijgt een **flow-label** een nieuwe regel in `taakNaarVocab()`, dan erft de reistijd-tool die automatisch — daar hoeft niets te gebeuren.
- Komt er een nieuwe **vocabulaire-waarde** bij in `PROBLEEM_CATEGORIEEN` waarvoor een bezoek gepland wordt, dan moet die er met de hand bij in `TAKEN`, anders blijven servicetijd en netwerken leeg. Er is geen vangnet dat dat meldt.

**Koppeling met het logboek (v1.38.0).** Het logboek publiceert bij de uitkomstvraag `ds_reistijd_verzoek`:

```javascript
{ _soort:'ds-reistijd', adres, postcode, plaats, zoekterm, taak, dienstType, product, orderBron, time }
```

naar `localStorage` (werkt Basic ↔ Ritmonitor, zelfde origin) én het klembord (nodig vanaf de consumer portal, andere origin).

**Eén weg naar binnen (v1.4.0).** De tool haalt het verzoek uitsluitend op via de knop **"↓ Adres uit DS Logboek"** onder het adresveld. Die probeert eerst `localStorage`, dan het klembord, en negeert verzoeken ouder dan `VERZOEK_MAX_MIN` (30 minuten) — met een aparte melding voor "te oud" en "nog niets klaargezet".

Tot v1.3.0 vulde de tool zichzelf: bij het opstarten las hij `localStorage`, en een `storage`-listener nam een adres live over zodra het logboek in een ander tabblad publiceerde. Dat werkte alleen op dezelfde origin. Vanaf de consumer portal kán dat niet — een klembordlezing mag pas na een gebruikersactie — dus stond het adres er op Basic ineens en moest je er vanaf de portal om vragen. Twee ervaringen voor dezelfde handeling. Het automatisch invullen en de `storage`-listener zijn daarom weg: liever overal één klik dan ergens nul en elders één.

Wie dat ooit terugdraait: het probleem is niet de listener maar de asymmetrie. Automatisch invullen op beide bronnen kan alleen als de klembordlezing zonder gebruikersactie mag, en dat staat de browser niet toe.

**Waarom geen Chrome-extensie.** Die is niet toegestaan, en voor deze koppeling ook niet nodig: cross-tab communicatie kan via localStorage (zelfde origin) en het klembord (cross-origin). Een extensie zou wél helpen bij auto-injectie, gedeelde opslag over origins heen, en het omzeilen van CSP/CORS voor externe API's — dat laatste is het echte risico hier. Blokkeert DireXtion ooit `connect-src`, dan meldt de tool dat expliciet en moet de berekening naar een eigen pagina verhuizen.

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
