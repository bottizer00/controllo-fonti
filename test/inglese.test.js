'use strict';
/* Inglese di base: date, numeri in lettere, importi con le virgole, am/pm, titoli, riferimenti. */
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');
const ES = require('../src/esercizio.js');

const stato = (fonte, ai, testo) => {
  const it = CF.verifica(fonte, ai).items.find(i => i.testo === testo);
  assert.ok(it, 'elemento non estratto: ' + testo + ' in ' + JSON.stringify(CF.verifica(fonte, ai).items.map(i => i.testo)));
  return it.stato;
};
const estratti = testo => CF.estrai(testo).map(x => [x.tipo, x.testo]);
const nonOk = (fonte, testo) => CF.verifica(fonte, testo).items.filter(i => i.stato !== 'ok').map(i => i.tipo + ' «' + i.testo + '» ' + i.motivo);

const DOCUMENTI = [
  'Minutes of the board meeting held on March 14, 2026 at 3:30 pm. Present: Mr. Smith, Mrs. Jones and Dr. Evans. ' +
    'Revenue reached $1.2 million, up ten percent on last year. The board approved a budget of 1,300,000 dollars. ' +
    'Twenty-one staff were hired across three offices. Section 4 and Section 5 of the contract apply. ' +
    'The next meeting is on 9th of April at 10 am. Contact: hr@example.com or 0432 511934.',
  'Product sheet. The device weighs 2.5 kg and costs 249.90 euro. Battery life is twelve hours. ' +
    'It was launched in September 2025 and sold one hundred and fifty thousand units in 6 weeks. ' +
    'Warranty covers 24 months (clause 7). Ms. Rossi leads the support team of forty people.',
  'Quarterly report: the company grew 12.5% in Q3 2026, with sales of $3.4 billion. Headcount rose by 1,250 to 18,400. ' +
    'Chief executive Jane Cooper said that a hundred new stores would open before 1 January 2027.',
];

test('le date inglesi sono la stessa data in qualsiasi formato', () => {
  const fonte = 'The audit took place on March 14, 2026.';
  assert.equal(stato(fonte, 'The audit was on 14 March 2026.', '14 March 2026'), 'ok');
  assert.equal(stato(fonte, 'The audit was on 14/03/2026.', '14/03/2026'), 'ok');
  assert.equal(stato(fonte, "L'audit e' del 14 marzo 2026.", '14 marzo 2026'), 'ok');
  assert.equal(stato(fonte, 'The audit was on March 15, 2026.', 'March 15, 2026'), 'miss');
  assert.equal(stato('Launched on 14th of March.', 'Launched on March 14.', 'March 14'), 'ok');
  assert.equal(stato('Launched in September 2025.', 'Launched in Sept. 2025.', 'Sept. 2025'), 'ok');
});

test('"may" minuscolo è un verbo, non un mese', () => {
  assert.deepEqual(estratti('Staff may 5 times apply.').filter(x => x[0] === 'data'), []);
  assert.deepEqual(estratti('On May 5 we met.').filter(x => x[0] === 'data'), [['data', 'May 5']]);
});

test('numeri inglesi in lettere', () => {
  const val = t => CF.estrai(t).filter(x => x.tipo === 'numero' || x.tipo === 'percentuale').map(x => [x.testo, x.cands[0] * x.scala, x.tipo]);
  assert.deepEqual(val('We hired twenty-one people.'), [['twenty-one', 21, 'numero']]);
  assert.deepEqual(val('It cost one hundred and fifty dollars.').map(x => x[1]), [150]);
  assert.deepEqual(val('Sales were two million units.').map(x => x[1]), [2e6]);
  assert.deepEqual(val('A hundred stores opened.').map(x => x[1]), [100]);
  assert.deepEqual(val('Three hundred thousand visitors came.').map(x => x[1]), [300000]);
  assert.deepEqual(val('Up ten percent and twenty per cent.'), [['ten percent', 10, 'percentuale'], ['twenty per cent', 20, 'percentuale']]);
  assert.deepEqual(val('No one knows. One of them left.'), []);          // "one" da solo non e' un numero
  assert.deepEqual(val('She finished twenty-first. Two thirds agreed.'), []);   // ordinali e frazioni non sono quantita'
});

test('parole e cifre sono lo stesso numero, e uno diverso viene segnalato', () => {
  assert.equal(stato('We hired 21 people.', 'We hired twenty-one people.', 'twenty-one'), 'ok');
  assert.equal(stato('We hired twenty-one people.', 'We hired 21 people.', '21'), 'ok');
  assert.equal(stato('We hired twenty-one people.', 'We hired twenty-two people.', 'twenty-two'), 'miss');
  assert.equal(stato('Revenue was 2 million.', 'Revenue was two million.', 'two million'), 'ok');
  assert.equal(stato('Rose by 10 percent.', 'Rose by ten per cent.', 'ten per cent'), 'ok');
});

test('importi con la virgola delle migliaia', () => {
  assert.equal(stato('Budget: 1,300,000 dollars.', 'Budget: 1,300,000 dollars.', '1,300,000'), 'ok');
  assert.equal(stato('Budget: 1,300,000 dollars.', 'Budget: 1.3 million dollars.', '1.3 million'), 'ok');
  assert.equal(stato('Budget: 1,300,000 dollars.', 'Budget: 1,400,000 dollars.', '1,400,000'), 'miss');
  assert.equal(stato('Budget: 1,300.50 dollars.', 'Budget: 1,300.50 dollars.', '1,300.50'), 'ok');
  assert.equal(stato('Revenue was $1.2 million.', 'Revenue was $1.5 million.', '1.5 million'), 'miss');
  assert.equal(stato('Revenue was 3.4 billion.', 'Revenue was 3,400,000,000.', '3,400,000,000'), 'ok');
});

test('orari am/pm uguali ai 24 ore', () => {
  assert.equal(stato('The meeting starts at 3:30 pm.', 'The meeting starts at 15:30.', '15:30'), 'ok');
  assert.equal(stato('The meeting starts at 15:30.', 'The meeting starts at 3:30 PM.', '3:30 PM'), 'ok');
  assert.equal(stato('Doors open at 9:00.', 'Doors open at 9 am.', '9 am'), 'ok');
  assert.equal(stato('Doors open at 9:00.', 'Doors open at 9 pm.', '9 pm'), 'miss');
  assert.equal(stato('Lunch at 12:00.', 'Lunch at 12 p.m.', '12 p.m.'), 'ok');
  assert.deepEqual(estratti('I am sure. I am 5 times faster.').filter(x => x[0] === 'orario'), []);
});

test('titoli e riferimenti inglesi', () => {
  assert.deepEqual(estratti('Mr. Smith and Mrs. Jones met Dr Evans.').filter(x => x[0] === 'nome').map(x => x[1]), ['Smith', 'Jones', 'Evans']);
  assert.equal(stato('See Section 4 of the contract.', 'See Section 4 of the contract.', 'Section 4'), 'ok');
  assert.equal(stato('See Section 4 of the contract.', 'See Section 5 of the contract.', 'Section 5'), 'miss');
  assert.equal(stato('See Article 12.', 'See article 12.', 'article 12'), 'ok');
  assert.equal(stato('Clauses 3 and 4 apply.', 'Clause 4 applies.', 'Clause 4'), 'ok');
});

test('un documento inglese verificato contro se stesso non ha segnalazioni, e nemmeno ogni sua frase', () => {
  DOCUMENTI.forEach((d, k) => {
    assert.deepEqual(nonOk(d, d), [], 'documento ' + k);
    ES.frasi(d).forEach(f => assert.deepEqual(nonOk(d, d.slice(f.inizio, f.fine)), [], 'documento ' + k + ': ' + d.slice(f.inizio, f.fine).slice(0, 60)));
  });
});

test('in un documento inglese cambiare un valore alla volta viene sempre segnalato', () => {
  const cambi = [
    ['March 14, 2026', 'March 17, 2026'], ['3:30 pm', '4:30 pm'], ['$1.2 million', '$1.9 million'], ['ten percent', 'twelve percent'],
    ['Mr. Smith', 'Mr. Brown'], ['1,300,000', '1,700,000'], ['Twenty-one', 'Twenty-seven'], ['Section 4', 'Section 9'],
    ['9th of April', '19th of April'], ['0432 511934', '0432 511935'],
  ];
  cambi.forEach(([da, a]) => {
    assert.ok(DOCUMENTI[0].includes(da), da);
    const ai = DOCUMENTI[0].replace(da, a);
    const segnalati = CF.verifica(DOCUMENTI[0], ai).items.filter(i => i.stato !== 'ok');
    assert.ok(segnalati.length >= 1, 'non segnalato: ' + da + ' -> ' + a);
  });
});

test('rilevaLingua riconosce l\'inglese di questi documenti', () => {
  DOCUMENTI.forEach((d, k) => assert.equal(CF.rilevaLingua(d), 'en', 'documento ' + k));
});
