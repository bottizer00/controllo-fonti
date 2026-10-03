'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const F = require('../src/file.js');

/* Costruisce uno zip in memoria (come farebbe Word): ogni voce e' { nome, dati, metodo } con metodo 0 (stored) o 8 (deflate). */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function creaZip(voci) {
  const locali = [], centrali = [];
  let offset = 0;
  voci.forEach(v => {
    const nome = Buffer.from(v.nome), dati = Buffer.from(v.dati);
    const compresso = v.metodo === 8 ? zlib.deflateRawSync(dati) : dati;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0, 6); h.writeUInt16LE(v.metodo, 8);
    h.writeUInt32LE(crc32(dati), 14); h.writeUInt32LE(compresso.length, 18); h.writeUInt32LE(dati.length, 22);
    h.writeUInt16LE(nome.length, 26);
    locali.push(h, nome, compresso);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(v.metodo, 10);
    c.writeUInt32LE(crc32(dati), 16); c.writeUInt32LE(compresso.length, 20); c.writeUInt32LE(dati.length, 24);
    c.writeUInt16LE(nome.length, 28); c.writeUInt32LE(offset, 42);
    centrali.push(c, nome);
    offset += 30 + nome.length + compresso.length;
  });
  const dir = Buffer.concat(centrali);
  const fine = Buffer.alloc(22);
  fine.writeUInt32LE(0x06054b50, 0); fine.writeUInt16LE(voci.length, 8); fine.writeUInt16LE(voci.length, 10);
  fine.writeUInt32LE(dir.length, 12); fine.writeUInt32LE(offset, 16);
  const tutto = Buffer.concat([...locali, dir, fine]);
  return tutto.buffer.slice(tutto.byteOffset, tutto.byteOffset + tutto.length);
}

const W = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>';
const doc = corpo => W + corpo + '</w:body></w:document>';
const p = testo => '<w:p><w:r><w:t xml:space="preserve">' + testo + '</w:t></w:r></w:p>';

test('docx: paragrafi, accenti ed entita\'', async () => {
  const xml = doc(p('Verbale del 14 marzo 2026') + p('Utile: 3,5 milioni &amp; dividendi &lt; 1&apos;000 &#8364;') + p('Perché sì: è già così'));
  const zip = creaZip([{ nome: '[Content_Types].xml', dati: '<x/>', metodo: 8 }, { nome: 'word/document.xml', dati: xml, metodo: 8 }]);
  assert.equal(await F.testoDaDocx(zip), 'Verbale del 14 marzo 2026\nUtile: 3,5 milioni & dividendi < 1\'000 €\nPerché sì: è già così');
});

test('docx: voce non compressa (stored)', async () => {
  const zip = creaZip([{ nome: 'word/document.xml', dati: doc(p('Testo semplice')), metodo: 0 }]);
  assert.equal(await F.testoDaDocx(zip), 'Testo semplice');
});

test('docx: tabelle con celle separate da tabulazioni, tabulazioni e a capo nel paragrafo', async () => {
  const tabella = '<w:tbl><w:tr><w:tc>' + p('Voce') + '</w:tc><w:tc>' + p('Importo') + '</w:tc></w:tr><w:tr><w:tc>' + p('Cablaggio') +
    '</w:tc><w:tc>' + p('1.440 euro') + '</w:tc></w:tr></w:tbl>';
  const riga = '<w:p><w:r><w:t>Prima</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>dopo</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>riga nuova</w:t></w:r></w:p>';
  const testo = await F.testoDaDocx(creaZip([{ nome: 'word/document.xml', dati: doc(tabella + riga), metodo: 8 }]));
  assert.match(testo, /^Voce\tImporto\nCablaggio\t1\.440 euro/);
  assert.match(testo, /Prima\tdopo\nriga nuova/);
});

test('docx: il testo cancellato con le revisioni e i campi non compaiono', async () => {
  const corpo = '<w:p><w:r><w:t>Resta </w:t></w:r><w:del w:id="1"><w:r><w:delText>cancellato </w:delText></w:r></w:del>' +
    '<w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:t>visibile</w:t></w:r></w:p>';
  assert.equal(await F.testoDaDocx(creaZip([{ nome: 'word/document.xml', dati: doc(corpo), metodo: 8 }])), 'Resta visibile');
});

test('docx: file che non e\' un documento Word, vuoto o troppo grande', async () => {
  await assert.rejects(F.testoDaDocx(new TextEncoder().encode('non e\' uno zip').buffer), /Word/);
  await assert.rejects(F.testoDaDocx(creaZip([{ nome: 'altro.xml', dati: '<x/>', metodo: 8 }])), /Word/);
  await assert.rejects(F.testoDaDocx(creaZip([{ nome: 'word/document.xml', dati: doc(''), metodo: 8 }])), /testo/);
  await assert.rejects(F.testoDaDocx(new ArrayBuffer(10)), /Word/);
});

test('docx: uno zip "bomba" (dati enormi molto compressi) viene fermato', async () => {
  const enorme = 'a'.repeat(50 * 1024 * 1024);
  const zip = creaZip([{ nome: 'word/document.xml', dati: doc(p(enorme)), metodo: 8 }]);
  assert.ok(zip.byteLength < 200 * 1024, 'lo zip di prova doveva essere piccolo: ' + zip.byteLength);
  await assert.rejects(F.testoDaDocx(zip), /troppo grande/);
});

test('testo semplice: utf-8, utf-8 con BOM, windows-1252', () => {
  assert.equal(F.decodificaTesto(new TextEncoder().encode('Perché è già così €').buffer), 'Perché è già così €');
  assert.equal(F.decodificaTesto(Uint8Array.from([0xef, 0xbb, 0xbf, 0x63, 0x69, 0x61, 0x6f]).buffer), 'ciao');
  const win = Uint8Array.from([0x50, 0x65, 0x72, 0x63, 0x68, 0xe9, 0x20, 0xe8]);   // "Perché è" in windows-1252
  assert.equal(F.decodificaTesto(win.buffer), 'Perché è');
});

function fileFinto(nome, contenuto, tipo) {
  const buf = typeof contenuto === 'string' ? new TextEncoder().encode(contenuto) : new Uint8Array(contenuto);
  return { name: nome, size: buf.length, type: tipo || '', arrayBuffer: () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)) };
}

test('leggiFile: sceglie il lettore dall\'estensione e spiega cosa non legge', async () => {
  assert.equal(await F.leggiFile(fileFinto('appunti.txt', 'Riunione del 14 marzo')), 'Riunione del 14 marzo');
  assert.equal(await F.leggiFile(fileFinto('dati.csv', 'a;b\n1;2')), 'a;b\n1;2');
  assert.equal(await F.leggiFile(fileFinto('verbale.docx', creaZip([{ nome: 'word/document.xml', dati: doc(p('Dal DOCX')), metodo: 8 }]))), 'Dal DOCX');
  await assert.rejects(F.leggiFile(fileFinto('scheda.pdf', 'x')), /PDF.*copia il testo/);
  await assert.rejects(F.leggiFile(fileFinto('vecchio.doc', 'x')), /\.docx/);
  await assert.rejects(F.leggiFile(fileFinto('foto.png', 'x', 'image/png')), /Formato/);
  const grande = fileFinto('grande.txt', 'x'); grande.size = F.MAX_FILE + 1;
  await assert.rejects(F.leggiFile(grande), /troppo grande/);
});
