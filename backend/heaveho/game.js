const {
    GRAVITY,
    PLAYER_RADIUS,
    HAND_RADIUS,
    HAND_LENGTH,
    GRAB_RADIUS,
    MAX_LINK_LENGTH,
    RELEASE_IMPULSE_MULTIPLIER,
    FRAME_RATE,
    WORLD_WIDTH,
    WORLD_HEIGHT,
    FART_RADIUS,
    FART_PUSH_FORCE
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
        handAngle: 0,
        prevX: spawn.x,
        prevY: spawn.y,
        onGround: false
    }
}

function getHandPosition(player) {
    return {
        x: player.x + HAND_LENGTH * Math.cos(player.handAngle || 0),
        y: player.y + HAND_LENGTH * Math.sin(player.handAngle || 0)
    }
}

function setBodyFromHandPosition(player, hx, hy) {
    const a = player.handAngle != null ? player.handAngle : 0
    player.x = hx - HAND_LENGTH * Math.cos(a)
    player.y = hy - HAND_LENGTH * Math.sin(a)
}

function getMap(levelIndex) {
    return CAMPAIGN_1[Math.min(levelIndex, CAMPAIGN_1.length - 1)]
}

function ensureGoalFloor(map) {
    const goal = map && map.goal
    if (!goal || !map.platforms) return map
    const platforms = map.platforms.slice()
    platforms.push({ x: goal.x, y: goal.y + goal.h - 24, w: goal.w, h: 24 })
    return { ...map, platforms }
}

function initGame(levelIndex) {
    const mapTemplate = getMap(levelIndex)
    const map = ensureGoalFloor(mapTemplate)
    const players = []
    for (let i = 0; i < 4; i++) {
        const spawn = map.spawns[i] || map.spawns[0]
        players.push(createPlayer(null, null, spawn, i))
    }
    const state = {
        levelIndex: levelIndex || 0,
        map,
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

function getHandBounds(x, y) {
    return {
        left: x - HAND_RADIUS,
        right: x + HAND_RADIUS,
        top: y - HAND_RADIUS,
        bottom: y + HAND_RADIUS
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

function resolveStaticOverlap(px, py, platforms) {
    let nx = px
    let ny = py
    for (let iter = 0; iter < 5; iter++) {
        let changed = false
        for (const p of platforms) {
            const pRight = p.x + p.w
            const pBottom = p.y + p.h
            const bounds = getPlayerBounds(nx, ny)
            if (bounds.right <= p.x || bounds.left >= pRight || bounds.bottom <= p.y || bounds.top >= pBottom) continue
            const overlapLeft = bounds.right - p.x
            const overlapRight = pRight - bounds.left
            const overlapTop = bounds.bottom - p.y
            const overlapBottom = pBottom - bounds.top
            const minX = Math.min(overlapLeft, overlapRight)
            const minY = Math.min(overlapTop, overlapBottom)
            if (minY < minX) {
                if (overlapTop < overlapBottom) {
                    ny = p.y - PLAYER_RADIUS
                } else {
                    ny = pBottom + PLAYER_RADIUS
                }
                changed = true
            } else {
                if (overlapLeft < overlapRight) {
                    nx = p.x - PLAYER_RADIUS
                } else {
                    nx = pRight + PLAYER_RADIUS
                }
                changed = true
            }
        }
        if (!changed) break
    }
    nx = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, nx))
    ny = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, ny))
    return { x: nx, y: ny }
}

function resolveHandOutOfPlatforms(hx, hy, platforms) {
    let nx = hx
    let ny = hy
    for (let iter = 0; iter < 5; iter++) {
        let changed = false
        for (const p of platforms) {
            const pRight = p.x + p.w
            const pBottom = p.y + p.h
            const bounds = getHandBounds(nx, ny)
            if (bounds.right <= p.x || bounds.left >= pRight || bounds.bottom <= p.y || bounds.top >= pBottom) continue
            const overlapLeft = bounds.right - p.x
            const overlapRight = pRight - bounds.left
            const overlapTop = bounds.bottom - p.y
            const overlapBottom = pBottom - bounds.top
            const minX = Math.min(overlapLeft, overlapRight)
            const minY = Math.min(overlapTop, overlapBottom)
            if (minY < minX) {
                if (overlapTop < overlapBottom) {
                    ny = p.y - HAND_RADIUS
                } else {
                    ny = pBottom + HAND_RADIUS
                }
                changed = true
            } else {
                if (overlapLeft < overlapRight) {
                    nx = p.x - HAND_RADIUS
                } else {
                    nx = pRight + HAND_RADIUS
                }
                changed = true
            }
        }
        if (!changed) break
    }
    return { x: nx, y: ny }
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

function getLinkPointA(state, link) {
    const p = state.players.find(pl => pl.playerId === link.a)
    return p ? getHandPosition(p) : null
}

function getLinkPointB(state, link) {
    if (link.b === 'platform' && link.anchorX != null && link.anchorY != null) {
        return { x: link.anchorX, y: link.anchorY }
    }
    if (typeof link.b === 'number' && link.bAttachment === 'hand') {
        const p = state.players.find(pl => pl.playerId === link.b)
        return p ? getHandPosition(p) : null
    }
    return getPosition(state, link.b)
}

function getAnchorPosition(state, link) {
    if (link.b === 'platform' && link.anchorX != null && link.anchorY != null) {
        return { x: link.anchorX, y: link.anchorY }
    }
    if (typeof link.b === 'number' && link.bAttachment === 'hand') {
        const p = state.players.find(pl => pl.playerId === link.b)
        return p ? getHandPosition(p) : null
    }
    return getPosition(state, link.b)
}

function setPosition(state, id, x, y) {
    if (id === 'object') {
        if (state.object) { state.object.x = x; state.object.y = y }
        return
    }
    if (id === 'platform') return
    const p = state.players.find(pl => pl.playerId === id)
    if (p) { p.x = x; p.y = y }
}

function setAttachmentPosition(state, link, x, y) {
    if (link.b === 'platform') return
    if (link.b === 'object') {
        setPosition(state, 'object', x, y)
        return
    }
    if (typeof link.b === 'number') {
        if (link.bAttachment === 'hand') {
            setHandPosition(state, link.b, x, y)
        } else {
            setPosition(state, link.b, x, y)
        }
    }
}

function setHandPosition(state, playerId, hx, hy) {
    const p = state.players.find(pl => pl.playerId === playerId)
    if (p) setBodyFromHandPosition(p, hx, hy)
}

function resolveLinks(state) {
    const platforms = state.map.platforms || []
    for (let iter = 0; iter < 3; iter++) {
        for (const link of state.links) {
            const posA = getLinkPointA(state, link)
            const posB = getLinkPointB(state, link)
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
            setHandPosition(state, link.a, ax, ay)
            setAttachmentPosition(state, link, bx, by)
        }
        for (const player of state.players.filter(p => p.playerId != null)) {
            const res = resolveStaticOverlap(player.x, player.y, platforms)
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

function closestPointOnPlatform(hx, hy, platform) {
    const cx = Math.max(platform.x, Math.min(platform.x + platform.w, hx))
    const cy = Math.max(platform.y, Math.min(platform.y + platform.h, hy))
    return { x: cx, y: cy }
}

function tryGrab(state, playerId) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player) return
    if (state.links.some(l => l.a === playerId)) return
    const hand = getHandPosition(player)
    let bestDist = GRAB_RADIUS + 1
    let best = null
    for (const other of state.players) {
        if (other.playerId == null || other.playerId === playerId) continue
        const otherHand = getHandPosition(other)
        const dBody = Math.hypot(other.x - hand.x, other.y - hand.y)
        const dHand = Math.hypot(otherHand.x - hand.x, otherHand.y - hand.y)
        if (dHand < bestDist) { bestDist = dHand; best = { type: 'player', id: other.playerId, attachment: 'hand' } }
        if (dBody < bestDist) { bestDist = dBody; best = { type: 'player', id: other.playerId, attachment: 'body' } }
    }
    if (state.object) {
        const d = Math.hypot(state.object.x - hand.x, state.object.y - hand.y)
        if (d < bestDist) { bestDist = d; best = { type: 'object', id: 'object' } }
    }
    for (const platform of (state.map.platforms || [])) {
        const pt = closestPointOnPlatform(hand.x, hand.y, platform)
        const d = Math.hypot(pt.x - hand.x, pt.y - hand.y)
        if (d < bestDist) { bestDist = d; best = { type: 'platform', anchorX: pt.x, anchorY: pt.y } }
    }
    if (best) {
        if (best.type === 'platform') {
            state.links.push({ a: playerId, b: 'platform', anchorX: best.anchorX, anchorY: best.anchorY })
        } else if (best.type === 'player') {
            state.links.push({ a: playerId, b: best.id, bAttachment: best.attachment || 'body' })
        } else {
            state.links.push({ a: playerId, b: best.id })
        }
    }
}

function releaseGrab(state, playerId) {
    const player = state.players.find(p => p.playerId === playerId)
    if (player) {
        const prevX = player.prevX != null ? player.prevX : player.x
        const prevY = player.prevY != null ? player.prevY : player.y
        player.vx = ((player.x - prevX) / dt) * RELEASE_IMPULSE_MULTIPLIER
        player.vy = ((player.y - prevY) / dt) * RELEASE_IMPULSE_MULTIPLIER
    }
    state.links = state.links.filter(l => l.a !== playerId)
}

function gameLoop(state) {
    if (!state || !state.started || !state.map) return false
    const platforms = state.map.platforms || []
    const goal = state.map.goal
    const filled = state.players.filter(p => p.playerId != null)

    for (const player of filled) {
        player.prevX = player.x
        player.prevY = player.y
    }

    for (const player of filled) {
        const link = state.links.find(l => l.a === player.playerId)
        if (link) {
            const anchor = getAnchorPosition(state, link)
            if (anchor) {
                const a = player.handAngle != null ? player.handAngle : 0
                let bx = anchor.x - HAND_LENGTH * Math.cos(a)
                let by = anchor.y - HAND_LENGTH * Math.sin(a)
                const resolved = resolveStaticOverlap(bx, by, platforms)
                player.x = resolved.x
                player.y = resolved.y
                player.vx = 0
                player.vy = 0
            }
        } else {
            player.vy += GRAVITY * dt
            const res = resolvePlatformCollision(player.x, player.y, player.vx, player.vy, platforms)
            player.x = res.x
            player.y = res.y
            player.vx = res.vx
            player.vy = res.vy
            player.onGround = res.onGround
        }
    }

    if (state.links.length) resolveLinks(state)

    for (const player of filled) {
        if (state.links.some(l => l.a === player.playerId)) {
            const res = resolveStaticOverlap(player.x, player.y, platforms)
            player.x = res.x
            player.y = res.y
        }
    }

    for (const player of filled) {
        if (state.links.some(l => l.a === player.playerId)) continue
        if (!player.onGround) continue
        const hand = getHandPosition(player)
        const handResolved = resolveHandOutOfPlatforms(hand.x, hand.y, platforms)
        if (handResolved.x !== hand.x || handResolved.y !== hand.y) {
            setBodyFromHandPosition(player, handResolved.x, handResolved.y)
            const bodyResolved = resolveStaticOverlap(player.x, player.y, platforms)
            player.x = bodyResolved.x
            player.y = bodyResolved.y
        }
    }

    const outOfBoundsMargin = 80
    const spawns = state.map.spawns || []
    for (const player of filled) {
        const oob = player.y > WORLD_HEIGHT + outOfBoundsMargin ||
            player.y < -outOfBoundsMargin ||
            player.x < -outOfBoundsMargin ||
            player.x > WORLD_WIDTH + outOfBoundsMargin
        if (oob) {
            const spawn = spawns[player.slotIndex] || spawns[0]
            if (spawn) {
                player.x = spawn.x
                player.y = spawn.y
                player.vx = 0
                player.vy = 0
                state.links = state.links.filter(l => l.a !== player.playerId)
            }
        }
    }

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

function applyFartPush(state, farterPlayerId) {
    const farter = state.players.find(p => p.playerId === farterPlayerId)
    if (!farter) return
    const fx = farter.x
    const fy = farter.y
    for (const p of state.players) {
        if (p.playerId == null || p.playerId === farterPlayerId) continue
        const dx = p.x - fx
        const dy = p.y - fy
        const dist = Math.hypot(dx, dy)
        if (dist > FART_RADIUS || dist < 1) continue
        const strength = FART_PUSH_FORCE * (1 - dist / FART_RADIUS * 0.5)
        const nx = dx / dist
        const ny = dy / dist
        p.vx += nx * strength
        p.vy += ny * strength
    }
    if (state.object) {
        const dx = state.object.x - fx
        const dy = state.object.y - fy
        const dist = Math.hypot(dx, dy)
        if (dist <= FART_RADIUS && dist >= 1) {
            const strength = FART_PUSH_FORCE * 0.6 * (1 - dist / FART_RADIUS * 0.5)
            const nx = dx / dist
            const ny = dy / dist
            state.object.vx += nx * strength
            state.object.vy += ny * strength
        }
    }
}

module.exports = {
    initGame,
    gameLoop,
    addPlayerToGame,
    getMap,
    ensureGoalFloor,
    tryGrab,
    releaseGrab,
    applyFartPush,
    CAMPAIGN_1
}
