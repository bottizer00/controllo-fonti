/* Controllo Fonti - scheda "Per la formazione": prompt da copiare. Ultimo script: avvia l'instradamento dell'indirizzo. */
(function () {
  'use strict';
  var UI = window.UI, $ = UI.$, esc = UI.esc;

  var PROMPT = [
    { titolo: 'Riassunto che cita le frasi',
      testo: 'Riassumi il documento qui sotto in al massimo 8 punti. Per ogni punto indica, tra parentesi, la frase del documento da cui lo ricavi. ' +
        'Se un\'informazione non è nel documento scrivi «non indicato». Non fare calcoli e non fare deduzioni: riporta numeri, date e nomi esattamente come sono scritti.\n\n[incolla qui il documento]' },
    { titolo: 'Estrazione di dati in tabella',
      testo: 'Dal documento qui sotto estrai in una tabella: scadenze, importi, persone con il loro ruolo. Una riga per ogni dato, con una colonna che riporta ' +
        'la frase originale da cui l\'hai preso, copiata alla lettera. Se un dato manca scrivi «non presente», non lo ricostruire.\n\n[incolla qui il documento]' },
    { titolo: 'Controllo incrociato della risposta',
      testo: 'Rileggi la risposta che mi hai appena dato. Per ogni numero, data e nome indica la frase del documento che lo conferma. ' +
        'Poi elenca separatamente quelli che non riesci a collegare a una frase del documento, senza giustificarli.' }
  ];

  var box = $('prompt-elenco');
  PROMPT.forEach(function (p, i) {
    var d = document.createElement('div');
    d.className = 'prompt';
    d.innerHTML = '<div class="prompt-testa"><strong>' + esc(p.titolo) + '</strong>' +
      '<span><button type="button" class="secondario piccolo" data-copia="' + i + '">Copia</button> <span class="esito" role="status" id="esito-prompt-' + i + '"></span></span></div>' +
      '<p>' + esc(p.testo) + '</p>';
    box.appendChild(d);
  });
  box.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-copia]');
    if (!b) return;
    var i = +b.getAttribute('data-copia');
    UI.copia(PROMPT[i].testo).then(function (ok) {
      $('esito-prompt-' + i).textContent = ok ? 'Copiato.' : 'Copia non riuscita.';
    });
  });

  UI.avvia();
})();
