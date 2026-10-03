/*
 * Controllo Fonti - logica di verifica.
 * Confronta un testo scritto da un'AI con il documento originale e segnala
 * numeri, date, riferimenti, nomi, email e link del testo che nella fonte non ci sono.
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

  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
    'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var MESE_RE = MESI.join('|');

  var PAROLE_NUMERO = {
    due: 2, tre: 3, quattro: 4, cinque: 5, sette: 7, otto: 8, nove: 9, dieci: 10,
    undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16,
    diciassette: 17, diciotto: 18, diciannove: 19, venti: 20, trenta: 30, quaranta: 40,
    cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90, cento: 100
  };
  var SCALE = { mila: 1e3, mille: 1e3, milione: 1e6, milioni: 1e6, miliardo: 1e9,
    miliardi: 1e9, mln: 1e6, mld: 1e9 };

  var STOP = new Set(('il lo la i gli le un uno una di a da in con su per tra fra e ed o ma che ' +
    'sono del della dei delle dello degli al alla ai alle allo nel nella nei nelle sul sulla ' +
    'sui sulle non piu come se si ha hanno era erano sara essere stato stata stati state anche ' +
    'solo gia poi dopo prima circa oltre fino entro dal dalla dai dalle dagli suo sua suoi sue ' +
    'loro questo questa questi queste quel quella quelli quelle ogni tutto tutti tutte tutta ' +
    'molto molti molte poco pochi nuovo nuova nuovi nuove euro').split(' '));

  var FILTRO_CONNETTORI = '(?:di|de|del|della|dei|degli|delle|da|dal|dalla|van|von|la|le|lo)';

  /* ---------- utilita' di testo ---------- */

  function normalizza(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mascheraSpan(testo, spans) {
    if (!spans.length) return testo;
    var arr = testo.split('');
    spans.forEach(function (s) {
      for (var i = s.inizio; i < s.fine; i++) arr[i] = ' ';
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

  function parolaDiContenuto(tk) { return !tk.num && tk.t.length >= 3 && !STOP.has(tk.t); }

  // Le radici (prime 4 lettere) delle `prima` parole di contenuto prima del numero e delle `dopo` dopo di esso.
  // Le parole vuote (articoli, preposizioni...) non contano: "2,4 milioni di euro nel primo trimestre"
  // viene letto come "primo trimestre", non come "di euro nel".
  function stemsAttorno(tokens, inizio, fine, prima, dopo) {
    var a = primoTokenDopo(tokens, inizio);
    var b = a;
    while (b < tokens.length && tokens[b].i < fine) b++;
    var set = new Set(), n = 0, k;
    for (k = a - 1; k >= 0 && n < prima; k--) {
      if (parolaDiContenuto(tokens[k])) { set.add(tokens[k].t.slice(0, 4)); n++; }
    }
    n = 0;
    for (k = b; k < tokens.length && n < dopo; k++) {
      if (parolaDiContenuto(tokens[k])) { set.add(tokens[k].t.slice(0, 4)); n++; }
    }
    return set;
  }

  function intersezione(a, b) {
    var r = false;
    a.forEach(function (x) { if (b.has(x)) r = true; });
    return r;
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

  /* ---------- estrazione ---------- */

  function aggiungiMesi(testo, lista) {
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
    var out = [];
    aggiungiMesi(testo, out);
    var mascherato = mascheraSpan(testo, out);
    var re = new RegExp('(?<![\\d])(\\d{1,2})\\s*(?:°|º)?\\s+(' + MESE_RE + ')(?:\\s+(\\d{4}))?', 'giu');
    var m;
    while ((m = re.exec(mascherato)) !== null) {
      var g = +m[1];
      if (g < 1 || g > 31) continue;
      out.push({ tipo: 'data', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        d: g, m: MESI.indexOf(m[2].toLowerCase()) + 1, y: m[3] ? +m[3] : null });
    }
    mascherato = mascheraSpan(testo, out);
    var re2 = new RegExp('(?<![\\p{L}\\d])(' + MESE_RE + ')\\s+(?:del\\s+|di\\s+)?(\\d{4})(?![\\d])', 'giu');
    while ((m = re2.exec(mascherato)) !== null) {
      out.push({ tipo: 'data', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        d: null, m: MESI.indexOf(m[1].toLowerCase()) + 1, y: +m[2] });
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
    var re = /(?<![\p{L}])(artt?\.?|articolo|commi|comma|sentenza|legge|decreto|d\.?\s?lgs\.?|n\.|n°|numero)\s*(?:n\.?\s*)?(\d+(?:[\/-]\d+)*(?:\s*(?:bis|ter|quater))?)/giu;
    var out = [], m;
    while ((m = re.exec(testo)) !== null) {
      out.push({ tipo: 'riferimento', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        chiave: chiaveRiferimento(m[1], m[2]) });
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

  function estraiCodici(testo) {
    var re = /(?<![\p{L}\d])\p{Lu}[\p{L}\d]*(?:-[\p{L}\d]+)+(?![\p{L}\d])/gu;
    var out = [], m;
    while ((m = re.exec(testo)) !== null) {
      out.push({ tipo: 'nome', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        parole: [normalizza(m[0])], iniziaFrase: false });
    }
    return out;
  }

  function estraiNumeri(testo) {
    var out = [], m;
    var re = /(?<![\p{L}\p{N}_])(\d{1,3}(?:[.  ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*(%|per\s*cento|percento))?(?:\s*(mila|mille|milioni?|miliardi?|mln|mld)(?![\p{L}]))?(?![\p{L}\p{N}_])/giu;
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
    var reP = new RegExp('(?<![\\p{L}])(' + Object.keys(PAROLE_NUMERO).join('|') + ')(?![\\p{L}-])', 'giu');
    while ((m = reP.exec(testo)) !== null) {
      out.push({ tipo: 'numero', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        cands: [PAROLE_NUMERO[m[1].toLowerCase()]], decimali: 0, scala: 1, parola: true });
    }
    return out;
  }

  function estraiNomi(testo) {
    var out = [], m;
    var reAcr = /(?<![\p{L}\d])\p{Lu}{3,}(?![\p{L}\d-])/gu;
    while ((m = reAcr.exec(testo)) !== null) {
      out.push({ tipo: 'nome', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        parole: [normalizza(m[0])], iniziaFrase: false });
    }
    var spaziAcr = mascheraSpan(testo, out);
    var parolaNome = '\\p{Lu}\\p{Ll}+(?:\\p{Lu}\\p{Ll}+)*(?:[\'’]\\p{L}+)?';       // anche "HomeClean"
    var reNome = new RegExp('(?<![\\p{L}\\d])' + parolaNome + '(?:[ \\t]+(?:' + FILTRO_CONNETTORI +
      '[ \\t]+)?' + parolaNome + ')*', 'gu');
    while ((m = reNome.exec(spaziAcr)) !== null) {
      var k = m.index - 1;                                        // ultimo carattere "vero" prima del nome
      while (k >= 0 && /[\s"'«“(\[•*\-–—]/.test(spaziAcr.charAt(k))) k--;
      var iniziaFrase = k < 0 || /[.!?:;\n]/.test(spaziAcr.charAt(k)) || spaziAcr.slice(k + 1, m.index).indexOf('\n') !== -1;
      var originali = m[0].split(/[ \t]+/).filter(function (p, n) {
        return n === 0 || !new RegExp('^' + FILTRO_CONNETTORI + '$', 'i').test(p);   // "Banca d'Italia", "Corte di Cassazione"
      });
      var parole = originali.map(normalizza);
      if (iniziaFrase && parole.length === 1) continue;           // "Il", "Secondo", "Inoltre"...
      if (parole.length === 1 && parole[0].length < 3) continue;
      out.push({ tipo: 'nome', testo: m[0], inizio: m.index, fine: m.index + m[0].length,
        parole: parole, originali: originali, iniziaFrase: iniziaFrase, frase: normalizza(m[0]) });
    }
    return out;
  }

  /* Estrae tutti gli elementi controllabili da un testo, senza sovrapposizioni. */
  function estrai(testo) {
    testo = String(testo || '');
    var tutti = [];
    var date = estraiDate(testo);          tutti = tutti.concat(date);
    var rifs = estraiRiferimenti(mascheraSpan(testo, tutti));      tutti = tutti.concat(rifs);
    var contatti = estraiContatti(mascheraSpan(testo, tutti));     tutti = tutti.concat(contatti);
    var codici = estraiCodici(mascheraSpan(testo, tutti));         tutti = tutti.concat(codici);
    var numeri = estraiNumeri(mascheraSpan(testo, tutti));         tutti = tutti.concat(numeri);
    var nomi = estraiNomi(mascheraSpan(testo, tutti.filter(function (x) { return x.tipo !== 'nome'; })));
    tutti = tutti.concat(nomi);
    tutti.sort(function (a, b) { return a.inizio - b.inizio || b.fine - a.fine; });
    var puliti = [], ultimaFine = -1;
    tutti.forEach(function (x) {
      if (x.inizio >= ultimaFine) { puliti.push(x); ultimaFine = x.fine; }
    });
    return puliti;
  }

  /* ---------- indice della fonte ---------- */

  function indicizzaFonte(testo) {
    var elementi = estrai(testo);
    var tokens = tokenizza(testo);
    var idx = { testo: testo, norm: normalizza(testo), numeri: [], date: [], rif: new Set(),
      contatti: new Set(), perValore: new Map(), arrotInteri: null, cacheArrot: {}, cacheNomi: {} };
    idx.normCompatto = idx.norm.replace(/[^a-z0-9]+/g, '');
    elementi.forEach(function (x) {
      if (x.tipo === 'numero' || x.tipo === 'percentuale' || x.tipo === 'importo') {
        var vals = [];
        x.cands.forEach(function (v) { vals.push(v * x.scala); });
        var voce = { valori: vals, grezzi: x.cands, scala: x.scala,
          ctx: stemsAttorno(tokens, x.inizio, x.fine, 2, 2), testo: x.testo };
        idx.numeri.push(voce);
        vals.forEach(function (v) {
          var k = chiaveNum(v);
          if (!idx.perValore.has(k)) idx.perValore.set(k, []);
          idx.perValore.get(k).push(voce);
        });
      } else if (x.tipo === 'data') idx.date.push(x);
      else if (x.tipo === 'riferimento') idx.rif.add(x.chiave);
      else if (x.tipo === 'email' || x.tipo === 'link') idx.contatti.add(x.chiave);
    });
    return idx;
  }

  /* ---------- confronto ---------- */

  function arrotonda(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }

  function primoPerChiave(mappa, chiave, voce) { if (!mappa.has(chiave)) mappa.set(chiave, voce); }

  function controllaNumero(x, idx, tokensAI) {
    var valoriAI = x.cands.map(function (v) { return v * x.scala; });
    var ctxAI = stemsAttorno(tokensAI, x.inizio, x.fine, 2, 2);
    var trovati = [], visti = new Set();
    valoriAI.forEach(function (a) {
      (idx.perValore.get(chiaveNum(a)) || []).forEach(function (s) {
        if (!visti.has(s)) { visti.add(s); trovati.push(s); }
      });
    });
    if (trovati.length) {
      if (!ctxAI.size || trovati.some(function (s) { return intersezione(ctxAI, s.ctx); })) {
        return { stato: 'ok', motivo: 'Compare nella fonte, in un contesto coerente.' };
      }
      return { stato: 'warn', motivo: 'Il numero compare nella fonte, ma in un altro contesto: controlla a cosa si riferisce.' };
    }
    var mant = x.cands[0], vicino;
    if (x.decimali >= 1 || x.scala > 1) {                      // "1,3 milioni" contro 1.280.000
      var chiaveCache = x.scala + '|' + x.decimali;
      if (!idx.cacheArrot[chiaveCache]) {
        var m = new Map();
        idx.numeri.forEach(function (s) {
          s.valori.forEach(function (v) {
            if (!Number.isInteger(v / x.scala) || x.scala > 1) primoPerChiave(m, chiaveNum(arrotonda(v / x.scala, x.decimali)), s);
          });
        });
        idx.cacheArrot[chiaveCache] = m;
      }
      vicino = idx.cacheArrot[chiaveCache].get(chiaveNum(mant));
    } else {
      if (!idx.arrotInteri) {
        idx.arrotInteri = new Map();
        idx.numeri.forEach(function (s) {
          s.valori.forEach(function (v) { if (!Number.isInteger(v)) primoPerChiave(idx.arrotInteri, chiaveNum(Math.round(v)), s); });
        });
      }
      vicino = idx.arrotInteri.get(chiaveNum(mant));
    }
    if (vicino) return { stato: 'warn', motivo: 'Valore arrotondato rispetto alla fonte (' + vicino.testo + ').' };
    return { stato: 'miss', motivo: 'Questo numero non compare nella fonte.' };
  }

  function controllaData(x, idx) {
    var trovata = idx.date.some(function (s) {
      if (x.d === null || s.d === null) return x.d === s.d && x.m === s.m && x.y === s.y;
      return s.d === x.d && s.m === x.m && (x.y === null || s.y === null || s.y === x.y);
    });
    if (x.d === null) {
      trovata = idx.date.some(function (s) { return s.m === x.m && s.y === x.y; });
    }
    return trovata ? { stato: 'ok', motivo: 'Questa data compare nella fonte.' }
      : { stato: 'miss', motivo: 'Questa data non compare nella fonte.' };
  }

  function controllaNome(x, idx) {
    var chiaveN = (x.frase || x.parole.join(' ')) + '|' + x.iniziaFrase;
    if (!idx.cacheNomi[chiaveN]) idx.cacheNomi[chiaveN] = valutaNome(x, idx);
    return idx.cacheNomi[chiaveN];
  }

  function valutaNome(x, idx) {
    var frase = x.frase || x.parole.join(' ');
    if (idx.norm.indexOf(frase) !== -1 || idx.normCompatto.indexOf(frase.replace(/[^a-z0-9]+/g, '')) !== -1) {
      return { stato: 'ok', motivo: 'Compare nella fonte.' };
    }
    var parole = x.parole;
    var presenti = parole.map(function (p) { return idx.norm.indexOf(p) !== -1; });
    if (parole.length === 1) return { stato: 'miss', motivo: 'Questo nome non compare nella fonte.' };
    if (presenti.every(Boolean)) {
      return { stato: 'warn', motivo: 'Le parole ci sono, ma non insieme come nel testo AI.' };
    }
    if (x.iniziaFrase && !presenti[0] && presenti.slice(1).every(Boolean)) {
      return { stato: 'ok', motivo: 'Compare nella fonte.', saltaPrimaParola: true };
    }
    var nomi = x.originali || parole;
    var mancanti = nomi.filter(function (p, i) { return !presenti[i]; });
    return { stato: 'miss', motivo: 'Nella fonte non compare: ' + mancanti.map(function (p) { return '«' + p + '»'; }).join(', ') + '.' };
  }

  function etichetta(tipo) {
    return { numero: 'numero', percentuale: 'percentuale', importo: 'importo', data: 'data',
      riferimento: 'riferimento', nome: 'nome', email: 'email', link: 'link' }[tipo] || tipo;
  }

  /* Verifica un testo AI contro la fonte. */
  function verifica(fonte, testoAI) {
    fonte = String(fonte || ''); testoAI = String(testoAI || '');
    var idx = indicizzaFonte(fonte);
    var tokensAI = tokenizza(testoAI);
    var items = estrai(testoAI).map(function (x) {
      var r;
      if (x.tipo === 'numero' || x.tipo === 'percentuale' || x.tipo === 'importo') r = controllaNumero(x, idx, tokensAI);
      else if (x.tipo === 'data') r = controllaData(x, idx);
      else if (x.tipo === 'riferimento') {
        r = idx.rif.has(x.chiave) ? { stato: 'ok', motivo: 'Questo riferimento compare nella fonte.' }
          : { stato: 'miss', motivo: 'Questo riferimento non compare nella fonte.' };
      } else if (x.tipo === 'email' || x.tipo === 'link') {
        r = idx.contatti.has(x.chiave) ? { stato: 'ok', motivo: 'Compare nella fonte.' }
          : { stato: 'miss', motivo: 'Non compare nella fonte.' };
      } else r = controllaNome(x, idx);
      var inizio = x.inizio, testoEl = x.testo;
      if (r.saltaPrimaParola) {                       // "Secondo Marco Furlan": la prima parola non e' un nome
        var taglio = testoEl.search(/[ 	]/);
        var resto = testoEl.slice(taglio).replace(/^[ 	]+/, '');
        inizio += testoEl.length - resto.length; testoEl = resto;
      }
      return { tipo: x.tipo, etichetta: etichetta(x.tipo), testo: testoEl, inizio: inizio, fine: x.fine,
        stato: r.stato, motivo: r.motivo };
    });
    var riepilogo = { totale: items.length, ok: 0, warn: 0, miss: 0 };
    items.forEach(function (i) { riepilogo[i.stato]++; });
    return { items: items, riepilogo: riepilogo };
  }

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
          i.etichetta + ') - ' + i.motivo);
      });
    }
    righe.push('');
    righe.push('Nota: il controllo verifica solo la coerenza di numeri, date e nomi con la fonte; non valuta il significato.');
    return righe.join('\n');
  }

  return { verifica: verifica, estrai: estrai, evidenzia: evidenzia, rapporto: rapporto,
    parseNumero: parseNumero, normalizza: normalizza };
});
