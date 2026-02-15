const {
    MAP_WIDTH,
    MAP_HEIGHT,
    PLAYER_SPEED,
    MAX_HEALTH,
    ZONE_DELAY_MS,
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
    RIFLE_ALT_COOLDOWN_MS,
    RIFLE_ALT_DAMAGE,
    RIFLE_ALT_SPREAD_RAD,
    RIFLE_ALT_BURST_COUNT,
    SNIPER_ALT_DAMAGE,
    SNIPER_ALT_COOLDOWN_MS,
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
    SHOP_RADIUS,
    SHOP_INVENTORY,
    LOOT_SPAWN_PER_POI,
    DROP_CRATE_INTERVAL_MS,
    AI_COUNT,
    AI_ID_BASE,
    GRENADE_BLIND_RADIUS,
    GRENADE_BLIND_DURATION_MS,
    GRENADE_BLIND_FUSE_MS,
    GRENADE_BLIND_SPEED,
    GRENADE_BLIND_MAX_COUNT,
    TRAP_DURATION_MS,
    TRAP_RADIUS,
    TRAP_MAX_COUNT,
    DRONE_SPEED,
    DRONE_DURATION_MS,
    DRONE_REVEAL_RADIUS,
    SUPPLY_PLANE_INTERVAL_MS,
    SUPPLY_PLANE_DURATION_MS
} = require('./constants')
const { getRandomSpawnPoint, isPointInObstacle, isPointInsideBuildingInterior, OBSTACLES, POIS, AREAS, BUILDINGS, BUILDING_WALLS, WALL_THICKNESS, SHOP_POSITIONS, ROADS, ROAD_WALL_SEGMENTS, TREES, LOOT_SPAWN_POINTS, SECRET_ROOM_LOOT_POINTS } = require('./mapData')
const { updateAI } = require('./ai')

let nextLootId = 1
function spawnLootAt(state, x, y, type, ammoOrValue) {
    if (isPointInObstacle(x, y)) return
    const item = { id: nextLootId++, type, x, y }
    if (type === 'gold') {
        item.goldValue = ammoOrValue != null && ammoOrValue > 0 ? ammoOrValue : 25
    } else if (ammoOrValue != null && ammoOrValue > 0) {
        item.ammo = ammoOrValue
    }
    state.loot.push(item)
}

const WEAPON_LOOT_TYPES = ['weapon_rifle', 'weapon_shotgun', 'weapon_machine_gun', 'weapon_sniper', 'weapon_bazooka']
const NON_GOLD_LOOT_TYPES = ['weapon_rifle', 'weapon_shotgun', 'weapon_machine_gun', 'weapon_sniper', 'weapon_bazooka', 'health_pack', 'grenade_blind', 'trap_net', 'item_drone']

function spawnInitialLoot(state) {
    state.loot = []
    for (const point of LOOT_SPAWN_POINTS) {
        const r = Math.random()
        if (r < 0.15) {
            const value = 10 + Math.floor(Math.random() * 21)
            spawnLootAt(state, point.x, point.y, 'gold', value)
        } else {
            const type = NON_GOLD_LOOT_TYPES[Math.floor(Math.random() * NON_GOLD_LOOT_TYPES.length)]
            spawnLootAt(state, point.x, point.y, type)
        }
    }
}

function spawnCrateDrop(state) {
    const cx = state.zoneCenterX
    const cy = state.zoneCenterY
    const r = state.zoneRadius * 0.6
    let nx, ny
    for (let attempt = 0; attempt < 30; attempt++) {
        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * r
        const x = cx + Math.cos(angle) * dist
        const y = cy + Math.sin(angle) * dist
        nx = Math.max(20, Math.min(MAP_WIDTH - 20, x))
        ny = Math.max(20, Math.min(MAP_HEIGHT - 20, y))
        if (!isPointInsideBuildingInterior(nx, ny)) break
    }
    const useGold = Math.random() < 0.2
    if (useGold) {
        const value = 25 + Math.floor(Math.random() * 26)
        spawnLootAt(state, nx, ny, 'gold', value)
    } else {
        const type = WEAPON_LOOT_TYPES[Math.floor(Math.random() * WEAPON_LOOT_TYPES.length)]
        spawnLootAt(state, nx, ny, type)
    }
    state.dropPings = state.dropPings || []
    state.dropPings.push({ x: nx, y: ny, at: Date.now() })
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
    if (!player || player.weaponsDropped) return
    const baseX = player.x
    const baseY = player.y
    const spread = 18
    if ((player.gold || 0) > 0) {
        spawnLootAt(state, baseX, baseY, 'gold', player.gold)
        player.gold = 0
    }
    if (!player.weapons) { player.weaponsDropped = true; return }
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
            if (item.type === 'gold') {
                player.gold = (player.gold || 0) + (item.goldValue ?? 25)
                state.loot.splice(i, 1)
                continue
            }
            if (item.type === 'grenade_blind') {
                player.grenadeBlindCount = Math.min(GRENADE_BLIND_MAX_COUNT, (player.grenadeBlindCount || 0) + 1)
                state.loot.splice(i, 1)
                continue
            }
            if (item.type === 'trap_net') {
                player.trapCount = Math.min(TRAP_MAX_COUNT, (player.trapCount || 0) + 1)
                state.loot.splice(i, 1)
                continue
            }
            if (item.type === 'item_drone') {
                player.droneCount = (player.droneCount || 0) + 1
                state.loot.splice(i, 1)
                continue
            }
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
                player.weapons.push({ type: weaponType, ammo: addAmmo, mode: 'normal' })
            } else {
                const idx = Math.max(0, Math.min(MAX_WEAPON_SLOTS - 1, player.weaponIndex || 0))
                player.weapons[idx] = { type: weaponType, ammo: addAmmo, mode: 'normal' }
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
        gold: 0,
        weapons: [],
        weaponIndex: 0,
        weaponsDropped: false,
        lastAttackAt: 0,
        lastMeleeAt: 0,
        attackRequested: false,
        isAI: !!opts.isAI,
        aiLevel: opts.aiLevel || 0,
        grenadeBlindCount: 0,
        blindedUntil: 0,
        trapCount: 0,
        trappedUntil: 0,
        droneCount: 0,
        kills: 0
    }
}

function getCurrentWeapon(player) {
    if (!player.weapons || player.weaponIndex < 0 || player.weaponIndex >= player.weapons.length) return null
    return player.weapons[player.weaponIndex]
}

function initGame(nickName, color) {
    const spawn = getRandomSpawnPoint([])
    const now = Date.now()
    const state = {
        players: [createPlayer(1, nickName, spawn, { color: color || null })],
        obstacles: OBSTACLES,
        pois: POIS,
        areas: AREAS,
        buildings: BUILDINGS,
        buildingWalls: BUILDING_WALLS,
        wallThickness: WALL_THICKNESS,
        roads: ROADS,
        roadWalls: ROAD_WALL_SEGMENTS,
        trees: TREES,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        gameStartAt: now,
        zonePhase: 0,
        zoneCenterX: MAP_WIDTH / 2,
        zoneCenterY: MAP_HEIGHT / 2,
        zoneRadius: ZONE_INITIAL_RADIUS,
        zoneShrinkAt: now + ZONE_DELAY_MS,
        started: true,
        projectiles: [],
        explosions: [],
        loot: [],
        lastDropAt: now,
        shops: SHOP_POSITIONS,
        shopInventory: SHOP_INVENTORY,
        grenades: [],
        traps: [],
        drones: [],
        droneReveals: {},
        secretRoomLootSpawned: false,
        secretRoomPositions: SECRET_ROOM_LOOT_POINTS ? [...SECRET_ROOM_LOOT_POINTS] : [],
        lastSupplyPlaneAt: now
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
                player.killedBy = null
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
                target.killedBy = attacker.playerId
                attacker.kills = (attacker.kills || 0) + 1
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
            const useAlt = slot.mode === 'alt' && ammo >= RIFLE_ALT_BURST_COUNT
            const cooldown = useAlt ? RIFLE_ALT_COOLDOWN_MS : RIFLE_COOLDOWN_MS
            if (now - player.lastAttackAt < cooldown) continue
            player.lastAttackAt = now
            if (useAlt) {
                slot.ammo = ammo - RIFLE_ALT_BURST_COUNT
                const baseAngle = player.angle
                for (let b = 0; b < RIFLE_ALT_BURST_COUNT; b++) {
                    const spread = (Math.random() - 0.5) * 2 * RIFLE_ALT_SPREAD_RAD
                    const a = baseAngle + spread
                    const vx = Math.cos(a) * RIFLE_SPEED
                    const vy = Math.sin(a) * RIFLE_SPEED
                    state.projectiles.push({ x: player.x, y: player.y, vx, vy, ownerId: player.playerId, damage: RIFLE_ALT_DAMAGE, type: 'rifle' })
                }
            } else {
                slot.ammo = ammo - 1
                const vx = Math.cos(player.angle) * RIFLE_SPEED
                const vy = Math.sin(player.angle) * RIFLE_SPEED
                state.projectiles.push({ x: player.x, y: player.y, vx, vy, ownerId: player.playerId, damage: RIFLE_DAMAGE, type: 'rifle' })
            }
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
            const useAlt = slot.mode === 'alt'
            const cooldown = useAlt ? SNIPER_ALT_COOLDOWN_MS : SNIPER_COOLDOWN_MS
            const damage = useAlt ? SNIPER_ALT_DAMAGE : SNIPER_DAMAGE
            if (now - player.lastAttackAt < cooldown) continue
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
                damage,
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

function applyBazookaExplosion(state, x, y, ownerId) {
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
                p.killedBy = ownerId != null ? ownerId : null
                if (ownerId != null) {
                    const killer = state.players.find(pl => pl.playerId === ownerId)
                    if (killer) killer.kills = (killer.kills || 0) + 1
                }
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
            if (proj.type === 'bazooka') applyBazookaExplosion(state, proj.x, proj.y, proj.ownerId)
            toRemove.push(i)
            continue
        }
        let hit = false
        for (const p of alive) {
            if (p.playerId === proj.ownerId) continue
            const dist = Math.hypot(p.x - proj.x, p.y - proj.y)
            if (dist < 14 + PROJECTILE_RADIUS) {
                if (proj.type === 'bazooka') {
                    applyBazookaExplosion(state, proj.x, proj.y, proj.ownerId)
                } else {
                    p.health -= proj.damage
                    if (p.health <= 0) {
                        p.health = 0
                        p.dead = true
                        p.killedBy = proj.ownerId
                        const killer = state.players.find(pl => pl.playerId === proj.ownerId)
                        if (killer) killer.kills = (killer.kills || 0) + 1
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

const TICK_MS = 1000 / require('./constants').FRAME_RATE

const DRONE_REVEAL_MAX_AGE_MS = 2500

function processDrones(state) {
    if (!state.drones || !state.drones.length) return
    const now = Date.now()
    const alive = state.players.filter(p => !p.dead)
    state.droneReveals = state.droneReveals || {}
    const toRemove = []
    for (let i = 0; i < state.drones.length; i++) {
        const d = state.drones[i]
        const elapsed = now - d.spawnAt
        if (elapsed >= DRONE_DURATION_MS) {
            toRemove.push(i)
            continue
        }
        const dt = 1 / 20
        d.x += d.vx * dt
        d.y += d.vy * dt
        if (!state.droneReveals[d.ownerId]) state.droneReveals[d.ownerId] = []
        const list = state.droneReveals[d.ownerId]
        for (const p of alive) {
            if (p.playerId === d.ownerId) continue
            if (Math.hypot(p.x - d.x, p.y - d.y) <= DRONE_REVEAL_RADIUS) {
                list.push({ x: p.x, y: p.y, at: now })
            }
        }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
        state.drones.splice(toRemove[i], 1)
    }
    for (const pid of Object.keys(state.droneReveals)) {
        state.droneReveals[pid] = state.droneReveals[pid].filter(r => now - r.at < DRONE_REVEAL_MAX_AGE_MS)
    }
}

function useDrone(state, playerId) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player || player.dead) return false
    const count = player.droneCount || 0
    if (count <= 0) return false
    state.drones = state.drones || []
    const vx = Math.cos(player.angle) * DRONE_SPEED
    const vy = Math.sin(player.angle) * DRONE_SPEED
    const now = Date.now()
    state.drones.push({
        x: player.x,
        y: player.y,
        vx,
        vy,
        ownerId: playerId,
        spawnAt: now,
        durationMs: DRONE_DURATION_MS
    })
    player.droneCount = count - 1
    return true
}

function processGrenades(state) {
    if (!state.grenades || !state.grenades.length) return
    const now = Date.now()
    const toRemove = []
    for (let i = 0; i < state.grenades.length; i++) {
        const g = state.grenades[i]
        const elapsed = now - g.spawnAt
        if (elapsed >= GRENADE_BLIND_FUSE_MS) {
            const travel = GRENADE_BLIND_SPEED * (GRENADE_BLIND_FUSE_MS / 1000)
            const ex = g.startX + g.vx * travel
            const ey = g.startY + g.vy * travel
            for (const p of state.players) {
                if (p.dead) continue
                if (Math.hypot(p.x - ex, p.y - ey) <= GRENADE_BLIND_RADIUS) {
                    p.blindedUntil = now + GRENADE_BLIND_DURATION_MS
                }
            }
            toRemove.push(i)
        } else {
            g.x = g.startX + g.vx * GRENADE_BLIND_SPEED * (elapsed / 1000)
            g.y = g.startY + g.vy * GRENADE_BLIND_SPEED * (elapsed / 1000)
        }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
        state.grenades.splice(toRemove[i], 1)
    }
}

function processTraps(state) {
    if (!state.traps || !state.traps.length) return
    const now = Date.now()
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        if ((player.trappedUntil || 0) > now) continue
        for (let i = state.traps.length - 1; i >= 0; i--) {
            const trap = state.traps[i]
            if (Math.hypot(player.x - trap.x, player.y - trap.y) <= TRAP_RADIUS) {
                player.trappedUntil = now + TRAP_DURATION_MS
                state.traps.splice(i, 1)
                break
            }
        }
    }
}

function placeTrap(state, playerId) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player || player.dead) return false
    const count = player.trapCount || 0
    if (count <= 0) return false
    state.traps = state.traps || []
    state.traps.push({ x: player.x, y: player.y, ownerId: playerId, placedAt: Date.now() })
    player.trapCount = count - 1
    return true
}

function useGrenadeBlind(state, playerId) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player || player.dead) return false
    const count = player.grenadeBlindCount || 0
    if (count <= 0) return false
    const now = Date.now()
    state.grenades = state.grenades || []
    const vx = Math.cos(player.angle)
    const vy = Math.sin(player.angle)
    state.grenades.push({
        startX: player.x,
        startY: player.y,
        x: player.x,
        y: player.y,
        vx,
        vy,
        spawnAt: now,
        ownerId: playerId
    })
    player.grenadeBlindCount = count - 1
    return true
}

function gameLoop(state) {
    if (!state || !state.started) return null
    const alive = state.players.filter(p => !p.dead)

    updateAI(state)
    updateZone(state)
    applyZoneDamage(state)
    const now = Date.now()
    if (state.dropPings) state.dropPings = state.dropPings.filter(p => now - p.at < 15000)
    if (now - state.lastDropAt >= DROP_CRATE_INTERVAL_MS) {
        spawnCrateDrop(state)
        state.lastDropAt = now
    }
    if (!state.supplyPlane && now - (state.lastSupplyPlaneAt || 0) >= SUPPLY_PLANE_INTERVAL_MS) {
        const start = { x: 0, y: Math.random() * MAP_HEIGHT }
        const end = { x: MAP_WIDTH, y: Math.random() * MAP_HEIGHT }
        state.supplyPlane = {
            startAt: now,
            start,
            end,
            dropPoints: [
                { t: 0.25, dropped: false },
                { t: 0.5, dropped: false },
                { t: 0.75, dropped: false }
            ]
        }
    }
    if (state.supplyPlane) {
        const sp = state.supplyPlane
        const elapsed = now - sp.startAt
        for (const dp of sp.dropPoints) {
            if (dp.dropped) continue
            if (elapsed >= dp.t * SUPPLY_PLANE_DURATION_MS) {
                const x = sp.start.x + (sp.end.x - sp.start.x) * dp.t
                const y = sp.start.y + (sp.end.y - sp.start.y) * dp.t
                const nx = Math.max(20, Math.min(MAP_WIDTH - 20, x))
                const ny = Math.max(20, Math.min(MAP_HEIGHT - 20, y))
                if (!isPointInsideBuildingInterior(nx, ny)) {
                    if (Math.random() < 0.3) spawnLootAt(state, nx, ny, 'gold', 40 + Math.floor(Math.random() * 35))
                    else {
                        const wType = WEAPON_LOOT_TYPES[Math.floor(Math.random() * WEAPON_LOOT_TYPES.length)]
                        spawnLootAt(state, nx, ny, wType, getAmmoMax(lootTypeToWeapon(wType)))
                    }
                    state.dropPings = state.dropPings || []
                    state.dropPings.push({ x: nx, y: ny, at: now })
                }
                dp.dropped = true
            }
        }
        if (elapsed >= SUPPLY_PLANE_DURATION_MS) {
            state.supplyPlane = null
            state.lastSupplyPlaneAt = now
        }
    }
    if (!state.secretRoomLootSpawned && SECRET_ROOM_LOOT_POINTS && SECRET_ROOM_LOOT_POINTS.length && state.players.some(p => !p.dead && (p.kills || 0) >= 1)) {
        state.secretRoomLootSpawned = true
        for (const pt of SECRET_ROOM_LOOT_POINTS) {
            if (Math.random() < 0.5) spawnLootAt(state, pt.x, pt.y, 'gold', 30 + Math.floor(Math.random() * 40))
            else {
                const wType = WEAPON_LOOT_TYPES[Math.floor(Math.random() * WEAPON_LOOT_TYPES.length)]
                const ammo = getAmmoMax(lootTypeToWeapon(wType))
                spawnLootAt(state, pt.x, pt.y, wType, ammo)
            }
        }
    }
    processPickup(state)
    processAttack(state)
    processProjectiles(state)
    processGrenades(state)
    processDrones(state)
    processTraps(state)

    for (const p of state.players) {
        if (p.dead && !p.weaponsDropped) {
            dropWeaponsOnDeath(state, p)
        }
    }

    for (const player of alive) {
        if ((player.trappedUntil || 0) > now) continue
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

function getShopInRange(state, player) {
    if (!player || player.dead || !state.shops || !state.shops.length) return null
    for (const shop of state.shops) {
        if (Math.hypot(player.x - shop.x, player.y - shop.y) <= SHOP_RADIUS) return shop
    }
    return null
}

function buyItem(state, playerId, itemId) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player || player.dead) return false
    if (!getShopInRange(state, player)) return false
    const item = SHOP_INVENTORY.find(i => i.id === itemId)
    if (!item || (player.gold || 0) < item.price) return false
    player.gold -= item.price
    if (item.type === 'health_pack') {
        player.health = Math.min(MAX_HEALTH, player.health + 50)
        return true
    }
    const weaponType = lootTypeToWeapon(item.type)
    if (!weaponType) return true
    const maxAmmo = getAmmoMax(weaponType)
    const addAmmo = item.ammo != null ? Math.min(item.ammo, maxAmmo * 2) : maxAmmo
    const existing = (player.weapons || []).findIndex(w => w && w.type === weaponType)
    if (existing >= 0) {
        const w = player.weapons[existing]
        w.ammo = Math.min((w.ammo || 0) + addAmmo, maxAmmo * 2)
    } else if ((player.weapons || []).length < MAX_WEAPON_SLOTS) {
        player.weapons.push({ type: weaponType, ammo: addAmmo, mode: 'normal' })
    } else {
        const idx = Math.max(0, Math.min(MAX_WEAPON_SLOTS - 1, player.weaponIndex || 0))
        player.weapons[idx] = { type: weaponType, ammo: addAmmo, mode: 'normal' }
    }
    return true
}

function setWeaponMode(state, playerId, mode) {
    const player = state.players.find(p => p.playerId === playerId)
    if (!player || player.dead) return
    const slot = getCurrentWeapon(player)
    if (!slot) return
    if (slot.type !== 'rifle' && slot.type !== 'sniper') return
    if (mode === 'alt' || mode === 'normal') slot.mode = mode
}

module.exports = {
    initGame,
    gameLoop,
    addPlayerToGame,
    movePlayer,
    createPlayer,
    setWeaponIndex,
    getShopInRange,
    buyItem,
    useGrenadeBlind,
    placeTrap,
    setWeaponMode,
    useDrone
}
