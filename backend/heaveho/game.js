const {
    GRAVITY,
    MOVE_SPEED,
    JUMP_FORCE,
    PLAYER_RADIUS,
    GRAB_RADIUS,
    MAX_LINK_LENGTH,
    FRAME_RATE,
    WORLD_WIDTH,
    WORLD_HEIGHT
} = require('./constants')
const { CAMPAIGN_1 } = require('./maps')

const dt = 1 / FRAME_RATE

function createPlayer(playerId, nickName, spawn, slotIndex) {
    return {
        playerId,
        nickName: nickName || null,
        slotIndex,
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        move: 0,
        jump: false,
        onGround: false,
        grab: false
    }
}

function getMap(levelIndex) {
    return CAMPAIGN_1[Math.min(levelIndex, CAMPAIGN_1.length - 1)]
}

function initGame(levelIndex) {
    const map = getMap(levelIndex)
    const players = []
    for (let i = 0; i < 4; i++) {
        const spawn = map.spawns[i] || map.spawns[0]
        players.push(createPlayer(null, null, spawn, i))
    }
    const state = {
        levelIndex: levelIndex || 0,
        map: map,
        players,
        links: [],
        object: map.object ? { x: map.object.x, y: map.object.y, vx: 0, vy: 0 } : null,
        started: false
    }
    return state
}

function addPlayerToGame(state, playerId, nickName) {
    const slot = state.players.findIndex(p => p.playerId == null)
    if (slot < 0) return null
    const map = state.map
    const spawn = map.spawns[slot] || map.spawns[0]
    const player = createPlayer(playerId, nickName, spawn, slot)
    player.playerId = playerId
    player.nickName = nickName
    state.players[slot] = player
    return player
}

function getPlayerBounds(x, y) {
    return {
        left: x - PLAYER_RADIUS,
        right: x + PLAYER_RADIUS,
        top: y - PLAYER_RADIUS,
        bottom: y + PLAYER_RADIUS
    }
}

function resolvePlatformCollision(px, py, vx, vy, platforms) {
    let x = px
    let y = py
    let nx = px + vx * dt
    let ny = py + vy * dt
    const bounds = getPlayerBounds(nx, ny)
    let onGround = false

    for (const p of platforms) {
        const pRight = p.x + p.w
        const pBottom = p.y + p.h
        if (bounds.right <= p.x || bounds.left >= pRight || bounds.bottom <= p.y || bounds.top >= pBottom) continue
        const overlapLeft = bounds.right - p.x
        const overlapRight = pRight - bounds.left
        const overlapTop = bounds.bottom - p.y
        const overlapBottom = pBottom - bounds.top
        const minX = Math.min(overlapLeft, overlapRight)
        const minY = Math.min(overlapTop, overlapBottom)
        if (minY < minX) {
            if (vy > 0 && ny > y) {
                ny = p.y - PLAYER_RADIUS
                y = ny
                vy = 0
                onGround = true
            } else if (vy < 0 && ny < y) {
                ny = pBottom + PLAYER_RADIUS
                vy = 0
            }
        } else {
            if (nx > x) nx = p.x - PLAYER_RADIUS
            else if (nx < x) nx = pRight + PLAYER_RADIUS
            vx = 0
        }
    }

    nx = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, nx))
    ny = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, ny))
    return { x: nx, y: ny, vx, vy, onGround }
}

function isInGoal(x, y, goal) {
    const b = getPlayerBounds(x, y)
    return b.left >= goal.x && b.right <= goal.x + goal.w && b.top >= goal.y && b.bottom <= goal.y + goal.h
}

function getPosition(state, id) {
    if (id === 'object') return state.object ? { x: state.object.x, y: state.object.y } : null
    const p = state.players.find(pl => pl.playerId === id)
    return p ? { x: p.x, y: p.y } : null
}

function setPosition(state, id, x, y) {
    if (id === 'object') {
        if (state.object) { state.object.x = x; state.object.y = y }
        return
    }
    const p = state.players.find(pl => pl.playerId === id)
    if (p) { p.x = x; p.y = y }
}

function resolveLinks(state) {
    const platforms = state.map.platforms || []
    for (let iter = 0; iter < 3; iter++) {
        for (const link of state.links) {
            const posA = getPosition(state, link.a)
            const posB = getPosition(state, link.b)
            if (!posA || !posB) continue
            const dx = posB.x - posA.x
            const dy = posB.y - posA.y
            const dist = Math.hypot(dx, dy) || 0.001
            if (dist <= MAX_LINK_LENGTH) continue
            const excess = dist - MAX_LINK_LENGTH
            const nx = (dx / dist) * excess
            const ny = (dy / dist) * excess
            const ax = posA.x + nx * 0.5
            const ay = posA.y + ny * 0.5
            const bx = posB.x - nx * 0.5
            const by = posB.y - ny * 0.5
            setPosition(state, link.a, ax, ay)
            setPosition(state, link.b, bx, by)
        }
        for (const player of state.players.filter(p => p.playerId != null)) {
            const res = resolvePlatformCollision(player.x, player.y, 0, 0, platforms)
            player.x = res.x
            player.y = res.y
        }
        if (state.object) {
            const ob = state.object
            const res = resolvePlatformCollision(ob.x, ob.y, 0, 0, platforms)
            ob.x = res.x
            ob.y = res.y
        }
    }
}

function tryGrab(state, playerId) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player) return
    if (state.links.some(l => l.a === playerId)) return
    let bestDist = GRAB_RADIUS + 1
    let best = null
    for (const other of state.players) {
        if (other.playerId == null || other.playerId === playerId) continue
        const d = Math.hypot(other.x - player.x, other.y - player.y)
        if (d < bestDist) { bestDist = d; best = { type: 'player', id: other.playerId } }
    }
    if (state.object) {
        const d = Math.hypot(state.object.x - player.x, state.object.y - player.y)
        if (d < bestDist) { bestDist = d; best = { type: 'object', id: 'object' } }
    }
    if (best) state.links.push({ a: playerId, b: best.id })
}

function releaseGrab(state, playerId) {
    state.links = state.links.filter(l => l.a !== playerId)
}

function gameLoop(state) {
    if (!state || !state.started || !state.map) return false
    const platforms = state.map.platforms || []
    const goal = state.map.goal
    const filled = state.players.filter(p => p.playerId != null)

    for (const player of filled) {
        player.vy += GRAVITY * dt
        player.vx = player.move * MOVE_SPEED
        if (player.jump && player.onGround) {
            player.vy = -JUMP_FORCE * dt * FRAME_RATE
            player.onGround = false
        }
        const res = resolvePlatformCollision(player.x, player.y, player.vx, player.vy, platforms)
        player.x = res.x
        player.y = res.y
        player.vx = res.vx
        player.vy = res.vy
        player.onGround = res.onGround
    }

    if (state.links.length) resolveLinks(state)

    const allInGoal = filled.length === 4 && filled.every(p => isInGoal(p.x, p.y, goal))
    if (allInGoal) {
        const hasObject = state.map.object && state.map.objectGoal
        if (hasObject && state.object) {
            const og = state.map.objectGoal
            const ox = state.object.x
            const oy = state.object.y
            if (ox >= og.x && ox <= og.x + og.w && oy >= og.y && oy <= og.y + og.h) {
                return state.levelIndex >= CAMPAIGN_1.length - 1 ? 'campaignComplete' : 'levelComplete'
            }
        } else if (!hasObject) {
            return state.levelIndex >= CAMPAIGN_1.length - 1 ? 'campaignComplete' : 'levelComplete'
        }
    }
    return false
}

module.exports = {
    initGame,
    gameLoop,
    addPlayerToGame,
    getMap,
    tryGrab,
    releaseGrab,
    CAMPAIGN_1
}
