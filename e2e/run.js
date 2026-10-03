/*
 * Prova end-to-end nel browser vero: apre la pagina, usa strumento, esercizio, link condivisi e caricamento file,
 * controlla accessibilita' di base, tema scuro e versione per telefono, e che la console resti pulita.
 *
 *   npm run e2e                       (serve Chrome, Chromium o Edge; altrimenti imposta CHROME_PATH)
 *   node e2e/run.js --screenshot dir  (salva anche gli screenshot nella cartella indicata)
 *   node e2e/run.js --url https://...  (prova una pagina gia' pubblicata invece di quella locale)
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { avviaBrowser, sessione, sleep } = require('./cdp.js');
const { creaZip } = require('../helpers/zip.js');

const radice = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
const shotDir = process.argv.includes('--screenshot') ? process.argv[process.argv.indexOf('--screenshot') + 1] : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

let falliti = 0, passati = 0;
const verifica = (cond, msg) => { if (cond) { passati++; console.log('  ✓ ' + msg); } else { falliti++; console.log('  ✗ ' + msg); } };
const riga = v => String(v).replace(/\s+/g, ' ').trim();

function server() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      const f = path.join(radice, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
      if (!f.startsWith(radice) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('non trovato'); }
      res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}

const CONTROLLO_ACCESSIBILITA = `(function(){
  var out = {senzaNome:[], idDoppi:[], controlsMancanti:[], labelMancanti:[]};
  var nomeDi = function(el){ return (el.getAttribute('aria-label') || el.textContent || el.value || el.title || '').trim(); };
  document.querySelectorAll('button, a[href], [role=button], summary').forEach(function(el){ if(!nomeDi(el)) out.senzaNome.push(el.outerHTML.slice(0,80)); });
  var visti = {}; document.querySelectorAll('[id]').forEach(function(el){ if (visti[el.id]) out.idDoppi.push(el.id); visti[el.id]=1; });
  document.querySelectorAll('[aria-controls]').forEach(function(el){ if(!document.getElementById(el.getAttribute('aria-controls'))) out.controlsMancanti.push(el.id); });
  document.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, select').forEach(function(el){ var ha = el.getAttribute('aria-label') || (el.id && document.querySelector('label[for="'+el.id+'"]')); if(!ha) out.labelMancanti.push(el.id); });
  return JSON.stringify(out);
})()`;

(async () => {
  const urlArg = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;     // prova una pagina gia' pubblicata
  const srv = urlArg ? null : await server();
  const base = urlArg ? urlArg.replace(/\/?$/, '/') : 'http://127.0.0.1:' + srv.address().port + '/';
  const URL = base + 'index.html';
  const { proc, porta } = await avviaBrowser();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-file-'));
  try {
    const s = await sessione(porta, URL);
    const scatta = async (nome, intera) => { if (shotDir) await s.scatta(path.join(shotDir, nome), intera); };
    await s.misura(1280, 900, false);
    await s.vai(URL);

    console.log('# Strumento');
    verifica((await s.js('document.title')) === 'Controllo Fonti', 'titolo della pagina');
    verifica(!(await s.js('document.getElementById("risultato").hidden')), 'si apre gia\' con un esempio verificato');
    verifica(/6\s*verificati\s*1\s*da controllare\s*3\s*non trovati/.test(riga(await s.js('document.getElementById("riepilogo").innerText'))), 'riepilogo dell\'esempio: 6 / 1 / 3');
    verifica((await s.js('document.querySelectorAll("#fonte-vista mark").length')) >= 1, 'la fonte mostra il passaggio del primo problema');
    await scatta('strumento.png', true);
    await s.js('[...document.querySelectorAll("#evidenziato mark.s-ok")].find(function(x){return x.textContent==="2,4 milioni"}).click()');
    await sleep(300);
    verifica((await s.js('document.querySelector("#fonte-vista mark")?.textContent')) === '2,4 milioni', 'clic su un\'evidenziazione verde: la fonte mostra «2,4 milioni»');
    await s.js('document.querySelector(\'.chip-esempio[data-id="contratto"]\').click()');
    await sleep(300);
    verifica((await s.js('document.querySelectorAll(".scheda-voce").length')) === 3, 'esempio del contratto: tre voci (percentuale, citazione, nome)');
    await s.js('document.querySelector(\'.chip-esempio[data-id="preventivo"]\').click()');
    await sleep(300);
    const elencoPreventivo = await s.js('document.getElementById("elenco").innerText');
    verifica(/2\.720 × 10% = 272/.test(elencoPreventivo) && /eredita l'errore/.test(elencoPreventivo),
      'preventivo: il 272 è spiegato come 2.720 × 10% e si dice che eredita l\'errore dell\'aliquota');
    await s.js('document.getElementById("btn-pulisci").click(); document.getElementById("btn-verifica").click()');
    verifica(/Incolla/.test(await s.js('document.getElementById("messaggio").textContent')), 'campi vuoti: messaggio chiaro');
    await s.js('document.getElementById("fonte").value = "Budget 50.000 euro, firmato il 3 maggio 2026 alle ore 9.30."; document.getElementById("ai").value = "Budget 60.000 euro, firmato il 3 maggio 2026 alle 9:30."; document.getElementById("btn-verifica").click()');
    await sleep(200);
    verifica(/«50\.000»/.test(await s.js('document.querySelector(".voce-fonte")?.textContent || ""')), 'testo scritto a mano: propone 50.000');
    verifica(/2\s*verificati\s*0\s*da controllare\s*1\s*non trovati/.test(riga(await s.js('document.getElementById("riepilogo").innerText'))), 'data e orario (9.30 contro 9:30) verificati, solo il budget non torna');

    console.log('# Senza rete');
    verifica(await s.js('navigator.serviceWorker.ready.then(function (r) { return !!r.active; })'), 'il service worker si attiva dopo la prima visita');
    await s.js('caches.keys().then(function (k) { return k.length; })');
    verifica((await s.js('caches.keys().then(function (k) { return caches.open(k[0]).then(function (c) { return c.keys(); }).then(function (r) { return r.length; }); })')) >= 12, 'i file del sito sono in cache');
    await s.send('Network.enable');
    await s.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await s.vai(URL); await sleep(300);
    verifica((await s.js('document.title')) === 'Controllo Fonti' && !(await s.js('document.getElementById("risultato").hidden')), 'senza rete la pagina si apre e funziona (esempio verificato)');
    verifica((await s.js('document.querySelectorAll("#scelta-esercizio option").length')) === 8, 'senza rete anche gli esercizi funzionano');
    await s.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await s.vai(URL);

    console.log('# Prompt e lingua');
    await s.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: new globalThis.URL(base).origin }).catch(() => {});
    await s.js('document.getElementById("btn-pulisci").click(); document.getElementById("prepara").open = true; document.getElementById("copia-prompt").click()');
    verifica(/Prima metti il documento/.test(await s.js('document.getElementById("esito-prompt-strumento").textContent')), 'prompt senza documento: messaggio chiaro');
    await s.js('document.getElementById("fonte").value = "Il budget è di 50.000 euro."; document.getElementById("copia-prompt").click()');
    await sleep(400);
    verifica(/Copiato|Copia non riuscita/.test(await s.js('document.getElementById("esito-prompt-strumento").textContent')), 'copia del prompt con il documento: il pulsante risponde');
    await s.js('document.getElementById("fonte").value = "The revenue of the first quarter was 2.4 million euros, which is an increase compared with the previous year and the budget is not changing."; document.getElementById("ai").value = "The revenue of the first quarter was 3.1 million euros, which is an increase compared with the previous year."; document.getElementById("btn-verifica").click()');
    await sleep(300);
    verifica(/inglese/.test(await s.js('document.getElementById("messaggio").textContent')), 'un testo inglese viene segnalato come tale');

    console.log('# Testo copiato da un PDF');
    await s.js('document.getElementById("btn-pulisci").click(); document.getElementById("fonte").value = "Il fatturato è stato di 2,4 milioni di euro, in cre-\\nscita dell\'8% rispetto\\nal 2025."; document.getElementById("pulisci-fonte").click()');
    verifica((await s.js('document.getElementById("fonte").value')) === 'Il fatturato è stato di 2,4 milioni di euro, in crescita dell\'8% rispetto al 2025.', '«Sistema da PDF» toglie il trattino a fine riga e unisce le righe spezzate');
    verifica(/Testo sistemato/.test(await s.js('document.getElementById("messaggio").textContent')), '«Sistema da PDF» dice cosa ha fatto');
    await s.js('document.getElementById("pulisci-fonte").click()');
    verifica(/già in ordine/.test(await s.js('document.getElementById("messaggio").textContent')), 'su un testo già in ordine dice che non c\'è niente da fare');

    console.log('# Caricamento file');
    const docx = path.join(tmp, 'fonte.docx');
    const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      '<w:p><w:r><w:t>Verbale del 14 marzo 2026.</w:t></w:r></w:p><w:p><w:r><w:t>Il fatturato è cresciuto dell\'8%.</w:t></w:r></w:p></w:body></w:document>';
    fs.writeFileSync(docx, Buffer.from(creaZip([{ nome: '[Content_Types].xml', dati: '<x/>', metodo: 8 }, { nome: 'word/document.xml', dati: xml, metodo: 8 }])));
    const txt = path.join(tmp, 'ai.txt');
    fs.writeFileSync(txt, Buffer.from('Il fatturato è cresciuto del 12% (già a marzo).', 'latin1'));      // accenti in windows-1252
    await s.js('document.getElementById("btn-pulisci").click()');
    await s.file('#file-fonte', [docx]); await s.file('#file-ai', [txt]);
    await sleep(600);
    verifica(/Verbale del 14 marzo 2026\.\nIl fatturato è cresciuto dell'8%\./.test(await s.js('document.getElementById("fonte").value')), 'file .docx letto (paragrafi e accenti)');
    verifica(/già a marzo/.test(await s.js('document.getElementById("ai").value')), 'file .txt in windows-1252 letto con gli accenti');
    await s.js('document.getElementById("btn-verifica").click()'); await sleep(200);
    verifica(/1\s*non trovati/.test(riga(await s.js('document.getElementById("riepilogo").innerText'))), 'verifica dei file caricati: il 12% non torna');
    const pdf = path.join(tmp, 'x.pdf'); fs.writeFileSync(pdf, '%PDF-1.4');
    await s.file('#file-fonte', [pdf]); await sleep(300);
    verifica(/PDF/.test(await s.js('document.getElementById("messaggio").textContent')), 'un PDF viene rifiutato con una spiegazione');

    console.log('# Esercizio');
    await s.js('document.getElementById("t-esercizio").click()'); await sleep(200);
    verifica((await s.js('document.querySelectorAll("#scelta-esercizio option").length')) === 8, 'otto esercizi nel menu');
    await s.js('document.getElementById("scelta-esercizio").value="circolare"; document.getElementById("scelta-esercizio").dispatchEvent(new Event("change"))');
    await sleep(200);
    verifica((await s.js('document.querySelectorAll("#ai-esercizio .bandierina").length')) >= 4, 'una bandierina per ogni frase');
    await scatta('esercizio.png', true);
    await s.js(`(function(){var b=[...document.querySelectorAll("#ai-esercizio .scelta")];
      b.find(function(e){return e.textContent==="tre"}).click();
      var fr=[...document.querySelectorAll("#ai-esercizio .frase")].find(function(f){return f.textContent.indexOf("La mensa aziendale")===0});
      document.querySelector('#ai-esercizio .bandierina[data-f="'+fr.getAttribute("data-f")+'"]').click();
      b.find(function(e){return e.textContent==="214"}).click();})()`);
    await s.js('document.getElementById("btn-rivela").click()'); await sleep(200);
    const esito = riga(await s.js('document.getElementById("esito-esercizio").innerText'));
    verifica(/Hai trovato 2 errori su 4/.test(esito) && /1\s*segnalazione sbagliata/.test(esito), 'esito: 2 errori su 4 e una segnalazione sbagliata');
    verifica(/Lo strumento non lo vede/.test(esito), 'gli errori di significato dichiarano che lo strumento non li vede');
    await scatta('esercizio-rivelato.png', true);
    await s.js('document.getElementById("btn-prossimo").click()'); await sleep(200);
    verifica((await s.js('document.getElementById("scelta-esercizio").value')) === 'test', '«Prossimo esercizio»');

    console.log('# Esercizio condiviso con un link');
    await s.js('document.getElementById("crea").open = true');
    await s.js('document.getElementById("crea-titolo").value = "Prova & <b>test</b>"; document.getElementById("crea-fonte").value = "La riunione è il 10 giugno alle 15:00. Il budget è di 5.000 euro."; document.getElementById("crea-ai").value = "La riunione è il 12 giugno alle 15:00 e il budget è di 5.000 euro."; document.getElementById("crea-analizza").click()');
    await sleep(200);
    verifica((await s.js('document.querySelectorAll("#crea-elenco li").length')) === 1, 'lo strumento propone una soluzione (12 giugno)');
    await s.js('document.getElementById("crea-link").click()'); await sleep(400);
    const url = await s.js('document.getElementById("crea-url").value');
    verifica(/#e=[pz]/.test(url) && url.length < 800, 'link creato e corto (' + url.length + ' caratteri)');
    await s.vai(url); await sleep(500);
    verifica((await s.js('document.getElementById("scelta-esercizio").value')) === '__condiviso', 'il link apre l\'esercizio condiviso');
    verifica(/Prova & <b>test<\/b>/.test(await s.js('document.getElementById("avviso-condiviso").textContent')) &&
      (await s.js('document.getElementById("avviso-condiviso").innerHTML')).indexOf('<b>') === -1, 'il titolo e\' mostrato come testo: nessun HTML iniettato');
    await s.vai(URL + '#e=zxx'); await sleep(400);
    verifica(/danneggiato/.test(await s.js('document.getElementById("avviso-condiviso").textContent')), 'un link rotto viene rifiutato con un messaggio chiaro');

    console.log('# Formazione e accessibilita\'');
    await s.vai(URL);
    for (const scheda of ['strumento', 'esercizio', 'formazione', 'come']) {
      await s.js('document.getElementById("t-' + scheda + '").click()'); await sleep(150);
      const a = JSON.parse(await s.js(CONTROLLO_ACCESSIBILITA));
      verifica(!a.senzaNome.length && !a.idDoppi.length && !a.controlsMancanti.length && !a.labelMancanti.length, 'scheda «' + scheda + '»: nomi accessibili, id unici, etichette dei campi ' + (JSON.stringify(a) !== '{"senzaNome":[],"idDoppi":[],"controlsMancanti":[],"labelMancanti":[]}' ? JSON.stringify(a) : ''));
    }
    verifica((await s.js('document.querySelectorAll("#prompt-elenco .prompt").length')) === 3, 'tre prompt da copiare');
    await s.js('document.getElementById("t-strumento").click(); document.querySelector("#evidenziato mark").focus(); document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}))');
    verifica(await s.js('document.querySelector("#evidenziato mark.attivo") != null'), 'tastiera: Invio su un\'evidenziazione la attiva');
    await s.js('document.getElementById("t-strumento").focus(); document.getElementById("t-strumento").dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowRight", bubbles:true}))');
    verifica((await s.js('document.activeElement.id')) === 't-esercizio', 'tastiera: freccia destra passa alla scheda successiva');

    console.log('# Testo grande per il proiettore');
    await s.js('document.getElementById("zoom-piu").click(); document.getElementById("zoom-piu").click(); document.getElementById("zoom-piu").click()');
    verifica((await s.js('getComputedStyle(document.documentElement).fontSize')) === '24px' && await s.js('document.getElementById("zoom-piu").disabled'), 'tre clic su A+: testo al 150% (24 px), pulsante disattivato al massimo');
    for (const scheda of ['strumento', 'esercizio']) {
      await s.js('document.getElementById("t-' + scheda + '").click()'); await sleep(150);
      verifica(!(await s.js('document.documentElement.scrollWidth > window.innerWidth')), 'testo al 150%: scheda «' + scheda + '» senza scorrimento orizzontale a 1280 px');
    }
    await s.js('for (var i = 0; i < 3; i++) document.getElementById("zoom-meno").click()');
    verifica((await s.js('getComputedStyle(document.documentElement).fontSize')) === '16px', 'A- riporta il testo alla dimensione normale');

    console.log('# Tema scuro e telefono');
    await s.tema('dark'); await s.js('document.getElementById("t-strumento").click()'); await sleep(200);
    await scatta('scuro.png', false);
    await s.tema('light');
    await s.misura(390, 844, true); await s.vai(URL); await sleep(300);
    for (const scheda of ['strumento', 'esercizio', 'formazione', 'come']) {
      await s.js('document.getElementById("t-' + scheda + '").click()'); await sleep(150);
      verifica(!(await s.js('document.documentElement.scrollWidth > window.innerWidth')), 'telefono (390 px): scheda «' + scheda + '» senza scorrimento orizzontale');
    }
    await scatta('telefono.png', true);
    await s.misura(1280, 900, false); await s.vai(base + 'guida.html');
    verifica(/Guida per il formatore/.test(await s.js('document.querySelector("h1").textContent')), 'la guida per il formatore si apre');
    await s.misura(390, 844, true); await s.vai(base + 'guida.html');
    verifica(!(await s.js('document.documentElement.scrollWidth > window.innerWidth')), 'guida su telefono senza scorrimento orizzontale');

    console.log('# Console');
    if (s.log.length) s.log.forEach(l => console.log('   ' + l));
    verifica(s.log.length === 0, 'nessun errore o avviso nella console del browser');
    s.chiudi();
  } finally {
    proc.kill(); if (srv) srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('\n' + passati + ' controlli superati, ' + falliti + ' falliti');
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error('E2E FALLITO:', e.message); process.exit(2); });
