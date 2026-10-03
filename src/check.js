/*
 * Controllo Fonti - logica di verifica.
 * Confronta un testo scritto da un'AI con il documento originale e segnala
 * numeri, date, orari, riferimenti, nomi, citazioni, contatti e link del testo che nella fonte non ci sono.
 * Per ogni elemento indica dove lo ha trovato nella fonte e, se manca, che cosa c'e' al suo posto.
 *
 * Nessuna dipendenza, nessuna rete: gira uguale nel browser e in Node.
 * Limite dichiarato: controlla la coerenza di numeri e parole con la fonte,
 * non capisce il significato. E' un primo filtro, non una garanzia.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ControlloFonti = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- tabelle ---------- */

  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
    'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var MESE_RE = MESI.join('|');

  // Numeri in lettere: "tre", "ventuno", "centottanta", "duemilacinquecento", "dodici mila", "un milione".
  var UNITA = { uno: 1, un: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9 };
  var DIECI = { dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16,
    diciassette: 17, diciotto: 18, diciannove: 19 };
  var DECINE = { venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80,
    novanta: 90 };
  var SCALE = { mila: 1e3, mille: 1e3, milione: 1e6, milioni: 1e6, miliardo: 1e9,
    miliardi: 1e9, mln: 1e6, mld: 1e9 };
  var SCALE_PAROLA = { mila: 1e3, milione: 1e6, milioni: 1e6, miliardo: 1e9, miliardi: 1e9 };
  // Da sole queste parole non sono numeri ("sei" e' anche un verbo, "un/uno/una" sono articoli).
  var NON_ISOLATE = { sei: 1, uno: 1, un: 1, una: 1 };
  // "sei" e' un numero dopo queste parole ("di sei mesi", "sono sei") ma non in "tu sei", "sei stato".
  var PRIMA_DI_SEI = new Set(('di per da con circa oltre ben solo soli i le gli questi queste altri altre ogni tra fra entro a ' +
    'nei nelle dei delle ai alle dai dalle sui sulle quasi almeno appena ancora sono in al tutti tutte quei quelle').split(' '));
  var DOPO_SEI_VERBO = new Set(('stato stata stati state un una uno il la lo in qui li gia davvero sempre molto troppo non mai tu ' +
    'proprio pronto pronta felice sicuro sicura').split(' '));

  var STOP = new Set(('il lo la i gli le un uno una di a da in con su per tra fra e ed o ma che ' +
    'sono del della dei delle dello degli al alla ai alle allo nel nella nei nelle sul sulla ' +
    'sui sulle non piu come se si ha hanno era erano sara essere stato stata stati state anche ' +
    'solo gia poi dopo prima circa oltre fino entro dal dalla dai dalle dagli suo sua suoi sue ' +
    'loro questo questa questi queste quel quella quelli quelle ogni tutto tutti tutte tutta ' +
    'molto molti molte poco pochi nuovo nuova nuovi nuove euro ' +
    'all dell nell sull dall coll quell quest anch com dov').split(' '));
  var UNITA_BREVI = new Set('kg mg ml cm mm km db kw mq mc gb mb tb hz lt hl ha'.split(' '));

  var FILL = '\u0001';                       // riempimento che spezza i nomi (a differenza dello spazio)
  var FILTRO_CONNETTORI = '(?:di|de|del|della|dei|degli|delle|da|dal|dalla|van|von|la|le|lo)';
  var CONNETTORI_RE = new RegExp('^' + FILTRO_CONNETTORI + '$', 'i');

  // Parole che, a inizio frase, precedono un nome senza farne parte ("Il Comune di X", "Secondo Marco Furlan").
  var DETERMINANTI = new Set(('il lo la le gli i un una uno l nel nella nei nelle del della dei delle dello degli ' +
    'al alla ai alle allo dal dalla dai dalle sul sulla sui sulle per con da in su tra fra inoltre infine ' +
    'tuttavia secondo durante dopo prima oltre anche ma se quando mentre quindi pertanto invece questo questa ' +
    'questi queste quel quella presso sotto sopra contro verso come ogni altri altre altro').split(' '));
  // Parole con la maiuscola che non sono nomi quando stanno da sole.
  var NON_NOMI = new Set(('primo prima secondo seconda terzo terza quarto quarta quinto quinta sesto sesta settimo ' +
    'ottavo nono decimo lunedi martedi mercoledi giovedi venerdi sabato domenica gennaio febbraio marzo aprile ' +
    'maggio giugno luglio agosto settembre ottobre novembre dicembre').split(' '));

  /* ---------- utilita' di testo ---------- */

  function normalizza(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mascheraSpan(testo, spans, riempi) {
    if (!spans.length) return testo;
    var arr = testo.split(''), r = riempi || ' ';
    spans.forEach(function (s) {
      for (var i = s.inizio; i < s.fine; i++) arr[i] = r;
    });
    return arr.join('');
  }

  function tokenizza(testo) {
    var re = /\p{L}+|\d+/gu, m, out = [];
    while ((m = re.exec(testo)) !== null) {
      var num = /^\d/.test(m[0]);
      out.push({ t: num ? m[0] : normalizza(m[0]), i: m.index, e: m.index + m[0].length, num: num });
    }
    return out;
  }

  function primoTokenDopo(tokens, pos) {      // primo token con fine > pos
    var lo = 0, hi = tokens.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (tokens[mid].e > pos) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  var cacheNumerali = new Map();
  function numerale(t) {                       // "tre", "ventunesimo", "virgola": non descrivono a cosa si riferisce un numero
    var r = cacheNumerali.get(t);
    if (r === undefined) { r = t === 'virgola' || valoreParola(t) !== null || valoreOrdinale(t) !== null; cacheNumerali.set(t, r); }
    return r;
  }

  function parolaDiContenuto(tk) {
    return !tk.num && (tk.t.length >= 3 || UNITA_BREVI.has(tk.t)) && !STOP.has(tk.t) && !numerale(tk.t);
  }

  function radice(tk) { return tk.t.slice(0, 4); }

  // Le radici (prime 4 lettere) delle `prima` parole di contenuto prima dell'elemento e delle `dopo` dopo di esso.
  // Le parole vuote (articoli, preposizioni...) non contano: "2,4 milioni di euro nel primo trimestre"
  // viene letto come "primo trimestre", non come "di euro nel".
  function stemsAttorno(tokens, inizio, fine, prima, dopo) {
    var a = primoTokenDopo(tokens, inizio);
    var b = a;
    while (b < tokens.length && tokens[b].i < fine) b++;
    var set = new Set(), n = 0, k;
    for (k = a - 1; k >= 0 && n < prima; k--) {         // ci si ferma al numero vicino
      if (parolaDiContenuto(tokens[k])) { set.add(radice(tokens[k])); n++; }
    }
    n = 0;
    for (k = b; k < tokens.length && n < dopo; k++) {
      if (parolaDiContenuto(tokens[k])) { set.add(radice(tokens[k])); n++; }
    }
    return set;
  }

  // Come sopra, ma per tutti gli elementi della fonte insieme: ogni parola appartiene al numero piu' vicino,
  // cosi' "due nuovi punti di consegna ... 3 addetti" attribuisce "punti di consegna" al 2 e "addetti" al 3.
  function territori(tokens, ancore, perLato) {
    return ancore.map(function (an, k) {
      var prev = ancore[k - 1], next = ancore[k + 1];
      var sx = prev ? Math.min(an.a, (prev.b + an.a) >> 1) : 0;
      var dx = next ? Math.max(an.b, (an.b + next.a + 1) >> 1) : tokens.length;
      var set = new Set(), n = 0, j;
      for (j = an.a - 1; j >= sx && n < perLato; j--) {
        if (parolaDiContenuto(tokens[j])) { set.add(radice(tokens[j])); n++; }
      }
      n = 0;
      for (j = an.b; j < dx && n < perLato; j++) {
        if (parolaDiContenuto(tokens[j])) { set.add(radice(tokens[j])); n++; }
      }
      return set;
    });
  }

  function intersezione(a, b) {
    var r = false;
    a.forEach(function (x) { if (b.has(x)) r = true; });
    return r;
  }

  function distanza(a, b, max) {              // distanza di Levenshtein, si ferma oltre `max`
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prec = [], i, j;
    for (j = 0; j <= b.length; j++) prec[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i], minimo = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (cur[j] < minimo) minimo = cur[j];
      }
      if (minimo > max) return max + 1;
      prec = cur;
    }
    return prec[b.length];
  }

  /* ---------- numeri ---------- */

  // Restituisce i valori possibili del token (formato italiano per primo, poi quello inglese).
  function parseNumero(raw) {
    var s = raw.replace(/[  ]/g, '.');
    var cands = [], decimali = 0;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {            // 1.300  1.300.000  1.300,50
      var parteDec = s.indexOf(',') >= 0 ? s.split(',')[1] : '';
      var intero = s.split(',')[0].replace(/\./g, '');
      cands.push(parseFloat(intero + (parteDec ? '.' + parteDec : '')));
      decimali = parteDec.length;
      if (!parteDec && /^\d{1,3}\.\d{3}$/.test(s)) cands.push(parseFloat(s));   // 1.300 come 1,3
    } else if (/^\d+,\d+$/.test(s)) {                      // 1,3   12,5   1,300
      cands.push(parseFloat(s.replace(',', '.')));
      decimali = s.split(',')[1].length;
      if (/^\d{1,3},\d{3}$/.test(s)) cands.push(parseFloat(s.replace(',', '')));  // 1,300 all'inglese
    } else if (/^\d+\.\d+$/.test(s)) {                     // 3.5   0.75
      cands.push(parseFloat(s));
      decimali = s.split('.')[1].length;
    } else {
      cands.push(parseFloat(s));
    }
    return { cands: cands.filter(function (v) { return isFinite(v); }), decimali: decimali };
  }

  function chiaveNum(v) { return String(Number(v.toPrecision(12))); }

  /* ---------- numeri in lettere ---------- */

  function sotto100(s) {                       // 1..99, s senza accenti
    if (UNITA[s]) return UNITA[s];
    if (DIECI[s]) return DIECI[s];
    for (var d in DECINE) {
      if (s === d) return DECINE[d];
      var base = d.slice(0, -1);               // "vent", "trent"...
      if (s.indexOf(base) !== 0) continue;
      var resto = s.slice(base.length);
      if (resto === 'uno' || resto === 'un' || resto === 'otto') return DECINE[d] + UNITA[resto];   // ventuno, ventotto
      if (resto.charAt(0) === d.slice(-1) && UNITA[resto.slice(1)]) return DECINE[d] + UNITA[resto.slice(1)];   // ventitre
    }
    return null;
  }

  function sotto1000(s) {                      // 1..999
    if (!s) return null;
    s = s.replace(/cent(?=ott)/, 'cento');     // centottanta = cento + ottanta
    var i = s.indexOf('cento'), centinaia = 0;
    if (i >= 0) {
      var testa = s.slice(0, i);
      if (testa === '') centinaia = 1;
      else if (UNITA[testa] >= 2) centinaia = UNITA[testa];
      else return null;
      s = s.slice(i + 5);
      if (!s) return centinaia * 100;
    }
    var r = sotto100(s);
    return r === null ? null : centinaia * 100 + r;
  }

  // Valore di una parola scritta in lettere (fino a 999.999), oppure null.
  function valoreParola(w) {
    w = normalizza(w);
    if (w.length < 3 || w.length > 40 || !/^[a-z]+$/.test(w)) return null;
    if (w === 'zero') return 0;
    if (w.indexOf('mille') === 0) {
      var coda = w.slice(5);
      var r = coda ? sotto1000(coda) : 0;
      return r === null ? null : 1000 + r;
    }
    var k = w.indexOf('mila');
    if (k > 0) {
      var migliaia = sotto1000(w.slice(0, k));
      if (migliaia === null || migliaia < 2) return null;
      var resto = w.slice(k + 4), r2 = resto ? sotto1000(resto) : 0;
      return r2 === null ? null : migliaia * 1000 + r2;
    }
    return sotto1000(w);
  }

  // Ordinali composti: ventesimo, cinquantesima, sessantaduesimo (primo..decimo sono troppo ambigui).
  function valoreOrdinale(w) {
    w = normalizza(w);
    var m = /^([a-z]{3,30})esim[oaie]$/.exec(w);
    if (!m) return null;
    var cand = [m[1], m[1] + 'i', m[1] + 'a', m[1] + 'o', m[1] + 'e'];
    for (var i = 0; i < cand.length; i++) {
      var v = valoreParola(cand[i]);
      if (v !== null && v >= 11) return v;
    }
    return null;
  }

  function valoreGiorno(tok) {                 // "14", "quattordici", "primo"
    if (/^\d{1,2}$/.test(tok)) return +tok >= 1 && +tok <= 31 ? +tok : null;
    var w = normalizza(tok);
    if (w === 'primo') return 1;
    if (w === 'uno') return 1;
    var v = valoreParola(w);
    return v !== null && v >= 1 && v <= 31 ? v : null;
  }

  function valoreAnno(tok) {
    if (/^\d{4}$/.test(tok)) return +tok;
    var v = valoreParola(tok);
    return v !== null && v >= 1900 && v <= 2100 ? v : null;
  }

  /* ---------- estrazione ---------- */

  function estraiCitazioni(testo) {
    var out = [], m;
    var re = /«([^«»]{15,500})»|“([^“”]{15,500})”|(?<![\p{L}\d])"([^"\n]{15,500})"(?![\p{L}\d])/gu;
    while ((m = re.exec(testo)) !== null) {
      var dentro = m[1] || m[2] || m[3];
      var parole = (dentro.match(/[\p{L}\d]+/gu) || []).map(normalizza);
      if (parole.length < 5) continue;
      out.push({ tipo: 'citazione', testo: m[0], inizio: m.index, fine: m.index + m[0].length, parole: parole });
    }
    return out;
  }

  function aggiungiDateNumeriche(testo, lista) {
    var re = new RegExp('(?<![\\d/.\\-])(\\d{1,2})\\s*[\\/.\\-]\\s*(\\d{1,2})\\s*[\\/.\\-]\\s*(\\d{4}|\\d{2})(?![\\d])', 'g');
    var m;
    while ((m = re.exec(testo)) !== null) {
      var g = +m[1], me = +m[2], a = +m[3];
      if (g < 1 || g > 31 || me < 1 || me > 12) continue;
      lista.push({ tipo: 'data', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        d: g, m: me, y: a < 100 ? 2000 + a : a });
    }
  }

  function estraiDate(testo) {
    var out = [], m;
    aggiungiDateNumeriche(testo, out);
    var mascherato = mascheraSpan(testo, out);
    // "14 marzo 2026", "1° luglio", "quindici agosto duemilaventisei"
    var re = new RegExp('(?<![\\p{L}\\d])(\\d{1,2}|\\p{L}+)\\s*[°º]?\\s+(' + MESE_RE + ')(?![\\p{L}])', 'giu');
    while ((m = re.exec(mascherato)) !== null) {
      var g = valoreGiorno(m[1]);
      if (g === null) continue;
      var fine = m.index + m[0].length, anno = null;
      var coda = /^\s+(?:del\s+|dell['’]\s?anno\s+)?(\d{4}|\p{L}+)(?![\p{L}\d])/u.exec(mascherato.slice(fine, fine + 60));
      if (coda) {
        var y = valoreAnno(coda[1]);
        if (y !== null) { anno = y; fine += coda[0].length; }
      }
      var mese = MESI.indexOf(m[2].toLowerCase()) + 1;
      out.push({ tipo: 'data', testo: testo.slice(m.index, fine), inizio: m.index, fine: fine, d: g, m: mese, y: anno });
      var da = m.index, prima;                                   // "22, 29 gennaio", "1° e 8 giugno", "dal 12 al 14 marzo"
      while ((prima = /(?<![\d\/.:\-])(\d{1,2})\s*[°º]?(?:\s*,\s*|\s+e\s+|\s+ed\s+|-|–|\s+al?\s+)$/.exec(mascherato.slice(Math.max(0, da - 14), da))) !== null) {
        var gg = +prima[1];
        if (gg < 1 || gg > 31) break;
        var ini = da - prima[0].length;
        out.push({ tipo: 'data', testo: testo.slice(ini, ini + prima[1].length), inizio: ini, fine: ini + prima[1].length,
          d: gg, m: mese, y: anno });
        da = ini;
      }
    }
    mascherato = mascheraSpan(testo, out);
    var re2 = new RegExp('(?<![\\p{L}\\d])(' + MESE_RE + ')\\s+(?:del\\s+|di\\s+)?(\\d{4})(?![\\d])', 'giu');
    while ((m = re2.exec(mascherato)) !== null) {
      out.push({ tipo: 'data', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        d: null, m: MESI.indexOf(m[1].toLowerCase()) + 1, y: +m[2] });
    }
    return out;
  }

  // Date brevi senza anno: 15/08. Si cercano dopo i riferimenti, cosi' "n. 15/2026" non viene scambiato per una data.
  function estraiDateBrevi(testo) {
    var out = [], m, re = /(?<![\d/.\-])(\d{1,2})\/(\d{1,2})(?![\d/])/g;
    while ((m = re.exec(testo)) !== null) {
      if (+m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12) continue;
      out.push({ tipo: 'data', testo: m[0], inizio: m.index, fine: m.index + m[0].length, d: +m[1], m: +m[2], y: null });
    }
    return out;
  }

  /* Orari: 9:30, 14.45 (dopo "alle", "ora", "inizio"...), 9h30, "ore 9", intervalli 9.15-13.45 e 9-12:30.
     `largo` accetta anche "alle 9". */
  var PRIMA_ORA = '(?:ore|ora|alle|dalle|delle|(?:tra|dopo|prima|entro|verso|fino|da|a)\\s+le|inizio|fine|apertura|' +
    'chiusura|partenza|arrivo|rientro|ritorno)(?:\\s*:)?';

  function oraValida(h, m) { return h >= 0 && h <= 24 && m >= 0 && m <= 59 && !(h === 24 && m > 0); }

  function estraiOrari(testo, largo) {
    var out = [], m, re;
    function aggiungi(inizio, lunghezza, h, mi) {
      if (!oraValida(h, mi)) return;
      for (var k = 0; k < out.length; k++) if (inizio < out[k].fine && inizio + lunghezza > out[k].inizio) return;
      out.push({ tipo: 'orario', testo: testo.substr(inizio, lunghezza), inizio: inizio, fine: inizio + lunghezza,
        minuti: h * 60 + mi });
    }
    re = /(?<![\d:.,\/])(\d{1,2}):(\d{2})(?![\d:])/g;
    while ((m = re.exec(testo)) !== null) aggiungi(m.index, m[0].length, +m[1], +m[2]);
    re = new RegExp('(?<![\\p{L}\\d])' + PRIMA_ORA + '(?:\\s+ore)?\\s+(\\d{1,2})\\s?[.hH]\\s?(\\d{2})(?![\\d])', 'giu');
    while ((m = re.exec(testo)) !== null) {
      var cifre = m[0].search(/\d{1,2}\s?[.hH]\s?\d{2}$/);
      aggiungi(m.index + cifre, m[0].length - cifre, +m[1], +m[2]);
    }
    re = /(?<![\d.,:\/])(\d{1,2})\.(\d{2})\s*[-–]\s*(\d{1,2})\.(\d{2})(?![\d:]|[.,]\d)/g;           // 9.15-13.45
    while ((m = re.exec(testo)) !== null) {
      var lungSecondo = m[3].length + 1 + m[4].length;
      aggiungi(m.index, m[1].length + 1 + m[2].length, +m[1], +m[2]);
      aggiungi(m.index + m[0].length - lungSecondo, lungSecondo, +m[3], +m[4]);
    }
    re = /(?<![\d.,:\/])(\d{1,2})[-–](\d{1,2}):(\d{2})(?![\d:])/g;                                       // 9-12:30
    while ((m = re.exec(testo)) !== null) aggiungi(m.index, m[1].length, +m[1], 0);
    re = new RegExp('(?<![\\p{L}\\d])(?:alle\\s+)?ore\\s+(\\d{1,2})(?![\\d:%]|[.,]\\d)', 'giu');    // "ore 9"
    while ((m = re.exec(testo)) !== null) {
      var c2 = m[0].search(/\d{1,2}$/);
      aggiungi(m.index + c2, m[0].length - c2, +m[1], 0);
    }
    if (largo) {                                                                                     // "alle 9"
      re = new RegExp('(?<![\\p{L}\\d])' + PRIMA_ORA + '\\s+(\\d{1,2})(?![\\d:%]|[.,]\\d)', 'giu');
      while ((m = re.exec(testo)) !== null) {
        var c3 = m[0].search(/\d{1,2}$/);
        aggiungi(m.index + c3, m[0].length - c3, +m[1], 0);
      }
    }
    return out;
  }

  function chiaveRiferimento(prefisso, numero) {
    var p = normalizza(prefisso).replace(/[.\s]/g, '');
    if (/^art/.test(p)) p = 'art';
    else if (/^(n|no|numero|n°)$/.test(p) || p === 'n°') p = 'n';
    else if (/^(d?lgs|dlgs)$/.test(p)) p = 'dlgs';
    else if (/^comm/.test(p)) p = 'comma';
    return p + ':' + numero.toLowerCase().replace(/\s+/g, '');
  }

  function estraiRiferimenti(testo) {
    var re = /(?<![\p{L}])(artt?\.?|articol[oi]|comm[ai]|sentenza|legge|decreto|d\.?\s?lgs\.?|n\.|n°|numero)\s*(?:n\.?\s*)?(\d+(?:\/\d+)*(?:\s*(?:bis|ter|quater))?)/giu;
    var out = [], m;
    while ((m = re.exec(testo)) !== null) {
      var fine = m.index + m[0].length, chiavi = [chiaveRiferimento(m[1], m[2])];
      if (/^(art|comm)/i.test(m[1])) {                          // "articoli 32 e 33", "artt. 32-33", "commi 1, 2"
        var seguito = /^\s*(?:,|e|ed|-|–)\s*(\d+(?:\/\d+)*)(?![\d])/;
        var s;
        while ((s = seguito.exec(testo.slice(fine))) !== null) {
          chiavi.push(chiaveRiferimento(m[1], s[1]));
          fine += s[0].length;
        }
      }
      out.push({ tipo: 'riferimento', testo: testo.slice(m.index, fine), inizio: m.index, fine: fine, chiavi: chiavi });
      re.lastIndex = fine;
    }
    return out;
  }

  function estraiContatti(testo) {
    var out = [], m;
    var reMail = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
    while ((m = reMail.exec(testo)) !== null) {
      out.push({ tipo: 'email', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        chiave: m[0].toLowerCase() });
    }
    var reUrl = /\bhttps?:\/\/[^\s)<>]+|\bwww\.[^\s)<>]+/gi;
    while ((m = reUrl.exec(testo)) !== null) {
      var t = m[0].replace(/[.,;:!?]+$/, '');
      out.push({ tipo: 'link', testo: t, inizio: m.index, fine: m.index + t.length,
        chiave: t.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') });
    }
    return out;
  }

  // Numeri di telefono: 0432 511934, 02-5645789, 351 595 3818, +39 ...
  function estraiTelefoni(testo) {
    var out = [], m;
    var re = /(?<![\d.,\/-])(?:\+39[ .-]?)?(?:0\d{1,3}[ .\/-]?\d{5,8}|0\d{1,3}(?:[ .\/-]\d{2,4}){2,3}|3\d{2}[ .\/-]?\d{3}[ .\/-]?\d{3,4})(?![\d]|[.,]\d)/g;
    while ((m = re.exec(testo)) !== null) {
      var cifre = m[0].replace(/\D/g, '').replace(/^39(?=\d{9,10}$)/, '');
      if (cifre.length < 8 || cifre.length > 11) continue;
      out.push({ tipo: 'telefono', testo: m[0], inizio: m.index, fine: m.index + m[0].length, chiave: cifre });
    }
    return out;
  }

  function estraiCodici(testo) {
    var re = /(?<![\p{L}\d])\p{Lu}[\p{L}\d]*(?:-[\p{L}\d]+)+(?![\p{L}\d])/gu;
    var out = [], m;
    while ((m = re.exec(testo)) !== null) {
      var conCifre = /\d/.test(m[0]);
      var parti = m[0].split('-').map(normalizza);
      out.push({ tipo: 'nome', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        parole: conCifre ? [normalizza(m[0])] : parti, tutte: conCifre ? [normalizza(m[0])] : parti,
        codice: conCifre, iniziaFrase: false });
    }
    return out;
  }

  function estraiNumeri(testo, opzioni) {
    var out = [], m;
    var re = /(?<![\p{L}\p{N}_])(\d{1,3}(?:[.  ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*(%|per\s*cento|percento))?(?:\s*(mila|mille|milioni?|miliardi?|mln|mld)(?![\p{L}]))?(?:[ºª]|°(?![CFcf\p{L}]))?(?:(?:kwh|kw|kg|mg|mq|mc|mm|cm|km|ml|cl|dl|gb|mb|tb|hz|min|g|l|m|h|v|w|s)(?![\p{L}\p{N}_]))?(?![\p{L}\p{N}_]|[.,]\d)/giu;
    while ((m = re.exec(testo)) !== null) {
      var inizio = m.index, fine = m.index + m[0].length;
      var dopo = testo.charAt(fine);
      var daCapo = testo.lastIndexOf('\n', inizio - 1) + 1;
      if (inizio - daCapo <= 12 && !testo.slice(daCapo, inizio).trim() && (dopo === '.' || dopo === ')')) continue;   // elenco puntato
      var p = parseNumero(m[1]);
      if (!p.cands.length) continue;
      var scala = m[3] ? SCALE[m[3].toLowerCase()] : 1;
      var tipo = m[2] ? 'percentuale' : 'numero';
      var seguito = testo.slice(fine, fine + 12), prec = testo.slice(Math.max(0, inizio - 2), inizio);
      if (/^\s*(euro|eur\b|€|dollari|\$)/i.test(seguito) || /[€$]\s*$/.test(prec)) tipo = 'importo';
      out.push({ tipo: tipo, testo: m[0], inizio: inizio, fine: fine, cands: p.cands, decimali: p.decimali,
        scala: scala });
    }
    return out.concat(estraiNumeriInLettere(testo, opzioni));
  }

  function estraiNumeriInLettere(testo, opzioni) {
    var out = [], m, parole = [];
    var reW = /(?<![\p{L}\d])\p{L}+(?![\p{L}\d])/gu;
    while ((m = reW.exec(testo)) !== null) parole.push({ i: m.index, e: m.index + m[0].length, n: normalizza(m[0]) });
    for (var q = parole.length - 2; q >= 0; q--) {                    // "settanta-quattro"
      if (DECINE[parole[q].n] && UNITA[parole[q + 1].n] && testo.slice(parole[q].e, parole[q + 1].i) === '-') {
        parole.splice(q, 2, { i: parole[q].i, e: parole[q + 1].e, n: parole[q].n + parole[q + 1].n });
      }
    }
    function vicine(a, b) { return b < parole.length && /^[ \t]+$/.test(testo.slice(parole[a].e, parole[b].i)); }
    for (var n = 0; n < parole.length; n++) {
      var p = parole[n], lw = p.n, v, j = n, scala = 1, tipo = 'numero', decimali = 0;
      if ((lw === 'un' || lw === 'uno') && vicine(n, n + 1) && SCALE_PAROLA[parole[n + 1].n] >= 1e6) {          // "un milione"
        out.push({ tipo: 'numero', testo: testo.slice(p.i, parole[n + 1].e), inizio: p.i, fine: parole[n + 1].e,
          cands: [1], decimali: 0, scala: SCALE_PAROLA[parole[n + 1].n], parola: true });
        n++; continue;
      }
      if (SCALE_PAROLA[lw]) continue;
      if (NON_ISOLATE[lw]) {
        var comeNumero = false;
        if (lw === 'sei' || lw === 'uno') {
          if (vicine(n, n + 1) && parole[n + 1].n === 'virgola' && vicine(n + 1, n + 2) && valoreParola(parole[n + 2].n) !== null) comeNumero = true;   // "sei virgola otto"
          else if (lw === 'sei' && opzioni && opzioni.seiNumero) comeNumero = true;       // nella fonte: meglio un numero in piu'
          else if (lw === 'sei' && n > 0 && vicine(n - 1, n) && PRIMA_DI_SEI.has(parole[n - 1].n) &&
            !(vicine(n, n + 1) && DOPO_SEI_VERBO.has(parole[n + 1].n))) comeNumero = true;
        }
        if (!comeNumero) continue;
      }
      v = valoreParola(lw);
      var ordinale = false;
      if (v === null) { v = valoreOrdinale(lw); ordinale = v !== null; }
      if (v === null) continue;
      if (!ordinale) {
        if (vicine(j, j + 1) && parole[j + 1].n === 'virgola' && vicine(j + 1, j + 2)) {                        // "sei virgola otto"
          var dv = valoreParola(parole[j + 2].n);
          if (dv !== null && dv <= 99) { v = parseFloat(v + '.' + dv); decimali = String(dv).length; j += 2; }
        }
        if (vicine(j, j + 1) && SCALE_PAROLA[parole[j + 1].n] && (v < 1000 || decimali) && !(parole[j + 1].n === 'mila' && v < 2)) {
          scala = SCALE_PAROLA[parole[j + 1].n]; j++;                                                           // "due milioni"
        } else if (vicine(j, j + 1) && parole[j + 1].n === 'percento') { tipo = 'percentuale'; j++; }
        else if (vicine(j, j + 1) && parole[j + 1].n === 'per' && vicine(j + 1, j + 2) && parole[j + 2].n === 'cento') {
          tipo = 'percentuale'; j += 2;                                                                         // "venti per cento"
        }
      }
      var totale = v * scala;
      if (!ordinale && !decimali && tipo === 'numero' && (scala >= 1000 || (v >= 1000 && v % 1000 === 0))) {
        var base = scala >= 1000 ? scala : 1000;                // "ventisette mila trecentoventotto" = 27.328
        while (vicine(j, j + 1) && !NON_ISOLATE[parole[j + 1].n] && !SCALE_PAROLA[parole[j + 1].n]) {
          var v2 = valoreParola(parole[j + 1].n), k2 = j + 1;
          if (v2 === null) break;
          if (vicine(k2, k2 + 1) && parole[k2 + 1].n === 'mila' && v2 >= 2 && v2 < 1000) { v2 *= 1000; k2++; }
          if (v2 >= base || v2 === 0) break;
          totale += v2; j = k2; base = Math.min(base, v2 >= 1000 ? 1000 : 1);
        }
      }
      var assorbito = totale !== v * scala;
      out.push({ tipo: tipo, testo: testo.slice(p.i, parole[j].e), inizio: p.i, fine: parole[j].e,
        cands: [assorbito ? totale : v], decimali: decimali, scala: assorbito ? 1 : scala, parola: true });
      n = j;
    }
    return out;
  }

  var TITOLI_RE = new RegExp('(?<![\\p{L}])(?:Dott\\.\\s?ssa|Dott\\.|Dottor(?:e|essa)?|Dr\\.\\s?ssa|Dr\\.|Ing\\.|Ingegner[ea]|' +
    'Avv\\.|Avvocat(?:o|essa)|Geom\\.|Geometra|Sig\\.\\s?r?a|Sig\\.\\s?na|Sig\\.|Signor(?:e|a|ina)?|Prof\\.\\s?ssa|Prof\\.|' +
    'Professor(?:e|essa)?|Arch\\.|Architett[oa]|Rag\\.|On\\.|Onorevole)(?![\\p{L}])', 'gu');

  // Parti del testo in cui le parole con la maiuscola non sono nomi: titoli markdown ("## Verbale") ed etichette in grassetto.
  function spanEtichette(testo) {
    var out = [], m, re;
    re = /^[ \t]{0,3}#{1,6}[ \t].*$/gm;
    while ((m = re.exec(testo)) !== null) out.push({ inizio: m.index, fine: m.index + m[0].length });
    re = /\*\*[^*\n]{1,80}:\*\*|\*\*[^*\n]{1,80}\*\*[ \t]*:|^[ \t]*\*\*[^*\n]{1,80}\*\*[ \t]*$/gm;
    while ((m = re.exec(testo)) !== null) out.push({ inizio: m.index, fine: m.index + m[0].length });
    return out;
  }

  function estraiNomi(testo, escl) {
    var out = [], m;
    var riempi = function (t) { return new Array(t.length + 1).join(FILL); };
    testo = testo.replace(TITOLI_RE, riempi)
      .replace(/(?<![\p{L}\d])(?:\p{Lu}\p{Ll}\p{Lu}|Srl|Spa|Snc|Sas|Scarl)(?![\p{L}\d])/gu, riempi);   // CdA, SpA, Srl
    var reAcr = /(?<![\p{L}\d])\p{Lu}{3,}(?![\p{L}\d-])/gu;
    function inEtichetta(i, f) { return escl.some(function (s) { return i >= s.inizio && f <= s.fine; }); }
    while ((m = reAcr.exec(testo)) !== null) {
      if (inEtichetta(m.index, m.index + m[0].length)) continue;
      out.push({ tipo: 'nome', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        parole: [normalizza(m[0])], tutte: [normalizza(m[0])], iniziaFrase: false });
    }
    var spaziAcr = mascheraSpan(testo, out, FILL);
    var parolaNome = '\\p{Lu}\\p{Ll}+(?:\\p{Lu}\\p{Ll}*)*(?:[\'’]\\p{L}+)?';       // anche "HomeClean", "CdA"
    var reNome = new RegExp('(?<![\\p{L}\\d])' + parolaNome + '(?:[ \\t]+(?:' + FILTRO_CONNETTORI +
      '[ \\t]+)?' + parolaNome + ')*', 'gu');
    while ((m = reNome.exec(spaziAcr)) !== null) {
      if (inEtichetta(m.index, m.index + m[0].length)) continue;
      var k = m.index - 1;                                        // ultimo carattere "vero" prima del nome
      while (k >= 0 && /[\s"'«“(\[•*\-–—]/.test(spaziAcr.charAt(k))) k--;
      var iniziaFrase = k < 0 || /[.!?:;\n]/.test(spaziAcr.charAt(k)) || spaziAcr.slice(k + 1, m.index).indexOf('\n') !== -1;
      var tutteOr = m[0].split(/[ \t]+/);
      var originali = tutteOr.filter(function (p, n) { return n === 0 || !CONNETTORI_RE.test(p); });   // "Banca d'Italia"
      var parole = originali.map(normalizza), tutte = tutteOr.map(normalizza);
      if (iniziaFrase && parole.length === 1) continue;           // "Il", "Secondo", "Inoltre"...
      if (parole.length === 1 && (parole[0].length < 3 || NON_NOMI.has(parole[0]))) continue;
      if (parole.length === 1 && /^[ 	]*(?:\d|)/.test(spaziAcr.slice(m.index + m[0].length, m.index + m[0].length + 12))) continue;   // "Finale 20%", "Test 5"

      out.push({ tipo: 'nome', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        parole: parole, tutte: tutte, originali: originali, iniziaFrase: iniziaFrase });
    }
    return out;
  }

  /* Estrae tutti gli elementi controllabili da un testo, senza sovrapposizioni.
     opzioni.senzaCitazioni: per la fonte, dove le citazioni non vanno trattate come un blocco. */
  function estrai(testo, opzioni) {
    testo = String(testo || '');
    var tutti = [];
    function passo(fn) { tutti = tutti.concat(fn(mascheraSpan(testo, tutti), opzioni)); }
    if (!(opzioni && opzioni.senzaCitazioni)) passo(estraiCitazioni);
    passo(estraiDate);
    passo(estraiOrari);
    passo(estraiTelefoni);
    passo(estraiRiferimenti);
    passo(estraiDateBrevi);
    passo(estraiContatti);
    passo(estraiCodici);
    passo(estraiNumeri);
    var nomi = estraiNomi(mascheraSpan(testo, tutti.filter(function (x) { return x.tipo !== 'nome'; }), FILL),
      spanEtichette(testo));
    tutti = tutti.concat(nomi);
    tutti.sort(function (a, b) { return a.inizio - b.inizio || b.fine - a.fine; });
    var puliti = [], ultimaFine = -1;
    tutti.forEach(function (x) {
      if (x.inizio >= ultimaFine) { puliti.push(x); ultimaFine = x.fine; }
    });
    return puliti;
  }

  /* ---------- indice della fonte ---------- */

  var ANCORE = { numero: 1, percentuale: 1, importo: 1, data: 1, orario: 1, riferimento: 1, telefono: 1 };

  function span(v) { return v ? { inizio: v.inizio, fine: v.fine, testo: v.testo } : null; }

  function indicizzaFonte(testo) {
    var elementi = estrai(testo, { senzaCitazioni: true, seiNumero: true });
    var tokens = tokenizza(testo);
    var norm = normalizza(testo);
    var idx = { testo: testo, norm: norm, allineato: norm.length === testo.length, tokens: tokens,
      numeri: [], date: [], orari: new Map(), orariLista: [], rif: new Map(), contatti: new Map(), telefoni: new Map(),
      nomi: [], nomiParole: new Set(), parolePos: new Map(), perValore: new Map(), perStem: new Map(),
      arrotInteri: null, cacheArrot: {}, cacheNomi: {}, cacheFrasi: {}, trigrammi: null };
    idx.normSpazi = ' ' + norm.replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
    tokens.forEach(function (tk, k) {
      if (tk.num) return;
      if (!idx.parolePos.has(tk.t)) idx.parolePos.set(tk.t, []);
      idx.parolePos.get(tk.t).push(k);
    });

    var ancore = [];
    elementi.forEach(function (x) {
      if (!ANCORE[x.tipo]) return;
      var a = primoTokenDopo(tokens, x.inizio), b = a;
      while (b < tokens.length && tokens[b].i < x.fine) b++;
      ancore.push({ el: x, a: a, b: b });
    });
    var ctxs = territori(tokens, ancore, 6);
    ancore.forEach(function (an, k) {                              // le 2+2 parole piu' vicine, piu' tutto il "territorio"
      var vicino = stemsAttorno(tokens, an.el.inizio, an.el.fine, 2, 2);
      ctxs[k].forEach(function (st) { vicino.add(st); });
      an.el.ctx = vicino;
    });

    function registra(voce) {
      voce.ctx.forEach(function (st) {
        if (!idx.perStem.has(st)) idx.perStem.set(st, []);
        idx.perStem.get(st).push(voce);
      });
    }

    elementi.forEach(function (x) {
      if (x.tipo === 'numero' || x.tipo === 'percentuale' || x.tipo === 'importo') {
        var vals = x.cands.map(function (v) { return v * x.scala; });
        var voce = { fam: x.tipo === 'percentuale' ? 'pct' : 'num', valori: vals, primario: vals[0], scala: x.scala,
          decimali: x.decimali, ctx: x.ctx, testo: x.testo, inizio: x.inizio, fine: x.fine, chiave: chiaveNum(vals[0]) };
        idx.numeri.push(voce);
        registra(voce);
        vals.forEach(function (v) {
          var kk = chiaveNum(v);
          if (!idx.perValore.has(kk)) idx.perValore.set(kk, []);
          idx.perValore.get(kk).push(voce);
        });
      } else if (x.tipo === 'data') {
        x.fam = 'data'; x.chiave = x.d + '/' + x.m + '/' + x.y;
        idx.date.push(x); registra(x);
        [x.y, x.d].forEach(function (parte, k) {                  // "dal 2025" trova "ottobre 2025", "il 14" trova "14 marzo"
          var t = parte === null ? null : String(parte), pos = -1;
          if (t === null) return;
          pos = k === 0 ? x.testo.lastIndexOf(t) : x.testo.indexOf(t);
          if (pos < 0 || (k === 0 && x.testo.slice(pos).length !== t.length)) return;
          var voceParte = { fam: 'num', valori: [parte], primario: parte, scala: 1, decimali: 0, ctx: x.ctx, testo: t,
            inizio: x.inizio + pos, fine: x.inizio + pos + t.length, chiave: chiaveNum(parte), daData: true };
          var kk = chiaveNum(parte);
          if (!idx.perValore.has(kk)) idx.perValore.set(kk, []);
          idx.perValore.get(kk).push(voceParte);
        });
      } else if (x.tipo === 'orario') {
        x.fam = 'orario'; x.chiave = String(x.minuti);
        if (!idx.orari.has(x.minuti)) idx.orari.set(x.minuti, x);
        idx.orariLista.push(x); registra(x);
      } else if (x.tipo === 'riferimento') {
        x.chiavi.forEach(function (c) {
          if (!idx.rif.has(c)) idx.rif.set(c, x);
          var base = c.replace(/\/\d{4}$/, '');                       // "n:47/2026" vale anche per "n:47"
          if (base !== c && !idx.rif.has(base)) idx.rif.set(base, x);
        });
      } else if (x.tipo === 'email' || x.tipo === 'link') {
        if (!idx.contatti.has(x.chiave)) idx.contatti.set(x.chiave, x);
      } else if (x.tipo === 'telefono') {
        if (!idx.telefoni.has(x.chiave)) idx.telefoni.set(x.chiave, x);
      } else if (x.tipo === 'nome') {
        idx.nomi.push(x);
        x.parole.forEach(function (p) { idx.nomiParole.add(p); });
      }
    });
    estraiOrari(testo, true).forEach(function (o) {                    // anche "alle 9"
      if (!idx.orari.has(o.minuti)) idx.orari.set(o.minuti, o);
    });
    return idx;
  }

  /* ---------- confronto ---------- */

  function arrotonda(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }

  function primoPerChiave(mappa, chiave, voce) { if (!mappa.has(chiave)) mappa.set(chiave, voce); }

  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Posizione di una sequenza di parole nella fonte (le parole devono essere separate solo da segni di punteggiatura o spazi).
  function trovaFrase(idx, tutte) {
    var parole = tutte.join(' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!parole.length) return null;
    var chiave = parole.join(' ');
    if (idx.normSpazi.indexOf(' ' + chiave + ' ') === -1) return null;
    if (!idx.allineato) return { inizio: 0, fine: 0, senzaPosizione: true };
    if (idx.cacheFrasi[chiave] === undefined) {
      var re = new RegExp('(?<![\\p{L}\\p{N}])' + parole.map(reEsc).join('[^\\p{L}\\p{N}]+') + '(?![\\p{L}\\p{N}])', 'u');
      var m = re.exec(idx.norm);
      idx.cacheFrasi[chiave] = m ? { inizio: m.index, fine: m.index + m[0].length } : { inizio: 0, fine: 0, senzaPosizione: true };
    }
    return idx.cacheFrasi[chiave];
  }

  function spanFrase(idx, pos) {
    if (!pos || pos.senzaPosizione) return null;
    return { inizio: pos.inizio, fine: pos.fine, testo: idx.testo.slice(pos.inizio, pos.fine) };
  }

  // La voce della fonte piu' vicina, per contesto, a quello del testo AI. `ammesso` esclude le voci non plausibili:
  // una correzione sbagliata e' peggio di nessuna correzione.
  function suggerisci(idx, fam, ctxAI, ammesso, punteggio, minimo) {
    var punti = new Map();
    ctxAI.forEach(function (st) {
      (idx.perStem.get(st) || []).forEach(function (v) {
        if (v.fam !== fam || (ammesso && !ammesso(v))) return;
        punti.set(v, (punti.get(v) || 0) + 1);
      });
    });
    var migliore = null, max = 0, pari = false;
    punti.forEach(function (n, v) {
      if (punteggio) n += punteggio(v);
      if (n > max) { max = n; migliore = v; pari = false; }
      else if (n === max && migliore && v.chiave !== migliore.chiave) pari = true;
    });
    return max >= (minimo || 1) && !pari ? migliore : null;
  }

  function controllaNumero(x, idx, ctxAI, tokensAI) {
    var fam = x.tipo === 'percentuale' ? 'pct' : 'num';
    var valoriAI = x.cands.map(function (v) { return v * x.scala; });
    var simile = function (v) {                                          // stessa grandezza: 12% e 8% si', 2450 e "tre" no
      var a = Math.abs(valoriAI[0]), b = Math.abs(v.primario);
      return !a || !b || Math.max(a, b) / Math.min(a, b) <= 3;
    };
    var trovati = [], visti = new Set();
    valoriAI.forEach(function (a) {
      (idx.perValore.get(chiaveNum(a)) || []).forEach(function (s) {
        if (!visti.has(s)) { visti.add(s); trovati.push(s); }
      });
    });
    if (trovati.length) {
      var buona = !ctxAI.size ? trovati[0] : trovati.filter(function (s) { return !s.ctx.size || intersezione(ctxAI, s.ctx); })[0];
      if (buona) return { stato: 'ok', motivo: 'Compare nella fonte, in un contesto coerente.', fonte: span(buona) };
      var sug = suggerisci(idx, fam, ctxAI, function (v) { return !visti.has(v) && simile(v); }, null, 2);   // il numero c'e' gia' altrove: servono prove forti
      return { stato: 'warn', motivo: 'Il numero compare nella fonte, ma in un altro contesto: controlla a cosa si riferisce.',
        fonte: span(trovati[0]), suggerimento: span(sug) };
    }
    var c0 = x.cands[0];
    if (x.scala === 1) {                                                // "19.30" contro "19:30", "alle 9" contro "9:00"
      var ore = Math.floor(c0), minuti = Math.round((c0 - ore) * 100);
      if (x.decimali === 2 && oraValida(ore, minuti) && idx.orari.has(ore * 60 + minuti)) {
        return { stato: 'ok', motivo: 'Compare nella fonte come orario.', fonte: span(idx.orari.get(ore * 60 + minuti)) };
      }
      if (x.decimali === 0 && Number.isInteger(c0) && idx.orari.has(c0 * 60)) {
        var k = primoTokenDopo(tokensAI, x.inizio) - 1;
        if (k >= 0 && /^(alle|dalle|delle|ore|le)$/.test(tokensAI[k].t)) {
          return { stato: 'ok', motivo: 'Compare nella fonte come orario.', fonte: span(idx.orari.get(c0 * 60)) };
        }
      }
    }
    var vicino;
    if (x.decimali >= 1 || x.scala > 1) {                      // "1,3 milioni" contro 1.280.000
      var chiaveCache = x.scala + '|' + x.decimali;
      if (!idx.cacheArrot[chiaveCache]) {
        var m = new Map();
        idx.numeri.forEach(function (s) {
          var v = s.primario;
          if (!Number.isInteger(v / x.scala) || x.scala > 1) primoPerChiave(m, chiaveNum(arrotonda(v / x.scala, x.decimali)), s);
        });
        idx.cacheArrot[chiaveCache] = m;
      }
      vicino = idx.cacheArrot[chiaveCache].get(chiaveNum(c0));
    } else {
      if (!idx.arrotInteri) {
        idx.arrotInteri = new Map();
        idx.numeri.forEach(function (s) {
          if (!Number.isInteger(s.primario)) primoPerChiave(idx.arrotInteri, chiaveNum(Math.round(s.primario)), s);
        });
      }
      vicino = idx.arrotInteri.get(chiaveNum(c0));
    }
    if (vicino) return { stato: 'warn', motivo: 'Valore arrotondato rispetto alla fonte (' + vicino.testo + ').', fonte: span(vicino) };
    return { stato: 'miss', motivo: 'Questo numero non compare nella fonte.', suggerimento: span(suggerisci(idx, fam, ctxAI, simile)) };
  }

  function controllaOrario(x, idx) {
    var o = idx.orari.get(x.minuti);
    if (o) return { stato: 'ok', motivo: 'Questo orario compare nella fonte.', fonte: span(o) };
    var h = Math.floor(x.minuti / 60), mi = x.minuti % 60, scritto = idx.perValore.get(chiaveNum(h + mi / 100));
    if (scritto && scritto.some(function (v) { return v.decimali === 2; })) {                      // "19:30" contro "19.30"
      return { stato: 'ok', motivo: 'Compare nella fonte (scritto come numero decimale).', fonte: span(scritto[0]) };
    }
    return { stato: 'miss', motivo: 'Questo orario non compare nella fonte.' };       // nessun suggerimento: troppo spesso sbagliato
  }

  function controllaData(x, idx, ctxAI) {
    var trovata = null;
    if (x.d === null) {
      trovata = idx.date.filter(function (s) { return s.m === x.m && s.y === x.y; })[0];
    } else {
      trovata = idx.date.filter(function (s) {
        if (s.d === null) return false;
        return s.d === x.d && s.m === x.m && (x.y === null || s.y === null || s.y === x.y);
      })[0];
    }
    if (trovata) return { stato: 'ok', motivo: 'Questa data compare nella fonte.', fonte: span(trovata) };
    var sug = suggerisci(idx, 'data', ctxAI, null, function (v) {
      return (v.m === x.m ? (v.y === x.y ? 2 : 1) : 0) + (v.d === x.d && x.d !== null ? 1 : 0);
    });
    if (!sug) {                                                  // nessun contesto in comune: stesso mese e stesso anno
      var simili = idx.date.filter(function (s) { return s.m === x.m && s.y === x.y && s.d !== null; });
      if (simili.length === 1 && x.d !== null) sug = simili[0];
    }
    return { stato: 'miss', motivo: 'Questa data non compare nella fonte.', suggerimento: span(sug) };
  }

  function controllaRiferimento(x, idx) {
    var mancanti = x.chiavi.filter(function (c) { return !idx.rif.has(c); });
    if (!mancanti.length) return { stato: 'ok', motivo: 'Questo riferimento compare nella fonte.', fonte: span(idx.rif.get(x.chiavi[0])) };
    var prefisso = x.chiavi[0].split(':')[0];
    var stessi = [];
    idx.rif.forEach(function (v, c) { if (c.split(':')[0] === prefisso && stessi.indexOf(v) === -1) stessi.push(v); });
    var sug = stessi.length === 1 ? stessi[0] : null;
    return { stato: 'miss', motivo: x.chiavi.length > 1 ? 'Nella fonte manca: ' + mancanti.map(function (c) { return c.split(':')[1]; }).join(', ') + '.'
      : 'Questo riferimento non compare nella fonte.', suggerimento: span(sug) };
  }

  function controllaNome(x, idx) {
    var chiaveN = x.tutte.join(' ') + '|' + x.iniziaFrase + '|' + !!x.codice;
    if (!idx.cacheNomi[chiaveN]) idx.cacheNomi[chiaveN] = valutaNome(x, idx);
    return idx.cacheNomi[chiaveN];
  }

  // Le parole sono presenti nella fonte a breve distanza l'una dall'altra (in qualunque ordine)?
  function vicineNellaFonte(idx, parole) {
    if (parole.length === 2) {                // nomi di due parole: attaccate, o separate solo da connettori e parole maiuscole
      var A = idx.parolePos.get(parole[0]) || [], B = idx.parolePos.get(parole[1]) || [];
      return A.some(function (p) {
        return B.some(function (q) {
          var lo = Math.min(p, q), hi = Math.max(p, q);
          if (hi === lo || hi - lo > 5) return false;
          if (!/^[\p{L}'’ \t]*$/u.test(idx.testo.slice(idx.tokens[lo].e, idx.tokens[hi].i))) return false;   // niente virgole, punti, cifre
          for (var k = lo + 1; k < hi; k++) {                                                              // "Parco Nazionale del Mercantour"
            if (!CONNETTORI_RE.test(idx.tokens[k].t) && !/^\p{Lu}/u.test(idx.testo.charAt(idx.tokens[k].i))) return false;
          }
          return true;
        });
      });
    }
    var finestra = 4 * (parole.length - 1);
    var liste = parole.map(function (p) { return idx.parolePos.get(p) || []; });
    var ordine = liste.map(function (l, i) { return i; }).sort(function (a, b) { return liste[a].length - liste[b].length; });
    var base = liste[ordine[0]];
    return base.some(function (pos) {
      return ordine.slice(1).every(function (i) { return liste[i].some(function (q) { return Math.abs(q - pos) <= finestra; }); });
    });
  }

  function valutaParole(parole, originali, idx) {
    // Una parola che nella fonte c'e' solo in minuscolo non e' un nome ("Partenza", "Laurea"): e' la maiuscola da titolo dell'AI.
    var nomeLike = parole.map(function (p) { return !idx.parolePos.has(p) || idx.nomiParole.has(p); });
    if (!nomeLike.every(Boolean)) {
      if (!nomeLike.some(Boolean)) return { stato: 'ok', motivo: 'Parole comuni presenti nella fonte.' };
      parole = parole.filter(function (p, i) { return nomeLike[i]; });
      originali = originali.filter(function (p, i) { return nomeLike[i]; });
    }
    var presenti = parole.map(function (p) { return idx.parolePos.has(p); });
    if (parole.length === 1) {
      return presenti[0] ? { stato: 'ok', motivo: 'Compare nella fonte.', fonte: posParola(idx, parole[0]) }
        : { stato: 'miss', motivo: 'Questo nome non compare nella fonte.' };
    }
    var mancanti = originali.filter(function (p, i) { return !presenti[i]; });
    if (mancanti.length) {
      return { stato: 'miss', motivo: 'Nella fonte non compare: ' + mancanti.map(function (p) { return '«' + p + '»'; }).join(', ') + '.' };
    }
    if (vicineNellaFonte(idx, parole)) return { stato: 'ok', motivo: 'Le parole compaiono vicine nella fonte.', fonte: posParola(idx, parole[0]) };
    return { stato: 'warn', motivo: 'Le parole ci sono, ma non vicine come nel testo AI.', fonte: posParola(idx, parole[0]) };
  }

  function posParola(idx, parola) {
    var l = idx.parolePos.get(parola);
    if (!l || !l.length) return null;
    var tk = idx.tokens[l[0]];
    return { inizio: tk.i, fine: tk.e, testo: idx.testo.slice(tk.i, tk.e) };
  }

  function valutaNome(x, idx) {
    if (x.codice) {
      var pc = trovaFrase(idx, x.tutte);
      return pc ? { stato: 'ok', motivo: 'Compare nella fonte.', fonte: spanFrase(idx, pc) }
        : { stato: 'miss', motivo: 'Questo codice non compare nella fonte.' };
    }
    if (x.iniziaFrase && x.parole.length >= 2) {            // "Il Comune di X", "Secondo Marco Furlan": la prima parola non e' un nome
      var resto = x.tutte.slice(1), restoPar = x.parole.slice(1), restoOr = (x.originali || x.parole).slice(1);
      if (DETERMINANTI.has(x.parole[0]) || !idx.parolePos.has(x.parole[0])) {
        var p2 = trovaFrase(idx, resto);
        var r = p2 ? { stato: 'ok', motivo: 'Compare nella fonte.', fonte: spanFrase(idx, p2) } : valutaParole(restoPar, restoOr, idx);
        r.saltaPrimaParola = true;
        return r;
      }
    }
    var pos = trovaFrase(idx, x.tutte);
    if (pos) return { stato: 'ok', motivo: 'Compare nella fonte.', fonte: spanFrase(idx, pos) };
    return valutaParole(x.parole, x.originali || x.parole, idx);
  }

  function suggerisciNome(x, idx) {
    if (x.codice || !x.originali && x.parole.length === 1 && x.parole[0].length < 3) return null;
    var parole = x.parole;
    if (parole.length >= 2) {                                // stesso nome di battesimo o stesso cognome: "Elisa Tonon" -> "Elisa Toffolo"
      var migliore = null, max = 0, pari = false;
      idx.nomi.forEach(function (s) {
        if (s.parole.length < 2) return;
        var comuni = parole.filter(function (p) { return s.parole.indexOf(p) !== -1; }).length;
        if (comuni === 0 || comuni === parole.length) return;
        if (comuni > max) { max = comuni; migliore = s; pari = false; }
        else if (comuni === max && migliore && s.testo !== migliore.testo) pari = true;
      });
      return max >= 1 && !pari ? span(migliore) : null;
    }
    var p = parole[0], tolleranza = p.length >= 8 ? 2 : p.length >= 5 ? 1 : 0, trovato = null, n = 0;   // errore di battitura
    if (!tolleranza) return null;
    idx.nomiParole.forEach(function (q) {
      if (q !== p && distanza(p, q, tolleranza) <= tolleranza) { trovato = q; n++; }
    });
    if (n !== 1) return null;
    return span(idx.nomi.filter(function (s) { return s.parole.indexOf(trovato) !== -1; })[0]);
  }

  function controllaCitazione(x, idx) {
    var pos = trovaFrase(idx, x.parole);
    if (pos) return { stato: 'ok', motivo: 'La citazione compare nella fonte, parola per parola.', fonte: spanFrase(idx, pos) };
    if (!idx.trigrammi) {
      var parole = idx.tokens.map(function (t) { return t.t; });
      idx.trigrammi = new Set();
      for (var i = 0; i + 2 < parole.length; i++) idx.trigrammi.add(parole[i] + ' ' + parole[i + 1] + ' ' + parole[i + 2]);
    }
    var tot = 0, comuni = 0;
    for (var j = 0; j + 2 < x.parole.length; j++) {
      tot++;
      if (idx.trigrammi.has(x.parole[j] + ' ' + x.parole[j + 1] + ' ' + x.parole[j + 2])) comuni++;
    }
    if (tot && comuni / tot >= 0.6) {
      return { stato: 'warn', motivo: 'La citazione e\' quasi uguale alla fonte ma non identica: potrebbe essere stata riscritta.' };
    }
    return { stato: 'miss', motivo: 'Questa citazione non compare nella fonte: potrebbe essere inventata o parafrasata.' };
  }

  function etichetta(tipo) {
    return { numero: 'numero', percentuale: 'percentuale', importo: 'importo', data: 'data', orario: 'orario',
      riferimento: 'riferimento', nome: 'nome', email: 'email', link: 'link', telefono: 'telefono',
      citazione: 'citazione' }[tipo] || tipo;
  }

  /* Verifica un testo AI contro la fonte. */
  function verifica(fonte, testoAI) {
    fonte = String(fonte || ''); testoAI = String(testoAI || '');
    var idx = indicizzaFonte(fonte);
    var tokensAI = tokenizza(testoAI);
    var budget = 400;                                               // le correzioni suggerite si calcolano per i primi casi
    var items = estrai(testoAI).map(function (x) {
      var r, ctxAI = new Set();
      if (ANCORE[x.tipo]) ctxAI = stemsAttorno(tokensAI, x.inizio, x.fine, 2, 2);
      if (x.tipo === 'numero' || x.tipo === 'percentuale' || x.tipo === 'importo') r = controllaNumero(x, idx, ctxAI, tokensAI);
      else if (x.tipo === 'data') r = controllaData(x, idx, ctxAI);
      else if (x.tipo === 'orario') r = controllaOrario(x, idx);
      else if (x.tipo === 'riferimento') r = controllaRiferimento(x, idx);
      else if (x.tipo === 'citazione') r = controllaCitazione(x, idx);
      else if (x.tipo === 'email' || x.tipo === 'link') {
        r = idx.contatti.has(x.chiave) ? { stato: 'ok', motivo: 'Compare nella fonte.', fonte: span(idx.contatti.get(x.chiave)) }
          : { stato: 'miss', motivo: 'Non compare nella fonte.' };
      } else if (x.tipo === 'telefono') {
        r = idx.telefoni.has(x.chiave) ? { stato: 'ok', motivo: 'Questo numero di telefono compare nella fonte.', fonte: span(idx.telefoni.get(x.chiave)) }
          : { stato: 'miss', motivo: 'Questo numero di telefono non compare nella fonte.' };
      } else {
        r = controllaNome(x, idx);
        if (r.stato !== 'ok' && budget-- > 0) r = Object.assign({}, r, { suggerimento: suggerisciNome(x, idx) });
      }
      var inizio = x.inizio, testoEl = x.testo;
      if (r.saltaPrimaParola) {                       // "Secondo Marco Furlan": la prima parola non e' un nome
        var taglio = testoEl.search(/[ \t]/);
        var resto = testoEl.slice(taglio).replace(/^[ \t]+/, '');
        inizio += testoEl.length - resto.length; testoEl = resto;
      }
      return { tipo: x.tipo, etichetta: etichetta(x.tipo), testo: testoEl, inizio: inizio, fine: x.fine,
        stato: r.stato, motivo: r.motivo, fonte: r.fonte || null, suggerimento: r.suggerimento || null };
    });
    var riepilogo = { totale: items.length, ok: 0, warn: 0, miss: 0 };
    items.forEach(function (i) { riepilogo[i.stato]++; });
    return { items: items, riepilogo: riepilogo };
  }

  /* ---------- presentazione ---------- */

  /* Testo AI con gli elementi evidenziati (HTML sicuro: tutto il testo e' escapato). */
  function evidenzia(testoAI, items) {
    testoAI = String(testoAI || '');
    var html = '', pos = 0;
    items.forEach(function (it, n) {
      html += escapeHtml(testoAI.slice(pos, it.inizio));
      html += '<mark class="s-' + it.stato + '" data-i="' + n + '" tabindex="0" title="' +
        escapeHtml(it.etichetta + ': ' + it.motivo) + '">' + escapeHtml(testoAI.slice(it.inizio, it.fine)) + '</mark>';
      pos = it.fine;
    });
    return html + escapeHtml(testoAI.slice(pos));
  }

  /* La fonte con evidenziati i passaggi indicati: spans = [{inizio, fine, classe}] (HTML sicuro). */
  function evidenziaFonte(fonte, spans) {
    fonte = String(fonte || '');
    var html = '', pos = 0;
    spans.slice().sort(function (a, b) { return a.inizio - b.inizio; }).forEach(function (s) {
      if (s.inizio < pos || s.fine > fonte.length || s.fine <= s.inizio) return;
      html += escapeHtml(fonte.slice(pos, s.inizio));
      html += '<mark class="' + escapeHtml(s.classe || 'f-trovato') + '" data-fonte="1">' + escapeHtml(fonte.slice(s.inizio, s.fine)) + '</mark>';
      pos = s.fine;
    });
    return html + escapeHtml(fonte.slice(pos));
  }

  /* Un po' di testo prima e dopo l'elemento, per riconoscerlo in un elenco. */
  function contestoItem(testo, it, raggio) {
    raggio = raggio || 55;
    var da = Math.max(0, it.inizio - raggio), a = Math.min(testo.length, it.fine + raggio);
    var prima = testo.slice(da, it.inizio), dopo = testo.slice(it.fine, a);
    if (da > 0) prima = prima.replace(/^\S*\s/, '');
    if (a < testo.length) dopo = dopo.replace(/\s\S*$/, '');
    var pulisci = function (s) { return s.replace(/\s+/g, ' '); };
    return { prima: (da > 0 ? '… ' : '') + pulisci(prima), testo: testo.slice(it.inizio, it.fine),
      dopo: pulisci(dopo) + (a < testo.length ? ' …' : '') };
  }

  /* Rapporto in testo semplice, da copiare e incollare. */
  function rapporto(risultato) {
    var r = risultato.riepilogo, righe = [];
    righe.push('Controllo Fonti - rapporto');
    righe.push('Elementi controllati: ' + r.totale);
    righe.push('Verificati: ' + r.ok + ' | Da controllare: ' + r.warn + ' | Non trovati nella fonte: ' + r.miss);
    var da = risultato.items.filter(function (i) { return i.stato !== 'ok'; });
    if (da.length) {
      righe.push('');
      da.forEach(function (i) {
        righe.push((i.stato === 'miss' ? '[NON TROVATO] ' : '[DA CONTROLLARE] ') + '"' + i.testo + '" (' +
          i.etichetta + ') - ' + i.motivo + (i.suggerimento ? ' Nella fonte: "' + i.suggerimento.testo + '".' : ''));
      });
    }
    righe.push('');
    righe.push('Nota: il controllo verifica solo la coerenza di numeri, date e nomi con la fonte; non valuta il significato.');
    return righe.join('\n');
  }

  return { verifica: verifica, estrai: estrai, evidenzia: evidenzia, evidenziaFonte: evidenziaFonte,
    contestoItem: contestoItem, rapporto: rapporto, parseNumero: parseNumero, normalizza: normalizza };
});
