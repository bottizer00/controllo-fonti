'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ES = require('../src/esercizio.js');
const CF = require('../src/check.js');
const ESEMPI = require('../src/examples.js');

const testiFrasi = t => ES.frasi(t).map(f => t.slice(f.inizio, f.fine));

test('frasi: punto, domanda, a capo', () => {
  assert.deepEqual(testiFrasi('Prima frase. Seconda frase? Terza!\nQuarta riga'),
    ['Prima frase.', 'Seconda frase?', 'Terza!', 'Quarta riga']);
});

test('frasi: non si spezza dopo abbreviazioni, sigle e numeri', () => {
  assert.deepEqual(testiFrasi('Il referente e\' l\'ing. Paolo Zanier. Vedi l\'art. 7 e il n. 45/2026. Fine.'),
    ['Il referente e\' l\'ing. Paolo Zanier.', 'Vedi l\'art. 7 e il n. 45/2026.', 'Fine.']);
  assert.equal(testiFrasi('Contratto con la Rossi S.r.l. e con la Bianchi S.p.A. Poi altro.').length, 1);   // le sigle non chiudono la frase
  assert.deepEqual(testiFrasi('Costa 3,5 euro. Pagamento entro il 1° giugno.'), ['Costa 3,5 euro.', 'Pagamento entro il 1° giugno.']);
});

test('frasi: testo vuoto o senza punteggiatura', () => {
  assert.deepEqual(ES.frasi(''), []);
  assert.deepEqual(testiFrasi('Una sola frase senza punto'), ['Una sola frase senza punto']);
});

test('posizione: da testo, da contesto, da inizio e fine', () => {
  const ai = 'Tre giorni e poi tre mesi, tre.';
  assert.deepEqual(ES.posizione(ai, { testo: 'poi' }), { inizio: 13, fine: 16 });
  assert.deepEqual(ES.posizione(ai, { testo: 'tre', contesto: 'poi tre mesi' }), { inizio: 17, fine: 20 });
  assert.deepEqual(ES.posizione('Dopo oltre tre anni', { testo: 'tre', contesto: 'oltre tre anni' }), { inizio: 11, fine: 14 });   // non dentro "oltre"
  assert.deepEqual(ES.posizione(ai, { inizio: 1, fine: 4 }), { inizio: 1, fine: 4 });
  assert.equal(ES.posizione(ai, { testo: 'assente' }), null);
});

const verbale = ESEMPI[0];
const indiceElemento = (e, testo) => CF.estrai(e.ai).findIndex(x => x.testo === testo);

test('valuta: tutti gli errori trovati, nessuna segnalazione sbagliata', () => {
  const scelta = { elementi: ['12%', 'tre', 'Elisa Tonon', '18 aprile 2026'].map(t => indiceElemento(verbale, t)), frasi: [] };
  const v = ES.valuta(verbale, scelta);
  assert.equal(v.trovati, 4);
  assert.equal(v.mancati, 0);
  assert.equal(v.sbagliate, 0);
});

test('valuta: errori mancati e segnalazioni sbagliate', () => {
  const scelta = { elementi: ['12%', '180.000'].map(t => indiceElemento(verbale, t)), frasi: [] };
  const v = ES.valuta(verbale, scelta);
  assert.equal(v.trovati, 1);
  assert.equal(v.mancati, 3);
  assert.deepEqual(v.elementiSbagliati.map(i => CF.estrai(verbale.ai)[i].testo), ['180.000']);
});

test('valuta: un errore di significato si trova solo segnando la frase', () => {
  const circolare = ESEMPI.find(e => e.id === 'circolare');
  const fr = ES.frasi(circolare.ai);
  const dellaMensa = fr.findIndex(f => circolare.ai.slice(f.inizio, f.fine).startsWith('La mensa'));
  const v = ES.valuta(circolare, { elementi: [], frasi: [dellaMensa] });
  assert.equal(v.trovati, 1);
  assert.equal(v.sbagliate, 0);
  const sbagliata = ES.valuta(circolare, { elementi: [], frasi: [0] });          // la prima frase non ha errori di significato ma ne contiene uno di numero
  assert.equal(sbagliata.trovati, 0);
  assert.equal(sbagliata.sbagliate, 0);                                           // contiene un errore: la bandierina e' giustificata
  const inutile = ES.valuta(circolare, { elementi: [], frasi: [fr.length - 1] });  // l'ultima frase ("Per chiarimenti...") e' corretta
  assert.equal(inutile.sbagliate, 1);
});

test('valuta: segnare tutte le frasi non fa trovare gli errori "da elemento"', () => {
  const tutte = { elementi: [], frasi: ES.frasi(verbale.ai).map((f, i) => i) };
  const v = ES.valuta(verbale, tutte);
  assert.equal(v.trovati, 0);
});

test('errori automatici: dal controllo, per creare un esercizio dai propri testi', () => {
  const e = ES.erroriAutomatici(verbale.fonte, verbale.ai);
  assert.deepEqual(e.map(x => x.testo), ['12%', 'tre', 'Elisa Tonon', '18 aprile 2026']);
  e.forEach(x => assert.equal(verbale.ai.slice(x.inizio, x.fine), x.testo));
  assert.match(e[0].spiegazione, /8%/);
});
