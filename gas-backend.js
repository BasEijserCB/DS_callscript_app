function doGet(e) {
  try {
    var p = e.parameter;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

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

    sheet.appendRow([
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
      p.categorie,                  // Kolom U: Categorie (Same day gepland / Next day gepland / Onderweg opgelost / Advies gegeven / Geen oplossing / Buiten DS scope)
      tijdBlok,                     // Kolom V: Tijdblok (bijv. "08:00 - 08:59")
      weeknummer,                   // Kolom W: ISO-weeknummer (bijv. 26)
      laatste5Weken                 // Kolom X: TRUE/FALSE — datum binnen laatste 5 voltooide weken (live formule)
    ]);

    return ContentService
      .createTextOutput("Success")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    console.error("Fout bij loggen: " + error.toString());
    return ContentService
      .createTextOutput("Error: " + error.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
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
