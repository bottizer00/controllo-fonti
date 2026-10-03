/*
 * Esempi per la demo e per l'esercizio "trova l'errore".
 * Sono tutti SINTETICI: persone, aziende, prodotti e test sono inventati.
 *
 * Ogni esempio ha:
 *  - fonte, ai: il documento e il riassunto "scritto da un'AI";
 *  - errori: gli errori inseriti nel riassunto. "testo" e' il pezzo esatto del riassunto; "strumento" dice se
 *    il controllo automatico lo vede (false = errore di significato: i numeri e i nomi sono giusti, il senso no);
 *    "frase" indica che va segnalato scegliendo la frase intera;
 *  - falsiAllarmi: elementi che lo strumento segnala ma che sono corretti (es. calcoli), con la spiegazione.
 * I test (test/examples.test.js) controllano che questi elenchi restino coerenti con la logica di verifica.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EsempiControlloFonti = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return [
    {
      id: 'verbale',
      breve: 'Verbale',
      titolo: 'Verbale di riunione',
      livello: 'facile',
      descrizione: 'Un riassunto di un verbale commerciale. Cerca gli errori prima di rivelarli.',
      fonte:
        'Verbale della riunione commerciale del 14 marzo 2026.\n' +
        'Presenti: Anna Bellini (direttrice vendite), Marco Furlan (logistica) ed Elisa Toffolo (amministrazione).\n' +
        'Il fatturato del primo trimestre è stato di 2,4 milioni di euro, in crescita dell\'8% rispetto al 2025.\n' +
        'Si decide di aprire due nuovi punti di consegna entro giugno e di assumere 3 addetti alla logistica. ' +
        'Il budget approvato è di 180.000 euro.\n' +
        'La prossima riunione si terrà l\'11 aprile 2026.',
      ai:
        'Nella riunione del 14 marzo 2026 la direttrice vendite Anna Bellini ha presentato un fatturato di ' +
        '2,4 milioni di euro nel primo trimestre, in crescita del 12% rispetto al 2025. Il comitato ha approvato ' +
        'l\'apertura di tre nuovi punti di consegna entro giugno e l\'assunzione di 3 addetti alla logistica, con un ' +
        'budget di 180.000 euro. Elisa Tonon ha seguito gli aspetti amministrativi. La prossima riunione è fissata ' +
        'per il 18 aprile 2026.',
      errori: [
        { testo: '12%', strumento: true, spiegazione: 'La crescita era dell\'8%, non del 12%.' },
        { testo: 'tre', contesto: 'l\'apertura di tre nuovi', strumento: true, spiegazione: 'I punti di consegna sono due. Il numero 3 c\'è nella fonte, ma riguarda gli addetti: un numero giusto nel posto sbagliato.' },
        { testo: 'Elisa Tonon', strumento: true, spiegazione: 'Il cognome corretto è Toffolo: un nome plausibile ma sbagliato.' },
        { testo: '18 aprile 2026', strumento: true, spiegazione: 'La prossima riunione è l\'11 aprile 2026.' }
      ],
      falsiAllarmi: [],
      nota: 'Quattro errori di tipo diverso (un numero, un numero giusto nel posto sbagliato, un nome, una data) e tutti plausibili: nessuno «suona» sbagliato, si scopre solo confrontando con il verbale.'
    },
    {
      id: 'scheda',
      breve: 'Scheda prodotto',
      titolo: 'Scheda di un prodotto',
      livello: 'facile',
      descrizione: 'Un testo commerciale generato da una scheda tecnica. Quali dettagli sono stati inventati?',
      fonte:
        'Aspirapolvere robot RX-200. Autonomia: 120 minuti. Capacità del serbatoio: 0,4 litri. Peso: 3,2 kg. ' +
        'Rumorosità: 58 dB. Garanzia di 24 mesi. Prezzo di listino: 349 euro. Compatibile con l\'app HomeClean.',
      ai:
        'L\'aspirapolvere robot RX-200 offre un\'autonomia di 150 minuti, un serbatoio da 0,4 litri e un peso di 3,2 kg. ' +
        'La rumorosità è di 58 dB e la garanzia dura 36 mesi. Il prezzo di listino è di 349 euro ed è compatibile ' +
        'con l\'app HomeClean e con Alexa.',
      errori: [
        { testo: '150', strumento: true, spiegazione: 'L\'autonomia è di 120 minuti.' },
        { testo: '36', strumento: true, spiegazione: 'La garanzia è di 24 mesi.' },
        { testo: 'Alexa', strumento: true, spiegazione: 'La compatibilità con Alexa non è mai dichiarata: un dettaglio inventato che «suona bene».' }
      ],
      falsiAllarmi: [],
      nota: 'Il più insidioso è l\'ultimo: «Alexa» non cambia nessun numero, è semplicemente aggiunto. Un testo commerciale generato dall\'AI tende ad arricchire la scheda con ciò che «di solito» si dice di quel prodotto.'
    },
    {
      id: 'preventivo',
      breve: 'Preventivo',
      titolo: 'Preventivo di un fornitore',
      livello: 'medio',
      descrizione: 'I conti sembrano tornare. Ma tornano a partire da dati giusti?',
      fonte:
        'Preventivo n. 2026/118 del 9 febbraio 2026.\n' +
        'Cliente: Studio Dentistico Marchetti, Udine.\n' +
        'Oggetto: rifacimento dell\'impianto di rete e installazione di 12 postazioni di lavoro.\n' +
        'Voci: cablaggio strutturato Cat. 6A, 18 punti rete, 1.440 euro; armadio rack 12U, 390 euro; ' +
        '2 access point Wi-Fi 6, 560 euro; configurazione e collaudo, 6 ore a 55 euro l\'ora, 330 euro.\n' +
        'Totale imponibile: 2.720 euro. IVA al 22%: 598,40 euro. Totale: 3.318,40 euro.\n' +
        'Tempi di esecuzione: 5 giorni lavorativi dalla conferma, con inizio previsto il 2 marzo 2026.\n' +
        'Il preventivo è valido 30 giorni. Referente: ing. Paolo Zanier, tel. 0432 600411.',
      ai:
        'Lo Studio Dentistico Marchetti di Udine ha ricevuto il preventivo n. 2026/118 del 9 febbraio 2026 per il ' +
        'rifacimento della rete e l\'installazione di 12 postazioni. Le voci principali sono il cablaggio Cat. 6A per ' +
        '18 punti rete (1.440 euro), un armadio rack 12U da 390 euro, tre access point Wi-Fi 6 da 560 euro e 6 ore di ' +
        'configurazione a 55 euro l\'ora. L\'imponibile è di 2.720 euro, con IVA al 10% pari a 272 euro, per un totale ' +
        'di 2.992 euro. I lavori durano 5 giorni lavorativi e iniziano il 2 marzo 2026. Il preventivo è valido ' +
        '60 giorni; il referente è l\'ing. Paolo Zanier.',
      errori: [
        { testo: 'tre', contesto: 'tre access point', strumento: true, spiegazione: 'Gli access point sono 2, non 3.' },
        { testo: '10%', strumento: true, spiegazione: 'L\'IVA è al 22%. È l\'errore che fa partire gli altri due.' },
        { testo: '272', strumento: true, spiegazione: 'Con l\'IVA giusta sarebbero 598,40 euro. Il calcolo è coerente solo con l\'aliquota sbagliata.' },
        { testo: '2.992', strumento: true, spiegazione: 'Il totale corretto è 3.318,40 euro: un errore iniziale si propaga e i conti «tornano» lo stesso.' },
        { testo: '60', contesto: 'valido 60 giorni', strumento: true, spiegazione: 'Il preventivo è valido 30 giorni.' }
      ],
      falsiAllarmi: [],
      nota: 'Un solo errore (l\'aliquota IVA) genera due importi sbagliati ma coerenti tra loro: controllare solo che «i conti tornino» non basta, bisogna controllare i dati di partenza.'
    },
    {
      id: 'circolare',
      breve: 'Circolare',
      titolo: 'Circolare del personale',
      livello: 'medio',
      descrizione: 'Alcune frasi hanno il significato ribaltato, anche se numeri e nomi sono giusti. Segna anche le frasi, con la bandierina.',
      fonte:
        'Circolare interna n. 12/2026, Ufficio Personale, 5 maggio 2026.\n' +
        'Oggetto: lavoro agile e ferie estive.\n' +
        'Dal 1° giugno 2026 il lavoro agile è consentito fino a due giorni a settimana, previo accordo con il responsabile. ' +
        'Il lavoro agile non è consentito nei giorni di chiusura dei punti vendita né durante il periodo di prova.\n' +
        'Le richieste di ferie estive vanno inviate entro il 15 maggio 2026 tramite il portale. Non sono ammessi più di ' +
        'quindici giorni consecutivi di ferie dal 1° luglio al 31 agosto. La mensa aziendale resta aperta per tutto agosto.\n' +
        'Per chiarimenti: Sara Bortolotti, ufficio personale, interno 214.',
      ai:
        'La circolare n. 12/2026 del 5 maggio 2026 stabilisce che dal 1° giugno il lavoro agile è consentito fino a ' +
        'tre giorni a settimana, previo accordo con il responsabile. Si può lavorare da casa anche durante il periodo ' +
        'di prova e nei giorni di chiusura dei punti vendita. Le richieste di ferie estive vanno inviate entro il ' +
        '25 maggio 2026 tramite il portale e non si possono prendere più di quindici giorni consecutivi tra il 1° luglio ' +
        'e il 31 agosto. La mensa aziendale resta chiusa ad agosto. Per chiarimenti: Sara Bortolotti, interno 214.',
      errori: [
        { testo: 'tre', contesto: 'fino a tre giorni', strumento: true, spiegazione: 'Il lavoro agile è consentito fino a DUE giorni a settimana.' },
        { testo: 'Si può lavorare da casa anche durante il periodo di prova e nei giorni di chiusura dei punti vendita.', frase: true, strumento: false,
          spiegazione: 'Nella fonte il lavoro agile NON è consentito in questi casi. Nessun numero è sbagliato: è il significato a essere ribaltato.' },
        { testo: '25 maggio 2026', strumento: true, spiegazione: 'Il termine per le richieste è il 15 maggio 2026.' },
        { testo: 'La mensa aziendale resta chiusa ad agosto.', frase: true, strumento: false,
          spiegazione: 'La mensa resta APERTA per tutto agosto. Una sola parola cambiata, il senso opposto.' }
      ],
      falsiAllarmi: [],
      nota: 'Due errori su quattro non hanno numeri o nomi sbagliati: il controllo automatico li dà per verdi. Solo chi legge il testo li trova.'
    },
    {
      id: 'test',
      breve: 'Scheda di un test',
      titolo: 'La scheda di un test',
      livello: 'medio',
      descrizione: 'Ispirato a un caso vero: un riassunto AI con numeri sbagliati che sembravano credibili.',
      fonte:
        'Scheda del test PRO-5. Il test comprende 5 prove e un punteggio massimo di 28 punti. ' +
        'Nel caso di Luca, 8 anni, il punteggio totale è stato 21 punti. ' +
        'La prevalenza del disturbo è stimata intorno al 5% dei bambini in età scolare. ' +
        'Il test è stato validato nel 2019.',
      ai:
        'Il PRO-5 comprende 4 prove con un punteggio massimo di 26 punti. Nel caso di Luca, 8 anni, il punteggio ' +
        'totale è stato 21 punti. La prevalenza del disturbo è stimata intorno al 12% dei bambini in età scolare, ' +
        'e il test è stato validato nel 2021.',
      errori: [
        { testo: '4', strumento: true, spiegazione: 'Le prove sono 5.' },
        { testo: '26', strumento: true, spiegazione: 'Il punteggio massimo è 28.' },
        { testo: '12%', strumento: true, spiegazione: 'La prevalenza stimata è il 5%.' },
        { testo: '2021', strumento: true, spiegazione: 'Il test è stato validato nel 2019.' }
      ],
      falsiAllarmi: [],
      nota: 'Test, persona e dati sono inventati: il caso reale da cui nasce riguardava un riassunto generato dall\'AI di lezioni universitarie, con punteggi, numeri di prove e prevalenze sbagliati.'
    },
    {
      id: 'cv',
      breve: 'Curriculum',
      titolo: 'Riassunto di un curriculum',
      livello: 'medio',
      descrizione: 'Un\'AI ha riassunto il CV di una candidata. In selezione un errore del genere può costare una persona.',
      fonte:
        'Curriculum vitae di Chiara Pellizzari. Nata a Gorizia nel 1996.\n' +
        'Laurea magistrale in Psicologia clinica, Università di Padova, 2022, voto 108/110.\n' +
        'Dal gennaio 2023 al settembre 2025 psicologa presso la cooperativa sociale Nuovi Orizzonti di Trieste ' +
        '(contratto a tempo determinato, 30 ore settimanali). Da ottobre 2025 collabora con l\'Ambulatorio Prisma di Udine.\n' +
        'Lingue: italiano madrelingua, inglese livello B2, sloveno livello A2.\n' +
        'Competenze: SPSS, Excel, somministrazione del test WISC-IV. Patente B.',
      ai:
        'Chiara Pellizzari, nata a Gorizia nel 1996, è laureata in Psicologia clinica all\'Università di Padova ' +
        '(2022, voto 110/110). Ha lavorato per oltre tre anni alla cooperativa Nuovi Orizzonti di Trieste con ' +
        'contratto a tempo indeterminato e dal 2025 collabora con l\'Ambulatorio Prisma di Udine. Parla inglese a ' +
        'livello C1 e sloveno A2. Usa SPSS ed Excel e conosce il test WISC-IV. Ha la patente B.',
      errori: [
        { testo: '110/110', strumento: false, spiegazione: 'Il voto è 108/110. Lo strumento non lo segnala: il numero 110 c\'è nella fonte, come massimo del voto. Un numero presente nella fonte può avere un altro significato.' },
        { testo: 'tre', contesto: 'oltre tre anni', strumento: true, spiegazione:'Da gennaio 2023 a settembre 2025 sono meno di tre anni: una durata «dedotta» in modo sbagliato.' },
        { testo: 'a tempo indeterminato', frase: true, strumento: false, spiegazione: 'Il contratto era a tempo DETERMINATO. Cambia tutto, e nessun numero è sbagliato.' },
        { testo: 'C1', frase: true, strumento: false, spiegazione: 'Il livello di inglese è B2. Livelli e sigle brevi sfuggono facilmente ai controlli automatici.' }
      ],
      falsiAllarmi: [],
      nota: 'Un errore sul tipo di contratto o sul livello di una lingua è esattamente quello che nessun filtro sui numeri vede: serve rileggere la fonte.'
    },
    {
      id: 'contratto',
      breve: 'Contratto',
      titolo: 'Clausole di un contratto',
      livello: 'difficile',
      descrizione: 'Un\'AI cita un contratto tra virgolette. Le virgolette garantiscono che la citazione sia vera?',
      fonte:
        'Contratto di fornitura n. 45/2026 tra Zanutto Impianti S.r.l. e Tessitura Carnica S.p.A.\n' +
        'Art. 3 - Consegna. Il fornitore consegna la merce entro 20 giorni lavorativi dall\'ordine. In caso di ritardo ' +
        'superiore a 10 giorni è dovuta una penale dell\'1% del valore dell\'ordine per ogni settimana di ritardo, fino a ' +
        'un massimo dell\'8%.\n' +
        'Art. 7 - Recesso. Ciascuna parte può recedere con un preavviso scritto di 60 giorni.\n' +
        'Art. 9 - Foro competente. Per ogni controversia è competente in via esclusiva il Foro di Udine.\n' +
        'Il responsabile del contratto per Tessitura Carnica è Luca Del Fabbro.',
      ai:
        'Nel contratto n. 45/2026 tra Zanutto Impianti e Tessitura Carnica il fornitore deve consegnare entro ' +
        '20 giorni lavorativi. Se il ritardo supera i 10 giorni scatta una penale del 2% per ogni settimana, fino a un ' +
        'massimo dell\'8%. Secondo l\'art. 7 «ciascuna parte può recedere senza alcun preavviso» e per le controversie, ' +
        'come previsto dall\'art. 9, è competente il Foro di Trieste. Il responsabile per Tessitura Carnica è Luca Del Fabbro.',
      errori: [
        { testo: '2%', strumento: true, spiegazione: 'La penale è dell\'1% per settimana.' },
        { testo: '«ciascuna parte può recedere senza alcun preavviso»', strumento: true,
          spiegazione: 'La citazione è inventata: la clausola prevede un preavviso scritto di 60 giorni. Le virgolette non provano che la frase sia nel documento.' },
        { testo: 'Foro di Trieste', strumento: true, spiegazione: 'Il foro competente è quello di Udine.' }
      ],
      falsiAllarmi: [],
      nota: 'Una citazione tra virgolette dà un\'impressione di precisione, ma l\'AI può inventarla. Lo strumento la cerca parola per parola nella fonte.'
    },
    {
      id: 'offerta',
      breve: 'Offerta di lavoro',
      titolo: 'Offerta di lavoro',
      livello: 'difficile',
      descrizione: 'Un\'offerta riassunta dall\'AI per un annuncio. Sette dettagli sono cambiati: quanti ne trovi?',
      fonte:
        'Alfa Servizi S.r.l. cerca un/una addetto/a alla formazione interna per la sede di Pordenone.\n' +
        'Contratto a tempo determinato di 12 mesi, full time dal lunedì al venerdì, con possibilità di proroga. ' +
        'Retribuzione annua lorda da 24.000 a 27.000 euro, in base all\'esperienza.\n' +
        'Requisiti: laurea triennale in ambito umanistico o psicologico, almeno 2 anni di esperienza, buona conoscenza ' +
        'dell\'inglese (livello B1). Gradita la conoscenza di strumenti di intelligenza artificiale generativa.\n' +
        'Le candidature vanno inviate entro il 30 aprile 2026 a selezione@alfaservizi.example. Colloqui dall\'11 maggio 2026.',
      ai:
        'Alfa Servizi cerca un addetto alla formazione interna a Pordenone con contratto a tempo determinato di ' +
        '18 mesi, full time, con retribuzione tra 24.000 e 27.000 euro. Servono la laurea magistrale in ambito ' +
        'umanistico o psicologico, almeno 3 anni di esperienza e inglese di livello B2. È richiesta la conoscenza ' +
        'degli strumenti di intelligenza artificiale generativa. Le candidature vanno inviate entro il 30 aprile 2026 ' +
        'a selezione@alfaservizi.com e i colloqui iniziano l\'11 maggio 2026.',
      errori: [
        { testo: '18', contesto: 'di 18 mesi', strumento: true, spiegazione: 'Il contratto è di 12 mesi.' },
        { testo: 'la laurea magistrale', frase: true, strumento: false, spiegazione: 'Basta la laurea triennale: un requisito aggravato senza che cambi un numero.' },
        { testo: '3', contesto: 'almeno 3 anni', strumento: true, spiegazione: 'Servono almeno 2 anni di esperienza.' },
        { testo: 'B2', frase: true, strumento: false, spiegazione: 'Il livello richiesto è B1. Una sigla breve di lingua sfugge ai controlli.' },
        { testo: 'È richiesta la conoscenza degli strumenti di intelligenza artificiale generativa.', frase: true, strumento: false,
          spiegazione: 'Nell\'annuncio la conoscenza è solo GRADITA, non richiesta: da requisito facoltativo a obbligatorio.' },
        { testo: 'selezione@alfaservizi.com', strumento: true, spiegazione: 'L\'indirizzo nell\'annuncio è selezione@alfaservizi.example: una mail sbagliata fa perdere le candidature.' }
      ],
      falsiAllarmi: [],
      nota: 'Tre errori su sei non toccano nessun numero: da «gradita» a «richiesta», «triennale» che diventa «magistrale», un livello di lingua. Lo strumento è un primo filtro, non un sostituto della lettura.'
    }
  ];
});
