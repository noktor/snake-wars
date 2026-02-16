const {
    UNIT_TYPE, UNIT_STATE, BUILDING_TYPE, TILE,
    UNIT_STATS, BUILDING_STATS, BUILDING_PRODUCES,
    MAP_WIDTH, MAP_HEIGHT, STARTING_POP_CAP, POP_PER_FARM
} = require('./constants')
const { isBuildable } = require('./maps')
const { distTiles } = require('./units')
const { getPopCap, canAffordBuilding } = require('./buildings')

// Difficulty profiles
const DIFFICULTY = {
    easy: {
        decisionInterval: 60,   // ticks between decisions (~3s at 20fps)
        maxPeasants: 5,
        maxMilitary: 8,
        attackThreshold: 8,     // military units before attacking
        maxBarracks: 1,
        farmAhead: 1,           // build farm when pop within N of cap
        gatherEfficiency: 0.6,  // chance to reassign idle peasant
        buildDelay: 200,        // ticks before first build
        attackTargetTownHall: false,
        trainMix: { footman: 0.8, archer: 0.2 }
    },
    medium: {
        decisionInterval: 30,
        maxPeasants: 7,
        maxMilitary: 15,
        attackThreshold: 5,
        maxBarracks: 1,
        farmAhead: 2,
        gatherEfficiency: 0.85,
        buildDelay: 100,
        attackTargetTownHall: false,
        trainMix: { footman: 0.6, archer: 0.4 }
    },
    hard: {
        decisionInterval: 16,
        maxPeasants: 8,
        maxMilitary: 25,
        attackThreshold: 3,
        maxBarracks: 2,
        farmAhead: 3,
        gatherEfficiency: 1.0,
        buildDelay: 40,
        attackTargetTownHall: true,
        trainMix: { footman: 0.5, archer: 0.5 }
    }
}

function aiTick(state, aiConfig) {
    const { playerId, difficulty, lastDecisionTick } = aiConfig
    const profile = DIFFICULTY[difficulty] || DIFFICULTY.easy

    // Only make decisions at intervals
    if (state.tick - (aiConfig.lastDecisionTick || 0) < profile.decisionInterval) return
    aiConfig.lastDecisionTick = state.tick

    const player = state.players.find(p => p.id === playerId)
    if (!player) return

    const myUnits = state.units.filter(u => u.playerId === playerId && u.hp > 0)
    const myBuildings = state.buildings.filter(b => b.playerId === playerId && b.hp > 0)
    const enemyUnits = state.units.filter(u => u.playerId !== playerId && u.hp > 0)
    const enemyBuildings = state.buildings.filter(b => b.playerId !== playerId && b.hp > 0)

    const peasants = myUnits.filter(u => u.type === UNIT_TYPE.PEASANT)
    const military = myUnits.filter(u => u.type !== UNIT_TYPE.PEASANT)
    const townHalls = myBuildings.filter(b => b.type === BUILDING_TYPE.TOWN_HALL)
    const barracks = myBuildings.filter(b => b.type === BUILDING_TYPE.BARRACKS && b.buildComplete)
    const farms = myBuildings.filter(b => b.type === BUILDING_TYPE.FARM)

    const popCap = getPopCap(state, playerId)
    const currentPop = myUnits.length

    // ─── 1. Economy: assign idle peasants to gather ─────────────
    aiEconomy(state, playerId, peasants, myBuildings, player, profile)

    // ─── 2. Build orders ─────────────────────────────────────────
    if (state.tick > profile.buildDelay) {
        aiBuildOrders(state, playerId, peasants, myBuildings, farms, barracks, townHalls, player, profile, currentPop, popCap)
    }

    // ─── 3. Production: train units ──────────────────────────────
    aiProduction(state, playerId, townHalls, barracks, peasants, military, player, profile, currentPop, popCap)

    // ─── 4. Military: attack when ready ──────────────────────────
    aiMilitary(state, playerId, military, enemyUnits, enemyBuildings, profile)

    // ─── 5. Defend: react to attacks on base ─────────────────────
    aiDefend(state, playerId, military, myBuildings, enemyUnits)
}

// ─── Economy ────────────────────────────────────────────────────
function aiEconomy(state, playerId, peasants, myBuildings, player, profile) {
    const { commandGather } = require('./game')

    const idlePeasants = peasants.filter(u =>
        u.state === UNIT_STATE.IDLE && !u.buildTargetId
    )

    for (const peasant of idlePeasants) {
        if (Math.random() > profile.gatherEfficiency) continue

        // Decide gold vs wood priority
        const needGold = player.gold < player.wood || player.gold < 200
        const preferType = needGold ? 'GOLD' : 'WOOD'

        const target = findNearestResource(state, peasant.x, peasant.y, preferType)
        if (target) {
            commandGather(state, playerId, [peasant.id], target.x, target.y)
        } else {
            // Try the other resource type
            const altTarget = findNearestResource(state, peasant.x, peasant.y, needGold ? 'WOOD' : 'GOLD')
            if (altTarget) {
                commandGather(state, playerId, [peasant.id], altTarget.x, altTarget.y)
            }
        }
    }
}

function findNearestResource(state, fromX, fromY, resourceType) {
    let best = null
    let bestDist = Infinity

    for (const key of Object.keys(state.resources)) {
        const res = state.resources[key]
        if (res.amount <= 0) continue
        if (resourceType && res.type !== resourceType) continue

        const [rx, ry] = key.split(',').map(Number)
        const d = distTiles(fromX, fromY, rx, ry)
        if (d < bestDist) {
            bestDist = d
            best = { x: rx, y: ry }
        }
    }
    return best
}

// ─── Build Orders ───────────────────────────────────────────────
function aiBuildOrders(state, playerId, peasants, myBuildings, farms, barracks, townHalls, player, profile, currentPop, popCap) {
    const { commandBuild } = require('./game')

    // Find an idle peasant to build (not currently gathering or building)
    const builder = peasants.find(u =>
        u.state === UNIT_STATE.IDLE || u.state === UNIT_STATE.GATHERING
    )
    if (!builder) return

    const allBarracks = myBuildings.filter(b => b.type === BUILDING_TYPE.BARRACKS)
    const allFarms = myBuildings.filter(b => b.type === BUILDING_TYPE.FARM)

    // Priority 1: Farm if near pop cap
    if (currentPop + profile.farmAhead >= popCap && canAffordBuilding(player, BUILDING_TYPE.FARM)) {
        const spot = findBuildSpot(state, myBuildings, BUILDING_TYPE.FARM, townHalls)
        if (spot) {
            commandBuild(state, playerId, builder.id, BUILDING_TYPE.FARM, spot.x, spot.y)
            return
        }
    }

    // Priority 2: First barracks
    if (allBarracks.length < 1 && canAffordBuilding(player, BUILDING_TYPE.BARRACKS)) {
        const spot = findBuildSpot(state, myBuildings, BUILDING_TYPE.BARRACKS, townHalls)
        if (spot) {
            commandBuild(state, playerId, builder.id, BUILDING_TYPE.BARRACKS, spot.x, spot.y)
            return
        }
    }

    // Priority 3: Additional barracks (hard only)
    if (allBarracks.length < profile.maxBarracks && allBarracks.length >= 1 && canAffordBuilding(player, BUILDING_TYPE.BARRACKS)) {
        const spot = findBuildSpot(state, myBuildings, BUILDING_TYPE.BARRACKS, townHalls)
        if (spot) {
            commandBuild(state, playerId, builder.id, BUILDING_TYPE.BARRACKS, spot.x, spot.y)
            return
        }
    }

    // Priority 4: Extra farms for growth
    if (allFarms.length < 4 && currentPop + 3 >= popCap && canAffordBuilding(player, BUILDING_TYPE.FARM)) {
        const spot = findBuildSpot(state, myBuildings, BUILDING_TYPE.FARM, townHalls)
        if (spot) {
            commandBuild(state, playerId, builder.id, BUILDING_TYPE.FARM, spot.x, spot.y)
        }
    }
}

function findBuildSpot(state, myBuildings, buildingType, townHalls) {
    const stats = BUILDING_STATS[buildingType]
    const th = townHalls[0]
    if (!th) return null

    // Search in a spiral around the town hall
    const cx = th.x + 1
    const cy = th.y + 1
    for (let radius = 4; radius < 15; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
                const bx = cx + dx
                const by = cy + dy
                if (bx < 1 || by < 1 || bx + stats.sizeX >= MAP_WIDTH - 1 || by + stats.sizeY >= MAP_HEIGHT - 1) continue
                if (isBuildable(state.tiles, bx, by, stats.sizeX, stats.sizeY, state.buildings)) {
                    return { x: bx, y: by }
                }
            }
        }
    }
    return null
}

// ─── Production ─────────────────────────────────────────────────
function aiProduction(state, playerId, townHalls, barracks, peasants, military, player, profile, currentPop, popCap) {
    const { commandTrainUnit } = require('./game')

    // Train peasants from town hall
    if (peasants.length < profile.maxPeasants && currentPop < popCap) {
        for (const th of townHalls) {
            if (!th.buildComplete) continue
            if (th.productionQueue.length < 2) {
                commandTrainUnit(state, playerId, th.id, UNIT_TYPE.PEASANT)
            }
        }
    }

    // Train military from barracks
    if (military.length < profile.maxMilitary && currentPop < popCap) {
        for (const bk of barracks) {
            if (bk.productionQueue.length >= 2) continue
            // Decide footman or archer based on mix
            const unitType = Math.random() < profile.trainMix.footman
                ? UNIT_TYPE.FOOTMAN
                : UNIT_TYPE.ARCHER
            commandTrainUnit(state, playerId, bk.id, unitType)
        }
    }
}

// ─── Military ───────────────────────────────────────────────────
function aiMilitary(state, playerId, military, enemyUnits, enemyBuildings, profile) {
    const { commandMove, commandAttack } = require('./game')

    // Only attack when we have enough troops
    const idleMilitary = military.filter(u =>
        u.state === UNIT_STATE.IDLE || u.state === UNIT_STATE.MOVING
    )

    if (idleMilitary.length < profile.attackThreshold) return

    // Find target
    let target = null
    if (profile.attackTargetTownHall) {
        // Hard AI targets town hall directly
        target = enemyBuildings.find(b => b.type === BUILDING_TYPE.TOWN_HALL)
    }
    if (!target) {
        // Attack nearest enemy building
        if (enemyBuildings.length > 0) {
            const avgX = idleMilitary.reduce((s, u) => s + u.x, 0) / idleMilitary.length
            const avgY = idleMilitary.reduce((s, u) => s + u.y, 0) / idleMilitary.length
            let bestDist = Infinity
            for (const b of enemyBuildings) {
                const d = distTiles(avgX, avgY, b.x + 1, b.y + 1)
                if (d < bestDist) { bestDist = d; target = b }
            }
        }
    }

    if (!target) {
        // Attack nearest enemy unit instead
        if (enemyUnits.length > 0) {
            const avgX = idleMilitary.reduce((s, u) => s + u.x, 0) / idleMilitary.length
            const avgY = idleMilitary.reduce((s, u) => s + u.y, 0) / idleMilitary.length
            let bestDist = Infinity
            for (const u of enemyUnits) {
                const d = distTiles(avgX, avgY, u.x, u.y)
                if (d < bestDist) { bestDist = d; target = u }
            }
        }
    }

    if (target) {
        const ids = idleMilitary.map(u => u.id)
        commandAttack(state, playerId, ids, target.id)
    }
}

// ─── Defend ─────────────────────────────────────────────────────
function aiDefend(state, playerId, military, myBuildings, enemyUnits) {
    const { commandAttack } = require('./game')

    // Check for enemies near our buildings
    for (const b of myBuildings) {
        const bx = b.x + Math.floor(b.sizeX / 2)
        const by = b.y + Math.floor(b.sizeY / 2)

        for (const enemy of enemyUnits) {
            if (distTiles(bx, by, enemy.x, enemy.y) <= 8) {
                // Send nearby idle military to defend
                const defenders = military.filter(u =>
                    (u.state === UNIT_STATE.IDLE) &&
                    distTiles(u.x, u.y, bx, by) <= 15
                )
                if (defenders.length > 0) {
                    commandAttack(state, playerId, defenders.map(u => u.id), enemy.id)
                }
                return // only respond to one threat per tick
            }
        }
    }
}

module.exports = { aiTick }
