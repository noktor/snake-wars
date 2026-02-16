const { BUILDING_TYPE, BUILDING_STATS, BUILDING_PRODUCES, UNIT_STATS, UNIT_TYPE, POP_PER_FARM } = require('./constants')
const { createUnit } = require('./units')

let nextBuildingId = 1

function resetBuildingIds() { nextBuildingId = 1 }

function createBuilding(type, playerId, x, y, preBuilt) {
    const stats = BUILDING_STATS[type]
    return {
        id: nextBuildingId++,
        type,
        playerId,
        x, y,
        sizeX: stats.sizeX,
        sizeY: stats.sizeY,
        hp: preBuilt ? stats.hp : 1,
        maxHp: stats.hp,
        buildProgress: preBuilt ? stats.buildTicks : 0,
        buildComplete: !!preBuilt,
        productionQueue: [],
        productionProgress: 0,
        rallyX: x + Math.floor(stats.sizeX / 2),
        rallyY: y + stats.sizeY + 1
    }
}

function processConstruction(building) {
    if (building.buildComplete) return
    // Construction is advanced by peasants in units.js processBuilding
}

function advanceBuild(building) {
    if (building.buildComplete) return false
    const stats = BUILDING_STATS[building.type]
    building.buildProgress++
    building.hp = Math.floor((building.buildProgress / stats.buildTicks) * stats.hp)
    if (building.buildProgress >= stats.buildTicks) {
        building.buildComplete = true
        building.hp = stats.hp
        return true
    }
    return false
}

function processProduction(building, state) {
    if (!building.buildComplete) return
    if (building.productionQueue.length === 0) return

    const unitType = building.productionQueue[0]
    const unitStats = UNIT_STATS[unitType]
    if (!unitStats) return

    const player = state.players.find(p => p.id === building.playerId)
    if (!player) return

    // Check pop cap
    const currentPop = state.units.filter(u => u.playerId === building.playerId && u.hp > 0).length
    const popCap = getPopCap(state, building.playerId)
    if (currentPop >= popCap) return

    building.productionProgress++
    if (building.productionProgress >= unitStats.trainTicks) {
        // Spawn unit at rally point
        const spawnX = building.rallyX
        const spawnY = building.rallyY
        const unit = createUnit(unitType, building.playerId, spawnX, spawnY)
        state.units.push(unit)
        building.productionQueue.shift()
        building.productionProgress = 0
    }
}

function queueUnit(building, unitType, player) {
    const produces = BUILDING_PRODUCES[building.type]
    if (!produces || !produces.includes(unitType)) return false
    if (!building.buildComplete) return false

    const unitStats = UNIT_STATS[unitType]
    if (!unitStats) return false

    if (player.gold < unitStats.costGold || player.wood < unitStats.costWood) return false

    player.gold -= unitStats.costGold
    player.wood -= unitStats.costWood
    building.productionQueue.push(unitType)
    return true
}

function getPopCap(state, playerId) {
    const { STARTING_POP_CAP } = require('./constants')
    let cap = STARTING_POP_CAP
    for (const b of state.buildings) {
        if (b.playerId === playerId && b.hp > 0 && b.buildComplete && b.type === BUILDING_TYPE.FARM) {
            cap += POP_PER_FARM
        }
    }
    return cap
}

function canAffordBuilding(player, buildingType) {
    const stats = BUILDING_STATS[buildingType]
    return player.gold >= stats.costGold && player.wood >= stats.costWood
}

function payForBuilding(player, buildingType) {
    const stats = BUILDING_STATS[buildingType]
    player.gold -= stats.costGold
    player.wood -= stats.costWood
}

module.exports = {
    createBuilding, processConstruction, advanceBuild, processProduction,
    queueUnit, getPopCap, canAffordBuilding, payForBuilding, resetBuildingIds
}
