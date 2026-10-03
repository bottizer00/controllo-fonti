'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');
const ES = require('../src/esercizio.js');
const ESEMPI = require('../src/examples.js');

const LIVELLI = ['facile', 'medio', 'difficile'];

test('ogni esempio ha i campi necessari, un id unico e un livello', () => {
  const ids = new Set();
  ESEMPI.forEach(e => {
    ['id', 'titolo', 'descrizione', 'fonte', 'ai', 'nota'].forEach(k => assert.ok(e[k], e.id + ': manca ' + k));
    assert.ok(LIVELLI.includes(e.livello), e.id + ': livello non valido');
    assert.ok(Array.isArray(e.errori) && e.errori.length >= 3, e.id + ': servono almeno 3 errori');
    assert.ok(!ids.has(e.id), 'id doppio: ' + e.id); ids.add(e.id);
  });
  assert.ok(ESEMPI.length >= 8);
  LIVELLI.forEach(l => assert.ok(ESEMPI.some(e => e.livello === l), 'nessun esempio di livello ' + l));
});

ESEMPI.forEach(e => {
  test('esempio "' + e.id + '": gli errori sono nel testo AI, senza ambiguita\'', () => {
    e.errori.forEach(er => {
      assert.ok(er.spiegazione, e.id + ': manca la spiegazione di ' + er.testo);
      const p = ES.posizione(e.ai, er);
      assert.ok(p, e.id + ': errore non trovato nel testo: ' + er.testo);
      assert.equal(e.ai.slice(p.inizio, p.fine), er.testo);
      const area = er.contesto || e.ai;
      assert.equal(ES.cerca(area, er.testo, ES.cerca(area, er.testo) + 1), -1,e.id + ': "' + er.testo + '" compare piu\' volte, serve un "contesto"');
      if (er.contesto) assert.equal(e.ai.indexOf(er.contesto, e.ai.indexOf(er.contesto) + 1), -1, e.id + ': contesto non univoco');
    });
  });

  test('esempio "' + e.id + '": il controllo segnala gli errori che dichiara di vedere, e solo quelli', () => {
    const r = CF.verifica(e.fonte, e.ai);
    ES.errori(e).forEach(er => {
      const toccati = r.items.filter(i => i.inizio < er.fine && i.fine > er.inizio);
      if (er.strumento) assert.ok(toccati.some(i => i.stato !== 'ok'), e.id + ': lo strumento doveva segnalare "' + er.testo + '"');
    });
    const inutili = ES.allarmiInutili(e).map(i => i.testo);
    assert.deepEqual(inutili, (e.falsiAllarmi || []).map(f => f.testo), e.id + ': segnala elementi che non sono errori');
  });

  test('esempio "' + e.id + '": gli errori "di frase" stanno ciascuno in una sola frase', () => {
    const fr = ES.frasi(e.ai);
    ES.errori(e).filter(er => er.frase).forEach(er => {
      const dentro = fr.filter(f => f.inizio < er.fine && f.fine > er.inizio);
      assert.equal(dentro.length, 1, e.id + ': "' + er.testo + '" attraversa ' + dentro.length + ' frasi');
    });
  });
});

test('negli esempi la parte corretta del testo AI risulta verificata', () => {
  const r = CF.verifica(ESEMPI[0].fonte, ESEMPI[0].ai);
  const ok = r.items.filter(i => i.stato === 'ok').map(i => i.testo);
  ['14 marzo 2026', 'Anna Bellini', '2,4 milioni', '180.000'].forEach(t => assert.ok(ok.includes(t), t));
});

test('gli esempi con errori di significato esistono e lo strumento non li vede', () => {
  const conFrase = ESEMPI.filter(e => e.errori.some(er => er.frase && !er.strumento));
  assert.ok(conFrase.length >= 3, 'servono almeno 3 esercizi con errori di significato');
});
