// Naam van het doel-tabblad. Niet getActiveSheet() gebruiken: dat hangt af van
// UI-state en niet van wat dit script hoort te doen. (Niet de oorzaak van het
// incident van 10/11-08-2026 — die is nooit gevonden; zie CLAUDE.md.)
var DOEL_TABBLAD = "Database";

// Hoe lang een verwerkte log-id onthouden wordt. De client biedt niet-bevestigde
// regels opnieuw aan; zonder deze check zou dat dubbele rijen opleveren.
var DEDUPE_TTL_SEC = 21600; // 6 uur

// Aantal schrijfpogingen en de wachttijd waarmee die oploopt.
var MAX_POGINGEN = 4;
var EERSTE_WACHT_MS = 500;

function doGet(e) {
  var lock = LockService.getScriptLock();
  var p = (e && e.parameter) || {};
  var id = p.id || "";

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("getActiveSpreadsheet() gaf null — script niet aan een sheet gekoppeld?");

    var sheet = ss.getSheetByName(DOEL_TABBLAD);
    if (!sheet) throw new Error("Tabblad '" + DOEL_TABBLAD + "' niet gevonden — hernoemd of verwijderd?");

    // De client stuurt een regel opnieuw zolang die niet bevestigd is. Was deze
    // id al verwerkt, dan bevestigen we opnieuw zonder een tweede rij te schrijven.
    var cache = CacheService.getScriptCache();
    if (id && cache.get("log_" + id)) {
      console.log("Duplicaat genegeerd (id " + id + ")");
      return tekst("Success: duplicaat genegeerd (id " + id + ")");
    }

    // Serialiseer gelijktijdige aanroepen: twee parallelle appendRow-calls kunnen
    // anders dezelfde laatste rij bepalen en elkaar overschrijven.
    if (!lock.tryLock(30000)) throw new Error("Geen scriptlock binnen 30s — te veel gelijktijdige aanroepen");

    var tz = Session.getScriptTimeZone();
    var timestamp = new Date();
    var datum = Utilities.formatDate(timestamp, tz, "dd-MM-yyyy");
    var tijd  = Utilities.formatDate(timestamp, tz, "HH:mm");
    var uur = parseInt(Utilities.formatDate(timestamp, tz, "H"), 10);
    var tijdBlok = ("0" + uur).slice(-2) + ":00 - " + ("0" + uur).slice(-2) + ":59";

    // Datumcomponenten in script-tijdzone (matcht kolom A)
    var yyyy = parseInt(Utilities.formatDate(timestamp, tz, "yyyy"), 10);
    var mm   = parseInt(Utilities.formatDate(timestamp, tz, "MM"), 10);
    var dd   = parseInt(Utilities.formatDate(timestamp, tz, "dd"), 10);

    // Kolom W: ISO-weeknummer (week start maandag, week 1 = week met 1e donderdag)
    var weeknummer = isoWeekNumber(yyyy, mm, dd);

    // Kolom X: TRUE/FALSE of de logdatum binnen de laatste 5 voltooide weken valt.
    // Live formule (herberekent dagelijks via TODAY) — reproduceert:
    //   =EN(A>=VANDAAG()-WEEKDAG(VANDAAG();2)-34; A<=VANDAAG()-WEEKDAG(VANDAAG();2))
    // De logdatum wordt als echte DATE() ingebed zodat de tekst-datum in kolom A
    // de vergelijking niet breekt. Engelse functienamen + puntkomma's als
    // argumentscheiding (Sheet staat op NL-locale; komma's geven #ERROR).
    var dateExpr = "DATE(" + yyyy + ";" + mm + ";" + dd + ")";
    var laatste5Weken = "=AND(" + dateExpr + ">=TODAY()-WEEKDAY(TODAY();2)-34;" +
                                  dateExpr + "<=TODAY()-WEEKDAY(TODAY();2))";

    var rij = [
      datum,                        // Kolom A: Datum
      tijd,                         // Kolom B: Tijd
      p.user,                       // Kolom C: DS Medewerker
      p.route,                      // Kolom D: Route (Bezorger)
      p.depot,                      // Kolom E: Depot
      p.driver1,                    // Kolom F: Chauffeur 1
      p.driver2,                    // Kolom G: Bijrijder
      p.orderBron,                  // Kolom H: Ordernummer (Bron)
      p.product,                    // Kolom I: Product / Formaat
      p.probleem,                   // Kolom J: Taak / Klacht
      p.redenGeenOplossing,         // Kolom K: Waarom geen opl?
      p.redenNextDay,               // Kolom L: Waarom Next Day?
      p.orderOplossing,             // Kolom M: Ordernummer-DS
      p.geplandeRoute,              // Kolom N: Nieuwe Route
      p.dsWaarde,                   // Kolom O: DS Waarde (Uitkomst)
      p.bellerType,                 // Kolom P: Wie belde er? (CBB/CBF/KS/Winkel)
      p.tijdvak,                    // Kolom Q: Gecommuniceerd tijdvak
      p.aankomsttijd,               // Kolom R: Aankomsttijd
      p.extra_info,                 // Kolom S: Extra info (toelichting afwijkend)
      p.extra_dienst,               // Kolom T: Extra dienst nodig? (Ja / leeg)
      p.categorie,                  // Kolom U: Oplossing categorie
      tijdBlok,                     // Kolom V: Tijdblok (bijv. "08:00 - 08:59")
      weeknummer,                   // Kolom W: ISO-weeknummer (bijv. 26)
      laatste5Weken,                // Kolom X: TRUE/FALSE — binnen laatste 5 voltooide weken
      p.locatie || "",              // Kolom Y: Locatie/context
      p.ingang  || "",              // Kolom Z: Ingang van het belletje
      p.probleemCategorie || ""     // Kolom AA: Probleem categorie (groep van kolom J)
    ];

    var rijNr = schrijfMetRetry(sheet, rij, datum, tijd);

    if (id) cache.put("log_" + id, "1", DEDUPE_TTL_SEC);
    console.log("Gelogd: " + DOEL_TABBLAD + " rij " + rijNr + " — " + (p.user || "?") + " (id " + id + ")");
    return tekst("Success: " + DOEL_TABBLAD + " rij " + rijNr);

  } catch (error) {
    // Deze regel is het enige spoor dat een mislukte schrijfactie achterlaat in
    // Cloud Logging. De client krijgt de melding ook terug en toont hem.
    console.error("FOUT bij loggen (id " + id + ", user " + (p.user || "?") + "): " + error);
    return tekst("Error: " + error);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// Schrijft de rij en controleert daarna dat hij er echt staat. Een appendRow die
// "slaagt" zonder rij op te leveren — het patroon van augustus 2026 — wordt hier
// alsnog als fout herkend in plaats van als succes gerapporteerd.
function schrijfMetRetry(sheet, rij, datum, tijd) {
  var wacht = EERSTE_WACHT_MS;
  var laatsteFout;

  for (var poging = 1; poging <= MAX_POGINGEN; poging++) {
    try {
      sheet.appendRow(rij);
      SpreadsheetApp.flush();

      var rijNr = sheet.getLastRow();
      var terug = sheet.getRange(rijNr, 1, 1, 2).getDisplayValues()[0];
      if (terug[0] !== datum || terug[1] !== tijd) {
        throw new Error("Verificatie mislukt: rij " + rijNr + " bevat '" +
                        terug[0] + " " + terug[1] + "' in plaats van '" + datum + " " + tijd + "'");
      }
      return rijNr;

    } catch (err) {
      laatsteFout = err;
      console.warn("Schrijfpoging " + poging + "/" + MAX_POGINGEN + " mislukt: " + err);
      if (poging < MAX_POGINGEN) {
        Utilities.sleep(wacht);
        wacht *= 2;
      }
    }
  }
  throw new Error("Na " + MAX_POGINGEN + " pogingen niet kunnen schrijven. Laatste fout: " + laatsteFout);
}

function tekst(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

// ISO 8601 weeknummer: week start maandag, week 1 bevat de eerste donderdag van het jaar.
function isoWeekNumber(year, month, day) {
  var d = new Date(Date.UTC(year, month - 1, day));
  var dayNum = (d.getUTCDay() + 6) % 7;            // maandag = 0 ... zondag = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);       // donderdag van deze week
  var firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  var firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
}
