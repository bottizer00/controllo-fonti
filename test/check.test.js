'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CF = require('../src/check.js');

const stati = (fonte, ai) => CF.verifica(fonte, ai).items.map(i => [i.testo, i.stato]);
const stato = (fonte, ai, testo) => {
  const it = CF.verifica(fonte, ai).items.find(i => i.testo === testo);
  assert.ok(it, 'elemento non estratto: ' + testo);
  return it.stato;
};

test('numeri: formato italiano e inglese', () => {
  assert.deepEqual(CF.parseNumero('1.300').cands, [1300, 1.3]);
  assert.deepEqual(CF.parseNumero('1,3').cands, [1.3]);
  assert.deepEqual(CF.parseNumero('1.300,50').cands, [1300.5]);
  assert.deepEqual(CF.parseNumero('12.500.000').cands, [12500000]);
  assert.deepEqual(CF.parseNumero('3.5').cands, [3.5]);
  assert.deepEqual(CF.parseNumero('1,300').cands, [1.3, 1300]);
  assert.equal(CF.parseNumero('12,5').decimali, 1);
});

test('numero uguale nello stesso contesto: verificato', () => {
  assert.equal(stato('Il test ha 5 prove e dura 20 minuti.', 'Il test ha 5 prove.', '5'), 'ok');
});

test('numero assente dalla fonte: non trovato', () => {
  assert.equal(stato('Il test ha 5 prove.', 'Il test ha 4 prove.', '4'), 'miss');
});

test('numero presente ma in un altro contesto: da controllare', () => {
  const fonte = 'Si aprono due nuovi punti di consegna entro giugno e si assumono 3 addetti.';
  assert.equal(stato(fonte, 'Si aprono tre nuovi punti di consegna.', 'tre'), 'warn');
});

test('parole-numero equivalgono alle cifre', () => {
  assert.equal(stato('Si assumono 3 addetti amministrativi.', 'Assunti tre addetti amministrativi.', 'tre'), 'ok');
  assert.equal(stato('Previsti due incontri di formazione.', 'Previsti 2 incontri di formazione.', '2'), 'ok');
});

test('percentuali: uguale, diversa, "per cento"', () => {
  assert.equal(stato('La crescita e\' stata dell\'8% sul 2025.', 'Crescita del 8%.', '8%'), 'ok');
  assert.equal(stato('La crescita e\' stata dell\'8% sul 2025.', 'Crescita del 12%.', '12%'), 'miss');
  assert.equal(stato('Cresce del 8 per cento.', 'Cresce dell\'8%.', '8%'), 'ok');
});

test('scale: "1,3 milioni" equivale a 1.300.000', () => {
  assert.equal(stato('Il fatturato e\' di 1.300.000 euro.', 'Fatturato di 1,3 milioni di euro.', '1,3 milioni'), 'ok');
});

test('arrotondamento: 1,3 milioni contro 1.280.000 e\' da controllare', () => {
  assert.equal(stato('Il fatturato e\' di 1.280.000 euro.', 'Fatturato di 1,3 milioni di euro.', '1,3 milioni'), 'warn');
});

test('arrotondamento di un intero su un decimale della fonte', () => {
  assert.equal(stato('Il peso e\' di 3,2 kg.', 'Pesa 3 kg.', '3'), 'warn');
});

test('importi: formato con migliaia e simbolo euro', () => {
  const r = CF.verifica('Budget approvato: 180.000 euro.', 'Budget di 180.000 euro.');
  assert.equal(r.items[0].tipo, 'importo');
  assert.equal(r.items[0].stato, 'ok');
  assert.equal(stato('Prezzo 349 euro.', 'Costa 399 euro.', '399'), 'miss');
});

test('elenchi puntati numerati non sono numeri da verificare', () => {
  const r = CF.verifica('Tre punti.', '1. Primo punto\n2. Secondo punto');
  assert.equal(r.items.filter(i => i.tipo === 'numero').length, 0);
});

test('date: formati diversi sono la stessa data', () => {
  assert.equal(stato('Riunione del 14 marzo 2026.', 'Il 14/03/2026 si e\' riunito il comitato.', '14/03/2026'), 'ok');
  assert.equal(stato('Riunione del 14/03/2026.', 'Il 14 marzo 2026 si e\' riunito il comitato.', '14 marzo 2026'), 'ok');
});

test('date: giorno diverso non trovato', () => {
  assert.equal(stato('Prossima riunione l\'11 aprile 2026.', 'Prossima riunione il 18 aprile 2026.', '18 aprile 2026'), 'miss');
});

test('date: anno diverso non trovato, anno mancante nella fonte accettato', () => {
  assert.equal(stato('Scadenza 5 maggio 2025.', 'Scadenza 5 maggio 2026.', '5 maggio 2026'), 'miss');
  assert.equal(stato('Scadenza 5 maggio.', 'Scadenza 5 maggio 2026.', '5 maggio 2026'), 'ok');
});

test('date: mese e anno', () => {
  assert.equal(stato('Consegna prevista a giugno 2026.', 'Consegna a giugno 2026.', 'giugno 2026'), 'ok');
  assert.equal(stato('Consegna prevista a giugno 2026.', 'Consegna a luglio 2026.', 'luglio 2026'), 'miss');
});

test('le date non producono anche numeri duplicati', () => {
  const r = CF.verifica('Il 14 marzo 2026.', 'Il 14 marzo 2026.');
  assert.equal(r.items.length, 1);
});

test('riferimenti normativi', () => {
  assert.equal(stato('Vale l\'articolo 4 del regolamento.', 'Vale l\'art. 4.', 'art. 4'), 'ok');
  assert.equal(stato('Vale l\'articolo 4 del regolamento.', 'Vale l\'art. 9.', 'art. 9'), 'miss');
  assert.equal(stato('Sentenza n. 15/2026.', 'Come da sentenza n. 2026/15.', 'sentenza n. 2026/15'), 'miss');
});

test('nomi: presente, assente, parole separate', () => {
  const fonte = 'Presenti: Anna Bellini e Marco Furlan.';
  assert.equal(stato(fonte, 'Ha parlato Anna Bellini.', 'Anna Bellini'), 'ok');
  assert.equal(stato(fonte, 'Ha parlato Elisa Tonon.', 'Elisa Tonon'), 'miss');
  assert.equal(stato(fonte, 'Ha parlato Anna Furlan.', 'Anna Furlan'), 'warn');
});

test('nomi: la prima parola di una frase non e\' un nome', () => {
  const r = CF.verifica('Marco Furlan ha parlato.', 'Inoltre ha parlato Marco Furlan. Secondo Marco Furlan serve tempo.');
  assert.deepEqual(r.items.map(i => i.testo), ['Marco Furlan', 'Marco Furlan']);
  assert.ok(r.items.every(i => i.stato === 'ok'));
});

test('nomi: sigle e codici', () => {
  assert.equal(stato('Il modello RX-200 e il test WISC.', 'Il modello RX-200.', 'RX-200'), 'ok');
  assert.equal(stato('Il modello RX-200.', 'Il modello RX-300.', 'RX-300'), 'miss');
  assert.equal(stato('Si usa il test WISC.', 'Si usa il BHK.', 'BHK'), 'miss');
});

test('i codici non generano numeri', () => {
  const r = CF.verifica('Modello RX-200.', 'Modello RX-200.');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].tipo, 'nome');
});

test('email e link', () => {
  assert.equal(stato('Scrivere a info@azienda.it.', 'Contatto: info@azienda.it', 'info@azienda.it'), 'ok');
  assert.equal(stato('Scrivere a info@azienda.it.', 'Contatto: vendite@azienda.it', 'vendite@azienda.it'), 'miss');
  assert.equal(stato('Vedi www.esempio.it/guida', 'Fonte: https://www.esempio.it/guida.', 'https://www.esempio.it/guida'), 'ok');
  assert.equal(stato('Vedi www.esempio.it/guida', 'Fonte: www.esempio.it/altro', 'www.esempio.it/altro'), 'miss');
});

test('riepilogo e rapporto', () => {
  const r = CF.verifica('Il test ha 5 prove.', 'Il test ha 4 prove e 5 punti.');
  assert.equal(r.riepilogo.totale, r.items.length);
  assert.equal(r.riepilogo.ok + r.riepilogo.warn + r.riepilogo.miss, r.riepilogo.totale);
  const testo = CF.rapporto(r);
  assert.match(testo, /Controllo Fonti - rapporto/);
  assert.match(testo, /NON TROVATO\] "4"/);
  assert.match(testo, /non valuta il significato/);
});

test('evidenzia: HTML sicuro e posizioni corrette', () => {
  const ai = 'Il <b>test</b> ha 4 prove & 5 punti.';
  const r = CF.verifica('Il test ha 5 prove.', ai);
  const html = CF.evidenzia(ai, r.items);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;test&lt;/b&gt;'));
  assert.ok(html.includes('&amp;'));
  assert.ok(html.includes('class="s-miss"'));
  assert.equal(html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'), ai);
});

test('input vuoti e strani non danno errore', () => {
  assert.deepEqual(CF.verifica('', '').items, []);
  assert.deepEqual(CF.verifica('abc', '').items, []);
  assert.doesNotThrow(() => CF.verifica(null, undefined));
  assert.doesNotThrow(() => CF.verifica('12', '\u0000 \n\n ((( 999999999999999999999 )))'));
});

test('testi lunghi: tempi ragionevoli', () => {
  const frase = 'Il progetto ha coinvolto 12 persone nel 2025 con un budget di 45.000 euro. Marco Furlan ha coordinato. ';
  const fonte = frase.repeat(1500);
  const ai = (frase + 'Il 7 luglio 2026 si prevede un costo di 51.000 euro. ').repeat(1500);
  const t0 = Date.now();
  const r = CF.verifica(fonte, ai);
  assert.ok(Date.now() - t0 < 8000, 'troppo lento: ' + (Date.now() - t0) + ' ms');
  assert.ok(r.riepilogo.miss > 0);
});

test('stati senza sovrapposizioni tra elementi', () => {
  const r = CF.verifica('x', 'Il 14 marzo 2026 Anna Bellini ha speso 1.300 euro (art. 4) su info@a.it e www.b.it.');
  for (let i = 1; i < r.items.length; i++) assert.ok(r.items[i].inizio >= r.items[i - 1].fine);
});

test('regressione: gli articoli a inizio frase non sono nomi', () => {
  const r = CF.verifica("Il test esiste.", "Il test esiste. La prova no. Le cose cambiano. Lo dice Marco.");
  assert.deepEqual(r.items.map(i => i.testo), ['Marco']);
});

test('regressione: le parole vuote non rompono il contesto di un numero', () => {
  const fonte = "Il fatturato del primo trimestre è stato di 2,4 milioni di euro.";
  const ai = 'Presentato un fatturato di 2,4 milioni di euro nel primo trimestre.';
  assert.equal(stato(fonte, ai, '2,4 milioni'), 'ok');
});

test("i nomi con connettore restano interi: Corte di Cassazione", () => {
  const r = CF.verifica('Decide la Corte di Cassazione.', 'Come stabilito dalla Corte di Cassazione.');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].testo, 'Corte di Cassazione');
  assert.equal(r.items[0].stato, 'ok');
});

test("il motivo di un nome mancante mostra la parola come scritta dall'AI", () => {
  const r = CF.verifica("Presenti: Elisa Toffolo.", "Ha parlato Elisa Tonon.");
  assert.equal(r.items[0].stato, 'miss');
  assert.match(r.items[0].motivo, /«Tonon»/);
});
