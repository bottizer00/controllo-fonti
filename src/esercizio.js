/*
 * Controllo Fonti - logica dell'esercizio "trova l'errore".
 * Divide il testo in frasi, trova gli errori inseriti e valuta le risposte. Nessuna interfaccia qui:
 * cosi' si puo' provare con i test.
 *
 * Una risposta e' fatta di elementi segnati (numeri, date, nomi, citazioni... riconosciuti dal controllo)
 * e di frasi segnate con la bandierina. Un errore "di frase" (il significato e' ribaltato, nessun numero e'
 * sbagliato) si trova solo segnando la frase; gli altri si trovano segnando l'elemento preciso.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./check.js'));
  else root.EsercizioControlloFonti = factory(root.ControlloFonti);
})(typeof self !== 'undefined' ? self : this, function (CF) {
  'use strict';

  var ABBREVIAZIONI = new Set('ing dott dr sig avv prof arch geom rag art artt n tel ecc es cfr pag ca vs on'.split(' '));

  /* Le frasi del testo, come intervalli [inizio, fine). Non spezza dopo "ing.", "art.", "n.", "S.r.l.". */
  function frasi(testo) {
    testo = String(testo || '');
    var out = [], inizio = 0, m, re = /[.!?]+["»”)]*(?=\s)|\n+/g;
    function chiudi(fine) {
      var t = testo.slice(inizio, fine);
      var a = t.length - t.replace(/^\s+/, '').length, b = t.length - t.replace(/\s+$/, '').length;
      if (t.trim()) out.push({ inizio: inizio + a, fine: fine - b });
      inizio = fine;
    }
    while ((m = re.exec(testo)) !== null) {
      if (m[0].charAt(0) !== '\n' && /^\.+$/.test(m[0].replace(/["»”)]/g, ''))) {
        var prima = /(\p{L}+)$/u.exec(testo.slice(Math.max(0, m.index - 12), m.index));
        var parola = prima ? prima[1].toLowerCase() : '';
        if (parola && (ABBREVIAZIONI.has(parola) || parola.length === 1)) continue;
      }
      chiudi(m.index + m[0].length);
    }
    chiudi(testo.length);
    return out;
  }

  // Come indexOf, ma una parola intera non si trova dentro un'altra ("tre" non e' in "oltre").
  function cerca(area, testo, da) {
    var inizio = da || 0;
    if (!/^[\p{L}\p{N}]/u.test(testo) || !/[\p{L}\p{N}]$/u.test(testo)) return area.indexOf(testo, inizio);
    var re = new RegExp('(?<![\\p{L}\\p{N}])' + testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'gu');
    re.lastIndex = inizio;
    var m = re.exec(area);
    return m ? m.index : -1;
  }

  /* Dove sta un errore nel testo AI: da "inizio"/"fine" se ci sono, altrimenti da "testo" (dentro "contesto", se serve). */
  function posizione(ai, er) {
    if (typeof er.inizio === 'number' && typeof er.fine === 'number') return { inizio: er.inizio, fine: er.fine };
    var base = 0, area = ai;
    if (er.contesto) {
      base = ai.indexOf(er.contesto);
      if (base < 0) return null;
      area = er.contesto;
    }
    var k = cerca(area, er.testo);
    return k < 0 ? null : { inizio: base + k, fine: base + k + er.testo.length };
  }

  /* Gli errori di un esercizio, con la posizione nel testo AI. */
  function errori(esempio) {
    var out = [];
    (esempio.errori || []).forEach(function (er) {
      var p = posizione(esempio.ai, er);
      if (p) out.push(Object.assign({}, er, p));
    });
    return out;
  }

  /* Gli errori che il controllo automatico trova da solo: servono per creare un esercizio dai propri testi. */
  function erroriAutomatici(fonte, ai) {
    return CF.verifica(fonte, ai).items.filter(function (i) { return i.stato !== 'ok'; }).map(function (i) {
      return { testo: i.testo, inizio: i.inizio, fine: i.fine, strumento: true,
        spiegazione: i.motivo + (i.suggerimento ? ' Nella fonte: «' + i.suggerimento.testo + '».' : '') };
    });
  }

  function sovrapposti(a, b) { return a.inizio < b.fine && a.fine > b.inizio; }

  /*
   * Valuta una risposta. scelta = { elementi: [indici in CF.estrai(ai)], frasi: [indici in frasi(ai)] }.
   * Restituisce, per ogni errore, se e' stato trovato; e quante segnalazioni erano sbagliate.
   */
  function valuta(esempio, scelta) {
    var elementi = CF.estrai(esempio.ai), fr = frasi(esempio.ai), errs = errori(esempio);
    var elSel = new Set(scelta.elementi || []), frSel = new Set(scelta.frasi || []);
    var risultati = errs.map(function (er) {
      var trovato = er.frase
        ? fr.some(function (f, i) { return frSel.has(i) && sovrapposti(f, er); })
        : elementi.some(function (el, i) { return elSel.has(i) && sovrapposti(el, er); });
      return { errore: er, trovato: trovato };
    });
    var elementiSbagliati = Array.from(elSel).filter(function (i) {
      return !errs.some(function (er) { return !er.frase && sovrapposti(elementi[i], er); });
    });
    var frasiSbagliate = Array.from(frSel).filter(function (i) {
      return !errs.some(function (er) { return sovrapposti(fr[i], er); });
    });
    var trovati = risultati.filter(function (r) { return r.trovato; }).length;
    return { risultati: risultati, trovati: trovati, totale: errs.length, mancati: errs.length - trovati,
      elementiSbagliati: elementiSbagliati, frasiSbagliate: frasiSbagliate,
      sbagliate: elementiSbagliati.length + frasiSbagliate.length };
  }

  /* Gli elementi che il controllo automatico segnala ma che non sono errori dell'esercizio (es. un calcolo corretto). */
  function allarmiInutili(esempio) {
    var errs = errori(esempio);
    return CF.verifica(esempio.fonte, esempio.ai).items.filter(function (i) {
      return i.stato !== 'ok' && !errs.some(function (er) { return sovrapposti(i, er); });
    });
  }

  return { frasi: frasi, posizione: posizione, cerca: cerca, errori: errori, erroriAutomatici: erroriAutomatici,
    valuta: valuta, allarmiInutili: allarmiInutili };
});
