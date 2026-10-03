/*
 * Valutazione di Controllo Fonti su un corpus di documenti sintetici.
 *
 *   node benchmark/run.js          stampa il rapporto
 *   node benchmark/run.js --json   scrive anche benchmark/risultati.json
 *
 * Il corpus (benchmark/corpus.json) contiene 24 documenti inventati e, per ciascuno, 3 riassunti scritti da un'AI
 * (Gemini) leggendo solo il documento. Due misure:
 *
 *  1. Falsi allarmi: sui riassunti cosi' come sono (quasi tutti fedeli) quanti elementi vengono segnalati.
 *     Le segnalazioni sono state riviste a mano: benchmark/etichette.json dice quali erano problemi veri.
 *  2. Errori inseriti a macchina: partendo da elementi giudicati corretti, se ne cambia UNO alla volta
 *     (numero, data, orario, cognome) e si guarda se lo strumento lo segnala. Seme fisso: risultato ripetibile.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CF = require('../src/check.js');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus.json'), 'utf8'));
const etichettePath = path.join(__dirname, 'etichette.json');
const etichette = fs.existsSync(etichettePath) ? JSON.parse(fs.readFileSync(etichettePath, 'utf8')) : null;

function rng(seme) {
  let a = seme >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DEBUG = process.argv.includes('--debug');           // stampa le correzioni proposte sbagliate
const DEBUG_MANCATI = process.argv.includes('--debug-mancati');   // stampa gli errori inseriti che non vengono segnalati
let rnd = rng(20261003);
const scegli = (lista) => lista[Math.floor(rnd() * lista.length)];
const mescola = (lista) => lista.map(v => [rnd(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

const NOMI_NUOVI = ['Sartori', 'Bellandi', 'Coppola', 'Zanetti', 'Giordani', 'Piras', 'Lombardo', 'Ferraris', 'Morandi',
  'Cattaneo', 'Caruso', 'Pellegrini', 'Montanari', 'Gentili', 'Vanzetto', 'Orlandi'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre',
  'novembre', 'dicembre'];

/* ---------- scrittura dei numeri nello stesso stile dell'originale ---------- */

function valoreDi(it) { return it.cands[0]; }

function riscriviNumero(testo, nuovoValore) {
  const m = /^(\d[\d.,  ]*\d|\d)(.*)$/.exec(testo);
  if (!m) return null;
  const p = CF.parseNumero(m[1]);
  const decimali = p.decimali;
  const conPunti = /^\d{1,3}(\.\d{3})+/.test(m[1]);
  let nuovo = nuovoValore.toFixed(decimali).replace('.', ',');
  if (conPunti) {
    const [i, d] = nuovo.split(',');
    nuovo = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : '');
  }
  return nuovo + m[2];
}

function valoreDiverso(v, decimali, esclusi) {
  for (let t = 0; t < 30; t++) {
    let n;
    if (decimali === 0 && Number.isInteger(v) && v >= 1900 && v <= 2100) n = v + scegli([-3, -2, -1, 1, 2, 3]);
    else if (decimali === 0) n = v + (scegli([-1, 1])) * Math.max(1, Math.round(v * (0.1 + rnd() * 0.5)));
    else n = v + scegli([-1, 1]) * v * (0.1 + rnd() * 0.4);
    n = Number(n.toFixed(decimali));
    if (n > 0 && n !== v && !esclusi.has(String(Number(n.toPrecision(12))))) return n;
  }
  return null;
}

/* ---------- elementi della fonte ---------- */

function elementiFonte(fonte) {
  const els = CF.estrai(fonte, { senzaCitazioni: true });
  const numeri = new Map(), date = new Set(), orari = new Set(), giornoMese = new Set();
  els.forEach(x => {
    if (x.cands) x.cands.forEach(v => numeri.set(String(Number(((v * x.scala)).toPrecision(12))), x));
    if (x.tipo === 'data') { date.add(x.d + '/' + x.m + '/' + x.y); giornoMese.add(x.d + '/' + x.m); }
    if (x.tipo === 'orario') orari.add(x.minuti);
  });
  return { els, numeri, date, orari, giornoMese, norm: CF.normalizza(fonte) };
}

/* ---------- mutazioni ---------- */

function mutazioni(fonte, testo, risultato, fi) {
  const out = [];
  const ok = risultato.items.map((it, n) => ({ it, n })).filter(x => x.it.stato === 'ok');
  const elementi = CF.estrai(testo);
  const dettaglio = (it) => elementi.find(e => e.inizio === it.inizio && e.fine === it.fine) || {};

  // numeri, percentuali, importi scritti in cifre
  mescola(ok.filter(x => ['numero', 'percentuale', 'importo'].includes(x.it.tipo) && /^\d/.test(x.it.testo))).slice(0, 3).forEach(({ it }) => {
    const e = dettaglio(it);
    if (!e.cands) return;
    const nv = valoreDiverso(valoreDi(e), e.decimali, new Set([...fi.numeri.keys()].map(k => String(Number(k) / e.scala))));
    if (nv === null) return;
    const nuovo = riscriviNumero(it.testo, nv);
    if (nuovo) out.push({ tipo: 'numero inventato', it, nuovo });
  });

  // numeri veri della fonte messi nel posto sbagliato
  mescola(ok.filter(x => ['numero', 'percentuale', 'importo'].includes(x.it.tipo) && /^\d/.test(x.it.testo))).slice(0, 2).forEach(({ it }) => {
    const e = dettaglio(it);
    if (!e.cands) return;
    const stessaFamiglia = (s) => (s.tipo === 'percentuale') === (e.tipo === 'percentuale') && !s.parola && s.cands && /^\d/.test(s.testo);
    const alt = mescola(fi.els.filter(s => stessaFamiglia(s) && s.cands[0] * s.scala !== valoreDi(e) * e.scala &&
      s.decimali === e.decimali && !(s.cands[0] >= 1900 && s.cands[0] <= 2100) && s.cands[0] * s.scala < 1e6))[0];
    if (!alt) return;
    const nuovo = riscriviNumero(it.testo, alt.cands[0] * alt.scala / e.scala);
    if (nuovo) out.push({ tipo: 'numero scambiato con un altro della fonte', it, nuovo });
  });

  // date: giorno cambiato
  mescola(ok.filter(x => x.it.tipo === 'data' && /^\d{1,2}\b/.test(x.it.testo))).slice(0, 2).forEach(({ it }) => {
    const e = dettaglio(it);
    if (e.d === null || e.d === undefined) return;
    for (let t = 0; t < 20; t++) {
      const g = 1 + Math.floor(rnd() * 28);
      if (g === e.d || fi.giornoMese.has(g + '/' + e.m)) continue;     // il nuovo giorno non deve esistere gia' nella fonte
      out.push({ tipo: 'data (giorno)', it, nuovo: it.testo.replace(/^\d{1,2}/, String(g)) });
      break;
    }
  });

  // date: mese cambiato
  mescola(ok.filter(x => x.it.tipo === 'data' && new RegExp('\\b(' + MESI.join('|') + ')\\b', 'i').test(x.it.testo))).slice(0, 1).forEach(({ it }) => {
    const e = dettaglio(it);
    const mese = MESI.findIndex(m => new RegExp('\\b' + m + '\\b', 'i').test(it.testo)) + 1;
    for (let t = 0; t < 20; t++) {
      const m2 = 1 + Math.floor(rnd() * 12);
      if (m2 === mese || fi.giornoMese.has(e.d + '/' + m2) || [...fi.date].some(k => k.startsWith('null/' + m2 + '/'))) continue;
      out.push({ tipo: 'data (mese)', it, nuovo: it.testo.replace(new RegExp('\\b' + MESI[mese - 1] + '\\b', 'i'), MESI[m2 - 1]) });
      break;
    }
  });

  // orari
  mescola(ok.filter(x => x.it.tipo === 'orario' && /^\d{1,2}[:.]\d{2}$/.test(x.it.testo))).slice(0, 2).forEach(({ it }) => {
    const sep = it.testo.includes(':') ? ':' : '.';
    const [h, mi] = it.testo.split(/[:.]/).map(Number);
    for (let t = 0; t < 20; t++) {
      const h2 = Math.min(23, Math.max(0, h + scegli([-3, -2, -1, 1, 2, 3]))), m2 = scegli([0, 15, 30, 45]);
      if (fi.orari.has(h2 * 60 + m2) || (h2 === h && m2 === mi)) continue;
      out.push({ tipo: 'orario', it, nuovo: h2 + sep + String(m2).padStart(2, '0') });
      break;
    }
  });

  // cognomi
  mescola(ok.filter(x => x.it.tipo === 'nome' && /^\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+$/u.test(x.it.testo))).slice(0, 2).forEach(({ it }) => {
    const [nome, cognome] = it.testo.split(' ');
    const nuovo = mescola(NOMI_NUOVI.filter(c => !fi.norm.includes(CF.normalizza(c)) && c !== cognome))[0];
    if (nuovo) out.push({ tipo: 'cognome sbagliato', it, nuovo: nome + ' ' + nuovo });
  });
  return out;
}

function stessoValore(a, b) {
  const x = CF.estrai(a)[0], y = CF.estrai(b)[0];
  if (!x || !y || x.tipo !== y.tipo && !(x.cands && y.cands)) return false;
  if (x.cands && y.cands) return Math.abs(x.cands[0] * x.scala - y.cands[0] * y.scala) < 1e-9;
  if (x.tipo === 'data') return x.d === y.d && x.m === y.m;
  if (x.tipo === 'orario') return x.minuti === y.minuti;
  return CF.normalizza(a) === CF.normalizza(b) || (x.parole && y.parole && x.parole.join(' ') === y.parole.join(' '));
}

/* ---------- esecuzione ---------- */

function esegui() {
  rnd = rng(20261003);                                    // stesso seme a ogni esecuzione
  const rapporto = { falsiAllarmi: { riassunti: 0, elementi: 0, ok: 0, warn: 0, miss: 0, perTipo: {} }, mutazioni: {} };
  const segnalati = [];

  corpus.forEach(doc => {
    const fi = elementiFonte(doc.fonte);
    doc.riassunti.forEach(r => {
      const v = CF.verifica(doc.fonte, r.testo);
      const f = rapporto.falsiAllarmi;
      f.riassunti++; f.elementi += v.riepilogo.totale; f.ok += v.riepilogo.ok; f.warn += v.riepilogo.warn; f.miss += v.riepilogo.miss;
      v.items.forEach(it => {
        const t = f.perTipo[it.tipo] || (f.perTipo[it.tipo] = { n: 0, segnalati: 0 });
        t.n++;
        if (it.stato !== 'ok') { t.segnalati++; segnalati.push({ doc: doc.id, stile: r.stile, testo: it.testo, tipo: it.tipo, stato: it.stato }); }
      });
      mutazioni(doc.fonte, r.testo, v, fi).forEach(mu => {
        const testoMut = r.testo.slice(0, mu.it.inizio) + mu.nuovo + r.testo.slice(mu.it.fine);
        const vm = CF.verifica(doc.fonte, testoMut);
        const nuovoFine = mu.it.inizio + mu.nuovo.length;
        const toccato = vm.items.find(i => i.inizio < nuovoFine && i.fine > mu.it.inizio);
        const m = rapporto.mutazioni[mu.tipo] || (rapporto.mutazioni[mu.tipo] = { n: 0, segnalati: 0, miss: 0, conSuggerimento: 0, suggerimentoGiusto: 0 });
        m.n++;
        if (DEBUG_MANCATI && !(toccato && toccato.stato !== 'ok')) {
          console.log('[' + mu.tipo + '] non segnalato: «' + mu.it.testo + '» -> «' + mu.nuovo + '»\n    …' +
            testoMut.slice(Math.max(0, mu.it.inizio - 70), nuovoFine + 40).replace(/\n/g, ' ') + '…');
        }
        if (toccato && toccato.stato !== 'ok') {
          m.segnalati++;
          if (toccato.stato === 'miss') m.miss++;
          if (toccato.suggerimento) {
            m.conSuggerimento++;
            if (stessoValore(toccato.suggerimento.testo, mu.it.testo)) m.suggerimentoGiusto++;
            else if (DEBUG) {
              console.log('[' + mu.tipo + '] originale «' + mu.it.testo + '» -> «' + mu.nuovo + '», proposto «' +
                toccato.suggerimento.testo + '»\n    …' + testoMut.slice(Math.max(0, mu.it.inizio - 60), nuovoFine + 30).replace(/\n/g, ' ') + '…');
            }
          }
        }
      });
    });
  });
  let tot = 0, totSeg = 0;
  Object.values(rapporto.mutazioni).forEach(m => { tot += m.n; totSeg += m.segnalati; });
  rapporto.totaleMutazioni = { n: tot, segnalati: totSeg };
  if (etichette) {
    const conta = { vero: 0, falso: 0, sconosciuto: 0 };
    segnalati.forEach(s => { conta[etichette[s.doc + '/' + s.stile + '/' + s.testo] || 'sconosciuto']++; });
    rapporto.revisione = { veri: conta.vero, falsi: conta.falso, sconosciuti: conta.sconosciuto };
  }
  return { rapporto, segnalati };
}

/* ---------- rapporto ---------- */

function stampa(risultato) {
  const { rapporto, segnalati } = risultato;

  const pc = (a, b) => b ? (100 * a / b).toFixed(1).replace('.', ',') + '%' : '-';
  const f = rapporto.falsiAllarmi;
  console.log('FALSI ALLARMI sui riassunti originali');
  console.log('  riassunti: ' + f.riassunti + ', elementi controllati: ' + f.elementi);
  console.log('  verificati: ' + f.ok + ' (' + pc(f.ok, f.elementi) + ')  da controllare: ' + f.warn + '  non trovati: ' + f.miss);
  console.log('  segnalati in totale: ' + (f.warn + f.miss) + ' (' + pc(f.warn + f.miss, f.elementi) + ')');
  Object.keys(f.perTipo).sort().forEach(t => console.log('    ' + t.padEnd(12) + String(f.perTipo[t].n).padStart(5) + ' elementi, segnalati ' + f.perTipo[t].segnalati));

  if (rapporto.revisione) {
    const r = rapporto.revisione;
    console.log('  revisione manuale: ' + r.veri + ' problemi veri (valori sbagliati, calcolati o dedotti dall\'AI), ' + r.falsi +
      ' falsi allarmi (' + pc(r.falsi, f.elementi) + ' degli elementi), ' + r.sconosciuti + ' non rivisti');
  }

  console.log('\nERRORI INSERITI A MACCHINA (uno alla volta)');
  const { n: tot, segnalati: totSeg } = rapporto.totaleMutazioni;
  Object.keys(rapporto.mutazioni).sort().forEach(t => {
    const m = rapporto.mutazioni[t];
    console.log('  ' + t.padEnd(44) + String(m.n).padStart(4) + ' casi, segnalati ' + pc(m.segnalati, m.n).padStart(6) +
      (m.conSuggerimento ? '  | correzione proposta ' + m.conSuggerimento + ', giusta ' + pc(m.suggerimentoGiusto, m.conSuggerimento) : ''));
  });
  console.log('  ' + 'TOTALE'.padEnd(44) + String(tot).padStart(4) + ' casi, segnalati ' + pc(totSeg, tot).padStart(6));

  if (process.argv.includes('--json')) {
    fs.writeFileSync(path.join(__dirname, 'risultati.json'), JSON.stringify(rapporto, null, 1) + '\n');
    fs.writeFileSync(path.join(__dirname, 'segnalati.json'), JSON.stringify(segnalati, null, 1) + '\n');
  }
}

module.exports = { esegui };

if (require.main === module) stampa(esegui());
