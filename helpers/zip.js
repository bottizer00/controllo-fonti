'use strict';
/* Costruisce un archivio zip in memoria, come farebbe Word per un .docx. Serve ai test e alla prova nel browser. */
const zlib = require('node:zlib');

/* Ogni voce e' { nome, dati, metodo }, con metodo 0 (stored) o 8 (deflate). Restituisce un ArrayBuffer. */
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


module.exports = { creaZip };
