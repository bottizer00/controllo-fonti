'use strict';
/*
 * Prova con testi casuali (seme fisso): il motore non deve mai andare in errore, e per qualunque testo
 * gli elementi trovati devono stare dentro il testo, senza sovrapporsi, e l'evidenziazione deve restituire
 * esattamente il testo di partenza (nessun carattere perso o inventato, nessun HTML che passa).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');
const ES = require('../src/esercizio.js');

function rng(seme) {
  let a = seme >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = rng(7);
const scegli = l => l[Math.floor(rnd() * l.length)];

const PEZZI = ['Il', 'la', 'riunione', 'del', '14 marzo 2026', '14/03/2026', 'alle ore 9.30', '9:30', 'Anna Bellini', 'Marco Furlan', 'Dott.', 'Ing. Brandi',
  '1.250', '2,4 milioni', '12%', '8 per cento', 'tre', 'ventuno', 'due milioni ottocentomila', 'sei virgola otto', '180.000 euro', '€ 50', '0432 511934',
  'art. 5', 'artt. 32 e 33', 'n. 47/2026', 'info@esempio.it', 'https://esempio.it/x', 'WISC-IV', 'RX-200', 'CdA', 'SpA', '«una citazione abbastanza lunga da contare»',
  '"un\'altra citazione abbastanza lunga qui"', '## Titolo', '**Etichetta:**', '- elenco', '1.', '|', '<script>alert(1)</script>', '& &amp; < > "', '😀', 'è già così',
  '\n', '\n\n', '  ', '\t', '.', ',', ';', ':', '(', ')', '%', '°', 'ª', '1°', '50ª', '12:75', '99/99/9999', '0,0', '000', '9'.repeat(40), '1e999', 'Ünïcode Ñame', 'مرحبا',
  'D.Lgs. 3 marzo 2011 n. 28', 'dal 15 luglio al 31 dicembre', '22, 29 gennaio e 5 febbraio', 'primo luglio duemilaventisei'];

function casuale(n) {
  let t = '';
  for (let i = 0; i < n; i++) t += scegli(PEZZI) + scegli([' ', ' ', ' ', '', '\n']);
  return t;
}

function senzaTag(html) {
  return html.replace(/<mark\b[^>]*>/g, '').replace(/<\/mark>/g, '')
    .replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

test('300 testi casuali: nessun errore, elementi ordinati e dentro il testo, evidenziazione fedele', () => {
  for (let k = 0; k < 300; k++) {
    const fonte = casuale(5 + Math.floor(rnd() * 60)), ai = casuale(5 + Math.floor(rnd() * 60));
    let r;
    assert.doesNotThrow(() => { r = CF.verifica(fonte, ai); }, 'caso ' + k + ': ' + JSON.stringify(ai).slice(0, 120));
    let fine = 0;
    r.items.forEach(i => {
      assert.ok(i.inizio >= fine && i.fine > i.inizio && i.fine <= ai.length, 'caso ' + k + ': elemento fuori posto ' + JSON.stringify(i.testo));
      assert.equal(ai.slice(i.inizio, i.fine), i.testo, 'caso ' + k);
      assert.ok(['ok', 'warn', 'miss'].includes(i.stato));
      if (i.fonte) { assert.ok(i.fonte.inizio >= 0 && i.fonte.fine <= fonte.length && i.fonte.fine > i.fonte.inizio, 'caso ' + k + ': posizione nella fonte'); }
      if (i.suggerimento) { assert.ok(i.suggerimento.fine <= fonte.length && i.suggerimento.fine > i.suggerimento.inizio, 'caso ' + k + ': suggerimento'); }
      fine = i.fine;
    });
    assert.equal(r.riepilogo.totale, r.items.length);
    assert.equal(r.riepilogo.ok + r.riepilogo.warn + r.riepilogo.miss, r.items.length);
    const html = CF.evidenzia(ai, r.items);
    assert.equal(senzaTag(html), ai, 'caso ' + k + ': l\'evidenziazione deve restituire il testo');
    assert.ok(!/<(?!\/?mark\b)/.test(html), 'caso ' + k + ': nessun tag oltre a mark');
    const vista = CF.evidenziaFonte(fonte, r.items.filter(i => i.fonte).map(i => ({ inizio: i.fonte.inizio, fine: i.fonte.fine, classe: 'f-ok' })));
    assert.equal(senzaTag(vista), fonte, 'caso ' + k + ': la fonte evidenziata deve restituire il testo');
    assert.ok(!/<(?!\/?mark\b)/.test(vista));
    assert.doesNotThrow(() => { CF.rapporto(r); ES.frasi(ai); ES.erroriAutomatici(fonte, ai); }, 'caso ' + k);
  }
});

test('testi estremi: vuoti, enormi di un solo carattere, solo numeri, solo punteggiatura', () => {
  const casi = ['', ' ', '\n\n\n', '9'.repeat(5000), '1 '.repeat(5000), 'A '.repeat(5000), '. '.repeat(5000), '«'.repeat(300) + '»'.repeat(300), '"'.repeat(1001),
    'a'.repeat(50000), '1,'.repeat(3000), '12/12/2012 '.repeat(2000)];
  casi.forEach((c, i) => {
    const t0 = Date.now();
    assert.doesNotThrow(() => CF.verifica(c, c), 'caso ' + i);
    assert.doesNotThrow(() => CF.verifica('Il 14 marzo 2026 Anna Bellini', c), 'caso ' + i);
    assert.ok(Date.now() - t0 < 6000, 'caso ' + i + ' lento: ' + (Date.now() - t0) + ' ms');
  });
});
