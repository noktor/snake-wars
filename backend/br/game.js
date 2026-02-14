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
    RIFLE_COOLDOWN_MS,
    RIFLE_AMMO_MAX,
    SHOTGUN_DAMAGE_PER_PELLET,
    SHOTGUN_PELLETS,
    SHOTGUN_SPREAD_RAD,
    SHOTGUN_SPEED,
    SHOTGUN_COOLDOWN_MS,
    SHOTGUN_AMMO_MAX,
    MACHINEGUN_DAMAGE,
    MACHINEGUN_SPEED,
    MACHINEGUN_COOLDOWN_MS,
    MACHINEGUN_AMMO_MAX,
    SNIPER_DAMAGE,
    SNIPER_SPEED,
    SNIPER_COOLDOWN_MS,
    SNIPER_AMMO_MAX,
    BAZOOKA_DAMAGE,
    BAZOOKA_SPEED,
    BAZOOKA_COOLDOWN_MS,
    BAZOOKA_AMMO_MAX,
    BAZOOKA_EXPLOSION_RADIUS,
    PROJECTILE_RADIUS,
    PICKUP_RADIUS,
    LOOT_SPAWN_PER_POI,
    DROP_CRATE_INTERVAL_MS,
    AI_COUNT,
    AI_ID_BASE
} = require('./constants')
const { getRandomSpawnPoint, isPointInObstacle, OBSTACLES, POIS } = require('./mapData')
const { updateAI } = require('./ai')

let nextLootId = 1
function spawnLootAt(state, x, y, type, ammo) {
    if (isPointInObstacle(x, y)) return
    const item = { id: nextLootId++, type, x, y }
    if (ammo != null && ammo > 0) item.ammo = ammo
    state.loot.push(item)
}

const WEAPON_LOOT_TYPES = ['weapon_rifle', 'weapon_shotgun', 'weapon_machine_gun', 'weapon_sniper', 'weapon_bazooka']

function spawnInitialLoot(state) {
    state.loot = []
    const types = ['weapon_rifle', 'weapon_shotgun', 'weapon_machine_gun', 'weapon_sniper', 'weapon_bazooka', 'health_pack']
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
    const type = WEAPON_LOOT_TYPES[Math.floor(Math.random() * WEAPON_LOOT_TYPES.length)]
    spawnLootAt(state, nx, ny, type)
}

function getAmmoMax(weaponType) {
    switch (weaponType) {
        case 'rifle': return RIFLE_AMMO_MAX
        case 'shotgun': return SHOTGUN_AMMO_MAX
        case 'machine_gun': return MACHINEGUN_AMMO_MAX
        case 'sniper': return SNIPER_AMMO_MAX
        case 'bazooka': return BAZOOKA_AMMO_MAX
        default: return 0
    }
}

function lootTypeToWeapon(type) {
    if (type === 'weapon_rifle') return 'rifle'
    if (type === 'weapon_shotgun') return 'shotgun'
    if (type === 'weapon_machine_gun') return 'machine_gun'
    if (type === 'weapon_sniper') return 'sniper'
    if (type === 'weapon_bazooka') return 'bazooka'
    return null
}

function weaponTypeToLoot(weaponType) {
    if (weaponType === 'rifle') return 'weapon_rifle'
    if (weaponType === 'shotgun') return 'weapon_shotgun'
    if (weaponType === 'machine_gun') return 'weapon_machine_gun'
    if (weaponType === 'sniper') return 'weapon_sniper'
    if (weaponType === 'bazooka') return 'weapon_bazooka'
    return null
}

function dropWeaponsOnDeath(state, player) {
    if (!player || !player.weapons || player.weaponsDropped) return
    const baseX = player.x
    const baseY = player.y
    const spread = 18
    for (const w of player.weapons) {
        if (!w || (w.ammo || 0) <= 0) continue
        const lootType = weaponTypeToLoot(w.type)
        if (!lootType) continue
        const offsetX = (Math.random() - 0.5) * 2 * spread
        const offsetY = (Math.random() - 0.5) * 2 * spread
        const nx = Math.max(10, Math.min(MAP_WIDTH - 10, baseX + offsetX))
        const ny = Math.max(10, Math.min(MAP_HEIGHT - 10, baseY + offsetY))
        spawnLootAt(state, nx, ny, lootType, w.ammo)
    }
    player.weaponsDropped = true
}

function processPickup(state) {
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        if (!player.weapons) player.weapons = []
        for (let i = state.loot.length - 1; i >= 0; i--) {
            const item = state.loot[i]
            const dist = Math.hypot(player.x - item.x, player.y - item.y)
            if (dist > PICKUP_RADIUS) continue
            if (item.type === 'health_pack') {
                player.health = Math.min(MAX_HEALTH, player.health + 50)
                state.loot.splice(i, 1)
                continue
            }
            const weaponType = lootTypeToWeapon(item.type)
            if (!weaponType) continue
            const maxAmmo = getAmmoMax(weaponType)
            const addAmmo = item.ammo != null && item.ammo > 0 ? Math.min(item.ammo, maxAmmo * 2) : maxAmmo
            const existing = (player.weapons || []).findIndex(w => w && w.type === weaponType)
            if (existing >= 0) {
                const w = player.weapons[existing]
                w.ammo = Math.min((w.ammo || 0) + addAmmo, maxAmmo * 2)
            } else if ((player.weapons || []).length < MAX_WEAPON_SLOTS) {
                player.weapons.push({ type: weaponType, ammo: addAmmo })
            } else {
                const idx = Math.max(0, Math.min(MAX_WEAPON_SLOTS - 1, player.weaponIndex || 0))
                player.weapons[idx] = { type: weaponType, ammo: addAmmo }
            }
            state.loot.splice(i, 1)
        }
    }
}

const MAX_WEAPON_SLOTS = 3

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
        weapons: [],
        weaponIndex: 0,
        weaponsDropped: false,
        lastAttackAt: 0,
        lastMeleeAt: 0,
        attackRequested: false,
        isAI: !!opts.isAI,
        aiLevel: opts.aiLevel || 0
    }
}

function getCurrentWeapon(player) {
    if (!player.weapons || player.weaponIndex < 0 || player.weaponIndex >= player.weapons.length) return null
    return player.weapons[player.weaponIndex]
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
        explosions: [],
        loot: [],
        lastDropAt: Date.now()
    }
    spawnInitialLoot(state)
    addAIPlayers(state)
    return state
}

const { getCatalanName } = require('../catalanNames')

function addAIPlayers(state) {
    const { AI_COUNT, AI_ID_BASE } = require('./constants')
    for (let i = 0; i < AI_COUNT; i++) {
        const used = state.players.map(p => ({ x: p.x, y: p.y }))
        const spawn = getRandomSpawnPoint(used)
        const level = i < 5 ? 1 : (i < 10 ? 2 : 3)
        const ai = createPlayer(AI_ID_BASE + i, getCatalanName(i), spawn, { isAI: true, aiLevel: level })
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
        const slot = getCurrentWeapon(player)
        const useMelee = !slot || (slot.ammo || 0) <= 0
        if (useMelee) {
            if (now - player.lastAttackAt < MELEE_COOLDOWN_MS) continue
            player.lastAttackAt = now
            player.lastMeleeAt = now
            processMelee(state, player)
            continue
        }
        const weapon = slot.type
        const ammo = slot.ammo || 0
        if (ammo <= 0) continue

        if (weapon === 'rifle') {
            if (now - player.lastAttackAt < RIFLE_COOLDOWN_MS) continue
            player.lastAttackAt = now
            slot.ammo = ammo - 1
            const vx = Math.cos(player.angle) * RIFLE_SPEED
            const vy = Math.sin(player.angle) * RIFLE_SPEED
            state.projectiles.push({ x: player.x, y: player.y, vx, vy, ownerId: player.playerId, damage: RIFLE_DAMAGE, type: 'rifle' })
        } else if (weapon === 'shotgun') {
            if (now - player.lastAttackAt < SHOTGUN_COOLDOWN_MS) continue
            player.lastAttackAt = now
            slot.ammo = ammo - 1
            const baseAngle = player.angle
            for (let i = 0; i < SHOTGUN_PELLETS; i++) {
                const spread = (Math.random() - 0.5) * 2 * SHOTGUN_SPREAD_RAD
                const a = baseAngle + spread
                const vx = Math.cos(a) * SHOTGUN_SPEED
                const vy = Math.sin(a) * SHOTGUN_SPEED
                state.projectiles.push({
                    x: player.x,
                    y: player.y,
                    vx,
                    vy,
                    ownerId: player.playerId,
                    damage: SHOTGUN_DAMAGE_PER_PELLET,
                    type: 'shotgun'
                })
            }
        } else if (weapon === 'machine_gun') {
            if (now - player.lastAttackAt < MACHINEGUN_COOLDOWN_MS) continue
            player.lastAttackAt = now
            slot.ammo = ammo - 1
            const vx = Math.cos(player.angle) * MACHINEGUN_SPEED
            const vy = Math.sin(player.angle) * MACHINEGUN_SPEED
            state.projectiles.push({
                x: player.x,
                y: player.y,
                vx,
                vy,
                ownerId: player.playerId,
                damage: MACHINEGUN_DAMAGE,
                type: 'machine_gun'
            })
        } else if (weapon === 'sniper') {
            if (now - player.lastAttackAt < SNIPER_COOLDOWN_MS) continue
            player.lastAttackAt = now
            slot.ammo = ammo - 1
            const vx = Math.cos(player.angle) * SNIPER_SPEED
            const vy = Math.sin(player.angle) * SNIPER_SPEED
            state.projectiles.push({
                x: player.x,
                y: player.y,
                vx,
                vy,
                ownerId: player.playerId,
                damage: SNIPER_DAMAGE,
                type: 'sniper'
            })
        } else if (weapon === 'bazooka') {
            if (now - player.lastAttackAt < BAZOOKA_COOLDOWN_MS) continue
            player.lastAttackAt = now
            slot.ammo = ammo - 1
            const vx = Math.cos(player.angle) * BAZOOKA_SPEED
            const vy = Math.sin(player.angle) * BAZOOKA_SPEED
            state.projectiles.push({
                x: player.x,
                y: player.y,
                vx,
                vy,
                ownerId: player.playerId,
                damage: BAZOOKA_DAMAGE,
                type: 'bazooka'
            })
        }
    }
}

function applyBazookaExplosion(state, x, y) {
    if (!state.explosions) state.explosions = []
    state.explosions.push({ x, y, radius: BAZOOKA_EXPLOSION_RADIUS, at: Date.now() })
    const alive = state.players.filter(p => !p.dead)
    for (const p of alive) {
        const dist = Math.hypot(p.x - x, p.y - y)
        if (dist < BAZOOKA_EXPLOSION_RADIUS) {
            p.health -= BAZOOKA_DAMAGE
            if (p.health <= 0) {
                p.health = 0
                p.dead = true
            }
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
        const outOfBounds = proj.x < -50 || proj.x > MAP_WIDTH + 50 || proj.y < -50 || proj.y > MAP_HEIGHT + 50
        if (outOfBounds) {
            if (proj.type === 'bazooka') applyBazookaExplosion(state, proj.x, proj.y)
            toRemove.push(i)
            continue
        }
        let hit = false
        for (const p of alive) {
            if (p.playerId === proj.ownerId) continue
            const dist = Math.hypot(p.x - proj.x, p.y - proj.y)
            if (dist < 14 + PROJECTILE_RADIUS) {
                if (proj.type === 'bazooka') {
                    applyBazookaExplosion(state, proj.x, proj.y)
                } else {
                    p.health -= proj.damage
                    if (p.health <= 0) {
                        p.health = 0
                        p.dead = true
                    }
                }
                hit = true
                toRemove.push(i)
                break
            }
        }
    }
    if (state.explosions) {
        const now = Date.now()
        state.explosions = state.explosions.filter(e => now - e.at < 600)
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

    for (const p of state.players) {
        if (p.dead && !p.weaponsDropped) {
            dropWeaponsOnDeath(state, p)
        }
    }

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

function setWeaponIndex(state, playerId, index) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player || player.dead) return
    const i = Math.max(0, Math.min(MAX_WEAPON_SLOTS - 1, Math.floor(index)))
    player.weaponIndex = i
}

module.exports = {
    initGame,
    gameLoop,
    addPlayerToGame,
    movePlayer,
    createPlayer,
    setWeaponIndex
}
