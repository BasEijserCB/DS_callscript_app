/**
 * DS Logboek — dagmail "Same day stops nalopen"
 *
 * Leest het logboek (tabblad Database) voor vandaag en mailt alle gesprekken met
 * oplossing categorie "Same day gepland" (kolom U), met per stop een link naar de
 * order in DireXtion Basic. Bedoeld voor wie als laatste werkt: loop na of alles
 * volgens plan is uitgevoerd.
 *
 * Hoort in hetzelfde Apps Script-project als gas-backend.js (gebonden aan de sheet).
 * Een commit hier verandert niets in productie: handmatig kopiëren naar de GAS-editor.
 *
 * Uitvoeren vanuit de editor:
 *   stuurTestmail()      → één mail naar jezelf (voorbeelddata als er vandaag niets is)
 *   stuurTestmailDemo()  → naar jezelf, altijd voorbeelddata (toont ook "Zonder DS-stop")
 *   stuurTestmailLeeg()  → naar jezelf, de mail van een dag zonder same day stops
 *   stuurDagmail()       → de echte mail naar DAGMAIL.AAN
 *   installeerTrigger()  → zet de triggers (ma-vr rond 18:30, za-zo rond 17:00). Eén keer uitvoeren; opnieuw na een wijziging van de tijden.
 *   verwijderTrigger()   → haalt hem weer weg
 */

var DAGMAIL = {
  AAN: 'gl-deliverysupport@coolblue.nl',
  TABBLAD: 'Database',
  // Verzendtijd; Apps Script garandeert alleen ± 15 minuten. In het weekend is het rooster anders.
  DOORDEWEEKS: { UUR: 18, MINUUT: 30 },
  WEEKEND: { UUR: 17, MINUUT: 0 },
  CATEGORIE: 'Same day gepland',
  MAIL_ALS_LEEG: true,     // ook mailen als er niets gepland is — dan is zichtbaar dát het script liep
  DEMO_ALS_LEEG: true,     // alleen stuurTestmail(): voorbeelddata als er vandaag niets staat
  AFZENDER: 'DS Logboek',
  MELDEN_AAN: 'Brigitte',         // bij een stop die bewust niet is uitgevoerd
  MELDEN_IN: 'DS - Zakelijke',     // naam van de chatspace
  MELDEN_URL: 'https://chat.google.com/u/0/app/chat/AAAAwJxhyZk'   // link naar die chatspace; leeg = alleen de naam
};

// Kolomindexen in het tabblad Database (0 = kolom A), zie gas-backend.js
var KOL = {
  datum: 0, tijd: 1, user: 2, route: 3, depot: 4, driver1: 5, driver2: 6, orderBron: 7,
  product: 8, probleem: 9, orderOplossing: 12, geplandeRoute: 13, dsWaarde: 14,
  bellerType: 15, tijdvak: 16, extraInfo: 18, extraDienst: 19, categorie: 20
};
var KOL_AANTAL = 21;

var DM_KLEUR = {
  blue: '#408ede', blueDark: '#2c5ba6', blueLink: '#0090e3',
  stop: '#0090e3', terug: '#f26a10', text: '#333a45', muted: '#7b8490',
  border: '#dde2e8', bg: '#f4f6f9', soft: '#eef1f5'
};

// Huisstijl-lettertypen met terugval; mailprogramma's laden zelden eigen lettertypen.
var DM_FONT = {
  FACT: "font-family:'Avenir LT Std','Avenir Black',Avenir,'Avenir Next',Montserrat,'Helvetica Neue',Arial,sans-serif;font-weight:900;text-transform:uppercase;",
  SLAB: "font-family:'Dobra Slab',DobraSlab,'Roboto Slab',Rockwell,Georgia,serif;font-weight:500;",
  BODY: "font-family:'Open Sans','Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;"
};

// ---------- ingangen ----------

/** Handmatig: testmail naar jezelf. Verstuurt niets naar de groep. */
function stuurTestmail() {
  var vandaag = vandaagIso_();
  var stops = leesStopsVanVandaag_();
  var demo = false;
  if (!stops.length && DAGMAIL.DEMO_ALS_LEEG) { stops = demoStops_(); demo = true; }
  var aan = Session.getEffectiveUser().getEmail();
  verstuur_(aan, bouwDagmail_(stops, vandaag, demo), demo);
  Logger.log('Testmail verstuurd naar %s (%s stops%s).', aan, stops.length, demo ? ', voorbeelddata' : '');
}

/** Handmatig: testmail naar jezelf met voorbeelddata, ook als er vandaag wél stops zijn. */
function stuurTestmailDemo() {
  verstuur_(Session.getEffectiveUser().getEmail(), bouwDagmail_(demoStops_(), vandaagIso_(), true), true);
}

/** Handmatig: testmail naar jezelf van een dag zonder same day stops. */
function stuurTestmailLeeg() {
  verstuur_(Session.getEffectiveUser().getEmail(), bouwDagmail_([], vandaagIso_(), true), true);
}

/** De echte dagmail. Wordt door de trigger aangeroepen. */
function stuurDagmail() {
  var stops = leesStopsVanVandaag_();
  if (!stops.length && !DAGMAIL.MAIL_ALS_LEEG) {
    console.log('Dagmail: geen same day stops vandaag, niets verstuurd.');
    return;
  }
  verstuur_(DAGMAIL.AAN, bouwDagmail_(stops, vandaagIso_(), false), false);
  console.log('Dagmail verstuurd naar ' + DAGMAIL.AAN + ' (' + stops.length + ' stops).');
}

/** Zet één wekelijkse trigger per dag (vervangt de bestaande): doordeweeks en weekend hebben een eigen tijd. */
function installeerTrigger() {
  verwijderTrigger();
  var W = ScriptApp.WeekDay;
  var zet = function (dagen, tijd) {
    dagen.forEach(function (dag) {
      ScriptApp.newTrigger('stuurDagmail').timeBased().onWeekDay(dag).atHour(tijd.UUR).nearMinute(tijd.MINUUT)
        .inTimezone(Session.getScriptTimeZone()).create();
    });
  };
  zet([W.MONDAY, W.TUESDAY, W.WEDNESDAY, W.THURSDAY, W.FRIDAY], DAGMAIL.DOORDEWEEKS);
  zet([W.SATURDAY, W.SUNDAY], DAGMAIL.WEEKEND);
  var hhmm = function (t) { return t.UUR + ':' + ('0' + t.MINUUT).slice(-2); };
  Logger.log('Triggers gezet: ma-vr rond %s, za-zo rond %s (± 15 min), tijdzone %s.',
    hhmm(DAGMAIL.DOORDEWEEKS), hhmm(DAGMAIL.WEEKEND), Session.getScriptTimeZone());
}

function verwijderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'stuurDagmail') ScriptApp.deleteTrigger(t);
  });
}

function verstuur_(aan, mail, demo) {
  var logo = dmLogo_();
  MailApp.sendEmail({
    to: aan,
    subject: (demo ? '[TEST · voorbeelddata] ' : '') + mail.subject,
    htmlBody: mail.html,
    body: mail.text,
    name: DAGMAIL.AFZENDER,
    inlineImages: logo ? { logo: logo } : undefined
  });
}

// ---------- logboek lezen ----------

function vandaagIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function leesStopsVanVandaag_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DAGMAIL.TABBLAD);
  if (!sheet) throw new Error('Tabblad "' + DAGMAIL.TABBLAD + '" niet gevonden.');
  var laatste = sheet.getLastRow();
  if (laatste < 2) return [];
  var bereik = sheet.getRange(2, 1, laatste - 1, KOL_AANTAL);
  // Datum uit de ruwe waarden (de sheet formatteert kolom A zelf, de weergave is dus
  // niet betrouwbaar te vergelijken); al het andere uit de weergave.
  return stopsUitRijen_(bereik.getValues(), bereik.getDisplayValues(), vandaagIso_(), ss.getSpreadsheetTimeZone());
}

/** Filtert de rijen van één dag met categorie Same day gepland en maakt er stops van. */
function stopsUitRijen_(waarden, weergave, dagIso, tz) {
  var stops = [];
  for (var i = 0; i < waarden.length; i++) {
    if (datumIso_(waarden[i][KOL.datum], tz) !== dagIso) continue;
    var w = weergave[i];
    if (String(w[KOL.categorie]).trim() !== DAGMAIL.CATEGORIE) continue;
    var cel = function (k) { return String(w[k] == null ? '' : w[k]).trim(); };
    var orderBron = (cel(KOL.orderBron).match(/\d{8,}/) || [''])[0];
    var orderOpl = cel(KOL.orderOplossing);
    stops.push({
      tijd: tijdHhmm_(cel(KOL.tijd)), user: cel(KOL.user), route: cel(KOL.route), depot: cel(KOL.depot),
      bezorgers: [cel(KOL.driver1), cel(KOL.driver2)].filter(String).join(' & '),
      orderBron: orderBron, orderOplossing: orderOpl, product: cel(KOL.product), probleem: cel(KOL.probleem),
      geplandeRoute: cel(KOL.geplandeRoute), dsWaarde: cel(KOL.dsWaarde), bellerType: cel(KOL.bellerType),
      tijdvak: cel(KOL.tijdvak), extraInfo: cel(KOL.extraInfo), extraDienst: cel(KOL.extraDienst),
      // Zonder ordernummer-DS is er geen eigen DS-stop gemaakt (bijv. teamleider stuurt helden terug)
      dsStop: !!orderOpl
    });
  }
  return stops.sort(function (a, b) {
    return (a.geplandeRoute || '~').localeCompare(b.geplandeRoute || '~') || a.tijd.localeCompare(b.tijd);
  });
}

/** Kolom A naar yyyy-MM-dd: een echte datumcel of de tekst dd-MM-yyyy die doGet schrijft. */
function datumIso_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var m = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(String(v || '').trim());
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
}

/** Kolom B naar HH:mm; de sheet toont vroege tijden zonder voorloopnul (9:27), wat ook het sorteren breekt. */
function tijdHhmm_(t) {
  var m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : t;
}

// ---------- DireXtion ----------

/**
 * Link naar de order in DireXtion Basic. Zoekt op het bron-ordernummer binnen de dag zelf;
 * de DS-stop draagt hetzelfde nummer met -DS erachter. Zelfde filtervorm als de widget
 * (ds-logboek.js), met ShipperOrderNumber in plaats van EmailAddress.
 */
function direxUrl_(orderNr, dagIso) {
  if (!orderNr) return '';
  var filter = {
    StartDate: dagIso.replace(/-/g, '/'), EndDate: dagIso, ShipperOrderNumber: orderNr,
    CountryIds: [], ChannelIds: [], NetworkIds: [], ServiceTypeIds: [], ShipmentStatusIds: [],
    VisitStatusIds: [], ParcelStatusIds: [], ShipperIds: [], DepotIds: [], CharacteristicIds: []
  };
  return 'https://coolblue.dirextion.nl/Basic/Orders?filter=' + encodeURIComponent(JSON.stringify(filter));
}

// ---------- mail bouwen ----------

/** Bouwt onderwerp, HTML en platte tekst. Alleen tabellen en inline stijlen (Gmail, Outlook). */
function bouwDagmail_(stops, dagIso, demo) {
  var M = DM_KLEUR, F = DM_FONT, font = F.BODY;
  var gepland = stops.filter(function (s) { return s.dsStop; });
  var terug = stops.filter(function (s) { return !s.dsStop; });
  var dag = dmDag_(dagIso);

  var sectie = function (titel, lijst, kleur, metDsStop) {
    if (!lijst.length) return '';
    return '<tr><td style="padding:20px 24px 0;">' +
      '<div style="' + F.SLAB + 'font-size:17px;color:' + kleur + ';padding-bottom:6px;">' + titel + ' (' + lijst.length + ')</div>' +
      stopLijst_(lijst, dagIso, kleur, metDsStop) + '</td></tr>';
  };

  var kop = dmLogo_()
    ? '<td><img src="cid:logo" width="44" height="44" alt="" style="display:block;border:0;width:44px;height:44px;"></td><td style="padding-left:12px;'
    : '<td style="';
  kop += F.FACT + 'font-size:20px;letter-spacing:.5px;color:#ffffff;">DS Logboek</td>';

  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Roboto+Slab:wght@500&display=swap" rel="stylesheet">' +
    '</head><body style="margin:0;padding:0;background:' + M.bg + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + M.bg + ';"><tr><td align="center" style="padding:20px 10px;">' +
    '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ' + M.border + ';">' +

    '<tr><td style="background:' + M.blue + ';padding:12px 24px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' + kop + '</tr></table></td></tr>' +

    (demo ? '<tr><td style="padding:12px 24px 0;"><div style="' + font + 'background:#fff3db;color:#a86400;border:1px dashed #a86400;border-radius:4px;padding:8px 12px;font-size:13px;font-weight:bold;text-align:center;">TEST · voorbeelddata, dit zijn geen echte stops</div></td></tr>' : '') +

    '<tr><td style="padding:20px 24px 4px;">' +
      '<div style="' + F.SLAB + 'font-size:28px;color:' + M.blueDark + ';line-height:1.2;">Same day stops nalopen</div>' +
      '<div style="' + font + 'font-size:14px;color:' + M.muted + ';margin-top:4px;">' + dag + '</div>' +
      '<div style="' + font + 'font-size:14px;color:' + M.text + ';line-height:1.5;margin-top:12px;">Dit hebben we vandaag same day opgelost. Loop ze voor het einde van de dienst even na: klik op het ordernummer voor de order in DireXtion.</div>' +
    '</td></tr>' +

    (stops.length
      ? '<tr><td style="padding:12px 24px 0;"><div style="' + font + 'background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;padding:10px 14px;font-size:14px;line-height:1.5;color:' + M.text + ';">' +
          '<b>Bewust niet uitgevoerd?</b> Zie of vermoed je dat een stop bewust niet is uitgevoerd, meld dat dan aan ' + dmEsc_(DAGMAIL.MELDEN_AAN) + ' in de chatspace ' + (DAGMAIL.MELDEN_URL
            ? '<a href="' + dmEsc_(DAGMAIL.MELDEN_URL) + '" target="_blank" style="color:' + M.blueLink + ';font-weight:bold;text-decoration:underline;">' + dmEsc_(DAGMAIL.MELDEN_IN) + '</a>'
            : dmEsc_(DAGMAIL.MELDEN_IN)) + ', zodat zij het kan nakijken.</div></td></tr>' +
        sectie('DS-stop gepland', gepland, M.stop, true) + sectie('Zonder DS-stop', terug, M.terug, false)
      : '<tr><td style="padding:22px 24px 8px;"><div style="' + font + 'background:' + M.soft + ';border-radius:6px;padding:18px 20px;text-align:center;">' +
          '<div style="' + F.SLAB + 'font-size:19px;color:' + M.blueDark + ';">Vandaag zijn er geen same day stops gelogd.</div></div></td></tr>') +

    '<tr><td style="padding:18px 24px 20px;' + font + 'font-size:12px;color:' + M.muted + ';line-height:1.5;">Automatisch gemaakt uit het DS Logboek. Stops die na het versturen van deze mail gelogd zijn, staan er niet in.</td></tr>' +
    '</table></td></tr></table></body></html>';

  var regel = function (s) {
    return '  ' + (s.geplandeRoute || s.route || '?') + ' | order ' + (s.orderBron || '?') + ' | ' + s.probleem +
      (s.product ? ' (' + s.product + ')' : '') + (s.tijdvak ? ' | tijdvak ' + s.tijdvak : '') +
      (s.orderBron ? '\n    ' + direxUrl_(s.orderBron, dagIso) : '');
  };
  var text = 'Same day stops nalopen - ' + dag + '\n\n' + (stops.length
    ? 'Bewust niet uitgevoerd? Zie of vermoed je dat een stop bewust niet is uitgevoerd, meld dat dan aan ' + DAGMAIL.MELDEN_AAN +
      ' in de chatspace ' + DAGMAIL.MELDEN_IN + (DAGMAIL.MELDEN_URL ? ' (' + DAGMAIL.MELDEN_URL + ')' : '') + ', zodat zij het kan nakijken.\n\n' +
      'DS-STOP GEPLAND (' + gepland.length + '):\n' + (gepland.map(regel).join('\n') || '  Geen') +
      '\n\nZONDER DS-STOP (' + terug.length + '):\n' + (terug.map(regel).join('\n') || '  Geen')
    : 'Vandaag zijn er geen same day stops gelogd.');

  return {
    subject: 'Same day stops nalopen - ' + dagIso.slice(8, 10) + '-' + dagIso.slice(5, 7) + '-' + dagIso.slice(2, 4) + ' (' + stops.length + ')',
    html: html, text: text
  };
}

/**
 * De stops als lijst: één regel per stop met rit, tijdvak, taak en het ordernummer als link naar DireXtion.
 * Zonder DS-stop is er geen nieuwe rit of tijdvak; daar staan de oorspronkelijke rit en de uitkomst.
 */
function stopLijst_(lijst, dagIso, kleur, metDsStop) {
  var M = DM_KLEUR, font = DM_FONT.BODY;
  var th = function (tekst, breedte) {
    return '<td' + (breedte ? ' width="' + breedte + '"' : '') + ' style="padding:6px 8px;' + font + 'font-size:11px;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;color:' + M.muted + ';border-bottom:2px solid ' + kleur + ';">' + tekst + '</td>';
  };
  var td = function (inhoud, extra) {
    return '<td valign="top" style="padding:9px 8px;' + font + 'font-size:14px;color:' + M.text + ';border-bottom:1px solid ' + M.border + ';' + (extra || '') + '">' + inhoud + '</td>';
  };
  var rijen = lijst.map(function (s) {
    var url = direxUrl_(s.orderBron, dagIso);
    var taak = dmEsc_(s.probleem || 'Taak onbekend') +
      (s.product ? ' <span style="color:' + M.muted + ';">· ' + dmEsc_(s.product) + '</span>' : '') +
      (s.extraInfo ? '<div style="font-size:12px;font-style:italic;color:' + M.muted + ';margin-top:2px;">' + dmEsc_(s.extraInfo) + '</div>' : '');
    var order = url
      ? '<a href="' + dmEsc_(url) + '" target="_blank" style="color:' + M.blueLink + ';font-weight:bold;text-decoration:underline;">' + dmEsc_(s.orderBron) + '</a>'
      : '<span style="color:' + M.muted + ';">geen order</span>';
    return '<tr>' +
      td(dmEsc_((metDsStop ? s.geplandeRoute : s.route) || '–'), 'font-weight:bold;white-space:nowrap;') +
      td(dmEsc_((metDsStop ? s.tijdvak : s.dsWaarde) || '–'), metDsStop ? 'white-space:nowrap;' : '') +
      td(taak) +
      td(order, 'white-space:nowrap;') + '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' +
    '<tr>' + th(metDsStop ? 'Geplande rit' : 'Rit', 110) + th(metDsStop ? 'Tijdvak' : 'Uitkomst', metDsStop ? 110 : 150) + th('Taak') + th('Order', 90) + '</tr>' +
    rijen + '</table>';
}

// ---------- helpers ----------

function dmDag_(iso) {
  var DAGEN = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var p = iso.split('-').map(Number);
  return DAGEN[new Date(p[0], p[1] - 1, p[2]).getDay()] + ' ' + p[2] + ' ' + MAANDEN[p[1] - 1] + ' ' + p[0];
}

function dmEsc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Optioneel logo: alleen als het project een LOGO_PNG_B64 (base64 PNG) bevat. Anders alleen tekst in de kop. */
function dmLogo_() {
  try {
    if (typeof LOGO_PNG_B64 === 'undefined' || !LOGO_PNG_B64) return null;
    return Utilities.newBlob(Utilities.base64Decode(LOGO_PNG_B64), 'image/png', 'coolblue-logo.png');
  } catch (e) {
    return null;
  }
}

/** Verzonnen stops voor de testmail, in de vorm die stopsUitRijen_() oplevert. */
function demoStops_() {
  var s = function (o) {
    var basis = { tijd: '', user: '', route: '', depot: '', bezorgers: '', orderBron: '', orderOplossing: '', product: '',
      probleem: '', geplandeRoute: '', dsWaarde: '', bellerType: 'CBB', tijdvak: '', extraInfo: '', extraDienst: '', dsStop: true };
    Object.keys(o).forEach(function (k) { basis[k] = o[k]; });
    return basis;
  };
  return [
    s({ tijd: '09:28', user: 'Demo Medewerker', route: '1M-NLTI-06', depot: 'Tilburg', bezorgers: 'Held A', orderBron: '100000001', orderOplossing: '100000001-DS',
        product: 'Wasmachine', probleem: 'Plaatsen / Naar boven tillen', geplandeRoute: '2M-NLTI-09', dsWaarde: 'Ja stop gepland (same day)', tijdvak: '11:55 - 12:55' }),
    s({ tijd: '11:34', user: 'Demo Medewerker', route: '2M-NLRO-07', depot: 'Rotterdam', bezorgers: 'Held B & Held C', orderBron: '100000002', orderOplossing: '100000002-DS',
        product: 'Inbouw vaatwasser', probleem: 'Apparaat inbouwen (Keuken)', geplandeRoute: 'BI-NLRO-02', dsWaarde: 'Ja stop gepland (same day)', tijdvak: '14:10 - 15:10',
        extraDienst: 'Ja', extraInfo: 'Klant is vanaf 14:00 thuis' }),
    s({ tijd: '13:27', user: 'Demo Collega', route: '2M-NLGR-03', depot: 'Groningen', bezorgers: 'Held D & Held E', orderBron: '100000003', orderOplossing: '100000003-DS',
        product: 'Wasmachine', probleem: 'Stapelkit plaatsen', geplandeRoute: '2M-NLGR-09', dsWaarde: 'Ja stop gepland (same day)' }),
    s({ tijd: '12:24', user: 'Demo Collega', route: '1M-BEAN-04', depot: 'Antwerpen', orderBron: '100000004', product: 'Wasmachine',
        probleem: 'Held terugsturen (taak niet gespecificeerd)', dsWaarde: 'Teamleider stuurt helden terug', bellerType: 'Klantenservice', dsStop: false })
  ];
}
