/* Controllo Fonti - parti comuni dell'interfaccia: schede, messaggi, copia negli appunti. Nessuna rete, nessun salvataggio. */
(function () {
  'use strict';
  var UI = window.UI = {};
  var $ = UI.$ = function (id) { return document.getElementById(id); };

  UI.esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  UI.parole = function (testo) {
    var m = String(testo).trim().match(/\S+/g);
    return m ? m.length : 0;
  };

  UI.messaggio = function (el, testo, tipo) {
    el.textContent = testo || '';
    el.className = 'messaggio' + (tipo ? ' ' + tipo : '');
  };

  UI.riduceMovimento = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* Porta un elemento a un terzo dell'altezza di un contenitore scorrevole, senza spostare la pagina. */
  UI.scorriDentro = function (contenitore, el) {
    var r = el.getBoundingClientRect(), c = contenitore.getBoundingClientRect();
    contenitore.scrollTop += (r.top - c.top) - contenitore.clientHeight / 3;
  };

  UI.copia = function (testo) {
    function riserva() {
      return new Promise(function (ok) {
        var t = document.createElement('textarea');
        t.value = testo; t.setAttribute('readonly', ''); t.className = 'nascosto';
        document.body.appendChild(t); t.select();
        var fatto = false;
        try { fatto = document.execCommand('copy'); } catch (e) { fatto = false; }
        document.body.removeChild(t);
        ok(fatto);
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(testo).then(function () { return true; }, riserva);
    }
    return riserva();
  };

  /* ---------- schede ---------- */
  var NOMI = ['strumento', 'esercizio', 'formazione', 'come'];

  UI.mostraScheda = function (nome, opzioni) {
    opzioni = opzioni || {};
    if (NOMI.indexOf(nome) === -1) nome = 'strumento';
    NOMI.forEach(function (n) {
      var attiva = n === nome, t = $('t-' + n);
      t.setAttribute('aria-selected', attiva ? 'true' : 'false');
      t.setAttribute('tabindex', attiva ? '0' : '-1');
      t.classList.toggle('attiva', attiva);
      $('p-' + n).hidden = !attiva;
    });
    if (opzioni.focus) $('t-' + nome).focus();
    if (opzioni.hash !== false && window.history && history.replaceState) {
      history.replaceState(null, '', nome === 'strumento' ? location.pathname + location.search : '#' + nome);
    }
  };

  NOMI.forEach(function (n, i) {
    var t = $('t-' + n);
    t.addEventListener('click', function () { UI.mostraScheda(n); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, vai = -1;
      if (k === 'ArrowRight') vai = (i + 1) % NOMI.length;
      else if (k === 'ArrowLeft') vai = (i + NOMI.length - 1) % NOMI.length;
      else if (k === 'Home') vai = 0;
      else if (k === 'End') vai = NOMI.length - 1;
      if (vai >= 0) { UI.mostraScheda(NOMI[vai], { focus: true }); e.preventDefault(); }
    });
  });

  /* Alla partenza e quando cambia l'indirizzo: #esercizio, #formazione, #come oppure #e=... (esercizio condiviso). */
  function instrada() {
    var h = location.hash || '';
    if (/^#e=/.test(h)) {
      UI.mostraScheda('esercizio', { hash: false });
      if (UI.apriCondiviso) UI.apriCondiviso(h);
      return true;
    }
    var nome = h.replace(/^#/, '');
    if (NOMI.indexOf(nome) !== -1) { UI.mostraScheda(nome, { hash: false }); return true; }
    return false;
  }

  UI.avvia = function () { return instrada(); };
  window.addEventListener('hashchange', instrada);
})();
