const {
    MAP_WIDTH,
    MAP_HEIGHT,
    PLAYER_SPEED,
    MAX_HEALTH,
    ZONE_PHASE_DURATION_MS,
    ZONE_DAMAGE_PER_TICK,
    ZONE_INITIAL_RADIUS,
    ZONE_FINAL_RADIUS,
    ZONE_PHASE_COUNT,
    MELEE_RANGE,
    MELEE_ANGLE_RAD,
    MELEE_COOLDOWN_MS,
    MELEE_DAMAGE,
    RIFLE_DAMAGE,
    RIFLE_SPEED,
    PROJECTILE_RADIUS,
    RIFLE_RANGE,
    RIFLE_COOLDOWN_MS,
    PICKUP_RADIUS,
    LOOT_SPAWN_PER_POI,
    DROP_CRATE_INTERVAL_MS,
    AI_COUNT,
    AI_ID_BASE
} = require('./constants')
const { getRandomSpawnPoint, isPointInObstacle, OBSTACLES, POIS } = require('./mapData')
const { updateAI } = require('./ai')

let nextLootId = 1
function spawnLootAt(state, x, y, type) {
    if (isPointInObstacle(x, y)) return
    state.loot.push({ id: nextLootId++, type, x, y })
}

function spawnInitialLoot(state) {
    state.loot = []
    const types = ['weapon_rifle', 'health_pack']
    for (const poi of POIS) {
        for (let n = 0; n < LOOT_SPAWN_PER_POI; n++) {
            const x = poi.x + Math.random() * (poi.w - 20)
            const y = poi.y + Math.random() * (poi.h - 20)
            spawnLootAt(state, x, y, types[Math.floor(Math.random() * types.length)])
        }
    }
}

function spawnCrateDrop(state) {
    const cx = state.zoneCenterX
    const cy = state.zoneCenterY
    const r = state.zoneRadius * 0.6
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * r
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist
    const nx = Math.max(20, Math.min(MAP_WIDTH - 20, x))
    const ny = Math.max(20, Math.min(MAP_HEIGHT - 20, y))
    spawnLootAt(state, nx, ny, 'weapon_rifle')
}

function processPickup(state) {
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        for (let i = state.loot.length - 1; i >= 0; i--) {
            const item = state.loot[i]
            const dist = Math.hypot(player.x - item.x, player.y - item.y)
            if (dist > PICKUP_RADIUS) continue
            if (item.type === 'weapon_rifle') {
                player.weapon = 'rifle'
            } else if (item.type === 'health_pack') {
                player.health = Math.min(MAX_HEALTH, player.health + 50)
            }
            state.loot.splice(i, 1)
        }
    }
}

function createPlayer(playerId, nickName, spawn, opts = {}) {
    return {
        playerId,
        nickName: nickName || null,
        color: opts.color ?? null,
        x: spawn.x,
        y: spawn.y,
        angle: 0,
        vx: 0,
        vy: 0,
        moveDir: { x: 0, y: 0 },
        dead: false,
        health: MAX_HEALTH,
        weapon: 'melee',
        lastAttackAt: 0,
        attackRequested: false,
        isAI: !!opts.isAI,
        aiLevel: opts.aiLevel || 0
    }
}

function initGame(nickName, color) {
    const spawn = getRandomSpawnPoint([])
    const state = {
        players: [createPlayer(1, nickName, spawn, { color: color || null })],
        obstacles: OBSTACLES,
        pois: POIS,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        zonePhase: 0,
        zoneCenterX: MAP_WIDTH / 2,
        zoneCenterY: MAP_HEIGHT / 2,
        zoneRadius: ZONE_INITIAL_RADIUS,
        zoneShrinkAt: Date.now() + ZONE_PHASE_DURATION_MS,
        started: true,
        projectiles: [],
        loot: [],
        lastDropAt: Date.now()
    }
    spawnInitialLoot(state)
    addAIPlayers(state)
    return state
}

function addAIPlayers(state) {
    const { AI_COUNT, AI_ID_BASE } = require('./constants')
    for (let i = 0; i < AI_COUNT; i++) {
        const used = state.players.map(p => ({ x: p.x, y: p.y }))
        const spawn = getRandomSpawnPoint(used)
        const level = i < 5 ? 1 : (i < 10 ? 2 : 3)
        const name = level === 1 ? 'Bot-Easy' : (level === 2 ? 'Bot-Med' : 'Bot-Hard')
        const ai = createPlayer(AI_ID_BASE + i, name + (i % 5 + 1), spawn, { isAI: true, aiLevel: level })
        state.players.push(ai)
    }
}

function addPlayerToGame(state, playerId, nickName, color) {
    const used = state.players.filter(p => !p.dead).map(p => ({ x: p.x, y: p.y }))
    const spawn = getRandomSpawnPoint(used)
    const player = createPlayer(playerId, nickName, spawn, { color: color || null })
    state.players.push(player)
    return player
}

function clampToBounds(x, y) {
    return {
        x: Math.max(0, Math.min(MAP_WIDTH, x)),
        y: Math.max(0, Math.min(MAP_HEIGHT, y))
    }
}

function movePlayer(state, player, dx, dy) {
    if (player.dead) return
    const dt = 1 / 20
    const dist = PLAYER_SPEED * dt
    let nx = player.x + dx * dist
    let ny = player.y + dy * dist
    const bounded = clampToBounds(nx, ny)
    nx = bounded.x
    ny = bounded.y
    if (isPointInObstacle(nx, ny)) return
    player.x = nx
    player.y = ny
}

function updateZone(state) {
    const now = Date.now()
    if (now >= state.zoneShrinkAt && state.zonePhase < ZONE_PHASE_COUNT) {
        state.zonePhase += 1
        state.zoneShrinkAt = now + ZONE_PHASE_DURATION_MS
        const t = state.zonePhase / ZONE_PHASE_COUNT
        state.zoneRadius = ZONE_INITIAL_RADIUS + (ZONE_FINAL_RADIUS - ZONE_INITIAL_RADIUS) * t
        if (state.zonePhase < ZONE_PHASE_COUNT) {
            const r = state.zoneRadius * 0.7
            state.zoneCenterX = state.zoneCenterX + (Math.random() - 0.5) * 2 * r
            state.zoneCenterY = state.zoneCenterY + (Math.random() - 0.5) * 2 * r
            state.zoneCenterX = Math.max(r, Math.min(MAP_WIDTH - r, state.zoneCenterX))
            state.zoneCenterY = Math.max(r, Math.min(MAP_HEIGHT - r, state.zoneCenterY))
        }
    }
}

function applyZoneDamage(state) {
    const alive = state.players.filter(p => !p.dead)
    const cx = state.zoneCenterX
    const cy = state.zoneCenterY
    const r = state.zoneRadius
    for (const player of alive) {
        const dist = Math.hypot(player.x - cx, player.y - cy)
        if (dist > r) {
            player.health -= ZONE_DAMAGE_PER_TICK
            if (player.health <= 0) {
                player.health = 0
                player.dead = true
            }
        }
    }
}

function angleBetween(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax)
}

function meleeHit(attacker, target) {
    const dist = Math.hypot(target.x - attacker.x, target.y - attacker.y)
    if (dist > MELEE_RANGE) return false
    const toTarget = angleBetween(attacker.x, attacker.y, target.x, target.y)
    let diff = Math.abs(toTarget - attacker.angle)
    while (diff > Math.PI) diff -= Math.PI * 2
    if (diff < 0) diff = -diff
    return diff <= MELEE_ANGLE_RAD / 2
}

function processMelee(state, attacker) {
    const alive = state.players.filter(p => !p.dead && p.playerId !== attacker.playerId)
    for (const target of alive) {
        if (meleeHit(attacker, target)) {
            target.health -= MELEE_DAMAGE
            if (target.health <= 0) {
                target.health = 0
                target.dead = true
            }
        }
    }
}

function processAttack(state) {
    const now = Date.now()
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        if (!player.attackRequested) continue
        player.attackRequested = false
        if (player.weapon === 'melee') {
            if (now - player.lastAttackAt < MELEE_COOLDOWN_MS) continue
            player.lastAttackAt = now
            processMelee(state, player)
        } else if (player.weapon === 'rifle') {
            if (now - player.lastAttackAt < RIFLE_COOLDOWN_MS) continue
            player.lastAttackAt = now
            const vx = Math.cos(player.angle) * RIFLE_SPEED
            const vy = Math.sin(player.angle) * RIFLE_SPEED
            state.projectiles.push({
                x: player.x,
                y: player.y,
                vx,
                vy,
                ownerId: player.playerId,
                damage: RIFLE_DAMAGE
            })
        }
    }
}

function processProjectiles(state) {
    const dt = 1 / 20
    const alive = state.players.filter(p => !p.dead)
    const toRemove = []
    for (let i = 0; i < state.projectiles.length; i++) {
        const proj = state.projectiles[i]
        proj.x += proj.vx * dt
        proj.y += proj.vy * dt
        if (proj.x < -50 || proj.x > MAP_WIDTH + 50 || proj.y < -50 || proj.y > MAP_HEIGHT + 50) {
            toRemove.push(i)
            continue
        }
        for (const p of alive) {
            if (p.playerId === proj.ownerId) continue
            const dist = Math.hypot(p.x - proj.x, p.y - proj.y)
            if (dist < 14 + PROJECTILE_RADIUS) {
                p.health -= proj.damage
                if (p.health <= 0) {
                    p.health = 0
                    p.dead = true
                }
                toRemove.push(i)
                break
            }
        }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
        state.projectiles.splice(toRemove[i], 1)
    }
}

function gameLoop(state) {
    if (!state || !state.started) return null
    const alive = state.players.filter(p => !p.dead)

    updateAI(state)
    updateZone(state)
    applyZoneDamage(state)
    const now = Date.now()
    if (now - state.lastDropAt >= DROP_CRATE_INTERVAL_MS) {
        spawnCrateDrop(state)
        state.lastDropAt = now
    }
    processPickup(state)
    processAttack(state)
    processProjectiles(state)

    for (const player of alive) {
        const dx = (player.moveDir && player.moveDir.x) || 0
        const dy = (player.moveDir && player.moveDir.y) || 0
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy) || 1
            movePlayer(state, player, dx / len, dy / len)
        }
    }

    const stillAlive = state.players.filter(p => !p.dead)
    if (stillAlive.length <= 1) {
        return stillAlive[0] || null
    }
    return false
}

module.exports = {
    initGame,
    gameLoop,
    addPlayerToGame,
    movePlayer,
    createPlayer
}
