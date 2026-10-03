'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/prompt.js');
const CF = require('../src/check.js');

test('i prompt hanno titolo, testo e id unico', () => {
  const ids = new Set();
  P.PROMPT.forEach(p => {
    assert.ok(p.id && p.titolo && p.testo.length > 80);
    assert.ok(!ids.has(p.id)); ids.add(p.id);
  });
  assert.ok(P.PROMPT.filter(p => p.conDocumento).length >= 2);
});

test('i prompt con documento hanno il segnaposto e il documento lo sostituisce', () => {
  P.PROMPT.filter(p => p.conDocumento).forEach(p => {
    assert.ok(p.testo.includes(P.SEGNAPOSTO), p.id);
    const t = P.componi(p, '  Il fatturato è di 2,4 milioni.  ');
    assert.ok(t.endsWith('Il fatturato è di 2,4 milioni.'));
    assert.ok(!t.includes(P.SEGNAPOSTO));
  });
});

test('il prompt di controllo non porta il documento', () => {
  const c = P.PROMPT.find(p => !p.conDocumento);
  assert.equal(P.componi(c, 'qualcosa'), c.testo);
});

test('i prompt chiedono di citare e di non inventare', () => {
  const testo = P.PROMPT.map(p => p.testo).join(' ').toLowerCase();
  ['frase', 'non indicato', 'non presente', 'alla lettera'].forEach(k => assert.ok(testo.includes(k), k));
});

test('rilevaLingua: italiano, inglese, testi troppo corti', () => {
  assert.equal(CF.rilevaLingua('Il fatturato del primo trimestre è stato di 2,4 milioni di euro, in crescita rispetto all\'anno precedente e con un budget che non cambia.'), 'it');
  assert.equal(CF.rilevaLingua('The revenue of the first quarter was 2.4 million euros, which is an increase compared with the previous year and the budget is not changing.'), 'en');
  assert.equal(CF.rilevaLingua('Budget 2026'), 'incerta');
  assert.equal(CF.rilevaLingua(''), 'incerta');
});
