'use strict';
/*
 * Rete di sicurezza: il motore non deve peggiorare sul corpus di valutazione (vedi benchmark/run.js).
 * Le soglie sono volutamente un po' sotto i risultati attuali, per non rompersi a ogni ritocco.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { esegui } = require('../benchmark/run.js');

const { rapporto } = esegui();
const f = rapporto.falsiAllarmi;

test('benchmark: sui riassunti originali si segnala meno del 5% degli elementi', () => {
  assert.ok(f.elementi > 1500, 'corpus troppo piccolo: ' + f.elementi);
  assert.ok((f.warn + f.miss) / f.elementi < 0.05, 'segnalati: ' + (f.warn + f.miss) + ' su ' + f.elementi);
});

test('benchmark: ogni segnalazione e\' stata rivista a mano e i falsi allarmi sono meno del 3%', () => {
  assert.equal(rapporto.revisione.sconosciuti, 0, 'segnalazioni non etichettate: aggiorna benchmark/etichette.json');
  assert.ok(rapporto.revisione.falsi / f.elementi < 0.03, 'falsi allarmi: ' + rapporto.revisione.falsi);
});

test('benchmark: almeno il 90% degli errori inseriti viene segnalato', () => {
  const t = rapporto.totaleMutazioni;
  assert.ok(t.n > 500, 'poche mutazioni: ' + t.n);
  assert.ok(t.segnalati / t.n >= 0.9, 'segnalati: ' + t.segnalati + ' su ' + t.n);
});

test('benchmark: numeri inventati, cognomi e orari sbagliati non sfuggono', () => {
  ['numero inventato', 'cognome sbagliato', 'orario'].forEach(tipo => {
    const m = rapporto.mutazioni[tipo];
    assert.ok(m.n >= 30, tipo + ': pochi casi');
    assert.ok(m.segnalati / m.n >= 0.98, tipo + ': ' + m.segnalati + ' su ' + m.n);
  });
});

test('benchmark: quando propone una correzione per un numero o una data, e\' quasi sempre quella giusta', () => {
  ['numero inventato', 'data (giorno)', 'data (mese)', 'cognome sbagliato'].forEach(tipo => {
    const m = rapporto.mutazioni[tipo];
    assert.ok(m.conSuggerimento >= 30, tipo + ': poche correzioni proposte');
    assert.ok(m.suggerimentoGiusto / m.conSuggerimento >= 0.85, tipo + ': ' + m.suggerimentoGiusto + ' giuste su ' + m.conSuggerimento);
  });
});
