'use strict';
/*
 * Proprieta' di coerenza: un testo copiato dalla fonte non puo' avere nulla da segnalare.
 * Vale per l'intero documento e per ogni singola frase. Se fallisce, c'e' un difetto vero nel motore
 * (un elemento letto in un modo nella fonte e in un altro nel testo AI).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CF = require('../src/check.js');
const ES = require('../src/esercizio.js');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'benchmark', 'corpus.json'), 'utf8'));
const ESEMPI = require('../src/examples.js');

const nonOk = (fonte, testo) => CF.verifica(fonte, testo).items.filter(i => i.stato !== 'ok').map(i => i.tipo + ' «' + i.testo + '» ' + i.motivo);

test('un documento verificato contro se stesso non ha segnalazioni (24 documenti)', () => {
  corpus.forEach(d => assert.deepEqual(nonOk(d.fonte, d.fonte), [], d.id));
});

test('ogni frase di un documento, verificata contro il documento, non ha segnalazioni', () => {
  const problemi = [];
  let frasi = 0;
  corpus.forEach(d => ES.frasi(d.fonte).forEach(f => {
    frasi++;
    const s = d.fonte.slice(f.inizio, f.fine);
    nonOk(d.fonte, s).forEach(p => problemi.push(d.id + ': ' + p + ' (in: ' + s.slice(0, 60) + ')'));
  }));
  assert.ok(frasi > 400, 'poche frasi: ' + frasi);
  assert.deepEqual(problemi, []);
});

test('lo stesso vale per le fonti degli esercizi', () => {
  ESEMPI.forEach(e => {
    assert.deepEqual(nonOk(e.fonte, e.fonte), [], e.id);
    ES.frasi(e.fonte).forEach(f => assert.deepEqual(nonOk(e.fonte, e.fonte.slice(f.inizio, f.fine)), [], e.id + ': ' + e.fonte.slice(f.inizio, f.fine).slice(0, 50)));
  });
});

test('con la fonte maiuscola o senza accenti i dettagli restano verificati', () => {
  const e = ESEMPI[0];
  const senzaAccenti = e.fonte.normalize('NFD').replace(/[̀-ͯ]/g, '');
  assert.deepEqual(nonOk(e.fonte, senzaAccenti.replace(/\n/g, ' ')), []);
});
