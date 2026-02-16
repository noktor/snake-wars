const {
    MAP_WIDTH, MAP_HEIGHT, TILE, UNIT_TYPE, UNIT_STATE, RESOURCE,
    UNIT_STATS, CARRY_CAPACITY, GATHER_RATE, GATHER_TICKS,
    ATTACK_COOLDOWN_TICKS, BUILDING_STATS
} = require('./constants')
const { isWalkable } = require('./maps')

let nextUnitId = 1

function resetUnitIds() { nextUnitId = 1 }

function createUnit(type, playerId, x, y) {
    const stats = UNIT_STATS[type]
    return {
        id: nextUnitId++,
        type,
        playerId,
        x, y,
        hp: stats.hp,
        maxHp: stats.hp,
        state: UNIT_STATE.IDLE,
        targetX: null,
        targetY: null,
        targetId: null,
        path: null,
        pathIndex: 0,
        moveProgress: 0,
        attackCooldown: 0,
        carryResource: null,
        carryAmount: 0,
        gatherTicks: 0,
        buildTargetId: null,
        buildProgress: 0
    }
}

// Simple A* pathfinding on tile grid
function findPath(tiles, buildings, sx, sy, tx, ty, maxSteps) {
    if (sx === tx && sy === ty) return [{ x: tx, y: ty }]
    maxSteps = maxSteps || 200

    function tileBlocked(x, y) {
        if (!isWalkable(tiles, x, y)) return true
        for (const b of buildings) {
            if (x >= b.x && x < b.x + b.sizeX && y >= b.y && y < b.y + b.sizeY) return true
        }
        return false
    }

    // Allow target tile even if blocked (for attack/gather commands)
    const targetBlocked = tileBlocked(tx, ty)

    const open = []
    const closed = new Set()
    const cameFrom = {}
    const gScore = {}
    const fScore = {}

    function h(x, y) {
        return Math.abs(x - tx) + Math.abs(y - ty)
    }

    const startKey = sx + ',' + sy
    gScore[startKey] = 0
    fScore[startKey] = h(sx, sy)
    open.push({ x: sx, y: sy, f: fScore[startKey] })

    const dirs = [
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
        { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ]
    const diagonalCost = 1.414

    let steps = 0
    while (open.length > 0 && steps++ < maxSteps) {
        open.sort((a, b) => a.f - b.f)
        const current = open.shift()
        const ck = current.x + ',' + current.y

        if (current.x === tx && current.y === ty) {
            const path = []
            let k = ck
            while (k) {
                const [px, py] = k.split(',').map(Number)
                path.unshift({ x: px, y: py })
                k = cameFrom[k]
            }
            return path
        }

        closed.add(ck)

        for (const d of dirs) {
            const nx = current.x + d.dx
            const ny = current.y + d.dy
            const nk = nx + ',' + ny

            if (closed.has(nk)) continue
            if (nx === tx && ny === ty && targetBlocked) {
                // Stop one tile before blocked target
            } else if (tileBlocked(nx, ny)) {
                continue
            }

            const isDiag = d.dx !== 0 && d.dy !== 0
            const moveCost = isDiag ? diagonalCost : 1
            const tentG = (gScore[ck] || 0) + moveCost

            if (gScore[nk] == null || tentG < gScore[nk]) {
                cameFrom[nk] = ck
                gScore[nk] = tentG
                fScore[nk] = tentG + h(nx, ny)
                if (!open.find(n => n.x === nx && n.y === ny)) {
                    open.push({ x: nx, y: ny, f: fScore[nk] })
                }
            }
        }
    }

    // No path found - return partial path (closest to target)
    let bestKey = startKey
    let bestDist = h(sx, sy)
    for (const key of Object.keys(gScore)) {
        const [px, py] = key.split(',').map(Number)
        const d = h(px, py)
        if (d < bestDist) { bestDist = d; bestKey = key }
    }
    if (bestKey === startKey) return null

    const path = []
    let k = bestKey
    while (k) {
        const [px, py] = k.split(',').map(Number)
        path.unshift({ x: px, y: py })
        k = cameFrom[k]
    }
    return path
}

function distTiles(ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

function processUnitMovement(unit, state) {
    if (unit.state !== UNIT_STATE.MOVING && unit.state !== UNIT_STATE.RETURNING) return
    if (!unit.path || unit.pathIndex >= unit.path.length) {
        unit.state = UNIT_STATE.IDLE
        unit.path = null
        return
    }

    const stats = UNIT_STATS[unit.type]
    unit.moveProgress += stats.speed / 10 // speed is tiles/sec, tick = 1/10 sec

    while (unit.moveProgress >= 1 && unit.pathIndex < unit.path.length) {
        const next = unit.path[unit.pathIndex]
        // Check if next tile is still walkable (another building may have been placed)
        const blocked = !isWalkable(state.tiles, next.x, next.y)
        if (blocked) {
            // Try to repath
            unit.path = null
            unit.state = UNIT_STATE.IDLE
            return
        }
        unit.x = next.x
        unit.y = next.y
        unit.pathIndex++
        unit.moveProgress -= 1
    }

    if (unit.pathIndex >= unit.path.length) {
        unit.path = null
        if (unit.state === UNIT_STATE.MOVING) {
            unit.state = UNIT_STATE.IDLE
        }
    }
}

function processUnitCombat(unit, state) {
    if (unit.attackCooldown > 0) unit.attackCooldown--

    // If unit has an attack target
    if (unit.targetId != null && unit.state !== UNIT_STATE.GATHERING && unit.state !== UNIT_STATE.BUILDING && unit.state !== UNIT_STATE.RETURNING) {
        const stats = UNIT_STATS[unit.type]
        // Find target (unit or building)
        let target = state.units.find(u => u.id === unit.targetId && u.hp > 0)
        let targetIsBuilding = false
        if (!target) {
            target = state.buildings.find(b => b.id === unit.targetId && b.hp > 0)
            targetIsBuilding = true
        }
        if (!target) {
            unit.targetId = null
            unit.state = UNIT_STATE.IDLE
            return
        }

        const tx = targetIsBuilding ? target.x + Math.floor(target.sizeX / 2) : target.x
        const ty = targetIsBuilding ? target.y + Math.floor(target.sizeY / 2) : target.y
        const dist = distTiles(unit.x, unit.y, tx, ty)

        if (dist <= stats.range) {
            unit.state = UNIT_STATE.ATTACKING
            unit.path = null
            if (unit.attackCooldown <= 0) {
                target.hp -= stats.damage
                unit.attackCooldown = ATTACK_COOLDOWN_TICKS
                if (target.hp <= 0) {
                    unit.targetId = null
                    unit.state = UNIT_STATE.IDLE
                }
            }
        } else if (unit.state !== UNIT_STATE.MOVING) {
            // Move toward target
            unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, tx, ty)
            if (unit.path) {
                unit.pathIndex = 1
                unit.moveProgress = 0
                unit.state = UNIT_STATE.MOVING
            }
        }
    }
}

function processGathering(unit, state) {
    if (unit.type !== UNIT_TYPE.PEASANT) return
    if (unit.state !== UNIT_STATE.GATHERING && unit.state !== UNIT_STATE.RETURNING) return

    if (unit.state === UNIT_STATE.GATHERING) {
        const key = unit.targetX + ',' + unit.targetY
        const res = state.resources[key]
        if (!res || res.amount <= 0) {
            unit.state = UNIT_STATE.IDLE
            return
        }
        if (distTiles(unit.x, unit.y, unit.targetX, unit.targetY) > 1) {
            // Need to walk there
            if (!unit.path) {
                unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, unit.targetX, unit.targetY)
                if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }
            }
            processUnitMovement(unit, state)
            if (unit.state === UNIT_STATE.IDLE) unit.state = UNIT_STATE.GATHERING
            return
        }

        // At the resource tile - gather
        unit.gatherTicks++
        if (unit.gatherTicks >= GATHER_TICKS) {
            const taken = Math.min(GATHER_RATE, res.amount, CARRY_CAPACITY - unit.carryAmount)
            res.amount -= taken
            unit.carryAmount += taken
            unit.carryResource = res.type
            unit.gatherTicks = 0

            if (unit.carryAmount >= CARRY_CAPACITY || res.amount <= 0) {
                // Return to nearest town hall
                const townHall = findNearestTownHall(state, unit)
                if (townHall) {
                    const tx = townHall.x + Math.floor(townHall.sizeX / 2)
                    const ty = townHall.y + Math.floor(townHall.sizeY / 2)
                    unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, tx, ty)
                    if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }
                    unit.state = UNIT_STATE.RETURNING
                } else {
                    unit.state = UNIT_STATE.IDLE
                }
            }
        }
    } else if (unit.state === UNIT_STATE.RETURNING) {
        if (!unit.path || unit.pathIndex >= unit.path.length) {
            // Check if near town hall to drop off
            const townHall = findNearestTownHall(state, unit)
            if (townHall) {
                const dist = distTiles(unit.x, unit.y, townHall.x + 1, townHall.y + 1)
                if (dist <= 2) {
                    // Drop off
                    const player = state.players.find(p => p.id === unit.playerId)
                    if (player) {
                        if (unit.carryResource === 'GOLD') player.gold += unit.carryAmount
                        else if (unit.carryResource === 'WOOD') player.wood += unit.carryAmount
                    }
                    unit.carryAmount = 0
                    unit.carryResource = null
                    // Go back to gather
                    if (unit.targetX != null && state.resources[unit.targetX + ',' + unit.targetY] && state.resources[unit.targetX + ',' + unit.targetY].amount > 0) {
                        unit.state = UNIT_STATE.GATHERING
                        unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, unit.targetX, unit.targetY)
                        if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }
                    } else {
                        unit.state = UNIT_STATE.IDLE
                    }
                } else {
                    unit.path = findPath(state.tiles, state.buildings, unit.x, unit.y, townHall.x + 1, townHall.y + 1)
                    if (unit.path) { unit.pathIndex = 1; unit.moveProgress = 0 }
                }
            } else {
                unit.state = UNIT_STATE.IDLE
            }
        }
    }
}

function findNearestTownHall(state, unit) {
    let best = null
    let bestDist = Infinity
    for (const b of state.buildings) {
        if (b.type === 'TOWN_HALL' && b.playerId === unit.playerId && b.hp > 0) {
            const d = distTiles(unit.x, unit.y, b.x + 1, b.y + 1)
            if (d < bestDist) { bestDist = d; best = b }
        }
    }
    return best
}

module.exports = { createUnit, findPath, processUnitMovement, processUnitCombat, processGathering, distTiles, resetUnitIds }
