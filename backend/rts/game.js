const {
    MAP_WIDTH, MAP_HEIGHT, TILE, UNIT_TYPE, UNIT_STATE, BUILDING_TYPE,
    STARTING_GOLD, STARTING_WOOD, UNIT_STATS, BUILDING_STATS, SIGHT_RANGE
} = require('./constants')
const { SPAWN_POSITIONS, generateMap, isBuildable } = require('./maps')
const { createUnit, findPath, processUnitMovement, processUnitCombat, processGathering, distTiles, resetUnitIds } = require('./units')
const { createBuilding, advanceBuild, processProduction, queueUnit, getPopCap, canAffordBuilding, payForBuilding, resetBuildingIds } = require('./buildings')

function initGame() {
    resetUnitIds()
    resetBuildingIds()

    const { tiles, resources } = generateMap()

    const players = [
        { id: 1, gold: STARTING_GOLD, wood: STARTING_WOOD },
        { id: 2, gold: STARTING_GOLD, wood: STARTING_WOOD }
    ]

    const buildings = []
    const units = []

    // Each player starts with a Town Hall and 3 peasants
    for (let i = 0; i < 2; i++) {
        const sp = SPAWN_POSITIONS[i]
        const playerId = i + 1
        const th = createBuilding(BUILDING_TYPE.TOWN_HALL, playerId, sp.x, sp.y, true)
        buildings.push(th)

        for (let p = 0; p < 3; p++) {
            const ux = sp.x + p
            const uy = sp.y + BUILDING_STATS[BUILDING_TYPE.TOWN_HALL].sizeY + 1
            units.push(createUnit(UNIT_TYPE.PEASANT, playerId, ux, uy))
        }
    }

    return {
        tiles,
        resources,
        players,
        buildings,
        units,
        tick: 0,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT
    }
}

function gameLoop(state) {
    state.tick++

    // Process building construction by peasants
    for (const unit of state.units) {
        if (unit.hp <= 0) continue
        if (unit.type === UNIT_TYPE.PEASANT && unit.state === UNIT_STATE.BUILDING && unit.buildTargetId != null) {
            const building = state.buildings.find(b => b.id === unit.buildTargetId)
            if (!building || building.buildComplete || building.hp <= 0) {
                unit.state = UNIT_STATE.IDLE
                unit.buildTargetId = null
                continue
            }
            const dist = distTiles(unit.x, unit.y, building.x + 1, building.y + 1)
            if (dist > 2) {
                // Walk to building
                if (!unit.path) {
                    unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, building.x + 1, building.y + 1)
                    if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }
                }
                const savedState = unit.state
                unit.state = UNIT_STATE.MOVING
                processUnitMovement(unit, state)
                unit.state = savedState
            } else {
                advanceBuild(building)
            }
        }
    }

    // Process unit movement
    for (const unit of state.units) {
        if (unit.hp <= 0) continue
        if (unit.state === UNIT_STATE.MOVING || unit.state === UNIT_STATE.RETURNING) {
            processUnitMovement(unit, state)
        }
    }

    // Process gathering
    for (const unit of state.units) {
        if (unit.hp <= 0) continue
        processGathering(unit, state)
    }

    // Process combat
    for (const unit of state.units) {
        if (unit.hp <= 0) continue
        processUnitCombat(unit, state)
    }

    // Process building production
    for (const building of state.buildings) {
        if (building.hp <= 0) continue
        processProduction(building, state)
    }

    // Remove dead units
    state.units = state.units.filter(u => u.hp > 0)

    // Remove destroyed buildings
    const destroyedBuildings = state.buildings.filter(b => b.hp <= 0)
    state.buildings = state.buildings.filter(b => b.hp > 0)

    // Clear tiles under destroyed resource buildings (gold mine tiles when exhausted already handled by gather)
    // Clear resources that are depleted
    for (const key of Object.keys(state.resources)) {
        if (state.resources[key].amount <= 0) {
            const [rx, ry] = key.split(',').map(Number)
            if (state.tiles[ry] && state.tiles[ry][rx] === TILE.TREE) {
                state.tiles[ry][rx] = TILE.GRASS
            }
            delete state.resources[key]
        }
    }

    // Check win condition: player with no buildings loses
    for (const player of state.players) {
        const hasBuildings = state.buildings.some(b => b.playerId === player.id && b.hp > 0)
        if (!hasBuildings) {
            const winner = state.players.find(p => p.id !== player.id)
            return { winnerId: winner ? winner.id : null }
        }
    }

    return false
}

function getStateForPlayer(state, playerId) {
    const visibility = computeVisibility(state, playerId)

    // Filter units: show own units always, enemy units only if in visible tiles
    const visibleUnits = state.units.filter(u => {
        if (u.playerId === playerId) return true
        return visibility[u.y] && visibility[u.y][u.x]
    })

    // Filter buildings: show own always, enemy only if any tile visible
    const visibleBuildings = state.buildings.filter(b => {
        if (b.playerId === playerId) return true
        for (let dy = 0; dy < b.sizeY; dy++) {
            for (let dx = 0; dx < b.sizeX; dx++) {
                const bx = b.x + dx
                const by = b.y + dy
                if (visibility[by] && visibility[by][bx]) return true
            }
        }
        return false
    })

    const player = state.players.find(p => p.id === playerId)
    const popCap = getPopCap(state, playerId)
    const currentPop = state.units.filter(u => u.playerId === playerId && u.hp > 0).length

    return {
        tick: state.tick,
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        tiles: state.tiles,
        resources: state.resources,
        units: visibleUnits.map(u => ({
            id: u.id, type: u.type, playerId: u.playerId,
            x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp,
            state: u.state,
            carryResource: u.carryResource, carryAmount: u.carryAmount
        })),
        buildings: visibleBuildings.map(b => ({
            id: b.id, type: b.type, playerId: b.playerId,
            x: b.x, y: b.y, sizeX: b.sizeX, sizeY: b.sizeY,
            hp: b.hp, maxHp: b.maxHp,
            buildComplete: b.buildComplete, buildProgress: b.buildProgress,
            productionQueue: b.playerId === playerId ? b.productionQueue : [],
            productionProgress: b.playerId === playerId ? b.productionProgress : 0,
            rallyX: b.rallyX, rallyY: b.rallyY
        })),
        player: player ? { id: player.id, gold: player.gold, wood: player.wood, pop: currentPop, popCap } : null,
        visibility
    }
}

function computeVisibility(state, playerId) {
    const vis = []
    for (let y = 0; y < MAP_HEIGHT; y++) {
        vis[y] = new Uint8Array(MAP_WIDTH) // 0=hidden, 1=visible
    }

    function reveal(cx, cy, range) {
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                if (dx * dx + dy * dy > range * range) continue
                const vx = cx + dx
                const vy = cy + dy
                if (vx >= 0 && vx < MAP_WIDTH && vy >= 0 && vy < MAP_HEIGHT) {
                    vis[vy][vx] = 1
                }
            }
        }
    }

    for (const unit of state.units) {
        if (unit.playerId !== playerId || unit.hp <= 0) continue
        const range = SIGHT_RANGE[unit.type] || 5
        reveal(unit.x, unit.y, range)
    }

    for (const building of state.buildings) {
        if (building.playerId !== playerId || building.hp <= 0) continue
        const range = SIGHT_RANGE[building.type] || 6
        const cx = building.x + Math.floor(building.sizeX / 2)
        const cy = building.y + Math.floor(building.sizeY / 2)
        reveal(cx, cy, range)
    }

    return vis
}

// Command handlers
function commandMove(state, playerId, unitIds, targetX, targetY) {
    for (const uid of unitIds) {
        const unit = state.units.find(u => u.id === uid && u.playerId === playerId && u.hp > 0)
        if (!unit) continue
        unit.state = UNIT_STATE.MOVING
        unit.targetX = targetX
        unit.targetY = targetY
        unit.targetId = null
        unit.buildTargetId = null
        unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, targetX, targetY)
        if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }
    }
}

function commandAttack(state, playerId, unitIds, targetId) {
    for (const uid of unitIds) {
        const unit = state.units.find(u => u.id === uid && u.playerId === playerId && u.hp > 0)
        if (!unit) continue
        unit.targetId = targetId
        unit.state = UNIT_STATE.IDLE
        unit.buildTargetId = null
    }
}

function commandGather(state, playerId, unitIds, targetX, targetY) {
    for (const uid of unitIds) {
        const unit = state.units.find(u => u.id === uid && u.playerId === playerId && u.hp > 0)
        if (!unit || unit.type !== UNIT_TYPE.PEASANT) continue
        unit.state = UNIT_STATE.GATHERING
        unit.targetX = targetX
        unit.targetY = targetY
        unit.targetId = null
        unit.buildTargetId = null
        unit.gatherTicks = 0
        unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, targetX, targetY)
        if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }
    }
}

function commandBuild(state, playerId, unitId, buildingType, x, y) {
    const unit = state.units.find(u => u.id === unitId && u.playerId === playerId && u.hp > 0 && u.type === UNIT_TYPE.PEASANT)
    if (!unit) return false

    const player = state.players.find(p => p.id === playerId)
    if (!player) return false

    if (!canAffordBuilding(player, buildingType)) return false

    const stats = BUILDING_STATS[buildingType]
    if (!isBuildable(state.tiles, x, y, stats.sizeX, stats.sizeY, state.buildings)) return false

    payForBuilding(player, buildingType)

    const building = createBuilding(buildingType, playerId, x, y, false)
    state.buildings.push(building)

    unit.state = UNIT_STATE.BUILDING
    unit.buildTargetId = building.id
    unit.targetId = null
    unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, x + 1, y + 1)
    if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }

    return true
}

function commandTrainUnit(state, playerId, buildingId, unitType) {
    const building = state.buildings.find(b => b.id === buildingId && b.playerId === playerId && b.hp > 0)
    if (!building) return false

    const player = state.players.find(p => p.id === playerId)
    if (!player) return false

    return queueUnit(building, unitType, player)
}

module.exports = {
    initGame, gameLoop, getStateForPlayer,
    commandMove, commandAttack, commandGather, commandBuild, commandTrainUnit
}
