/*
 * Esempi per la demo e per l'esercizio "trova l'errore".
 * Sono tutti SINTETICI: persone, aziende, prodotti e test sono inventati.
 * "attesi" elenca gli elementi del testo AI che il controllo non deve dare per verificati;
 * un test controlla che l'elenco resti coerente con la logica.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EsempiControlloFonti = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return [
    {
      id: 'verbale',
      titolo: 'Verbale di riunione',
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
      attesi: ['12%', 'tre', 'Elisa Tonon', '18 aprile 2026'],
      nota: 'Errori inseriti: crescita 12% invece di 8%; tre punti di consegna invece di due; cognome sbagliato (Tonon invece di Toffolo); data della prossima riunione sbagliata.'
    },
    {
      id: 'scheda',
      titolo: 'Scheda di un prodotto',
      descrizione: 'Un testo commerciale generato da una scheda tecnica. Quali dettagli sono stati inventati?',
      fonte:
        'Aspirapolvere robot RX-200. Autonomia: 120 minuti. Capacità del serbatoio: 0,4 litri. Peso: 3,2 kg. ' +
        'Rumorosità: 58 dB. Garanzia di 24 mesi. Prezzo di listino: 349 euro. Compatibile con l\'app HomeClean.',
      ai:
        'L\'aspirapolvere robot RX-200 offre un\'autonomia di 150 minuti, un serbatoio da 0,4 litri e un peso di 3,2 kg. ' +
        'La rumorosità è di 58 dB e la garanzia dura 36 mesi. Il prezzo di listino è di 349 euro ed è compatibile ' +
        'con l\'app HomeClean e con Alexa.',
      attesi: ['150', '36', 'Alexa'],
      nota: 'Errori inseriti: autonomia 150 minuti invece di 120; garanzia 36 mesi invece di 24; compatibilità con Alexa mai dichiarata.'
    },
    {
      id: 'test',
      titolo: 'La scheda di un test',
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
      attesi: ['4', '26', '12%', '2021'],
      nota: 'Errori inseriti: 4 prove invece di 5; punteggio massimo 26 invece di 28; prevalenza 12% invece di 5%; anno di validazione sbagliato. Test, persona e dati sono inventati: il caso reale da cui nasce riguardava un riassunto generato dall\'AI di lezioni universitarie.'
    }
  ];
});
