'use strict'

const GALAXIES = 1
const SYSTEMS = 50
const SLOTS = 9
const START_SYSTEM_MIN = 1
const START_SYSTEM_MAX = 10
const TICK_MS = 5000

const START_RESOURCES = {
  metal: 500,
  crystal: 300,
  deuterium: 100
}

const START_BUILDINGS = {
  metal_mine: 1,
  crystal_mine: 0,
  deuterium_synthesizer: 0,
  solar_plant: 1,
  research_lab: 0,
  shipyard: 0
}

const BUILDING_TYPES = ['metal_mine', 'crystal_mine', 'deuterium_synthesizer', 'solar_plant', 'research_lab', 'shipyard']

// Build time: base[type] * 1.5^current_level (seconds)
const BUILD_TIME_BASE = {
  metal_mine: 30,
  crystal_mine: 40,
  deuterium_synthesizer: 60,
  solar_plant: 20,
  research_lab: 50,
  shipyard: 80
}

// Cost for next level: { metal, crystal, deuterium } (formula: base * 1.5^level)
const BUILD_COST_BASE = {
  metal_mine: { metal: 60, crystal: 15, deuterium: 0 },
  crystal_mine: { metal: 48, crystal: 24, deuterium: 0 },
  deuterium_synthesizer: { metal: 225, crystal: 75, deuterium: 0 },
  solar_plant: { metal: 75, crystal: 30, deuterium: 0 },
  research_lab: { metal: 200, crystal: 400, deuterium: 200 },
  shipyard: { metal: 400, crystal: 200, deuterium: 100 }
}

// Energy: solar_plant gives 20 per level. Mine consumption (per level): metal 10, crystal 10, deuterium 20
const ENERGY_PER_SOLAR_LEVEL = 20
const CONSUMPTION_PER_LEVEL = {
  metal_mine: 10,
  crystal_mine: 10,
  deuterium_synthesizer: 20
}

// Production per hour at level L (OGame-style), then we divide by 3600 for per-second
// Metal: 30 * L * 1.1^L
// Crystal: 20 * L * 1.1^L
// Deuterium: 10 * L * 1.1^L * (0.9 - 0.01*slot)
const PRODUCTION_BASE = {
  metal_mine: 30,
  crystal_mine: 20,
  deuterium_synthesizer: 10
}

// Phase 2: Research (player-wide, one lab on one planet for v1). Phase 3: + espionage
const RESEARCH_TYPES = ['energy', 'weapons', 'shielding', 'propulsion', 'espionage']
const RESEARCH_COST_BASE = {
  energy: { metal: 0, crystal: 800, deuterium: 400 },
  weapons: { metal: 800, crystal: 200, deuterium: 0 },
  shielding: { metal: 200, crystal: 600, deuterium: 0 },
  propulsion: { metal: 0, crystal: 400, deuterium: 800 },
  espionage: { metal: 0, crystal: 200, deuterium: 1000 }
}
const RESEARCH_TIME_BASE = { energy: 120, weapons: 160, shielding: 200, propulsion: 100, espionage: 180 }

// Phase 2: Ships (built at shipyard). Phase 4: + bomber, destroyer, battleship
const SHIP_TYPES = ['small_cargo', 'large_cargo', 'fighter', 'cruiser', 'colony_ship', 'recycler', 'espionage_probe', 'bomber', 'destroyer', 'battleship']
const SHIP_COST = {
  small_cargo: { metal: 2000, crystal: 2000, deuterium: 0 },
  large_cargo: { metal: 6000, crystal: 6000, deuterium: 0 },
  fighter: { metal: 3000, crystal: 1000, deuterium: 0 },
  cruiser: { metal: 20000, crystal: 7000, deuterium: 2000 },
  colony_ship: { metal: 10000, crystal: 20000, deuterium: 10000 },
  recycler: { metal: 10000, crystal: 6000, deuterium: 2000 },
  espionage_probe: { metal: 0, crystal: 1000, deuterium: 0 },
  bomber: { metal: 50000, crystal: 25000, deuterium: 15000 },
  destroyer: { metal: 60000, crystal: 50000, deuterium: 15000 },
  battleship: { metal: 50000, crystal: 25000, deuterium: 15000 }
}
const SHIP_BUILD_TIME_BASE = { small_cargo: 120, large_cargo: 300, fighter: 150, cruiser: 600, colony_ship: 800, recycler: 400, espionage_probe: 60, bomber: 900, destroyer: 1200, battleship: 1000 }

// Fleet speed (for flight time)
const SHIP_SPEED = { small_cargo: 10, large_cargo: 8, fighter: 12, cruiser: 10, colony_ship: 6, recycler: 4, espionage_probe: 20, bomber: 8, destroyer: 7, battleship: 9 }

// Combat: attack, shield, hull per unit
const SHIP_STATS = {
  small_cargo: { attack: 5, shield: 10, hull: 400 },
  large_cargo: { attack: 5, shield: 25, hull: 1200 },
  fighter: { attack: 50, shield: 10, hull: 400 },
  cruiser: { attack: 400, shield: 50, hull: 2700 },
  colony_ship: { attack: 0, shield: 100, hull: 3000 },
  recycler: { attack: 1, shield: 10, hull: 1600 },
  espionage_probe: { attack: 0, shield: 0, hull: 100 },
  bomber: { attack: 1000, shield: 100, hull: 7500 },
  destroyer: { attack: 2000, shield: 500, hull: 11000 },
  battleship: { attack: 1000, shield: 400, hull: 10000 }
}

// Recycler capacity (metal + crystal) per ship
const RECYCLER_CAPACITY = 20000

// Cargo capacity per ship (metal + crystal + deuterium)
const CARGO_CAPACITY = { small_cargo: 5000, large_cargo: 25000 }

// Phase 3: Defenses. Phase 4: + light_laser, heavy_laser, ion_cannon
const DEFENSE_TYPES = ['rocket_launcher', 'light_laser', 'heavy_laser', 'ion_cannon']
const DEFENSE_COST = {
  rocket_launcher: { metal: 2000, crystal: 0, deuterium: 0 },
  light_laser: { metal: 1500, crystal: 500, deuterium: 0 },
  heavy_laser: { metal: 6000, crystal: 2000, deuterium: 0 },
  ion_cannon: { metal: 50000, crystal: 25000, deuterium: 15000 }
}
const DEFENSE_BUILD_TIME_BASE = { rocket_launcher: 30, light_laser: 45, heavy_laser: 90, ion_cannon: 300 }
const DEFENSE_STATS = {
  rocket_launcher: { attack: 80, shield: 20, hull: 200 },
  light_laser: { attack: 100, shield: 25, hull: 250 },
  heavy_laser: { attack: 250, shield: 100, hull: 1000 },
  ion_cannon: { attack: 500, shield: 500, hull: 3000 }
}

// Debris: % of destroyed unit cost that becomes debris (metal/crystal)
const DEBRIS_FACTOR = 0.3

// Colony start resources (new colony)
const COLONY_START_RESOURCES = { metal: 500, crystal: 300, deuterium: 100 }
const COLONY_START_BUILDINGS = { metal_mine: 0, crystal_mine: 0, deuterium_synthesizer: 0, solar_plant: 1, research_lab: 0, shipyard: 0 }

// Phase 4: Alliances
const ALLIANCE_TAG_MAX = 8
const ALLIANCE_NAME_MAX = 30
const ALLIANCE_CHAT_MAX = 500
const ALLIANCE_CHAT_MAX_MESSAGES = 100

module.exports = {
  GALAXIES,
  SYSTEMS,
  SLOTS,
  START_SYSTEM_MIN,
  START_SYSTEM_MAX,
  TICK_MS,
  START_RESOURCES,
  START_BUILDINGS,
  BUILDING_TYPES,
  BUILD_TIME_BASE,
  BUILD_COST_BASE,
  ENERGY_PER_SOLAR_LEVEL,
  CONSUMPTION_PER_LEVEL,
  PRODUCTION_BASE,
  RESEARCH_TYPES,
  RESEARCH_COST_BASE,
  RESEARCH_TIME_BASE,
  SHIP_TYPES,
  SHIP_COST,
  SHIP_BUILD_TIME_BASE,
  SHIP_SPEED,
  SHIP_STATS,
  DEFENSE_TYPES,
  DEFENSE_COST,
  DEFENSE_BUILD_TIME_BASE,
  DEFENSE_STATS,
  RECYCLER_CAPACITY,
  CARGO_CAPACITY,
  DEBRIS_FACTOR,
  COLONY_START_RESOURCES,
  COLONY_START_BUILDINGS,
  ALLIANCE_TAG_MAX,
  ALLIANCE_NAME_MAX,
  ALLIANCE_CHAT_MAX,
  ALLIANCE_CHAT_MAX_MESSAGES
}
