/* Controllo Fonti - scheda "Esercizio: trova l'errore", creazione di esercizi per i formatori, scheda da stampare. */
(function () {
  'use strict';
  var UI = window.UI, $ = UI.$, esc = UI.esc;
  var CF = window.ControlloFonti, ES = window.EsercizioControlloFonti, SH = window.CondividiControlloFonti;
  var ESEMPI = window.EsempiControlloFonti;
  var LIVELLI = { facile: 'Facile', medio: 'Medio', difficile: 'Difficile', condiviso: 'Condiviso' };
  var corrente = null;          // { esempio, elementi, frasi, scelti:Set, frasiScelte:Set, rivelato, esito }
  var condiviso = null;         // esercizio arrivato da un link

  /* ---------- scelta dell'esercizio ---------- */
  function riempiSelect() {
    var sel = $('scelta-esercizio');
    sel.innerHTML = '';
    ESEMPI.forEach(function (e, i) {
      var o = document.createElement('option');
      o.value = e.id; o.textContent = (i + 1) + '. ' + e.titolo + ' (' + LIVELLI[e.livello].toLowerCase() + ')';
      sel.appendChild(o);
    });
    if (condiviso) {
      var c = document.createElement('option');
      c.value = '__condiviso'; c.textContent = 'Condiviso: ' + condiviso.titolo;
      sel.appendChild(c);
    }
  }

  function trova(id) {
    if (id === '__condiviso') return condiviso;
    return ESEMPI.filter(function (e) { return e.id === id; })[0];
  }

  function avvia(e) {
    corrente = { esempio: e, elementi: CF.estrai(e.ai), frasi: ES.frasi(e.ai), scelti: new Set(), frasiScelte: new Set(), rivelato: false };
    $('scelta-esercizio').value = e.condiviso ? '__condiviso' : e.id;
    $('descrizione-esercizio').textContent = e.descrizione || '';
    $('fonte-esercizio').textContent = e.fonte;
    $('fonte-esercizio').scrollTop = 0;
    var l = e.condiviso ? 'condiviso' : e.livello;
    $('livello-esercizio').textContent = LIVELLI[l];
    $('livello-esercizio').className = 'livello l-' + l;
    $('esito-esercizio').hidden = true;
    $('btn-rivela').disabled = false;
    disegna();
    aggiornaSelezione();
  }

  /* ---------- testo AI selezionabile ---------- */
  function disegna() {
    var c = corrente, ai = c.esempio.ai, html = '', pos = 0;
    c.frasi.forEach(function (f, fi) {
      html += esc(ai.slice(pos, f.inizio));
      html += '<span class="frase' + (c.frasiScelte.has(fi) ? ' segnata' : '') + '" data-f="' + fi + '">';
      var p = f.inizio;
      c.elementi.forEach(function (el, ei) {
        if (el.inizio < f.inizio || el.inizio >= f.fine || el.inizio < p) return;
        var fine = Math.min(el.fine, f.fine);
        html += esc(ai.slice(p, el.inizio));
        html += '<button type="button" class="scelta" data-e="' + ei + '" aria-pressed="' + c.scelti.has(ei) + '">' + esc(ai.slice(el.inizio, fine)) + '</button>';
        p = fine;
      });
      html += esc(ai.slice(p, f.fine)) + '</span>';
      var anteprima = ai.slice(f.inizio, f.fine); if (anteprima.length > 50) anteprima = anteprima.slice(0, 50) + '…';
      html += '<button type="button" class="bandierina" data-f="' + fi + '" aria-pressed="' + c.frasiScelte.has(fi) +
        '" aria-label="Segna come sospetta la frase: ' + esc(anteprima) + '" title="Segna questa frase come sospetta">⚑</button>';
      pos = f.fine;
    });
    $('ai-esercizio').innerHTML = html + esc(ai.slice(pos));
  }

  function aggiornaSelezione() {
    var c = corrente, n = c.scelti.size, f = c.frasiScelte.size, t;
    if (c.rivelato) t = '';
    else if (!n && !f) t = 'clicca gli elementi sospetti; con ⚑ segna le frasi';
    else t = 'segnati: ' + n + (n === 1 ? ' elemento' : ' elementi') + ', ' + f + (f === 1 ? ' frase' : ' frasi');
    $('aiuto-selezione').textContent = t;
    $('stato-esercizio').textContent = t;
  }

  $('ai-esercizio').addEventListener('click', function (ev) {
    if (!corrente || corrente.rivelato) return;
    var b = ev.target.closest && ev.target.closest('button');
    if (!b) return;
    if (b.classList.contains('scelta')) {
      var n = +b.getAttribute('data-e');
      if (corrente.scelti.has(n)) corrente.scelti.delete(n); else corrente.scelti.add(n);
      b.setAttribute('aria-pressed', corrente.scelti.has(n) ? 'true' : 'false');
    } else if (b.classList.contains('bandierina')) {
      var f = +b.getAttribute('data-f');
      if (corrente.frasiScelte.has(f)) corrente.frasiScelte.delete(f); else corrente.frasiScelte.add(f);
      b.setAttribute('aria-pressed', corrente.frasiScelte.has(f) ? 'true' : 'false');
      var span = $('ai-esercizio').querySelector('.frase[data-f="' + f + '"]');
      if (span) span.classList.toggle('segnata', corrente.frasiScelte.has(f));
    }
    aggiornaSelezione();
  });

  /* ---------- rivelazione ---------- */
  function chip(classe, n, testo) { return '<li class="' + classe + '"><span class="n">' + n + '</span>' + testo + '</li>'; }

  function rivela() {
    if (!corrente || corrente.rivelato) return;
    corrente.rivelato = true;
    $('btn-rivela').disabled = true;
    var e = corrente.esempio;
    var v = ES.valuta(e, { elementi: Array.from(corrente.scelti), frasi: Array.from(corrente.frasiScelte) });
    corrente.esito = v;
    disegnaRivelato(v);
    aggiornaSelezione();

    var esito = $('esito-esercizio');
    esito.hidden = false;
    var h = '<h2 tabindex="-1" id="titolo-esito">Esito</h2>';
    h += '<p class="punteggio">Hai trovato ' + v.trovati + ' errori su ' + v.totale + '.</p>';
    h += '<ul class="riepilogo">' + chip('s-ok', v.trovati, 'errori trovati su ' + v.totale) + chip('s-miss', v.mancati, v.mancati === 1 ? 'errore non trovato' : 'errori non trovati') +
      chip('s-warn', v.sbagliate, v.sbagliate === 1 ? 'segnalazione sbagliata' : 'segnalazioni sbagliate') + '</ul>';
    h += '<p>' + esc(commento(v)) + '</p>';
    h += '<ol class="errori-elenco">' + v.risultati.map(function (r, i) {
      var er = r.errore, vede = er.strumento !== false;
      return '<li class="' + (r.trovato ? 'trovato' : 'mancato') + '"><span class="badge">' + (i + 1) + '</span><div>' +
        '<span class="esito-voce">' + (r.trovato ? '✓ Trovato' : '✗ Non trovato') + '</span> · «' + esc(er.testo) + '»' +
        '<span class="strumento ' + (vede ? 'vede' : 'non-vede') + '">' + (vede ? 'Lo strumento lo segnala' : 'Lo strumento non lo vede') + '</span><br>' +
        esc(er.spiegazione || '') + '</div></li>';
    }).join('') + '</ol>';
    var inutili = ES.allarmiInutili(e);
    if (inutili.length) {
      h += '<p class="nota"><strong>Allarmi dello strumento che non sono errori.</strong> ' + inutili.map(function (i) {
        var f = (e.falsiAllarmi || []).filter(function (x) { return x.testo === i.testo; })[0];
        return '«' + esc(i.testo) + '»' + (f && f.spiegazione ? ': ' + esc(f.spiegazione) : '');
      }).join(' ') + '</p>';
    }
    if (e.nota) h += '<p class="nota"><strong>In sintesi.</strong> ' + esc(e.nota) + '</p>';
    h += '<div class="prossimo">';
    var idx = ESEMPI.indexOf(e);
    if (idx !== -1 && idx < ESEMPI.length - 1) h += '<button type="button" class="primario" id="btn-prossimo">Prossimo esercizio</button>';
    h += '<button type="button" class="secondario" id="btn-nello-strumento">Apri nello strumento</button></div>';
    esito.innerHTML = h;
    var titolo = $('titolo-esito');
    if (titolo) titolo.focus();
    var pr = $('btn-prossimo');
    if (pr) pr.addEventListener('click', function () { avvia(ESEMPI[idx + 1]); $('p-esercizio').scrollIntoView({ block: 'start' }); });
    $('btn-nello-strumento').addEventListener('click', function () { UI.apriNelloStrumento(e.fonte, e.ai); });
  }

  function commento(v) {
    var senzaStrumento = v.risultati.some(function (r) { return !r.trovato && r.errore.strumento === false; });
    if (v.totale && v.trovati === v.totale && !v.sbagliate) return 'Occhio da revisore: nessun errore ti è sfuggito e nessuna segnalazione era sbagliata.';
    if (v.totale && v.trovati === v.totale) return 'Hai trovato tutti gli errori. Qualche segnalazione in più era superflua: con un testo vero costa tempo, ma meglio uno scrupolo in più che un errore in meno.';
    if (senzaStrumento) return 'Alcuni errori sfuggiti non avevano numeri o nomi sbagliati: il senso era cambiato. Sono i più difficili, e nessuno strumento automatico li vede.';
    return 'Qualcuno è sfuggito: è normale, ed è il motivo per cui conviene un controllo sistematico invece di una lettura veloce.';
  }

  function disegnaRivelato(v) {
    var c = corrente, ai = c.esempio.ai, html = '', pos = 0;
    var errs = v.risultati;
    c.frasi.forEach(function (f, fi) {
      html += esc(ai.slice(pos, f.inizio));
      var sbagliata = v.frasiSbagliate.indexOf(fi) !== -1;
      html += '<span class="frase' + (sbagliata ? ' f-sbagliata' : '') + '">';
      var segs = [];
      errs.forEach(function (r, i) {
        var er = r.errore;
        if (er.inizio < f.fine && er.fine > f.inizio) segs.push({ inizio: Math.max(er.inizio, f.inizio), fine: Math.min(er.fine, f.fine), tipo: r.trovato ? 'e-trovato' : 'e-mancato', n: i + 1 });
      });
      v.elementiSbagliati.forEach(function (ei) {
        var el = c.elementi[ei];
        if (el.inizio >= f.inizio && el.inizio < f.fine && !segs.some(function (s) { return el.inizio < s.fine && el.fine > s.inizio; })) {
          segs.push({ inizio: el.inizio, fine: Math.min(el.fine, f.fine), tipo: 'falso', n: 0 });
        }
      });
      segs.sort(function (a, b) { return a.inizio - b.inizio; });
      var p = f.inizio;
      segs.forEach(function (s) {
        if (s.inizio < p) return;
        html += esc(ai.slice(p, s.inizio));
        var testo = esc(ai.slice(s.inizio, s.fine));
        if (s.tipo === 'falso') html += '<span class="falso" title="Era corretto">' + testo + '</span>';
        else html += '<mark class="' + s.tipo + '" title="' + (s.tipo === 'e-trovato' ? 'Errore trovato' : 'Errore non trovato') + '">' + testo + '<sup>' + s.n + '</sup></mark>';
        p = s.fine;
      });
      html += esc(ai.slice(p, f.fine)) + '</span>';
      pos = f.fine;
    });
    $('ai-esercizio').innerHTML = html + esc(ai.slice(pos));
  }

  $('btn-rivela').addEventListener('click', rivela);
  $('btn-riprova').addEventListener('click', function () { if (corrente) avvia(corrente.esempio); });
  $('scelta-esercizio').addEventListener('change', function () { var e = trova(this.value); if (e) avvia(e); });

  /* ---------- esercizio condiviso con un link ---------- */
  function mostraAvviso(testo, errore) {
    var a = $('avviso-condiviso');
    a.hidden = !testo; a.textContent = testo || '';
    a.style.borderColor = errore ? 'var(--miss-br)' : '';
  }

  function apriEsercizioCondiviso(es) {
    condiviso = es;
    riempiSelect();
    avvia(es);
    $('p-esercizio').scrollIntoView({ block: 'start' });
  }

  UI.apriCondiviso = function (hash) {
    SH.decodifica(hash).then(function (es) {
      apriEsercizioCondiviso(es);
      mostraAvviso('Esercizio condiviso: «' + es.titolo + '». I testi sono nel link, non su un server. ' + es.errori.length + ' errori da trovare.');
    }, function (err) {
      mostraAvviso('Non riesco ad aprire il link: ' + err.message, true);
    });
  };

  /* ---------- crea un esercizio (per i formatori) ---------- */
  var creato = null;      // { fonte, ai, errori:[{...}] }

  $('crea-analizza').addEventListener('click', function () {
    var fonte = $('crea-fonte').value, ai = $('crea-ai').value, m = $('crea-messaggio');
    if (!fonte.trim() || !ai.trim()) { UI.messaggio(m, 'Servono il documento originale e il testo dell\'AI.', 'errore'); return; }
    if (fonte.length > SH.MAX_TESTO || ai.length > SH.MAX_TESTO) { UI.messaggio(m, 'I testi sono troppo lunghi per un link (massimo ' + SH.MAX_TESTO.toLocaleString('it-IT') + ' caratteri ciascuno).', 'errore'); return; }
    var errori = ES.erroriAutomatici(fonte, ai);
    creato = { fonte: fonte, ai: ai, errori: errori };
    $('crea-risultato').hidden = true;
    if (!errori.length) {
      UI.messaggio(m, 'Lo strumento non trova niente che non torni: così l\'esercizio non avrebbe errori da trovare. Prova con un testo in cui l\'AI ha sbagliato qualcosa.', 'errore');
      $('crea-soluzioni').hidden = true;
      return;
    }
    UI.messaggio(m, errori.length + (errori.length === 1 ? ' elemento non torna.' : ' elementi non tornano.'), 'ok');
    var ul = $('crea-elenco');
    ul.innerHTML = '';
    errori.forEach(function (er, i) {
      var li = document.createElement('li');
      li.innerHTML = '<input type="checkbox" id="crea-sp-' + i + '" checked aria-label="Tieni questo errore"><label for="crea-sp-' + i + '"><strong>' + esc(er.testo) + '</strong></label>' +
        '<div class="campo-spiega"><input type="text" id="crea-sp-t-' + i + '" maxlength="300" aria-label="Spiegazione per i partecipanti" value="' + esc(er.spiegazione) + '"></div>';
      ul.appendChild(li);
    });
    $('crea-soluzioni').hidden = false;
  });

  function costruisciCreato() {
    if (!creato) return null;
    var errori = [];
    creato.errori.forEach(function (er, i) {
      if (!$('crea-sp-' + i).checked) return;
      errori.push({ inizio: er.inizio, fine: er.fine, testo: er.testo, strumento: true, spiegazione: $('crea-sp-t-' + i).value });
    });
    return { titolo: $('crea-titolo').value.trim() || 'Esercizio condiviso', descrizione: '', fonte: creato.fonte, ai: creato.ai,
      errori: errori, nota: $('crea-nota').value };
  }

  $('crea-link').addEventListener('click', function () {
    var es = costruisciCreato();
    if (!es) return;
    if (!es.errori.length) { UI.messaggio($('crea-messaggio'), 'Tieni almeno un errore.', 'errore'); return; }
    SH.codifica(es).then(function (code) {
      var url = location.href.split('#')[0] + '#e=' + code;
      $('crea-url').value = url;
      $('crea-risultato').hidden = false;
      $('crea-info').textContent = 'Il link è lungo ' + url.length.toLocaleString('it-IT') + ' caratteri.' +
        (url.length > 8000 ? ' È molto lungo: molti programmi di posta e di chat lo taglierebbero. Accorcia i testi.' :
          url.length > 2000 ? ' Prima di inviarlo provalo: alcune chat potrebbero tagliare i link lunghi.' : ' Va bene per posta e chat.');
    }, function (err) { UI.messaggio($('crea-messaggio'), err.message, 'errore'); });
  });
  $('crea-copia').addEventListener('click', function () {
    UI.copia($('crea-url').value).then(function (ok) { UI.messaggio($('crea-messaggio'), ok ? 'Link copiato.' : 'Copia non riuscita: selezionalo e copialo a mano.', ok ? 'ok' : 'errore'); });
  });
  $('crea-prova').addEventListener('click', function () {
    var es = costruisciCreato();
    if (!es || !es.errori.length) { UI.messaggio($('crea-messaggio'), 'Tieni almeno un errore.', 'errore'); return; }
    apriEsercizioCondiviso(SH.valida({ t: es.titolo, f: es.fonte, a: es.ai, n: es.nota,
      e: es.errori.map(function (e) { return [e.inizio, e.fine, e.spiegazione]; }) }));
    mostraAvviso('Anteprima del tuo esercizio: così lo vedranno i partecipanti.');
  });

  /* ---------- scheda da stampare ---------- */
  function stampaScheda(conSoluzioni) {
    if (!corrente) return;
    var e = corrente.esempio, ai = e.ai, els = corrente.elementi, h = '', pos = 0;
    els.forEach(function (el, i) {
      h += esc(ai.slice(pos, el.inizio)) + '<u>' + esc(ai.slice(el.inizio, el.fine)) + '</u><sup>' + (i + 1) + '</sup>';
      pos = el.fine;
    });
    h += esc(ai.slice(pos));
    var html = '<h1>Controllo Fonti: trova l\'errore</h1><p>' + esc(e.titolo) + (e.livello ? ' · livello ' + LIVELLI[e.livello].toLowerCase() : '') + '</p>' +
      '<p>Nome: ____________________________ Data: ______________</p>' +
      '<p>Un\'AI ha riassunto il documento qui sotto. Nel riassunto ci sono errori. Per ogni elemento numerato, scrivi se secondo te è un errore. In fondo segna le frasi il cui <em>significato</em> ti sembra cambiato.</p>' +
      '<h2>Documento originale</h2><div class="riquadro">' + esc(e.fonte) + '</div>' +
      '<h2>Riassunto scritto dall\'AI</h2><div class="riquadro">' + h + '</div>' +
      '<h2>Il tuo giudizio</h2><table><tr><th>N.</th><th>Elemento</th><th>È un errore?</th><th>Cosa c\'è nella fonte</th></tr>' +
      els.map(function (el, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(el.testo) + '</td><td>☐ sì &nbsp; ☐ no</td><td>&nbsp;</td></tr>'; }).join('') + '</table>' +
      '<h2>Frasi che cambiano significato</h2><p>______________________________________________________________<br><br>______________________________________________________________</p>';
    if (conSoluzioni) {
      html += '<div class="rottura"><h1>Soluzioni</h1><p>' + esc(e.titolo) + '</p><ol>' + ES.errori(e).map(function (er) {
        var num = els.map(function (el, i) { return er.inizio < el.fine && er.fine > el.inizio ? i + 1 : 0; }).filter(Boolean);
        return '<li><strong>«' + esc(er.testo) + '»</strong>' + (num.length ? ' (elemento ' + num.join(', ') + ')' : ' (errore di frase: nessun elemento numerato)') +
          (er.strumento === false ? ' [lo strumento automatico non lo vede]' : '') + '<br>' + esc(er.spiegazione || '') + '</li>';
      }).join('') + '</ol>' + (e.nota ? '<p><em>' + esc(e.nota) + '</em></p>' : '') + '</div>';
    }
    $('area-stampa').innerHTML = html;
    document.body.classList.add('stampa-scheda');
    var fine = function () { document.body.classList.remove('stampa-scheda'); $('area-stampa').innerHTML = ''; window.removeEventListener('afterprint', fine); };
    window.addEventListener('afterprint', fine);
    window.print();
    setTimeout(fine, 1500);
  }
  $('btn-stampa-scheda').addEventListener('click', function () { stampaScheda(false); });
  $('btn-stampa-soluzioni').addEventListener('click', function () { stampaScheda(true); });

  /* ---------- avvio ---------- */
  riempiSelect();
  avvia(ESEMPI[0]);
})();
