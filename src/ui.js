/* Controllo Fonti - interfaccia. Nessuna rete, nessun salvataggio: i testi restano in questa pagina. */
(function () {
  'use strict';
  var CF = window.ControlloFonti, ESEMPI = window.EsempiControlloFonti;
  var $ = function (id) { return document.getElementById(id); };
  var SEGNO = { ok: '✓', warn: '⚠', miss: '✗' };
  var ultimoRisultato = null;

  /* ---------- schede ---------- */
  var schede = [['t-strumento', 'p-strumento'], ['t-esercizio', 'p-esercizio'], ['t-come', 'p-come']];
  function mostraScheda(idTab) {
    schede.forEach(function (c) {
      var attiva = c[0] === idTab;
      $(c[0]).setAttribute('aria-selected', attiva ? 'true' : 'false');
      $(c[0]).classList.toggle('attiva', attiva);
      $(c[1]).hidden = !attiva;
    });
  }
  schede.forEach(function (c) {
    $(c[0]).addEventListener('click', function () { mostraScheda(c[0]); });
    $(c[0]).addEventListener('keydown', function (e) {
      var i = schede.map(function (x) { return x[0]; }).indexOf(c[0]);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var n = schede[(i + (e.key === 'ArrowRight' ? 1 : schede.length - 1)) % schede.length][0];
        mostraScheda(n); $(n).focus(); e.preventDefault();
      }
    });
  });

  /* ---------- strumento ---------- */
  function riempiSelect(sel, conVuoto) {
    sel.innerHTML = '';
    if (conVuoto) {
      var v = document.createElement('option'); v.value = ''; v.textContent = 'Scegli un esempio…'; sel.appendChild(v);
    }
    ESEMPI.forEach(function (e) {
      var o = document.createElement('option'); o.value = e.id; o.textContent = e.titolo; sel.appendChild(o);
    });
  }

  function trovaEsempio(id) { return ESEMPI.filter(function (e) { return e.id === id; })[0]; }

  function chip(classe, n, testo) {
    return '<li class="' + classe + '"><span class="n">' + n + '</span>' + testo + '</li>';
  }

  function verifica() {
    var r = CF.verifica($('fonte').value, $('ai').value);
    ultimoRisultato = r;
    var box = $('risultato');
    box.hidden = false;
    var ris = r.riepilogo;
    $('riepilogo').innerHTML = ris.totale === 0
      ? '<li class="s-warn">Nel testo AI non ho trovato numeri, date o nomi da controllare.</li>'
      : chip('s-ok', ris.ok, 'verificati') + chip('s-warn', ris.warn, 'da controllare') + chip('s-miss', ris.miss, 'non trovati');
    $('evidenziato').innerHTML = CF.evidenzia($('ai').value, r.items);
    var da = r.items.filter(function (i) { return i.stato !== 'ok'; });
    var html = '';
    if (!da.length && ris.totale) html = '<p class="nessuno">Tutti gli elementi controllati compaiono nella fonte. Ricorda che il significato va comunque letto da una persona.</p>';
    if (da.length) {
      html = '<ul>' + da.map(function (i) {
        return '<li><span class="segno s-' + i.stato + '" aria-hidden="true">' + SEGNO[i.stato] + '</span><span><strong>' +
          esc(i.testo) + '</strong> <span class="tipo">(' + i.etichetta + ')</span><br>' + esc(i.motivo) + '</span></li>';
      }).join('') + '</ul>';
    }
    $('elenco').innerHTML = html;
    $('esito-copia').textContent = '';
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function caricaEsempio(e) {
    $('fonte').value = e.fonte; $('ai').value = e.ai; verifica();
  }

  $('btn-verifica').addEventListener('click', verifica);
  $('btn-pulisci').addEventListener('click', function () {
    $('fonte').value = ''; $('ai').value = ''; $('risultato').hidden = true; $('scelta-esempio').value = ''; ultimoRisultato = null;
    $('fonte').focus();
  });
  $('scelta-esempio').addEventListener('change', function () {
    var e = trovaEsempio(this.value); if (e) caricaEsempio(e);
  });
  $('btn-copia').addEventListener('click', function () {
    if (!ultimoRisultato) return;
    var testo = CF.rapporto(ultimoRisultato), fatto = function () { $('esito-copia').textContent = 'Rapporto copiato.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(testo).then(fatto, function () { copiaDiRiserva(testo, fatto); });
    } else copiaDiRiserva(testo, fatto);
  });
  function copiaDiRiserva(testo, fatto) {
    var t = document.createElement('textarea'); t.value = testo; t.setAttribute('readonly', ''); t.className = 'nascosto';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); fatto(); } catch (err) { $('esito-copia').textContent = 'Copia non riuscita.'; }
    document.body.removeChild(t);
  }

  /* ---------- esercizio ---------- */
  var esercizio = null;     // { esempio, elementi, scelti:Set }

  function avviaEsercizio(e) {
    var elementi = CF.estrai(e.ai);
    esercizio = { esempio: e, elementi: elementi, scelti: new Set(), rivelato: false };
    $('descrizione-esercizio').textContent = e.descrizione;
    $('fonte-esercizio').textContent = e.fonte;
    $('esito-esercizio').hidden = true;
    disegnaEsercizio();
  }

  function disegnaEsercizio() {
    var e = esercizio.esempio, html = '', pos = 0;
    esercizio.elementi.forEach(function (it, n) {
      html += esc(e.ai.slice(pos, it.inizio));
      html += '<button type="button" class="scelta" data-i="' + n + '" aria-pressed="' + (esercizio.scelti.has(n) ? 'true' : 'false') + '">' +
        esc(e.ai.slice(it.inizio, it.fine)) + '</button>';
      pos = it.fine;
    });
    $('ai-esercizio').innerHTML = html + esc(e.ai.slice(pos));
  }

  $('ai-esercizio').addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button.scelta');
    if (!b || !esercizio || esercizio.rivelato) return;
    var n = +b.getAttribute('data-i');
    if (esercizio.scelti.has(n)) esercizio.scelti.delete(n); else esercizio.scelti.add(n);
    b.setAttribute('aria-pressed', esercizio.scelti.has(n) ? 'true' : 'false');
  });

  $('btn-rivela').addEventListener('click', function () {
    if (!esercizio || esercizio.rivelato) return;
    esercizio.rivelato = true;
    var e = esercizio.esempio, r = CF.verifica(e.fonte, e.ai);
    var errori = new Set();
    r.items.forEach(function (it, n) { if (it.stato !== 'ok') errori.add(n); });
    var giusti = 0, falsi = 0, mancati = 0;
    esercizio.scelti.forEach(function (n) { if (errori.has(n)) giusti++; else falsi++; });
    errori.forEach(function (n) { if (!esercizio.scelti.has(n)) mancati++; });
    var box = $('ai-esercizio');
    box.innerHTML = CF.evidenzia(e.ai, r.items);
    Array.prototype.forEach.call(box.querySelectorAll('mark'), function (m) {
      var n = +m.getAttribute('data-i'), scelto = esercizio.scelti.has(n), errore = errori.has(n);
      if (scelto && errore) m.classList.add('c-giusto');
      else if (scelto && !errore) m.classList.add('c-falso');
      else if (!scelto && errore) m.classList.add('c-mancato');
    });
    var esito = $('esito-esercizio');
    esito.hidden = false;
    esito.innerHTML = '<h2>Esito</h2><ul class="riepilogo">' +
      chip('s-ok', giusti, 'errori trovati su ' + errori.size) + chip('s-warn', falsi, 'segnalazioni sbagliate') +
      chip('s-miss', mancati, 'errori non trovati') + '</ul><p class="nota"><strong>Cosa c\'era da trovare.</strong> ' + esc(e.nota) + '</p>';
  });

  function ricomincia() { if (esercizio) avviaEsercizio(esercizio.esempio); }
  $('btn-riprova').addEventListener('click', ricomincia);
  $('scelta-esercizio').addEventListener('change', function () { var e = trovaEsempio(this.value); if (e) avviaEsercizio(e); });

  /* ---------- avvio: la pagina si apre gia' con un esempio verificato ---------- */
  riempiSelect($('scelta-esempio'), true);
  riempiSelect($('scelta-esercizio'), false);
  $('scelta-esempio').value = ESEMPI[0].id;
  caricaEsempio(ESEMPI[0]);
  avviaEsercizio(ESEMPI[0]);
})();
