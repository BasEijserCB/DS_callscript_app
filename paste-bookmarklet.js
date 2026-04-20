javascript:(async function(){
try {
  const clipboardText = await navigator.clipboard.readText();
  const orderData = JSON.parse(clipboardText);
  if (!orderData.time || (Date.now() - orderData.time) > 300000) {
    await navigator.clipboard.writeText('');
    return;
  }

  // ── DEVEXTREME HELPER ─────────────────────────────────────────
  const setDxDropdown = (fieldId, fieldValue) => {
    const input = document.querySelector(`input[id$="${fieldId}"]`);
    if (!input) return;
    const container = input.closest('.dx-selectbox');
    if (!container) return;
    const instance = $(container).dxSelectBox('instance');
    if (instance) instance.option('value', fieldValue);
  };

  const setDxTagBox = (fieldId, valueArray) => {
    const input = document.querySelector(`input[id$="${fieldId}"]`);
    if (!input) return;
    const container = input.closest('.dx-tagbox');
    if (!container) return;
    const instance = $(container).dxTagBox('instance');
    if (instance) instance.option('value', valueArray);
  };

  const isSameDay = (orderData.uitkomst || '').toLowerCase().includes('same day');

  function normaliseerProbleem(p) {
    if (p.includes('trekschakelaar'))              return 'trekschakelaar';
    if (p.includes('stapelkit'))                   return 'stapelkit';
    if (p.includes('milieuretour') || p.includes('pick-up')) return 'milieuretour';
    if (p.includes('inbouwen') || p.includes('inbouw'))      return 'inbouwen';
    if (p.includes('frontpaneel'))                 return 'frontpaneel';
    if (p.includes('deur omdraaien'))              return 'deur omdraaien';
    if (p.includes('plaatsen') || p.includes('tillen')) return 'plaatsen';
    if (p.includes('aansluiting') || p.includes('aansluiten en plaatsen')) return 'aansluiting';
    if (p.includes('tv + soundbar') && (p.includes('ophang') || p.includes('hangen'))) return 'tv + soundbar ophang';
    if (p.includes('tv + soundbar'))               return 'tv + soundbar';
    if (p.includes('tv ophangen') || (p.includes('tv') && p.includes('ophangen'))) return 'tv ophangen';
    if (p.includes('tv installeren') || p.includes('tv aansluiten')) return 'tv installeren';
    return null;
  }
  function normaliseerProduct(p) {
    p = p.toLowerCase();
    if (p.includes('was-droog') || p.includes('wasdroog')) return 'wasdroogcombinatie';
    if (p.includes('wasmachine'))                   return 'wasmachine';
    if (p.includes('droger') || p.includes('droog')) return 'droger';
    if (p.includes('amerikaanse') && p.includes('water')) return 'amerikaanse koelkast met waterdispenser';
    if (p.includes('amerikaanse'))                  return 'amerikaanse koelkast';
    if (p.includes('side') || p.includes('side-by-side')) return 'side-by-side koelkast';
    if (p.includes('inbouw koelkast') || p.includes('inbouw koel')) return 'inbouw koelkast';
    if (p.includes('inbouw vriezer'))               return 'inbouw vriezer';
    if (p.includes('koelkast') || p.includes('vriezer') || p.includes('koel-vries')) return 'koelkast';
    if (p.includes('inbouw vaatwasser'))            return 'inbouw vaatwasser';
    if (p.includes('vrijstaande vaatwasser') || p.includes('vaatwasser')) return 'vrijstaande vaatwasser';
    if (p.includes('inbouw magnetron'))             return 'inbouw magnetron';
    if (p.includes('inbouw oven'))                  return 'inbouw oven';
    if (p.includes('magnetron'))                    return 'magnetron';
    if (p.includes('oven'))                         return 'inbouw oven';
    if (p.includes('televisie') || p.includes('tv')) return 'televisie';
    if (p.includes('soundbar'))                     return 'soundbar';
    if (p.includes('stapelkit'))                    return 'stapelkit';
    return null;
  }

  // ── STAP 1: SJABLOON EERST (zodat het geen velden overschrijft) ──
  if (orderData.dienstType && !isSameDay) {
    const land    = orderData.detectedCountry;
    const product = (orderData.product || '').toLowerCase();
    const probleem = (orderData.probleem || '').toLowerCase();
    const dienst  = orderData.dienstType;
    const isNazorg = dienst === 'Nazorg (gratis)';
    const groot   = orderData.formaatTV === 'Ja (>= 55 inch)';
    const sjablonen = {
      'Nederland': {
        'wasmachine': {
          'trekschakelaar':  {N:'1714235', E:'1714242'},
          'plaatsen':        {N:'1714165', E:'1723925'},
          'aansluiting':     {N:'1714225', E:'1723925'},
          'inbouwen':        {N:'1714279', E:'1714331'},
          'stapelkit':       {N:'1714345', E:'1714352'},
          'milieuretour':    {N:'1714166', E:'1714221'},
          'deur omdraaien':  {N:'1714235', E:'1714242'}, // geen eigen sjabloon, valt terug op aansluiting
        },
        'wasdroogcombinatie': {
          'trekschakelaar':  {N:'1714812', E:'1714814'},
          'plaatsen':        {N:'1714802', E:'1723929'},
          'aansluiting':     {N:'1714809', E:'1723929'},
          'inbouwen':        {N:'1714816', E:'1714817'},
          'stapelkit':       {N:'1714812', E:'1714817'}, // geen eigen nazorg stapelkit
          'milieuretour':    {N:'1714805', E:'1714807'},
          'deur omdraaien':  {N:'1714812', E:'1714815'},
        },
        'droger': {
          'trekschakelaar':  {N:'1714544', E:'1714545'},
          'plaatsen':        {N:'1714537', E:'1723927'},
          'aansluiting':     {N:'1714540', E:'1723927'},
          'inbouwen':        {N:'1714547', E:'1714548'},
          'stapelkit':       {N:'1714549', E:'1714550'},
          'milieuretour':    {N:'1714538', E:'1714539'},
          'deur omdraaien':  {N:'1714546', E:'1714546'}, // alleen extra dienst, gebruik die ook voor nazorg
        },
        'koelkast': {
          'plaatsen':        {N:'1965690', E:'1965691'},
          'aansluiting':     {N:'1965690', E:'1965691'},
          'deur omdraaien':  {N:'1965700', E:'1965700'}, // geen nazorg variant, gebruik extra dienst
          'milieuretour':    {N:'1967581', E:'1967578'},
          'inbouwen':        {N:'1965690', E:'1965691'},
        },
        'vriezer': {
          'plaatsen':        {N:'1966711', E:'1966712'},
          'aansluiting':     {N:'1966711', E:'1966712'},
          'deur omdraaien':  {N:'1966714', E:'1966714'},
          'milieuretour':    {N:'1979141', E:'1979140'},
        },
        'amerikaanse koelkast': {
          'plaatsen':        {N:'1966730', E:'1966729'},
          'aansluiting':     {N:'1966730', E:'1966729'},
          'deur omdraaien':  {N:'1966730', E:'1966729'},
          'milieuretour':    {N:'1979162', E:'1979161'},
        },
        'amerikaanse koelkast met waterdispenser': {
          'plaatsen':        {N:'1966732', E:'1966733'},
          'aansluiting':     {N:'1966732', E:'1966733'},
          'milieuretour':    {N:'1979162', E:'1979161'},
        },
        'side-by-side koelkast': {
          'plaatsen':        {N:'1967550', E:'1967551'},
          'aansluiting':     {N:'1967550', E:'1967551'},
          'milieuretour':    {N:'1967581', E:'1967578'}, // gebruik gewone koelkast milieuretour
        },
        'inbouw koelkast': {
          'inbouwen':        {N:'1939895', E:'1939896'},
          'frontpaneel':     {N:'1965672', E:'1939896'},
          'milieuretour':    {N:'1967581', E:'1967578'}, // geen eigen, gebruik koelkast
        },
        'inbouw vriezer': {
          'inbouwen':        {N:'1939895', E:'1939896'}, // geen eigen, gebruik inbouw koelkast
          'milieuretour':    {N:'1979141', E:'1979140'},
        },
        'vrijstaande vaatwasser': {
          'plaatsen':        {N:'1965653', E:'1965654'},
          'aansluiting':     {N:'1965653', E:'1965654'},
          'milieuretour':    {N:'2180321', E:'2180324'},
          'inbouwen':        {N:'1965653', E:'1965654'},
        },
        'inbouw vaatwasser': {
          'inbouwen':        {N:'1939852', E:'1939853'},
          'frontpaneel':     {N:'1939854', E:'1939853'},
          'milieuretour':    {N:'2180316', E:'2180319'},
          'aansluiting':     {N:'1939852', E:'1939853'},
        },
        'inbouw oven': {
          'inbouwen':        {N:'1966751', E:'1966752'},
          'aansluiting':     {N:'1966751', E:'1966752'},
        },
        'inbouw magnetron': {
          'inbouwen':        {N:'1967562', E:'1967563'},
          'aansluiting':     {N:'1967562', E:'1967563'},
        },
        'magnetron': {
          'milieuretour':    {N:'1979158', E:'1979156'},
        },
        'televisie': {
          'tv installeren':      {N: groot ? '1939669' : '1939670', E: groot ? '1939678' : '1939676'},
          'tv ophangen':         {N: groot ? '1939696' : '1939695', E: groot ? '1939698' : '1939697'},
          'tv + soundbar':       {N: groot ? '1939822' : '1939817', E: groot ? '1939823' : '1939818'},
          'tv + soundbar ophang':{N: groot ? '1939824' : '1939819', E: groot ? '1939825' : '1939821'},
          'milieuretour':        {N:'1979147', E:'1979146'},
        },
        'soundbar': {
          'tv + soundbar':       {N:'1939802', E:'1939804'},
          'tv + soundbar ophang':{N:'1939802', E:'1939804'},
          'milieuretour':        {N:'1979147', E:'1979146'},
        },
        'stapelkit': {
          'stapelkit':           {N:'1714933', E:'1714934'},
        },
      },

      'België': {
        'wasmachine': {
          'trekschakelaar':  {N:'1714950', E:'1714953'},
          'plaatsen':        {N:'1714939', E:'1723930'},
          'aansluiting':     {N:'1714942', E:'1723930'},
          'inbouwen':        {N:'1714959', E:'1714960'},
          'stapelkit':       {N:'1714961', E:'1714962'},
          'milieuretour':    {N:'1714940', E:'1714941'},
          'deur omdraaien':  {N:'1714957', E:'1714957'},
        },
        'wasdroogcombinatie': {
          'trekschakelaar':  {N:'1714987', E:'1714988'},
          'plaatsen':        {N:'1714979', E:'1723934'},
          'aansluiting':     {N:'1714984', E:'1723934'},
          'inbouwen':        {N:'1714990', E:'1714992'},
          'milieuretour':    {N:'1714982', E:'1714983'},
          'deur omdraaien':  {N:'1714987', E:'1714989'},
        },
        'droger': {
          'trekschakelaar':  {N:'1714971', E:'1714972'},
          'plaatsen':        {N:'1714964', E:'1723932'},
          'aansluiting':     {N:'1714967', E:'1723932'},
          'inbouwen':        {N:'1714974', E:'1714975'},
          'stapelkit':       {N:'1714976', E:'1714978'},
          'milieuretour':    {N:'1714965', E:'1714966'},
          'deur omdraaien':  {N:'1714973', E:'1714973'},
        },
        'koelkast': {
          'plaatsen':        {N:'1965694', E:'1965695'},
          'aansluiting':     {N:'1965694', E:'1965695'},
          'deur omdraaien':  {N:'1965701', E:'1965701'},
          'milieuretour':    {N:'1967583', E:'1967582'},
          'inbouwen':        {N:'1965694', E:'1965695'},
        },
        'vriezer': {
          'plaatsen':        {N:'1966718', E:'1966719'},
          'aansluiting':     {N:'1966718', E:'1966719'},
          'deur omdraaien':  {N:'1966720', E:'1966720'},
          'milieuretour':    {N:'1979143', E:'1979142'},
        },
        'amerikaanse koelkast': {
          'plaatsen':        {N:'1966743', E:'1966742'},
          'aansluiting':     {N:'1966743', E:'1966742'},
          'deur omdraaien':  {N:'1966743', E:'1966742'},
          'milieuretour':    {N:'1979164', E:'1979163'},
        },
        'amerikaanse koelkast met waterdispenser': {
          'plaatsen':        {N:'1966745', E:'1966747'},
          'aansluiting':     {N:'1966745', E:'1966747'},
          'milieuretour':    {N:'1979164', E:'1979163'},
        },
        'side-by-side koelkast': {
          'plaatsen':        {N:'1967553', E:'1967554'},
          'aansluiting':     {N:'1967553', E:'1967554'},
          'milieuretour':    {N:'1967583', E:'1967582'},
        },
        'inbouw koelkast': {
          'inbouwen':        {N:'1939897', E:'1939898'},
          'frontpaneel':     {N:'1965673', E:'1939898'},
          'milieuretour':    {N:'1967583', E:'1967582'},
        },
        'inbouw vriezer': {
          'inbouwen':        {N:'1939897', E:'1939898'},
          'milieuretour':    {N:'1979143', E:'1979142'},
        },
        'vrijstaande vaatwasser': {
          'plaatsen':        {N:'1965658', E:'1965659'},
          'aansluiting':     {N:'1965658', E:'1965659'},
          'milieuretour':    {N:'2180297', E:'2180298'},
          'inbouwen':        {N:'1965658', E:'1965659'},
        },
        'inbouw vaatwasser': {
          'inbouwen':        {N:'1939855', E:'1939856'},
          'frontpaneel':     {N:'1939857', E:'1939856'},
          'milieuretour':    {N:'2180295', E:'2180296'},
          'aansluiting':     {N:'1939855', E:'1939856'},
        },
        'inbouw oven': {
          'inbouwen':        {N:'1966753', E:'1966754'},
          'aansluiting':     {N:'1966753', E:'1966754'},
        },
        'inbouw magnetron': {
          'inbouwen':        {N:'1967564', E:'1967565'},
          'aansluiting':     {N:'1967564', E:'1967565'},
        },
        'magnetron': {
          'milieuretour':    {N:'1979160', E:'1979159'},
        },
        'televisie': {
          'tv installeren':      {N: groot ? '1939682' : '1939681', E: groot ? '1939685' : '1939683'},
          'tv ophangen':         {N: groot ? '1939700' : '1939701', E: groot ? '1939702' : '1939699'},
          'tv + soundbar':       {N: groot ? '1939830' : '1939826', E: groot ? '1939831' : '1939827'},
          'tv + soundbar ophang':{N: groot ? '1939832' : '1939828', E: groot ? '1939833' : '1939829'},
          'milieuretour':        {N:'1979149', E:'1979148'},
        },
        'soundbar': {
          'tv + soundbar':       {N:'1939811', E:'1939812'},
          'tv + soundbar ophang':{N:'1939811', E:'1939812'},
          'milieuretour':        {N:'1979149', E:'1979148'},
        },
        'stapelkit': {
          'stapelkit':           {N:'1714997', E:'1714996'},
        },
      },

      'Duitsland': {
        'wasmachine': {
          'trekschakelaar':  {N:'1939616', E:'1939620'},
          'plaatsen':        {N:'1939611', E:'1939610'},
          'aansluiting':     {N:'1939613', E:'1939610'},
          'inbouwen':        {N:'1939649', E:'1939650'},
          'stapelkit':       {N:'1939651', E:'1939652'},
          'milieuretour':    {N:'1939611', E:'1939612'},
          'deur omdraaien':  {N:'1939647', E:'1939647'},
        },
        'wasdroogcombinatie': {
          'trekschakelaar':  {N:'2106002', E:'2106003'},
          'plaatsen':        {N:'2105973', E:'2063096'},
          'aansluiting':     {N:'2105987', E:'2063096'},
          'inbouwen':        {N:'2106007', E:'2106008'},
          'milieuretour':    {N:'2105973', E:'2105975'},
          'deur omdraaien':  {N:'2106005', E:'2106005'},
        },
        'droger': {
          'trekschakelaar':  {N:'2062567', E:'2062577'},
          'plaatsen':        {N:'2062539', E:'2062534'},
          'aansluiting':     {N:'2062547', E:'2062534'},
          'inbouwen':        {N:'2062632', E:'2062635'},
          'stapelkit':       {N:'2062657', E:'2063093'},
          'milieuretour':    {N:'2062539', E:'2062543'},
          'deur omdraaien':  {N:'2062579', E:'2062579'},
        },
        'koelkast': {
          'plaatsen':        {N:'2106149', E:'2106150'},
          'aansluiting':     {N:'2106149', E:'2106150'},
          'deur omdraaien':  {N:'2106151', E:'2106151'},
          'milieuretour':    {N:'2106171', E:'2106170'},
          'inbouwen':        {N:'2106149', E:'2106150'},
        },
        'vriezer': {
          'plaatsen':        {N:'2106153', E:'2106154'},
          'aansluiting':     {N:'2106153', E:'2106154'},
          'deur omdraaien':  {N:'2106155', E:'2106155'},
          'milieuretour':    {N:'2106173', E:'2106172'},
        },
        'amerikaanse koelkast': {
          'plaatsen':        {N:'2106159', E:'2106158'},
          'aansluiting':     {N:'2106159', E:'2106158'},
          'deur omdraaien':  {N:'2106159', E:'2106158'},
          'milieuretour':    {N:'2106179', E:'2106178'},
        },
        'amerikaanse koelkast met waterdispenser': {
          'plaatsen':        {N:'2106161', E:'2106162'},
          'aansluiting':     {N:'2106161', E:'2106162'},
          'milieuretour':    {N:'2106179', E:'2106178'},
        },
        'side-by-side koelkast': {
          'plaatsen':        {N:'2106163', E:'2106164'},
          'aansluiting':     {N:'2106163', E:'2106164'},
          'milieuretour':    {N:'2106171', E:'2106170'},
        },
        'inbouw koelkast': {
          'inbouwen':        {N:'2106142', E:'2106143'},
          'frontpaneel':     {N:'2106145', E:'2106143'},
          'milieuretour':    {N:'2106171', E:'2106170'},
        },
        'inbouw vriezer': {
          'inbouwen':        {N:'2106142', E:'2106143'},
          'milieuretour':    {N:'2106173', E:'2106172'},
        },
        'vrijstaande vaatwasser': {
          'plaatsen':        {N:'2106146', E:'2106147'},
          'aansluiting':     {N:'2106146', E:'2106147'},
          'milieuretour':    {N:'2156780', E:'2156781'},
          'inbouwen':        {N:'2106146', E:'2106147'},
        },
        'inbouw vaatwasser': {
          'inbouwen':        {N:'2106137', E:'2106138'},
          'frontpaneel':     {N:'2106139', E:'2106138'},
          'milieuretour':    {N:'2156778', E:'2156779'},
          'aansluiting':     {N:'2106137', E:'2106138'},
        },
        'inbouw oven': {
          'inbouwen':        {N:'2106165', E:'2106166'},
          'aansluiting':     {N:'2106165', E:'2106166'},
        },
        'inbouw magnetron': {
          'inbouwen':        {N:'2106167', E:'2106168'},
          'aansluiting':     {N:'2106167', E:'2106168'},
        },
        'magnetron': {
          'milieuretour':    {N:'2106177', E:'2106176'},
        },
        'televisie': {
          'tv installeren':      {N:'2106116', E:'2106119'},
          'tv ophangen':         {N:'2106120', E:'2106121'},
          'tv + soundbar':       {N:'2106130', E:'2106131'},
          'tv + soundbar ophang':{N:'2106132', E:'2106133'},
          'milieuretour':        {N:'2106175', E:'2106174'},
        },
        'soundbar': {
          'tv + soundbar':       {N:'2106126', E:'2106127'},
          'tv + soundbar ophang':{N:'2106126', E:'2106127'},
          'milieuretour':        {N:'2106175', E:'2106174'},
        },
        'stapelkit': {
          'stapelkit':           {N:'2106009', E:'2106011'},
        },
      },
    };
    const landData   = sjablonen[land];
    const productKey = normaliseerProduct(product);
    const probleemKey = normaliseerProbleem(probleem);
    if (landData && productKey && probleemKey) {
      const productData  = landData[productKey];
      const probleemData = productData && productData[probleemKey];
      if (probleemData) {
        const sjabloonId = isNazorg ? probleemData.N : probleemData.E;
        if (sjabloonId) {
          setDxDropdown('_orderTemplateId', sjabloonId);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    }
  }

  // ── STAP 1b: SAME DAY — AFZENDER + DEPOT ─────────────────────
  if (isSameDay) {
    const depotCodeIds = {
      'NLAL': '2021191', 'NLDE': '696250',  'NLGR': '4885',
      'NLRO': '1721',    'NLTI': '13',       'NLUT': '14',
      'NLVE': '421593',  'NLEI': '56669',    'NLDH': '85705',
      'NLOV': '94515',   'DEDU': '558485',   'DEKE': '1301373',
      'DEHA': '1578843', 'DELA': '1819366',  'DEHM': '1858536',
      'DESC': '2106913', 'DETA': '2009534',  'DENU': '2249404',
      'DEES': '815480',  'BEAN': '18808',    'BEGE': '35210',
      'BENI': '696230',  'BEZA': '231149',   'BEWI': '158831',
    };
    setDxDropdown('_shipperId', '1012729');
    await new Promise(resolve => setTimeout(resolve, 500));
    const routeCode = (orderData.geplandeRoute || '').match(/[A-Z]{4}/)?.[0];
    const depotId = routeCode && depotCodeIds[routeCode];
    if (depotId) {
      setDxDropdown('_depotId', depotId);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // ── STAP 1c: SAME DAY / NEXT DAY PLAATSEN/TILLEN — PRODUCT RIJ TOEVOEGEN ─
  const productsToAdd = orderData.products || (orderData.product ? [orderData.product] : []);
  const isPlaatstService = (orderData.probleem || '').toLowerCase().match(/plaatsen|tillen/) || (orderData.serviceTypeId === 51072);
  console.log('[DS] STAP 1c — productsToAdd:', productsToAdd, '| isPlaatstService:', !!isPlaatstService, '| probleem:', orderData.probleem, '| serviceTypeId:', orderData.serviceTypeId);
  if (isPlaatstService && productsToAdd.length > 0) {
    const articleTypeIds = {
      'wasmachine': 133,
      'wasdroogcombinatie': 361,
      'droger': 358,
      'koelkast': 330,
      'vriezer': 352,
      'amerikaanse koelkast': 253782,
      'amerikaanse koelkast met waterdispenser': 253782,
      'side-by-side koelkast': 330,
      'inbouw koelkast': 330,
      'inbouw vriezer': 352,
    };
    for (let pidx = 0; pidx < productsToAdd.length; pidx++) {
      const product = productsToAdd[pidx];
      console.log(`[DS] Product ${pidx}: "${product}"`);
      const addBtn = document.querySelector('.dx-icon-add')?.closest('.dx-button');
      console.log(`[DS]   addBtn:`, addBtn);
      if (addBtn) {
        addBtn.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Click on the article to select it (activates DX form fields for this row)
        const articles = document.querySelectorAll('[data-options*="dxTemplate"][data-options*="article"]');
        console.log(`[DS]   articles.length:`, articles.length, '| expected pidx:', pidx);
        if (articles.length > pidx) {
          articles[pidx].click();
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          console.warn(`[DS]   geen article gevonden op index ${pidx}`);
        }

        // Set code = "1"
        const codeInputs = document.querySelectorAll('input[name="code"]');
        const codeInput = codeInputs[codeInputs.length - 1];
        console.log(`[DS]   codeInputs.length:`, codeInputs.length, '| codeInput:', codeInput);
        if (codeInput) {
          codeInput.focus();
          codeInput.value = '1';
          ['input', 'change', 'blur'].forEach(t => codeInput.dispatchEvent(new Event(t, {bubbles: true})));
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Set articleTypeId based on product (first — changing it may reset services)
        const productKey = normaliseerProduct(product);
        const articleTypeId = productKey && articleTypeIds[productKey];
        console.log(`[DS]   normaliseerProduct("${product}") →`, productKey, '| articleTypeId:', articleTypeId);
        if (articleTypeId) {
          const artInputs = document.querySelectorAll('input[id$="_articleTypeId"]');
          const artInput = artInputs[artInputs.length - 1];
          console.log(`[DS]   artInputs.length:`, artInputs.length, '| artInput id:', artInput?.id);
          if (artInput) {
            const container = artInput.closest('.dx-selectbox');
            const instance = container && $(container).dxSelectBox('instance');
            console.log(`[DS]   articleTypeId SelectBox instance:`, instance);
            if (instance) {
              instance.option('value', articleTypeId);
              await new Promise(resolve => setTimeout(resolve, 400));
              console.log(`[DS]   articleTypeId after set:`, instance.option('value'));
            }
          } else {
            console.warn('[DS]   geen articleTypeId SelectBox input gevonden');
          }
        } else {
          console.warn(`[DS]   geen articleTypeId voor productKey "${productKey}"`);
        }

        // Set services TagBox to plaatsen (51072) last — after articleTypeId settles
        const svcInputs = document.querySelectorAll('input[id$="_services"]');
        const svcInput = svcInputs[svcInputs.length - 1];
        console.log(`[DS]   svcInputs.length:`, svcInputs.length, '| svcInput id:', svcInput?.id);
        if (svcInput) {
          const container = svcInput.closest('.dx-tagbox');
          const instance = container && $(container).dxTagBox('instance');
          console.log(`[DS]   services TagBox instance:`, instance);
          if (instance) {
            instance.option('value', [51072]);
            await new Promise(resolve => setTimeout(resolve, 200));
            console.log(`[DS]   services after set:`, instance.option('value'));
          }
        } else {
          console.warn('[DS]   geen services TagBox input gevonden');
        }
      } else {
        console.warn('[DS]   add-button niet gevonden');
      }
    }
  } else {
    console.log('[DS] STAP 1c overgeslagen — geen plaatsen service of geen producten');
  }

  // ── STAP 2: ADRES SPLITSEN ────────────────────────────────────
  let streetName = orderData.address, houseNumber = '';
  const addressMatch = orderData.address.match(/^(.*?)\s?(\d+.*)$/);
  if (addressMatch) { streetName = addressMatch[1]; houseNumber = addressMatch[2]; }

  // ── STAP 3: STANDAARD VELDEN INVULLEN (na sjabloon) ──────────
  const inputFields = {
    'orderNumberWarehouse': orderData.orderNr,
    'shipperOrderNumber':   orderData.orderNr,
    'name':                 orderData.name,
    'phoneNumber':          orderData.phone,
    'emailAddress':         orderData.email,
    'zipcode':              orderData.zip,
    'street':               streetName,
    'houseNumber':          houseNumber,
    'residence':            orderData.city
  };
  for (const [fieldName, fieldValue] of Object.entries(inputFields)) {
    const inputElement = document.querySelector(`input[name="${fieldName}"]`);
    if (inputElement) {
      inputElement.focus();
      inputElement.value = fieldValue;
      ['input','change','blur'].forEach(eventType =>
        inputElement.dispatchEvent(new Event(eventType, {bubbles: true}))
      );
    }
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  // ── CHECKPOINT A: na STAP 3, vóór countryId ─────────────────
  {
    const a = document.querySelectorAll('input[id$="_articleTypeId"]');
    const s = document.querySelectorAll('input[id$="_services"]');
    const ai = a.length && $(a[a.length-1].closest('.dx-selectbox')).dxSelectBox('instance');
    const si = s.length && $(s[s.length-1].closest('.dx-tagbox')).dxTagBox('instance');
    console.log('[DS] CHECKPOINT A — articleTypeId:', ai?.option('value'), '| services:', si?.option('value'));
  }

  // ── STAP 4: LAND & TAAL ───────────────────────────────────────
  const countryIds = {'Nederland': 1, 'België': 139, 'Duitsland': 427003};
  setDxDropdown('_countryId', countryIds[orderData.detectedCountry]);
  await new Promise(resolve => setTimeout(resolve, 500));
  setDxDropdown('_language', orderData.detectedLanguage);

  // ── CHECKPOINT B: na countryId/taal ──────────────────────────
  {
    const a = document.querySelectorAll('input[id$="_articleTypeId"]');
    const s = document.querySelectorAll('input[id$="_services"]');
    const ai = a.length && $(a[a.length-1].closest('.dx-selectbox')).dxSelectBox('instance');
    const si = s.length && $(s[s.length-1].closest('.dx-tagbox')).dxTagBox('instance');
    console.log('[DS] CHECKPOINT B — articleTypeId:', ai?.option('value'), '| services:', si?.option('value'));
  }

  // ── STAP 4b: SAME DAY — KANAAL / NETWERK / SERVICE ───────────
  if (isSameDay && orderData.serviceTypeId) {
    const builtInServices = [277249, 51068, 322997, 277248, 254509, 254508, 490316, 490317];
    const needsBuiltIn = builtInServices.includes(parseInt(orderData.serviceTypeId));
    if (needsBuiltIn) {
      setDxDropdown('_channelId', 132134);
      await new Promise(resolve => setTimeout(resolve, 800));
      setDxTagBox('_services', [parseInt(orderData.serviceTypeId)]);
      await new Promise(resolve => setTimeout(resolve, 400));
      setDxDropdown('_networkId', 12);
      await new Promise(resolve => setTimeout(resolve, 400));
      setDxDropdown('_channelId', 16);
    } else {
      setDxDropdown('_channelId', 16);
      await new Promise(resolve => setTimeout(resolve, 800));
      setDxDropdown('_networkId', 12);
      await new Promise(resolve => setTimeout(resolve, 400));
      setDxTagBox('_services', [parseInt(orderData.serviceTypeId)]);
    }
  }

  // ── STAP 5: SHOW ON DEVICE ────────────────────────────────────
  const checkbox = document.querySelector('input[name="showOnDevice"]');
  if (checkbox) {
    const container = checkbox.closest('.dx-checkbox');
    if (container) {
      const instance = $(container).dxCheckBox('instance');
      if (instance) instance.option('value', true);
    }
  }


  // ── STAP 6: OPMERKING INVULLEN ───────────────────────────────
  if (orderData.products || orderData.product || orderData.probleem) {
    const remarkForms = document.querySelectorAll('.dx-form');
    if (remarkForms.length > 1) {
      const productText = orderData.products ? orderData.products.join(', ') : orderData.product;
      const remarkText = [productText, orderData.probleem].filter(Boolean).join(' - ');
      const formData = $(remarkForms[1]).dxForm('instance').option('formData');
      if (formData && typeof formData.remark === 'function') {
        formData.remark(remarkText);
      }
    }
  }

  await navigator.clipboard.writeText('');

  // ── CHECKPOINT C: einde, vlak voor toast ─────────────────────
  {
    const a = document.querySelectorAll('input[id$="_articleTypeId"]');
    const s = document.querySelectorAll('input[id$="_services"]');
    const ai = a.length && $(a[a.length-1].closest('.dx-selectbox')).dxSelectBox('instance');
    const si = s.length && $(s[s.length-1].closest('.dx-tagbox')).dxTagBox('instance');
    console.log('[DS] CHECKPOINT C — articleTypeId:', ai?.option('value'), '| services:', si?.option('value'));
  }

  // ── MELDING: CONTROLEER DE INGEVULDE VELDEN ──────────────────
  const toast = document.createElement('div');
  toast.innerHTML = '<b>DS Logboek</b> — Controleer de automatisch ingevulde velden voor je opslaat.';
  toast.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999;background:#1A1A2E;color:#fff;padding:16px 22px;border-radius:8px;font-size:15px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.4);max-width:380px;line-height:1.5;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);

} catch(error) {
  console.log('error:', error);
}
})();
