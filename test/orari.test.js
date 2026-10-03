'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');

const orari = testo => CF.estrai(testo).filter(x => x.tipo === 'orario').map(x => [x.testo, x.minuti]);
const stato = (fonte, ai, testo) => {
  const it = CF.verifica(fonte, ai).items.find(i => i.testo === testo);
  assert.ok(it, 'elemento non estratto: ' + testo);
  return it.stato;
};

test('orari: due punti, punto dopo "alle", h, "ore 9", intervalli', () => {
  assert.deepEqual(orari('Inizio alle 9:30.'), [['9:30', 570]]);
  assert.deepEqual(orari('Ritrovo alle ore 14.45 davanti alla sede.'), [['14.45', 885]]);
  assert.deepEqual(orari('Sveglia alle 7h15.'), [['7h15', 435]]);
  assert.deepEqual(orari('Riunione ore 9, pausa dalle 12.30 alle 13.30.'), [['9', 540], ['12.30', 750], ['13.30', 810]]);
  assert.deepEqual(orari('Orario 9.15-13.45.'), [['9.15', 555], ['13.45', 825]]);
});

test('non sono orari: decimali, rapporti, date, prezzi', () => {
  assert.deepEqual(orari('Pesa 3.50 kg e costa 12,50 euro.'), []);
  assert.deepEqual(orari('Il 14/03/2026 sono arrivati 25 ospiti, il 3.5% in piu\'.'), []);
  assert.deepEqual(orari('Valore 99:99 e 7:75.'), []);
});

test('"14.45" e "14:45" sono lo stesso orario', () => {
  assert.equal(stato('La visita inizia alle 14.45.', 'La visita inizia alle 14:45.', '14:45'), 'ok');
  assert.equal(stato('La visita inizia alle 14.45.', 'La visita inizia alle 15:45.', '15:45'), 'miss');
});

test('"ore 9" nella fonte e "9:00" nel testo AI', () => {
  assert.equal(stato('Apertura ore 9 del mattino.', 'Apertura alle 9:00.', '9:00'), 'ok');
});

test('"alle 9" nel testo AI trova "9:00" nella fonte, ma "alle 3 sedi" resta un numero', () => {
  assert.equal(stato('Apertura alle 9:00.', 'Apertura alle 9.', '9'), 'ok');
  assert.equal(stato('Sono previste 3 sedi.', 'Assegnati alle 3 sedi.', '3'), 'ok');
});
