/*
 * Controllo Fonti - lettura dei file che l'utente carica (tutto in locale, nessun invio).
 * Testo semplice (.txt, .md, .csv, .json...) e documenti Word (.docx): un .docx e' un archivio zip,
 * lo si apre con gli strumenti del browser senza librerie.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FileControlloFonti = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_FILE = 15 * 1024 * 1024;           // dimensione massima del file
  var MAX_ESPANSO = 40 * 1024 * 1024;        // dimensione massima dopo la decompressione (contro gli "zip bomba")

  function decodificaTesto(buffer) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1252').decode(buffer); }
  }

  function decodificaEntita(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, e) {
      e = e.toLowerCase();
      if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>';
      if (e === 'quot') return '"'; if (e === 'apos') return '\'';
      var cod = e.charAt(1) === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cod); } catch (x) { return ''; }
    });
  }

  /* Dal XML di un documento Word al testo: un a capo per paragrafo, tabulazioni tra le celle. */
  function xmlATesto(xml) {
    var t = xml
      .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, '')
      .replace(/<w:delText[^>]*>[\s\S]*?<\/w:delText>/g, '')           // testo cancellato con le revisioni
      .replace(/<w:tab\s*\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>\s*<\/w:tc>/g, '</w:tc>')                            // l'ultimo paragrafo di una cella non va a capo
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<[^>]+>/g, '');
    return decodificaEntita(t).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* Elenco dei file dentro lo zip (dalla "central directory"). */
  function leggiZip(buffer) {
    var v = new DataView(buffer), n = v.byteLength, eocd = -1, i;
    for (i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Il file non sembra un documento Word (.docx).');
    var totale = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true), voci = new Map();
    for (var k = 0; k < totale; k++) {
      if (p + 46 > n || v.getUint32(p, true) !== 0x02014b50) break;
      var lunNome = v.getUint16(p + 28, true), lunExtra = v.getUint16(p + 30, true), lunComm = v.getUint16(p + 32, true);
      var nome = new TextDecoder().decode(new Uint8Array(buffer, p + 46, lunNome));
      voci.set(nome, { metodo: v.getUint16(p + 10, true), compresso: v.getUint32(p + 20, true), locale: v.getUint32(p + 42, true) });
      p += 46 + lunNome + lunExtra + lunComm;
    }
    return voci;
  }

  function leggiFlusso(flusso) {
    var reader = flusso.getReader(), pezzi = [], tot = 0;
    function passo() {
      return reader.read().then(function (r) {
        if (r.done) return concatena(pezzi, tot);
        tot += r.value.length;
        if (tot > MAX_ESPANSO) { reader.cancel(); throw new Error('Il documento e\' troppo grande da aprire.'); }
        pezzi.push(r.value);
        return passo();
      });
    }
    return passo();
  }

  function concatena(pezzi, tot) {
    var out = new Uint8Array(tot), pos = 0;
    pezzi.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  function estraiVoce(buffer, voce) {
    var v = new DataView(buffer), l = voce.locale;
    if (l + 30 > buffer.byteLength || v.getUint32(l, true) !== 0x04034b50) throw new Error('Il documento Word e\' danneggiato.');
    var inizio = l + 30 + v.getUint16(l + 26, true) + v.getUint16(l + 28, true);
    var dati = new Uint8Array(buffer, inizio, voce.compresso);
    if (voce.metodo === 0) return Promise.resolve(dati);
    if (voce.metodo !== 8) throw new Error('Il documento Word usa una compressione non supportata.');
    if (typeof DecompressionStream !== 'function') throw new Error('Questo browser non sa aprire i file .docx: incolla il testo.');
    return leggiFlusso(new Blob([dati]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
  }

  /* Il testo di un .docx (corpo del documento). */
  function testoDaDocx(buffer) {
    return Promise.resolve().then(function () {
      var voci = leggiZip(buffer), corpo = voci.get('word/document.xml');
      if (!corpo) throw new Error('Il file non sembra un documento Word (.docx).');
      return estraiVoce(buffer, corpo);
    }).then(function (bytes) {
      var testo = xmlATesto(new TextDecoder().decode(bytes));
      if (!testo) throw new Error('Nel documento non ho trovato testo.');
      return testo;
    });
  }

  var TESTO_SEMPLICE = /\.(txt|md|markdown|csv|tsv|json|log|text)$/i;

  /* Legge un File scelto dall'utente (o trascinato sulla pagina): restituisce il testo. */
  function leggiFile(file) {
    var nome = file.name || '';
    if (file.size > MAX_FILE) return Promise.reject(new Error('Il file e\' troppo grande (massimo 15 MB).'));
    if (/\.pdf$/i.test(nome)) return Promise.reject(new Error('I PDF non si leggono qui: apri il PDF, copia il testo e incollalo nella casella, poi premi «Sistema da PDF».'));
    if (/\.(doc|rtf|odt|pages)$/i.test(nome)) return Promise.reject(new Error('Questo formato non e\' supportato: salva il documento come .docx o .txt, oppure incolla il testo.'));
    return file.arrayBuffer().then(function (buffer) {
      if (/\.docx$/i.test(nome)) return testoDaDocx(buffer);
      if (TESTO_SEMPLICE.test(nome) || !/\.[a-z0-9]{1,5}$/i.test(nome) || /^text\//.test(file.type || '')) return decodificaTesto(buffer);
      throw new Error('Formato non riconosciuto: usa .txt, .md, .csv, .json o .docx.');
    });
  }

  /*
   * Sistema un testo copiato da un PDF: toglie i trattini a fine riga ("riassun-" a capo "to"), unisce le righe spezzate
   * a meta' frase, scioglie le legature e toglie i trattini morbidi. I paragrafi (riga vuota), gli elenchi puntati
   * e le righe che finiscono con un punto restano come sono.
   */
  function pulisciPdf(testo) {
    var t = String(testo || '').replace(/\r\n?/g, '\n')
      .replace(/­/g, '')
      .replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl')
      .replace(/[ \t]+\n/g, '\n');
    t = t.replace(/(\p{L})[-‐‑]\n(\p{Ll})/gu, '$1$2');                                  // trattino a fine riga
    t = t.replace(/([^\n.!?:;•*\-–])\n(?=[\p{Ll}(«"“'])/gu, '$1 ');                    // riga spezzata a meta' frase
    return t.replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  return { pulisciPdf: pulisciPdf, leggiFile: leggiFile, testoDaDocx: testoDaDocx, xmlATesto: xmlATesto, decodificaTesto: decodificaTesto, MAX_FILE: MAX_FILE };
});
