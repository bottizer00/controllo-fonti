'use strict';
/*
 * Controlli statici sulle pagine: la politica di sicurezza che promette "nessuna rete", i file collegati che
 * esistono, gli id usati dagli script che ci sono davvero nella pagina. Prendono gli errori piu' banali
 * dell'interfaccia senza aprire un browser (quello lo fa test/e2e).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const radice = path.join(__dirname, '..');
const leggi = f => fs.readFileSync(path.join(radice, f), 'utf8');
const pagine = ['index.html', 'guida.html'];

test('ogni pagina dichiara una politica di sicurezza senza rete', () => {
  pagine.forEach(f => {
    const html = leggi(f);
    const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html);
    assert.ok(csp, f + ': manca la Content-Security-Policy');
    assert.match(csp[1], /default-src 'none'/, f);
    assert.ok(!/connect-src (?!'none')/.test(csp[1]), f + ': connect-src deve essere \'none\'');
    assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(csp[1]), f + ': nessun inline, eval o jolly');
    assert.ok(!/<script[^>]*>[^<]+<\/script>/.test(html), f + ': nessuno script inline');
    assert.ok(!/\sstyle="/.test(html), f + ': nessuno stile inline');
    assert.ok(!/\son[a-z]+="/.test(html), f + ': nessun gestore di eventi inline');
  });
});

test('nessuna risorsa esterna: script, stili, immagini sono tutti locali', () => {
  pagine.forEach(f => {
    const html = leggi(f);
    for (const m of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
      assert.ok(!/^(https?:)?\/\//.test(m[1]), f + ': risorsa esterna ' + m[1]);
    }
  });
});

test('gli script e i fogli di stile collegati esistono, nell\'ordine in cui servono', () => {
  const html = leggi('index.html');
  const script = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  script.forEach(s => assert.ok(fs.existsSync(path.join(radice, s)), 'manca ' + s));
  const dipendenze = { 'src/esercizio.js': 'src/check.js', 'src/ui-comune.js': 'src/check.js', 'src/ui-strumento.js': 'src/ui-comune.js',
    'src/ui-esercizio.js': 'src/ui-strumento.js', 'src/ui-formazione.js': 'src/ui-esercizio.js' };
  Object.keys(dipendenze).forEach(s => assert.ok(script.indexOf(dipendenze[s]) < script.indexOf(s), s + ' deve venire dopo ' + dipendenze[s]));
  assert.equal(script[script.length - 1], 'src/ui-formazione.js', 'l\'ultimo script avvia l\'instradamento');
  pagine.forEach(f => assert.ok(fs.existsSync(path.join(radice, 'style.css')) && /href="style\.css"/.test(leggi(f)), f));
});

test('ogni id usato dagli script esiste nella pagina, e non ci sono id doppi', () => {
  const html = leggi('index.html');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'id doppi: ' + ids.filter((x, i) => ids.indexOf(x) !== i));
  const creatiDaScript = [];
  fs.readdirSync(path.join(radice, 'src')).filter(f => /^ui-.*\.js$/.test(f)).forEach(f => {
    const js = leggi('src/' + f);
    for (const m of js.matchAll(/id="([^"]+)"/g)) creatiDaScript.push(m[1]);          // elementi creati dagli script
    const usati = [...js.matchAll(/(?:\$|getElementById)\('([^']+)'\)/g)].map(m => m[1]);
    usati.forEach(id => assert.ok(ids.includes(id) || creatiDaScript.includes(id), f + ' usa #' + id + ' che non esiste in index.html'));
  });
});

test('le schede hanno il pannello corrispondente', () => {
  const html = leggi('index.html');
  [...html.matchAll(/id="t-([a-z]+)" aria-controls="p-([a-z]+)"/g)].forEach(m => {
    assert.equal(m[1], m[2]);
    assert.ok(html.includes('id="p-' + m[1] + '"'), 'manca il pannello ' + m[1]);
  });
});

test('i link interni della guida e della pagina principale arrivano a file che esistono', () => {
  pagine.forEach(f => {
    for (const m of leggi(f).matchAll(/href="([^"#:]+\.(?:html|css))"/g)) assert.ok(fs.existsSync(path.join(radice, m[1])), f + ' -> ' + m[1]);
  });
  const og = /property="og:image" content="https:\/\/bottizer00\.github\.io\/controllo-fonti\/([^"]+)"/.exec(leggi('index.html'));
  assert.ok(og && fs.existsSync(path.join(radice, og[1])), 'immagine di anteprima mancante');
});

test('il testo della pagina non contiene refusi tipici: segnaposto, TODO, doppi spazi nei titoli', () => {
  pagine.forEach(f => {
    const html = leggi(f);
    assert.ok(!/(?:TODO|FIXME|XXX)|lorem ipsum/i.test(html.replace(/metodo/gi, '')), f);
  });
  ['src/examples.js'].forEach(f => assert.ok(!/(?:TODO|FIXME)|lorem ipsum/.test(leggi(f)), f));
});
