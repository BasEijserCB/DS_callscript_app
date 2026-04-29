(function(){

  // ── PAGINA DETECTIE ───────────────────────────────────────────
  var isBasicPage = window.location.pathname.toLowerCase().indexOf('/basic') !== -1;

  // ── BASIC HELPER — beschikbaar op beide pagina's ──────────────
  // Zoekt via de .details-field structuur van DireXtion Basic.
  function basicField(labelText) {
    var fields = document.querySelectorAll('.details-field');
    for (var i = 0; i < fields.length; i++) {
      var labelEl = fields[i].querySelector('.details-field-label p');
      var valueEl = fields[i].querySelector('.details-field-value p');
      if (labelEl && valueEl && labelEl.textContent.trim() === labelText) {
        return valueEl.textContent.trim();
      }
    }
    return '';
  }

  // Zoekt een veld binnen een specifieke sectie (bijv. "Geadresseerde") om
  // dubbelzinnige labels zoals "Telefoonnummer" en "E-mailadres" te vermijden —
  // die staan ook in de Verlader sectie.
  function basicFieldInSection(sectionName, labelText) {
    var rows = document.querySelectorAll('.details-row');
    for (var r = 0; r < rows.length; r++) {
      var header = rows[r].querySelector('.details-content-header p');
      if (header && header.textContent.trim().indexOf(sectionName) !== -1) {
        var fields = rows[r].querySelectorAll('.details-field');
        for (var i = 0; i < fields.length; i++) {
          var labelEl = fields[i].querySelector('.details-field-label p');
          var valueEl = fields[i].querySelector('.details-field-value p');
          if (labelEl && valueEl && labelEl.textContent.trim() === labelText) {
            return valueEl.textContent.trim();
          }
        }
      }
    }
    return '';
  }

  // ── SCRAPEN ──────────────────────────────────────────────────
  // Het ordernummer is het anker: als dat er is, is de DOM klaar.
  // We pollen max 3 seconden voordat we verdergaan (ook als het leeg blijft).
  function doScrapeAndInit() {
  var scrapedOrder, scrapedRoute, scrapedAdres, scrapedPC, scrapedAdresQuery, driver1, driver2, alleGescrapteProducten, scrapedArtikelsoortenMap, scrapedTijdvak, scrapedAankomsttijd;

  if (!isBasicPage) {
    // ── CONSUMER PORTAL ────────────────────────────────────────
    const getTxt = (sel) => {
      const el = document.querySelector("[data-bind*='" + sel + "']");
      return el ? el.innerText.trim() : '';
    };
    scrapedOrder = (getTxt('OrderNumberTransport').match(/\d{8}/) || [''])[0];
    scrapedRoute  = getTxt('Static.TourName');
    scrapedAdres  = getTxt('Static.Visit.Address') || getTxt('ConsigneeAddress') || '';
    scrapedPC     = (getTxt('Static.Visit.PostalCode').match(/^\d{4}\s?[A-Z]{2}|^\d{4,5}/i) || [''])[0].trim();
    var driverEls = document.querySelectorAll("[data-bind*='DriversFirstName']");
    driver1       = driverEls.length > 0 ? driverEls[0].innerText.trim() : '';
    driver2       = driverEls.length > 1 ? driverEls[1].innerText.trim() : '';
    alleGescrapteProducten = Array.from(document.querySelectorAll("[data-bind*='ArticleDescription']"))
      .map(function(el){ return el.innerText.trim(); })
      .filter(function(naam){
        var n = naam.toLowerCase();
        return naam && !n.includes('coolblue-doos') && !n.includes('coolblue box') && !n.includes('rest van je bestelling') && !n.includes('rest of your order') && !n.includes('verzameldoos');
      })
      .filter(function(naam, idx, arr){ return arr.indexOf(naam) === idx; });
    var tvStart = getTxt('Static.Visit.EarliestArrivalTimeStamp');
    var tvEind  = getTxt('Static.Visit.LatestArrivalTimeStamp');
    scrapedTijdvak      = (tvStart && tvEind) ? tvStart + ' - ' + tvEind : (tvStart || tvEind);
    scrapedAankomsttijd = getTxt('ActualArrivalDateTime');
  } else {
    // ── BASIC MODULE ───────────────────────────────────────────
    // Ordernummer: uit DOM velden via basicField
    var rawOrder = basicField('Pakbonnummer') || basicField('Order nr. verlader') || basicField('Afnemer nummer') || '';
    scrapedOrder  = (rawOrder.match(/\d{8}/) || [''])[0];

    // Route: Alias geeft het korte formaat ("2M-BEAN-07"), Ritnaam het lange ("2M-BEAN-07-7")
    scrapedRoute  = basicField('Alias') || basicField('Ritnaam') || '';

    // Adres en postcode staan als losse velden in de Geadresseerde sectie
    scrapedAdres  = basicField('Adres') || '';
    scrapedPC     = basicField('Postcode') || '';

    // Rijders staan niet op de Basic orderdetailpagina
    driver1 = '';
    driver2 = '';
    scrapedTijdvak      = basicField('Tijdsvenster').replace(/\s+/g, ' ').trim();
    scrapedAankomsttijd = basicField('Geplande aankomsttijd');

    // Producten uit de DevExpress artikelentabel (Articles_XXXXXXX).
    // Celindices per rij: 0 = uitklap-knop, 1 = Nummer, 2 = Omschrijving, 3 = Code, 4 = Artikelsoort
    // Selector gebruikt class*="dxgvDataRow" (thema-onafhankelijk, vangt ook Office2010Blue e.d.)
    scrapedArtikelsoortenMap = {};
    alleGescrapteProducten = (function() {
      var dataRows = document.querySelectorAll('table[id^="Articles_"] tr[class*="dxgvDataRow"]');
      var results = [];
      dataRows.forEach(function(row) {
        var cells = row.children;
        if (cells.length < 5) return;
        var omschrijving  = (cells[2].textContent || '').trim();
        var artikelsoort  = (cells[4].textContent || '').trim().toLowerCase();
        if (!omschrijving) return;
        var n = omschrijving.toLowerCase();
        // Filter bekende niet-producten op beschrijving
        if (n.includes('coolblue-doos') || n.includes('coolblue box') ||
            n.includes('rest van je bestelling') || n.includes('rest of your order') ||
            n.includes('verzameldoos')) return;
        // Filter op artikelsoort
        if (artikelsoort === 'barcodes') return;
        // Filter losse barcodestrings (puur hoofdletters + cijfers, geen spaties, ≥6 tekens)
        if (/^[A-Z0-9]{6,}$/.test(omschrijving)) return;
        if (results.indexOf(omschrijving) === -1) {
          results.push(omschrijving);
          scrapedArtikelsoortenMap[omschrijving] = artikelsoort;
        }
      });
      return results;
    })();
  }

  scrapedAdresQuery = encodeURIComponent((scrapedAdres + ' ' + scrapedPC).trim());
  var scrapedModel = alleGescrapteProducten.length > 0 ? alleGescrapteProducten[0] : '';

  // ── MODEL HERKENNING ─────────────────────────────────────────
  var prefixTabel = {
    // ── BESTAANDE MERKEN (ongewijzigd) ──────────────────────────
    'aeg':      [['WD','wasdroogcombinatie'],['L9WBG','wasdroogcombinatie'],['L8WBG','wasdroogcombinatie'],['L7WBG','wasdroogcombinatie'],['LF','wasmachine'],['LR','wasmachine'],['L6','wasmachine'],['L7','wasmachine'],['L8','wasmachine'],['L9','wasmachine'],['T7','droger'],['T8','droger'],['T9','droger'],['BEB','oven'],['BES','oven'],['BCK','oven'],['BSK','oven'],['BEK','oven'],['MBE','magnetron'],['MBB','magnetron'],['MSB','magnetron'],['IAE','kookplaat'],['IKE','kookplaat'],['IEE','kookplaat'],['IKB','kookplaat'],['IPE','kookplaat'],['HK','kookplaat'],['FFB','vaatwasser'],['FEE','vaatwasser'],['FSE','inbouw vaatwasser'],['FES','vaatwasser'],['RCB','koelkast'],['SCB','koelkast'],['ABE','koelkast'],['SKB','inbouw koelkast'],['SFB','inbouw koelkast'],['RKB','koelkast'],['AGN','vriezer'],['ABB','vriezer'],['AGB','vriezer'],['AFB','vriezer']],
    'atag':     [['KD','koelkast'],['KS','koelkast'],['KB','koelkast'],['VA','vaatwasser'],['DW8','inbouw vaatwasser'],['DW','vaatwasser'],['OP','oven'],['FG','fornuis'],['CR','fornuis'],['HG','kookplaat'],['HI','kookplaat'],['HE','kookplaat']],
    'beko':     [['WTV','wasmachine'],['WTE','wasmachine'],['WUE','wasmachine'],['B3WFU','wasdroogcombinatie'],['BUI','wasdroogcombinatie'],['WT','wasmachine'],['WU','wasmachine'],['WM','wasmachine'],['B1W','wasmachine'],['BM3W','wasmachine'],['B3W','wasmachine'],['DH','droger'],['DPY','droger'],['B3T','droger'],['BDIN','inbouw vaatwasser'],['DIN','inbouw vaatwasser'],['BDI','inbouw vaatwasser'],['DFN','vaatwasser'],['BDFN','vaatwasser'],['HII','kookplaat'],['HIG','kookplaat'],['HIW','kookplaat'],['HICD','kookplaat'],['MCI','combi-oven'],['BIM','oven'],['BIE','oven'],['BIC','oven'],['BBO','oven'],['RFNE','vriezer'],['B1RFNE','vriezer'],['GN','vriezer'],['RCNA','koelkast'],['BCNA','koelkast'],['RDSA','koelkast'],['BSSA','koelkast'],['SSE','koelkast']],
    'bosch':    [['WNA','wasdroogcombinatie'],['WDU','wasdroogcombinatie'],['WAN','wasmachine'],['WAX','wasmachine'],['WAU','wasmachine'],['WGB','wasmachine'],['WGG','wasmachine'],['WUU','wasmachine'],['WA','wasmachine'],['WG','wasmachine'],['WN','wasmachine'],['WU','wasmachine'],['WTH','droger'],['WTL','droger'],['WTW','droger'],['WTX','droger'],['WQG','droger'],['WQ','droger'],['WT','droger'],['WP','droger'],['SMS','vaatwasser'],['SPS','vaatwasser'],['SMV','inbouw vaatwasser'],['SMI','inbouw vaatwasser'],['SMU','inbouw vaatwasser'],['SMD','inbouw vaatwasser'],['SPV','inbouw vaatwasser'],['SPI','inbouw vaatwasser'],['SBD','inbouw vaatwasser'],['SBV','inbouw vaatwasser'],['KIL','inbouw koelkast'],['KIR','inbouw koelkast'],['KGN','koelkast'],['KGE','koelkast'],['KGL','koelkast'],['KGV','koel-vries combo'],['KGC','koelkast'],['KSV','koelkast'],['KFN','koelkast'],['KAN','koelkast'],['KG','koelkast'],['GIN','inbouw vriezer'],['GID','inbouw vriezer'],['GSN','vriezer'],['GSD','vriezer'],['HBG','oven'],['HBA','oven'],['HBD','oven'],['HRG','oven'],['HND','oven'],['HNG','oven'],['HBC','oven'],['CMG','oven'],['CMA','oven'],['CSG','oven'],['BFL','magnetron'],['BFR','magnetron'],['BEL','magnetron'],['BER','magnetron'],['FEL','magnetron'],['HGD','fornuis'],['HKS','fornuis'],['HKR','fornuis'],['HLN','fornuis'],['PKN','kookplaat'],['PKE','kookplaat'],['PIX','kookplaat'],['PVS','kookplaat'],['PID','kookplaat'],['PIF','kookplaat'],['PIE','kookplaat'],['NIT','kookplaat'],['NGM','kookplaat']],
    'etna':     [['KK','koelkast'],['KC','koelkast'],['KS','koelkast'],['AKV','koelkast'],['VW','vaatwasser'],['FI','vaatwasser'],['OEP','oven'],['OEM','oven'],['MAG','magnetron'],['FGV','fornuis'],['FEC','fornuis'],['KIF','kookplaat'],['KIG','kookplaat'],['KEK','kookplaat']],
    'haier':    [['HTF','koelkast'],['AFD','koelkast'],['HBW','koelkast'],['H2F','vriezer'],['HFR','koelkast'],['HW','wasmachine']],
    'hoover':   [['H3','wasmachine'],['H5','wasmachine'],['DX','wasmachine'],['HL','wasmachine'],['HWP','wasmachine'],['VT','wasmachine']],
    'inventum': [['VW','wasmachine'],['VK','koelkast'],['VR','koelkast'],['IK','koelkast'],['CA','koelkast'],['IVW','inbouw vaatwasser'],['VVW','vaatwasser']],
    'lg':       [['F4DN','wasdroogcombinatie'],['F4DU','wasdroogcombinatie'],['CC','wasdroogcombinatie'],['GD','wasdroogcombinatie'],['F4J','wasdroogcombinatie'],['F2','wasmachine'],['F4','wasmachine'],['F6','wasmachine'],['GC','wasmachine'],['WV','wasmachine'],['FH','wasmachine'],['RC','droger'],['DV','droger'],['RH','droger'],['DF','inbouw vaatwasser'],['GBB','koelkast'],['GSJ','koelkast'],['GML','koelkast'],['GRT','koelkast'],['GB','koelkast'],['GS','koelkast'],['FV','vriezer'],['LB','oven'],['WSED','oven'],['MS','magnetron'],['MC','magnetron'],['MH','magnetron'],['SN','soundbar'],['SP','soundbar'],['SQ','soundbar'],['SC','soundbar'],['DS','soundbar'],['HW','soundbar']],
    'liebherr': [['ICBd','inbouw koelkast'],['IRe','inbouw koelkast'],['CNd','koelkast'],['CTe','koelkast'],['CUb','koelkast'],['GNP','vriezer'],['GP','vriezer'],['GT','vriezer'],['GN','vriezer'],['RB','koelkast'],['SK','koelkast'],['IC','inbouw koelkast'],['SI','inbouw koelkast'],['CN','koelkast'],['CU','koelkast']],
    'samsung':  [['WD','wasdroogcombinatie'],['WW','wasmachine'],['WF','wasmachine'],['DV','droger'],['DW','inbouw vaatwasser'],['RB','koelkast'],['RL','koelkast'],['RF','koelkast'],['RR','koelkast'],['RS','koelkast'],['RZ','vriezer'],['NV','oven'],['MS','magnetron'],['MC','magnetron'],['MG','magnetron'],['NX','fornuis'],['NZ','kookplaat'],['HW','soundbar'],['QE','televisie'],['UE','televisie']],
    'siemens':  [['WD','wasdroogcombinatie'],['WM','wasmachine'],['WG','wasmachine'],['WS','wasmachine'],['WN','wasdroogcombinatie'],['WP','wasmachine'],['WT','droger'],['WQ','droger'],['WR','droger'],['SN63','vaatwasser'],['SN','inbouw vaatwasser'],['SR','vaatwasser'],['SX','inbouw vaatwasser'],['KI','inbouw koelkast'],['KS','koelkast'],['KG','koelkast'],['GI','inbouw vriezer'],['GS','vriezer'],['HB','oven'],['HS','oven'],['HM','magnetron'],['HX','fornuis'],['HR','fornuis'],['BE','magnetron'],['BF','magnetron'],['HF','magnetron'],['EX','kookplaat'],['ET','kookplaat'],['EU','kookplaat'],['EH','kookplaat'],['ER','kookplaat']],
    'veripart': [['VPW','wasmachine'],['VPT','droger'],['VPK','koelkast'],['VPVR','vriezer']],
    'whirlpool':[['FWDG','wasdroogcombinatie'],['FFB','wasmachine'],['FSCR','wasmachine'],['W6','wasmachine'],['W7','wasmachine'],['W8','wasmachine'],['FS','wasmachine'],['HS','wasmachine'],['AW','wasmachine'],['FT','droger'],['FFT','droger'],['HSCX','droger'],['W6D','droger'],['W7D','droger'],['CWD','droger'],['WIC','inbouw vaatwasser'],['WIO','inbouw vaatwasser'],['WFC','vaatwasser'],['WKIC','inbouw vaatwasser'],['WFO','vaatwasser'],['FF','vaatwasser'],['WB','koelkast'],['ARG','koelkast'],['ART','koelkast'],['ARZ','koelkast'],['WME','koelkast'],['SW','inbouw koelkast'],['UW','vriezer'],['WV','vriezer'],['AFG','vriezer'],['AKZ','oven'],['W7OS','oven'],['W9OS','oven'],['W11OS','oven'],['MWP','magnetron'],['W6MW','magnetron'],['W7MW','magnetron'],['AMW','magnetron'],['AKT','kookplaat'],['WLC','kookplaat'],['WLG','kookplaat'],['SMP','kookplaat']],
    'wisberg':  [['WBWM','wasmachine'],['WBDR','droger'],['WBDW','vaatwasser'],['WBBI','inbouw vaatwasser'],['WBKVC','koel-vries combo'],['WBKK','koelkast'],['WBKV','vriezer'],['WBVR','vriezer'],['WBCF','vriezer'],['WBCDND','koel-vries combo'],['WBSBSW','koelkast'],['WBSBS','koelkast'],['WBTM','koelkast'],['WBTT','koelkast'],['WBMKK','koelkast'],['WBMVR','vriezer']],
    'zanussi':  [['ZWF','wasmachine'],['ZW','wasmachine'],['ZDT','inbouw vaatwasser'],['ZDTS','inbouw vaatwasser'],['ZP','droger'],['ZD','droger'],['ZOB','oven'],['ZOPNA','oven']],
    // ── NIEUWE MERKEN ────────────────────────────────────────────
    'miele':    [['WCA','wasmachine'],['WCB','wasmachine'],['WCE','wasmachine'],['WCI','wasdroogcombinatie'],['WWG','wasmachine'],['WWH','wasmachine'],['WTD','wasdroogcombinatie'],['TCE','droger'],['TCJ','droger'],['TCI','droger'],['TCR','droger'],['TWF','droger'],['TWI','droger'],['TWR','droger'],['TKG','droger'],['G','vaatwasser'],['KFN','koelkast'],['KD','koelkast'],['KS','koelkast'],['K','koelkast'],['FN','vriezer'],['F','vriezer'],['H','oven'],['M','magnetron'],['KM','kookplaat']],
    'electrolux':[['EW6F','wasmachine'],['EW7F','wasmachine'],['EW8F','wasmachine'],['EW9F','wasmachine'],['EW6C','droger'],['EW7C','droger'],['EW8C','droger'],['EW9C','droger'],['EEM','vaatwasser'],['ESM','vaatwasser'],['ESF','vaatwasser'],['EES','inbouw vaatwasser'],['ERB','koelkast'],['LRB','koelkast'],['LRT','koelkast'],['ENL','koelkast'],['ENT','koelkast'],['EOC','oven'],['EVL','oven'],['EZC','oven'],['OEL','oven'],['EOF','oven']],
    'hisense':  [['WFGA','wasmachine'],['WFQY','wasmachine'],['WFGE','wasmachine'],['WDQA','wasdroogcombinatie'],['DHGE','droger'],['HV','vaatwasser'],['RB','koelkast'],['RS','koelkast'],['FV','vriezer'],['AX','soundbar'],['U','televisie'],['A','televisie'],['E','televisie']],
    'neff':     [['B','oven'],['T','kookplaat']],
    'hotpoint': [['NSWA','wasmachine'],['NM11','wasmachine']],
    'indesit':  [['MTWSA','wasmachine'],['BWE','wasmachine'],['BWSA','wasmachine']],
    'philips':  [['PUS','televisie'],['PFS','televisie'],['TAB','soundbar']],
    'panasonic':[['TX','televisie'],['NN','magnetron']],
    'sony':     [['XR','televisie'],['KD','televisie'],['HT','soundbar']],
    'grundig':  [['GFU','televisie'],['GFUE','televisie']],
    'tcl':      [['C','televisie'],['P','televisie'],['Q','televisie'],['TS','soundbar']],
    'yamaha':   [['SR','soundbar'],['YAS','soundbar']],
    'jbl':      [['Bar','soundbar']],
    'denon':    [['DHT','soundbar']],
    'smeg':     [['SF','oven'],['A','fornuis'],['CPF','fornuis'],['TR','fornuis'],['SI','kookplaat'],['PV','kookplaat'],['SR','kookplaat']]
  };

  function detecteerType(naam) {
    if (!naam) return null;
    var merk = naam.trim().split(/\s+/)[0].toLowerCase();
    if (!prefixTabel[merk]) return { merk:merk, typeGuess:null };
    var tokens = naam.trim().replace(/^\S+\s*/,'').split(/\s+/).map(function(t){ return t.toUpperCase().replace(/[^A-Z0-9]/g,''); }).filter(function(t){ return t.length>0; });
    var rules = prefixTabel[merk], lM='', lT='';
    for (var ti=0; ti<tokens.length; ti++) {
      // Probeer eerst het volledige token, dan met leading digits gestript (voor TV's als "65PUS8808")
      var tok = tokens[ti];
      var tokStripped = tok.replace(/^\d+/,'');
      var candidates = tokStripped && tokStripped !== tok ? [tok, tokStripped] : [tok];
      for (var ci=0; ci<candidates.length; ci++) {
        for (var i=0; i<rules.length; i++) {
          if (candidates[ci].indexOf(rules[i][0])===0 && rules[i][0].length>lM.length) { lM=rules[i][0]; lT=rules[i][1]; }
        }
      }
    }
    return { merk:merk, typeGuess:lT||null };
  }

  function artikelsoortNaarProduct(soort) {
    var map = {
      'wasmachine':'Wasmachine','wasdroogcombinatie':'Wasdroogcombinatie','droger':'Droger',
      'koelkast':'Koelkast / Vriezer','inbouw koelkast':'Koelkast / Vriezer',
      'vriezer':'Koelkast / Vriezer','inbouw vriezer':'Koelkast / Vriezer','koel-vries combo':'Koelkast / Vriezer',
      'vaatwasser':'Vaatwasser','inbouw vaatwasser':'Vaatwasser',
      'televisie':'Televisie','soundbar':'Soundbar',
      'oven':'Oven / Magnetron','magnetron':'Oven / Magnetron',
      'inbouw oven':'Oven / Magnetron','inbouw magnetron':'Oven / Magnetron','combi-oven':'Combi-oven',
      'kookplaat':'Kookplaat','inductiekookplaat':'Kookplaat','gaskookplaat':'Kookplaat',
      'fornuis':'Fornuis','afzuigkap':'Afzuigkap','wasemkap':'Afzuigkap'
    };
    return map[(soort || '').trim()] || null;
  }

  // ── UI SETUP ─────────────────────────────────────────────────
  if (document.getElementById('ds-combi-wrapper')) document.getElementById('ds-combi-wrapper').remove();
  var wrapper = document.createElement('div');
  wrapper.id = 'ds-combi-wrapper';
  // Op Basic links-onder zodat het de interface minder verstoort; op consumer portal rechts-boven
  var wrapperPos = 'bottom:20px;left:20px;';
  wrapper.style.cssText = 'position:fixed;' + wrapperPos + 'width:340px;background:#fff;border:2px solid #0090e3;box-shadow:0 8px 24px rgba(0,0,0,0.18);z-index:999999;border-radius:10px;overflow:hidden;';
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:620px;border:none;background:#fff;display:block;';
  wrapper.appendChild(iframe); document.body.appendChild(wrapper);
  var idoc = iframe.contentDocument || iframe.contentWindow.document;

  idoc.head.innerHTML = '<style>' +
    'html,body{height:100%;margin:0;padding:0;overflow:hidden;font-family:"Segoe UI",Arial,sans-serif;color:#333333;}' +
    '.app{display:flex;flex-direction:column;height:100%;}' +
    '.header{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #DDDDDD;flex-shrink:0;background:#fff;}' +
    '.header-title{color:#285dab;font-size:17px;font-weight:700;}' +
    '.header-actions{display:flex;gap:6px;align-items:center;}' +
    '.toggle-btn{font-size:10px;background:#F3F3F3;border:1px solid #DDDDDD;color:#999999;padding:3px 9px;border-radius:4px;cursor:pointer;}' +
    '.close-btn{font-size:16px;background:none;border:none;color:#999999;cursor:pointer;padding:0 4px;line-height:1;font-weight:300;}' +
    '.close-btn:hover{color:#333333;}' +
    '.content{flex-shrink:0;padding:14px;}' +
    '.status-bar{font-size:11px;background:#F2F7FC;border:1px solid #cce9f9;padding:8px 12px;border-radius:6px;margin-bottom:12px;color:#285dab;}' +
    '.status-line{display:block;margin-bottom:2px;}' +
    '.footer{padding:10px 14px;border-top:1px solid #DDDDDD;flex-shrink:0;background:#fff;}' +
    '.footer-inner{display:flex;flex-direction:column;gap:6px;}' +
    '.footer-hint{font-size:11px;color:#999999;text-align:center;line-height:1.4;}' +
    '.back-btn{width:100%;padding:9px;background:#fff;border:1px solid #DDDDDD;border-radius:8px;color:#DDDDDD;font-size:13px;cursor:default;}' +
    '.back-btn.active{border-color:#0090e3;color:#0090e3;cursor:pointer;}' +
    '.back-btn.active:hover{background:#F2F7FC;}' +
    'label{font-size:14px;font-weight:600;color:#333333;display:block;margin-bottom:8px;}' +
    'input[type=text]{width:100%;padding:9px 11px;border:1px solid #DDDDDD;border-radius:6px;font-size:14px;box-sizing:border-box;color:#333333;outline:none;}' +
    'input[type=text]:focus{border-color:#0090e3;}' +
    '.ux-btn{width:100%;text-align:left;padding:9px 13px;margin-bottom:5px;border:1px solid #DDDDDD;border-radius:8px;background:#F2F7FC;cursor:pointer;font-size:13px;color:#333333;font-weight:500;transition:0.12s;}' +
    '.btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:0;}' +
    '.btn-grid .ux-btn{margin-bottom:0;font-size:12px;padding:8px 10px;}' +
    '.ux-btn.selected{background:#d4edda;border-color:#00B900;color:#155724;font-weight:600;}' +
    '.advies-btn{background:#fff3eb;border-color:#ff6600;color:#ff6600;}' +
    '.advies-btn:hover{background:#ffe8d6;border-color:#cc5200;color:#cc5200;}' +
    '.action-btn{width:100%;padding:11px;border:none;border-radius:8px;background:#0090e3;color:white;font-weight:600;cursor:pointer;font-size:14px;margin-top:8px;}' +
    '.action-btn:hover{background:#007bc4;}' +
    '.submit-btn{background:#00B900;}' +
    '.submit-btn:hover{background:#009900;}' +
    '.summary-box{font-size:12px;background:#F2F7FC;padding:12px;border-radius:8px;border-left:4px solid #cce9f9;margin-bottom:10px;color:#333333;line-height:1.6;}' +
    '.warning-box{font-size:12px;background:#fff0f0;border:1px solid #E50000;border-left:4px solid #E50000;padding:10px 12px;border-radius:6px;color:#E50000;margin-bottom:10px;line-height:1.5;}' +
    '.controle-box{background:#F2F7FC;border:1px solid #cce9f9;border-left:4px solid #0090e3;border-radius:6px;padding:10px 12px;margin-bottom:10px;}' +
    '.controle-title{font-size:11px;font-weight:700;color:#285dab;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;}' +
    '.controle-item{font-size:13px;color:#285dab;margin-bottom:5px;line-height:1.4;}' +
    '.controle-item:last-child{margin-bottom:0;}' +
    '.info-box{font-size:12px;background:#F2F7FC;border:1px solid #cce9f9;border-left:4px solid #0090e3;padding:10px 12px;border-radius:6px;color:#285dab;margin-bottom:10px;line-height:1.5;}' +
    '.section-divider{border:none;border-top:1px solid #DDDDDD;margin:10px 0 8px;}' +
    '.section-label{font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;}' +
    '.toggle-link{font-size:12px;color:#0090e3;text-align:center;margin:6px 0;cursor:pointer;}' +
    '.toggle-link:hover{text-decoration:underline;}' +
    '.park-melding{background:#fff8e1;border:1px solid #ffc107;border-left:4px solid #ffc107;border-radius:6px;padding:10px 12px;font-size:12px;color:#856404;margin-bottom:12px;line-height:1.5;}' +
    '.park-melding b{color:#533f03;}' +
    '.main-row{display:flex;flex:1;min-height:0;overflow:hidden;}' +
    '.main-row .content{flex:1;overflow-y:auto;min-width:0;padding:14px;}' +
    '.sidebar{flex:1;border-left:2px solid #DDDDDD;overflow-y:auto;background:#FAFAFA;padding:8px 10px;box-sizing:border-box;font-size:12px;}' +
    '.anders-scroll{flex:1;overflow-y:auto;min-height:0;padding:8px 14px;box-sizing:border-box;border-top:1px solid #DDDDDD;}' +
    '.resize-btn{font-size:11px;background:#F3F3F3;border:1px solid #DDDDDD;color:#666;padding:3px 8px;border-radius:4px;cursor:pointer;font-weight:600;}' +
    '.resize-btn:hover{background:#E8E8E8;}' +
    '.advies-knop{background:#F0FFF0;border-color:#b2dfb2;}' +
    '.afwijkend-knop{background:#FFFFF0;border-color:#e0e0a0;}' +
    '</style>';

  var appContainer = idoc.createElement('div');
  idoc.body.appendChild(appContainer);

  // ── STATE ─────────────────────────────────────────────────────
  var bFname = localStorage.getItem('ds_fname'), bLname = localStorage.getItem('ds_lname');
  var dsHeight = parseInt(localStorage.getItem('ds_height') || '620');
  var dsWide = localStorage.getItem('ds_wide') === '1';

  // Maximale hoogte op basis van viewport, met 40px marge (20px boven + 20px onder)
  function maxViewportHeight() { return window.innerHeight - 40; }
  function clampHeight(h) { return Math.min(h, maxViewportHeight()); }
  var answeredKeys = [], autoFilledKeys = [];
  var geenOrderMode = false;

  // Apply initial sizing
  dsHeight = clampHeight(dsHeight);
  iframe.style.height = dsHeight + 'px';
  wrapper.style.width = dsWide ? '600px' : '340px';

  // ── PARKEER FUNCTIE ───────────────────────────────────────────
  var PARK_KEY = 'ds_park_' + scrapedOrder;

  function parkeerSessie() {
    var staat = { callData: callData, answeredKeys: answeredKeys, autoFilledKeys: autoFilledKeys, isProductAutoGuessed: isProductAutoGuessed, timestamp: Date.now() };
    localStorage.setItem(PARK_KEY, JSON.stringify(staat));
    wrapper.remove();
  }

  function herstelSessie(staat) {
    Object.assign(callData, staat.callData);
    answeredKeys = staat.answeredKeys || [];
    autoFilledKeys = staat.autoFilledKeys || [];
    isProductAutoGuessed = staat.isProductAutoGuessed || false;
  }

  function verwijderGeparkeerd() {
    localStorage.removeItem(PARK_KEY);
  }

  function vindAndereGeparkeerdeSessies() {
    var sessies = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith('ds_park_') && key !== PARK_KEY) {
        var val = localStorage.getItem(key);
        try {
          var s = JSON.parse(val);
          if (s && s.callData && s.callData.orderBron) sessies.push({ key: key, orderBron: s.callData.orderBron });
        } catch(e) {}
      }
    }
    return sessies;
  }

  var startMelding = '';

  // ── PRODUCT SETUP ─────────────────────────────────────────────
  // Bouw per gescrapt product een keuze-label: "ETNA FGV160RVS - Vaatwasser"
  function maakProductLabel(naam) {
    var det = detecteerType(naam);
    var type = det && det.typeGuess ? det.typeGuess.charAt(0).toUpperCase()+det.typeGuess.slice(1) : null;
    // TV check
    var n = naam.toLowerCase();
    if (!type && (n.includes('tv')||n.includes('televisie')||n.match(/(oled|qled)/))) type = 'Televisie';
    return type ? type + ' (' + naam + ')' : naam;
  }

  var meerdereProducten = alleGescrapteProducten.length > 1;
  var isProductAutoGuessed = false;

  var callData = {
    user: (bFname && bLname) ? (bFname+' '+bLname) : '',
    route: scrapedRoute, orderBron: scrapedOrder,
    driver1: driver1, driver2: driver2,
    depot: 'Onbekend', model: scrapedModel,
    bellerType: '',
    locatie:'', probleem:'', milieuretour_type:'',
    product:'', formaatTV:'',
    uitkomst:'', geplandeRoute:'',
    next_day_reden:'', geen_oplossing_reden:'',
    advies_gelukt:'',
    onderweg_type:'', onderweg_uitkomst:'',
    ks_reden:'', ks_uitkomst:'',
    afwijkend_reden:'', afwijkend_toelichting:'',
    cbf_depot_reden:'', cbf_depot_toelichting:'',
    cbf_pakket_reden:'', cbf_pakket_uitkomst:'',
    cbb_hub_reden:'', cbb_hub_toelichting:'',
    tl_reden:'', tl_uitkomst:'',
    winkel_reden:'', ks_advies_uitkomst:'',
    orderOplossing:'', dsWaarde:'',
    tijdvak: scrapedTijdvak||'', aankomsttijd: scrapedAankomsttijd||'',
    dienstType:'', productVerfijnd:'', tvNetwerk:''
  };

  if (bFname) { callData.fname=bFname; answeredKeys.push('fname'); autoFilledKeys.push('fname'); }
  if (bLname) { callData.lname=bLname; answeredKeys.push('lname'); autoFilledKeys.push('lname'); }

  // ── STARTUP: CHECK GEPARKEERDE SESSIE ─────────────────────────
  var geparkeerdeDezeOrder = localStorage.getItem(PARK_KEY);
  if (geparkeerdeDezeOrder) {
    try {
      var staat = JSON.parse(geparkeerdeDezeOrder);
      herstelSessie(staat);
      startMelding = 'hervatten';
    } catch(e) { localStorage.removeItem(PARK_KEY); }
  } else {
    var andereSessies = vindAndereGeparkeerdeSessies();
    if (andereSessies.length > 0) {
      startMelding = 'andere_orders:' + andereSessies.map(function(s){ return s.orderBron; }).join(',');
    }
  }

  // Bij één product: auto-fill zoals voorheen
  if (!meerdereProducten && scrapedModel) {
    // Op Basic: artikelsoort uit de tabel is een directe bron — gebruik die eerst
    if (isBasicPage && scrapedArtikelsoortenMap && scrapedArtikelsoortenMap[scrapedModel]) {
      var soortProduct = artikelsoortNaarProduct(scrapedArtikelsoortenMap[scrapedModel]);
      if (soortProduct) {
        callData.product = soortProduct;
        answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true;
      }
    }
    var det = detecteerType(scrapedModel);
    if (!answeredKeys.includes('product') && det && det.typeGuess) {
      callData.product = det.typeGuess.charAt(0).toUpperCase()+det.typeGuess.slice(1);
      answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true;
    }
    var strModel = scrapedModel.toLowerCase();
    // TV: check via keywords + prefix-detectie, haal schermgrootte op
    if (!answeredKeys.includes('product') && (strModel.includes('tv')||strModel.includes('televisie')||strModel.match(/(oled|qled|inch)/i)||(det&&det.typeGuess==='televisie'))) {
      callData.product='Televisie';
      answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true;
    }
    if (answeredKeys.includes('product') && callData.product==='Televisie') {
      // Schermgrootte: strip leading digits voor merken die size-first noteren (Philips, Hisense, TCL)
      var tvStr = scrapedModel.replace(/^\S+\s*/,''); // verwijder merknaam
      var tvM = tvStr.match(/(?:qe|oled|kd|xr|ue|tx-?)?([4-8]\d)[a-z]/i) ||
                tvStr.match(/\b([4-8]\d)\s?(inch|")\b/i) ||
                tvStr.match(/^(\d{2})[A-Z]/i); // size-first: 65PUS, 55U, 55C
      if (tvM) {
        callData.formaatTV = parseInt(tvM[1])>=55 ? 'Ja (>= 55 inch)' : 'Nee (< 55 inch)';
        answeredKeys.push('formaatTV'); autoFilledKeys.push('formaatTV');
      }
    } else if (!answeredKeys.includes('product')) {
      // Gebruik prefix-detectie voor overige types
      if (det && det.typeGuess) {
        var tg = det.typeGuess;
        if (tg==='soundbar') { callData.product='Soundbar'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (tg==='combi-oven') { callData.product='Combi-oven'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (tg==='oven'||tg==='magnetron') { callData.product='Oven / Magnetron'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (tg==='fornuis') { callData.product='Fornuis'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (tg==='kookplaat') { callData.product='Kookplaat'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
      }
      // Keyword fallback voor keukenapparatuur
      if (!answeredKeys.includes('product')) {
        if (strModel.includes('oven')||strModel.includes('magnetron')) { callData.product='Oven / Magnetron'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (strModel.includes('kookplaat')||strModel.includes('inductie')) { callData.product='Kookplaat'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (strModel.includes('fornuis')) { callData.product='Fornuis'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (strModel.includes('afzuigkap')||strModel.includes('wasemkap')) { callData.product='Afzuigkap'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (strModel.includes('soundbar')||strModel.includes('sound bar')) { callData.product='Soundbar'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        else if (strModel.includes('tussenstuk')||strModel.includes('stapelplaats')) { callData.product='Wasmachine'; answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
      }
    }
  }
  // Bij meerdere producten: model leeg laten, keuzestap volgt in flow

  // ── ROUTE PARSER ─────────────────────────────────────────────
  function parseToTourAlias(input) {
    if (!input) return '';
    var str=input.toLowerCase(), netwerk='', depotInfo=null, nummer='';
    var nw=[{code:'1X',keys:['1x','installatie','install','1mans','1 mans']},{code:'1M',keys:['1m']},{code:'2M',keys:['2m']},{code:'BI',keys:['built in','built-in','bi','inbouw']},{code:'BK',keys:['bk','fiets','bike']}];
    for (var ni=0;ni<nw.length;ni++) { for (var nj=0;nj<nw[ni].keys.length;nj++) { if (str.includes(nw[ni].keys[nj])) { netwerk=nw[ni].code; str=str.replace(nw[ni].keys[nj],''); break; } } if (netwerk) break; }
    var dl=[
      {code:'NLOV',name:'Overamstel',keys:['overamstel','amsterdam','ams','ova','adam']},{code:'NLAL',name:'Almere',keys:['almere','alm']},
      {code:'NLDE',name:'Deventer',keys:['deventer','dev']},{code:'NLRO',name:'Rotterdam',keys:['rotterdam','rdam','rtm','rot']},
      {code:'NLTI',name:'Tilburg',keys:['tilburg','tbg','til']},{code:'NLGR',name:'Groningen',keys:['groningen','gro','grn']},
      {code:'NLUT',name:'Utrecht',keys:['utrecht','utr','utr']},{code:'NLVE',name:'Venlo',keys:['venlo','ven']},
      {code:'NLEI',name:'Eindhoven',keys:['eindhoven','ehv','ein']},{code:'NLDH',name:'Den Haag',keys:['den haag','dhg','haag','dh']},
      {code:'BEWI',name:'Wilrijk',keys:['wilrijk','bewi','wil']},{code:'BEAN',name:'Antwerpen',keys:['antwerpen','bean','ant','antp']},
      {code:'BEGE',name:'Gent',keys:['gent','beg']},{code:'BENI',name:'Nijvel',keys:['nijvel','nivelles','ben']},
      {code:'BEZA',name:'Zaventem',keys:['zaventem','zav']},{code:'DEDU',name:'Dusseldorf',keys:['dusseldorf','düsseldorf','dus']},
      {code:'DEKE',name:'Kelsterbach',keys:['kelsterbach','kel']},{code:'DEHA',name:'Hamm',keys:['hamm']},
      {code:'DELA',name:'Langenhagen',keys:['langenhagen','lan']},{code:'DEHM',name:'Hamburg',keys:['hamburg','ham']},
      {code:'DESC',name:'Schonefeld',keys:['schonefeld','sch']},{code:'DETA',name:'Tamm',keys:['tamm']},
      {code:'DENU',name:'Nürnberg',keys:['nürnberg','nurnberg','nur']},{code:'DEES',name:'Essen',keys:['essen','ess']}
    ];
    for (var di=0;di<dl.length;di++) { for (var dj=0;dj<dl[di].keys.length;dj++) { if (str.includes(dl[di].keys[dj])) { depotInfo=dl[di]; str=str.replace(dl[di].keys[dj],''); break; } } if (depotInfo) break; }
    if (netwerk==='BK'&&depotInfo&&depotInfo.code==='BEAN') depotInfo={code:'BEWI',name:'Wilrijk'};
    if (netwerk!=='BK'&&depotInfo&&depotInfo.code==='NLOV'&&input.toLowerCase().includes('amsterdam')) depotInfo={code:'NLAL',name:'Almere'};
    var m=str.match(/\d+/); if (m) nummer=m[0].padStart(2,'0');
    if (netwerk&&depotInfo&&nummer) return netwerk+'-'+depotInfo.code+'-'+nummer;
    return input.toUpperCase();
  }

  var alleDepots=[{code:'NLAL',name:'Almere'},{code:'NLDE',name:'Deventer'},{code:'NLGR',name:'Groningen'},{code:'NLRO',name:'Rotterdam'},{code:'NLTI',name:'Tilburg'},{code:'NLUT',name:'Utrecht'},{code:'NLVE',name:'Venlo'},{code:'NLEI',name:'Eindhoven'},{code:'NLDH',name:'Den Haag'},{code:'NLOV',name:'Overamstel'},{code:'DEDU',name:'Dusseldorf'},{code:'DEKE',name:'Kelsterbach'},{code:'DEHA',name:'Hamm'},{code:'DELA',name:'Langenhagen'},{code:'DEHM',name:'Hamburg'},{code:'DESC',name:'Schonefeld'},{code:'DETA',name:'Tamm'},{code:'DENU',name:'Nürnberg'},{code:'DEES',name:'Essen'},{code:'BEAN',name:'Antwerpen'},{code:'BEGE',name:'Gent'},{code:'BENI',name:'Nijvel'},{code:'BEZA',name:'Zaventem'},{code:'BEWI',name:'Wilrijk'}];
  if (scrapedRoute) { var rm=scrapedRoute.match(/[A-Z]{4}/); if (rm) { var rg=alleDepots.find(function(d){ return d.code===rm[0]; }); if (rg) callData.depot=rg.name; } }

  // ── PROBLEEM OPTIES ───────────────────────────────────────────
  var alleProbleemOpties=['Trekschakelaar aansluiten','Milieuretour / Pick-up ophalen','Plaatsen / Naar boven tillen','Apparaat inbouwen (Keuken)','Aansluiting controleren','Schade / Defect','TV installeren','TV ophangen en installeren','TV + Soundbar installeren','TV + Soundbar ophangen en installeren','Stapelkit plaatsen','Deur omdraaien','Service niet uitvoerbaar','Verkeerd gelabeld product','Blijverkoop vergeten'];

  var witgoedTypes = ['wasmachine','wasdroogcombinatie','droger','koelkast','vriezer','koel-vries','vaatwasser','inbouw vaatwasser','inbouw koelkast','inbouw vriezer','oven','magnetron','fornuis','kookplaat'];

  function isTV(naam) {
    var n = (naam||'').toLowerCase();
    if (n.includes('tv')||n.includes('televisie')||n.includes('oled')||n.includes('qled')||n.includes('inch')||n.includes('" ')) return true;
    var det = detecteerType(naam);
    return !!(det && det.typeGuess === 'televisie');
  }

  function isSoundbar(naam) {
    var n = (naam||'').toLowerCase();
    if (n.includes('soundbar')||n.includes('sound bar')) return true;
    var det = detecteerType(naam);
    return !!(det && det.typeGuess === 'soundbar');
  }

  function isWitgoed(naam) {
    var det = detecteerType(naam);
    if (!det || !det.typeGuess) return false;
    return witgoedTypes.some(function(t){ return det.typeGuess.toLowerCase().includes(t); });
  }

  var nextDayRedenen=['Geen geschikte routes beschikbaar (tijd)','Geen geschikte routes beschikbaar (afstand)','Klant vandaag geen tijd meer','Situatie bij de klant niet gereed voor service','Geen helden op het depot aanwezig','Geen BI ritten op de weg'];

  function getOptiesVoorType(type) {
    var p = type.toLowerCase();
    if (p==='televisie'||p.includes('tv')||p.includes('televisie')||p.match(/(oled|qled|inch)/)) return ['TV installeren','TV ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
    if (p==='soundbar'||p.includes('soundbar')) return ['TV + Soundbar installeren','TV + Soundbar ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
    if (p==='oven'||p==='magnetron'||p.includes('oven')||p.includes('magnetron')||p.includes('kookplaat')||p.includes('afzuigkap')||p.includes('wasemkap')) return ['Apparaat inbouwen (Keuken)','Milieuretour / Pick-up ophalen','Aansluiting controleren','Schade / Defect'];
    if (p==='fornuis'||p.includes('fornuis')) return [];
    if (p.includes('inbouw')) return ['Apparaat inbouwen (Keuken)','Milieuretour / Pick-up ophalen','Aansluiting controleren','Deur omdraaien'];
    if (p.includes('wasmachine')||p.includes('wasdroog')) return ['Trekschakelaar aansluiten','Plaatsen / Naar boven tillen','Stapelkit plaatsen','Milieuretour / Pick-up ophalen','Aansluiting controleren'];
    if (p.includes('droger')) return ['Trekschakelaar aansluiten','Plaatsen / Naar boven tillen','Stapelkit plaatsen','Deur omdraaien','Milieuretour / Pick-up ophalen','Aansluiting controleren'];
    if (p.includes('koelkast')||p.includes('vriezer')||p.includes('koel-vries')) return ['Plaatsen / Naar boven tillen','Deur omdraaien','Milieuretour / Pick-up ophalen','Aansluiting controleren','Schade / Defect'];
    if (p.includes('vaatwasser')) return ['Plaatsen / Naar boven tillen','Apparaat inbouwen (Keuken)','Milieuretour / Pick-up ophalen','Aansluiting controleren'];
    return alleProbleemOpties;
  }

  function getProbleemOpties() {
    if (meerdereProducten && !answeredKeys.includes('product_keuze')) {
      var heeftTV       = alleGescrapteProducten.some(function(n){ return isTV(n); });
      var heeftSoundbar = alleGescrapteProducten.some(function(n){ return isSoundbar(n); });
      var andereProducten = alleGescrapteProducten.filter(function(n){ return !isTV(n); });
      var andereZijnAccessoire = andereProducten.length > 0 && andereProducten.every(function(n){ return !isWitgoed(n); });

      if (heeftTV && (heeftSoundbar || andereZijnAccessoire)) {
        return ['TV + Soundbar installeren','TV + Soundbar ophangen en installeren','TV installeren','TV ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
      }

      // Unie van opties voor alle herkende types
      var union = [];
      alleGescrapteProducten.forEach(function(naam) {
        var det = detecteerType(naam);
        var type = det && det.typeGuess ? det.typeGuess : (isTV(naam) ? 'televisie' : naam);
        var opties = getOptiesVoorType(type);
        opties.forEach(function(o) { if (!union.includes(o)) union.push(o); });
      });
      return alleProbleemOpties.filter(function(o) { return union.includes(o); });
    }

    // Enkel product
    var p = (callData.product || callData.model || '').toLowerCase();
    if (p==='televisie'||p.includes('tv')||p.includes('televisie')||p.match(/(oled|qled|inch)/)) {
      return ['TV installeren','TV ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
    }
    if (p==='soundbar'||p.includes('soundbar')) {
      return ['TV + Soundbar installeren','TV + Soundbar ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
    }
    return getOptiesVoorType(callData.product || callData.model);
  }


  // ── GESECTEERDE PROBLEEMKEUZE ─────────────────────────────────
  // displayLabel = korte knoptekst, logLabel = wat gelogd wordt
  var probleemLabels = {
    'Trekschakelaar':        'Trekschakelaar aansluiten',
    'Plaatsen / tillen':     'Plaatsen / Naar boven tillen',
    'Milieuretour / pick-up':'Milieuretour / Pick-up ophalen',
    'Stapelkit':             'Stapelkit plaatsen',
    'Aansluiting':           'Aansluiting controleren',
    'Schade / defect':       'Schade / Defect',
    'Deur omdraaien':        'Deur omdraaien',
    'Inbouwen':              'Apparaat inbouwen (Keuken)',
    'TV installeren':        'TV installeren',
    'TV ophangen':           'TV ophangen en installeren',
    'TV + Soundbar':         'TV + Soundbar installeren',
    'TV + Soundbar ophangen':'TV + Soundbar ophangen en installeren',
    'Niet uitvoerbaar':      'Service niet uitvoerbaar',
    'Verkeerd gelabeld':     'Verkeerd gelabeld product',
    'Spullen achtergelaten': 'Spullen achtergelaten bij klant'
  };
  function toLogLabel(disp) { return probleemLabels[disp] || disp; }

  var probleemPerType = {
    'wasmachine':        ['Trekschakelaar','Plaatsen / tillen','Milieuretour / pick-up','Stapelkit','Aansluiting','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'wasdroogcombinatie':['Trekschakelaar','Plaatsen / tillen','Milieuretour / pick-up','Stapelkit','Aansluiting','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'droger':            ['Trekschakelaar','Plaatsen / tillen','Milieuretour / pick-up','Stapelkit','Deur omdraaien','Schade / defect','Aansluiting','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'koelkast':          ['Plaatsen / tillen','Deur omdraaien','Inbouwen','Milieuretour / pick-up','Aansluiting','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'vriezer':           ['Plaatsen / tillen','Deur omdraaien','Inbouwen','Milieuretour / pick-up','Aansluiting','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'koel-vries combo':  ['Plaatsen / tillen','Deur omdraaien','Inbouwen','Milieuretour / pick-up','Aansluiting','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'inbouw koelkast':   ['Inbouwen','Deur omdraaien','Milieuretour / pick-up','Aansluiting','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'inbouw vriezer':    ['Inbouwen','Milieuretour / pick-up','Aansluiting','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'vaatwasser':        ['Inbouwen','Plaatsen / tillen','Deur omdraaien','Aansluiting','Milieuretour / pick-up','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'inbouw vaatwasser': ['Inbouwen','Deur omdraaien','Aansluiting','Milieuretour / pick-up','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'oven':              ['Inbouwen','Aansluiting','Milieuretour / pick-up','Schade / defect','Niet uitvoerbaar','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'magnetron':         ['Inbouwen','Aansluiting','Milieuretour / pick-up','Schade / defect','Niet uitvoerbaar','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'fornuis':           ['Niet uitvoerbaar','Milieuretour / pick-up','Schade / defect','Onverwacht retour','Blijverkoop vergeten'],
    'kookplaat':         ['Milieuretour / pick-up','Schade / defect','Niet uitvoerbaar','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'televisie':         ['TV installeren','TV ophangen','Milieuretour / pick-up','Schade / defect','Niet uitvoerbaar','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'televisie+soundbar':['TV + Soundbar','TV + Soundbar ophangen','Milieuretour / pick-up','Schade / defect','Niet uitvoerbaar','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten'],
    'soundbar':          ['TV + Soundbar','TV + Soundbar ophangen','Milieuretour / pick-up','Schade / defect','Onverwacht retour','Milieuretour past niet in bus','Blijverkoop vergeten']
  };
  var tvOnlyOpties = ['TV installeren','TV ophangen'];

  function getTypeKey(t) {
    var tl=(t||'').toLowerCase();
    if (tl==='koelkast / vriezer'||tl==='koelkast'||tl==='vriezer') return 'koelkast';
    if (tl==='oven / magnetron'||tl==='oven'||tl==='combi-oven') return 'oven';
    if (tl==='wasdroger') return 'droger';
    if (tl==='televisie+soundbar') return 'televisie+soundbar';
    return tl;
  }

  function buildProbleemSections() {
    // Detecteer TV+Soundbar combinatie
    var heeftTV = alleGescrapteProducten.some(function(n){ return isTV(n); });
    var heeftSoundbar = alleGescrapteProducten.some(function(n){ return isSoundbar(n); });
    var tvSoundbarCombo = heeftTV && heeftSoundbar;

    if (!meerdereProducten) {
      var rawType = callData.product || '';
      var typeKey = tvSoundbarCombo ? 'televisie+soundbar' : getTypeKey(rawType);
      var opties = probleemPerType[typeKey] || alleProbleemOpties.map(function(o){ return o; });
      var extraOpties = typeKey==='televisie+soundbar' ? tvOnlyOpties : [];
      return [{typeLabel:rawType||'', model:callData.model, origNaam:callData.model, typeKey:typeKey, opties:opties, extraOpties:extraOpties}];
    }

    // Meerdere producten — groepeer per type
    var secMap = {}, secOrder = [];
    alleGescrapteProducten.forEach(function(naam) {
      var det = detecteerType(naam);
      var type = det && det.typeGuess ? det.typeGuess : (isTV(naam) ? 'televisie' : (isSoundbar(naam) ? 'soundbar' : null));
      if (!type) return;
      // Combineer TV+soundbar
      if (type==='televisie' && heeftSoundbar) type='televisie+soundbar';
      if (type==='soundbar' && heeftTV) return; // soundbar valt onder TV+Soundbar sectie
      var label = type==='televisie+soundbar' ? 'Televisie + Soundbar' : (type.charAt(0).toUpperCase()+type.slice(1));
      if (!secMap[label]) {
        var tk = getTypeKey(type);
        secMap[label] = {typeLabel:label, model:naam, origNaam:naam, typeKey:tk, opties:probleemPerType[tk]||[], extraOpties:tk==='televisie+soundbar'?tvOnlyOpties:[]};
        secOrder.push(label);
      }
    });
    return secOrder.map(function(l){ return secMap[l]; });
  }

  // ── PRODUCT VERFIJNING ────────────────────────────────────────
  // Geeft verfijningsopties terug als het product ambigu is, anders null
  function getProductVerfijningOpties(product) {
    var p = (product||'').toLowerCase();
    if (p==='koelkast / vriezer') return ['Koelkast','Vriezer','Amerikaanse koelkast','Amerikaanse koelkast met waterdispenser','Side-by-side koelkast','Inbouw koelkast'];
    if (p==='vaatwasser') return ['Vrijstaande vaatwasser','Inbouw vaatwasser'];
    if (p==='oven / magnetron' || p==='oven') return ['Inbouw oven','Inbouw magnetron','Magnetron'];
    return null;
  }

  // Is het product ambigu en nog niet verfijnd?
  function productNeedsVerfijning() {
    if (answeredKeys.includes('productVerfijnd')) return false;
    return getProductVerfijningOpties(callData.product) !== null;
  }

  // Geeft het effectieve product terug (verfijnd als aanwezig, anders origineel)
  function effectiefProduct() {
    return callData.productVerfijnd || callData.product || '';
  }

  // Is de uitkomst een next day?
  function isNextDay() {
    return callData.uitkomst==='Next day gepland' ||
           callData.uitkomst==='Next day visit gepland' ||
           callData.ks_uitkomst==='Next day gepland';
  }

  // Moet de dienstType vraag overgeslagen worden?
  // Ja als: deur omdraaien + koelkast/vriezer-type (alleen Extra dienst sjabloon beschikbaar)
  function skipDienstType() {
    var prob = (callData.probleem||'').toLowerCase();
    if (!prob.includes('deur omdraaien')) return false;
    var prod = effectiefProduct().toLowerCase();
    return prod==='koelkast' || prod==='vriezer' ||
           prod==='amerikaanse koelkast' || prod==='amerikaanse koelkast met waterdispenser' ||
           prod==='side-by-side koelkast' || prod==='inbouw koelkast' ||
           prod==='koelkast / vriezer';
  }

  // ── FLOW ENGINE ───────────────────────────────────────────────
  function bepaalStappen() {
    var s=[];
    s.push({key:'fname',label:'Voornaam',type:'text'});
    s.push({key:'lname',label:'Achternaam',type:'text'});

    // ── EERSTE KEUZE: wie belt? ───────────────────────────────────
    s.push({key:'bellerType',label:'Wie belt er?',type:'beller-select'});
    if (!answeredKeys.includes('bellerType')) return s;

    // ── TEAMLEIDER FLOW ──────────────────────────────────────────
    if (callData.bellerType === 'Teamleider') {
      s.push({key:'tl_reden',label:'Waar gaat de vraag over?',type:'ux-select',opties:['Vraag om aanpassingen in rit','Andere vraag']});
      if (answeredKeys.includes('tl_reden')) {
        if (callData.tl_reden==='Vraag om aanpassingen in rit') {
          s.push({key:'tl_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Aanpassing doorgegeven / bevestigd','Niet mogelijk']});
        } else {
          s.push({key:'tl_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Vraag beantwoord','Geen oplossing']});
        }
      }
      return s;
    }

    // ── CBF FLOW ─────────────────────────────────────────────────
    if (callData.bellerType === 'CBF') {
      s.push({key:'locatie',label:'Wat is de situatie?',type:'cbf-locatie-select',opties:['Onderweg','Bij de klant','Vraag voor het depot','Vraag over depot / hub']});
      if (!answeredKeys.includes('locatie')) return s;

      if (callData.locatie === 'Onderweg') {
        // Zelfde onderweg flow als CBB
        s.push({key:'onderweg_type',label:'Wat is het probleem?',type:'onderweg-select',opties:['Adres niet gevonden / niet bereikbaar','Adres klopt niet','Klant niet bereikbaar / verkeerd nummer','Klant niet thuis','Vraag over service']});
        if (answeredKeys.includes('onderweg_type')) {
          if (callData.onderweg_type==='Advies gegeven') {
            s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
          } else if (callData.onderweg_type==='Adres niet gevonden / niet bereikbaar') {
            s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'adres-uitkomst-select',opties:['Adres gevonden samen met Held','Alternatieve route gevonden voor Held','Straat afgesloten of onvoldoende EV-rijkwijdte','Nee, geen oplossing door DS']});
          } else if (callData.onderweg_type==='Adres klopt niet') {
            // Geen verdere keuze — info paneeltje getoond op submit, direct loggen
          } else if (callData.onderweg_type==='Klant niet bereikbaar / verkeerd nummer') {
            s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Telefoonnummer gevonden voor Held','Nee, geen oplossing door DS']});
          } else if (callData.onderweg_type==='Klant niet thuis') {
            s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Advies gegeven, held meldt af in Jerney','Helden stellen stop uit en gaan later terug','Nee, geen oplossing door DS']});
          } else if (callData.onderweg_type==='Vraag over service') {
            s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Vraag beantwoord, held kan verder','Nee, geen oplossing door DS']});
          }
        }
      } else if (callData.locatie === 'Bij de klant') {
        s.push({key:'cbf_pakket_reden',label:'Wat is de vraag?',type:'ux-select',opties:['Pakket niet meegenomen (manco)','Pakket verkeerd / beschadigd','Pakje niet ingeladen','Overige vraag over pakket']});
        if (answeredKeys.includes('cbf_pakket_reden')) {
          if (callData.cbf_pakket_reden==='Pakje niet ingeladen') {
            s.push({key:'cbf_pakket_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Pakje wordt later afgeleverd (afleverbewijs)','Niet opgelost — instructie gegeven in Jerney']});
          } else {
            s.push({key:'cbf_pakket_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Klant geïnformeerd, manco geregistreerd','Klant geïnformeerd, held regelt verder','Nee, geen oplossing door DS']});
          }
        }
      } else if (callData.locatie === 'Vraag voor het depot') {
        s.push({key:'cbf_depot_reden',label:'Waar gaat de vraag over?',type:'ux-select',opties:['Ziekmelding','Fiets kapot / incident','Informeren waar de vracht is','Alarm / sleutelkastje hub','Anders']});
        if (answeredKeys.includes('cbf_depot_reden') && callData.cbf_depot_reden==='Anders') {
          s.push({key:'cbf_depot_toelichting',label:'Wat is de vraag?',type:'text'});
        }
      } else if (callData.locatie === 'Vraag over depot / hub') {
        s.push({key:'cbb_hub_reden',label:'Wat is de vraag over het depot / hub?',type:'ux-select',opties:['Alarm staat op','Sleutelkastje ophalen / code','Andere vraag over depot']});
        if (answeredKeys.includes('cbb_hub_reden') && callData.cbb_hub_reden==='Andere vraag over depot') {
          s.push({key:'cbb_hub_toelichting',label:'Wat is de vraag precies?',type:'text'});
        }
      }
      return s;
    }

    // ── CBB FLOW (en Anders) ──────────────────────────────────────

    // Bij meerdere producten: keuze NA probleem
    if (meerdereProducten && !answeredKeys.includes('product_keuze') && answeredKeys.includes('probleem') && callData.probleem !== 'Advies gegeven') {
      s.push({key:'product_keuze',label:'Over welk product gaat het?',type:'product-multi',opties:alleGescrapteProducten.map(maakProductLabel)});
      if (!answeredKeys.includes('product_keuze')) return s;
    }

    s.push({key:'locatie',label:'Waar zijn de helden?',type:'locatie-select',opties:['Bij de klant','Onderweg','Vraag over depot / hub']});
    if (!answeredKeys.includes('locatie')) return s;

    if (callData.locatie==='Bij de klant') {
      // Bij enkel onherkend product: vraag eerst het type (knoppen)
      if (!meerdereProducten && !answeredKeys.includes('product')) {
        s.push({key:'product',label:'Om welk apparaat gaat het?',type:'product-type-keuze'});
        if (!answeredKeys.includes('product')) return s;
      }
      // Verfijn ambigu product direct na productkeuze
      if (answeredKeys.includes('product') && productNeedsVerfijning()) {
        s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(callData.product)});
        if (!answeredKeys.includes('productVerfijnd')) return s;
      }
      s.push({key:'probleem',label:'Wat is de klacht of taak?',type:'probleem-grouped',opties:getProbleemOpties()});
      if (!answeredKeys.includes('probleem')) return s;
      // product(_keuze) wordt afgehandeld door de probleem-grouped renderer

      if (callData.probleem==='Advies gegeven') {
        s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
      } else if (callData.probleem==='Verkeerd gelabeld product') {
        // Geen verdere vragen — info paneeltje wordt getoond in render, direct loggen
      } else if (callData.probleem==='Onverwacht retour') {
        // Geen verdere vragen — direct loggen
      } else if (callData.probleem==='Spullen achtergelaten bij klant') {
        s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day gepland','Next day gepland','Helden teruggebeld, rijden terug zonder visit']});
        if (callData.uitkomst==='Same day gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
        else if (callData.uitkomst==='Next day gepland') {
          if (!skipDienstType()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
          if (answeredKeys.includes('dienstType')||skipDienstType()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
        }
      } else if (callData.probleem==='Milieuretour past niet in bus') {
        s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day visit gepland','Next day visit gepland','Held gevraagd TL te bellen voor bevestiging']});
        if (callData.uitkomst==='Same day visit gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
        else if (callData.uitkomst==='Next day visit gepland') {
          if (!skipDienstType()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
          if (answeredKeys.includes('dienstType')||skipDienstType()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
        }
      } else if (callData.probleem==='Blijverkoop vergeten') {
        s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day gepland','Advies gegeven aan Held','Geen oplossing gepland']});
        if (callData.uitkomst==='Same day gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
      } else {
        if (!answeredKeys.includes('product')) {
          var tvProbleem = callData.probleem.includes('TV') || callData.probleem.includes('Soundbar');
          if (callData.probleem==='Apparaat inbouwen (Keuken)') {
            s.push({key:'product',label:'Wat wordt er ingebouwd?',type:'ux-select',opties:['Inbouw vaatwasser','Inbouw koelkast','Oven / Magnetron','Kookplaat','Overig']});
          } else if (!tvProbleem) {
            s.push({key:'product',label:(callData.probleem==='Milieuretour / Pick-up ophalen'?'Welk product wordt er opgehaald?':'Welk product betreft het?'),type:'ux-select',opties:['Wasmachine','Wasdroger','Koelkast / Vriezer','Vaatwasser','Televisie','Overig']});
          }
        }
        // Verfijn ambigu product direct na productkeuze
        if (answeredKeys.includes('product') && productNeedsVerfijning()) {
          s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(callData.product)});
          if (!answeredKeys.includes('productVerfijnd')) return s;
        }
        var isTVInstallatie = callData.probleem.includes('TV') || callData.probleem.includes('Soundbar');
        if (answeredKeys.includes('product')&&callData.product==='Televisie'&&!answeredKeys.includes('formaatTV')&&!isTVInstallatie) {
          s.push({key:'formaatTV',label:'Is de TV 55 inch of groter?',type:'ux-select',opties:['Ja (>= 55 inch)','Nee (< 55 inch)']});
        }
        if (callData.probleem==='Milieuretour / Pick-up ophalen'&&answeredKeys.includes('product')&&!answeredKeys.includes('milieuretour_type')) {
          s.push({key:'milieuretour_type',label:'Specificeer het type ophaling:',type:'ux-select',opties:['Milieuretour','Pick-up']});
        }
        var prodKlaar = answeredKeys.includes('product')&&(callData.product!=='Televisie'||answeredKeys.includes('formaatTV')||isTVInstallatie);
        var milKlaar  = callData.probleem!=='Milieuretour / Pick-up ophalen'||answeredKeys.includes('milieuretour_type');
        if (prodKlaar&&milKlaar) {
          // Advies gegeven alleen als escape op uitkomststap als probleem zelf geen concreet probleem is
          var uitkomstType = callData.probleem === 'Advies gegeven' ? 'ux-select' : 'uitkomst-select';
          s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:uitkomstType,opties:['Same day gepland','Next day gepland','Klant ziet af van service (meerkosten)','Geen oplossing gepland']});
          if (answeredKeys.includes('uitkomst')) {
            if (callData.uitkomst==='Same day gepland') {
              s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
              if (answeredKeys.includes('geplandeRoute')&&!skipDienstType()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
            } else if (callData.uitkomst==='Next day gepland') {
              if (!skipDienstType()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
              if ((answeredKeys.includes('dienstType')||skipDienstType())&&isTVInstallatie&&callData.formaatTV!=='Ja (>= 55 inch)') {
                if (!answeredKeys.includes('tvNetwerk')) {
                  var routeNet=parseToTourAlias(callData.geplandeRoute||'').split('-')[0];
                  if (routeNet==='1X') { callData.tvNetwerk='Built in (BI)'; autoFilledKeys.push('tvNetwerk'); }
                  else s.push({key:'tvNetwerk',label:'Welk netwerk voor de nieuwe afspraak?',type:'ux-select',opties:['Built in (BI)','1X']});
                }
              }
              if (answeredKeys.includes('dienstType')||skipDienstType()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
            } else if (callData.uitkomst==='Geen oplossing gepland') {
              s.push({key:'geen_oplossing_reden',label:'Waarom is er geen oplossing gepland?',type:'text-warning'});
            } else if (callData.uitkomst==='Advies gegeven') {
              s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
            }
          }
        }
      }

    } else if (callData.locatie==='Onderweg') {
      s.push({key:'onderweg_type',label:'Wat is het probleem?',type:'onderweg-select',opties:['Adres niet gevonden / niet bereikbaar','Adres klopt niet','Klant niet bereikbaar / verkeerd nummer','Klant niet thuis','Vraag over service']});
      if (answeredKeys.includes('onderweg_type')) {
        if (callData.onderweg_type==='Advies gegeven') {
          s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
        } else if (callData.onderweg_type==='Adres niet gevonden / niet bereikbaar') {
          s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'adres-uitkomst-select',opties:['Adres gevonden samen met Held','Alternatieve route gevonden voor Held','Straat afgesloten of onvoldoende EV-rijkwijdte','Nee, geen oplossing door DS']});
        } else if (callData.onderweg_type==='Adres klopt niet') {
          // Geen verdere keuze — info paneeltje getoond op submit, direct loggen
        } else if (callData.onderweg_type==='Klant niet bereikbaar / verkeerd nummer') {
          s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Telefoonnummer gevonden voor Held','Nee, geen oplossing door DS']});
        } else if (callData.onderweg_type==='Klant niet thuis') {
          s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Advies gegeven, held meldt af in Jerney','Helden stellen stop uit en gaan later terug','Nee, geen oplossing door DS']});
        } else if (callData.onderweg_type==='Vraag over service') {
          s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Vraag beantwoord, held kan verder','Nee, geen oplossing door DS']});
        }
      }

    } else if (callData.locatie==='Vraag over depot / hub') {
      s.push({key:'cbb_hub_reden',label:'Wat is de vraag over het depot / hub?',type:'ux-select',opties:['Alarm staat op','Sleutelkastje ophalen / code','Andere vraag over depot']});
      if (answeredKeys.includes('cbb_hub_reden') && callData.cbb_hub_reden==='Andere vraag over depot') {
        s.push({key:'cbb_hub_toelichting',label:'Wat is de vraag precies?',type:'text'});
      }

    } else if (callData.locatie==='Klantenservice' || callData.locatie==='Winkel') {
      var isWinkel = callData.locatie==='Winkel';
      var ksLabel = isWinkel ? 'Wat is de reden van het winkelbelletje?' : 'Wat is de reden van het KS-belletje?';
      var ksOpties = isWinkel
        ? ['Nazorg nodig','Winkel vraagt om held terug te sturen','Advies gegeven aan Winkel','Informatie over vracht','Witgoed Demo Wissel','Spullen achtergelaten bij klant']
        : ['Nazorg nodig','KS vraagt om held terug te sturen','Advies gegeven aan KS','Spullen achtergelaten bij klant','Bezorgadres/telefoonnummer klant doorgeven aan held'];
      s.push({key:'ks_reden',label:ksLabel,type:'ux-select',opties:ksOpties});
      if (answeredKeys.includes('ks_reden')) {
        if (callData.ks_reden==='Informatie over vracht') {
          // Geen verdere vragen — direct loggen na info paneeltje
        } else if (callData.ks_reden==='Nazorg nodig') {
          if (!meerdereProducten && !answeredKeys.includes('product')) {
            s.push({key:'product',label:'Om welk apparaat gaat het?',type:'product-type-keuze'});
            if (!answeredKeys.includes('product')) return s;
          }
          // Verfijn ambigu product direct na productkeuze
          if (answeredKeys.includes('product') && productNeedsVerfijning()) {
            s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(callData.product)});
            if (!answeredKeys.includes('productVerfijnd')) return s;
          }
          s.push({key:'probleem',label:'Wat moet er gebeuren bij de klant?',type:'probleem-grouped',opties:getProbleemOpties()});
          if (!answeredKeys.includes('probleem')) return s;
          if (callData.probleem==='Advies gegeven' && callData.uitkomst !== 'KS advies gegeven') {
            s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
          } else {
            if (!answeredKeys.includes('product')) {
              var tvProbleem = callData.probleem.includes('TV') || callData.probleem.includes('Soundbar');
              if (callData.probleem==='Apparaat inbouwen (Keuken)') {
                s.push({key:'product',label:'Wat wordt er ingebouwd?',type:'ux-select',opties:['Inbouw vaatwasser','Inbouw koelkast','Oven / Magnetron','Kookplaat','Overig']});
              } else if (!tvProbleem) {
                s.push({key:'product',label:(callData.probleem==='Milieuretour / Pick-up ophalen'?'Welk product wordt er opgehaald?':'Welk product betreft het?'),type:'ux-select',opties:['Wasmachine','Wasdroger','Koelkast / Vriezer','Vaatwasser','Televisie','Overig']});
              }
            }
            // Verfijn ambigu product direct na productkeuze
            if (answeredKeys.includes('product') && productNeedsVerfijning()) {
              s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(callData.product)});
              if (!answeredKeys.includes('productVerfijnd')) return s;
            }
            if (answeredKeys.includes('product')&&callData.product==='Televisie'&&!answeredKeys.includes('formaatTV')&&!(callData.probleem.includes('TV')||callData.probleem.includes('Soundbar'))) {
              s.push({key:'formaatTV',label:'Is de TV 55 inch of groter?',type:'ux-select',opties:['Ja (>= 55 inch)','Nee (< 55 inch)']});
            }
            if (callData.probleem==='Milieuretour / Pick-up ophalen'&&answeredKeys.includes('product')&&!answeredKeys.includes('milieuretour_type')) {
              s.push({key:'milieuretour_type',label:'Specificeer het type ophaling:',type:'ux-select',opties:['Milieuretour','Pick-up']});
            }
            var isTVInstallatie2 = callData.probleem.includes('TV')||callData.probleem.includes('Soundbar');
            var prodKlaar2 = answeredKeys.includes('product')&&(callData.product!=='Televisie'||answeredKeys.includes('formaatTV')||isTVInstallatie2);
            var milKlaar2  = callData.probleem!=='Milieuretour / Pick-up ophalen'||answeredKeys.includes('milieuretour_type');
            if (prodKlaar2&&milKlaar2) {
              s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'uitkomst-select',opties:['Same day gepland','Klant ziet af van service (meerkosten)','Geen same day mogelijk']});
              if (answeredKeys.includes('uitkomst')) {
                if (callData.uitkomst==='Same day gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
                else if (callData.uitkomst==='KS advies gegeven') s.push({key:'ks_advies_uitkomst',label:'Wat was het advies?',type:'ux-select',opties:['Geen same day optie, KS plant zelf oplossing','DS adviseert andere oplossing aan KS']});
              }
            }
          }
        } else if (callData.ks_reden==='KS vraagt om held terug te sturen' || callData.ks_reden==='Winkel vraagt om held terug te sturen') {
          s.push({key:'ks_uitkomst',label:'Wat was de uitkomst?',type:'uitkomst-select',opties:['Teamleider stuurt helden terug','Teamleider stuurt helden niet terug','Same day gepland','Next day gepland','DS vindt terugsturen niet de juiste oplossing']});
          if (answeredKeys.includes('ks_uitkomst')) {
            if (callData.ks_uitkomst==='Same day gepland') {
              s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
              if (answeredKeys.includes('geplandeRoute')&&!skipDienstType()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
            } else if (callData.ks_uitkomst==='Next day gepland') {
              if (!skipDienstType()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
              if (answeredKeys.includes('dienstType')||skipDienstType()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
            }
          }
        } else if (callData.ks_reden==='Witgoed Demo Wissel') {
          s.push({key:'ks_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Geplande visit verwijderd (niet nodig)','Geen actie nodig']});
        } else if (callData.ks_reden==='Spullen achtergelaten bij klant') {
          s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day gepland','Next day gepland','Helden teruggebeld, rijden terug zonder visit']});
          if (answeredKeys.includes('uitkomst')) {
            if (callData.uitkomst==='Same day gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
            else if (callData.uitkomst==='Next day gepland') {
              if (!skipDienstType()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
              if (answeredKeys.includes('dienstType')||skipDienstType()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
            }
          }
        }
        // Advies gegeven aan KS / Winkel, Informatie over vracht: geen vervolgvraag
      }
    } else if (callData.locatie==='Afhandeling buiten DS') {
      s.push({key:'afwijkend_reden',label:'Wat is de reden?',type:'ux-select',opties:['Product niet aanwezig','Klant moet KS bellen','Held moet dit bij afmelden van de route regelen met TL','Verkeerd gelabeld product','Overig']});
      if (answeredKeys.includes('afwijkend_reden') && callData.afwijkend_reden==='Overig') {
        s.push({key:'afwijkend_toelichting',label:'Toelichting:',type:'text'});
      }
    } else if (['Technische Dienst','Yeply','G4S'].includes(callData.locatie)) {
      // Geen verdere vragen — direct loggen
    }
    return s;
  }

  function getNextStep() {
    var st=bepaalStappen();
    for (var i=0;i<st.length;i++) { if (!answeredKeys.includes(st[i].key)) return st[i]; }
    return null;
  }

  // ── TERUG ─────────────────────────────────────────────────────
  function canGoBack() { return answeredKeys.some(function(k){ return !autoFilledKeys.includes(k); }); }

  function goBack() {
    var idx=-1;
    for (var i=answeredKeys.length-1;i>=0;i--) { if (!autoFilledKeys.includes(answeredKeys[i])) { idx=i; break; } }
    if (idx===-1) return;
    var removed = answeredKeys.splice(idx);
    removed.forEach(function(k){
      callData[k]='';
      var afIdx = autoFilledKeys.indexOf(k);
      if (afIdx > -1) autoFilledKeys.splice(afIdx, 1);
    });
    renderApp();
  }

  // ── DS WAARDE ─────────────────────────────────────────────────
  function berekenDsWaarde() {
    if (callData.bellerType === 'Teamleider') {
      return callData.tl_uitkomst || callData.tl_reden || 'Teamleider belt';
    }
    if (callData.bellerType === 'CBF') {
      if (callData.locatie === 'Vraag voor het depot') {
        return 'Advies gegeven (CBF doorverwezen naar depot) — ' + (callData.cbf_depot_reden||'reden onbekend') + (callData.cbf_depot_toelichting ? ': ' + callData.cbf_depot_toelichting : '');
      }
      if (callData.locatie === 'Vraag over depot / hub') {
        return 'Vraag over depot/hub: ' + (callData.cbb_hub_reden||'') + (callData.cbb_hub_toelichting ? ' — ' + callData.cbb_hub_toelichting : '');
      }
      if (callData.locatie === 'Bij de klant') {
        return callData.cbf_pakket_uitkomst || callData.cbf_pakket_reden || 'Vraag over pakket';
      }
      // CBF onderweg: zelfde logica als CBB onderweg
      if (callData.onderweg_type==='Advies gegeven') return callData.advies_gelukt==='Ja, service uitgevoerd' ? 'Advies gegeven aan held waardoor service uitgevoerd is' : 'Nee, geen oplossing door DS';
      if (callData.onderweg_type==='Adres klopt niet') return 'Adres klopt niet — instructie gegeven voor Jerney';
      return callData.onderweg_uitkomst||'';
    }
    if (callData.locatie==='Afhandeling buiten DS') {
      return callData.afwijkend_reden==='Overig' ? (callData.afwijkend_toelichting||'Afhandeling buiten DS') : callData.afwijkend_reden;
    } else if (['Technische Dienst','Yeply','G4S'].includes(callData.locatie)) {
      return 'Vraag beantwoord (' + callData.locatie + ')';
    } else if (callData.locatie==='Winkel') {
      if (callData.ks_reden==='Informatie over vracht') return 'Advies gegeven aan Winkel — depot doorverwezen';
      if (callData.ks_reden==='Advies gegeven aan Winkel') return 'Advies gegeven aan Winkel';
      if (callData.ks_reden==='Witgoed Demo Wissel') return callData.ks_uitkomst || 'Witgoed Demo Wissel';
      if (callData.ks_reden==='Winkel vraagt om held terug te sturen') {
        if (callData.ks_uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
        if (callData.ks_uitkomst==='Next day gepland')  return 'Ja stop gepland (next day)';
        if (callData.ks_uitkomst==='Advies gegeven') return callData.ks_advies_uitkomst || 'Advies gegeven';
        return callData.ks_uitkomst || '';
      }
      if (callData.uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
      if (callData.uitkomst==='Geen same day mogelijk') return 'Geen same day mogelijk — KS/Winkel regelt next day nazorg';
      return 'Nee, geen oplossing door DS';
    } else if (callData.locatie==='Klantenservice') {
      if (callData.ks_reden==='Advies gegeven aan KS') return 'Advies gegeven aan KS';
      if (callData.ks_reden==='Bezorgadres/telefoonnummer klant doorgeven aan held') return 'Bezorgadres/telefoonnummer klant doorgegeven aan held';
      if (callData.ks_reden==='KS vraagt om held terug te sturen') {
        if (callData.ks_uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
        if (callData.ks_uitkomst==='Next day gepland')  return 'Ja stop gepland (next day)';
        if (callData.ks_uitkomst==='Advies gegeven') return callData.ks_advies_uitkomst || 'Advies gegeven';
        return callData.ks_uitkomst || '';
      }
      if (callData.ks_reden==='Spullen achtergelaten bij klant') {
        if (callData.uitkomst==='Same day gepland') return 'Spullen achtergelaten — same day stop gepland';
        if (callData.uitkomst==='Next day gepland') return 'Spullen achtergelaten — next day stop gepland';
        if (callData.uitkomst==='Helden teruggebeld, rijden terug zonder visit') return 'Spullen achtergelaten — helden teruggebeld';
      }
      if (callData.uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
      if (callData.uitkomst==='Klant ziet af van service (meerkosten)') return 'Klant ziet af van service vanwege meerkosten';
      if (callData.uitkomst==='Geen same day mogelijk') return 'Geen same day mogelijk — KS regelt next day nazorg';
      if (callData.uitkomst==='KS advies gegeven') return callData.ks_advies_uitkomst||'KS advies gegeven';
      return 'Nee, geen oplossing door DS';
    } else if (callData.locatie==='Bij de klant') {
      if (callData.probleem==='Verkeerd gelabeld product') return 'Verkeerd gelabeld product — instructie gegeven aan Held';
      if (callData.probleem==='Onverwacht retour') return 'Onverwacht retour doorgegeven';
      if (callData.probleem==='Spullen achtergelaten bij klant') {
        if (callData.uitkomst==='Same day gepland') return 'Spullen achtergelaten — same day stop gepland';
        if (callData.uitkomst==='Next day gepland') return 'Spullen achtergelaten — next day stop gepland';
        if (callData.uitkomst==='Helden teruggebeld, rijden terug zonder visit') return 'Spullen achtergelaten — helden teruggebeld';
        return 'Spullen achtergelaten bij klant';
      }
      if (callData.probleem==='Milieuretour past niet in bus') {
        if (callData.uitkomst==='Same day visit gepland') return 'Milieuretour past niet in bus — same day stop gepland';
        if (callData.uitkomst==='Next day visit gepland') return 'Milieuretour past niet in bus — next day stop gepland';
        if (callData.uitkomst==='Held gevraagd TL te bellen voor bevestiging') return 'Milieuretour past niet in bus — TL gebeld voor bevestiging';
        return 'Milieuretour past niet in bus';
      }
      if (callData.probleem==='Blijverkoop vergeten') {
        if (callData.uitkomst==='Same day gepland') return 'Blijverkoop vergeten — same day stop gepland';
        if (callData.uitkomst==='Advies gegeven aan Held') return 'Blijverkoop vergeten — advies gegeven aan Held';
        return 'Blijverkoop vergeten — geen oplossing gepland';
      }
      var isAdv=callData.probleem==='Advies gegeven'||callData.uitkomst==='Advies gegeven';
      if (isAdv) return callData.advies_gelukt==='Ja, service uitgevoerd' ? 'Advies gegeven aan held waardoor service uitgevoerd is' : 'Nee, geen oplossing door DS';
      if (callData.uitkomst==='Same day gepland')    return 'Ja stop gepland (same day)';
      if (callData.uitkomst==='Next day gepland')    return 'Ja stop gepland (next day)';
      if (callData.uitkomst==='Klant ziet af van service (meerkosten)') return 'Klant ziet af van service vanwege meerkosten';
      if (callData.uitkomst==='Geen oplossing gepland') return 'Geen oplossing gepland door DS';
      return 'Nee, geen oplossing door DS';
    } else if (callData.locatie==='Vraag over depot / hub') {
      return 'Vraag over depot/hub: ' + (callData.cbb_hub_reden||'') + (callData.cbb_hub_toelichting ? ' — ' + callData.cbb_hub_toelichting : '');
    } else {
      // CBB onderweg
      if (callData.onderweg_type==='Advies gegeven') return callData.advies_gelukt==='Ja, service uitgevoerd' ? 'Advies gegeven aan held waardoor service uitgevoerd is' : 'Nee, geen oplossing door DS';
      if (callData.onderweg_type==='Adres klopt niet') return 'Adres klopt niet — instructie gegeven voor Jerney';
      return callData.onderweg_uitkomst||'';
    }
  }

  // ── STATUS BAR ────────────────────────────────────────────────
  function buildStatusHtml() {
    var h='<div class="status-bar">';
    if (callData.user)  h+='<span class="status-line">DS medewerker: <b>'+callData.user+'</b></span>';
    if (callData.route) h+='<span class="status-line">Route: <b>'+callData.route+'</b></span>';
    if (callData.bellerType) h+='<span class="status-line">Beller: <b>'+callData.bellerType+'</b></span>';
    var lbl={product_keuze:'Model',locatie:'Locatie',probleem:'Taak',ks_reden:'Reden',ks_uitkomst:'KS uitkomst',afwijkend_reden:'Reden',afwijkend_toelichting:'Toelichting',milieuretour_type:'Type ophaling',formaatTV:'TV formaat',uitkomst:'Uitkomst',geplandeRoute:'Route gepland',next_day_reden:'Reden next day',geen_oplossing_reden:'Reden geen oplossing',advies_gelukt:'Advies uitkomst',onderweg_type:'Probleem',onderweg_uitkomst:'Uitkomst',cbf_depot_reden:'Vraag',cbf_depot_toelichting:'Toelichting',cbb_hub_reden:'Hub vraag',cbb_hub_toelichting:'Toelichting',tl_reden:'Vraag TL',tl_uitkomst:'Uitkomst TL'};
    // Apparaat + model tonen
    if (callData.model) {
      if (meerdereProducten && !answeredKeys.includes('product_keuze')) {
        h+='<span class="status-line">Apparaten: <b>'+alleGescrapteProducten.length+' producten gevonden</b></span>';
      } else {
        // Toon type prominent als dat bekend is, model als secundair
        if (callData.product) {
          h+='<span class="status-line">Apparaat: <b>'+callData.product+'</b> <span style="font-weight:400;color:#666;font-size:11px;">('+callData.model+')</span></span>';
        } else {
          h+='<span class="status-line">Model: <b>'+callData.model+'</b></span>';
        }
      }
    }
    ['locatie','ks_reden','ks_uitkomst','afwijkend_reden','afwijkend_toelichting','probleem','milieuretour_type','formaatTV','uitkomst','geplandeRoute','next_day_reden','geen_oplossing_reden','advies_gelukt','onderweg_type','onderweg_uitkomst','cbf_depot_reden','cbf_depot_toelichting','cbb_hub_reden','cbb_hub_toelichting','tl_reden','tl_uitkomst'].forEach(function(k){
      if (answeredKeys.includes(k)&&callData[k]&&k!=='fname'&&k!=='lname')
        h+='<span class="status-line">'+lbl[k]+': <b>'+callData[k]+'</b></span>';
    });
    h+='</div>';
    return h;
  }

  function getStapHint(stap) {
    if (!stap) return '';
    if (stap.type === 'product-multi') return 'Geldt het probleem voor meerdere producten? Klik ze dan allemaal aan.';
    if (stap.key === 'geplandeRoute') return 'Typ bijv. "tilburg 2m 4" — de tool zet dit om naar het juiste formaat.';
    return '';
  }

  // ── RENDER APP ────────────────────────────────────────────────
  function renderApp() {
    var backClass = canGoBack() ? 'back-btn active' : 'back-btn';
    var parkInfoTekst = 'Gebruik de parkeerknop wanneer je de uitkomst van dit gesprek nog niet definitief kunt vastleggen \u2014 bijvoorbeeld omdat je eerst overleg moet plegen met een teamleider van een van onze depots. De tool slaat je huidige voortgang op en sluit zichzelf. Wanneer je later terugkeert naar dezelfde bestelling en de tool opnieuw opent, kun je precies verder gaan waar je gebleven was. Zolang een sessie geparkeerd staat blijft de tool normaal beschikbaar voor andere bestellingen.';

    var statusAndContent = '<div id="stap-container"></div>';
    var mainContent = '';
    if (dsWide) {
      mainContent = '<div class="main-row"><div class="content">' + statusAndContent + '</div><div id="anders-container" class="sidebar"></div></div>';
    } else {
      mainContent = '<div class="content">' + statusAndContent + '</div><div id="anders-container" class="anders-scroll"></div>';
    }

    appContainer.innerHTML =
      '<div class="app">' +
        '<div class="header">' +
          '<span class="header-title">DS Logboek</span>' +
          '<div class="header-actions">' +
            '<button class="resize-btn" id="btn-height">\u2195 ' + (dsHeight===620?'S':dsHeight===760?'M':'L') + '</button>' +
            '<button class="resize-btn" id="btn-wide">' + (dsWide?'\u2b0c 2K':'\u2194') + '</button>' +
            '<button class="close-btn" id="btn-close">\u2715</button>' +
          '</div>' +
        '</div>' +
        mainContent +
        '<div class="footer"><div class="footer-inner" style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:8px;">' +
          '<button class="' + backClass + '" id="btn-terug" style="flex:1;">\u2190 Terug</button>' +
          (!isAlgemeen ? '<div id="geen-order-toggle" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;flex-shrink:0;">' +
            '<div style="position:relative;width:30px;height:17px;border-radius:9px;background:'+(geenOrderMode?'#ff6600':'#ccc')+';transition:background 0.18s;">' +
              '<div style="position:absolute;top:2px;left:'+(geenOrderMode?'13px':'2px')+';width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:left 0.18s;"></div>' +
            '</div>' +
            '<span style="font-size:11px;color:'+(geenOrderMode?'#ff6600':'#aaa')+';">'+(geenOrderMode?'Gegevens gewist':'Geen order')+'</span>' +
          '</div>' : '') +
        '</div></div>' +
        '<div style="text-align:center;padding:5px 14px;background:#F3F3F3;border-top:1px solid #DDDDDD;font-size:11px;color:#999999;flex-shrink:0;">DS Logboek v1.20.3</div>' +
      '</div>';

    idoc.getElementById('btn-close').onclick = function(){ wrapper.remove(); };
    idoc.getElementById('btn-height').onclick = function() {
      var stappen = [620, 760, 900].filter(function(h){ return h <= maxViewportHeight(); });
      if (stappen.length === 0) stappen = [clampHeight(620)];
      var idx = stappen.indexOf(dsHeight);
      dsHeight = stappen[(idx + 1) % stappen.length];
      localStorage.setItem('ds_height', dsHeight);
      iframe.style.height = dsHeight + 'px';
      renderApp();
    };
    idoc.getElementById('btn-wide').onclick = function() {
      dsWide = !dsWide;
      localStorage.setItem('ds_wide', dsWide ? '1' : '0');
      wrapper.style.width = dsWide ? '600px' : '340px';
      renderApp();
    };
    if (canGoBack()) idoc.getElementById('btn-terug').onclick = goBack;
    if (!isAlgemeen) idoc.getElementById('geen-order-toggle').onclick = function() {
      geenOrderMode = !geenOrderMode;
      if (geenOrderMode) {
        callData.route=''; callData.orderBron=''; callData.driver1=''; callData.driver2='';
        callData.model=''; callData.tijdvak=''; callData.aankomsttijd='';
        callData.product=''; callData.formaatTV=''; callData.productVerfijnd='';
        isProductAutoGuessed=false;
        var kf=['fname','lname'].filter(function(k){return answeredKeys.includes(k);});
        answeredKeys.length=0; kf.forEach(function(k){answeredKeys.push(k);});
        var ka=['fname','lname'].filter(function(k){return autoFilledKeys.includes(k);});
        autoFilledKeys.length=0; ka.forEach(function(k){autoFilledKeys.push(k);});
      }
      renderApp();
    };

    renderHuidigeStap();
  }

  // ── ANDERS SECTIE (fixed onderaan, buiten scrollbare content) ─
  function renderAndersSection(stap, fn) {
    var ac = idoc.getElementById('anders-container');
    if (!ac) return;
    ac.innerHTML = '';
    if (!stap) return;

    var toonAdvies    = stap.type==='probleem-select' || stap.type==='probleem-grouped' || stap.type==='uitkomst-select' || stap.type==='onderweg-select';
    var toonAfwijkend = stap.type==='probleem-select' || stap.type==='probleem-grouped';
    if (!toonAdvies) return;

    var isKSContext = callData.locatie==='Klantenservice' || callData.locatie==='Winkel';
    var isKSTerugsturen = isKSContext && (callData.ks_reden==='KS vraagt om held terug te sturen' || callData.ks_reden==='Winkel vraagt om held terug te sturen');
    var adviesOpties = isKSContext
      ? [{label:'Geen same day optie, KS plant zelf oplossing', waarde:'Geen same day optie, KS plant zelf oplossing'},
         {label:'DS adviseert andere oplossing aan KS', waarde:'DS adviseert andere oplossing aan KS'}]
      : [{label:'Ja, service alsnog uitgevoerd vandaag', waarde:'Ja, service uitgevoerd'},
         {label:'Nee, service ook met advies niet uitgevoerd', waarde:'Nee, geen oplossing door DS'}];

    function maakAdviesKnop(opt) {
      var b=idoc.createElement('button'); b.className='ux-btn advies-knop'; b.style.marginBottom='4px'; b.innerText=opt.label;
      b.onclick=function(){
        if (isKSContext) {
          if (isKSTerugsturen) { callData.ks_uitkomst='Advies gegeven'; if (!answeredKeys.includes('ks_uitkomst')) answeredKeys.push('ks_uitkomst'); }
          callData.uitkomst='KS advies gegeven';
          if (!answeredKeys.includes('uitkomst')) answeredKeys.push('uitkomst');
          callData.ks_advies_uitkomst=opt.waarde;
          if (!answeredKeys.includes('ks_advies_uitkomst')) answeredKeys.push('ks_advies_uitkomst');
          if (!answeredKeys.includes('probleem')) { callData.probleem='Advies gegeven'; answeredKeys.push('probleem'); }
        } else if (stap.type==='onderweg-select') {
          callData.onderweg_type='Advies gegeven';
          if (!answeredKeys.includes('onderweg_type')) answeredKeys.push('onderweg_type');
          callData.advies_gelukt=opt.waarde;
          if (!answeredKeys.includes('advies_gelukt')) answeredKeys.push('advies_gelukt');
        } else {
          callData.probleem='Advies gegeven';
          if (!answeredKeys.includes('probleem')) answeredKeys.push('probleem');
          callData.advies_gelukt=opt.waarde;
          if (!answeredKeys.includes('advies_gelukt')) answeredKeys.push('advies_gelukt');
        }
        renderApp();
      };
      return b;
    }

    function maakAfwijkendKnop(opt) {
      var b=idoc.createElement('button'); b.className='ux-btn afwijkend-knop'; b.style.marginBottom='4px'; b.innerText=opt;
      b.onclick=function(){
        ['probleem','product','formaatTV','milieuretour_type','uitkomst','geplandeRoute','next_day_reden','geen_oplossing_reden','advies_gelukt','product_keuze'].forEach(function(k){
          callData[k]=''; var ix=answeredKeys.indexOf(k); if(ix>-1) answeredKeys.splice(ix,1); var ax=autoFilledKeys.indexOf(k); if(ax>-1) autoFilledKeys.splice(ax,1);
        });
        callData.locatie='Afhandeling buiten DS'; callData.afwijkend_reden=opt;
        if(!answeredKeys.includes('locatie')) answeredKeys.push('locatie');
        if(!answeredKeys.includes('afwijkend_reden')) answeredKeys.push('afwijkend_reden');
        renderApp();
      };
      return b;
    }

    // Altijd zichtbaar: advies gegeven + afhandeling buiten DS opties
    var cont=idoc.createElement('div');

    // Advies gegeven sectie
    var advLbl=idoc.createElement('div'); advLbl.className='section-label'; advLbl.innerText='Advies gegeven';
    cont.appendChild(advLbl);
    adviesOpties.forEach(function(opt){ cont.appendChild(maakAdviesKnop(opt)); });

    // Afhandeling buiten DS sectie
    if (toonAfwijkend) {
      var afwLbl=idoc.createElement('div'); afwLbl.className='section-label'; afwLbl.innerText='Afhandeling buiten DS';
      if (!dsWide) afwLbl.style.marginTop='10px';
      cont.appendChild(afwLbl);
      ['Product niet aanwezig','Klant moet KS bellen','Held moet dit bij afmelden regelen met TL','Verkeerd gelabeld product','Overig'].forEach(function(opt){ cont.appendChild(maakAfwijkendKnop(opt)); });
    }

    ac.appendChild(cont);
  }

  // Landdetectie op basis van postcode voor adreslinks
  var adresLand = (function() {
    var p = scrapedPC.replace(/\s/g,'').toUpperCase();
    if (/[A-Z]/.test(p) && p.replace(/\D/g,'').length===4) return 'NL';
    if (!/[A-Z]/.test(p) && p.length===4) return 'BE';
    if (!/[A-Z]/.test(p) && p.length===5) return 'DE';
    return 'NL';
  })();
  var adresLinks = (adresLand==='NL'
    ? '<a href="https://bagviewer.kadaster.nl/lvbag/bag-viewer/?searchQuery=' + scrapedAdresQuery + '&zoomlevel=15" target="_blank" style="color:#0090e3;display:block;margin-top:6px;">🇳🇱 Bagviewer (Kadaster)</a>'
    : '') +
    (adresLand==='BE'
    ? '<a href="https://www.geopunt.be/kaart?zoomLevel=14&locationSearch=' + scrapedAdresQuery + '" target="_blank" style="color:#0090e3;display:block;margin-top:6px;">🇧🇪 Geopunt</a>'
    : '') +
    '<a href="https://www.google.com/maps/search/' + scrapedAdresQuery + '" target="_blank" style="color:#0090e3;display:block;margin-top:4px;">🗺 Google Maps</a>' +
    '<a href="https://www.bing.com/maps?q=' + scrapedAdresQuery + '" target="_blank" style="color:#0090e3;display:block;margin-top:4px;">🗺 Bing Maps</a>';

  var stapInfo = {
    'Advies gegeven': 'Gebruik deze optie ook wanneer een held belt met een vraag over een te leveren product, of wanneer je op afstand advies geeft waardoor de held verder kan.',
    'Service niet uitvoerbaar': 'Gebruik dit wanneer de situatie bij de klant de uitvoering onmogelijk maakt — denk aan een trap die te smal is, geen geschikte aansluiting, of de klant wil het product toch niet. De held dient dit zelf af te handelen in Jerney.',
    'Verkeerd nummer in systeem': 'Kies deze optie als het juiste nummer later aan jou is doorgegeven en je dit vervolgens aan de held hebt doorgegeven.',
    'Ja, service uitgevoerd': 'Door jouw uitleg of ingrijpen is de klant toch vandaag nog geholpen.',
    'Nee, geen oplossing door DS': 'Helaas is het nog steeds niet gelukt. Kies dit bijvoorbeeld wanneer de klant zelf nog iets aan de situatie aan dient te passen.'
  };

  function maakInfoKnop(tekst, container) {
    var rij = idoc.createElement('div');
    rij.style.cssText = 'display:flex;align-items:stretch;margin-bottom:5px;gap:6px;position:relative;';
    var btn = idoc.createElement('button');
    btn.className = 'ux-btn'; btn.innerText = tekst;
    btn.style.cssText = 'flex:1;margin-bottom:0;';
    if (stapInfo[tekst]) {
      var iBtn = idoc.createElement('button');
      iBtn.innerText = 'ℹ';
      iBtn.style.cssText = 'width:36px;flex-shrink:0;border:1px solid #DDDDDD;border-radius:8px;background:#F2F7FC;color:#0090e3;cursor:default;font-size:14px;position:relative;';
      var tooltip = idoc.createElement('div');
      tooltip.style.cssText = 'display:none;position:absolute;right:0;top:calc(100% + 4px);width:220px;font-size:11px;color:#285dab;background:#F2F7FC;border:1px solid #cce9f9;border-radius:6px;padding:8px 10px;line-height:1.5;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.1);';
      tooltip.innerHTML = stapInfo[tekst];
      iBtn.appendChild(tooltip);
      iBtn.onmouseenter = function() { tooltip.style.display = 'block'; };
      iBtn.onmouseleave = function() { tooltip.style.display = 'none'; };
      rij.appendChild(btn); rij.appendChild(iBtn);
    } else {
      rij.appendChild(btn);
    }
    container.appendChild(rij);
    return btn;
  }

  // ── RENDER STAP ───────────────────────────────────────────────
  function renderHuidigeStap() {
    var container=idoc.getElementById('stap-container');
    var stap=getNextStep();

    // Product chip bovenaan
    var productChip = '';
    if (callData.model) {
      var productLabel = '';
      if (meerdereProducten && !answeredKeys.includes('product_keuze')) {
        productLabel = 'Apparaten: ' + alleGescrapteProducten.length + ' gevonden';
      } else if (callData.product) {
        productLabel = callData.product + ' (' + callData.model + ')';
      } else {
        productLabel = 'Model: ' + callData.model;
      }
      if (productLabel) {
        productChip = '<div style="font-size:11px; color:#666; background:#F3F3F3; border:1px solid #E0E0E0; border-radius:12px; padding:3px 8px; display:inline-block; margin-bottom:8px;">' + productLabel + '</div>';
      }
    }

    // Hervatten scherm bij geparkeerde sessie zelfde order
    if (startMelding === 'hervatten') {
      container.innerHTML = productChip +
        '<div class="park-melding" style="background:#d4edda;border-color:#00B900;border-left-color:#00B900;color:#155724;">' +
        '\u23f8 Er is een geparkeerde sessie gevonden voor deze bestelling. Wil je verder gaan waar je gebleven was?' +
        '</div>' +
        '<button id="btn-hervat" class="action-btn submit-btn" style="margin-bottom:8px;">Ja, verder gaan</button>' +
        '<button id="btn-nieuw" class="action-btn" style="background:#F2F7FC;color:#0090e3;border:1px solid #0090e3;">Nee, opnieuw beginnen</button>';
      idoc.getElementById('btn-hervat').onclick = function() { startMelding = ''; renderApp(); };
      idoc.getElementById('btn-nieuw').onclick = function() {
        verwijderGeparkeerd();
        startMelding = '';
        // Reset state volledig
        answeredKeys = []; autoFilledKeys = []; isProductAutoGuessed = false;
        Object.keys(callData).forEach(function(k){
          if (k !== 'user' && k !== 'route' && k !== 'orderBron' && k !== 'driver1' && k !== 'driver2' && k !== 'depot' && k !== 'model') callData[k] = '';
        });
        if (bFname) { callData.fname=bFname; answeredKeys.push('fname'); autoFilledKeys.push('fname'); }
        if (bLname) { callData.lname=bLname; answeredKeys.push('lname'); autoFilledKeys.push('lname'); }
        renderApp();
      };
      return;
    }
    if (startMelding && startMelding.startsWith('andere_orders:')) {
      if (productChip) container.innerHTML = productChip;
      var andereOrders = startMelding.split(':')[1].split(',');
      var meldingDiv = idoc.createElement('div');
      meldingDiv.className = 'park-melding';
      meldingDiv.innerHTML = '\u26a0\ufe0f Let op: er ' + (andereOrders.length === 1 ? 'is nog een geparkeerde sessie' : 'zijn nog ' + andereOrders.length + ' geparkeerde sessies') + ' open. Weet je zeker dat je op de juiste bestelling werkt?';
      container.appendChild(meldingDiv);
      startMelding = '';
    }

    // SAMENVATTING
    if (!stap) {
      var isGepland=callData.uitkomst==='Same day gepland'||callData.uitkomst==='Next day gepland'||callData.uitkomst==='Same day visit gepland'||callData.uitkomst==='Next day visit gepland'||callData.ks_uitkomst==='Same day gepland'||callData.ks_uitkomst==='Next day gepland';
      var submitHtml = productChip;

      // Blauw info paneeltje voor CBF depot vraag
      if (callData.bellerType==='CBF' && callData.locatie==='Vraag voor het depot') {
        var depotRedenLabels = {
          'Ziekmelding': 'fietser zich ziek te melden via het depot.',
          'Fiets kapot / incident': 'contact op te nemen met het depot voor verdere instructies.',
          'Informeren waar de vracht is': 'contact op te nemen met het depot voor informatie over de vracht.',
          'Anders': 'contact op te nemen met het depot.'
        };
        var depotTip = depotRedenLabels[callData.cbf_depot_reden] || 'contact op te nemen met het depot.';
        submitHtml += '<div class="info-box">ℹ️ <b>Advies aan de fietser:</b><br>Voor deze vraag dient de fietser ' + depotTip + '</div>';
      }
      // Blauw info paneeltje voor verkeerd gelabeld product
      if (callData.probleem==='Verkeerd gelabeld product') {
        submitHtml += '<div class="info-box">ℹ️ <b>Instructie voor de Held:</b><br>Kies in Jerney voor "Verkeerd gelabeld product". Neem het verkeerde product mee terug naar het depot. Er wordt zo snel mogelijk een nieuw product naar de klant verzonden.</div>';
      }
      // Blauw info paneeltje voor winkel informatievraag
      if (callData.locatie==='Winkel' && callData.ks_reden==='Informatie over vracht') {
        submitHtml += '<div class="info-box">ℹ️ <b>Advies aan de winkel:</b><br>Voor informatie over de vracht kunnen zij het best contact opnemen met het depot dat de levering verzorgt' + (callData.depot && callData.depot !== 'Onbekend' ? ': <b>' + callData.depot + '</b>' : '') + '.</div>';
      }
      // Info blokje voor "Adres klopt niet" — Jerney instructie
      if (callData.onderweg_type==='Adres klopt niet') {
        submitHtml += '<div class="info-box">ℹ️ <b>Instructie voor de Held:</b><br>Geef aan in Jerney dat het adres niet klopt. Noteer het correcte adres of de afwijking in het opmerkingenveld zodat het depot dit kan doorzetten naar de juiste afdeling.</div>';
      }
      // Info blokje voor "Klant niet thuis" — checklist + Jerney instructie
      if (callData.onderweg_type==='Klant niet thuis') {
        submitHtml += '<div class="info-box">ℹ️ <b>Check of de held deze stappen heeft doorlopen:</b>' +
          '<div class="controle-item">🔔 Aangebeld en gewacht</div>' +
          '<div class="controle-item">📞 Klant gebeld</div>' +
          '<div class="controle-item">🕒 Binnen het gecommuniceerde tijdvak aangekomen</div>' +
          '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #cce9f9;"><b>Afmelden in Jerney:</b><br>Kies "Klant niet thuis" en maak een foto van de voordeur als bewijs.</div>' +
          '</div>';
      }
      // Info blokje voor CBF pakje niet ingeladen + niet opgelost — Jerney instructie
      if (callData.cbf_pakket_reden==='Pakje niet ingeladen' && callData.cbf_pakket_uitkomst==='Niet opgelost — instructie gegeven in Jerney') {
        submitHtml += '<div class="info-box">ℹ️ <b>Instructie voor de fietser:</b><br>Verwerk het missende pakje in Jerney — kies de optie "Pakket ontbreekt" of vergelijkbaar voor dit soort situaties.</div>';
      }
      // Info blokje voor andere bellers (niet over bezorging)
      if (callData.bellerType==='Andere beller') {
        submitHtml += '<div class="info-box">ℹ️ <b>Andere beller</b><br>Dit gesprek gaat niet over een bezorging. Je hoeft niet aan te geven wat het probleem was — gewoon loggen is voldoende.</div>';
      }
      // Rode warning voor fornuis
      if (callData.product==='Fornuis') {
        submitHtml += '<div class="info-box" style="background:#FFE6E6;border-color:#E63946;color:#C1121F;">⚠️ <b>DS serveert geen fornuizen!</b><br>Deze bestelling kan niet via DS geplaatst worden. Kies "Niet uitvoerbaar" of "Afhandeling buiten DS" voor verdere afhandeling.</div>';
      }

      var direxUrl = '';
      if (callData.uitkomst === 'Same day gepland' || callData.uitkomst === 'Next day gepland') {
        // Controle vragen + DireXtion auto-open in één blauw paneeltje
        var controleItems = '<div class="controle-item">📦 Kan het product bij de klant blijven?</div>';
        if (callData.uitkomst === 'Same day gepland') controleItems += '<div class="controle-item">🏠 Is de klant later vandaag nog thuis?</div>';
        var direxEmail = '';
        if (isBasicPage) direxEmail = basicFieldInSection('Geadresseerde', 'E-mailadres') || '';
        else { var emEl = document.querySelector("[data-bind*='Static.Visit.Email']") || document.querySelector("[data-bind*='Email']"); direxEmail = emEl ? emEl.innerText.trim() : ''; }
        var direxToday = (function(){ var d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0'); return {slash:y+'/'+m+'/'+da, dash:y+'-'+m+'-'+da}; })();
        var direxFilter = encodeURIComponent(JSON.stringify({StartDate:direxToday.slash,EndDate:direxToday.dash,EmailAddress:direxEmail,CountryIds:[],ChannelIds:[],NetworkIds:[],ServiceTypeIds:[],ShipmentStatusIds:[],VisitStatusIds:[],ParcelStatusIds:[],ShipperIds:[],DepotIds:[],CharacteristicIds:[]}));
        direxUrl = 'https://coolblue.dirextion.nl/Basic/Orders?filter=' + direxFilter;
        submitHtml += '<div class="controle-box">' +
          '<div class="controle-title">✓ Check voor het plannen</div>' +
          controleItems +
          '<div class="controle-item" style="margin-top:8px;padding-top:8px;border-top:1px solid #DDDDDD;">📝 Vergeet niet een opmerking te plaatsen op de originele order in DireXtion' + (isBasicPage ? '.' : ' — deze wordt automatisch in een nieuw tabblad geopend na loggen.') + '</div>' +
          '</div>';
      }
      if (isGepland) {
        submitHtml += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;"><button id="btn-clipboard" class="action-btn submit-btn">📋 Klembord</button><button id="btn-loggen" class="action-btn submit-btn">✓ Loggen</button><button id="btn-both" class="action-btn submit-btn">Loggen + Klembord</button></div>';
      } else {
        submitHtml += '<button id="btn-loggen" class="action-btn submit-btn">✓ Loggen</button>';
      }
      container.innerHTML = submitHtml;
      var openDirex = function() { if (direxUrl) window.open(direxUrl, '_blank'); };
      if (isGepland) {
        idoc.getElementById('btn-clipboard').onclick = function() { kopieerNaarKlembord(); };
        idoc.getElementById('btn-loggen').onclick = function() { if (!isBasicPage) openDirex(); verstuurAlleen(); };
        idoc.getElementById('btn-both').onclick = function() { if (!isBasicPage) openDirex(); verstuurEnKopieer(); };
      } else {
        idoc.getElementById('btn-loggen').onclick = function() { if (!isBasicPage) openDirex(); verstuurAlleen(); };
      }
      renderAndersSection(null, null);
      return;
    }

    container.innerHTML=productChip+'<label>'+stap.label+'</label>';

    var handleSelect=function(o) {
      callData[stap.key]=o; answeredKeys.push(stap.key);
      if (stap.key==='product_keuze') {
        // Haal het originele modelnummer terug (vóór het " — Type" gedeelte)
        var origNaam = alleGescrapteProducten[stap.opties ? stap.opties.indexOf(o) : 0] || o.split(' — ')[0];
        callData.model = origNaam;
        var d2 = detecteerType(origNaam);
        callData.product = d2 && d2.typeGuess ? d2.typeGuess.charAt(0).toUpperCase()+d2.typeGuess.slice(1) : '';
        var nl = origNaam.toLowerCase();
        if (!callData.product && (nl.includes('tv')||nl.includes('televisie')||nl.match(/(oled|qled)/))) callData.product='Televisie';
        if (callData.product) { answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        // TV formaatcheck alleen als het type Televisie is
        if (callData.product === 'Televisie') {
          var tvM2 = origNaam.toLowerCase().match(/(?:qe|oled|kd|xr|ue|gq|tx-)?([4-8]\d)[a-z]/i)||origNaam.toLowerCase().match(/\b([4-8]\d)\s?(inch|")\b/i);
          if (tvM2) { callData.formaatTV=parseInt(tvM2[1])>=55?'Ja (>= 55 inch)':'Nee (< 55 inch)'; answeredKeys.push('formaatTV'); autoFilledKeys.push('formaatTV'); }
        }
      }
      if (stap.key==='probleem') {
        var sp=o.toLowerCase();
        if ((sp.includes('milieuretour')||sp.includes('pick')||sp.includes('advies'))&&isProductAutoGuessed) {
          answeredKeys=answeredKeys.filter(function(k){ return k!=='product'&&k!=='formaatTV'; });
          callData.product=''; callData.formaatTV=''; isProductAutoGuessed=false;
        }
        // TV-installatie problemen: product impliciet Televisie
        if ((o.includes('TV')||o.includes('Soundbar'))&&!answeredKeys.includes('product')) {
          callData.product='Televisie'; answeredKeys.push('product'); autoFilledKeys.push('product');
        }
      }
      renderApp();
    };

    // PROBLEEM SELECT
    if (stap.type==='product-multi') {
      var geselecteerd = [];
      var volgendeBtn = idoc.createElement('button');
      volgendeBtn.className = 'action-btn'; volgendeBtn.innerText = 'Volgende';
      volgendeBtn.style.cssText = 'width:100%;padding:11px;border:none;border-radius:8px;background:#0090e3;color:white;font-weight:600;font-size:14px;margin-top:10px;opacity:0.4;cursor:default;';

      stap.opties.forEach(function(o) {
        var b = idoc.createElement('button'); b.className='ux-btn'; b.innerText=o;
        b.onclick = function() {
          var idx = geselecteerd.indexOf(o);
          if (idx > -1) { geselecteerd.splice(idx,1); b.classList.remove('selected'); }
          else { geselecteerd.push(o); b.classList.add('selected'); }
          volgendeBtn.style.opacity = geselecteerd.length > 0 ? '1' : '0.4';
          volgendeBtn.style.cursor  = geselecteerd.length > 0 ? 'pointer' : 'default';
        };
        container.appendChild(b);
      });

      volgendeBtn.onclick = function() {
        if (geselecteerd.length === 0) return;
        var origNamen = geselecteerd.map(function(label) {
          var idx = stap.opties.indexOf(label);
          return idx > -1 ? alleGescrapteProducten[idx] : label;
        });
        callData.product_keuze = geselecteerd.join(', ');
        callData.model = origNamen.join(', ');
        var eersteNaam = origNamen[0];
        var d2 = detecteerType(eersteNaam);
        callData.product = d2 && d2.typeGuess ? d2.typeGuess.charAt(0).toUpperCase()+d2.typeGuess.slice(1) : '';
        var nl2 = eersteNaam.toLowerCase();
        if (!callData.product && (nl2.includes('tv')||nl2.includes('televisie')||nl2.match(/(oled|qled)/))) callData.product='Televisie';
        if (callData.product) { answeredKeys.push('product'); autoFilledKeys.push('product'); isProductAutoGuessed=true; }
        if (callData.product==='Televisie') {
          var tvM3 = eersteNaam.toLowerCase().match(/(?:qe|oled|kd|xr|ue|gq|tx-)?([4-8]\d)[a-z]/i)||eersteNaam.toLowerCase().match(/\b([4-8]\d)\s?(inch|")\b/i);
          if (tvM3) { callData.formaatTV=parseInt(tvM3[1])>=55?'Ja (>= 55 inch)':'Nee (< 55 inch)'; answeredKeys.push('formaatTV'); autoFilledKeys.push('formaatTV'); }
        }
        answeredKeys.push('product_keuze');
        renderApp();
      };
      container.appendChild(volgendeBtn);
      var hintDiv = idoc.createElement('div');
      hintDiv.style.cssText = 'margin-top:12px;background:#F2F7FC;border:1px solid #cce9f9;border-left:3px solid #0090e3;border-radius:6px;padding:10px 12px;font-size:12px;color:#285dab;line-height:1.5;';
      hintDiv.innerText = 'Geldt het probleem voor meerdere producten? Klik ze dan allemaal aan voordat je op Volgende drukt.';
      container.appendChild(hintDiv);

    } else if (stap.type==='product-keuze') {
      stap.opties.forEach(function(o){ var b=idoc.createElement('button'); b.className='ux-btn'; b.innerText=o; b.onclick=function(){ handleSelect(o); }; container.appendChild(b); });

    } else if (stap.type==='probleem-select') {
      var hOpts=stap.opties.filter(function(o){ return o!=='Advies gegeven'; });
      var aOpts=alleProbleemOpties.filter(function(o){ return !hOpts.includes(o) && o!=='Advies gegeven'; });
      hOpts.forEach(function(o){
        var b = maakInfoKnop(o, container);
        b.onclick=function(){ handleSelect(o); };
      });
      var tBtn=idoc.createElement('div'); tBtn.className='toggle-link'; tBtn.innerText='Toon overige opties 🔽';
      var eDiv=idoc.createElement('div'); eDiv.style.display='none';
      aOpts.forEach(function(o){
        var b = maakInfoKnop(o, eDiv);
        b.style.opacity='0.7';
        b.onclick=function(){ handleSelect(o); };
      });
      var bOv=idoc.createElement('button'); bOv.className='ux-btn'; bOv.style.cssText='opacity:0.7;margin-top:4px;';  bOv.innerText='Overig (typen...)';
      bOv.onclick=function(){
        container.innerHTML='<label>'+stap.label+'</label>';
        var inp=idoc.createElement('input'); inp.type='text'; inp.placeholder='Typ hier de taak...';
        var btn=idoc.createElement('button'); btn.className='action-btn'; btn.innerText='Volgende';
        container.appendChild(inp); container.appendChild(btn); inp.focus();
        var nxt=function(){ if(!inp.value.trim()) return; handleSelect(inp.value.trim()); };
        btn.onclick=nxt; inp.onkeydown=function(e){ if(e.key==='Enter') nxt(); };
      };
      eDiv.appendChild(bOv);
      tBtn.onclick=function(){ var h=eDiv.style.display==='none'; eDiv.style.display=h?'block':'none'; tBtn.innerText=h?'Verberg overige opties 🔼':'Toon overige opties 🔽'; };
      container.appendChild(tBtn); container.appendChild(eDiv);

    // PRODUCT TYPE KEUZE — bij onherkend type
    } else if (stap.type==='product-type-keuze') {
      ['Wasmachine','Wasdroogcombinatie','Droger','Koelkast / Vriezer','Vaatwasser','Oven','Televisie','Soundbar','Overig'].forEach(function(o) {
        var b=idoc.createElement('button'); b.className='ux-btn'; b.innerText=o;
        b.onclick=function(){
          callData[stap.key]=o;
          if (!answeredKeys.includes(stap.key)) answeredKeys.push(stap.key);
          if (!autoFilledKeys.includes(stap.key)) autoFilledKeys.push(stap.key);
          renderApp();
        };
        container.appendChild(b);
      });

    // PROBLEEM GESECTEERD — per producttype in twee kolommen
    } else if (stap.type==='probleem-grouped') {
      var pgSections = buildProbleemSections();
      var pgAutoExpand = pgSections.length === 1;

      // Controlevraag bovenaan als die al gezet is (bij meerdere producten)
      var existCQ2 = idoc.getElementById('pg-cq');
      if (existCQ2) { container.appendChild(existCQ2); }

      pgSections.forEach(function(sec, secIdx) {
        var secWrap = idoc.createElement('div');
        secWrap.style.marginBottom = '8px';
        var secBody = idoc.createElement('div');

        if (!pgAutoExpand) {
          var secHead = idoc.createElement('div');
          secHead.style.cssText = 'padding:8px 12px;background:#F2F7FC;border:1px solid #cce9f9;border-radius:8px;font-size:13px;font-weight:600;color:#285dab;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;margin-bottom:4px;';
          secHead.innerHTML = '<span>'+sec.typeLabel+'</span><span class="pg-arr">\u25be</span>';
          secBody.style.cssText = 'display:none;padding-left:0;';
          secHead.onclick = (function(sh,sb){ return function(){
            var open=sb.style.display!=='none';
            sb.style.display=open?'none':'block';
            sh.querySelector('.pg-arr').textContent=open?'\u25be':'\u25b4';
          }; })(secHead, secBody);
          secWrap.appendChild(secHead);
        } else {
          if (sec.typeLabel) {
            var secLbl=idoc.createElement('div'); secLbl.className='section-label';
            secLbl.innerText=sec.typeLabel; secWrap.appendChild(secLbl);
          }
        }

        function maakProbleemGrid(opties, container2, sec2, secIdx2, collapsed) {
          var grid = idoc.createElement('div'); grid.className='btn-grid';
          opties.forEach(function(dispLabel) {
            var logLabel = toLogLabel(dispLabel);
            var btn = idoc.createElement('button'); btn.className='ux-btn'; btn.innerText=dispLabel;
            btn.onclick = (function(disp, log, s, si){ return function(){
              callData.probleem = log;
              if (!answeredKeys.includes('probleem')) answeredKeys.push('probleem');
              // product instellen vanuit sectie
              if (!answeredKeys.includes('product')) { callData.product=s.typeLabel; answeredKeys.push('product'); autoFilledKeys.push('product'); }
              if (s.origNaam) callData.model=s.origNaam;
              // TV formaatcheck
              if ((s.typeKey==='televisie'||s.typeKey==='televisie+soundbar')&&!answeredKeys.includes('formaatTV')) {
                var tvStr3=(s.origNaam||'').replace(/^\S+\s*/,'');
                var tvM3=tvStr3.match(/(?:qe|oled|kd|xr|ue|tx-?)?([4-8]\d)[a-z]/i)||tvStr3.match(/\b([4-8]\d)\s?(inch|")\b/i)||tvStr3.match(/^(\d{2})[A-Z]/i);
                if (tvM3){callData.formaatTV=parseInt(tvM3[1])>=55?'Ja (>= 55 inch)':'Nee (< 55 inch)';answeredKeys.push('formaatTV');autoFilledKeys.push('formaatTV');}
              }
              if (!answeredKeys.includes('product_keuze')) { callData.product_keuze=s.typeLabel; answeredKeys.push('product_keuze'); }

              // Controlevraag als zelfde probleem ook in andere sectie
              var pgS2 = buildProbleemSections();
              var otherSecs2 = pgS2.filter(function(s2,i2){ return i2!==si && (s2.opties.indexOf(disp)!==-1||s2.extraOpties.indexOf(disp)!==-1); });
              if (meerdereProducten && pgS2.length>1 && otherSecs2.length>0) {
                var otherNames2=otherSecs2.map(function(s2){ return s2.typeLabel; }).join(' en de ');
                var cq=idoc.createElement('div'); cq.id='pg-cq';
                cq.style.cssText='background:#fff8e1;border:1px solid #ffc107;border-left:4px solid #ffc107;border-radius:6px;padding:10px 12px;font-size:13px;color:#533f03;margin-bottom:8px;';
                var cqTxt=idoc.createElement('div'); cqTxt.style.cssText='font-weight:600;margin-bottom:8px;';
                cqTxt.innerText='Geldt "'+disp+'" ook voor de '+otherNames2+'?'; cq.appendChild(cqTxt);
                var jaBtn2=idoc.createElement('button'); jaBtn2.className='ux-btn';
                jaBtn2.style.cssText='margin-bottom:4px;background:#d4edda;border-color:#00B900;color:#155724;font-weight:600;';
                jaBtn2.innerText=otherSecs2.length > 1 ? 'Ja, voor alle' : 'Ja, voor beide';
                jaBtn2.onclick=(function(allS2){ return function(){
                  var allModels2=allS2.map(function(s3){ return s3.origNaam; }).filter(Boolean);
                  callData.product_keuze=allS2.map(function(s3){ return s3.typeLabel; }).join(', ');
                  callData.model=allModels2.join(', ');
                  renderApp();
                }; })([s].concat(otherSecs2));
                var neeBtn2=idoc.createElement('button'); neeBtn2.className='ux-btn';
                neeBtn2.innerText='Nee, alleen '+s.typeLabel;
                neeBtn2.onclick=function(){ renderApp(); };
                cq.appendChild(jaBtn2); cq.appendChild(neeBtn2);
                if (otherSecs2.length > 1) {
                  var kiesBtn=idoc.createElement('button'); kiesBtn.className='ux-btn'; kiesBtn.style.cssText='margin-top:4px;margin-bottom:0;';
                  kiesBtn.innerText='Kies zelf welke producten';
                  kiesBtn.onclick=function(){
                    answeredKeys=answeredKeys.filter(function(k){ return k!=='product_keuze'&&k!=='product'&&k!=='formaatTV'; });
                    autoFilledKeys=autoFilledKeys.filter(function(k){ return k!=='product'&&k!=='formaatTV'; });
                    callData.product_keuze=''; callData.product=''; callData.formaatTV='';
                    renderApp();
                  };
                  cq.appendChild(kiesBtn);
                }
                // Zet controlevraag bovenaan container
                var firstChild = container.firstChild;
                container.insertBefore(cq, firstChild);
                container.scrollTop=0;
                return;
              }
              renderApp();
            }; })(dispLabel, logLabel, sec2, secIdx2);
            grid.appendChild(btn);
          });
          // Uitklapbare TV-only opties
          if (sec2.extraOpties && sec2.extraOpties.length>0) {
            var tvToggle=idoc.createElement('div'); tvToggle.className='toggle-link'; tvToggle.style.cssText='font-size:11px;margin-top:4px;';
            tvToggle.innerText='Alleen TV \u25be';
            var tvExpand=idoc.createElement('div'); tvExpand.style.display='none';
            var tvGrid=idoc.createElement('div'); tvGrid.className='btn-grid'; tvGrid.style.marginTop='4px';
            sec2.extraOpties.forEach(function(dispLabel2){
              var logLabel2=toLogLabel(dispLabel2);
              var btn2=idoc.createElement('button'); btn2.className='ux-btn'; btn2.innerText=dispLabel2;
              btn2.onclick=(function(disp2,log2,s2,si2){ return function(){
                callData.probleem=log2;
                if(!answeredKeys.includes('probleem')) answeredKeys.push('probleem');
                if(!answeredKeys.includes('product')){ callData.product=s2.typeLabel; answeredKeys.push('product'); autoFilledKeys.push('product'); }
                if(s2.origNaam) callData.model=s2.origNaam;
                if(!answeredKeys.includes('product_keuze')){ callData.product_keuze=s2.typeLabel; answeredKeys.push('product_keuze'); }
                renderApp();
              };})(dispLabel2,logLabel2,sec2,secIdx2);
              tvGrid.appendChild(btn2);
            });
            tvExpand.appendChild(tvGrid);
            tvToggle.onclick=function(){ var o=tvExpand.style.display!=='none'; tvExpand.style.display=o?'none':'block'; tvToggle.innerText=o?'Alleen TV \u25be':'Alleen TV \u25b4'; };
            container2.appendChild(grid); container2.appendChild(tvToggle); container2.appendChild(tvExpand);
            return;
          }
          container2.appendChild(grid);
        }

        maakProbleemGrid(sec.opties, secBody, sec, secIdx, false);

        // Overig knop
        var ovBtn2=idoc.createElement('button'); ovBtn2.className='ux-btn';
        ovBtn2.style.cssText='margin-top:4px;opacity:0.7;width:100%;'; ovBtn2.innerText='Overig (typen...)';
        ovBtn2.onclick=function(){
          container.innerHTML='<label>'+stap.label+'</label>';
          var inp2=idoc.createElement('input'); inp2.type='text'; inp2.placeholder='Typ hier de taak...';
          var btn3=idoc.createElement('button'); btn3.className='action-btn'; btn3.innerText='Volgende';
          container.appendChild(inp2); container.appendChild(btn3); inp2.focus();
          var nxt3=function(){ if(!inp2.value.trim()) return; callData.probleem=inp2.value.trim(); answeredKeys.push('probleem'); renderApp(); };
          btn3.onclick=nxt3; inp2.onkeydown=function(e){ if(e.key==='Enter') nxt3(); };
        };
        secBody.appendChild(ovBtn2);
        secWrap.appendChild(secBody);
        container.appendChild(secWrap);
      });

        // UITKOMST SELECT
    } else if (stap.type==='uitkomst-select') {
      stap.opties.forEach(function(o){ var b=idoc.createElement('button'); b.className='ux-btn'; b.innerText=o; b.onclick=function(){ handleSelect(o); }; container.appendChild(b); });

    // ADRES UITKOMST SELECT — met links paneeltje
    } else if (stap.type==='adres-uitkomst-select') {
      stap.opties.forEach(function(o){ var b=idoc.createElement('button'); b.className='ux-btn'; b.innerText=o; b.onclick=function(){ handleSelect(o); }; container.appendChild(b); });
      var adresPaneel = idoc.createElement('div');
      adresPaneel.style.cssText = 'margin-top:12px;background:#F2F7FC;border:1px solid #cce9f9;border-left:3px solid #0090e3;border-radius:6px;padding:10px 12px;font-size:12px;color:#285dab;line-height:1.6;';
      adresPaneel.innerHTML = '🔍 <b>Zoek het adres op:</b>' + adresLinks;
      container.appendChild(adresPaneel);

    // ALGEMEEN BLOCKS — advies gegeven + afhandeling buiten DS, zonder orderkoppeling
    // BELLER SELECT — CBB / CBF / Anders
    } else if (stap.type==='beller-select') {
      var sep0=idoc.createElement('hr'); sep0.className='section-divider'; container.appendChild(sep0);
      var cbbBtn=idoc.createElement('button'); cbbBtn.className='ux-btn'; cbbBtn.innerText='CBB — Bezorger belt';
      cbbBtn.onclick=function(){ callData.bellerType='CBB'; answeredKeys.push('bellerType'); renderApp(); };
      container.appendChild(cbbBtn);
      var cbfBtn=idoc.createElement('button'); cbfBtn.className='ux-btn'; cbfBtn.innerText='CBF — Fietser belt';
      cbfBtn.onclick=function(){ callData.bellerType='CBF'; answeredKeys.push('bellerType'); renderApp(); };
      container.appendChild(cbfBtn);
      var sep2=idoc.createElement('hr'); sep2.className='section-divider'; container.appendChild(sep2);
      var lbl2=idoc.createElement('div'); lbl2.className='section-label'; lbl2.innerText='Anders'; container.appendChild(lbl2);
      ['Klantenservice belt','Winkel belt'].forEach(function(o){
        var b=idoc.createElement('button'); b.className='ux-btn advies-btn'; b.innerText=o;
        b.onclick=function(){
          callData.bellerType='Anders';
          answeredKeys.push('bellerType');
          // Direct locatie instellen zodat de juiste flow start
          callData.locatie = o==='Klantenservice belt' ? 'Klantenservice' : 'Winkel';
          answeredKeys.push('locatie');
          renderApp();
        };
        container.appendChild(b);
      });
      var tlBtn=idoc.createElement('button'); tlBtn.className='ux-btn advies-btn'; tlBtn.innerText='Teamleider belt';
      tlBtn.onclick=function(){ callData.bellerType='Teamleider'; answeredKeys.push('bellerType'); renderApp(); };
      container.appendChild(tlBtn);
      var extToggle=idoc.createElement('button'); extToggle.className='ux-btn advies-btn'; extToggle.innerText='Andere bellers ▾';
      var extExpand=idoc.createElement('div'); extExpand.style.cssText='display:none;margin-top:5px;';
      ['Technische Dienst belt','Yeply belt','G4S belt'].forEach(function(o){
        var b=idoc.createElement('button'); b.className='ux-btn'; b.style.marginBottom='4px'; b.innerText=o;
        b.onclick=function(){
          callData.bellerType='Andere beller';
          answeredKeys.push('bellerType');
          callData.locatie = o.replace(' belt','');
          answeredKeys.push('locatie');
          renderApp();
        };
        extExpand.appendChild(b);
      });
      extToggle.onclick=function(){ extExpand.style.display=extExpand.style.display==='none'?'block':'none'; };
      container.appendChild(extToggle); container.appendChild(extExpand);

    // CBF LOCATIE SELECT — Onderweg / Vraag voor het depot
    } else if (stap.type==='cbf-locatie-select') {
      stap.opties.forEach(function(o){ var b=idoc.createElement('button'); b.className='ux-btn'; b.innerText=o; b.onclick=function(){ handleSelect(o); }; container.appendChild(b); });
      // Advies als toggle onderaan
      var sep3=idoc.createElement('hr'); sep3.className='section-divider'; container.appendChild(sep3);
      var lbl3=idoc.createElement('div'); lbl3.className='section-label'; lbl3.innerText='Anders'; container.appendChild(lbl3);
      var advToggle2=idoc.createElement('button'); advToggle2.className='ux-btn advies-btn'; advToggle2.innerText='Advies gegeven \u25be';
      var advExpand2=idoc.createElement('div'); advExpand2.style.cssText='display:none;margin-top:5px;';
      [{label:'Ja, service alsnog uitgevoerd vandaag', waarde:'Ja, service uitgevoerd'},
       {label:'Nee, service ook met advies niet uitgevoerd', waarde:'Nee, geen oplossing door DS'}
      ].forEach(function(opt){
        var b=idoc.createElement('button'); b.className='ux-btn'; b.style.marginBottom='4px'; b.innerText=opt.label;
        b.onclick=function(){
          callData.onderweg_type='Advies gegeven';
          if (!answeredKeys.includes('locatie')) answeredKeys.push('locatie');
          if (!answeredKeys.includes('onderweg_type')) answeredKeys.push('onderweg_type');
          callData.advies_gelukt=opt.waarde;
          if (!answeredKeys.includes('advies_gelukt')) answeredKeys.push('advies_gelukt');
          renderApp();
        };
        advExpand2.appendChild(b);
      });
      advToggle2.onclick=function(){ var h=advExpand2.style.display==='none'; advExpand2.style.display=h?'block':'none'; advToggle2.innerText=h?'Advies gegeven \u25b4':'Advies gegeven \u25be'; };
      container.appendChild(advToggle2); container.appendChild(advExpand2);

    // LOCATIE SELECT — CBB Bij de klant / Onderweg, met Anders sectie
    } else if (stap.type==='locatie-select') {
      stap.opties.forEach(function(o){ var b=idoc.createElement('button'); b.className='ux-btn'; b.innerText=o; b.onclick=function(){ handleSelect(o); }; container.appendChild(b); });
      var sep=idoc.createElement('hr'); sep.className='section-divider'; container.appendChild(sep);
      var lbl=idoc.createElement('div'); lbl.className='section-label'; lbl.innerText='Anders'; container.appendChild(lbl);
      // Afhandeling buiten DS als toggle
      var afwToggle=idoc.createElement('button'); afwToggle.className='ux-btn advies-btn'; afwToggle.innerText='Afhandeling buiten DS \u25be';
      var afwExpand=idoc.createElement('div'); afwExpand.style.cssText='display:none;margin-top:5px;';
      ['Product niet aanwezig','Klant moet KS bellen','Held moet dit bij afmelden regelen met TL','Verkeerd gelabeld product','Overig'].forEach(function(opt){
        var b=idoc.createElement('button'); b.className='ux-btn'; b.style.marginBottom='4px'; b.innerText=opt;
        b.onclick=function(){
          ['probleem','product','formaatTV','milieuretour_type','uitkomst','geplandeRoute','next_day_reden','geen_oplossing_reden','advies_gelukt','product_keuze'].forEach(function(k){
            callData[k]='';
            var ix=answeredKeys.indexOf(k); if(ix>-1) answeredKeys.splice(ix,1);
            var ax=autoFilledKeys.indexOf(k); if(ax>-1) autoFilledKeys.splice(ax,1);
          });
          callData.locatie='Afhandeling buiten DS'; callData.afwijkend_reden=opt;
          if(!answeredKeys.includes('locatie')) answeredKeys.push('locatie');
          if(!answeredKeys.includes('afwijkend_reden')) answeredKeys.push('afwijkend_reden');
          renderApp();
        };
        afwExpand.appendChild(b);
      });
      afwToggle.onclick=function(){ var h=afwExpand.style.display==='none'; afwExpand.style.display=h?'block':'none'; afwToggle.innerText=h?'Afhandeling buiten DS \u25b4':'Afhandeling buiten DS \u25be'; };
      container.appendChild(afwToggle); container.appendChild(afwExpand);

    // ONDERWEG SELECT
    } else if (stap.type==='onderweg-select') {
      stap.opties.forEach(function(o){
        var b = maakInfoKnop(o, container);
        b.onclick=function(){ handleSelect(o); };
      });

    // GEEN OPLOSSING — tekstveld met rode waarschuwing
    } else if (stap.type==='text-warning') {
      var wqBtn=idoc.createElement('button'); wqBtn.className='ux-btn'; wqBtn.innerText='Product kan niet bij de klant blijven';
      wqBtn.onclick=function(){ callData[stap.key]='Product kan niet bij de klant blijven'; answeredKeys.push(stap.key); renderApp(); };
      container.appendChild(wqBtn);
      var wd=idoc.createElement('div'); wd.className='warning-box';
      wd.innerText='⚠️ Reminder: het is de bedoeling dat DS altijd een oplossing plant. Noteer hieronder waarom dat nu niet is gebeurd.';
      container.appendChild(wd);
      var wi=idoc.createElement('input'); wi.type='text'; wi.placeholder='Typ hier de reden...';
      var wb=idoc.createElement('button'); wb.className='action-btn'; wb.innerText='Volgende';
      container.appendChild(wi); container.appendChild(wb); wi.focus();
      var nW=function(){ if (!wi.value.trim()) return; callData[stap.key]=wi.value.trim(); answeredKeys.push(stap.key); renderApp(); };
      wb.onclick=nW; wi.onkeydown=function(e){ if (e.key==='Enter') nW(); };

    // TEKST INPUT
    } else if (stap.type==='text'||stap.type==='route-input') {
      if (stap.type==='route-input') {
        var infoDiv=idoc.createElement('div');
        infoDiv.style.cssText='background:#FFF8E1;border:1px solid #FFD54F;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#5D4037;line-height:1.6;';
        infoDiv.innerHTML='<strong>Vermeld altijd:</strong><br>netwerk &nbsp;&middot;&nbsp; depot &nbsp;&middot;&nbsp; routenummer<br><span style="color:#888;font-size:11px;">Bijv. <em>2M Rotterdam 3</em></span>';
        container.appendChild(infoDiv);
      }
      var iH='<input type="text" id="i" placeholder="Typ hier..."><button id="n" class="action-btn">Volgende</button>';
      if (stap.type==='route-input') iH+='<button id="nd" class="action-btn" style="background:#F2F7FC;color:#0090e3;border:1px solid #0090e3;margin-top:6px;">Next Day</button>';
      container.innerHTML+=iH;
      var f=idoc.getElementById('i'); f.focus();
      var nT=function(){
        if (!f.value.trim()) return;
        var v=f.value.trim(); if (stap.type==='route-input') v=parseToTourAlias(v);
        callData[stap.key]=v; answeredKeys.push(stap.key);
        if (stap.key==='lname') { callData.user=localStorage.getItem('ds_fname')+' '+callData.lname; localStorage.setItem('ds_lname',callData.lname); }
        if (stap.key==='fname') localStorage.setItem('ds_fname',callData.fname);
        renderApp();
      };
      idoc.getElementById('n').onclick=nT;
      if (idoc.getElementById('nd')) idoc.getElementById('nd').onclick=function(){ callData.geplandeRoute='Next Day'; answeredKeys.push(stap.key); renderApp(); };
      f.onkeydown=function(e){ if (e.key==='Enter') nT(); };

    // INFO SELECT — standaard select maar met info knoppen
    } else if (stap.type==='info-select') {
      stap.opties.forEach(function(o){
        var b = maakInfoKnop(o, container);
        b.onclick=function(){ handleSelect(o); };
      });

    // DIENST TYPE SELECT — Nazorg vs Extra dienst
    } else if (stap.type==='dienst-select') {
      var dienstInfo = idoc.createElement('div');
      dienstInfo.style.cssText = 'font-size:12px;background:#F2F7FC;border:1px solid #cce9f9;border-left:4px solid #0090e3;border-radius:6px;padding:10px 12px;margin-bottom:10px;color:#285dab;line-height:1.5;';
      dienstInfo.innerHTML = 'ℹ️ <b>Nazorg</b> is gratis en hoort bij de originele bestelling.<br><b>Extra dienst</b> brengt extra kosten met zich mee voor de klant.';
      container.appendChild(dienstInfo);
      ['Nazorg (gratis)','Extra dienst (betaald)'].forEach(function(o) {
        var b = idoc.createElement('button'); b.className = 'ux-btn'; b.innerText = o;
        b.onclick = function() { handleSelect(o); };
        container.appendChild(b);
      });

    // STANDAARD SELECT
    } else {
      stap.opties.forEach(function(o){ var b=idoc.createElement('button'); b.className='ux-btn'; b.innerText=o; b.onclick=function(){ handleSelect(o); }; container.appendChild(b); });
    }

    renderAndersSection(stap, handleSelect);
  }

  // ── VERSTUUR HELPERS ─────────────────────────────────────────
  function berekenCategorie() {
    var u    = callData.uitkomst              || '';
    var l    = callData.locatie               || '';
    var ksU  = callData.ks_uitkomst           || '';
    var ondU = callData.onderweg_uitkomst     || '';
    var advG = callData.advies_gelukt         || '';
    var cbfP = callData.cbf_pakket_uitkomst   || '';
    if (u==='Same day gepland'||u==='Same day visit gepland'||u==='Helden teruggebeld, rijden terug zonder visit'||ksU==='Teamleider stuurt helden terug')
      return 'Same day gepland';
    if (u==='Next day gepland'||u==='Next day visit gepland'||ksU==='Next day gepland')
      return 'Next day gepland';
    if (u==='Geen oplossing gepland'||u==='Klant ziet af van service (meerkosten)'||ksU==='Teamleider stuurt helden niet terug'||ksU==='DS vindt terugsturen niet de juiste oplossing'||ondU==='Nee, geen oplossing door DS'||advG==='Nee, geen oplossing door DS'||cbfP==='Nee, geen oplossing door DS'||cbfP==='Niet opgelost — instructie gegeven in Jerney'||callData.tl_uitkomst==='Niet mogelijk'||callData.tl_uitkomst==='Geen oplossing')
      return 'Geen oplossing';
    if (l==='Afhandeling buiten DS'||callData.bellerType==='Andere beller')
      return 'Buiten DS scope';
    if (l==='Onderweg')
      return 'Onderweg opgelost';
    return 'Advies gegeven';
  }

  function bouwLogParams() {
    callData.dsWaarde = berekenDsWaarde();
    var probLog, redenGeenOplossing, redenNextDay, routeLog, orderOplLog;
    var logDriver1 = callData.driver1, logDriver2 = callData.driver2, logOrderBron = callData.orderBron;
    var skipRouteFields = false;
    if (callData.bellerType === 'Teamleider') {
      probLog            = callData.tl_reden + (callData.tl_uitkomst ? ' — ' + callData.tl_uitkomst : '');
      redenGeenOplossing = ''; redenNextDay = ''; routeLog = ''; orderOplLog = '';
      logDriver1 = ''; logDriver2 = '';
    } else if (callData.bellerType === 'CBF') {
      if (callData.locatie === 'Vraag voor het depot') {
        probLog = 'Vraag voor het depot: ' + (callData.cbf_depot_reden||'') + (callData.cbf_depot_toelichting ? ' — ' + callData.cbf_depot_toelichting : '');
        logDriver1 = ''; logDriver2 = ''; logOrderBron = '';
      } else if (callData.locatie === 'Vraag over depot / hub') {
        probLog = 'Vraag over depot/hub: ' + (callData.cbb_hub_reden||'') + (callData.cbb_hub_toelichting ? ' — ' + callData.cbb_hub_toelichting : '');
        logDriver1 = ''; logDriver2 = ''; logOrderBron = '';
      } else if (callData.locatie === 'Bij de klant') {
        probLog = 'Vraag over pakket: ' + (callData.cbf_pakket_reden||'');
      } else {
        probLog = 'Onderweg: ' + callData.onderweg_type;
      }
      redenGeenOplossing = ''; redenNextDay = ''; routeLog = ''; orderOplLog = '';
    } else if (callData.locatie==='Afhandeling buiten DS') {
      probLog            = 'Afhandeling buiten DS: ' + callData.afwijkend_reden;
      redenGeenOplossing = ''; redenNextDay = ''; routeLog = ''; orderOplLog = '';
    } else if (['Technische Dienst','Yeply','G4S'].includes(callData.locatie)) {
      probLog            = callData.locatie + ': externe partner';
      redenGeenOplossing = ''; redenNextDay = ''; routeLog = ''; orderOplLog = '';
    } else if (callData.locatie==='Winkel') {
      var winkelOpl = callData.ks_reden==='Winkel vraagt om held terug te sturen' ? callData.ks_uitkomst : callData.uitkomst;
      probLog            = 'Winkel: ' + callData.ks_reden + (callData.probleem ? ' — ' + callData.probleem : '');
      redenGeenOplossing = callData.geen_oplossing_reden||'';
      redenNextDay       = callData.next_day_reden||'';
      routeLog           = (winkelOpl==='Next day gepland') ? 'Next Day' : callData.geplandeRoute;
      orderOplLog        = (winkelOpl==='Same day gepland'||winkelOpl==='Next day gepland') ? callData.orderBron+'-DS' : '';
      if (callData.ks_reden==='Informatie over vracht' || callData.ks_reden==='Witgoed Demo Wissel') {
        logDriver1 = ''; logDriver2 = ''; logOrderBron = '';
        probLog = ''; routeLog = ''; skipRouteFields = true;
      }
    } else if (callData.locatie==='Klantenservice') {
      var ksOpl = callData.ks_reden==='KS vraagt om held terug te sturen' ? callData.ks_uitkomst : callData.uitkomst;
      probLog            = 'KS: ' + callData.ks_reden + (callData.probleem ? ' — ' + callData.probleem : '');
      redenGeenOplossing = callData.geen_oplossing_reden||'';
      redenNextDay       = callData.next_day_reden||'';
      routeLog           = (ksOpl==='Next day gepland') ? 'Next Day' : callData.geplandeRoute;
      orderOplLog        = (ksOpl==='Same day gepland'||ksOpl==='Next day gepland') ? callData.orderBron+'-DS' : '';
    } else if (callData.locatie==='Vraag over depot / hub') {
      probLog            = 'Vraag over depot/hub: ' + (callData.cbb_hub_reden||'') + (callData.cbb_hub_toelichting ? ' — ' + callData.cbb_hub_toelichting : '');
      redenGeenOplossing = ''; redenNextDay = ''; routeLog = ''; orderOplLog = '';
      logDriver1 = ''; logDriver2 = '';
    } else if (callData.locatie==='Bij de klant') {
      probLog            = callData.milieuretour_type ? (callData.milieuretour_type==='Pick-up' ? 'Pick-up (handmatig gepland)' : 'Milieuretour ophalen') : callData.probleem;
      redenGeenOplossing = callData.geen_oplossing_reden||'';
      redenNextDay       = callData.next_day_reden||'';
      routeLog           = (callData.uitkomst==='Next day gepland'||callData.uitkomst==='Next day visit gepland') ? 'Next Day' : callData.geplandeRoute;
      orderOplLog        = (callData.uitkomst==='Same day gepland'||callData.uitkomst==='Next day gepland'||callData.uitkomst==='Same day visit gepland'||callData.uitkomst==='Next day visit gepland') ? callData.orderBron+'-DS' : '';
    } else {
      probLog            = callData.onderweg_type;
      redenGeenOplossing = '';
      redenNextDay       = '';
      routeLog           = '';
      orderOplLog        = '';
    }
    var prodLog = skipRouteFields ? '' : callData.product+(callData.formaatTV?' ('+callData.formaatTV+')':'');
    var bellerLog = callData.locatie==='Klantenservice' ? 'Klantenservice' : callData.locatie==='Winkel' ? 'Winkel' : ['Technische Dienst','Yeply','G4S'].includes(callData.locatie) ? callData.locatie : callData.bellerType||'';
    var extraInfo = callData.locatie==='Afhandeling buiten DS' && callData.afwijkend_reden==='Overig' ? callData.afwijkend_toelichting : '';
    var extraDienst = (callData.locatie==='Klantenservice'||callData.locatie==='Winkel') && callData.ks_reden==='Nazorg nodig' ? 'Ja' : '';
    var categorie = berekenCategorie();
    return '?id='+Date.now()+'&user='+encodeURIComponent(callData.user)+'&route='+encodeURIComponent(callData.route)+'&depot='+encodeURIComponent(callData.depot)+'&driver1='+encodeURIComponent(logDriver1)+'&driver2='+encodeURIComponent(logDriver2)+'&orderBron='+encodeURIComponent(logOrderBron)+'&product='+encodeURIComponent(prodLog)+'&probleem='+encodeURIComponent(probLog)+'&redenGeenOplossing='+encodeURIComponent(redenGeenOplossing)+'&redenNextDay='+encodeURIComponent(redenNextDay)+'&orderOplossing='+encodeURIComponent(orderOplLog)+'&geplandeRoute='+encodeURIComponent(routeLog)+'&dsWaarde='+encodeURIComponent(callData.dsWaarde)+'&bellerType='+encodeURIComponent(bellerLog)+'&tijdvak='+encodeURIComponent(callData.tijdvak)+'&aankomsttijd='+encodeURIComponent(callData.aankomsttijd)+'&extra_info='+encodeURIComponent(extraInfo)+'&extra_dienst='+encodeURIComponent(extraDienst)+'&categorie='+encodeURIComponent(categorie);
  }

  // ── KLEMBORD ALLEEN ─────────────────────────────────────────
  function kopieerNaarKlembord() {
    var rawPC, cleanPC='', name, ph, email, address, city;
    if (isBasicPage) {
      // Basic: alle velden staan als losse .details-field entries
      rawPC   = basicField('Postcode');
      cleanPC = rawPC.replace(/\s+/g,'').toUpperCase();
      city    = basicField('Woonplaats').replace(/^\s*\d{4,5}\s*[A-Z]{0,2}\s+/i, '').trim();
      name    = basicField('Naam');
      ph      = (basicFieldInSection('Geadresseerde', 'Telefoonnummer') || basicFieldInSection('Geadresseerde', 'Mobiel nummer') || '').replace(/[^\d+]/g,'');
      email   = basicFieldInSection('Geadresseerde', 'E-mailadres');
      address = basicField('Adres');
    } else {
      var gs=function(s){ var el=document.querySelector("[data-bind*='"+s+"']"); return el?el.innerText.trim():''; };
      rawPC=gs('Static.Visit.PostalCode');
      var dm=rawPC.match(/^(\d{4}\s?[A-Z]{2})(\s|$)/i), bm=rawPC.match(/^(\d{4,5})(\s|$)/);
      if (dm) cleanPC=dm[1].trim(); else if (bm) cleanPC=bm[1].trim(); else cleanPC=(rawPC.match(/^\d{4}/)||[''])[0];
      city = (gs('Static.Visit.City')||gs('City')||'').replace(/^\s*\d{4,5}\s*[A-Z]{0,2}\s+/i, '').trim();
      name = gs('Static.Visit.ContactName')||gs('ConsigneeName')||'';
      ph = (gs('Static.Visit.Phone')||gs('Static.Visit.PhoneNumber')||gs('PhoneNumber')||'').replace(/[^\d+]/g,'');
      email = gs('Static.Visit.Email')||gs('Email')||'';
      address = gs('Static.Visit.Address')||gs('ConsigneeAddress')||'';
    }
    var pp={'+31':'0','+32':'0','+49':'0','0031':'0','0032':'0','0049':'0'};
    for (var pfx in pp) { if (ph.startsWith(pfx)) { ph=pp[pfx]+ph.substring(pfx.length); break; } }
    ph = ph.replace(/^\+(\d{1,3})/, '0').replace(/^00(\d{1,3})/, '0');
    var country='Nederland', lang='nl', pNS=cleanPC.replace(/\s/g,'').toUpperCase();
    if (/[A-Z]/.test(pNS)&&pNS.replace(/\D/g,'').length===4) { country='Nederland'; lang='nl'; }
    else if (!/[A-Z]/.test(pNS)&&pNS.length===5) { country='Duitsland'; lang='de'; }
    else if (!/[A-Z]/.test(pNS)&&pNS.length===4) { country='België'; lang='nl'; }
    var prob=(callData.probleem||'').toLowerCase();
    var isNazorg = callData.dienstType !== 'Extra dienst (betaald)';
    var serviceTypeId=null;
    if (prob.includes('plaatsen')||prob.includes('tillen')) serviceTypeId=51072;
    else if (prob.includes('aansluiting')) serviceTypeId=51060;
    else if (prob.includes('slang')) serviceTypeId=51064;
    else if (prob.includes('trekschakelaar')) serviceTypeId=277249;
    else if (prob.includes('milieuretour') && callData.milieuretour_type==='Pick-up') serviceTypeId=427807;
    else if (prob.includes('milieuretour')) serviceTypeId=20;
    else if (prob.includes('deur omdraaien')) serviceTypeId=51068;
    else if (prob.includes('inbouwen')) serviceTypeId=322997;
    else if (prob.includes('stapelkit')) serviceTypeId=isNazorg?727124:727123;
    else if (prob.includes('spullen achtergelaten')) serviceTypeId=51076;
    else if (prob.includes('frontpaneel')) serviceTypeId=277248;
    else if (prob.includes('tv ophangen')||prob.includes('ophangen')) serviceTypeId=254508;
    else if (prob.includes('tv installeren')||prob.includes('aansluiten')) serviceTypeId=254509;
    else if (prob.includes('tv + soundbar ophang')) serviceTypeId=490317;
    else if (prob.includes('tv + soundbar')) serviceTypeId=490316;
    var pickupProbleem = callData.milieuretour_type ? (callData.milieuretour_type==='Pick-up' ? 'Pick-up (handmatig gepland)' : 'Milieuretour ophalen') : callData.probleem;
    var payload={orderNr:callData.orderBron+'-DS',name:name,phone:ph,email:email,zip:cleanPC,city:city,address:address,detectedCountry:country,detectedLanguage:lang,product:effectiefProduct(),probleem:pickupProbleem,dienstType:callData.dienstType,formaatTV:callData.formaatTV,tvNetwerk:callData.tvNetwerk,uitkomst:callData.uitkomst||callData.ks_uitkomst||'',geplandeRoute:callData.geplandeRoute||'',serviceTypeId:serviceTypeId,time:Date.now()};
    if ((prob.includes('plaatsen')||prob.includes('tillen'))&&callData.product_keuze) {
      payload.products=callData.product_keuze.split(', ');
    }
    navigator.clipboard.writeText(JSON.stringify(payload));
  }

  // ── VERSTUUR: GEPLAND (loggen + klembord) ────────────────────
  function verstuurEnKopieer() {
    kopieerNaarKlembord();
    verwijderGeparkeerd();
    wrapper.remove();
    fetch('https://script.google.com/a/macros/coolblue.nl/s/AKfycbxb-OwLCFGlDQ48qz3KnGnmsgnVLWxuOjvEr7UG3M3z0WzO0kVsTKGd_8mZjtvHvPHnEg/exec'+bouwLogParams()).catch(function(){});
  }

  // ── VERSTUUR: ALLEEN LOGGEN ───────────────────────────────────
  function verstuurAlleen() {
    verwijderGeparkeerd();
    wrapper.remove();
    fetch('https://script.google.com/a/macros/coolblue.nl/s/AKfycbxb-OwLCFGlDQ48qz3KnGnmsgnVLWxuOjvEr7UG3M3z0WzO0kVsTKGd_8mZjtvHvPHnEg/exec'+bouwLogParams()).catch(function(){});
  }

  renderApp();
  } // einde doScrapeAndInit

  // Herbereken hoogte als venster van grootte verandert (bijv. monitor koppelen/ontkoppelen)
  window.addEventListener('resize', function() {
    var clamped = clampHeight(dsHeight);
    if (clamped !== dsHeight) {
      dsHeight = clamped;
      iframe.style.height = dsHeight + 'px';
    }
  });

  // Poll tot ordernummer beschikbaar is in DOM, max 3 seconden
  var pollCount = 0;
  var pollInterval = setInterval(function() {
    var orderReady = false;
    if (!isBasicPage) {
      var el = document.querySelector("[data-bind*='OrderNumberTransport']");
      orderReady = !!(el && el.innerText.trim().match(/\d{8}/));
    } else {
      var fields = document.querySelectorAll('.details-field');
      for (var i = 0; i < fields.length; i++) {
        var lbl = fields[i].querySelector('.details-field-label p');
        if (lbl && (lbl.textContent.trim() === 'Pakbonnummer' || lbl.textContent.trim() === 'Order nr. verlader')) {
          orderReady = true; break;
        }
      }
    }
    pollCount++;
    if (orderReady || pollCount >= 30) {
      clearInterval(pollInterval);
      doScrapeAndInit();
    }
  }, 100);
})();