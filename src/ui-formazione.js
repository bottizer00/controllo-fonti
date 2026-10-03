/* Controllo Fonti - scheda "Per la formazione": prompt da copiare. Ultimo script: avvia l'instradamento dell'indirizzo. */
(function () {
  'use strict';
  var UI = window.UI, $ = UI.$, esc = UI.esc;
  var PROMPT = window.PromptControlloFonti.PROMPT;

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
