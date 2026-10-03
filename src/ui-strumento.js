/* Controllo Fonti - scheda "Strumento". Nessuna rete, nessun salvataggio: i testi restano in questa pagina. */
(function () {
  'use strict';
  var UI = window.UI, $ = UI.$, esc = UI.esc;
  var CF = window.ControlloFonti, ESEMPI = window.EsempiControlloFonti, FILE = window.FileControlloFonti;
  var SEGNO = { ok: '✓', warn: '!', miss: '✗' };
  var corrente = null;                    // { fonte, ai, risultato }

  /* ---------- contatori e file ---------- */
  function aggiornaContatori() {
    [['fonte', 'cont-fonte'], ['ai', 'cont-ai']].forEach(function (c) {
      var n = UI.parole($(c[0]).value);
      $(c[1]).textContent = n ? n.toLocaleString('it-IT') + (n === 1 ? ' parola' : ' parole') : '';
    });
  }

  function caricaFile(file, area, nome) {
    if (!file) return;
    FILE.leggiFile(file).then(function (testo) {
      $(area).value = testo;
      deselezionaEsempi();
      aggiornaContatori();
      UI.messaggio($('messaggio'), 'Caricato «' + file.name + '» (' + UI.parole(testo).toLocaleString('it-IT') + ' parole) nella casella «' + nome + '».', 'ok');
    }, function (err) {
      UI.messaggio($('messaggio'), err.message, 'errore');
    });
  }

  [['fonte', 'carica-fonte', 'file-fonte', 'fonte'], ['ai', 'carica-ai', 'file-ai', 'testo AI']].forEach(function (c) {
    var area = c[0], btn = $(c[1]), input = $(c[2]), nome = c[3];
    btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { caricaFile(input.files[0], area, nome); input.value = ''; });
    var ta = $(area);
    ['dragenter', 'dragover'].forEach(function (ev) {
      ta.addEventListener(ev, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) { e.preventDefault(); ta.classList.add('trascina'); } });
    });
    ['dragleave', 'drop'].forEach(function (ev) { ta.addEventListener(ev, function () { ta.classList.remove('trascina'); }); });
    ta.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); caricaFile(e.dataTransfer.files[0], area, nome); }
    });
    ta.addEventListener('input', function () { aggiornaContatori(); deselezionaEsempi(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); verifica(); } });
  });

  /* ---------- esempi ---------- */
  function rendiEsempi() {
    var box = $('esempi-rapidi');
    ESEMPI.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip-esempio'; b.textContent = e.titolo;
      b.setAttribute('aria-pressed', 'false'); b.setAttribute('data-id', e.id);
      b.addEventListener('click', function () { caricaEsempio(e); });
      box.appendChild(b);
    });
  }

  function deselezionaEsempi() {
    Array.prototype.forEach.call(document.querySelectorAll('.chip-esempio'), function (b) { b.setAttribute('aria-pressed', 'false'); });
  }

  function caricaEsempio(e) {
    $('fonte').value = e.fonte; $('ai').value = e.ai;
    aggiornaContatori();
    deselezionaEsempi();
    var b = document.querySelector('.chip-esempio[data-id="' + e.id + '"]');
    if (b) b.setAttribute('aria-pressed', 'true');
    UI.messaggio($('messaggio'), '');
    verifica(true);
  }

  /* ---------- verifica e risultato ---------- */
  function verifica(senzaScorrere) {
    var fonte = $('fonte').value, ai = $('ai').value;
    if (!fonte.trim() && !ai.trim()) { UI.messaggio($('messaggio'), 'Incolla il documento originale e il testo dell\'AI, oppure scegli un esempio.', 'errore'); $('fonte').focus(); return; }
    if (!fonte.trim()) { UI.messaggio($('messaggio'), 'Manca il documento originale: senza non c\'è niente con cui confrontare.', 'errore'); $('fonte').focus(); return; }
    if (!ai.trim()) { UI.messaggio($('messaggio'), 'Manca il testo scritto dall\'AI.', 'errore'); $('ai').focus(); return; }
    var esegui = function () {
      var inizio = Date.now(), r = CF.verifica(fonte, ai);
      corrente = { fonte: fonte, ai: ai, risultato: r };
      disegna();
      var ms = Date.now() - inizio, testo = '';
      if (CF.rilevaLingua(ai) === 'en' || CF.rilevaLingua(fonte) === 'en') {
        testo = 'Il testo sembra in inglese: numeri e date si controllano, ma nomi e mesi in inglese sono letti peggio (lo strumento è pensato per l\'italiano).';
      } else if (ms > 1500) {
        testo = 'Controllo eseguito in ' + (ms / 1000).toFixed(1).replace('.', ',') + ' secondi.';
      }
      UI.messaggio($('messaggio'), testo);
      if (senzaScorrere !== true) $('risultato').scrollIntoView({ behavior: UI.riduceMovimento() ? 'auto' : 'smooth', block: 'start' });
    };
    if (fonte.length + ai.length > 60000) {                       // testi molto lunghi: prima si mostra il messaggio, poi si lavora
      UI.messaggio($('messaggio'), 'Controllo in corso su un testo lungo…');
      setTimeout(esegui, 30);
    } else esegui();
  }

  function chip(classe, n, testo) { return '<li class="' + classe + '"><span class="n">' + n + '</span>' + testo + '</li>'; }

  function disegna() {
    var r = corrente.risultato, ris = r.riepilogo;
    $('risultato').hidden = false;
    $('esito-copia').textContent = '';

    var barra = $('barra-esito');
    barra.innerHTML = '';
    ['ok', 'warn', 'miss'].forEach(function (k) {
      var s = document.createElement('span');
      s.className = 'b-' + k; s.style.flexGrow = String(ris[k]);
      barra.appendChild(s);
    });
    barra.hidden = ris.totale === 0;
    barra.setAttribute('aria-label', ris.ok + ' verificati, ' + ris.warn + ' da controllare, ' + ris.miss + ' non trovati');

    $('riepilogo').innerHTML = ris.totale === 0
      ? '<li class="s-warn">Nel testo AI non ho trovato numeri, date o nomi da controllare.</li>'
      : chip('s-ok', ris.ok, 'verificati') + chip('s-warn', ris.warn, 'da controllare') + chip('s-miss', ris.miss, 'non trovati');

    $('evidenziato').innerHTML = CF.evidenzia(corrente.ai, r.items);
    $('fonte-vista').textContent = corrente.fonte;
    $('fonte-vista').scrollTop = 0;
    UI.messaggio($('stato-fonte'), 'il passaggio corrispondente si illumina qui');
    $('stato-fonte').className = 'aiuto';

    var da = [];
    r.items.forEach(function (it, i) { if (it.stato !== 'ok') da.push(i); });
    $('titolo-elenco').textContent = da.length ? 'Da controllare (' + da.length + ')' : 'Esito';
    var html = '';
    if (!da.length && ris.totale) {
      html = '<p class="nessuno">Tutti gli elementi controllati compaiono nella fonte. Clicca un\'evidenziazione per vedere dove. Ricorda che il significato va comunque letto da una persona: una frase può essere sbagliata anche con tutti i dettagli giusti.</p>';
    }
    html += da.map(function (i) { return voce(i, r.items[i]); }).join('');
    $('elenco').innerHTML = html;

    if (da.length) attiva(da[0]);
    else if (ris.totale) attiva(0);
  }

  function voce(i, it) {
    var c = CF.contestoItem(corrente.ai, it, 60);
    var h = '<div class="scheda-voce s-' + it.stato + '" id="voce-' + i + '" data-i="' + i + '">' +
      '<span class="segno s-' + it.stato + '" aria-hidden="true">' + SEGNO[it.stato] + '</span>' +
      '<div class="voce-testo"><strong>' + esc(it.testo) + '</strong><span class="tipo">(' + esc(it.etichetta) + ')</span>' +
      '<span class="voce-motivo">' + esc(it.motivo) + '</span>';
    if (it.suggerimento) {
      h += '<span class="voce-fonte">' + (it.tipo === 'citazione' ? 'Il passaggio più simile nella fonte: ' : 'Nella fonte, in un contesto simile: ') +
        '<strong>«' + esc(it.suggerimento.testo) + '»</strong></span>';
    }
    h += '<span class="voce-contesto">' + esc(c.prima) + ' <mark class="s-' + it.stato + '">' + esc(c.testo) + '</mark> ' + esc(c.dopo) + '</span></div>' +
      '<button type="button" class="secondario piccolo" data-vedi="' + i + '">Vedi nella fonte</button></div>';
    return h;
  }

  /* Un elemento scelto: si evidenzia nel testo AI, nell'elenco e nella fonte. */
  function attiva(i, dalTesto) {
    if (!corrente) return;
    var it = corrente.risultato.items[i];
    if (!it) return;
    Array.prototype.forEach.call(document.querySelectorAll('#evidenziato mark.attivo'), function (m) { m.classList.remove('attivo'); });
    var m = document.querySelector('#evidenziato mark[data-i="' + i + '"]');
    if (m) m.classList.add('attivo');
    Array.prototype.forEach.call(document.querySelectorAll('.scheda-voce.attiva'), function (v) { v.classList.remove('attiva'); });
    var carta = $('voce-' + i);
    if (carta) { carta.classList.add('attiva'); if (dalTesto) carta.scrollIntoView({ behavior: UI.riduceMovimento() ? 'auto' : 'smooth', block: 'nearest' }); }

    var spans = [], didascalia;
    if (it.fonte) spans.push({ inizio: it.fonte.inizio, fine: it.fonte.fine, classe: it.stato === 'ok' ? 'f-ok' : 'f-warn' });
    if (it.suggerimento) spans.push({ inizio: it.suggerimento.inizio, fine: it.suggerimento.fine, classe: 'f-sug' });
    if (it.stato === 'ok') didascalia = it.fonte ? 'Trovato qui, evidenziato in verde' : 'Trovato nella fonte (la posizione esatta non è disponibile)';
    else if (it.stato === 'warn') didascalia = it.fonte ? 'In giallo dove compare nella fonte' + (it.suggerimento ? '; in azzurro cosa c\'è nello stesso contesto' : '') : 'Le parole ci sono ma non insieme';
    else if (it.calcolo) didascalia = 'Questo numero non è nella fonte: è il risultato di un calcolo sui numeri del testo (' + it.calcolo + ')';
    else didascalia = it.suggerimento ? 'Non trovato. In azzurro, nello stesso contesto, la fonte riporta altro' : 'Nella fonte non c\'è nessun passaggio corrispondente';
    UI.messaggio($('stato-fonte'), didascalia);
    $('stato-fonte').className = 'aiuto';
    var vista = $('fonte-vista');
    vista.innerHTML = CF.evidenziaFonte(corrente.fonte, spans);
    var primo = vista.querySelector('mark');
    if (primo) { UI.scorriDentro(vista, primo); primo.classList.add('f-nuovo'); }
    else vista.scrollTop = 0;
  }

  $('evidenziato').addEventListener('click', function (e) {
    var m = e.target.closest && e.target.closest('mark[data-i]');
    if (m) attiva(+m.getAttribute('data-i'), true);
  });
  $('evidenziato').addEventListener('keydown', function (e) {
    var m = e.target.closest && e.target.closest('mark[data-i]');
    if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); attiva(+m.getAttribute('data-i'), true); }
  });
  $('elenco').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-vedi]');
    if (!b) return;
    attiva(+b.getAttribute('data-vedi'));
    $('fonte-vista').scrollIntoView({ behavior: UI.riduceMovimento() ? 'auto' : 'smooth', block: 'center' });
  });

  /* ---------- comandi ---------- */
  $('btn-verifica').addEventListener('click', function () { verifica(); });
  $('btn-pulisci').addEventListener('click', function () {
    $('fonte').value = ''; $('ai').value = '';
    $('risultato').hidden = true; corrente = null;
    deselezionaEsempi(); aggiornaContatori(); UI.messaggio($('messaggio'), '');
    $('fonte').focus();
  });
  $('btn-copia').addEventListener('click', function () {
    if (!corrente) return;
    UI.copia(CF.rapporto(corrente.risultato)).then(function (ok) { $('esito-copia').textContent = ok ? 'Rapporto copiato.' : 'Copia non riuscita.'; });
  });
  $('btn-stampa').addEventListener('click', function () {
    document.body.classList.add('stampa-risultato');
    var fine = function () { document.body.classList.remove('stampa-risultato'); window.removeEventListener('afterprint', fine); };
    window.addEventListener('afterprint', fine);
    window.print();
    setTimeout(fine, 1500);
  });

  /* ---------- prompt per la propria AI ---------- */
  var PR = window.PromptControlloFonti;
  PR.PROMPT.filter(function (p) { return p.conDocumento; }).forEach(function (p) {
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.titolo;
    $('scelta-prompt').appendChild(o);
  });
  $('copia-prompt').addEventListener('click', function () {
    var p = PR.PROMPT.filter(function (x) { return x.id === $('scelta-prompt').value; })[0], esito = $('esito-prompt-strumento');
    if (!$('fonte').value.trim()) { esito.textContent = 'Prima metti il documento nella casella 1.'; esito.className = 'esito errore'; $('fonte').focus(); return; }
    UI.copia(PR.componi(p, $('fonte').value)).then(function (ok) {
      esito.className = 'esito' + (ok ? '' : ' errore');
      esito.textContent = ok ? 'Copiato: incollalo nella tua AI, poi porta qui la risposta.' : 'Copia non riuscita.';
    });
  });

  /* Per l'esercizio: "Apri nello strumento". */
  UI.apriNelloStrumento = function (fonte, ai) {
    $('fonte').value = fonte; $('ai').value = ai;
    aggiornaContatori(); deselezionaEsempi();
    UI.mostraScheda('strumento');
    verifica(false);
  };

  /* ---------- avvio: la pagina si apre gia' con un esempio verificato ---------- */
  rendiEsempi();
  aggiornaContatori();
  caricaEsempio(ESEMPI[0]);
})();
