// Shared bot names for AI players across all games: Catalan & Spanish personalities, politicians, etc.
const CATALAN_NAMES = [
    'Antoni Gaudí', 'Salvador Dalí', 'Joan Miró', 'Pau Casals', 'Mercè Rodoreda',
    'Jacint Verdaguer', 'Ramon Llull', 'Ferran Adrià', 'Pep Guardiola', 'Xavi Hernández',
    'Montserrat Caballé', 'Quim Monzó', 'Antoni Tàpies', 'Isabel Coixet', 'Núria Espert',
    'Carod-Rovira', 'Pasqual Maragall', 'Jordi Pujol', 'Artur Mas', 'Joan Saura',
    'Duran i Lleida', 'Heribert Barrera', 'Raimon', 'Lluís Llach', 'Serrat',
    'Frederic Mompou', 'Àngel Guimerà', 'Josep Pla', 'Joan Fuster', 'Sergi López',
    'Teresa Pàmies', 'Maria Aurèlia Capmany', 'Ovidi Montllor', 'Carme Ruscalleda',
    'Jordi Savall', 'Victoria dels Àngels', 'Alícia de Larrocha', 'Pere Casaldàliga',
    'Josep Carreras', 'Montserrat Caballé', 'Antoni Bassas', 'Jordi Évole',
    'Boris Izaguirre', 'Rosa Regàs', 'Manuel de Pedrolo', 'Miquel Martí i Pol'
]

const CATALAN_POLITICIANS = [
    'Carod-Rovira', 'Pasqual Maragall', 'Jordi Pujol', 'Artur Mas', 'Joan Saura',
    'Duran i Lleida', 'Heribert Barrera', 'Josep Lluís', 'Ernest Maragall',
    'Oriol Junqueras', 'Carles Puigdemont', 'Marta Rovira', 'Pere Aragonès',
    'Quim Torra', 'Inés Arrimadas', 'Gabriel Rufián', 'Laura Borràs',
    'Santi Vila', 'Felip Puig', 'Joan Herrera', 'Joan Tardà', 'Rafel Ribó',
    'Josep Maria Forné', 'Convergència', 'Esquerra', 'ICV', 'PSC'
]

const SPANISH_POLITICIANS = [
    'Felipe González', 'José María Aznar', 'Rodríguez Zapatero', 'Mariano Rajoy',
    'Pedro Sánchez', 'Pablo Iglesias', 'Alberto Núñez Feijóo', 'Santiago Abascal',
    'Yolanda Díaz', 'José Bono', 'Alfredo Pérez Rubalcaba', 'Soraya Sáenz de Santamaría',
    'Carmen Calvo', 'Dolores Delgado', 'Isabel Díaz Ayuso', 'Juanma Moreno',
    'Adolfo Suárez', 'Leopoldo Calvo-Sotelo', 'Manuel Fraga', 'Jordi Sevilla',
    'Rosa Díez', 'Gaspar Llamazares', 'Joan Baldoví', 'Inés Arrimadas',
    'Cayetana Álvarez de Toledo', 'Cuca Gamarra', 'Ione Belarra', 'Iñigo Errejón'
]

const SPANISH_FAMOUS = [
    'Penélope Cruz', 'Javier Bardem', 'Antonio Banderas', 'Pedro Almodóvar',
    'Rafael Nadal', 'Fernando Alonso', 'Pau Gasol', 'Marc Márquez',
    'Miguel Indurain', 'David Villa', 'Andrés Iniesta', 'Iker Casillas',
    'Plácido Domingo', 'Paco de Lucía', 'Camarón',
    'Federico García Lorca', 'Miguel de Cervantes', 'Pablo Picasso',
    'Velázquez', 'Goya',
    'Lola Flores', 'Rocío Jurado', 'Isabel Pantoja', 'Rosalía',
    'Alejandro Sanz', 'Enrique Iglesias', 'Joaquín Sabina', 'Mecano',
    'El Cigala', 'Diego El Cigala', 'Buenaventura Durruti', 'La Pasionaria',
    'Severo Ochoa', 'Santiago Ramón y Cajal', 'Margarita Salas'
]

const ALL_NAMES = [
    ...CATALAN_NAMES,
    ...CATALAN_POLITICIANS,
    ...SPANISH_POLITICIANS,
    ...SPANISH_FAMOUS
]

function getCatalanName(index) {
    return ALL_NAMES[Math.abs(index) % ALL_NAMES.length]
}

module.exports = { CATALAN_NAMES, CATALAN_POLITICIANS, SPANISH_POLITICIANS, SPANISH_FAMOUS, ALL_NAMES, getCatalanName }
