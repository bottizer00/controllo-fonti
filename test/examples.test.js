'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');
const ESEMPI = require('../src/examples.js');

test('ogni esempio ha i campi necessari e un id unico', () => {
  const ids = new Set();
  ESEMPI.forEach(e => {
    ['id', 'titolo', 'descrizione', 'fonte', 'ai', 'nota'].forEach(k => assert.ok(e[k], e.id + ': manca ' + k));
    assert.ok(Array.isArray(e.attesi) && e.attesi.length > 0);
    assert.ok(!ids.has(e.id)); ids.add(e.id);
  });
});

ESEMPI.forEach(e => {
  test('esempio "' + e.id + '": il controllo trova esattamente gli errori inseriti', () => {
    const r = CF.verifica(e.fonte, e.ai);
    const nonVerificati = r.items.filter(i => i.stato !== 'ok').map(i => i.testo);
    assert.deepEqual(nonVerificati, e.attesi);
  });
});

test('negli esempi la parte corretta del testo AI risulta verificata', () => {
  const r = CF.verifica(ESEMPI[0].fonte, ESEMPI[0].ai);
  const ok = r.items.filter(i => i.stato === 'ok').map(i => i.testo);
  ['14 marzo 2026', 'Anna Bellini', '2,4 milioni', '180.000'].forEach(t => assert.ok(ok.includes(t), t));
});
