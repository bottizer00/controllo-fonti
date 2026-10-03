/*
 * Controllo Fonti - esercizi condivisibili con un link.
 * L'esercizio viene scritto nella parte "#..." dell'indirizzo, compresso quando il browser lo permette.
 * La parte dopo il "#" non viene mai inviata a nessun server: il link funziona senza che i testi escano dal browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CondividiControlloFonti = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_TESTO = 20000;

  function aBase64Url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function daBase64Url(testo) {
    var b = testo.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    var s = atob(b), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function trasforma(bytes, flusso) {
    return new Response(new Blob([bytes]).stream().pipeThrough(flusso)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function haCompressione() {
    return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' &&
      typeof Response === 'function' && typeof Blob === 'function';
  }

  /* Controlla e ripulisce un esercizio ricevuto: viene da un link, quindi non ci si fida. */
  function valida(o) {
    if (!o || typeof o !== 'object') throw new Error('Esercizio non valido.');
    var fonte = String(o.f || ''), ai = String(o.a || '');
    if (!fonte.trim() || !ai.trim()) throw new Error('Esercizio incompleto.');
    if (fonte.length > MAX_TESTO || ai.length > MAX_TESTO) throw new Error('Esercizio troppo lungo.');
    var errori = [];
    (Array.isArray(o.e) ? o.e : []).slice(0, 200).forEach(function (e) {
      if (!Array.isArray(e)) return;
      var inizio = +e[0], fine = +e[1];
      if (!(inizio >= 0 && fine > inizio && fine <= ai.length)) return;
      errori.push({ inizio: inizio, fine: fine, testo: ai.slice(inizio, fine), strumento: true,
        spiegazione: typeof e[2] === 'string' ? e[2].slice(0, 400) : '' });
    });
    return { id: 'condiviso', titolo: String(o.t || 'Esercizio condiviso').slice(0, 120),
      descrizione: String(o.d || '').slice(0, 400), fonte: fonte, ai: ai, errori: errori,
      nota: String(o.n || '').slice(0, 600), condiviso: true };
  }

  /* Da un esercizio (titolo, fonte, ai, errori con inizio/fine) alla parte da mettere dopo il "#". */
  function codifica(es) {
    var payload = { t: es.titolo || '', d: es.descrizione || '', f: es.fonte, a: es.ai, n: es.nota || '',
      e: (es.errori || []).map(function (e) { return e.spiegazione ? [e.inizio, e.fine, e.spiegazione] : [e.inizio, e.fine]; }) };
    var bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (!haCompressione()) return Promise.resolve('p' + aBase64Url(bytes));
    return trasforma(bytes, new CompressionStream('deflate-raw')).then(function (z) { return 'z' + aBase64Url(z); });
  }

  function decodifica(testo) {
    return Promise.resolve().then(function () {
      testo = String(testo || '').replace(/^#?e=/, '');
      if (!/^[pz][A-Za-z0-9_-]+$/.test(testo)) throw new Error('Il link non contiene un esercizio.');
      var bytes;
      try { bytes = daBase64Url(testo.slice(1)); } catch (e) { throw new Error('Il link è danneggiato o incompleto.'); }
      if (testo.charAt(0) === 'p') return bytes;
      if (!haCompressione()) throw new Error('Questo browser non sa aprire il link.');
      return trasforma(bytes, new DecompressionStream('deflate-raw')).catch(function () { throw new Error('Il link è danneggiato o incompleto.'); });
    }).then(function (bytes) {
      var o;
      try { o = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('Il link non contiene un esercizio.'); }
      return valida(o);
    });
  }

  return { codifica: codifica, decodifica: decodifica, valida: valida, MAX_TESTO: MAX_TESTO };
});
