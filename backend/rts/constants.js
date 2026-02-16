const FRAME_RATE = 10
const MAP_WIDTH = 64
const MAP_HEIGHT = 64
const TILE_SIZE = 32
const MAX_PLAYERS = 2

// Tile types
const TILE = {
    GRASS: 0,
    WATER: 1,
    TREE: 2,
    GOLD_MINE: 3,
    ROCK: 4
}

// Unit types
const UNIT_TYPE = {
    PEASANT: 'PEASANT',
    FOOTMAN: 'FOOTMAN',
    ARCHER: 'ARCHER'
}

// Unit states
const UNIT_STATE = {
    IDLE: 'IDLE',
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
    GATHERING: 'GATHERING',
    BUILDING: 'BUILDING',
    RETURNING: 'RETURNING'
}

// Building types
const BUILDING_TYPE = {
    TOWN_HALL: 'TOWN_HALL',
    BARRACKS: 'BARRACKS',
    FARM: 'FARM'
}

// Resource types
const RESOURCE = {
    GOLD: 'GOLD',
    WOOD: 'WOOD'
}

// Starting resources
const STARTING_GOLD = 400
const STARTING_WOOD = 400
const STARTING_POP_CAP = 10
const POP_PER_FARM = 5

// Resource per tile
const TREE_RESOURCE = 100
const GOLD_MINE_RESOURCE = 800
const CARRY_CAPACITY = 10
const GATHER_RATE = 2
const GATHER_TICKS = 5

// Unit stats: { hp, damage, range, speed (tiles per second), cost, trainTime (ticks), popCost }
const UNIT_STATS = {
    [UNIT_TYPE.PEASANT]:  { hp: 30, damage: 3,  range: 1, speed: 0.8, costGold: 50,  costWood: 0,  trainTicks: 50,  popCost: 1 },
    [UNIT_TYPE.FOOTMAN]:  { hp: 60, damage: 8,  range: 1, speed: 0.6, costGold: 100, costWood: 0,  trainTicks: 80,  popCost: 1 },
    [UNIT_TYPE.ARCHER]:   { hp: 40, damage: 6,  range: 5, speed: 0.7, costGold: 50,  costWood: 50, trainTicks: 70,  popCost: 1 }
}

// Building stats: { hp, costGold, costWood, buildTicks, sizeX, sizeY }
const BUILDING_STATS = {
    [BUILDING_TYPE.TOWN_HALL]: { hp: 600, costGold: 0,   costWood: 0,   buildTicks: 0,   sizeX: 3, sizeY: 3 },
    [BUILDING_TYPE.BARRACKS]:  { hp: 400, costGold: 150, costWood: 100, buildTicks: 150, sizeX: 3, sizeY: 3 },
    [BUILDING_TYPE.FARM]:      { hp: 200, costGold: 50,  costWood: 100, buildTicks: 80,  sizeX: 2, sizeY: 2 }
}

// What each building can produce
const BUILDING_PRODUCES = {
    [BUILDING_TYPE.TOWN_HALL]: [UNIT_TYPE.PEASANT],
    [BUILDING_TYPE.BARRACKS]: [UNIT_TYPE.FOOTMAN, UNIT_TYPE.ARCHER],
    [BUILDING_TYPE.FARM]: []
}

// Attack cooldown ticks
const ATTACK_COOLDOWN_TICKS = 10

// Fog of war sight range (tiles)
const SIGHT_RANGE = {
    [UNIT_TYPE.PEASANT]: 5,
    [UNIT_TYPE.FOOTMAN]: 5,
    [UNIT_TYPE.ARCHER]: 7,
    [BUILDING_TYPE.TOWN_HALL]: 8,
    [BUILDING_TYPE.BARRACKS]: 6,
    [BUILDING_TYPE.FARM]: 4
}

module.exports = {
    FRAME_RATE,
    MAP_WIDTH,
    MAP_HEIGHT,
    TILE_SIZE,
    MAX_PLAYERS,
    TILE,
    UNIT_TYPE,
    UNIT_STATE,
    BUILDING_TYPE,
    RESOURCE,
    STARTING_GOLD,
    STARTING_WOOD,
    STARTING_POP_CAP,
    POP_PER_FARM,
    TREE_RESOURCE,
    GOLD_MINE_RESOURCE,
    CARRY_CAPACITY,
    GATHER_RATE,
    GATHER_TICKS,
    UNIT_STATS,
    BUILDING_STATS,
    BUILDING_PRODUCES,
    ATTACK_COOLDOWN_TICKS,
    SIGHT_RANGE
}
