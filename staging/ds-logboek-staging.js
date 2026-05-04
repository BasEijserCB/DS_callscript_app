// ds-logboek-staging.js  v0.3.1-staging
// Staging build — new side-panel design with real data layer.
// Scraping, flow engine, and logging ported from ds-logboek.js.
// UI: React+Babel from CDN, mounted in #ds-logboek-staging-root.
// JSX runs via new Function("React","ReactDOM","DS", compiled) so only
// React, ReactDOM, DS, and browser globals are accessible inside JSX.

(function () {
  const STAGING_VERSION = "0.3.4-staging";
  const ROOT_ID = "ds-logboek-staging-root";
  const STYLE_ID = "ds-logboek-staging-style";
  const GAS_URL = "https://script.google.com/a/macros/coolblue.nl/s/AKfycbxb-OwLCFGlDQ48qz3KnGnmsgnVLWxuOjvEr7UG3M3z0WzO0kVsTKGd_8mZjtvHvPHnEg/exec";

  if (document.getElementById(ROOT_ID)) {
    document.getElementById(ROOT_ID).style.display = "block";
    return;
  }

  // ── PAGE DETECTION ────────────────────────────────────────────
  var isBasicPage = window.location.pathname.toLowerCase().indexOf('/basic') !== -1;

  // ── DOM HELPERS ───────────────────────────────────────────────
  function basicField(labelText) {
    var fields = document.querySelectorAll('.details-field');
    for (var i = 0; i < fields.length; i++) {
      var lEl = fields[i].querySelector('.details-field-label p');
      var vEl = fields[i].querySelector('.details-field-value p');
      if (lEl && vEl && lEl.textContent.trim() === labelText) return vEl.textContent.trim();
    }
    return '';
  }
  function basicFieldInSection(sectionName, labelText) {
    var rows = document.querySelectorAll('.details-row');
    for (var r = 0; r < rows.length; r++) {
      var hdr = rows[r].querySelector('.details-content-header p');
      if (hdr && hdr.textContent.trim().indexOf(sectionName) !== -1) {
        var fields = rows[r].querySelectorAll('.details-field');
        for (var i = 0; i < fields.length; i++) {
          var lEl = fields[i].querySelector('.details-field-label p');
          var vEl = fields[i].querySelector('.details-field-value p');
          if (lEl && vEl && lEl.textContent.trim() === labelText) return vEl.textContent.trim();
        }
      }
    }
    return '';
  }

  // ── SCRAPING ─────────────────────────────────────────────────
  function doScrape() {
    var orderNr='', route='', adres='', pc='', driver1='', driver2='';
    var alleGescrapteProducten=[], artikelsoortenMap={}, tijdvak='', aankomsttijd='', email='';
    if (!isBasicPage) {
      var gt = function(sel){ var el=document.querySelector("[data-bind*='"+sel+"']"); return el?el.innerText.trim():''; };
      orderNr = (gt('OrderNumberTransport').match(/\d{8}/)||[''])[0];
      route   = gt('Static.TourName');
      adres   = gt('Static.Visit.Address')||gt('ConsigneeAddress')||'';
      pc      = (gt('Static.Visit.PostalCode').match(/^\d{4}\s?[A-Z]{2}|^\d{4,5}/i)||[''])[0].trim();
      var dEls = document.querySelectorAll("[data-bind*='DriversFirstName']");
      driver1 = dEls.length>0 ? dEls[0].innerText.trim() : '';
      driver2 = dEls.length>1 ? dEls[1].innerText.trim() : '';
      var tvS=gt('Static.Visit.EarliestArrivalTimeStamp'), tvE=gt('Static.Visit.LatestArrivalTimeStamp');
      tijdvak = (tvS&&tvE) ? tvS+' - '+tvE : (tvS||tvE);
      aankomsttijd = gt('ActualArrivalDateTime');
      email = gt('Static.Visit.Email')||gt('Email')||'';
      alleGescrapteProducten = Array.from(document.querySelectorAll("[data-bind*='ArticleDescription']"))
        .map(function(el){ return el.innerText.trim(); })
        .filter(function(n){ var l=n.toLowerCase(); return n&&!l.includes('coolblue-doos')&&!l.includes('coolblue box')&&!l.includes('rest van je bestelling')&&!l.includes('rest of your order')&&!l.includes('verzameldoos'); })
        .filter(function(n,i,a){ return a.indexOf(n)===i; });
    } else {
      var raw = basicField('Pakbonnummer')||basicField('Order nr. verlader')||basicField('Afnemer nummer')||'';
      orderNr = (raw.match(/\d{8}/)||[''])[0];
      route   = basicField('Alias')||basicField('Ritnaam')||'';
      adres   = basicField('Adres')||'';
      pc      = basicField('Postcode')||'';
      tijdvak = basicField('Tijdsvenster').replace(/\s+/g,' ').trim();
      aankomsttijd = basicField('Geplande aankomsttijd');
      email = basicFieldInSection('Geadresseerde','E-mailadres')||'';
      var dataRows = document.querySelectorAll('table[id^="Articles_"] tr[class*="dxgvDataRow"]');
      dataRows.forEach(function(row){
        var cells=row.children; if(cells.length<5) return;
        var omschr=(cells[2].textContent||'').trim(), soort=(cells[4].textContent||'').trim().toLowerCase();
        if(!omschr) return;
        var l=omschr.toLowerCase();
        if(l.includes('coolblue-doos')||l.includes('coolblue box')||l.includes('rest van je bestelling')||l.includes('rest of your order')||l.includes('verzameldoos')) return;
        if(soort==='barcodes') return;
        if(/^[A-Z0-9]{6,}$/.test(omschr)) return;
        if(alleGescrapteProducten.indexOf(omschr)===-1){ alleGescrapteProducten.push(omschr); artikelsoortenMap[omschr]=soort; }
      });
    }
    var adresQuery = encodeURIComponent((adres+' '+pc).trim());
    var model = alleGescrapteProducten.length>0 ? alleGescrapteProducten[0] : '';
    return { orderNr, route, adres, pc, adresQuery, driver1, driver2, alleGescrapteProducten, artikelsoortenMap, tijdvak, aankomsttijd, email, model };
  }

  // ── MODEL HERKENNING ─────────────────────────────────────────
  var prefixTabel = {
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
      var tok=tokens[ti], tokS=tok.replace(/^\d+/,'');
      var cands = tokS&&tokS!==tok ? [tok,tokS] : [tok];
      for (var ci=0; ci<cands.length; ci++) {
        for (var i=0; i<rules.length; i++) {
          if (cands[ci].indexOf(rules[i][0])===0 && rules[i][0].length>lM.length) { lM=rules[i][0]; lT=rules[i][1]; }
        }
      }
    }
    return { merk:merk, typeGuess:lT||null };
  }

  function artikelsoortNaarProduct(soort) {
    var map = {'wasmachine':'Wasmachine','wasdroogcombinatie':'Wasdroogcombinatie','droger':'Droger','koelkast':'Koelkast / Vriezer','inbouw koelkast':'Koelkast / Vriezer','vriezer':'Koelkast / Vriezer','inbouw vriezer':'Koelkast / Vriezer','koel-vries combo':'Koelkast / Vriezer','vaatwasser':'Vaatwasser','inbouw vaatwasser':'Vaatwasser','televisie':'Televisie','soundbar':'Soundbar','oven':'Oven / Magnetron','magnetron':'Oven / Magnetron','inbouw oven':'Oven / Magnetron','inbouw magnetron':'Oven / Magnetron','combi-oven':'Combi-oven','kookplaat':'Kookplaat','inductiekookplaat':'Kookplaat','gaskookplaat':'Kookplaat','fornuis':'Fornuis','afzuigkap':'Afzuigkap','wasemkap':'Afzuigkap'};
    return map[(soort||'').trim()]||null;
  }

  // ── PRODUCT TYPE HELPERS ──────────────────────────────────────
  var witgoedTypes = ['wasmachine','wasdroogcombinatie','droger','koelkast','vriezer','koel-vries','vaatwasser','inbouw vaatwasser','inbouw koelkast','inbouw vriezer','oven','magnetron','fornuis','kookplaat'];
  function isTV(naam) {
    var n=(naam||'').toLowerCase();
    if (n.includes('tv')||n.includes('televisie')||n.includes('oled')||n.includes('qled')||n.includes('inch')) return true;
    var det=detecteerType(naam); return !!(det&&det.typeGuess==='televisie');
  }
  function isSoundbar(naam) {
    var n=(naam||'').toLowerCase();
    if (n.includes('soundbar')||n.includes('sound bar')) return true;
    var det=detecteerType(naam); return !!(det&&det.typeGuess==='soundbar');
  }
  function isWitgoed(naam) {
    var det=detecteerType(naam);
    if (!det||!det.typeGuess) return false;
    return witgoedTypes.some(function(t){ return det.typeGuess.toLowerCase().includes(t); });
  }
  function maakProductLabel(naam) {
    var det=detecteerType(naam);
    var type=det&&det.typeGuess ? det.typeGuess.charAt(0).toUpperCase()+det.typeGuess.slice(1) : null;
    var n=naam.toLowerCase();
    if (!type&&(n.includes('tv')||n.includes('televisie')||n.match(/(oled|qled)/))) type='Televisie';
    return type ? type+' ('+naam+')' : naam;
  }
  var alleProbleemOpties = ['Trekschakelaar aansluiten','Milieuretour / Pick-up ophalen','Plaatsen / Naar boven tillen','Apparaat inbouwen (Keuken)','Aansluiting controleren','Schade / Defect','TV installeren','TV ophangen en installeren','TV + Soundbar installeren','TV + Soundbar ophangen en installeren','Stapelkit plaatsen','Deur omdraaien','Service niet uitvoerbaar','Verkeerd gelabeld product','Blijverkoop vergeten'];
  function getOptiesVoorType(type) {
    var p=type.toLowerCase();
    if (p==='televisie'||p.includes('tv')) return ['TV installeren','TV ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
    if (p==='soundbar'||p.includes('soundbar')) return ['TV + Soundbar installeren','TV + Soundbar ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
    if (p.includes('oven')||p.includes('magnetron')||p.includes('kookplaat')||p.includes('afzuigkap')) return ['Apparaat inbouwen (Keuken)','Milieuretour / Pick-up ophalen','Aansluiting controleren','Schade / Defect'];
    if (p==='fornuis'||p.includes('fornuis')) return [];
    if (p.includes('inbouw')) return ['Apparaat inbouwen (Keuken)','Milieuretour / Pick-up ophalen','Aansluiting controleren','Deur omdraaien'];
    if (p.includes('wasmachine')||p.includes('wasdroog')) return ['Trekschakelaar aansluiten','Plaatsen / Naar boven tillen','Stapelkit plaatsen','Milieuretour / Pick-up ophalen','Aansluiting controleren'];
    if (p.includes('droger')) return ['Trekschakelaar aansluiten','Plaatsen / Naar boven tillen','Stapelkit plaatsen','Deur omdraaien','Milieuretour / Pick-up ophalen','Aansluiting controleren'];
    if (p.includes('koelkast')||p.includes('vriezer')||p.includes('koel-vries')) return ['Plaatsen / Naar boven tillen','Deur omdraaien','Milieuretour / Pick-up ophalen','Aansluiting controleren','Schade / Defect'];
    if (p.includes('vaatwasser')) return ['Plaatsen / Naar boven tillen','Apparaat inbouwen (Keuken)','Milieuretour / Pick-up ophalen','Aansluiting controleren'];
    return alleProbleemOpties;
  }

  // ── ROUTE PARSER ─────────────────────────────────────────────
  var alleDepots=[{code:'NLAL',name:'Almere'},{code:'NLDE',name:'Deventer'},{code:'NLGR',name:'Groningen'},{code:'NLRO',name:'Rotterdam'},{code:'NLTI',name:'Tilburg'},{code:'NLUT',name:'Utrecht'},{code:'NLVE',name:'Venlo'},{code:'NLEI',name:'Eindhoven'},{code:'NLDH',name:'Den Haag'},{code:'NLOV',name:'Overamstel'},{code:'DEDU',name:'Dusseldorf'},{code:'DEKE',name:'Kelsterbach'},{code:'DEHA',name:'Hamm'},{code:'DELA',name:'Langenhagen'},{code:'DEHM',name:'Hamburg'},{code:'DESC',name:'Schonefeld'},{code:'DETA',name:'Tamm'},{code:'DENU',name:'Nürnberg'},{code:'DEES',name:'Essen'},{code:'BEAN',name:'Antwerpen'},{code:'BEGE',name:'Gent'},{code:'BENI',name:'Nijvel'},{code:'BEZA',name:'Zaventem'},{code:'BEWI',name:'Wilrijk'}];
  var bkDepots={'NLOV':'Fietshub Overamstel','NLUT':'Fietshub Utrecht','NLRO':'Fietshub Rotterdam','NLDE':'Fietshub Den Haag','NLEI':'Fietshub Eindhoven','BEZA':'Fietshub Zaventem','BEWI':'Fietshub Wilrijk'};
  function parseToTourAlias(input) {
    if (!input) return '';
    var str=input.toLowerCase(), netwerk='', depotInfo=null, nummer='';
    var nw=[{code:'1X',keys:['1x','installatie','install','1mans','1 mans']},{code:'1M',keys:['1m']},{code:'2M',keys:['2m']},{code:'BI',keys:['built in','built-in','bi','inbouw']},{code:'BK',keys:['bk','fiets','bike']}];
    for (var ni=0;ni<nw.length;ni++) { for (var nj=0;nj<nw[ni].keys.length;nj++) { if (str.includes(nw[ni].keys[nj])) { netwerk=nw[ni].code; str=str.replace(nw[ni].keys[nj],''); break; } } if (netwerk) break; }
    var dl=[{code:'NLOV',keys:['overamstel','amsterdam','ams','ova','adam']},{code:'NLAL',keys:['almere','alm']},{code:'NLDE',keys:['deventer','dev']},{code:'NLRO',keys:['rotterdam','rdam','rtm','rot']},{code:'NLTI',keys:['tilburg','tbg','til']},{code:'NLGR',keys:['groningen','gro','grn']},{code:'NLUT',keys:['utrecht','utr']},{code:'NLVE',keys:['venlo','ven']},{code:'NLEI',keys:['eindhoven','ehv','ein']},{code:'NLDH',keys:['den haag','dhg','haag','dh']},{code:'BEWI',keys:['wilrijk','bewi','wil']},{code:'BEAN',keys:['antwerpen','bean','ant','antp']},{code:'BEGE',keys:['gent','beg']},{code:'BENI',keys:['nijvel','nivelles','ben']},{code:'BEZA',keys:['zaventem','zav']},{code:'DEDU',keys:['dusseldorf','düsseldorf','dus']},{code:'DEKE',keys:['kelsterbach','kel']},{code:'DEHA',keys:['hamm']},{code:'DELA',keys:['langenhagen','lan']},{code:'DEHM',keys:['hamburg','ham']},{code:'DESC',keys:['schonefeld','sch']},{code:'DETA',keys:['tamm']},{code:'DENU',keys:['nürnberg','nurnberg','nur']},{code:'DEES',keys:['essen','ess']}];
    for (var di=0;di<dl.length;di++) { for (var dj=0;dj<dl[di].keys.length;dj++) { if (str.includes(dl[di].keys[dj])) { depotInfo=dl[di]; str=str.replace(dl[di].keys[dj],''); break; } } if (depotInfo) break; }
    if (netwerk==='BK'&&depotInfo&&depotInfo.code==='BEAN') depotInfo={code:'BEWI',name:'Wilrijk'};
    if (netwerk!=='BK'&&depotInfo&&depotInfo.code==='NLOV'&&input.toLowerCase().includes('amsterdam')) depotInfo={code:'NLAL',name:'Almere'};
    var m=str.match(/\d+/); if (m) nummer=m[0].padStart(2,'0');
    if (netwerk&&depotInfo&&nummer) return netwerk+'-'+depotInfo.code+'-'+nummer;
    return input.toUpperCase();
  }

  // ── PRODUCT HELPERS ──────────────────────────────────────────
  var nextDayRedenen = ['Geen geschikte routes beschikbaar (tijd)','Geen geschikte routes beschikbaar (afstand)','Klant vandaag geen tijd meer','Situatie bij de klant niet gereed voor service','Geen helden op het depot aanwezig','Geen BI ritten op de weg'];
  function effectiefProduct(cd) { return cd.productVerfijnd||cd.product||''; }
  function skipDienstType(cd) {
    var prob=(cd.probleem||'').toLowerCase();
    if (!prob.includes('deur omdraaien')) return false;
    var prod=effectiefProduct(cd).toLowerCase();
    return prod==='koelkast'||prod==='vriezer'||prod==='amerikaanse koelkast'||prod==='amerikaanse koelkast met waterdispenser'||prod==='side-by-side koelkast'||prod==='inbouw koelkast'||prod==='koelkast / vriezer';
  }
  function getProductVerfijningOpties(product) {
    var p=(product||'').toLowerCase();
    if (p==='koelkast / vriezer') return ['Koelkast','Vriezer','Amerikaanse koelkast','Amerikaanse koelkast met waterdispenser','Side-by-side koelkast','Inbouw koelkast'];
    if (p==='vaatwasser') return ['Vrijstaande vaatwasser','Inbouw vaatwasser'];
    if (p==='oven / magnetron'||p==='oven') return ['Inbouw oven','Inbouw magnetron','Magnetron'];
    return null;
  }
  function productNeedsVerfijning(cd, ak) {
    if (ak.includes('productVerfijnd')) return false;
    return getProductVerfijningOpties(cd.product)!==null;
  }

  // ── FLOW ENGINE ──────────────────────────────────────────────
  function bepaalStappenPure(cd, ak, afk, alleProds) {
    var meerdereProducten = (alleProds||[]).length > 1;
    function pnv() { return productNeedsVerfijning(cd, ak); }
    function eprod() { return effectiefProduct(cd); }
    function skipDT() { return skipDienstType(cd); }
    function getProbleemOpties() {
      if (meerdereProducten && !ak.includes('product_keuze')) {
        var heeftTV=alleProds.some(isTV), heeftSB=alleProds.some(isSoundbar);
        var andereProds=alleProds.filter(function(n){ return !isTV(n); });
        var andereZijnAcc=andereProds.length>0&&andereProds.every(function(n){ return !isWitgoed(n); });
        if (heeftTV&&(heeftSB||andereZijnAcc)) return ['TV + Soundbar installeren','TV + Soundbar ophangen en installeren','TV installeren','TV ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
        var union=[];
        alleProds.forEach(function(naam){
          var det=detecteerType(naam); var type=det&&det.typeGuess?det.typeGuess:(isTV(naam)?'televisie':naam);
          getOptiesVoorType(type).forEach(function(o){ if(!union.includes(o)) union.push(o); });
        });
        return alleProbleemOpties.filter(function(o){ return union.includes(o); });
      }
      var p=(cd.product||cd.model||'').toLowerCase();
      if (p==='televisie'||p.includes('tv')) return ['TV installeren','TV ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
      if (p==='soundbar'||p.includes('soundbar')) return ['TV + Soundbar installeren','TV + Soundbar ophangen en installeren','Milieuretour / Pick-up ophalen','Schade / Defect'];
      return getOptiesVoorType(cd.product||cd.model||'');
    }
    var s=[];
    s.push({key:'fname',label:'Voornaam',type:'text'});
    s.push({key:'lname',label:'Achternaam',type:'text'});
    s.push({key:'bellerType',label:'Wie belt er?',type:'beller-select'});
    if (!ak.includes('bellerType')) return s;

    // ── TEAMLEIDER FLOW ──────────────────────────────────────────
    if (cd.bellerType==='Teamleider') {
      s.push({key:'tl_reden',label:'Waar gaat de vraag over?',type:'ux-select',opties:['Vraag om aanpassingen in rit','Andere vraag']});
      if (ak.includes('tl_reden')) {
        if (cd.tl_reden==='Vraag om aanpassingen in rit') s.push({key:'tl_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Aanpassing doorgegeven / bevestigd','Niet mogelijk']});
        else s.push({key:'tl_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Vraag beantwoord','Geen oplossing']});
      }
      return s;
    }

    // ── CBF FLOW ─────────────────────────────────────────────────
    if (cd.bellerType==='CBF') {
      s.push({key:'locatie',label:'Wat is de situatie?',type:'cbf-locatie-select',opties:['Onderweg','Bij de klant','Vraag voor het depot','Vraag over depot / hub']});
      if (!ak.includes('locatie')) return s;
      if (cd.locatie==='Onderweg') {
        s.push({key:'onderweg_type',label:'Wat is het probleem?',type:'onderweg-select',opties:['Adres niet gevonden / niet bereikbaar','Adres klopt niet','Klant niet bereikbaar / verkeerd nummer','Klant niet thuis','Vraag over service']});
        if (ak.includes('onderweg_type')) {
          if (cd.onderweg_type==='Advies gegeven') s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
          else if (cd.onderweg_type==='Adres niet gevonden / niet bereikbaar') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Adres gevonden samen met Held','Alternatieve route gevonden voor Held','Straat afgesloten of onvoldoende EV-rijkwijdte','Nee, geen oplossing door DS']});
          else if (cd.onderweg_type==='Klant niet bereikbaar / verkeerd nummer') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Telefoonnummer gevonden voor Held','Nee, geen oplossing door DS']});
          else if (cd.onderweg_type==='Klant niet thuis') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Advies gegeven, held meldt af in Jerney','Helden stellen stop uit en gaan later terug','Nee, geen oplossing door DS']});
          else if (cd.onderweg_type==='Vraag over service') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Vraag beantwoord, held kan verder','Nee, geen oplossing door DS']});
        }
      } else if (cd.locatie==='Bij de klant') {
        s.push({key:'cbf_pakket_reden',label:'Wat is de vraag?',type:'ux-select',opties:['Pakket niet meegenomen (manco)','Pakket verkeerd / beschadigd','Pakje niet ingeladen','Overige vraag over pakket']});
        if (ak.includes('cbf_pakket_reden')) {
          if (cd.cbf_pakket_reden==='Pakje niet ingeladen') s.push({key:'cbf_pakket_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Pakje wordt later afgeleverd (afleverbewijs)','Niet opgelost — instructie gegeven in Jerney']});
          else s.push({key:'cbf_pakket_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Klant geïnformeerd, manco geregistreerd','Klant geïnformeerd, held regelt verder','Nee, geen oplossing door DS']});
        }
      } else if (cd.locatie==='Vraag voor het depot') {
        s.push({key:'cbf_depot_reden',label:'Waar gaat de vraag over?',type:'ux-select',opties:['Ziekmelding','Fiets kapot / incident','Informeren waar de vracht is','Alarm / sleutelkastje hub','Anders']});
        if (ak.includes('cbf_depot_reden')&&cd.cbf_depot_reden==='Anders') s.push({key:'cbf_depot_toelichting',label:'Wat is de vraag?',type:'text'});
      } else if (cd.locatie==='Vraag over depot / hub') {
        s.push({key:'cbb_hub_reden',label:'Wat is de vraag over het depot / hub?',type:'ux-select',opties:['Alarm staat op','Sleutelkastje ophalen / code','Andere vraag over depot']});
        if (ak.includes('cbb_hub_reden')&&cd.cbb_hub_reden==='Andere vraag over depot') s.push({key:'cbb_hub_toelichting',label:'Wat is de vraag precies?',type:'text'});
      }
      return s;
    }

    // ── CBB / ANDERS FLOW ────────────────────────────────────────
    if (meerdereProducten && !ak.includes('product_keuze') && ak.includes('probleem') && cd.probleem!=='Advies gegeven') {
      s.push({key:'product_keuze',label:'Over welk product gaat het?',type:'product-multi',opties:(alleProds||[]).map(maakProductLabel)});
      if (!ak.includes('product_keuze')) return s;
    }
    s.push({key:'locatie',label:'Waar zijn de helden?',type:'locatie-select',opties:['Bij de klant','Onderweg','Vraag over depot / hub']});
    if (!ak.includes('locatie')) return s;

    if (cd.locatie==='Bij de klant') {
      if (!meerdereProducten&&!ak.includes('product')) {
        s.push({key:'product',label:'Om welk apparaat gaat het?',type:'product-type-keuze'});
        if (!ak.includes('product')) return s;
      }
      if (ak.includes('product')&&pnv()) {
        s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(cd.product)});
        if (!ak.includes('productVerfijnd')) return s;
      }
      s.push({key:'probleem',label:'Wat is de klacht of taak?',type:'probleem-grouped',opties:getProbleemOpties()});
      if (!ak.includes('probleem')) return s;
      if (cd.probleem==='Advies gegeven') {
        s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
      } else if (cd.probleem==='Verkeerd gelabeld product'||cd.probleem==='Onverwacht retour') {
        // direct loggen
      } else if (cd.probleem==='Spullen achtergelaten bij klant') {
        s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day gepland','Next day gepland','Helden teruggebeld, rijden terug zonder visit']});
        if (ak.includes('uitkomst')) {
          if (cd.uitkomst==='Same day gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
          else if (cd.uitkomst==='Next day gepland') {
            if (!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
            if (ak.includes('dienstType')||skipDT()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
          }
        }
      } else if (cd.probleem==='Milieuretour past niet in bus') {
        s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day visit gepland','Next day visit gepland','Held gevraagd TL te bellen voor bevestiging']});
        if (ak.includes('uitkomst')) {
          if (cd.uitkomst==='Same day visit gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
          else if (cd.uitkomst==='Next day visit gepland') {
            if (!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
            if (ak.includes('dienstType')||skipDT()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
          }
        }
      } else if (cd.probleem==='Blijverkoop vergeten') {
        s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day gepland','Advies gegeven aan Held','Geen oplossing gepland']});
        if (ak.includes('uitkomst')&&cd.uitkomst==='Same day gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
      } else {
        if (!ak.includes('product')) {
          var tvProb=cd.probleem.includes('TV')||cd.probleem.includes('Soundbar');
          if (cd.probleem==='Apparaat inbouwen (Keuken)') s.push({key:'product',label:'Wat wordt er ingebouwd?',type:'ux-select',opties:['Inbouw vaatwasser','Inbouw koelkast','Oven / Magnetron','Kookplaat','Overig']});
          else if (!tvProb) s.push({key:'product',label:(cd.probleem==='Milieuretour / Pick-up ophalen'?'Welk product wordt er opgehaald?':'Welk product betreft het?'),type:'ux-select',opties:['Wasmachine','Wasdroger','Koelkast / Vriezer','Vaatwasser','Televisie','Overig']});
        }
        if (ak.includes('product')&&pnv()) {
          s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(cd.product)});
          if (!ak.includes('productVerfijnd')) return s;
        }
        var isTVI=cd.probleem.includes('TV')||cd.probleem.includes('Soundbar');
        if (ak.includes('product')&&cd.product==='Televisie'&&!ak.includes('formaatTV')&&!isTVI) s.push({key:'formaatTV',label:'Is de TV 55 inch of groter?',type:'ux-select',opties:['Ja (>= 55 inch)','Nee (< 55 inch)']});
        if (cd.probleem==='Milieuretour / Pick-up ophalen'&&ak.includes('product')&&!ak.includes('milieuretour_type')) s.push({key:'milieuretour_type',label:'Specificeer het type ophaling:',type:'ux-select',opties:['Milieuretour','Pick-up']});
        var prodKlaar=ak.includes('product')&&(cd.product!=='Televisie'||ak.includes('formaatTV')||isTVI);
        var milKlaar=cd.probleem!=='Milieuretour / Pick-up ophalen'||ak.includes('milieuretour_type');
        if (prodKlaar&&milKlaar) {
          s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'uitkomst-select',opties:['Same day gepland','Next day gepland','Klant ziet af van service (meerkosten)','Geen oplossing gepland']});
          if (ak.includes('uitkomst')) {
            if (cd.uitkomst==='Same day gepland') {
              s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
              if (ak.includes('geplandeRoute')&&!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
            } else if (cd.uitkomst==='Next day gepland') {
              if (!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'});
              if ((ak.includes('dienstType')||skipDT())&&isTVI&&cd.formaatTV!=='Ja (>= 55 inch)') {
                if (!ak.includes('tvNetwerk')) {
                  var routeNet=parseToTourAlias(cd.geplandeRoute||'').split('-')[0];
                  if (routeNet==='1X') { cd.tvNetwerk='Built in (BI)'; if(!afk.includes('tvNetwerk')) afk.push('tvNetwerk'); }
                  else s.push({key:'tvNetwerk',label:'Welk netwerk voor de nieuwe afspraak?',type:'ux-select',opties:['Built in (BI)','1X']});
                }
              }
              if (ak.includes('dienstType')||skipDT()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen});
            } else if (cd.uitkomst==='Geen oplossing gepland') {
              s.push({key:'geen_oplossing_reden',label:'Waarom is er geen oplossing gepland?',type:'text-warning'});
            } else if (cd.uitkomst==='Advies gegeven') {
              s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
            }
          }
        }
      }
    } else if (cd.locatie==='Onderweg') {
      s.push({key:'onderweg_type',label:'Wat is het probleem?',type:'onderweg-select',opties:['Adres niet gevonden / niet bereikbaar','Adres klopt niet','Klant niet bereikbaar / verkeerd nummer','Klant niet thuis','Vraag over service']});
      if (ak.includes('onderweg_type')) {
        if (cd.onderweg_type==='Advies gegeven') s.push({key:'advies_gelukt',label:'Is de service na het advies uitgevoerd?',type:'info-select',opties:['Ja, service uitgevoerd','Nee, geen oplossing door DS']});
        else if (cd.onderweg_type==='Adres niet gevonden / niet bereikbaar') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Adres gevonden samen met Held','Alternatieve route gevonden voor Held','Straat afgesloten of onvoldoende EV-rijkwijdte','Nee, geen oplossing door DS']});
        else if (cd.onderweg_type==='Klant niet bereikbaar / verkeerd nummer') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Telefoonnummer gevonden voor Held','Nee, geen oplossing door DS']});
        else if (cd.onderweg_type==='Klant niet thuis') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Advies gegeven, held meldt af in Jerney','Helden stellen stop uit en gaan later terug','Nee, geen oplossing door DS']});
        else if (cd.onderweg_type==='Vraag over service') s.push({key:'onderweg_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Vraag beantwoord, held kan verder','Nee, geen oplossing door DS']});
      }
    } else if (cd.locatie==='Vraag over depot / hub') {
      s.push({key:'cbb_hub_reden',label:'Wat is de vraag over het depot / hub?',type:'ux-select',opties:['Alarm staat op','Sleutelkastje ophalen / code','Andere vraag over depot']});
      if (ak.includes('cbb_hub_reden')&&cd.cbb_hub_reden==='Andere vraag over depot') s.push({key:'cbb_hub_toelichting',label:'Wat is de vraag precies?',type:'text'});
    } else if (cd.locatie==='Klantenservice'||cd.locatie==='Winkel') {
      var isW=cd.locatie==='Winkel';
      s.push({key:'ks_reden',label:(isW?'Wat is de reden van het winkelbelletje?':'Wat is de reden van het KS-belletje?'),type:'ux-select',opties:isW?['Nazorg nodig','Winkel vraagt om held terug te sturen','Advies gegeven aan Winkel','Informatie over vracht','Witgoed Demo Wissel','Spullen achtergelaten bij klant']:['Nazorg nodig','KS vraagt om held terug te sturen','Advies gegeven aan KS','Spullen achtergelaten bij klant','Bezorgadres/telefoonnummer klant doorgeven aan held']});
      if (ak.includes('ks_reden')) {
        if (cd.ks_reden==='Nazorg nodig') {
          if (!meerdereProducten&&!ak.includes('product')) { s.push({key:'product',label:'Om welk apparaat gaat het?',type:'product-type-keuze'}); if (!ak.includes('product')) return s; }
          if (ak.includes('product')&&pnv()) { s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(cd.product)}); if (!ak.includes('productVerfijnd')) return s; }
          s.push({key:'probleem',label:'Wat moet er gebeuren bij de klant?',type:'probleem-grouped',opties:getProbleemOpties()});
          if (ak.includes('probleem')) {
            var isTVI2=cd.probleem.includes('TV')||cd.probleem.includes('Soundbar');
            var prodKlaar2=ak.includes('product')&&(cd.product!=='Televisie'||ak.includes('formaatTV')||isTVI2);
            var milKlaar2=cd.probleem!=='Milieuretour / Pick-up ophalen'||ak.includes('milieuretour_type');
            if (!ak.includes('product')&&!isTVI2) { if (cd.probleem==='Apparaat inbouwen (Keuken)') s.push({key:'product',label:'Wat wordt er ingebouwd?',type:'ux-select',opties:['Inbouw vaatwasser','Inbouw koelkast','Oven / Magnetron','Kookplaat','Overig']}); else s.push({key:'product',label:'Welk product betreft het?',type:'ux-select',opties:['Wasmachine','Wasdroger','Koelkast / Vriezer','Vaatwasser','Televisie','Overig']}); }
            if (ak.includes('product')&&pnv()) { s.push({key:'productVerfijnd',label:'Welk type product precies?',type:'ux-select',opties:getProductVerfijningOpties(cd.product)}); if (!ak.includes('productVerfijnd')) return s; }
            if (ak.includes('product')&&cd.product==='Televisie'&&!ak.includes('formaatTV')&&!isTVI2) s.push({key:'formaatTV',label:'Is de TV 55 inch of groter?',type:'ux-select',opties:['Ja (>= 55 inch)','Nee (< 55 inch)']});
            if (cd.probleem==='Milieuretour / Pick-up ophalen'&&ak.includes('product')&&!ak.includes('milieuretour_type')) s.push({key:'milieuretour_type',label:'Specificeer het type ophaling:',type:'ux-select',opties:['Milieuretour','Pick-up']});
            if (prodKlaar2&&milKlaar2) {
              s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'uitkomst-select',opties:['Same day gepland','Klant ziet af van service (meerkosten)','Geen same day mogelijk']});
              if (ak.includes('uitkomst')&&cd.uitkomst==='Same day gepland') { s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'}); if (ak.includes('geplandeRoute')&&!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'}); }
            }
          }
        } else if (cd.ks_reden==='KS vraagt om held terug te sturen'||cd.ks_reden==='Winkel vraagt om held terug te sturen') {
          s.push({key:'ks_uitkomst',label:'Wat was de uitkomst?',type:'uitkomst-select',opties:['Teamleider stuurt helden terug','Teamleider stuurt helden niet terug','Same day gepland','Next day gepland','DS vindt terugsturen niet de juiste oplossing']});
          if (ak.includes('ks_uitkomst')) {
            if (cd.ks_uitkomst==='Same day gepland') { s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'}); if (ak.includes('geplandeRoute')&&!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'}); }
            else if (cd.ks_uitkomst==='Next day gepland') { if (!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'}); if (ak.includes('dienstType')||skipDT()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen}); }
          }
        } else if (cd.ks_reden==='Witgoed Demo Wissel') {
          s.push({key:'ks_uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Geplande visit verwijderd (niet nodig)','Geen actie nodig']});
        } else if (cd.ks_reden==='Spullen achtergelaten bij klant') {
          s.push({key:'uitkomst',label:'Wat was de uitkomst?',type:'ux-select',opties:['Same day gepland','Next day gepland','Helden teruggebeld, rijden terug zonder visit']});
          if (ak.includes('uitkomst')) {
            if (cd.uitkomst==='Same day gepland') s.push({key:'geplandeRoute',label:'Op welke route gepland?',type:'route-input'});
            else if (cd.uitkomst==='Next day gepland') { if (!skipDT()) s.push({key:'dienstType',label:'Is dit Nazorg of een Extra dienst?',type:'dienst-select'}); if (ak.includes('dienstType')||skipDT()) s.push({key:'next_day_reden',label:'Waarom niet same day?',type:'ux-select',opties:nextDayRedenen}); }
          }
        }
      }
    } else if (cd.locatie==='Afhandeling buiten DS') {
      s.push({key:'afwijkend_reden',label:'Wat is de reden?',type:'ux-select',opties:['Product niet aanwezig','Klant moet KS bellen','Held moet dit bij afmelden van de route regelen met TL','Verkeerd gelabeld product','Overig']});
      if (ak.includes('afwijkend_reden')&&cd.afwijkend_reden==='Overig') s.push({key:'afwijkend_toelichting',label:'Toelichting:',type:'text'});
    }
    // Technische Dienst / Yeply / G4S: direct loggen
    return s;
  }

  // ── CATEGORIE ─────────────────────────────────────────────────
  function berekenCategorie(cd) {
    var u=cd.uitkomst||'', l=cd.locatie||'', ksU=cd.ks_uitkomst||'', ondU=cd.onderweg_uitkomst||'', advG=cd.advies_gelukt||'', cbfP=cd.cbf_pakket_uitkomst||'';
    if (u==='Same day gepland'||u==='Same day visit gepland'||u==='Helden teruggebeld, rijden terug zonder visit'||ksU==='Teamleider stuurt helden terug') return 'Same day gepland';
    if (u==='Next day gepland'||u==='Next day visit gepland'||ksU==='Next day gepland') return 'Next day gepland';
    if (u==='Geen oplossing gepland'||u==='Klant ziet af van service (meerkosten)'||ksU==='Teamleider stuurt helden niet terug'||ksU==='DS vindt terugsturen niet de juiste oplossing'||ondU==='Nee, geen oplossing door DS'||advG==='Nee, geen oplossing door DS'||cbfP==='Nee, geen oplossing door DS'||cbfP.includes('Niet opgelost')||cd.tl_uitkomst==='Niet mogelijk'||cd.tl_uitkomst==='Geen oplossing') return 'Geen oplossing';
    if (l==='Afhandeling buiten DS'||cd.bellerType==='Andere beller') return 'Buiten DS scope';
    if (l==='Onderweg') return 'Onderweg opgelost';
    return 'Advies gegeven';
  }

  // ── DS WAARDE ─────────────────────────────────────────────────
  function berekenDsWaarde(cd) {
    if (cd.bellerType==='Teamleider') return cd.tl_uitkomst||cd.tl_reden||'Teamleider belt';
    if (cd.bellerType==='CBF') {
      if (cd.locatie==='Vraag voor het depot') return 'Advies gegeven (CBF doorverwezen naar depot) — '+(cd.cbf_depot_reden||'reden onbekend')+(cd.cbf_depot_toelichting?': '+cd.cbf_depot_toelichting:'');
      if (cd.locatie==='Vraag over depot / hub') return 'Vraag over depot/hub: '+(cd.cbb_hub_reden||'')+(cd.cbb_hub_toelichting?' — '+cd.cbb_hub_toelichting:'');
      if (cd.locatie==='Bij de klant') return cd.cbf_pakket_uitkomst||cd.cbf_pakket_reden||'Vraag over pakket';
      if (cd.onderweg_type==='Advies gegeven') return cd.advies_gelukt==='Ja, service uitgevoerd'?'Advies gegeven aan held waardoor service uitgevoerd is':'Nee, geen oplossing door DS';
      if (cd.onderweg_type==='Adres klopt niet') return 'Adres klopt niet — instructie gegeven voor Jerney';
      return cd.onderweg_uitkomst||'';
    }
    if (cd.locatie==='Afhandeling buiten DS') return cd.afwijkend_reden==='Overig'?(cd.afwijkend_toelichting||'Afhandeling buiten DS'):cd.afwijkend_reden;
    if (['Technische Dienst','Yeply','G4S'].includes(cd.locatie)) return 'Vraag beantwoord ('+cd.locatie+')';
    if (cd.locatie==='Winkel') {
      if (cd.ks_reden==='Informatie over vracht') return 'Advies gegeven aan Winkel — depot doorverwezen';
      if (cd.ks_reden==='Advies gegeven aan Winkel') return 'Advies gegeven aan Winkel';
      if (cd.ks_reden==='Witgoed Demo Wissel') return cd.ks_uitkomst||'Witgoed Demo Wissel';
      if (cd.ks_reden==='Winkel vraagt om held terug te sturen') {
        if (cd.ks_uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
        if (cd.ks_uitkomst==='Next day gepland') return 'Ja stop gepland (next day)';
        return cd.ks_uitkomst||'';
      }
      if (cd.uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
      if (cd.uitkomst==='Geen same day mogelijk') return 'Geen same day mogelijk — KS/Winkel regelt next day nazorg';
      return 'Nee, geen oplossing door DS';
    }
    if (cd.locatie==='Klantenservice') {
      if (cd.ks_reden==='Advies gegeven aan KS') return 'Advies gegeven aan KS';
      if (cd.ks_reden==='Bezorgadres/telefoonnummer klant doorgeven aan held') return 'Bezorgadres/telefoonnummer klant doorgegeven aan held';
      if (cd.ks_reden==='KS vraagt om held terug te sturen') { if (cd.ks_uitkomst==='Same day gepland') return 'Ja stop gepland (same day)'; if (cd.ks_uitkomst==='Next day gepland') return 'Ja stop gepland (next day)'; return cd.ks_uitkomst||''; }
      if (cd.uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
      if (cd.uitkomst==='Klant ziet af van service (meerkosten)') return 'Klant ziet af van service vanwege meerkosten';
      if (cd.uitkomst==='Geen same day mogelijk') return 'Geen same day mogelijk — KS regelt next day nazorg';
      return 'Nee, geen oplossing door DS';
    }
    if (cd.locatie==='Bij de klant') {
      if (cd.probleem==='Verkeerd gelabeld product') return 'Verkeerd gelabeld product — instructie gegeven aan Held';
      if (cd.probleem==='Onverwacht retour') return 'Onverwacht retour doorgegeven';
      var isAdv=cd.probleem==='Advies gegeven'||cd.uitkomst==='Advies gegeven';
      if (isAdv) return cd.advies_gelukt==='Ja, service uitgevoerd'?'Advies gegeven aan held waardoor service uitgevoerd is':'Nee, geen oplossing door DS';
      if (cd.uitkomst==='Same day gepland') return 'Ja stop gepland (same day)';
      if (cd.uitkomst==='Next day gepland') return 'Ja stop gepland (next day)';
      if (cd.uitkomst==='Klant ziet af van service (meerkosten)') return 'Klant ziet af van service vanwege meerkosten';
      if (cd.uitkomst==='Geen oplossing gepland') return 'Geen oplossing gepland door DS';
      return 'Nee, geen oplossing door DS';
    }
    if (cd.locatie==='Vraag over depot / hub') return 'Vraag over depot/hub: '+(cd.cbb_hub_reden||'')+(cd.cbb_hub_toelichting?' — '+cd.cbb_hub_toelichting:'');
    if (cd.onderweg_type==='Advies gegeven') return cd.advies_gelukt==='Ja, service uitgevoerd'?'Advies gegeven aan held waardoor service uitgevoerd is':'Nee, geen oplossing door DS';
    if (cd.onderweg_type==='Adres klopt niet') return 'Adres klopt niet — instructie gegeven voor Jerney';
    return cd.onderweg_uitkomst||'';
  }

  // ── LOG PARAMS ────────────────────────────────────────────────
  function bouwLogParams(cd) {
    var dsW=berekenDsWaarde(cd);
    var probLog, redenGeenOplossing='', redenNextDay='', routeLog='', orderOplLog='';
    var logD1=cd.driver1, logD2=cd.driver2, logOB=cd.orderBron;
    var skipRF=false;
    if (cd.bellerType==='Teamleider') {
      probLog=cd.tl_reden+(cd.tl_uitkomst?' — '+cd.tl_uitkomst:''); logD1=''; logD2='';
    } else if (cd.bellerType==='CBF') {
      if (cd.locatie==='Vraag voor het depot') { probLog='Vraag voor het depot: '+(cd.cbf_depot_reden||'')+(cd.cbf_depot_toelichting?' — '+cd.cbf_depot_toelichting:''); logD1=''; logD2=''; logOB=''; }
      else if (cd.locatie==='Vraag over depot / hub') { probLog='Vraag over depot/hub: '+(cd.cbb_hub_reden||'')+(cd.cbb_hub_toelichting?' — '+cd.cbb_hub_toelichting:''); logD1=''; logD2=''; logOB=''; }
      else if (cd.locatie==='Bij de klant') probLog='Vraag over pakket: '+(cd.cbf_pakket_reden||'');
      else probLog='Onderweg: '+cd.onderweg_type;
    } else if (cd.locatie==='Afhandeling buiten DS') {
      probLog='Afhandeling buiten DS: '+cd.afwijkend_reden;
    } else if (['Technische Dienst','Yeply','G4S'].includes(cd.locatie)) {
      probLog=cd.locatie+': externe partner';
    } else if (cd.locatie==='Winkel') {
      var wOpl=cd.ks_reden==='Winkel vraagt om held terug te sturen'?cd.ks_uitkomst:cd.uitkomst;
      probLog='Winkel: '+cd.ks_reden+(cd.probleem?' — '+cd.probleem:''); redenGeenOplossing=cd.geen_oplossing_reden||''; redenNextDay=cd.next_day_reden||'';
      routeLog=(wOpl==='Next day gepland')?'Next Day':cd.geplandeRoute; orderOplLog=(wOpl==='Same day gepland'||wOpl==='Next day gepland')?cd.orderBron+'-DS':'';
      if (cd.ks_reden==='Informatie over vracht'||cd.ks_reden==='Witgoed Demo Wissel') { logD1=''; logD2=''; logOB=''; probLog=''; routeLog=''; skipRF=true; }
    } else if (cd.locatie==='Klantenservice') {
      var kOpl=cd.ks_reden==='KS vraagt om held terug te sturen'?cd.ks_uitkomst:cd.uitkomst;
      probLog='KS: '+cd.ks_reden+(cd.probleem?' — '+cd.probleem:''); redenGeenOplossing=cd.geen_oplossing_reden||''; redenNextDay=cd.next_day_reden||'';
      routeLog=(kOpl==='Next day gepland')?'Next Day':cd.geplandeRoute; orderOplLog=(kOpl==='Same day gepland'||kOpl==='Next day gepland')?cd.orderBron+'-DS':'';
    } else if (cd.locatie==='Vraag over depot / hub') {
      probLog='Vraag over depot/hub: '+(cd.cbb_hub_reden||'')+(cd.cbb_hub_toelichting?' — '+cd.cbb_hub_toelichting:''); logD1=''; logD2='';
    } else if (cd.locatie==='Bij de klant') {
      probLog=cd.milieuretour_type?(cd.milieuretour_type==='Pick-up'?'Pick-up (handmatig gepland)':'Milieuretour ophalen'):cd.probleem;
      redenGeenOplossing=cd.geen_oplossing_reden||''; redenNextDay=cd.next_day_reden||'';
      routeLog=(cd.uitkomst==='Next day gepland'||cd.uitkomst==='Next day visit gepland')?'Next Day':cd.geplandeRoute;
      orderOplLog=(cd.uitkomst==='Same day gepland'||cd.uitkomst==='Next day gepland'||cd.uitkomst==='Same day visit gepland'||cd.uitkomst==='Next day visit gepland')?cd.orderBron+'-DS':'';
    } else { probLog=cd.onderweg_type; }
    var prodLog=skipRF?'':cd.product+(cd.formaatTV?' ('+cd.formaatTV+')':'');
    var bellerLog=cd.locatie==='Klantenservice'?'Klantenservice':cd.locatie==='Winkel'?'Winkel':['Technische Dienst','Yeply','G4S'].includes(cd.locatie)?cd.locatie:cd.bellerType||'';
    var extraInfo=cd.locatie==='Afhandeling buiten DS'&&cd.afwijkend_reden==='Overig'?cd.afwijkend_toelichting:'';
    var extraDienst=(cd.locatie==='Klantenservice'||cd.locatie==='Winkel')&&cd.ks_reden==='Nazorg nodig'?'Ja':'';
    var cat=berekenCategorie(cd);
    return '?id='+Date.now()+'&user='+encodeURIComponent(cd.user)+'&route='+encodeURIComponent(cd.route)+'&depot='+encodeURIComponent(cd.depot)+'&driver1='+encodeURIComponent(logD1)+'&driver2='+encodeURIComponent(logD2)+'&orderBron='+encodeURIComponent(logOB)+'&product='+encodeURIComponent(prodLog)+'&probleem='+encodeURIComponent(probLog)+'&redenGeenOplossing='+encodeURIComponent(redenGeenOplossing)+'&redenNextDay='+encodeURIComponent(redenNextDay)+'&orderOplossing='+encodeURIComponent(orderOplLog)+'&geplandeRoute='+encodeURIComponent(routeLog)+'&dsWaarde='+encodeURIComponent(dsW)+'&bellerType='+encodeURIComponent(bellerLog)+'&tijdvak='+encodeURIComponent(cd.tijdvak)+'&aankomsttijd='+encodeURIComponent(cd.aankomsttijd)+'&extra_info='+encodeURIComponent(extraInfo)+'&extra_dienst='+encodeURIComponent(extraDienst)+'&categorie='+encodeURIComponent(cat);
  }

  // ── KLEMBORD ─────────────────────────────────────────────────
  function kopieerNaarKlembord(cd) {
    var rawPC, cleanPC='', name, ph, email, address, city;
    if (isBasicPage) {
      rawPC   = basicField('Postcode');
      cleanPC = rawPC.replace(/\s+/g,'').toUpperCase();
      city    = basicField('Woonplaats').replace(/^\s*\d{4,5}\s*[A-Z]{0,2}\s+/i,'').trim();
      name    = basicField('Naam');
      ph      = (basicFieldInSection('Geadresseerde','Telefoonnummer')||basicFieldInSection('Geadresseerde','Mobiel nummer')||'').replace(/[^\d+]/g,'');
      email   = basicFieldInSection('Geadresseerde','E-mailadres');
      address = basicField('Adres');
    } else {
      var gs=function(s){ var el=document.querySelector("[data-bind*='"+s+"']"); return el?el.innerText.trim():''; };
      rawPC=gs('Static.Visit.PostalCode');
      var dm=rawPC.match(/^(\d{4}\s?[A-Z]{2})(\s|$)/i), bm=rawPC.match(/^(\d{4,5})(\s|$)/);
      if (dm) cleanPC=dm[1].trim(); else if (bm) cleanPC=bm[1].trim(); else cleanPC=(rawPC.match(/^\d{4}/)||[''])[0];
      city=(gs('Static.Visit.City')||gs('City')||'').replace(/^\s*\d{4,5}\s*[A-Z]{0,2}\s+/i,'').trim();
      name=gs('Static.Visit.ContactName')||gs('ConsigneeName')||'';
      ph=(gs('Static.Visit.Phone')||gs('Static.Visit.PhoneNumber')||gs('PhoneNumber')||'').replace(/[^\d+]/g,'');
      email=gs('Static.Visit.Email')||gs('Email')||'';
      address=gs('Static.Visit.Address')||gs('ConsigneeAddress')||'';
    }
    var pp={'+31':'0','+32':'0','+49':'0','0031':'0','0032':'0','0049':'0'};
    for (var pfx in pp) { if (ph.startsWith(pfx)) { ph=pp[pfx]+ph.substring(pfx.length); break; } }
    ph=ph.replace(/^\+(\d{1,3})/,'0').replace(/^00(\d{1,3})/,'0');
    var country='Nederland', lang='nl', pNS=cleanPC.replace(/\s/g,'').toUpperCase();
    if (/[A-Z]/.test(pNS)&&pNS.replace(/\D/g,'').length===4) { country='Nederland'; lang='nl'; }
    else if (!/[A-Z]/.test(pNS)&&pNS.length===5) { country='Duitsland'; lang='de'; }
    else if (!/[A-Z]/.test(pNS)&&pNS.length===4) { country='België'; lang='nl'; }
    var prob=(cd.probleem||'').toLowerCase();
    var isNazorg=cd.dienstType!=='Extra dienst (betaald)';
    var serviceTypeId=null;
    if (prob.includes('plaatsen')||prob.includes('tillen')) serviceTypeId=51072;
    else if (prob.includes('aansluiting')) serviceTypeId=51060;
    else if (prob.includes('slang')) serviceTypeId=51064;
    else if (prob.includes('trekschakelaar')) serviceTypeId=277249;
    else if (prob.includes('milieuretour')&&cd.milieuretour_type==='Pick-up') serviceTypeId=427807;
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
    var pickupProbleem=cd.milieuretour_type?(cd.milieuretour_type==='Pick-up'?'Pick-up (handmatig gepland)':'Milieuretour ophalen'):cd.probleem;
    var payload={orderNr:cd.orderBron+'-DS',name:name,phone:ph,email:email,zip:cleanPC,city:city,address:address,detectedCountry:country,detectedLanguage:lang,product:effectiefProduct(cd),probleem:pickupProbleem,dienstType:cd.dienstType,formaatTV:cd.formaatTV,tvNetwerk:cd.tvNetwerk,uitkomst:cd.uitkomst||cd.ks_uitkomst||'',geplandeRoute:cd.geplandeRoute||'',serviceTypeId:serviceTypeId,time:Date.now()};
    if ((prob.includes('plaatsen')||prob.includes('tillen'))&&cd.product_keuze) payload.products=cd.product_keuze.split(', ');
    navigator.clipboard.writeText(JSON.stringify(payload));
  }

  // ── CSS INJECTION ─────────────────────────────────────────────
  const css = `
  #${ROOT_ID} {
    --cb-blue:#0090e3;--cb-blue-deep:#007ec7;--cb-blue-darker:#005a92;
    --cb-blue-bg:#eaf5fc;--cb-blue-line:#cfe6f5;
    --accent:#f7a81b;--accent-dark:#e89400;
    --ink-1:#0e2540;--ink-2:#2a3a4f;--ink-3:#5a6a7f;--ink-4:#8b9bad;
    --paper:#fff;--line:#e2e7ec;--line-soft:#eef1f4;
    --ok:#2c8a4a;--ok-bg:#e6f4ec;--warn:#b85c00;--warn-bg:#fdf1de;
    --r-sm:4px;--r-md:6px;--r-lg:10px;
    position:fixed;bottom:16px;left:16px;width:460px;
    height:768px;
    max-height:calc(100vh - 32px);
    z-index:2147483645;
    font:13.5px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;
    color:var(--ink-1);
    background:var(--paper);
    border-radius:8px;
    box-shadow:0 6px 24px rgba(10,30,60,.18),0 2px 6px rgba(10,30,60,.08);
    display:flex;flex-direction:column;overflow:hidden;
    -webkit-font-smoothing:antialiased;
  }
  #${ROOT_ID} *,#${ROOT_ID} *::before,#${ROOT_ID} *::after{box-sizing:border-box}
  #${ROOT_ID} button{font:inherit;cursor:pointer;margin:0}
  #${ROOT_ID} kbd{display:inline-block;font:600 10px ui-monospace,Menlo,monospace;
    padding:1px 5px;border:1px solid var(--line);border-bottom-width:2px;
    border-radius:3px;background:#fafbfc;color:var(--ink-2);margin:0 2px}
  #${ROOT_ID} .ds-header{background:linear-gradient(180deg,var(--cb-blue),var(--cb-blue-deep));
    color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
  #${ROOT_ID} .ds-header__brand{display:flex;align-items:center;gap:10px}
  #${ROOT_ID} .ds-logo{display:inline-flex;align-items:center;gap:7px;
    background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);
    border-radius:999px;padding:4px 10px 4px 6px;font-weight:700;font-size:12px;letter-spacing:.02em}
  #${ROOT_ID} .ds-logo__dot{width:14px;height:14px;border-radius:50%;background:var(--accent);
    box-shadow:0 0 0 2px rgba(255,255,255,.35) inset}
  #${ROOT_ID} .ds-header__sub{font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:.12em}
  #${ROOT_ID} .ds-header__right{display:flex;align-items:center;gap:10px}
  #${ROOT_ID} .ds-iconbtn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
    color:#fff;border-radius:var(--r-sm);width:24px;height:24px;display:inline-flex;
    align-items:center;justify-content:center;padding:0}
  #${ROOT_ID} .ds-iconbtn:hover{background:rgba(255,255,255,.22)}
  #${ROOT_ID} .ds-version{font:600 10px ui-monospace,monospace;opacity:.65;letter-spacing:.03em}
  #${ROOT_ID} .ds-stage-banner{background:#fff7e2;border-bottom:1px solid #f4dca0;color:#7a5300;
    font-size:11px;padding:6px 12px;display:flex;align-items:center;gap:6px;font-weight:600}
  #${ROOT_ID} .ds-order{background:var(--cb-blue-bg);border-bottom:1px solid var(--cb-blue-line);flex-shrink:0}
  #${ROOT_ID} .ds-order__head{width:100%;background:transparent;border:0;text-align:left;
    padding:10px 14px;position:relative;display:flex;flex-direction:column;gap:3px}
  #${ROOT_ID} .ds-order__top{display:flex;align-items:center;gap:8px;font-size:11px;
    color:var(--cb-blue-darker);font-weight:600;letter-spacing:.03em;text-transform:uppercase}
  #${ROOT_ID} .ds-order__nr{font-family:ui-monospace,monospace}
  #${ROOT_ID} .ds-order__country{display:inline-flex;align-items:center;gap:4px;margin-left:auto;
    font-weight:500;text-transform:none;color:var(--ink-3);font-size:11px;letter-spacing:0}
  #${ROOT_ID} .ds-flag{display:inline-block;width:14px;height:10px;
    background:linear-gradient(to bottom,#ae1c28 33%,#fff 33% 66%,#21468b 66%);
    border-radius:1.5px;border:.5px solid rgba(0,0,0,.1)}
  #${ROOT_ID} .ds-order__name{display:flex;align-items:center;gap:6px;font-weight:700;font-size:14px}
  #${ROOT_ID} .ds-order__phone{margin-left:auto;font-weight:500;font-size:12px;color:var(--ink-2);
    font-family:ui-monospace,monospace;display:inline-flex;align-items:center;gap:4px}
  #${ROOT_ID} .ds-order__chev{position:absolute;right:10px;bottom:8px;font-size:10px;color:var(--ink-3)}
  #${ROOT_ID} .ds-order__body{padding:0 14px 12px;display:grid;gap:4px;
    border-top:1px dashed var(--cb-blue-line);margin-top:4px;padding-top:8px}
  #${ROOT_ID} .ds-row{display:grid;grid-template-columns:78px 1fr;gap:8px;font-size:12px}
  #${ROOT_ID} .ds-row__l{color:var(--ink-3)}
  #${ROOT_ID} .ds-row__v{color:var(--ink-1);font-weight:500}
  #${ROOT_ID} .ds-row__v.is-mono{font-family:ui-monospace,monospace;font-size:11.5px}
  #${ROOT_ID} .ds-body{flex:1;overflow-y:auto;padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px}
  #${ROOT_ID} .ds-body::-webkit-scrollbar{width:8px}
  #${ROOT_ID} .ds-body::-webkit-scrollbar-thumb{background:#d9dfe5;border-radius:4px}
  #${ROOT_ID} .ds-step-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
  #${ROOT_ID} .ds-back{background:transparent;border:1px solid transparent;
    color:var(--cb-blue-darker);font-weight:600;font-size:12px;padding:3px 6px 3px 4px;
    border-radius:var(--r-sm);display:inline-flex;align-items:center;gap:3px}
  #${ROOT_ID} .ds-back:hover{background:var(--cb-blue-bg)}
  #${ROOT_ID} .ds-trail{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px;
    font-size:11px;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;margin-left:auto}
  #${ROOT_ID} .ds-trail li::after{content:"›";padding:0 4px;color:var(--ink-4)}
  #${ROOT_ID} .ds-trail li:last-child::after{content:""}
  #${ROOT_ID} .ds-trail li.is-current{color:var(--cb-blue-darker);font-weight:700}
  #${ROOT_ID} .ds-h4{font-size:14px;font-weight:700;margin:4px 0 2px;letter-spacing:-.005em}
  #${ROOT_ID} .ds-p{margin:0 0 4px;color:var(--ink-2);font-size:12.5px}
  #${ROOT_ID} .ds-stack{display:flex;flex-direction:column;gap:6px}
  #${ROOT_ID} .ds-grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  #${ROOT_ID} .ds-callergrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  #${ROOT_ID} .ds-callergrid > .ds-opt:first-child{grid-column:1 / -1}
  #${ROOT_ID} .ds-opt{display:flex;align-items:center;gap:10px;background:#fff;
    border:1px solid var(--line);border-left:3px solid var(--line);border-radius:var(--r-md);
    padding:9px 12px;text-align:left;font-weight:500;font-size:13.5px;color:var(--ink-1);
    transition:border-color .12s,background .12s;position:relative;width:100%}
  #${ROOT_ID} .ds-opt:hover{border-color:var(--cb-blue);border-left-color:var(--cb-blue);background:#f7fbfe}
  #${ROOT_ID} .ds-opt.is-selected{border-color:var(--cb-blue-deep);
    border-left-color:var(--accent);background:var(--cb-blue-bg)}
  #${ROOT_ID} .ds-opt.is-big{padding:12px 14px;font-size:14px}
  #${ROOT_ID} .ds-opt__icon{width:32px;height:32px;border-radius:6px;background:var(--cb-blue-bg);
    color:var(--cb-blue-darker);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
  #${ROOT_ID} .ds-opt__label{flex:1}
  #${ROOT_ID} .ds-opt__sub{font-size:11px;color:var(--ink-3);font-weight:500;
    background:var(--line-soft);padding:2px 8px;border-radius:999px}
  #${ROOT_ID} .ds-opt.is-ok .ds-opt__sub{background:var(--ok-bg);color:var(--ok)}
  #${ROOT_ID} .ds-opt.is-warn .ds-opt__sub{background:var(--warn-bg);color:var(--warn)}
  #${ROOT_ID} .ds-disclose{border-top:1px dashed var(--line);padding-top:8px;margin-top:4px}
  #${ROOT_ID} .ds-disclose > summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;
    gap:4px;color:var(--cb-blue-darker);font-weight:600;font-size:12px;padding:4px 6px;border-radius:var(--r-sm)}
  #${ROOT_ID} .ds-disclose > summary::-webkit-details-marker{display:none}
  #${ROOT_ID} .ds-disclose > summary:hover{background:var(--cb-blue-bg)}
  #${ROOT_ID} .ds-disclose[open] > summary{margin-bottom:6px}
  #${ROOT_ID} .ds-note{display:flex;gap:8px;padding:8px 10px;border-radius:var(--r-md);
    font-size:12.5px;border:1px solid;align-items:flex-start}
  #${ROOT_ID} .ds-note.is-info{background:var(--cb-blue-bg);border-color:var(--cb-blue-line);color:var(--cb-blue-darker)}
  #${ROOT_ID} .ds-note.is-warn{background:var(--warn-bg);border-color:#f4dca0;color:var(--warn)}
  #${ROOT_ID} .ds-note.is-ok{background:var(--ok-bg);border-color:#b9dfc7;color:var(--ok)}
  #${ROOT_ID} .ds-note strong{display:block;margin-bottom:2px;font-weight:700}
  #${ROOT_ID} .ds-field{display:flex;flex-direction:column;gap:3px}
  #${ROOT_ID} .ds-field__l{font-size:11px;font-weight:600;text-transform:uppercase;
    letter-spacing:.04em;color:var(--ink-3)}
  #${ROOT_ID} .ds-field__hint{font-size:11px;color:var(--ink-3)}
  #${ROOT_ID} .ds-input{width:100%;padding:7px 10px;border:1px solid var(--line);
    border-radius:var(--r-md);font:inherit;color:var(--ink-1);background:#fff;outline:none;
    transition:border-color .12s,box-shadow .12s}
  #${ROOT_ID} .ds-input:focus{border-color:var(--cb-blue);box-shadow:0 0 0 3px rgba(0,144,227,.18)}
  #${ROOT_ID} .ds-input.is-route{font-family:ui-monospace,monospace;font-size:14px;
    letter-spacing:.04em;font-weight:600}
  #${ROOT_ID} .ds-route-preview{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}
  #${ROOT_ID} .ds-route-preview > div{background:var(--cb-blue-bg);border:1px solid var(--cb-blue-line);
    border-radius:var(--r-md);padding:8px 10px;display:flex;flex-direction:column;gap:1px}
  #${ROOT_ID} .ds-route-preview span{font-size:10px;color:var(--cb-blue-darker);
    text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  #${ROOT_ID} .ds-route-preview strong{font:700 16px ui-monospace,monospace;color:var(--ink-1)}
  #${ROOT_ID} .ds-summary{border:1px solid var(--line);border-radius:var(--r-md);
    background:#fafbfd;padding:8px 12px 10px}
  #${ROOT_ID} .ds-summary__head{display:flex;justify-content:space-between;align-items:center;
    margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed var(--line)}
  #${ROOT_ID} .ds-summary__cat{font-size:11px;color:var(--ink-3)}
  #${ROOT_ID} .ds-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;
    font-weight:700;padding:2px 8px;border-radius:999px}
  #${ROOT_ID} .ds-pill.is-ok{background:var(--ok-bg);color:var(--ok)}
  #${ROOT_ID} .ds-srow{display:grid;grid-template-columns:80px 1fr;gap:8px;font-size:12px;padding:3px 0}
  #${ROOT_ID} .ds-srow > span{color:var(--ink-3)}
  #${ROOT_ID} .ds-srow > strong{font-weight:600}
  #${ROOT_ID} .ds-actions{display:flex;flex-direction:column;gap:6px}
  #${ROOT_ID} .ds-code{background:#0e2540;color:#d6e4f0;border-radius:var(--r-md);
    padding:10px 12px;font:500 11px/1.5 ui-monospace,Menlo,monospace;margin:6px 0 0;
    overflow-x:auto;max-height:200px;white-space:pre-wrap}
  #${ROOT_ID} .ds-btn{border:1px solid var(--line);background:#fff;border-radius:var(--r-md);
    padding:7px 12px;font-weight:600;font-size:12.5px;color:var(--ink-1);display:inline-flex;
    align-items:center;gap:6px;transition:background .12s,border-color .12s}
  #${ROOT_ID} .ds-btn:hover{background:var(--line-soft)}
  #${ROOT_ID} .ds-btn:disabled{opacity:.45;cursor:not-allowed}
  #${ROOT_ID} .ds-btn--primary{background:var(--accent);border-color:var(--accent-dark);color:#fff}
  #${ROOT_ID} .ds-btn--primary:hover{background:var(--accent-dark)}
  #${ROOT_ID} .ds-btn--secondary{background:var(--cb-blue);border-color:var(--cb-blue-deep);color:#fff}
  #${ROOT_ID} .ds-btn--secondary:hover{background:var(--cb-blue-deep)}
  #${ROOT_ID} .ds-btn--ghost{background:transparent;border-color:transparent;color:var(--ink-3)}
  #${ROOT_ID} .ds-btn--ghost:hover{background:var(--line-soft);color:var(--ink-1)}
  #${ROOT_ID} .ds-btn--lg{padding:11px 14px;font-size:13.5px;justify-content:center}
  #${ROOT_ID} .ds-footer{border-top:1px solid var(--line);padding:8px 14px;display:flex;
    align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;background:#fbfcfd}
  #${ROOT_ID} .ds-hint{font-size:11px;color:var(--ink-4)}
  `;

  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ID;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const rootEl = document.createElement("div");
  rootEl.id = ROOT_ID;
  document.body.appendChild(rootEl);

  // ── CDN ───────────────────────────────────────────────────────
  const REACT_URL = "https://unpkg.com/react@18.3.1/umd/react.production.min.js";
  const REACT_DOM_URL = "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js";
  const BABEL_URL = "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js";

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      if (Array.from(document.scripts).some(function(s){ return s.src===src; })) return resolve();
      var s = document.createElement("script");
      s.src = src; s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = function(){ reject(new Error("Failed: "+src)); };
      document.head.appendChild(s);
    });
  }

  async function boot(scraped) {
    if (!window.React) await loadScript(REACT_URL);
    if (!window.ReactDOM) await loadScript(REACT_DOM_URL);
    if (!window.Babel) await loadScript(BABEL_URL);
    runApp(scraped);
  }

  // ── REACT APP ─────────────────────────────────────────────────
  function runApp(scraped) {
    var DS = {
      scraped: scraped,
      isBasicPage: isBasicPage,
      GAS_URL: GAS_URL,
      alleDepots: alleDepots,
      bkDepots: bkDepots,
      nextDayRedenen: nextDayRedenen,
      bepaalStappen: bepaalStappenPure,
      berekenCategorie: berekenCategorie,
      bouwLogParams: bouwLogParams,
      kopieerNaarKlembord: kopieerNaarKlembord,

      parseToTourAlias: parseToTourAlias,
      effectiefProduct: effectiefProduct,
      skipDienstType: skipDienstType,
      getProductVerfijningOpties: getProductVerfijningOpties,
      productNeedsVerfijning: productNeedsVerfijning,
      detecteerType: detecteerType,
      maakProductLabel: maakProductLabel,
      artikelsoortNaarProduct: artikelsoortNaarProduct,
      version: STAGING_VERSION,
    };

    const JSX_SOURCE = `
const {useState,useEffect,useRef} = React;

function artikelsoortNaarProd(soort){
  var m={wasmachine:'Wasmachine',wasdroogcombinatie:'Wasdroogcombinatie',droger:'Droger',koelkast:'Koelkast / Vriezer','inbouw koelkast':'Koelkast / Vriezer',vriezer:'Koelkast / Vriezer','inbouw vriezer':'Koelkast / Vriezer','koel-vries combo':'Koelkast / Vriezer',vaatwasser:'Vaatwasser','inbouw vaatwasser':'Vaatwasser',televisie:'Televisie',soundbar:'Soundbar',oven:'Oven / Magnetron',magnetron:'Oven / Magnetron','combi-oven':'Combi-oven',kookplaat:'Kookplaat',fornuis:'Fornuis',afzuigkap:'Afzuigkap'};
  return m[(soort||'').trim().toLowerCase()]||null;
}

function initConv(sc){
  var cd={user:'',fname:'',lname:'',route:sc.route||'',orderBron:sc.orderNr||'',driver1:sc.driver1||'',driver2:sc.driver2||'',depot:'Onbekend',model:sc.model||'',bellerType:'',locatie:'',probleem:'',milieuretour_type:'',product:'',formaatTV:'',productVerfijnd:'',tvNetwerk:'',uitkomst:'',geplandeRoute:'',next_day_reden:'',geen_oplossing_reden:'',advies_gelukt:'',onderweg_type:'',onderweg_uitkomst:'',ks_reden:'',ks_uitkomst:'',ks_advies_uitkomst:'',afwijkend_reden:'',afwijkend_toelichting:'',cbf_depot_reden:'',cbf_depot_toelichting:'',cbf_pakket_reden:'',cbf_pakket_uitkomst:'',cbb_hub_reden:'',cbb_hub_toelichting:'',tl_reden:'',tl_uitkomst:'',winkel_reden:'',orderOplossing:'',dsWaarde:'',tijdvak:sc.tijdvak||'',aankomsttijd:sc.aankomsttijd||'',dienstType:'',product_keuze:''};
  var ak=[],afk=[],isAG=false;
  var fn=localStorage.getItem('ds_fname')||'',ln=localStorage.getItem('ds_lname')||'';
  if(fn){cd.fname=fn;ak.push('fname');afk.push('fname');}
  if(ln){cd.lname=ln;ak.push('lname');afk.push('lname');}
  if(fn||ln)cd.user=(fn+' '+ln).trim();
  if(sc.route){var rm=sc.route.match(/[A-Z]{4}/);if(rm){var isBk=/^BK[-\\s]/i.test(sc.route);var dn=isBk?(DS.bkDepots[rm[0]]||null):((DS.alleDepots.find(function(d){return d.code===rm[0];})||{}).name||null);if(dn)cd.depot=dn;}}
  var multi=(sc.alleGescrapteProducten||[]).length>1;
  if(!multi&&sc.model){
    var m=sc.model,ml=m.toLowerCase();
    if(DS.isBasicPage&&sc.artikelsoortenMap&&sc.artikelsoortenMap[m]){var sp=artikelsoortNaarProd(sc.artikelsoortenMap[m]);if(sp){cd.product=sp;ak.push('product');afk.push('product');isAG=true;}}
    if(!ak.includes('product')){var det=DS.detecteerType(m);if(det&&det.typeGuess){var tg=det.typeGuess,p=null;if(tg==='televisie')p='Televisie';else if(tg==='soundbar')p='Soundbar';else if(tg==='combi-oven')p='Combi-oven';else if(tg==='oven'||tg==='magnetron')p='Oven / Magnetron';else if(tg==='fornuis')p='Fornuis';else if(tg==='kookplaat')p='Kookplaat';else if(tg==='wasmachine')p='Wasmachine';else if(tg==='wasdroogcombinatie')p='Wasdroogcombinatie';else if(tg==='droger')p='Droger';else if(tg.includes('koelkast')||tg.includes('vriezer')||tg==='koel-vries combo')p='Koelkast / Vriezer';else if(tg.includes('vaatwasser'))p='Vaatwasser';else if(tg==='afzuigkap')p='Afzuigkap';if(p){cd.product=p;ak.push('product');afk.push('product');isAG=true;}}}
    if(!ak.includes('product')){var p2=null;if(ml.includes('tv')||ml.includes('televisie')||ml.match(/(oled|qled)/))p2='Televisie';else if(ml.includes('soundbar')||ml.includes('sound bar'))p2='Soundbar';else if(ml.includes('oven')||ml.includes('magnetron'))p2='Oven / Magnetron';else if(ml.includes('kookplaat')||ml.includes('inductie'))p2='Kookplaat';else if(ml.includes('fornuis'))p2='Fornuis';else if(ml.includes('afzuigkap')||ml.includes('wasemkap'))p2='Afzuigkap';else if(ml.includes('tussenstuk')||ml.includes('stapelplaats'))p2='Wasmachine';if(p2){cd.product=p2;ak.push('product');afk.push('product');isAG=true;}}
    if(cd.product==='Televisie'){var tvStr=m.replace(/^\\S+\\s*/,'');var tvM=tvStr.match(/(?:qe|oled|kd|xr|ue|tx-?)?([4-8]\\d)[a-z]/i)||tvStr.match(/\\b([4-8]\\d)\\s?(inch|")\\b/i)||tvStr.match(/^(\\d{2})[A-Z]/i);if(tvM){cd.formaatTV=parseInt(tvM[1])>=55?'Ja (>= 55 inch)':'Nee (< 55 inch)';ak.push('formaatTV');afk.push('formaatTV');}}
  }
  return {cd:cd,ak:ak,afk:afk,isAG:isAG};
}

function App(){
  var sc=DS.scraped;
  var alleProds=sc.alleGescrapteProducten||[];
  var _cs=useState(function(){return initConv(sc);}),conv=_cs[0],setConv=_cs[1];
  var _cd=useState(false),logDone=_cd[0],setLogDone=_cd[1];
  var _ct=useState(''),textVal=_ct[0],setTextVal=_ct[1];
  var _cm=useState([]),multiSel=_cm[0],setMultiSel=_cm[1];
  var cd=conv.cd,ak=conv.ak,afk=conv.afk,isAG=conv.isAG;
  var inputRef=useRef(null);

  useEffect(function(){if(inputRef.current)inputRef.current.focus();},[ak.length]);

  var steps=DS.bepaalStappen(cd,ak,afk,alleProds);
  var stap=steps.find(function(s){return !ak.includes(s.key);});

  function upd(cdP,ak2,afk2,clr){
    setConv(function(prev){
      var newCd=Object.assign({},prev.cd,cdP||{});
      var newAk=prev.ak.slice(),newAfk=prev.afk.slice();
      if(clr)clr.forEach(function(k){newCd[k]='';newAk=newAk.filter(function(x){return x!==k;});newAfk=newAfk.filter(function(x){return x!==k;});});
      (ak2||[]).forEach(function(k){if(!newAk.includes(k))newAk.push(k);});
      (afk2||[]).forEach(function(k){if(!newAfk.includes(k))newAfk.push(k);});
      return {cd:newCd,ak:newAk,afk:newAfk,isAG:prev.isAG};
    });
    setTextVal('');setMultiSel([]);
  }

  function ans(key,val,extra,akExt,afkExt,clr){
    var cdP=Object.assign({},extra||{});cdP[key]=val;
    upd(cdP,[key].concat(akExt||[]),afkExt||[],clr||null);
  }

  function goBack(){
    setConv(function(prev){
      var idx=-1;for(var i=prev.ak.length-1;i>=0;i--){if(!prev.afk.includes(prev.ak[i])){idx=i;break;}}
      if(idx===-1)return prev;
      var removed=prev.ak.slice(idx),newAk=prev.ak.slice(0,idx),newCd=Object.assign({},prev.cd);
      removed.forEach(function(k){newCd[k]='';});
      var newAfk=prev.afk.filter(function(k){return newAk.includes(k);});
      return {cd:newCd,ak:newAk,afk:newAfk,isAG:prev.isAG};
    });
    setTextVal('');setMultiSel([]);
  }

  var canBack=ak.some(function(k){return !afk.includes(k);});

  function handleSelect(val){
    var extra={},akExt=[],afkExt=[],clr=null;
    if(stap&&stap.key==='product_keuze'){
      var idx2=stap.opties?stap.opties.indexOf(val):-1,orig=idx2>=0?(alleProds[idx2]||val):val;
      extra.model=orig;
      var det2=DS.detecteerType(orig),pr=det2&&det2.typeGuess?det2.typeGuess.charAt(0).toUpperCase()+det2.typeGuess.slice(1):'';
      var nl2=orig.toLowerCase();if(!pr&&(nl2.includes('tv')||nl2.includes('televisie')||nl2.match(/(oled|qled)/)))pr='Televisie';
      if(pr){extra.product=pr;akExt.push('product');afkExt.push('product');}
      if(pr==='Televisie'){var tvM2=orig.toLowerCase().match(/(?:qe|oled|kd|xr|ue|gq|tx-)?([4-8]\\d)[a-z]/i)||orig.toLowerCase().match(/\\b([4-8]\\d)\\s?(inch|")\\b/i);if(tvM2){extra.formaatTV=parseInt(tvM2[1])>=55?'Ja (>= 55 inch)':'Nee (< 55 inch)';akExt.push('formaatTV');afkExt.push('formaatTV');}}
    }
    if(stap&&stap.key==='probleem'){
      var sp=val.toLowerCase();
      if((sp.includes('milieuretour')||sp.includes('pick'))&&isAG)clr=['product','formaatTV'];
      if((val.includes('TV')||val.includes('Soundbar'))&&!ak.includes('product')){extra.product='Televisie';akExt.push('product');afkExt.push('product');}
    }
    if(stap&&stap.key==='geplandeRoute'){ans('geplandeRoute',DS.parseToTourAlias(val));return;}
    if(stap&&stap.key==='fname')localStorage.setItem('ds_fname',val);
    if(stap&&stap.key==='lname'){localStorage.setItem('ds_lname',val);extra.user=((cd.fname||localStorage.getItem('ds_fname')||'')+' '+val).trim();}
    ans(stap.key,val,extra,akExt,afkExt,clr);
  }

  var chip='';
  if(cd.model){if(alleProds.length>1&&!ak.includes('product_keuze'))chip=alleProds.length+' producten';else if(cd.product)chip=cd.product+' ('+cd.model+')';else chip=cd.model;}

  var trail=[];
  [{k:'bellerType'},{k:'locatie'},{k:'probleem'}].forEach(function(t){if(ak.includes(t.k)&&cd[t.k])trail.push(cd[t.k]);});

  function Header(){return (
    <div className="ds-header">
      <div className="ds-header__brand"><div className="ds-logo"><div className="ds-logo__dot"></div>&nbsp;DS Logboek</div>{sc.orderNr&&<span className="ds-header__sub">{sc.orderNr}</span>}</div>
      <div className="ds-header__right"><button className="ds-iconbtn" title="Sluiten" onClick={function(){document.getElementById('ds-logboek-staging-root').remove();}}>✕</button><span className="ds-version">{DS.version}</span></div>
    </div>
  );}
  function StageBanner(){return <div className="ds-stage-banner">⚠ STAGING — design preview</div>;}
  function OrderCard(){if(!sc.orderNr)return null;
    var adresStr=(sc.adres&&sc.pc)?sc.adres+', '+sc.pc:sc.adres||sc.pc||'';
    var productStr=sc.alleGescrapteProducten&&sc.alleGescrapteProducten.length>0?sc.alleGescrapteProducten.join(', '):'';
    if(!adresStr&&!productStr&&!sc.tijdvak&&!sc.email)return null;
    return(
    <div className="ds-order">
    {(adresStr||productStr||sc.tijdvak)&&<div className="ds-order__body">
      {adresStr&&<div className="ds-row"><span className="ds-row__l">Adres</span><span className="ds-row__v">{adresStr}</span></div>}
      {productStr&&<div className="ds-row"><span className="ds-row__l">Product</span><span className="ds-row__v">{productStr}</span></div>}
      {sc.tijdvak&&<div className="ds-row"><span className="ds-row__l">Tijdvak</span><span className="ds-row__v is-mono">{sc.tijdvak}</span></div>}
      {sc.email&&<div className="ds-row"><span className="ds-row__l">E-mail</span><span className="ds-row__v">{sc.email}</span></div>}
    </div>}
    </div>
  );}
  function ProductChip(){if(!chip)return null;return <div style={{fontSize:11,color:'#5a6a7f',background:'#eef1f4',border:'1px solid #e2e7ec',borderRadius:12,padding:'3px 8px',display:'inline-block',marginBottom:8}}>{chip}</div>;}
  function StepHead(){return(
    <div className="ds-step-head">
      {trail.length>0&&<ul className="ds-trail">{trail.map(function(v,i){return <li key={i}>{v}</li>;})}</ul>}
    </div>
  );}

  // SUBMIT SCREEN
  if(!stap){
    var isGep=cd.uitkomst==='Same day gepland'||cd.uitkomst==='Next day gepland'||cd.uitkomst==='Same day visit gepland'||cd.uitkomst==='Next day visit gepland'||cd.ks_uitkomst==='Same day gepland'||cd.ks_uitkomst==='Next day gepland';
    var cat=DS.berekenCategorie(cd);
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
        <Header/><StageBanner/><OrderCard/>
        <div className="ds-body">
          <ProductChip/>
          {cd.bellerType==='CBF'&&cd.locatie==='Vraag voor het depot'&&<div className="ds-note is-info"><div><strong>Advies aan de fietser</strong><br/>Voor deze vraag dient de fietser contact op te nemen met het depot.</div></div>}
          {cd.probleem==='Verkeerd gelabeld product'&&<div className="ds-note is-info"><div><strong>Instructie voor de Held</strong><br/>Kies in Jerney voor "Verkeerd gelabeld product". Neem het product mee terug naar het depot.</div></div>}
          {cd.onderweg_type==='Adres klopt niet'&&<div className="ds-note is-info"><div><strong>Instructie voor de Held</strong><br/>Geef aan in Jerney dat het adres niet klopt. Noteer het correcte adres in het opmerkingenveld.</div></div>}
          {cd.onderweg_type==='Klant niet thuis'&&<div className="ds-note is-info"><div><strong>Check of de held deze stappen heeft doorlopen:</strong><br/>\u{1f514} Aangebeld · \u{1f4de} Klant gebeld · \u{1f550} Binnen tijdvak<br/><strong>Afmelden in Jerney:</strong> kies "Klant niet thuis", maak foto van de voordeur.</div></div>}
          {cd.bellerType==='Andere beller'&&<div className="ds-note is-info"><div><strong>Andere beller</strong><br/>Dit gesprek gaat niet over een bezorging. Loggen is voldoende.</div></div>}
          {isGep&&<div className="ds-note is-info"><div><strong>✓ Check voor het plannen</strong><br/>\u{1f4e6} Kan het product bij de klant blijven?{cd.uitkomst==='Same day gepland'&&<span><br/>\u{1f3e0} Is de klant later vandaag nog thuis?</span>}</div></div>}
          <div className="ds-summary">
            <div className="ds-summary__head"><div className="ds-summary__cat">{cat}</div><div className="ds-pill is-ok">✓ Klaar</div></div>
            {cd.bellerType&&<div className="ds-srow"><span>Beller</span><strong>{cd.bellerType}</strong></div>}
            {cd.locatie&&<div className="ds-srow"><span>Locatie</span><strong>{cd.locatie}</strong></div>}
            {(cd.tl_reden||cd.probleem)&&<div className="ds-srow"><span>Taak</span><strong>{cd.tl_reden||cd.probleem}</strong></div>}
            {(cd.uitkomst||cd.ks_uitkomst||cd.tl_uitkomst)&&<div className="ds-srow"><span>Uitkomst</span><strong>{cd.uitkomst||cd.ks_uitkomst||cd.tl_uitkomst}</strong></div>}
            {cd.geplandeRoute&&<div className="ds-srow"><span>Route</span><strong>{cd.geplandeRoute}</strong></div>}
          </div>
          {logDone?<div className="ds-note is-ok"><div><strong>✓ Gelogd!</strong><br/>Het gesprek is opgeslagen in het logboek.</div></div>:(
            <div className="ds-actions">
              {isGep?(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                  <button className="ds-btn ds-btn--lg" onClick={function(){DS.kopieerNaarKlembord(cd);}}>Klembord</button>
                  <button className="ds-btn ds-btn--secondary ds-btn--lg" onClick={function(){fetch(DS.GAS_URL+DS.bouwLogParams(cd)).catch(function(){});setLogDone(true);}}>Loggen</button>
                  <button className="ds-btn ds-btn--primary ds-btn--lg" onClick={function(){DS.kopieerNaarKlembord(cd);fetch(DS.GAS_URL+DS.bouwLogParams(cd)).catch(function(){});setLogDone(true);}}>Loggen + Klembord</button>
                </div>
              ):(
                <button className="ds-btn ds-btn--secondary ds-btn--lg" style={{width:'100%'}} onClick={function(){fetch(DS.GAS_URL+DS.bouwLogParams(cd)).catch(function(){});setLogDone(true);}}>✓ Loggen</button>
              )}
            </div>
          )}
        </div>
        <div className="ds-footer">{canBack&&<button className="ds-btn ds-btn--ghost" onClick={goBack}>← Terug</button>}<span className="ds-hint">DS Logboek STAGING</span></div>
      </div>
    );
  }

  // STEP BODY
  var stepBody;
  if(stap.type==='beller-select'){
    stepBody=(
      <div className="ds-stack">
        <div className="ds-callergrid">
          <button className="ds-opt is-big" onClick={function(){ans('bellerType','CBB');}}><div className="ds-opt__icon">\u{1f69a}</div><span className="ds-opt__label">CBB — Bezorger belt</span></button>
          <button className="ds-opt" onClick={function(){ans('bellerType','CBF');}}><div className="ds-opt__icon">\u{1f6b2}</div><span className="ds-opt__label">CBF — Fietser belt</span></button>
          <button className="ds-opt" onClick={function(){ans('bellerType','Anders',{locatie:'Klantenservice'},['locatie']);}}><span className="ds-opt__label">Klantenservice belt</span></button>
          <button className="ds-opt" onClick={function(){ans('bellerType','Anders',{locatie:'Winkel'},['locatie']);}}><span className="ds-opt__label">Winkel belt</span></button>
          <button className="ds-opt" onClick={function(){ans('bellerType','Teamleider');}}><span className="ds-opt__label">Teamleider belt</span></button>
        </div>
        <details className="ds-disclose" onToggle={function(e){if(e.target.open)e.target.scrollIntoView({behavior:'smooth',block:'nearest'});}}><summary>Andere bellers ▾</summary>
          <div className="ds-stack" style={{paddingTop:8}}>
            {['Technische Dienst','Yeply','G4S'].map(function(loc){return(
              <button key={loc} className="ds-opt" onClick={function(){ans('bellerType','Andere beller',{locatie:loc},['locatie']);}}>
                <span className="ds-opt__label">{loc}</span>
              </button>
            );})}
            <button className="ds-opt" onClick={function(){ans('bellerType','Andere beller');}}><span className="ds-opt__label">Andere beller (niet over bezorging)</span></button>
          </div>
        </details>
      </div>
    );
  }else if(stap.type==='locatie-select'){
    stepBody=(
      <div className="ds-stack">
        {(stap.opties||[]).map(function(o){return <button key={o} className="ds-opt" onClick={function(){handleSelect(o);}}><span className="ds-opt__label">{o}</span></button>;})}
        <details className="ds-disclose" onToggle={function(e){if(e.target.open)e.target.scrollIntoView({behavior:'smooth',block:'nearest'});}}><summary>Afhandeling buiten DS ▾</summary>
          <div className="ds-stack" style={{paddingTop:8}}>
            {['Product niet aanwezig','Klant moet KS bellen','Held moet dit bij afmelden regelen met TL','Verkeerd gelabeld product','Overig'].map(function(o){return(
              <button key={o} className="ds-opt" onClick={function(){ans('afwijkend_reden',o,{locatie:'Afhandeling buiten DS'},['locatie'],[],['probleem','product','formaatTV','milieuretour_type','uitkomst','geplandeRoute','next_day_reden','geen_oplossing_reden','advies_gelukt','product_keuze']);}}>
                <span className="ds-opt__label">{o}</span>
              </button>
            );})}
          </div>
        </details>
      </div>
    );
  }else if(stap.type==='cbf-locatie-select'){
    stepBody=(
      <div className="ds-stack">
        {(stap.opties||[]).map(function(o){return <button key={o} className="ds-opt" onClick={function(){handleSelect(o);}}><span className="ds-opt__label">{o}</span></button>;})}
        <details className="ds-disclose" onToggle={function(e){if(e.target.open)e.target.scrollIntoView({behavior:'smooth',block:'nearest'});}}><summary>Advies gegeven ▾</summary>
          <div className="ds-stack" style={{paddingTop:8}}>
            <button className="ds-opt" onClick={function(){ans('advies_gelukt','Ja, service uitgevoerd',{onderweg_type:'Advies gegeven',locatie:'Onderweg'},['locatie','onderweg_type']);}}>
              <span className="ds-opt__label">Ja, service alsnog uitgevoerd vandaag</span>
            </button>
            <button className="ds-opt" onClick={function(){ans('advies_gelukt','Nee, geen oplossing door DS',{onderweg_type:'Advies gegeven',locatie:'Onderweg'},['locatie','onderweg_type']);}}>
              <span className="ds-opt__label">Nee, service ook met advies niet uitgevoerd</span>
            </button>
          </div>
        </details>
      </div>
    );
  }else if(stap.type==='dienst-select'){
    stepBody=(
      <div className="ds-stack">
        <div className="ds-note is-info"><div><strong>Nazorg</strong> is gratis en hoort bij de originele bestelling.<br/><strong>Extra dienst</strong> brengt extra kosten met zich mee voor de klant.</div></div>
        <button className="ds-opt" onClick={function(){handleSelect('Nazorg (gratis)');}}><span className="ds-opt__label">Nazorg (gratis)</span><span className="ds-opt__sub is-ok">Gratis</span></button>
        <button className="ds-opt" onClick={function(){handleSelect('Extra dienst (betaald)');}}><span className="ds-opt__label">Extra dienst (betaald)</span><span className="ds-opt__sub is-warn">Betaald</span></button>
      </div>
    );
  }else if(stap.type==='text'||stap.type==='route-input'){
    var routeAlias=stap.type==='route-input'&&textVal?DS.parseToTourAlias(textVal):'';
    var rParts=routeAlias&&routeAlias.includes('-')?routeAlias.split('-'):[];
    stepBody=(
      <div className="ds-stack">
        {stap.type==='route-input'&&<div className="ds-note is-warn"><div><strong>Vermeld altijd:</strong> netwerk · depot · routenummer<br/><span style={{fontSize:11}}>Bijv. 2M Rotterdam 3</span></div></div>}
        <div className="ds-field">
          <input ref={inputRef} className={stap.type==='route-input'?'ds-input is-route':'ds-input'} type="text" value={textVal} onChange={function(e){setTextVal(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter'&&textVal.trim())handleSelect(textVal.trim());}} placeholder="Typ hier..." autoFocus/>
        </div>
        {stap.type==='route-input'&&rParts.length===3&&<div className="ds-route-preview"><div><span>Netwerk</span><strong>{rParts[0]}</strong></div><div><span>Depot</span><strong>{rParts[1]}</strong></div><div><span>Route nr</span><strong>{rParts[2]}</strong></div></div>}
        {stap.type==='route-input'&&<button className="ds-btn" style={{alignSelf:'flex-start'}} onClick={function(){ans('geplandeRoute','Next Day');}}>Next Day</button>}
        <button className="ds-btn ds-btn--primary" disabled={!textVal.trim()} onClick={function(){if(textVal.trim())handleSelect(textVal.trim());}}>Volgende</button>
      </div>
    );
  }else if(stap.type==='text-warning'){
    stepBody=(
      <div className="ds-stack">
        <button className="ds-opt" onClick={function(){handleSelect('Product kan niet bij de klant blijven');}}><span className="ds-opt__label">Product kan niet bij de klant blijven</span></button>
        <div className="ds-note is-warn"><div><strong>⚠ Reminder:</strong> het is de bedoeling dat DS altijd een oplossing plant. Noteer hieronder waarom dat nu niet is gebeurd.</div></div>
        <input ref={inputRef} className="ds-input" type="text" value={textVal} onChange={function(e){setTextVal(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter'&&textVal.trim())handleSelect(textVal.trim());}} placeholder="Typ hier de reden..." autoFocus/>
        <button className="ds-btn ds-btn--primary" disabled={!textVal.trim()} onClick={function(){if(textVal.trim())handleSelect(textVal.trim());}}>Volgende</button>
      </div>
    );
  }else if(stap.type==='product-multi'){
    stepBody=(
      <div className="ds-stack">
        {(stap.opties||[]).map(function(o){
          var sel=multiSel.includes(o);
          return(
            <button key={o} className={sel?'ds-opt is-selected':'ds-opt'} onClick={function(){setMultiSel(function(p){return p.includes(o)?p.filter(function(x){return x!==o;}):[].concat(p,[o]);});}}>
              <span className="ds-opt__label">{o}</span>
              {sel&&<span className="ds-opt__sub is-ok">✓</span>}
            </button>
          );
        })}
        <button className="ds-btn ds-btn--primary ds-btn--lg" disabled={multiSel.length===0} onClick={function(){
          var idxs=multiSel.map(function(label){return stap.opties?stap.opties.indexOf(label):-1;});
          var origNamen=idxs.map(function(i,ii){return i>=0?alleProds[i]:multiSel[ii];});
          var eersteNaam=origNamen[0]||'';
          var det3=DS.detecteerType(eersteNaam),pr3=det3&&det3.typeGuess?det3.typeGuess.charAt(0).toUpperCase()+det3.typeGuess.slice(1):'';
          var nl3=eersteNaam.toLowerCase();if(!pr3&&(nl3.includes('tv')||nl3.includes('televisie')||nl3.match(/(oled|qled)/)))pr3='Televisie';
          var ex3={model:origNamen.join(', '),product_keuze:multiSel.join(', ')},ak3=['product_keuze'],afk3=[];
          if(pr3){ex3.product=pr3;ak3.push('product');afk3.push('product');}
          if(pr3==='Televisie'){var tvM3=eersteNaam.toLowerCase().match(/(?:qe|oled|kd|xr|ue|gq|tx-)?([4-8]\\d)[a-z]/i)||eersteNaam.toLowerCase().match(/\\b([4-8]\\d)\\s?(inch|")\\b/i);if(tvM3){ex3.formaatTV=parseInt(tvM3[1])>=55?'Ja (>= 55 inch)':'Nee (< 55 inch)';ak3.push('formaatTV');afk3.push('formaatTV');}}
          ans('product_keuze',multiSel.join(', '),ex3,ak3,afk3);
        }}>Volgende ({multiSel.length} geselecteerd)</button>
        <div className="ds-note is-info"><div>Geldt het probleem voor meerdere producten? Klik ze dan allemaal aan.</div></div>
      </div>
    );
  }else if(stap.type==='product-type-keuze'){
    var ptOpties=['Wasmachine','Wasdroogcombinatie','Droger','Koelkast / Vriezer','Vaatwasser','Oven / Magnetron','Kookplaat','Televisie','Soundbar','Overig'];
    stepBody=(
      <div className="ds-stack">
        {cd.model&&<div className="ds-note is-info"><div><strong>Gescand model:</strong> {cd.model}</div></div>}
        <div className="ds-grid2">
          {ptOpties.map(function(o){return <button key={o} className="ds-opt" onClick={function(){handleSelect(o);}}><span className="ds-opt__label">{o}</span></button>;})}
        </div>
      </div>
    );
  }else{
    stepBody=(
      <div className="ds-stack">
        {(stap.opties||[]).map(function(o){return <button key={o} className="ds-opt" onClick={function(){handleSelect(o);}}><span className="ds-opt__label">{o}</span></button>;})}
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <Header/><StageBanner/><OrderCard/>
      <div className="ds-body">
        <ProductChip/>
        <StepHead/>
        <div>
          <div className="ds-h4">{stap.label}</div>
          {stepBody}
        </div>
      </div>
      <div className="ds-footer">{canBack&&<button className="ds-btn ds-btn--ghost" onClick={goBack}>← Terug</button>}<span className="ds-hint">STAGING</span></div>
    </div>
  );
}

const root=ReactDOM.createRoot(document.getElementById('ds-logboek-staging-root'));
root.render(<App/>);
`;

    try {
      const compiled = window.Babel.transform(JSX_SOURCE, { presets: ["react"] }).code;
      // eslint-disable-next-line no-new-func
      new Function("React", "ReactDOM", "DS", compiled)(window.React, window.ReactDOM, DS);
      console.log("[DS Logboek staging] mounted v" + STAGING_VERSION);
    } catch(err) {
      console.error("[DS Logboek staging] mount failed:", err);
      rootEl.innerHTML = '<div style="padding:16px;color:#b8243a;font:13px sans-serif">DS Logboek staging — mount failed. Zie console.</div>';
    }
  }

  // ── POLLING ───────────────────────────────────────────────────
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
        if (lbl && (lbl.textContent.trim()==='Pakbonnummer'||lbl.textContent.trim()==='Order nr. verlader')) { orderReady=true; break; }
      }
    }
    pollCount++;
    if (orderReady || pollCount >= 30) {
      clearInterval(pollInterval);
      var scraped = doScrape();
      boot(scraped).catch(function(err){ console.error("[DS Logboek staging] boot failed:", err); });
    }
  }, 100);

  window.addEventListener('resize', function() {
    var r = document.getElementById(ROOT_ID);
    if (r) r.style.maxHeight = 'calc('+window.innerHeight+'px - 32px)';
  });
})();
