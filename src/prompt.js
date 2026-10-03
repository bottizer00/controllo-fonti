/*
 * Controllo Fonti - prompt pronti da dare a un'AI per ottenere risposte piu' facili da controllare.
 * Riducono gli errori, non li eliminano: dopo si controlla comunque.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PromptControlloFonti = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEGNAPOSTO = '[incolla qui il documento]';

  var PROMPT = [
    { id: 'riassunto', titolo: 'Riassunto che cita le frasi', conDocumento: true,
      testo: 'Riassumi il documento qui sotto in al massimo 8 punti. Per ogni punto indica, tra parentesi, la frase del documento da cui lo ricavi. ' +
        'Se un\'informazione non è nel documento scrivi «non indicato». Non fare calcoli e non fare deduzioni: riporta numeri, date e nomi esattamente come sono scritti.\n\n' + SEGNAPOSTO },
    { id: 'dati', titolo: 'Estrazione di dati in tabella', conDocumento: true,
      testo: 'Dal documento qui sotto estrai in una tabella: scadenze, importi, persone con il loro ruolo. Una riga per ogni dato, con una colonna che riporta ' +
        'la frase originale da cui l\'hai preso, copiata alla lettera. Se un dato manca scrivi «non presente», non lo ricostruire.\n\n' + SEGNAPOSTO },
    { id: 'controllo', titolo: 'Controllo incrociato della risposta', conDocumento: false,
      testo: 'Rileggi la risposta che mi hai appena dato. Per ogni numero, data e nome indica la frase del documento che lo conferma. ' +
        'Poi elenca separatamente quelli che non riesci a collegare a una frase del documento, senza giustificarli.' }
  ];

  /* Il prompt con il documento al posto del segnaposto (o in fondo, se il segnaposto non c'e'). */
  function componi(prompt, documento) {
    var d = String(documento || '').trim();
    if (!prompt.conDocumento) return prompt.testo;
    return prompt.testo.indexOf(SEGNAPOSTO) !== -1 ? prompt.testo.replace(SEGNAPOSTO, d) : prompt.testo + '\n\n' + d;
  }

  return { PROMPT: PROMPT, componi: componi, SEGNAPOSTO: SEGNAPOSTO };
});
