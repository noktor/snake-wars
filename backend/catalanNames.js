// Shared Catalan names for AI / bot players across all games
const CATALAN_NAMES = [
    'Antoni Gaudí', 'Salvador Dalí', 'Joan Miró', 'Pau Casals', 'Mercè Rodoreda',
    'Jacint Verdaguer', 'Ramon Llull', 'Ferran Adrià', 'Pep Guardiola', 'Xavi Hernández',
    'Montserrat Caballé', 'Quim Monzó', 'Antoni Tàpies', 'Isabel Coixet', 'Núria Espert',
    'Carod-Rovira', 'Pasqual Maragall', 'Jordi Pujol', 'Artur Mas', 'Joan Saura',
    'Duran i Lleida', 'Heribert Barrera', 'Josep Lluís', 'Raimon', 'Lluís Llach'
]

function getCatalanName(index) {
    return CATALAN_NAMES[Math.abs(index) % CATALAN_NAMES.length]
}

module.exports = { CATALAN_NAMES, getCatalanName }
