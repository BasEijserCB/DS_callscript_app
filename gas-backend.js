function doGet(e) {
  try {
    var p = e.parameter;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    var timestamp = new Date();
    var datum = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "dd-MM-yyyy");
    var tijd  = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "HH:mm");

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
      p.categorie                   // Kolom U: Categorie (Same day gepland / Next day gepland / Onderweg opgelost / Advies · Info gegeven / Geen oplossing / Buiten DS scope)
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
