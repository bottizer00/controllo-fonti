'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');
const EX = require('../src/examples.js');

const item = (fonte, ai, testo) => {
  const it = CF.verifica(fonte, ai).items.find(i => i.testo === testo);
  assert.ok(it, 'elemento non estratto: ' + testo + ' in ' + JSON.stringify(CF.verifica(fonte, ai).items.map(i => i.testo)));
  return it;
};
const stato = (fonte, ai, testo) => item(fonte, ai, testo).stato;

test('ogni elemento trovato indica il passaggio della fonte', () => {
  const e = EX[0], r = CF.verifica(e.fonte, e.ai);
  r.items.filter(i => i.stato === 'ok').forEach(i => {
    assert.ok(i.fonte, 'manca la posizione per ' + i.testo);
    const brano = e.fonte.slice(i.fonte.inizio, i.fonte.fine);
    assert.equal(brano, i.fonte.testo);
  });
  assert.equal(e.fonte.slice(item(e.fonte, e.ai, '2,4 milioni').fonte.inizio, item(e.fonte, e.ai, '2,4 milioni').fonte.fine), '2,4 milioni');
});

test('un numero sbagliato propone il valore della fonte nello stesso contesto', () => {
  const e = EX[0];
  assert.equal(item(e.fonte, e.ai, '12%').suggerimento.testo, '8%');
  assert.equal(item(e.fonte, e.ai, 'tre').suggerimento.testo, 'due');
  const s = EX[1];
  assert.equal(item(s.fonte, s.ai, '150').suggerimento.testo, '120');
  assert.equal(item(s.fonte, s.ai, '36').suggerimento.testo, '24');
});

test('una data sbagliata propone quella della fonte, un cognome sbagliato quello giusto', () => {
  const e = EX[0];
  assert.equal(item(e.fonte, e.ai, '18 aprile 2026').suggerimento.testo, '11 aprile 2026');
  assert.equal(item(e.fonte, e.ai, 'Elisa Tonon').suggerimento.testo, 'Elisa Toffolo');
  const f = 'Presenti: Marco Furlan e Anna Bellini.';
  assert.equal(item(f, 'Era presente Marco Furlani.', 'Marco Furlani').suggerimento.testo, 'Marco Furlan');
});

test('nessun suggerimento quando non e\' plausibile', () => {
  assert.equal(item('Il test dura 20 minuti. Gli iscritti sono 4000.', 'Il test dura 99 minuti.', '99').suggerimento, null);
});

test('titoli e sigle: "Il Dott. Rossi", "Ing. Brandi", "CdA" non diventano nomi inesistenti', () => {
  const fonte = 'Il consiglio ha nominato Alessandro Bianchi e Marco Brandi.';
  const nomi = CF.verifica(fonte, 'Il Dott. Alessandro Bianchi e l\'Ing. Brandi hanno firmato.').items.filter(i => i.tipo === 'nome');
  assert.deepEqual(nomi.map(n => [n.testo, n.stato]), [['Alessandro Bianchi', 'ok'], ['Brandi', 'ok']]);
  const cda = CF.verifica(fonte, 'Nel CdA Alessandro Bianchi ha votato.').items.filter(i => i.tipo === 'nome');
  assert.deepEqual(cda.map(n => [n.testo, n.stato]), [['Alessandro Bianchi', 'ok']]);
});

test('articoli a inizio frase non fanno parte del nome', () => {
  const fonte = 'Il Comune di Valdicastro indice la gara. La Lombardia guida la classifica.';
  const r = CF.verifica(fonte, 'Il Comune di Valdicastro ha indetto una gara. La Lombardia e\' prima.');
  assert.deepEqual(r.items.filter(i => i.tipo === 'nome').map(i => [i.testo, i.stato]),
    [['Comune di Valdicastro', 'ok'], ['Lombardia', 'ok']]);
});

test('markdown: titoli ed etichette in grassetto non sono nomi, i numeri si controllano ancora', () => {
  const fonte = 'Il budget e\' di 4.000 euro. Responsabile: Marco Rossi.';
  const ai = '## Principali Risultati Ricerca\n\n- **Budget Totale:** 4.000 euro\n- **Responsabile:** Marco Rossi\n';
  const r = CF.verifica(fonte, ai);
  assert.deepEqual(r.items.map(i => [i.tipo, i.testo, i.stato]), [['importo', '4.000', 'ok'], ['nome', 'Marco Rossi', 'ok']]);
});

test('un numero che divide due nomi non li unisce: "Via Torino 45 Milano"', () => {
  const r = CF.verifica('Sede in Via Torino 45, Milano.', 'La sede e\' in Via Torino 45 Milano.');
  assert.deepEqual(r.items.map(i => [i.testo, i.stato]), [['Via Torino', 'ok'], ['45', 'ok'], ['Milano', 'ok']]);
});

test('nomi di piu\' parole: vicini nella fonte si accettano, lontani sono "da controllare"', () => {
  const vicino = 'Il Parco del Mercantour e\' una meta di trekking.';
  assert.equal(stato(vicino, 'Un trekking nel Parco Mercantour.', 'Parco Mercantour'), 'ok');
  const lontano = 'Anna Tonon guida il reparto vendite, un reparto con molti collaboratori, e per la logistica risponde Elisa Toffolo.';
  assert.equal(stato(lontano, 'Il responsabile e\' Elisa Tonon.', 'Elisa Tonon'), 'warn');
  assert.equal(stato('Anna Tonon e Elisa Toffolo.', 'Ha firmato Elisa Tonon.', 'Elisa Tonon'), 'warn');   // nome e cognome di due persone diverse
  assert.equal(stato('Anna Tonon e Elisa Toffolo.', 'Elisa Tonon ha firmato.', 'Elisa Tonon'), 'warn');   // anche a inizio frase
  assert.equal(stato('Presenti: Anna Tonon e Elisa Toffolo.', 'Secondo Elisa Toffolo la riunione e\' utile.', 'Elisa Toffolo'), 'ok');
});

test('citazioni: identica, riscritta, inventata', () => {
  const fonte = 'Il direttore ha dichiarato: "Non aumenteremo i prezzi fino alla fine dell\'anno" durante la conferenza.';
  assert.equal(stato(fonte, 'Ha detto: «Non aumenteremo i prezzi fino alla fine dell\'anno».', '«Non aumenteremo i prezzi fino alla fine dell\'anno»'), 'ok');
  assert.equal(stato(fonte, 'Ha detto: «Non aumenteremo i prezzi fino alla fine di quest\'anno».', '«Non aumenteremo i prezzi fino alla fine di quest\'anno»'), 'warn');
  assert.equal(stato(fonte, 'Ha detto: «Contiamo di ridurre i listini entro l\'estate prossima».', '«Contiamo di ridurre i listini entro l\'estate prossima»'), 'miss');
  assert.equal(CF.verifica(fonte, 'Ha detto "si" e "no".').items.filter(i => i.tipo === 'citazione').length, 0);   // virgolette brevi: non sono citazioni
});

test('una citazione inventata mostra il passaggio piu\' simile della fonte, fino alla fine della frase', () => {
  const contratto = EX.find(e => e.id === 'contratto');
  const c = CF.verifica(contratto.fonte, contratto.ai).items.find(i => i.tipo === 'citazione');
  assert.equal(c.stato, 'miss');
  assert.match(c.suggerimento.testo, /^Ciascuna parte può recedere con un preavviso scritto di 60 giorni$/);
  assert.equal(contratto.fonte.slice(c.suggerimento.inizio, c.suggerimento.fine), c.suggerimento.testo);
  const f = 'Il direttore ha dichiarato: "Non aumenteremo i prezzi fino alla fine dell\'anno" durante la conferenza.';
  const lontana = CF.verifica(f, 'Ha detto: «Contiamo di ridurre i listini entro l\'estate prossima».').items[0];
  assert.equal(lontana.suggerimento, null);                       // nessun passaggio simile: niente suggerimento
});

test('telefoni: stesso numero in formati diversi', () => {
  assert.equal(stato('Chiamare lo 0432 511934 in orario di ufficio.', 'Telefono: 0432-511934.', '0432-511934'), 'ok');
  assert.equal(stato('Cell. 351 595 3818.', 'Cellulare +39 351 5953818.', '+39 351 5953818'), 'ok');
  assert.equal(stato('Chiamare lo 0432 511934.', 'Telefono: 0432 511999.', '0432 511999'), 'miss');
  assert.deepEqual(CF.verifica('Chiamare lo 0432 511934.', 'Il numero 0432 511934.').items.map(i => i.tipo), ['telefono']);
});

test('riferimenti: elenchi e numero con o senza anno', () => {
  assert.equal(stato('Si vedano gli artt. 32 e 33 del regolamento.', 'Secondo gli articoli 32 e 33.', 'articoli 32 e 33'), 'ok');
  const mancante = item('Si vedano gli artt. 32 e 34.', 'Secondo gli articoli 32 e 33.', 'articoli 32 e 33');
  assert.equal(mancante.stato, 'miss');
  assert.match(mancante.motivo, /33/);
  assert.equal(stato('Circolare n. 47/2026 del 3 maggio.', 'La circolare numero 47 del 3 maggio.', 'numero 47'), 'ok');
});

test('date: in lettere, senza anno, elenchi con lo stesso mese', () => {
  assert.equal(stato('Consegna il quindici agosto duemilaventisei.', 'Consegna il 15/08/2026.', '15/08/2026'), 'ok');
  assert.equal(stato('La consegna e\' fissata per il 15 agosto 2026.', 'Consegna il quindici agosto duemilaventisei.', 'quindici agosto duemilaventisei'), 'ok');
  assert.equal(stato('Apertura il 15 agosto.', 'Apre il 15/08.', '15/08'), 'ok');
  const f = 'Gli appelli sono il 22 e 29 gennaio e il 5 febbraio.';
  const r = CF.verifica(f, 'Appelli: 22, 29 gennaio e 5 febbraio.');
  assert.deepEqual(r.items.map(i => [i.testo, i.stato]), [['22', 'ok'], ['29 gennaio', 'ok'], ['5 febbraio', 'ok']]);
  assert.equal(stato('Evento il 1° e 8 giugno 2026.', 'Evento dall\'1-8 giugno.', '8 giugno'), 'ok');
});

test('"tre" non e\' un arrotondamento di 2.847 e "sei" e\' un numero solo quando serve', () => {
  assert.equal(stato('I presenti rappresentano 2.847 millesimi.', 'Hanno votato in tre.', 'tre'), 'miss');
  assert.equal(stato('Durata di sei mesi.', 'Dura 6 mesi.', '6'), 'ok');
  assert.deepEqual(CF.estrai('Tu sei qui e sei stato bravo.').filter(x => x.cands), []);
  assert.equal(stato('Peso: 6,8 kg.', 'Il peso e\' di sei virgola otto kg.', 'sei virgola otto'), 'ok');
});

test('somme in lettere: "ventisette mila trecentoventotto" e "due milioni ottocentocinquantamila"', () => {
  assert.equal(stato('Rate da 27.328 euro.', 'Due rate da ventisette mila trecentoventotto euro.', 'ventisette mila trecentoventotto'), 'ok');
  assert.equal(stato('Totale 2.850.000 euro.', 'Totale due milioni ottocentocinquantamila euro.', 'due milioni ottocentocinquantamila'), 'ok');
});

test('orari scritti con il punto e con due punti sono lo stesso orario', () => {
  assert.equal(stato('Ora Inizio: 19.30; Ora Fine: 21.45', 'Dalle 19:30 alle 21:45.', '19:30'), 'ok');
  assert.equal(stato('Aperto dalle 9:00 alle 12:30.', 'Orari 9-12:30.', '9'), 'ok');
});

test('sigle societarie e etichette con numero non sono nomi', () => {
  const r = CF.verifica('Fornitore: Rossi Metalli.', 'Rossi Metalli SpA. Saldo 50%, Finale 20%.');
  assert.deepEqual(r.items.filter(i => i.tipo === 'nome').map(i => [i.testo, i.stato]), [['Rossi Metalli', 'ok']]);
});

test('testi lunghi con molti elementi restano veloci', () => {
  const riga = 'Il 14 marzo 2026 Anna Bellini ha speso 1.250 euro per 12 ore, poi il 15 aprile Marco Furlan 3,5 milioni. ';
  const t0 = Date.now();
  const r = CF.verifica(riga.repeat(1500), riga.repeat(1500));
  assert.ok(r.items.length > 10000);
  assert.ok(Date.now() - t0 < 8000, 'troppo lento: ' + (Date.now() - t0) + ' ms');
});
