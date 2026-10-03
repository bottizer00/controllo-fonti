'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SH = require('../src/condividi.js');

const esercizio = {
  titolo: 'Il mio esercizio', descrizione: 'Prova', fonte: 'Il fatturato è di 2,4 milioni.\nÈ cresciuto dell\'8%.',
  ai: 'Il fatturato è di 3,1 milioni, cresciuto del 12% (perché è già l\'estate).', nota: 'Nota per l\'aula',
  errori: []
};
esercizio.errori = [{ inizio: esercizio.ai.indexOf('3,1 milioni'), fine: esercizio.ai.indexOf('3,1 milioni') + 11, spiegazione: 'Erano 2,4 milioni.' },
  { inizio: esercizio.ai.indexOf('12%'), fine: esercizio.ai.indexOf('12%') + 3 }];

test('un esercizio si codifica in un link e si ritrova uguale', async () => {
  const s = await SH.codifica(esercizio);
  assert.match(s, /^[pz][A-Za-z0-9_-]+$/);
  const e = await SH.decodifica('#e=' + s);
  assert.equal(e.titolo, 'Il mio esercizio');
  assert.equal(e.fonte, esercizio.fonte);
  assert.equal(e.ai, esercizio.ai);
  assert.equal(e.nota, 'Nota per l\'aula');
  assert.deepEqual(e.errori.map(x => x.testo), ['3,1 milioni', '12%']);
  assert.equal(e.errori[0].spiegazione, 'Erano 2,4 milioni.');
  assert.equal(e.condiviso, true);
});

test('il link compresso e\' piu\' corto del testo lungo', async () => {
  const lungo = Object.assign({}, esercizio, { fonte: 'Parola '.repeat(800), ai: 'Parola '.repeat(800), errori: [] });
  const s = await SH.codifica(lungo);
  assert.ok(s.length < 800, 'link di ' + s.length + ' caratteri');
});

test('i caratteri speciali sopravvivono: accenti, virgolette, emoji', async () => {
  const e = await SH.decodifica(await SH.codifica(Object.assign({}, esercizio, { ai: 'Città «così» – “ok” 😀 €', fonte: 'x', errori: [] })));
  assert.equal(e.ai, 'Città «così» – “ok” 😀 €');
});

test('un link rovinato o non fidato viene rifiutato', async () => {
  await assert.rejects(SH.decodifica(''), /link/);
  await assert.rejects(SH.decodifica('qualcosa di strano!'), /link/);
  await assert.rejects(SH.decodifica('zAAAA'), Error);
  await assert.rejects(SH.decodifica('pe30'), /link|incompleto|valido/);          // "{}" in base64
});

test('i dati ricevuti vengono ripuliti: intervalli fuori testo scartati, testi troppo lunghi rifiutati', () => {
  const e = SH.valida({ f: 'abc', a: 'def', e: [[0, 2], [2, 99], [-1, 1], 'x', [1, 1]] });
  assert.deepEqual(e.errori.map(x => [x.inizio, x.fine]), [[0, 2]]);
  assert.throws(() => SH.valida({ f: 'x'.repeat(SH.MAX_TESTO + 1), a: 'y' }), /lungo/);
  assert.throws(() => SH.valida({ f: '', a: 'y' }), /incompleto/);
  assert.equal(SH.valida({ f: 'a', a: 'b', t: '<script>alert(1)</script>' }).titolo, '<script>alert(1)</script>');   // e' testo: l'interfaccia lo mostra con textContent
});
