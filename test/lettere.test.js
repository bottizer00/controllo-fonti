'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');

const valori = testo => CF.estrai(testo).map(x => [x.testo, x.cands[0] * x.scala]);
const stato = (fonte, ai, testo) => {
  const it = CF.verifica(fonte, ai).items.find(i => i.testo === testo);
  assert.ok(it, 'elemento non estratto: ' + testo);
  return it.stato;
};

test('numeri in lettere composti: decine, centinaia, migliaia', () => {
  assert.deepEqual(valori('ventuno, ventotto, ventitré, trentasei'),
    [['ventuno', 21], ['ventotto', 28], ['ventitré', 23], ['trentasei', 36]]);
  assert.deepEqual(valori('centottanta, duecento, trecentocinquanta'),
    [['centottanta', 180], ['duecento', 200], ['trecentocinquanta', 350]]);
  assert.deepEqual(valori('mille, milleduecento, duemilacinquecento, dodicimila, centomila'),
    [['mille', 1000], ['milleduecento', 1200], ['duemilacinquecento', 2500], ['dodicimila', 12000], ['centomila', 100000]]);
});

test('numeri in lettere con scala separata: "due milioni", "un miliardo", "dodici mila"', () => {
  assert.deepEqual(valori('due milioni di euro'), [['due milioni', 2e6]]);
  assert.deepEqual(valori('un milione e un miliardo'), [['un milione', 1e6], ['un miliardo', 1e9]]);
  assert.deepEqual(valori('dodici mila euro'), [['dodici mila', 12000]]);
});

test('parole che non sono numeri: "sei", "uno", "una", "un"', () => {
  assert.deepEqual(valori('Tu sei qui. Il numero uno. Una volta, un giorno.'), []);
  assert.deepEqual(valori('Sono trentasei'), [['trentasei', 36]]);
});

test('cifre e lettere si equivalgono nel confronto', () => {
  assert.equal(stato('Gli iscritti sono 21 studenti.', 'Gli iscritti sono ventuno studenti.', 'ventuno'), 'ok');
  assert.equal(stato('Spesa di duecento euro per i materiali.', 'Spesa di 200 euro per i materiali.', '200'), 'ok');
  assert.equal(stato('Fatturato di 2.000.000 euro.', 'Fatturato di due milioni di euro.', 'due milioni'), 'ok');
  assert.equal(stato('Gli iscritti sono 21 studenti.', 'Gli iscritti sono ventidue studenti.', 'ventidue'), 'miss');
});
