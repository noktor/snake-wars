const { MAP_WIDTH, MAP_HEIGHT, PLAYER_SPEED, PICKUP_RADIUS, MELEE_RANGE, MELEE_ANGLE_RAD } = require('./constants')
const { isPointInObstacle } = require('./mapData')

const dt = 1 / 20
const moveDist = PLAYER_SPEED * dt

function clampToBounds(x, y) {
    return {
        x: Math.max(0, Math.min(MAP_WIDTH, x)),
        y: Math.max(0, Math.min(MAP_HEIGHT, y))
    }
}

function canMoveTo(x, y) {
    if (x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) return false
    return !isPointInObstacle(x, y)
}

function setAIMoveAndAttack(state, player) {
    const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
    const level = player.aiLevel || 1

    if (level === 1) {
        if (Math.random() < 0.03) {
            const angle = Math.random() * Math.PI * 2
            player.moveDir = { x: Math.cos(angle), y: Math.sin(angle) }
        }
        let nx = player.x + (player.moveDir.x || 0) * moveDist
        let ny = player.y + (player.moveDir.y || 0) * moveDist
        if (!canMoveTo(nx, ny)) {
            const angle = Math.random() * Math.PI * 2
            player.moveDir = { x: Math.cos(angle), y: Math.sin(angle) }
        }
        player.attackRequested = false
        return
    }

    let targetX = null
    let targetY = null
    let wantAttack = false

    if (level >= 2) {
        const cx = state.zoneCenterX
        const cy = state.zoneCenterY
        const r = state.zoneRadius
        const distToZone = Math.hypot(player.x - cx, player.y - cy)
        if (distToZone > r - 80) {
            targetX = cx
            targetY = cy
        }
    }

    if (level >= 2 && (!targetX || Math.random() < 0.5)) {
        let bestDist = Infinity
        for (const item of (state.loot || [])) {
            const d = Math.hypot(item.x - player.x, item.y - player.y)
            if (d < bestDist && d < 400) {
                bestDist = d
                targetX = item.x
                targetY = item.y
            }
        }
    }

    if (level === 3 || (level >= 2 && !targetX)) {
        let bestDist = Infinity
        for (const other of alive) {
            const d = Math.hypot(other.x - player.x, other.y - player.y)
            if (d < bestDist && d < 500) {
                bestDist = d
                targetX = other.x
                targetY = other.y
                if (d < MELEE_RANGE + 20) {
                    player.angle = Math.atan2(other.y - player.y, other.x - player.x)
                    wantAttack = true
                }
            }
        }
    }

    if (targetX != null && targetY != null && !wantAttack) {
        const dx = targetX - player.x
        const dy = targetY - player.y
        const len = Math.hypot(dx, dy) || 1
        player.moveDir = { x: dx / len, y: dy / len }
        player.angle = Math.atan2(dy, dx)
    } else if (level === 1 || (targetX == null && !wantAttack)) {
        if (Math.random() < 0.02) {
            const angle = Math.random() * Math.PI * 2
            player.moveDir = { x: Math.cos(angle), y: Math.sin(angle) }
        }
    }

    if (wantAttack) {
        player.attackRequested = true
    }
}

function updateAI(state) {
    const alive = state.players.filter(p => !p.dead && p.isAI)
    for (const player of alive) {
        setAIMoveAndAttack(state, player)
    }
}

module.exports = { updateAI }
