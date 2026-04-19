# DS Logboek — Projectoverzicht & Technische Documentatie

**Delivery Support — Coolblue**
Versie 1.12.7 — April 2026

---

> ⚠️ **Belangrijk — lees dit eerst**
>
> Dit document beschrijft een intern hulpmiddel dat door één medewerker is ontwikkeld en onderhouden wordt. De tool is **niet officieel goedgekeurd** als standaard werkwijze. Het bestaat naast — en vervangt niet — de handmatige manier van werken. Als de tool niet beschikbaar is, ga dan terug naar de handmatige methode.

---

## 1. Wat is DS Logboek?

DS Logboek is een browsergebaseerd hulpmiddel voor het Delivery Support (DS) team van Coolblue. De tool draait als een kleine zwevende widget bovenop DireXtion — ons interne logistieke systeem — en begeleidt medewerkers stap voor stap door het registreren van telefonische contacten met bezorgers (helden), klantenservice, winkels en fietsers.

De aanleiding voor de tool is eenvoudig: DS doet meer dan alleen extra stops plannen. We geven ook advies, zoeken adressen en telefoonnummers op, en lossen problemen op dezelfde dag op. Al die toegevoegde waarde werd tot nu toe nauwelijks geregistreerd — alleen de uiteindelijk geplande stops kwamen in de systemen terecht. DS Logboek maakt het mogelijk om het volledige beeld vast te leggen.

Concreet doet de tool twee dingen:

- **Gesprekken vastleggen** via een gestructureerde gespreksflow, waarna de data automatisch wordt opgeslagen in een gedeelde Google Spreadsheet.
- **Gegevens klaarzetten voor invoer in DireXtion** — inclusief order- en productinformatie die automatisch van de actieve pagina wordt opgehaald.

Belangrijk om te onthouden: de tool is een aanvulling op de bestaande werkwijze, geen vervanging. Alles wat de tool doet, is ook handmatig te doen. Zie sectie 7 voor de handmatige fallback.

---

## 2. Context en achtergrond

### 2.1 Het DS-team en wat we doen

Het Delivery Support team vangt telefoontjes op van bezorgers die tijdens hun werkdag problemen tegenkomen. Ons doel is altijd hetzelfde: het probleem diezelfde dag nog oplossen, in plaats van het door te schuiven naar de volgende dag. Dat vraagt om snelle beslissingen en toegang tot de juiste informatie op het juiste moment.

De situaties die we dagelijks afhandelen zijn divers:

- Een bezorger rijdt voor op schema en bevindt zich in de buurt van een openstaand adres — wij plannen direct een extra stop in.
- Een bezorger kan een klant niet bereiken — wij zoeken een alternatief telefoonnummer op.
- Een bezorger vindt een adres niet — wij helpen met navigatie of aanvullende informatie.
- Overleg met klantenservice of een winkel over een specifieke levering.

### 2.2 Het registratieprobleem

Tot nu toe werd in onze systemen alleen bijgehouden wat er uiteindelijk werd gepland: extra stops, gewijzigde routes. De bredere waarde van ons werk — het advies, de opzoeking, de telefoontjes die een mislukking voorkomen — verdween zonder spoor. Dat maakt het moeilijk om aan te tonen wat DS werkelijk bijdraagt aan een succesvolle bezorgdag.

DS Logboek is gebouwd om dit gat te dichten. Door elk contact gestructureerd vast te leggen, ontstaat er voor het eerst een volledig beeld van ons werk.

### 2.3 Officiële status en beperkingen

De tool is ontwikkeld door één medewerker, zonder formele softwareontwikkelachtergrond, in samenwerking met een AI-assistent. Dat heeft een directe consequentie: er is geen team achter dit project, geen formele testprocedure, en geen gegarandeerde opvolging als de ontwikkelaar niet beschikbaar is.

Vanwege die beperking is de tool bewust zo ontworpen dat de bestaande handmatige werkwijze altijd intact blijft. De tool maakt het werk sneller en beter, maar wie de tool wegdenkt, kan nog steeds precies hetzelfde doen als voorheen. Sectie 7 beschrijft hoe dat in de praktijk werkt.

---

## 3. Hoe werkt de tool? (voor gebruikers)

Dit hoofdstuk is bedoeld voor DS-medewerkers die de tool willen gebruiken. Je hoeft niets te weten over de technische werking — dat staat in sectie 4. Hier gaat het alleen om het dagelijks gebruik.

### 3.1 Opstarten

De tool wordt geactiveerd via een bookmarklet: een speciale bladwijzer in je browser die je eenmalig instelt. Daarna activeer je de tool met één klik, terwijl je gewoon in DireXtion werkt.

1. Open DireXtion in je browser (Chrome aanbevolen).
2. Klik op de DS Logboek bookmarklet in je bladwijzerbalk.
3. Het zwevende widget verschijnt rechtsonder in beeld.
4. Voer je naam in als je dit voor de eerste keer doet — dit wordt onthouden.

### 3.2 Een gesprek registreren

1. Klik op "Nieuw gesprek" in het widget.
2. Selecteer het type beller (held, klantenservice, winkel, fietser).
3. Volg de gespreksflow — de tool stelt de juiste vragen op basis van de situatie.
4. Vul de benodigde velden in. Ordernummers worden waar mogelijk automatisch ingevuld vanuit de huidige DireXtion-pagina.
5. Klik op "Vastleggen". Het gesprek wordt automatisch opgeslagen in de gedeelde Google Spreadsheet.

### 3.3 Data klaarzetten voor DireXtion

Wanneer er een extra stop gepland moet worden, stelt de tool automatisch een gegevenspakket samen op basis van de actieve DireXtion-pagina. Via de klembord-functie zet je dit pakket over naar DireXtion, waarna de stopinvoer grotendeels automatisch wordt ingevuld.

Dit is de stap die het meeste tijdwinst oplevert. Let op: als de tool niet beschikbaar is, vervalt ook deze automatische invoer. In dat geval voer je de stopgegevens handmatig in zoals je dat deed vóór de tool bestond (zie sectie 7).

---

## 4. Technische architectuur (voor opvolgers en AI-tools)

Dit hoofdstuk is bedoeld voor iemand die de tool wil begrijpen, aanpassen of debuggen. De informatie hier is bewust gedetailleerd genoeg om, samen met de broncode op GitHub, als startpunt te dienen voor een AI-tool die verder werkt aan het project.

De tool bestaat uit vijf samenhangende onderdelen die hieronder worden toegelicht.

### 4.1 Overzicht

| Component | Beschrijving |
|---|---|
| Frontend (`ds-logboek.js`) | Het volledige tool: UI, logica, DOM-scraping. Gehost op GitHub. |
| Bookmarklet | Laadt `ds-logboek.js` in vanuit GitHub via cache-busting URL (`?v=Date.now()`). Cachet in `localStorage` onder de sleutel `ds_app_prod_cache`. |
| Backend (GAS Script 1) | Google Apps Script dat gegevenspakketten ontvangt en schrijft naar de Google Spreadsheet. |
| Google Spreadsheet | Centrale opslag van alle geregistreerde gesprekken. |
| DireXtion | Coolblue intern portaal. Twee varianten ondersteund: consumer en basic. |

### 4.2 GitHub repository

De volledige frontendbroncode staat op GitHub. Dit is de centrale plek waar alle wijzigingen worden bijgehouden en van waaruit de tool wordt geladen door de bookmarklet.

- **Repository:** `BasEijserCB/DS_callscript_app`
- **Hoofdbestand:** `ds-logboek.js`

Elke wijziging aan de tool vereist:

1. Aanpassing in de broncode.
2. Uitvoeren van het Python buildscript (zie 4.5).
3. Node.js syntaxcheck: `node --check ds-logboek.js`
4. Push naar GitHub via terminal met Personal Access Token: `git add . && git commit -m "versie X.X.X" && git push`
5. Leegmaken van browsercache en verwijderen van localStorage-sleutel: `ds_app_prod_cache`
6. Testen in DireXtion.

### 4.3 DireXtion-pagina's

De tool ondersteunt twee varianten van DireXtion die een andere HTML-structuur hebben:

| Domein | Methode van datauitlezen |
|---|---|
| `coolbluebezorgt.dirextion.nl` | Knockout.js `data-bind` attributen |
| `coolblue.dirextion.nl/Basic` | `.details-field` CSS-klassen via `basicField()` / `basicFieldInSection()` helpers |

De tool detecteert automatisch welke variant actief is en past de juiste uitleesmethode toe. Ordernummers worden opgehaald via een polling-loop (elke 100ms, maximaal 3 seconden) omdat de pagina asynchroon laadt.

### 4.4 Backend (Google Apps Script)

De backend is een Google Apps Script (GAS) dat draait in de cloud en gegevenspakketten van de frontend ontvangt via een HTTP POST-verzoek. Het script schrijft de ontvangen data direct naar de Google Spreadsheet. Er zijn twee kritieke instellingen om rekening mee te houden:

- De deployment moet ingesteld zijn op toegang **"Iedereen"** — niet "Iedereen binnen Coolblue". Zonder die instelling blokkeren CORS-restricties de verbinding vanuit de browser.
- De backend hoeft alleen opnieuw te worden gedeployed als de kolomindeling van de spreadsheet verandert. Frontendwijzigingen vereisen géén nieuwe backend-deployment.
- Parameters die worden meegezonden zijn o.a.: `bellerType`, `tijdvak`, `aankomsttijd`, medewerkersnaam, ordernummer en de ondernomen actie.

### 4.5 Buildproces

Broncode aanpassen en pushen is niet genoeg — er is een tussenstap nodig. Google Apps Script verdubbelt intern backslashes in reguliere expressies (`\d` wordt `\\d`), waardoor ordernummerherkenning zou breken als de code zonder correctie wordt gedeployed. Een Python buildscript corrigeert dit automatisch bij het genereren van het definitieve `ds-logboek.js` bestand.

Het buildscript past de volgende correctie toe:
```python
re.sub(r'\\\\([dDwWsSnbtfrvuU0-9])', r'\\\1', iife)
```

De vaste volgorde bij elke wijziging:

1. Pas de broncode aan.
2. Voer het Python buildscript uit — dit genereert het nieuwe `ds-logboek.js`.
3. Voer `node --check ds-logboek.js` uit om syntaxfouten te detecteren.
4. Push naar GitHub: `git add . && git commit -m "versie X.X.X" && git push`
5. Leeg de browsercache en verwijder localStorage-item: `ds_app_prod_cache`
6. Test de tool in DireXtion.

### 4.6 Versienummering

| Type wijziging | Versieaanpassing |
|---|---|
| Bugfix, kleine correctie | Patch: `x.x.0` → `x.x.1` |
| Nieuwe functionaliteit | Minor: `x.x` → `x+1.0` |

---

## 5. Wat wordt er vastgelegd?

Elk gesprek dat via de tool wordt geregistreerd, levert een rij op in de Google Spreadsheet. De volgende gegevens worden per gesprek opgeslagen. Dit zijn ook de velden die je handmatig invult als de tool niet beschikbaar is (zie sectie 7.1):

- Datum en tijdstip van het gesprek
- Naam van de DS-medewerker
- Type beller (held, klantenservice, winkel, fietser)
- Ordernummer (automatisch ingevuld of handmatig ingevoerd)
- Tijdvak en aankomsttijd (indien van toepassing)
- Actie ondernomen (stop gepland, advies gegeven, adres opgezocht, etc.)
- Aanvullende opmerkingen

---

## 6. Veelvoorkomende problemen en oplossingen

De meeste problemen met de tool zijn snel op te lossen. Hieronder staan de meest voorkomende situaties. Lukt het niet, of kom je er niet uit, neem dan contact op met Bas en ga in de tussentijd terug naar de handmatige werkwijze (sectie 7).

| Probleem | Oplossing |
|---|---|
| Widget verschijnt niet | Controleer of je op de juiste DireXtion-pagina zit. Herlaad de pagina en klik opnieuw op de bookmarklet. |
| Ordernummer wordt niet automatisch ingevuld | Wacht tot de pagina volledig geladen is en probeer het opnieuw. Voer het ordernummer handmatig in als het blijft mislukken. |
| Gesprek wordt niet opgeslagen | Controleer je internetverbinding en probeer het opnieuw. Noteer het gesprek handmatig als backup. |
| Tool laadt oude versie | Open de browserconsole (F12) en typ: `localStorage.removeItem('ds_app_prod_cache')` — herlaad daarna de pagina. |
| Foutmelding bij opslaan / CORS-fout | De backend deployment is mogelijk verlopen of verkeerd ingesteld. Neem contact op met Bas. |

---

## 7. Als de tool niet beschikbaar is

De tool is een hulpmiddel, geen vereiste. Alles wat de tool doet, kun je ook handmatig doen — precies zoals je dat deed vóór de tool bestond. Hieronder staat beschreven hoe.

### 7.1 Gesprekken handmatig registreren

1. Open de Google Spreadsheet direct via de link in je bladwijzers.
2. Voeg een nieuwe rij toe met de gespreksgegevens (zie sectie 5 voor de kolommen).
3. Vul alle velden handmatig in.

### 7.2 Extra stop plannen in DireXtion

1. Open de juiste route in DireXtion.
2. Zoek het ordernummer op.
3. Voer de stopgegevens handmatig in zoals je dat deed vóór de tool bestond.

Kom je een probleem tegen dat hier niet beschreven staat, meld het dan aan Bas met zo veel mogelijk detail: welke pagina je op stond, wat je deed, en wat er precies misging. Hoe preciezer de melding, hoe sneller het opgelost kan worden.

---

## 8. Beheer en opvolging

Dit hoofdstuk beschrijft wie verantwoordelijk is voor de tool en — belangrijker — wat er moet gebeuren als die persoon niet beschikbaar is. Het is bewust het laatste inhoudelijke hoofdstuk, omdat het voortbouwt op alles wat hiervoor staat.

### 8.1 Huidige situatie

| | |
|---|---|
| **Beheerder** | Bas Eijser (DS-medewerker Coolblue) |
| **Repository** | `BasEijserCB/DS_callscript_app` (GitHub) |
| **Backend** | Google Apps Script, beheerd via Google account beheerder |
| **Spreadsheet** | Google Sheets, gedeeld binnen DS-team |
| **Versie bij schrijven** | v1.11.x |

### 8.2 Als de beheerder niet beschikbaar is

Dit is het scenario waar dit document voor bedoeld is. De combinatie van dit document en de broncode op GitHub geeft genoeg informatie om een AI-tool de verdere ontwikkeling of een bugfix te laten overnemen. Volg hiervoor deze stappen:

1. Gebruik de handmatige werkwijze als tijdelijke oplossing (zie sectie 7) zolang het probleem niet opgelost is.
2. Beschrijf het probleem zo exact mogelijk: welke pagina, welke actie, welke foutmelding.
3. Leg het probleem voor aan een AI-tool (zoals Claude of ChatGPT). Voeg dit document toe én de relevante stukken broncode uit de GitHub-repository. Een goed geformuleerde vraag levert in de meeste gevallen een bruikbare oplossing.
4. Laat gegenereerde code altijd controleren door iemand met technisch inzicht voordat je het inzet.

### 8.3 Richtlijnen voor toekomstige ontwikkeling

Voor wie de tool verder ontwikkelt — of dat nu Bas is of iemand anders met hulp van een AI-tool — zijn dit de afspraken die de tool beheersbaar houden:

- Documenteer elke nieuwe functie in dit document en in de commit-berichten op GitHub.
- Verhoog het versienummer bij elke wijziging (zie sectie 4.6).
- Test altijd op beide DireXtion-varianten na een wijziging.
- Voer altijd `node --check` syntaxvalidatie uit vóór je pusht.
- Verander de backend-deployment alleen als de kolomstructuur van de spreadsheet wijzigt.
- Houd de handmatige werkwijze altijd als fallback in stand.

---

## 9. Verklarende woordenlijst

In dit document worden technische termen gebruikt die niet iedereen kent. Hieronder een uitleg van de belangrijkste begrippen.

| Term | Uitleg |
|---|---|
| Bookmarklet | Een bladwijzer in je browser die een stukje code uitvoert als je erop klikt. Hiermee activeer je de tool. |
| DireXtion | Intern logistiek systeem van Coolblue waar routes en stops worden beheerd. |
| GAS / Google Apps Script | Programmeertaal van Google waarmee je automatisch acties kunt uitvoeren in Google-producten zoals Sheets. |
| GitHub | Opslagplaats voor de broncode van de tool. Vergelijkbaar met een gedeelde schijf, maar voor code. |
| Held | Bezorger die voor Coolblue levert (intern jargon). |
| JSON | Een gestandaardiseerd formaat om gegevens over te dragen tussen systemen. Niet leesbaar voor mensen, wel voor computers. |
| localStorage | Tijdelijke opslag in je browser. Wordt gebruikt om de cache van de tool op te slaan. |
| CORS | Beveiligingsmechanisme van browsers dat verhindert dat websites data ophalen van andere domeinen. Relevant voor de backend-verbinding. |
| Polling-loop | De tool vraagt elke 100ms aan de pagina of het ordernummer al geladen is, tot maximaal 3 seconden. |
| Widget | Het kleine zwevende venster van de tool dat over DireXtion heen wordt gelegd. |

---

*DS Logboek — Projectdocumentatie v1.11.x — Intern document Coolblue DS-team — Niet voor extern gebruik*
