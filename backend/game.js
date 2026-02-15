const { GRID_SIZE, WIN_TARGET, FOOD_TYPES, TARGET_FOOD_COUNT, INITIAL_FOOD_COUNT, REFILL_FOOD_PER_TICK, PORTAL_SPAWN_CHANCE, PORTAL_MAX_ENTRIES, PORTAL_MAX_AGE_MS, STAR_DURATION_MS, SPEED_DURATION_MS, SPEED_BOOST_FACTOR, MAGNET_DURATION_MS, MAGNET_PULL_PER_TICK, MAGNET_RANGE, FART_RADIUS, BOUNTY_BONUS_LENGTH, REVENGE_BONUS_LENGTH, FEED_STREAK_WINDOW_MS, FEED_STREAK_MIN, FEED_STREAK_STAGE2_MIN, FEED_STREAK_STAGE3_MIN, STREAK_SPEED_DURATION_MS, STREAK_SPEED_BOOST_FACTOR, STREAK_SPEED_STAGE3_BOOST_FACTOR, STREAK_DOUBLE_DURATION_MS, STREAK_TRIPLE_DURATION_MS, BIG_DURATION_MS, AI_COUNT, AI_ID_BASE, FREEZE_AI_RANGE, FREEZE_AI_DURATION_MS, FOOD_PER_OCCUPANCY_TIER, FRAME_RATE, BOOST_SPEED_FACTOR, BOOST_LENGTH_PER_SECOND, MAX_PLAYERS } = require('./constants')
const { getCatalanName, getRandomUnusedName } = require('./catalanNames')

const DIRECTIONS = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
]

function applyFart(state, farterPlayerId) {
    const farter = state.players.find(p => p.playerId === farterPlayerId && !p.dead)
    if (!farter || !farter.pos) return
    const fx = farter.pos.x
    const fy = farter.pos.y
    const alive = state.players.filter(p => !p.dead)
    for (const p of alive) {
        if (p.playerId === farterPlayerId) continue
        const dist = Math.hypot(p.pos.x - fx, p.pos.y - fy)
        if (dist > FART_RADIUS || dist < 0.5) continue
        const dx = p.pos.x - fx
        const dy = p.pos.y - fy
        const ax = dx !== 0 ? (dx > 0 ? 1 : -1) : 0
        const ay = dy !== 0 ? (dy > 0 ? 1 : -1) : 0
        if (ax !== 0 || ay !== 0) p.vel = { x: ax, y: ay }
    }
}

function applyPower(state, playerId, power) {
    const player = state.players.find(p => p.playerId === playerId && !p.dead)
    if (!player || (player.nickName || '').trim() !== 'Noktor') return false
    const now = Date.now()
    switch ((power || '').toLowerCase()) {
        case 'star':
            player.starUntil = now + STAR_DURATION_MS
            return true
        case 'speed':
            player.speedUntil = now + SPEED_DURATION_MS
            return true
        case 'magnet':
            player.magnetUntil = now + MAGNET_DURATION_MS
            return true
        case 'reverse':
            if (player.snake && player.snake.length >= 2) {
                player.snake = player.snake.slice().reverse()
                const newHead = player.snake[player.snake.length - 1]
                const segmentBehindHead = player.snake[player.snake.length - 2]
                player.pos.x = newHead.x
                player.pos.y = newHead.y
                let dx = newHead.x - segmentBehindHead.x
                let dy = newHead.y - segmentBehindHead.y
                if (dx !== 0 || dy !== 0) {
                    player.vel.x = dx !== 0 ? (dx > 0 ? 1 : -1) : 0
                    player.vel.y = dy !== 0 ? (dy > 0 ? 1 : -1) : 0
                }
                player.justReversed = true
                return true
            }
            return false
        case 'big':
            player.bigUntil = now + BIG_DURATION_MS
            player.bigCollectX = player.pos.x
            player.bigCollectY = player.pos.y
            player.bigShrinkX = null
            player.bigShrinkY = null
            if (player.snake && player.snake.length) {
                const head = player.snake[player.snake.length - 1]
                head.big = true
            }
            return true
        default:
            return false
    }
}

module.exports = {
    initGame,
    gameLoop,
    getUpdatedVelocity,
    addPlayerToGame,
    getRandomSpawn,
    applyFart,
    activateHunt,
    activateFunnyHunt,
    aiNormalise,
    applyPower,
    freezeNearbyAI,
    spawnMoreAI,
    removeAIPlayers,
    addSnakeSegments,
    removeSnakeSegments,
    dropFoodFromCorpse
}

function createPlayer(playerId, nickName, spawn, opts = {}) {
    const { x, y } = spawn
    return {
        playerId,
        nickName: nickName || null,
        color: opts.color ?? null,
        skinId: opts.skinId ?? 0,
        dead: false,
        starUntil: 0,
        speedUntil: 0,
        streakSpeedUntil: 0,
        streakDoubleUntil: 0,
        streakTripleUntil: 0,
        streakStage: 0,
        isAI: !!opts.isAI,
        aiLevel: opts.aiLevel || 0,
        frozenUntil: 0,
        pos: { x, y },
        vel: { x: 0, y: 0 },
        snake: [
            { x: x - 2, y },
            { x: x - 1, y },
            { x, y }
        ],
        feedTimes: [],
        foodEaten: 0,
        boostHeld: false,
        boostAccum: 0,
        boostExtraSteps: 0,
        boostLengthTicks: 0,
        snakeStats: { ...DEFAULT_SNAKE_STATS },
        aiModeEnabled: false
    }
}

const INITIAL_SNAKE_LENGTH = 3

const DEFAULT_SNAKE_STATS = { dodge: 0, attack: 0, feed: 0 }
const DODGE_COOLDOWN_MS = 1500
const DODGE_THREAT_DIST = 2

function incrementSnakeStat(player, statName) {
    if (!player.snakeStats) player.snakeStats = { ...DEFAULT_SNAKE_STATS }
    if (typeof player.snakeStats[statName] === 'number') player.snakeStats[statName]++
}

function getOccupancy(player) {
    const fromFood = 1 + Math.floor((player.foodEaten || 0) / FOOD_PER_OCCUPANCY_TIER)
    const len = (player.snake && player.snake.length) || 0
    const effectiveLength = len >= INITIAL_SNAKE_LENGTH ? len : INITIAL_SNAKE_LENGTH
    const fromLength = 1 + Math.floor((effectiveLength - INITIAL_SNAKE_LENGTH) / FOOD_PER_OCCUPANCY_TIER)
    return Math.max(1, fromFood, fromLength)
}

function isCellOccupied(state, cx, cy) {
    for (const player of (state.players || [])) {
        if (player.dead) continue
        const occ = getOccupancy(player)
        for (const cell of player.snake) {
            if (cx >= cell.x && cx < cell.x + occ && cy >= cell.y && cy < cell.y + occ) return true
        }
    }
    for (const food of (state.foodList || [])) {
        if (food.x === cx && food.y === cy) return true
    }
    for (const portal of (state.portals || [])) {
        if ((portal.a.x === cx && portal.a.y === cy) || (portal.b.x === cx && portal.b.y === cy)) return true
    }
    return false
}

function isCellFreeForFoodMove(state, nx, ny, excludeFood) {
    if (nx < 0 || nx > GRID_SIZE || ny < 0 || ny > GRID_SIZE) return false
    for (const player of (state.players || [])) {
        if (player.dead) continue
        const occ = getOccupancy(player)
        for (const cell of player.snake) {
            if (nx >= cell.x && nx < cell.x + occ && ny >= cell.y && ny < cell.y + occ) return false
        }
    }
    for (const food of (state.foodList || [])) {
        if (food === excludeFood) continue
        if (food.x === nx && food.y === ny) return false
    }
    for (const portal of (state.portals || [])) {
        if ((portal.a.x === nx && portal.a.y === ny) || (portal.b.x === nx && portal.b.y === ny)) return false
    }
    return true
}

function processMagnet(state, now) {
    const alive = state.players.filter(p => !p.dead)
    const foodList = state.foodList || []
    for (const player of alive) {
        if ((player.magnetUntil || 0) <= now) continue
        const px = player.pos.x
        const py = player.pos.y
        const withDist = foodList.map(f => ({
            food: f,
            dist: Math.hypot(f.x - px, f.y - py)
        })).filter(w => w.dist <= MAGNET_RANGE && w.dist > 0).sort((a, b) => a.dist - b.dist)
        let pulled = 0
        for (const { food } of withDist) {
            if (pulled >= MAGNET_PULL_PER_TICK) break
            const dx = px - food.x
            const dy = py - food.y
            const nx = food.x + (dx !== 0 ? (dx > 0 ? 1 : -1) : 0)
            const ny = food.y + (dy !== 0 ? (dy > 0 ? 1 : -1) : 0)
            if (nx === food.x && ny === food.y) continue
            if (!isCellFreeForFoodMove(state, nx, ny, food)) continue
            food.x = nx
            food.y = ny
            pulled++
        }
    }
}

const BOSS_OCCUPANCY = 5
const BOSS_LENGTH = 250
const BOSS_SPAWN_INTERVAL_MS = 60000

function isAreaOccupied(state, ax, ay, w, h) {
    for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
            if (isCellOccupied(state, ax + dx, ay + dy)) return true
        }
    }
    if (state.boss) {
        const occ = BOSS_OCCUPANCY
        const bossCells = [state.boss.pos, ...(state.boss.snake || [])]
        for (const cell of bossCells) {
            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    const gx = ax + dx
                    const gy = ay + dy
                    if (gx >= cell.x && gx < cell.x + occ && gy >= cell.y && gy < cell.y + occ) return true
                }
            }
        }
    }
    return false
}

function getBossSpawn(state) {
    const maxAttempts = 200
    const margin = BOSS_OCCUPANCY
    const minX = BOSS_LENGTH - 1
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = minX + Math.floor(Math.random() * (GRID_SIZE - margin - minX))
        const y = Math.floor(Math.random() * (GRID_SIZE - margin))
        if (x < 0 || y < 0 || x + margin > GRID_SIZE || y + margin > GRID_SIZE) continue
        if (isAreaOccupied(state, x, y, margin, margin)) continue
        let tailOk = true
        for (let i = 1; i < BOSS_LENGTH; i++) {
            if (isAreaOccupied(state, x - i, y, margin, margin)) { tailOk = false; break }
        }
        if (!tailOk) continue
        return { x, y }
    }
    return { x: Math.max(minX, 10), y: 10 }
}

function getBossVelocity(state) {
    const boss = state.boss
    if (!boss || !boss.pos) return { x: 0, y: 0 }
    const alive = state.players.filter(p => !p.dead && p.pos)
    if (alive.length === 0) return boss.vel || { x: 0, y: 0 }
    let nearest = null
    let nearestDist = Infinity
    const bx = boss.pos.x + (BOSS_OCCUPANCY - 1) / 2
    const by = boss.pos.y + (BOSS_OCCUPANCY - 1) / 2
    for (const p of alive) {
        const px = p.pos.x + (getOccupancy(p) - 1) / 2
        const py = p.pos.y + (getOccupancy(p) - 1) / 2
        const dist = Math.abs(px - bx) + Math.abs(py - by)
        if (dist < nearestDist) {
            nearestDist = dist
            nearest = p
        }
    }
    if (!nearest) return boss.vel || { x: 0, y: 0 }
    const tx = nearest.pos.x + (getOccupancy(nearest) - 1) / 2
    const ty = nearest.pos.y + (getOccupancy(nearest) - 1) / 2
    let dx = tx - bx
    let dy = ty - by
    const cur = boss.vel || { x: 0, y: 0 }
    const allowed = getAllowedVelocities(cur)
    let best = null
    let bestDist = Infinity
    for (const d of allowed) {
        const nx = boss.pos.x + d.x
        const ny = boss.pos.y + d.y
        const nd = Math.abs((nx + (BOSS_OCCUPANCY - 1) / 2) - tx) + Math.abs((ny + (BOSS_OCCUPANCY - 1) / 2) - ty)
        if (nd < bestDist) {
            bestDist = nd
            best = d
        }
    }
    return best || cur
}

function spawnBoss(state) {
    const spawn = getBossSpawn(state)
    const snake = []
    for (let i = 0; i < BOSS_LENGTH - 1; i++) {
        snake.push({ x: spawn.x - 1 - i, y: spawn.y })
    }
    state.boss = {
        pos: { x: spawn.x, y: spawn.y },
        vel: { x: 1, y: 0 },
        snake,
        occupancy: BOSS_OCCUPANCY
    }
}

function moveBoss(state) {
    const boss = state.boss
    if (!boss || !boss.pos) return
    boss.vel = getBossVelocity(state)
    const nx = boss.pos.x + (boss.vel.x || 0)
    const ny = boss.pos.y + (boss.vel.y || 0)
    const clampedX = Math.max(0, Math.min(GRID_SIZE - BOSS_OCCUPANCY, nx))
    const clampedY = Math.max(0, Math.min(GRID_SIZE - BOSS_OCCUPANCY, ny))
    boss.snake.push({ x: boss.pos.x, y: boss.pos.y })
    boss.snake.shift()
    boss.pos.x = clampedX
    boss.pos.y = clampedY
}

function checkBossVsPlayers(state) {
    const boss = state.boss
    if (!boss || !boss.pos) return
    const alive = state.players.filter(p => !p.dead)
    const occ = BOSS_OCCUPANCY
    const bossCells = [boss.pos, ...(boss.snake || [])]
    for (const player of alive) {
        const pOcc = getOccupancy(player)
        const pHead = { x: player.pos.x, y: player.pos.y }
        for (const cell of bossCells) {
            const overlapX = !(pHead.x + pOcc <= cell.x || cell.x + occ <= pHead.x)
            const overlapY = !(pHead.y + pOcc <= cell.y || cell.y + occ <= pHead.y)
            if (overlapX && overlapY) {
                player.killedBy = null
                player.killedByReason = 'boss'
                dropFoodFromCorpse(state, player.snake)
                tryRespawnOrDisconnect(state, player)
                break
            }
        }
        if (player.dead) continue
        const pSnake = player.snake || []
        for (let i = 0; i < pSnake.length; i++) {
            const cell = pSnake[i]
            for (const bc of bossCells) {
                const overlapX = !(cell.x + pOcc <= bc.x || bc.x + occ <= cell.x)
                const overlapY = !(cell.y + pOcc <= bc.y || bc.y + occ <= cell.y)
                if (overlapX && overlapY) {
                    player.killedBy = null
                    player.killedByReason = 'boss'
                    dropFoodFromCorpse(state, player.snake)
                    tryRespawnOrDisconnect(state, player)
                    break
                }
            }
        }
    }
}

function getRandomSpawn(state) {
    const maxAttempts = 500
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = 3 + Math.floor(Math.random() * (GRID_SIZE - 6))
        const y = 3 + Math.floor(Math.random() * (GRID_SIZE - 6))
        const frontX = x + 1
        if (frontX > GRID_SIZE) continue
        const body = [{ x: x - 2, y }, { x: x - 1, y }, { x, y }]
        let ok = true
        for (const cell of body) {
            if (cell.x < 0 || cell.x > GRID_SIZE || cell.y < 0 || cell.y > GRID_SIZE) { ok = false; break }
            if (isCellOccupied(state, cell.x, cell.y)) { ok = false; break }
        }
        if (!ok) continue
        if (isCellOccupied(state, frontX, y)) continue
        return { x, y }
    }
    return { x: 10, y: 10 }
}

function addPlayerToGame(state, playerId, nickName, color, skinId) {
    const spawn = getRandomSpawn(state)
    const player = createPlayer(playerId, nickName, spawn, { color: color || null, skinId: skinId || 0 })
    state.players.push(player)
    return player
}

function isPortalTile(state, x, y) {
    for (const portal of (state.portals || [])) {
        if ((portal.a.x === x && portal.a.y === y) || (portal.b.x === x && portal.b.y === y)) return true
    }
    return false
}

function getFreeCellForPortal(state, exclude) {
    for (let attempt = 0; attempt < 300; attempt++) {
        const x = 2 + Math.floor(Math.random() * (GRID_SIZE - 4))
        const y = 2 + Math.floor(Math.random() * (GRID_SIZE - 4))
        if (exclude && exclude.x === x && exclude.y === y) continue
        let ok = true
        for (const player of (state.players || [])) {
            if (player.dead) continue
            for (const cell of (player.snake || [])) {
                if (cell.x === x && cell.y === y) { ok = false; break }
            }
            if (!ok) break
        }
        if (!ok) continue
        for (const food of (state.foodList || [])) {
            if (food.x === x && food.y === y) { ok = false; break }
        }
        if (!ok) continue
        if (isPortalTile(state, x, y)) continue
        return { x, y }
    }
    return null
}

function addPortalPair(state) {
    const a = getFreeCellForPortal(state)
    if (!a) return
    const b = getFreeCellForPortal(state, a)
    if (!b) return
    if (!state.portals) state.portals = []
    state.portals.push({
        a: { x: a.x, y: a.y },
        b: { x: b.x, y: b.y },
        createdAt: Date.now(),
        entries: 0
    })
}

function initGame(nickName, color, skinId) {
    const spawn = getRandomSpawn({ players: [], foodList: [], portals: [] })
    const state = {
        players: [createPlayer(1, nickName, spawn, { color: color || null, skinId: skinId || 0 })],
        foodList: [],
        portals: [],
        gridSize: GRID_SIZE,
        huntMode: false,
        huntTargets: [],
        funnyHuntMode: false,
        lastAISpawnTime: Date.now(),
        boss: null,
        bossSpawnAt: Date.now()
    }
    for (let i = 0; i < INITIAL_FOOD_COUNT; i++) randomFood(state)
    addAIPlayers(state)
    return state
}

const EXPERT_AI_COUNT = 3
const LEGENDARY_AI_COUNT = 1

function addAIPlayers(state) {
    const usedNames = state.players.map(p => p.nickName).filter(Boolean)
    for (let i = 0; i < AI_COUNT; i++) {
        const spawn = getRandomSpawn(state)
        const name = getRandomUnusedName(usedNames)
        usedNames.push(name)
        const level = i < 12 ? 1 : (i < 22 ? 2 : 3)
        const ai = createPlayer(AI_ID_BASE + i, name, spawn, { isAI: true, aiLevel: level })
        state.players.push(ai)
    }
    for (let i = 0; i < EXPERT_AI_COUNT; i++) {
        const spawn = getRandomSpawn(state)
        if (!spawn) continue
        const name = getRandomUnusedName(usedNames)
        usedNames.push(name)
        const ai = createPlayer(AI_ID_BASE + AI_COUNT + i, name, spawn, { isAI: true, aiLevel: 4 })
        state.players.push(ai)
    }
    for (let i = 0; i < LEGENDARY_AI_COUNT; i++) {
        const spawn = getRandomSpawn(state)
        if (!spawn) continue
        const name = getRandomUnusedName(usedNames)
        usedNames.push(name)
        const ai = createPlayer(AI_ID_BASE + AI_COUNT + EXPERT_AI_COUNT + i, name, spawn, { isAI: true, aiLevel: 5 })
        state.players.push(ai)
    }
}

function freezeNearbyAI(state, requesterPlayerId) {
    const requester = state.players.find(p => p.playerId === requesterPlayerId && !p.dead)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor' || !requester.pos) return 0
    const now = Date.now()
    const px = requester.pos.x
    const py = requester.pos.y
    let count = 0
    for (const p of state.players) {
        if (!p.isAI || p.dead || !p.pos) continue
        const dist = Math.abs(p.pos.x - px) + Math.abs(p.pos.y - py)
        if (dist <= FREEZE_AI_RANGE) {
            p.frozenUntil = now + FREEZE_AI_DURATION_MS
            count++
        }
    }
    return count
}

function spawnMoreAI(state, count, requesterPlayerId) {
    const requester = state.players.find(p => p.playerId === requesterPlayerId && !p.dead)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor') return 0
    const n = Math.max(0, Math.min(50, Math.floor(count) || 1))
    const maxId = state.players.length ? Math.max(...state.players.map(p => p.playerId)) : 0
    const usedNames = state.players.map(p => p.nickName).filter(Boolean)
    const aiCountBefore = state.players.filter(p => p.isAI).length
    let added = 0
    for (let i = 0; i < n; i++) {
        const spawn = getRandomSpawn(state)
        if (!spawn) break
        const nextId = maxId + 1 + i
        const name = getRandomUnusedName(usedNames)
        usedNames.push(name)
        const level = (aiCountBefore + i) < 12 ? 1 : (aiCountBefore + i) < 22 ? 2 : 3
        const ai = createPlayer(nextId, name, spawn, { isAI: true, aiLevel: level })
        state.players.push(ai)
        added++
    }
    return added
}

function spawnOneRandomAI(state) {
    if (!state || state.players.length >= MAX_PLAYERS) return false
    const spawn = getRandomSpawn(state)
    if (!spawn) return false
    const usedNames = state.players.map(p => p.nickName).filter(Boolean)
    const name = getRandomUnusedName(usedNames)
    const maxId = state.players.length ? Math.max(...state.players.map(p => p.playerId)) : 0
    const level = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : 3
    const ai = createPlayer(maxId + 1, name, spawn, { isAI: true, aiLevel: level })
    state.players.push(ai)
    return true
}

function removeAIPlayers(state, count, requesterPlayerId) {
    const requester = state.players.find(p => p.playerId === requesterPlayerId && !p.dead)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor') return 0
    const aliveAI = state.players.filter(p => p.isAI && !p.dead)
    const n = Math.max(0, Math.min(aliveAI.length, Math.floor(count) || 1))
    for (let i = 0; i < n; i++) {
        const p = aliveAI[i]
        p.dead = true
        dropFoodFromCorpse(state, p.snake)
    }
    return n
}

const MIN_SNAKE_LENGTH = 3

function addSnakeSegments(state, requesterPlayerId, count) {
    const requester = state.players.find(p => p.playerId === requesterPlayerId && !p.dead)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor' || !requester.snake || !requester.snake.length) return 0
    const n = Math.max(0, Math.min(100, Math.floor(count) || 1))
    const tail = requester.snake[0]
    for (let i = 0; i < n; i++) {
        requester.snake.unshift({ ...tail, big: (requester.bigUntil || 0) > Date.now() })
    }
    return n
}

function removeSnakeSegments(state, requesterPlayerId, count) {
    const requester = state.players.find(p => p.playerId === requesterPlayerId && !p.dead)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor' || !requester.snake) return 0
    const n = Math.max(0, Math.min(requester.snake.length - MIN_SNAKE_LENGTH, Math.floor(count) || 1))
    for (let i = 0; i < n; i++) {
        requester.snake.shift()
    }
    return n
}

function gameLoop(state) {
    if(!state) {
        return false
    }
    for (const p of state.players) delete p.lastDeathCause

    const now = Date.now()
    if (now - (state.lastAISpawnTime || 0) >= AI_SPAWN_INTERVAL_MS) {
        state.lastAISpawnTime = now
        if (Math.random() < AI_SPAWN_CHANCE) spawnOneRandomAI(state)
    }
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        player.justReversed = false
    }
    for (const player of alive) {
        if ((player.isAI || player.aiModeEnabled) && (player.frozenUntil || 0) <= now) {
            const aiVel = getAIVelocity(state, player)
            if (aiVel) player.vel = aiVel
            setAIBoost(state, player)
        }
        if ((player.frozenUntil || 0) > now) continue
        const startPos = { x: player.pos.x, y: player.pos.y }
        player.pos.x += player.vel.x
        player.pos.y += player.vel.y
        if (player.speedUntil > now && (player.vel.x || player.vel.y)) {
            player.pos.x += Math.round(player.vel.x * SPEED_BOOST_FACTOR)
            player.pos.y += Math.round(player.vel.y * SPEED_BOOST_FACTOR)
        }
        if (player.streakSpeedUntil > now && (player.vel.x || player.vel.y)) {
            player.pos.x += Math.round(player.vel.x * STREAK_SPEED_BOOST_FACTOR)
            player.pos.y += Math.round(player.vel.y * STREAK_SPEED_BOOST_FACTOR)
        }
        if (player.streakTripleUntil > now && (player.vel.x || player.vel.y)) {
            player.pos.x += Math.round(player.vel.x * STREAK_SPEED_STAGE3_BOOST_FACTOR)
            player.pos.y += Math.round(player.vel.y * STREAK_SPEED_STAGE3_BOOST_FACTOR)
        }
        if (player.boostHeld && (player.vel.x || player.vel.y)) {
            player.boostAccum = (player.boostAccum || 0) + BOOST_SPEED_FACTOR
            if (player.boostAccum >= 1) {
                player.boostAccum -= 1
                player.pos.x += player.vel.x
                player.pos.y += player.vel.y
                player.boostExtraSteps = 1
            }
            const ticksPerDrain = Math.max(1, Math.round(FRAME_RATE / BOOST_LENGTH_PER_SECOND))
            player.boostLengthTicks = (player.boostLengthTicks || 0) + 1
            if (player.boostLengthTicks >= ticksPerDrain && player.snake && player.snake.length > MIN_SNAKE_LENGTH) {
                player.snake.shift()
                player.boostLengthTicks = 0
            }
        } else {
            player.boostAccum = 0
            player.boostLengthTicks = 0
        }
        if (player.vel.x || player.vel.y) {
            let stepsThisTick = player.vel.x !== 0
                ? Math.round((player.pos.x - startPos.x) / player.vel.x)
                : Math.round((player.pos.y - startPos.y) / player.vel.y)
            player._startPosThisTick = { x: startPos.x, y: startPos.y }
            player._stepsThisTick = Math.max(1, Math.abs(stepsThisTick))
        }
    }

    return processPlayerSnakes(state)
}

function dropFoodFromCorpse(state, snake) {
    if (!snake || !snake.length || !state.foodList) return
    const useEven = Math.random() < 0.5
    for (let i = 0; i < snake.length; i++) {
        if ((useEven && i % 2 === 0) || (!useEven && i % 2 === 1)) {
            const seg = snake[i]
            state.foodList.push({ x: seg.x, y: seg.y, foodType: FOOD_TYPES[0] })
        }
    }
}

const AI_DISCONNECT_BASE_CHANCE = 0.02
const AI_DISCONNECT_CHANCE_PER_DEATH = 0.06
const AI_DISCONNECT_MAX_CHANCE = 0.40
const AI_SPAWN_INTERVAL_MS = 5000
const AI_SPAWN_CHANCE = 0.55

function tryRespawnOrDisconnect(state, player) {
    if (!player.isAI) {
        respawn(state, player)
        return
    }
    player.deathCount = (player.deathCount || 0) + 1
    const chance = Math.min(AI_DISCONNECT_MAX_CHANCE, AI_DISCONNECT_BASE_CHANCE + player.deathCount * AI_DISCONNECT_CHANCE_PER_DEATH)
    if (Math.random() < chance) {
        const idx = state.players.indexOf(player)
        if (idx >= 0) state.players.splice(idx, 1)
        return
    }
    respawn(state, player)
}

function respawn(state, player) {
    const wasBounty = state.bountyPlayerId === player.playerId
    const killerId = player.killedBy
    if (player.killedBy != null) {
        player.revengeTargetPlayerId = player.killedBy
        player.lastDeathCause = { killerId: player.killedBy, reason: player.killedByReason || 'collision' }
    }
    player.snake = []
    player.foodEaten = 0
    player.pos = { x: -1, y: -1 }
    const spawn = getRandomSpawn(state)
    player.pos = { x: spawn.x, y: spawn.y }
    player.vel = { x: 0, y: 0 }
    player.snake = [
        { x: spawn.x - 2, y: spawn.y },
        { x: spawn.x - 1, y: spawn.y },
        { x: spawn.x, y: spawn.y }
    ]
    player.justRespawned = true
    player.killedBy = null
    player.killedByReason = null
    player.boostHeld = false
    player.boostAccum = 0
    player.boostExtraSteps = 0
    player.boostLengthTicks = 0
    if (!player.snakeStats) player.snakeStats = { ...DEFAULT_SNAKE_STATS }
    if (typeof player.aiModeEnabled !== 'boolean') player.aiModeEnabled = false
    player.streakSpeedUntil = 0
    player.streakDoubleUntil = 0
    player.streakTripleUntil = 0
    player.streakStage = 0
    player.feedTimes = []
    player.feedStreak = false
    if (wasBounty && killerId) {
        const killer = state.players.find(p => p.playerId === killerId && !p.dead)
        if (killer && killer.snake && killer.snake.length) {
            const tail = killer.snake[killer.snake.length - 1]
            for (let i = 0; i < BOUNTY_BONUS_LENGTH; i++) {
                killer.snake.push({ x: tail.x, y: tail.y })
            }
        }
    }
    if (state.huntTargets && state.huntTargets.length) {
        const idx = state.huntTargets.indexOf(player.playerId)
        if (idx >= 0) state.huntTargets.splice(idx, 1)
        if (state.huntTargets.length === 0) state.huntMode = false
    }
}

function activateHunt(state, requestedByPlayerId) {
    const requester = state.players.find(p => p.playerId === requestedByPlayerId)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor') return false
    const alive = state.players.filter(p => !p.dead && !p.isAI)
    const nonNoktor = alive.filter(p => (p.nickName || '').trim() !== 'Noktor')
    state.huntTargets = nonNoktor.length > 0
        ? nonNoktor.map(p => p.playerId)
        : alive.map(p => p.playerId)
    state.huntMode = state.huntTargets.length > 0
    return state.huntMode
}

const FUNNY_ORBIT_RADIUS = 6

function activateFunnyHunt(state, requestedByPlayerId) {
    const requester = state.players.find(p => p.playerId === requestedByPlayerId)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor') return false
    const humans = state.players.filter(p => !p.dead && !p.isAI && (p.nickName || '').trim() !== 'Noktor')
    if (humans.length === 0) return false
    state.funnyHuntMode = true
    return true
}

function aiNormalise(state, requestedByPlayerId) {
    const requester = state.players.find(p => p.playerId === requestedByPlayerId)
    if (!requester || (requester.nickName || '').trim() !== 'Noktor') return false
    state.huntMode = false
    state.huntTargets = []
    state.funnyHuntMode = false
    return true
}

function processPlayerSnakes(state) {
    const now = Date.now()
    if (now - (state.bossSpawnAt || 0) >= BOSS_SPAWN_INTERVAL_MS) {
        state.bossSpawnAt = now
        spawnBoss(state)
    }
    if (state.boss) {
        moveBoss(state)
        checkBossVsPlayers(state)
    }
    const alive = state.players.filter(p => !p.dead)
    for (const p of state.players) {
        if (typeof p.foodEaten !== 'number') p.foodEaten = 0
    }

    let longest = 0
    let bountyId = null
    for (const p of alive) {
        const len = (p.snake && p.snake.length) || 0
        if (len > longest) {
            longest = len
            bountyId = p.playerId
        }
    }
    state.bountyPlayerId = bountyId

    for (const p of alive) {
        const feedTimes = (p.feedTimes || []).filter(t => now - t < FEED_STREAK_WINDOW_MS)
        p.feedTimes = feedTimes
        const n = feedTimes.length
        p.feedStreak = n >= FEED_STREAK_MIN
        if (n >= FEED_STREAK_MIN) p.streakSpeedUntil = now + STREAK_SPEED_DURATION_MS
        if (n >= FEED_STREAK_STAGE3_MIN) {
            p.streakStage = 3
            if ((p.streakTripleUntil || 0) <= now) p.streakTripleUntil = now + STREAK_TRIPLE_DURATION_MS
        } else if (n >= FEED_STREAK_STAGE2_MIN) {
            p.streakStage = 2
            if ((p.streakDoubleUntil || 0) <= now) p.streakDoubleUntil = now + STREAK_DOUBLE_DURATION_MS
        } else if (n >= FEED_STREAK_MIN) {
            p.streakStage = 1
        } else {
            p.streakStage = 0
        }
    }

    if (state.portals && state.portals.length) {
        state.portals = state.portals.filter(p => p.entries < PORTAL_MAX_ENTRIES && (now - p.createdAt) < PORTAL_MAX_AGE_MS)
    }

    processMagnet(state, now)

    for (const player of alive) {
        player.justRespawned = false
        if ((player.bigUntil || 0) <= now && player.bigCollectX != null && player.bigShrinkX == null) {
            player.bigShrinkX = player.pos.x
            player.bigShrinkY = player.pos.y
        }
        if (player.snake) {
            for (const cell of player.snake) {
                if (player.bigCollectX != null && cell.x === player.bigCollectX && cell.y === player.bigCollectY && (player.bigUntil || 0) > now) {
                    cell.big = true
                }
                if (player.bigShrinkX != null && cell.x === player.bigShrinkX && cell.y === player.bigShrinkY) {
                    cell.big = false
                }
            }
        }
    }

    for (const player of alive) {
        if (player.pos.x < 0 || player.pos.x > GRID_SIZE || player.pos.y < 0 || player.pos.y > GRID_SIZE) {
            if (player.starUntil <= now) {
                player.killedBy = null
                dropFoodFromCorpse(state, player.snake)
                tryRespawnOrDisconnect(state, player)
            } else {
                player.pos.x = Math.max(0, Math.min(GRID_SIZE, player.pos.x))
                player.pos.y = Math.max(0, Math.min(GRID_SIZE, player.pos.y))
            }
            continue
        }

        for (const portal of (state.portals || [])) {
            if (player.pos.x === portal.a.x && player.pos.y === portal.a.y) {
                player.pos.x = portal.b.x
                player.pos.y = portal.b.y
                portal.entries += 1
                break
            }
            if (player.pos.x === portal.b.x && player.pos.y === portal.b.y) {
                player.pos.x = portal.a.x
                player.pos.y = portal.a.y
                portal.entries += 1
                break
            }
        }

        const occ = getOccupancy(player)
        for (let i = 0; i < state.foodList.length; i++) {
            const food = state.foodList[i]
            const onHead = food.x >= player.pos.x && food.x < player.pos.x + occ && food.y >= player.pos.y && food.y < player.pos.y + occ
            if (!onHead) continue
            {
                player.foodEaten = (player.foodEaten || 0) + 1
                const feedNow = Date.now()
                if (!player.feedTimes) player.feedTimes = []
                player.feedTimes.push(feedNow)
                incrementSnakeStat(player, 'feed')
                switch (food.foodType) {
                    case FOOD_TYPES[2]: {
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        const nowFeed = Date.now()
                        const triple = (player.streakTripleUntil || 0) > nowFeed
                        const double = (player.streakDoubleUntil || 0) > nowFeed
                        const count = triple ? 9 : (double ? 6 : 3)
                        for (let k = 0; k < count; k++) {
                            player.snake.push({ ...player.pos, big: (player.bigUntil || 0) > nowFeed })
                        }
                        player.pos.x += player.vel.x
                        player.pos.y += player.vel.y
                        break
                    }
                    case FOOD_TYPES[0]: {
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        const nowFeed = Date.now()
                        const triple = (player.streakTripleUntil || 0) > nowFeed
                        const double = (player.streakDoubleUntil || 0) > nowFeed
                        const count = triple ? 3 : (double ? 2 : 1)
                        for (let k = 0; k < count; k++) {
                            player.snake.push({ ...player.pos, big: (player.bigUntil || 0) > nowFeed })
                        }
                        player.pos.x += player.vel.x
                        player.pos.y += player.vel.y
                        break
                    }
                    case FOOD_TYPES[1]:
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.snake.shift()
                        break
                    case FOOD_TYPES[3]:
                        state.foodList.splice(i, 1)
                        for (let j = 0; j <= 10; j++) {
                            randomFood(state)
                        }
                        break
                    case 'STAR':
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.starUntil = Date.now() + STAR_DURATION_MS
                        break
                    case 'SPEED':
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.speedUntil = Date.now() + SPEED_DURATION_MS
                        break
                    case 'MAGNET':
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.magnetUntil = Date.now() + MAGNET_DURATION_MS
                        break
                    case 'REVERSE':
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        if (player.snake && player.snake.length >= 2) {
                            player.snake = player.snake.slice().reverse()
                            const newHead = player.snake[player.snake.length - 1]
                            const segmentBehindHead = player.snake[player.snake.length - 2]
                            player.pos.x = newHead.x
                            player.pos.y = newHead.y
                            let dx = newHead.x - segmentBehindHead.x
                            let dy = newHead.y - segmentBehindHead.y
                            if (dx !== 0 || dy !== 0) {
                                player.vel.x = dx !== 0 ? (dx > 0 ? 1 : -1) : 0
                                player.vel.y = dy !== 0 ? (dy > 0 ? 1 : -1) : 0
                            }
                            player.justReversed = true
                        }
                        break
                    case 'BIG':
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.bigUntil = Date.now() + BIG_DURATION_MS
                        player.bigCollectX = player.pos.x
                        player.bigCollectY = player.pos.y
                        player.bigShrinkX = null
                        player.bigShrinkY = null
                        if (player.snake && player.snake.length) {
                            const head = player.snake[player.snake.length - 1]
                            head.big = true
                        }
                        break
                }
                break
            }
        }

        if ((player.frozenUntil || 0) > now) {
            // Frozen: no movement, no collision check, no push/shift
        } else if (player.vel.x || player.vel.y) {
            let died = false
            if (player.starUntil <= Date.now()) {
                const headOcc = getOccupancy(player)
                const steps = player._stepsThisTick || 1
                const start = player._startPosThisTick || { x: player.pos.x - player.vel.x, y: player.pos.y - player.vel.y }
                const vx = player.vel.x || 0
                const vy = player.vel.y || 0
                const checkPositions = []
                for (let s = 0; s < steps; s++) {
                    checkPositions.push({
                        x: start.x + vx * (s + 1),
                        y: start.y + vy * (s + 1)
                    })
                }
                for (const headPos of checkPositions) {
                    for (const p of alive) {
                        const snake = p.snake || []
                        const isSelf = p === player
                        let bodyEnd = snake.length
                        if (isSelf && !player.justReversed) {
                            const last = snake[snake.length - 1]
                            let samePosFromEnd = 0
                            if (last) {
                                for (let j = snake.length - 1; j >= 0; j--) {
                                    if (snake[j].x === last.x && snake[j].y === last.y) samePosFromEnd++
                                    else break
                                }
                            }
                            const neckExtra = headOcc >= 2 ? 2 : 0
                            let minNeck = headOcc
                            if (headOcc >= 2) minNeck = headOcc + 1
                            if (headOcc >= 4) minNeck = headOcc * 2
                            bodyEnd = Math.max(0, snake.length - Math.max(minNeck, samePosFromEnd + neckExtra))
                        }
                        const segOcc = getOccupancy(p)
                        for (let i = 0; i < bodyEnd; i++) {
                            const cell = snake[i]
                            const overlapX = !(headPos.x + headOcc <= cell.x || cell.x + segOcc <= headPos.x)
                            const overlapY = !(headPos.y + headOcc <= cell.y || cell.y + segOcc <= headPos.y)
                            if (overlapX && overlapY) {
                                if (p !== player) {
                                    player.killedBy = p.playerId
                                    player.killedByReason = 'collision'
                                }
                                dropFoodFromCorpse(state, player.snake)
                                tryRespawnOrDisconnect(state, player)
                                died = true
                                break
                            }
                        }
                        if (died) break
                    }
                    if (died) break
                }
            }
            if (!died && !player.justRespawned && !player.justReversed) {
                const steps = player._stepsThisTick || 1
                const start = player._startPosThisTick || { x: player.pos.x - player.vel.x, y: player.pos.y - player.vel.y }
                const vx = player.vel.x || 0
                const vy = player.vel.y || 0
                for (let step = 0; step < steps; step++) {
                    const pushX = start.x + vx * (step + 1)
                    const pushY = start.y + vy * (step + 1)
                    player.snake.push({ x: pushX, y: pushY, big: (player.bigUntil || 0) > Date.now() })
                    player.snake.shift()
                }
                player.boostExtraSteps = 0
                delete player._stepsThisTick
                delete player._startPosThisTick
            }
            if (!died) {
                const playerBodyEnd = (player.snake || []).length - 1
                const playerSegOcc = getOccupancy(player)
                for (const p of alive) {
                    if (p === player || p.dead) continue
                    const pSnake = p.snake || []
                    if (!pSnake.length) continue
                    const pHead = { x: p.pos.x, y: p.pos.y }
                    const pHeadOcc = getOccupancy(p)
                    for (let i = 0; i < playerBodyEnd; i++) {
                        const cell = (player.snake || [])[i]
                        if (!cell) continue
                        const overlapX = !(pHead.x + pHeadOcc <= cell.x || cell.x + playerSegOcc <= pHead.x)
                        const overlapY = !(pHead.y + pHeadOcc <= cell.y || cell.y + playerSegOcc <= pHead.y)
                        if (overlapX && overlapY) {
                            p.killedBy = player.playerId
                            p.killedByReason = 'collision'
                            incrementSnakeStat(player, 'attack')
                            dropFoodFromCorpse(state, p.snake)
                            tryRespawnOrDisconnect(state, p)
                            if (p.revengeTargetPlayerId === player.playerId) {
                                const tail = player.snake[player.snake.length - 1]
                                for (let k = 0; k < REVENGE_BONUS_LENGTH; k++) {
                                    player.snake.push({ x: tail.x, y: tail.y, big: (player.bigUntil || 0) > Date.now() })
                                }
                            }
                            break
                        }
                    }
                }
            }
        }
    }

    const nowDodge = Date.now()
    for (const p of alive) {
        if (p.dead) continue
        const myLen = (p.snake && p.snake.length) || 0
        let hasThreat = false
        for (const other of alive) {
            if (other === p || other.dead) continue
            const otherLen = (other.snake && other.snake.length) || 0
            if (otherLen <= myLen) continue
            const dist = Math.abs(p.pos.x - other.pos.x) + Math.abs(p.pos.y - other.pos.y)
            if (dist <= DODGE_THREAT_DIST) { hasThreat = true; break }
        }
        if (hasThreat && (p.lastDodgeAt || 0) + DODGE_COOLDOWN_MS <= nowDodge) {
            incrementSnakeStat(p, 'dodge')
            p.lastDodgeAt = nowDodge
        }
    }

    let genRandomFood = Math.random() * 100
    if (genRandomFood <= 6) randomFood(state)
    for (let i = 0; i < REFILL_FOOD_PER_TICK && (state.foodList || []).length < TARGET_FOOD_COUNT; i++) {
        randomFood(state)
    }

    if (Math.random() < PORTAL_SPAWN_CHANCE) addPortalPair(state)

    for (const p of state.players) {
        p.occupancy = getOccupancy(p)
    }
    for (const p of state.players) {
        if (!p.dead && p.snake && p.snake.length >= WIN_TARGET) return p
    }
    return false
}

function randomFood(state) {
    food = {
        foodType: generateFoodType(),
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
    }

    for (const player of state.players) {
        if (player.dead) continue
        const occ = getOccupancy(player)
        for (const cell of player.snake) {
            if (food.x >= cell.x && food.x < cell.x + occ && food.y >= cell.y && food.y < cell.y + occ) {
                return randomFood(state)
            }
        }
    }

    for (const food2 of state.foodList) {
        if (food2.x === food.x && food2.y === food.y) {
            return randomFood(state)
        }
    }
    for (const portal of (state.portals || [])) {
        if ((portal.a.x === food.x && portal.a.y === food.y) || (portal.b.x === food.x && portal.b.y === food.y)) {
            return randomFood(state)
        }
    }

    state.foodList.push(food)
}

function generateFoodType() {
    let randomNumber = Math.floor(Math.random() * 100)
    if (randomNumber < 2) return 'STAR'
    if (randomNumber < 4) return 'SPEED'
    if (randomNumber < 6) return 'MAGNET'
    if (randomNumber < 8) return 'REVERSE'
    if (randomNumber >= 51) return FOOD_TYPES[0]
    if (randomNumber >= 21) return FOOD_TYPES[1]
    if (randomNumber >= 5) return FOOD_TYPES[2]
    if (randomNumber >= 1) return FOOD_TYPES[3]
}

function getAllowedVelocities(vel) {
    const out = []
    for (const d of DIRECTIONS) {
        if (vel.x && d.x === -vel.x && d.y === 0) continue
        if (vel.y && d.y === -vel.y && d.x === 0) continue
        out.push(d)
    }
    return out.length ? out : DIRECTIONS
}

function isCellBlocked(state, nx, ny, selfPlayer) {
    if (nx < 0 || nx > GRID_SIZE || ny < 0 || ny > GRID_SIZE) return true
    const alive = state.players.filter(p => !p.dead)
    for (const p of alive) {
        const snake = p.snake || []
        const isSelf = p.playerId === selfPlayer.playerId
        const occ = getOccupancy(p)
        for (let i = 0; i < snake.length; i++) {
            if (isSelf && i === 0) continue
            const cell = snake[i]
            if (nx >= cell.x && nx < cell.x + occ && ny >= cell.y && ny < cell.y + occ) return true
        }
    }
    return false
}

function isInFireZone() {
    return false
}

const POWER_UP_FOOD_TYPES = ['STAR', 'SPEED', 'MAGNET', 'REVERSE']

function aiScoreFoodTarget(nx, ny, foodList) {
    let bestScore = Infinity
    let bestFood = null
    for (const f of foodList) {
        const dist = Math.abs(f.x - nx) + Math.abs(f.y - ny)
        const isPowerUp = POWER_UP_FOOD_TYPES.indexOf(f.foodType) >= 0
        const score = dist - (isPowerUp ? 18 : 0)
        if (score < bestScore) {
            bestScore = score
            bestFood = f
        }
    }
    return bestScore
}

function aiEdgePenalty(nx, ny) {
    const margin = GRID_SIZE * 0.15
    let penalty = 0
    if (nx < margin) penalty += (margin - nx) * 2
    if (nx > GRID_SIZE - 1 - margin) penalty += (nx - (GRID_SIZE - 1 - margin)) * 2
    if (ny < margin) penalty += (margin - ny) * 2
    if (ny > GRID_SIZE - 1 - margin) penalty += (ny - (GRID_SIZE - 1 - margin)) * 2
    return penalty
}

function aiCountSafeExits(state, px, py, player) {
    let count = 0
    for (const d of DIRECTIONS) {
        const nx = px + d.x
        const ny = py + d.y
        if (!isCellBlocked(state, nx, ny, player)) count++
    }
    return count
}

function getAIVelocity(state, player) {
    const allowed = getAllowedVelocities(player.vel)
    const px = player.pos.x
    const py = player.pos.y
    const stats = player.snakeStats || DEFAULT_SNAKE_STATS
    const attackBias = (stats.attack || 0) * 0.5
    const dodgeBias = (stats.dodge || 0) * 0.5
    const feedBias = (stats.feed || 0) * 0.3

    if (state.funnyHuntMode && player.isAI) {
        const humans = state.players.filter(p => !p.dead && !p.isAI && (p.nickName || '').trim() !== 'Noktor' && p.pos)
        let nearest = null
        let nearestDist = Infinity
        for (const t of humans) {
            const dist = Math.abs(t.pos.x - px) + Math.abs(t.pos.y - py)
            if (dist < nearestDist) {
                nearestDist = dist
                nearest = t
            }
        }
        if (nearest && nearest.pos) {
            const tx = nearest.pos.x
            const ty = nearest.pos.y
            const dx = tx - px
            const dy = ty - py
            if (nearestDist > FUNNY_ORBIT_RADIUS) {
                let best = null
                let bestDist = Infinity
                for (const d of allowed) {
                    const nx = px + d.x
                    const ny = py + d.y
                    if (isCellBlocked(state, nx, ny, player)) continue
                    const dist = Math.abs(nx - tx) + Math.abs(ny - ty)
                    if (dist < bestDist) {
                        bestDist = dist
                        best = d
                    }
                }
                if (best) return { x: best.x, y: best.y }
            } else {
                const tangentPairs = Math.abs(dx) >= Math.abs(dy)
                    ? [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                    : [{ x: 1, y: 0 }, { x: -1, y: 0 }]
                const orbitDir = player.playerId % 2 === 0 ? 0 : 1
                const tangentCandidates = [tangentPairs[orbitDir], tangentPairs[1 - orbitDir]]
                const orbitMoves = allowed.filter(d => {
                    const nx = px + d.x
                    const ny = py + d.y
                    if (isCellBlocked(state, nx, ny, player)) return false
                    const nd = Math.abs(nx - tx) + Math.abs(ny - ty)
                    if (nd < 2) return false
                    return nd <= FUNNY_ORBIT_RADIUS + 2
                })
                const prefer = orbitMoves.filter(d =>
                    tangentCandidates.some(t => t.x === d.x && t.y === d.y))
                const choices = (prefer.length ? prefer : orbitMoves.length ? orbitMoves : allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player)))
                const pick = choices.length ? choices[Math.floor(Math.random() * choices.length)] : null
                if (pick) return { x: pick.x, y: pick.y }
            }
            const fallback = allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player))
            const choices = fallback.length ? fallback : allowed
            const pick = choices[Math.floor(Math.random() * choices.length)]
            return pick ? { x: pick.x, y: pick.y } : null
        }
    }

    if (state.huntMode && state.huntTargets && state.huntTargets.length && player.isAI) {
        let nearest = null
        let nearestDist = Infinity
        for (const id of state.huntTargets) {
            const t = state.players.find(p => p.playerId === id && !p.dead && p.pos)
            if (!t) continue
            const dist = Math.abs(t.pos.x - px) + Math.abs(t.pos.y - py)
            if (dist < nearestDist) {
                nearestDist = dist
                nearest = t
            }
        }
        if (nearest && nearest.pos) {
            const tx = nearest.pos.x
            const ty = nearest.pos.y
            let best = null
            let bestDist = Infinity
            for (const d of allowed) {
                const nx = px + d.x
                const ny = py + d.y
                if (isCellBlocked(state, nx, ny, player)) continue
                const dist = Math.abs(nx - tx) + Math.abs(ny - ty)
                if (dist < bestDist) {
                    bestDist = dist
                    best = d
                }
            }
            if (best) return { x: best.x, y: best.y }
            const fallback = allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player))
            const choices = fallback.length ? fallback : allowed
            const pick = choices[Math.floor(Math.random() * choices.length)]
            return pick ? { x: pick.x, y: pick.y } : null
        }
    }

    const level = player.aiModeEnabled ? 3 : (player.aiLevel || 1)
    const foodList = state.foodList || []
    if (level === 1) {
        const safeAllowed = allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player))
        const choices = safeAllowed.length ? safeAllowed : allowed
        const bounty = state.bountyPlayerId != null ? state.players.find(p => p.playerId === state.bountyPlayerId && !p.dead && p.pos) : null
        if (bounty && bounty.playerId !== player.playerId && Math.random() < 0.4) {
            const distToBounty = Math.abs(bounty.pos.x - px) + Math.abs(bounty.pos.y - py)
            if (distToBounty < 45) {
                let bestDir = null
                let bestDist = Infinity
                for (const d of choices) {
                    const nx = px + d.x
                    const ny = py + d.y
                    const d2 = Math.abs(nx - bounty.pos.x) + Math.abs(ny - bounty.pos.y)
                    if (d2 < bestDist) {
                        bestDist = d2
                        bestDir = d
                    }
                }
                if (bestDir) return { x: bestDir.x, y: bestDir.y }
            }
        }
        if (foodList.length > 0 && Math.random() < 0.35) {
            let nearestDist = Infinity
            let bestDir = null
            for (const d of choices) {
                const nx = px + d.x
                const ny = py + d.y
                let minDist = Infinity
                for (const f of foodList) {
                    const dist = Math.abs(f.x - nx) + Math.abs(f.y - ny)
                    if (dist < minDist) minDist = dist
                }
                if (minDist < nearestDist) {
                    nearestDist = minDist
                    bestDir = d
                }
            }
            if (bestDir) return { x: bestDir.x, y: bestDir.y }
        }
        const pick = choices[Math.floor(Math.random() * choices.length)]
        return pick ? { x: pick.x, y: pick.y } : { x: allowed[0].x, y: allowed[0].y }
    }

    const safeAllowed = allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player))
    const choices = safeAllowed.length ? safeAllowed : allowed

    if (level === 2) {
        const bounty = state.bountyPlayerId != null ? state.players.find(p => p.playerId === state.bountyPlayerId && !p.dead && p.pos) : null
        let best = null
        let bestScore = Infinity
        for (const d of choices) {
            const nx = px + d.x
            const ny = py + d.y
            const foodScore = aiScoreFoodTarget(nx, ny, foodList)
            const edge = aiEdgePenalty(nx, ny)
            const exits = aiCountSafeExits(state, nx, ny, player)
            let secondExits = 0
            for (const d2 of DIRECTIONS) {
                if (isCellBlocked(state, nx + d2.x, ny + d2.y, player)) continue
                secondExits++
            }
            let score = foodScore + edge - exits * 3 - secondExits * 1.5 - feedBias
            if (bounty && bounty.playerId !== player.playerId) {
                const distToBounty = Math.abs(bounty.pos.x - nx) + Math.abs(bounty.pos.y - ny)
                if (distToBounty < 35) score -= (35 - distToBounty) * 0.8 + attackBias
            }
            if (score < bestScore) {
                bestScore = score
                best = d
            }
        }
        if (best) return { x: best.x, y: best.y }
        return choices[0] ? { x: choices[0].x, y: choices[0].y } : { x: allowed[0].x, y: allowed[0].y }
    }

    if (level === 3) {
        const myLen = (player.snake && player.snake.length) || 0
        const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
        const hasStar = (player.starUntil || 0) > Date.now()

        let fleeFrom = null
        if (!hasStar && alive.length > 0) {
            let biggest = null
            let biggestLen = myLen
            for (const other of alive) {
                const len = (other.snake && other.snake.length) || 0
                if (len <= biggestLen) continue
                const dist = Math.abs(other.pos.x - px) + Math.abs(other.pos.y - py)
                if (dist > 20) continue
                if (len > biggestLen) {
                    biggestLen = len
                    biggest = other
                }
            }
            if (biggest && biggestLen >= myLen + 15) {
                fleeFrom = biggest.pos
            }
        }

        if (fleeFrom) {
            let best = null
            let bestScore = -Infinity
            for (const d of choices) {
                const nx = px + d.x
                const ny = py + d.y
                const dist = Math.abs(nx - fleeFrom.x) + Math.abs(ny - fleeFrom.y)
                const exits = aiCountSafeExits(state, nx, ny, player)
                const score = dist + exits * 2 + dodgeBias
                if (score > bestScore) {
                    bestScore = score
                    best = d
                }
            }
            if (best) return { x: best.x, y: best.y }
        }

        const bountyId = state.bountyPlayerId
        let huntTarget = null
        let huntScore = -Infinity
        if (myLen >= 30) {
            for (const other of alive) {
                if (!other.vel || (!other.vel.x && !other.vel.y)) continue
                const otherLen = (other.snake && other.snake.length) || 0
                const isBounty = other.playerId === bountyId
                if (!isBounty && otherLen >= myLen - 5) continue
                if (isBounty && otherLen >= myLen - 2) continue
                const nextX = other.pos.x + other.vel.x * 2
                const nextY = other.pos.y + other.vel.y * 2
                const dist = Math.abs(nextX - px) + Math.abs(nextY - py)
                if (dist > 16) continue
                let score = 100 - dist + attackBias
                if (isBounty) score += 60
                if (score > huntScore) {
                    huntScore = score
                    huntTarget = { x: nextX, y: nextY }
                }
            }
        }
        if (huntTarget) {
            let best = null
            let bestDist = Infinity
            for (const d of choices) {
                const nx = px + d.x
                const ny = py + d.y
                if (isCellBlocked(state, nx, ny, player)) continue
                const dist = Math.abs(nx - huntTarget.x) + Math.abs(ny - huntTarget.y)
                if (dist < bestDist) {
                    bestDist = dist
                    best = d
                }
            }
            if (best) return { x: best.x, y: best.y }
        }

        let best = null
        let bestScore = Infinity
        for (const d of choices) {
            const nx = px + d.x
            const ny = py + d.y
            const foodScore = aiScoreFoodTarget(nx, ny, foodList)
            const edge = aiEdgePenalty(nx, ny)
            const exits = aiCountSafeExits(state, nx, ny, player)
            const score = foodScore + edge - exits * 3 - feedBias
            if (score < bestScore) {
                bestScore = score
                best = d
            }
        }
        if (best) return { x: best.x, y: best.y }
        return choices[0] ? { x: choices[0].x, y: choices[0].y } : { x: allowed[0].x, y: allowed[0].y }
    }

    if (level === 4) {
        const safeAllowed = allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player))
        const choices = safeAllowed.length ? safeAllowed : allowed
        const myLen = (player.snake && player.snake.length) || 0
        const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
        const hasStar = (player.starUntil || 0) > Date.now()

        let fleeFrom = null
        if (!hasStar && alive.length > 0) {
            let biggest = null
            let biggestLen = myLen
            for (const other of alive) {
                const len = (other.snake && other.snake.length) || 0
                if (len <= biggestLen) continue
                const dist = Math.abs(other.pos.x - px) + Math.abs(other.pos.y - py)
                if (dist > 18) continue
                if (len > biggestLen) {
                    biggestLen = len
                    biggest = other
                }
            }
            if (biggest && biggestLen >= myLen + 12) {
                fleeFrom = biggest.pos
            }
        }

        if (fleeFrom) {
            let best = null
            let bestScore = -Infinity
            for (const d of choices) {
                const nx = px + d.x
                const ny = py + d.y
                if (isCellBlocked(state, nx, ny, player)) continue
                const dist = Math.abs(nx - fleeFrom.x) + Math.abs(ny - fleeFrom.y)
                const exits = aiCountSafeExits(state, nx, ny, player)
                const deadEndPenalty = exits === 0 ? 500 : (exits === 1 ? 40 : 0)
                const score = dist + exits * 3 - deadEndPenalty
                if (score > bestScore) {
                    bestScore = score
                    best = d
                }
            }
            if (best) return { x: best.x, y: best.y }
        }

        const bountyId = state.bountyPlayerId
        let huntTarget = null
        let huntScore = -Infinity
        if (myLen >= 40) {
            for (const other of alive) {
                if (!other.vel || (!other.vel.x && !other.vel.y)) continue
                const otherLen = (other.snake && other.snake.length) || 0
                const isBounty = other.playerId === bountyId
                if (!isBounty && otherLen >= myLen - 6) continue
                if (isBounty && otherLen >= myLen - 3) continue
                const nextX = other.pos.x + other.vel.x * 2
                const nextY = other.pos.y + other.vel.y * 2
                const dist = Math.abs(nextX - px) + Math.abs(nextY - py)
                if (dist > 14) continue
                let score = 100 - dist
                if (isBounty) score += 50
                if (score > huntScore) {
                    huntScore = score
                    huntTarget = { x: nextX, y: nextY }
                }
            }
        }
        if (huntTarget) {
            let best = null
            let bestDist = Infinity
            for (const d of choices) {
                const nx = px + d.x
                const ny = py + d.y
                if (isCellBlocked(state, nx, ny, player)) continue
                const exits = aiCountSafeExits(state, nx, ny, player)
                if (exits === 0) continue
                const dist = Math.abs(nx - huntTarget.x) + Math.abs(ny - huntTarget.y)
                if (dist < bestDist) {
                    bestDist = dist
                    best = d
                }
            }
            if (best) return { x: best.x, y: best.y }
        }

        let best = null
        let bestScore = Infinity
        for (const d of choices) {
            const nx = px + d.x
            const ny = py + d.y
            const exits = aiCountSafeExits(state, nx, ny, player)
            const deadEndPenalty = exits === 0 ? 500 : (exits === 1 ? 50 : 0)
            const foodScore = aiScoreFoodTarget(nx, ny, foodList)
            const edge = aiEdgePenalty(nx, ny)
            const score = foodScore + edge - exits * 4 + deadEndPenalty
            if (score < bestScore) {
                bestScore = score
                best = d
            }
        }
        if (best) return { x: best.x, y: best.y }
        return choices[0] ? { x: choices[0].x, y: choices[0].y } : { x: allowed[0].x, y: allowed[0].y }
    }

    if (level === 5) {
        const occ = getOccupancy(player)
        const safeFromBlock = allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player))
        const safeFromFire = safeFromBlock.filter(d => !isInFireZone(state, px + d.x, py + d.y, occ))
        const choices = safeFromFire.length ? safeFromFire : safeFromBlock.length ? safeFromBlock : allowed
        const myLen = (player.snake && player.snake.length) || 0
        const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
        const hasStar = (player.starUntil || 0) > Date.now()
        const bountyId = state.bountyPlayerId
        const nearWin = myLen >= WIN_TARGET - 25

        let fleeFrom = null
        if (!hasStar && alive.length > 0) {
            for (const other of alive) {
                const len = (other.snake && other.snake.length) || 0
                if (len <= myLen + 10) continue
                const dist = Math.abs(other.pos.x - px) + Math.abs(other.pos.y - py)
                if (dist > 18) continue
                if (!fleeFrom || len > (fleeFrom.len || 0)) fleeFrom = { x: other.pos.x, y: other.pos.y, len }
            }
        }

        if (fleeFrom) {
            let best = null
            let bestScore = -Infinity
            for (const d of choices) {
                const nx = px + d.x
                const ny = py + d.y
                if (isCellBlocked(state, nx, ny, player) || isInFireZone(state, nx, ny, occ)) continue
                const dist = Math.abs(nx - fleeFrom.x) + Math.abs(ny - fleeFrom.y)
                const exits = aiCountSafeExits(state, nx, ny, player)
                const deadEndPenalty = exits === 0 ? 999 : (exits === 1 ? 120 : 0)
                const score = dist + exits * 5 - deadEndPenalty
                if (score > bestScore) {
                    bestScore = score
                    best = d
                }
            }
            if (best) {
                if (Math.random() < 0.012) {
                    const pick = choices[Math.floor(Math.random() * choices.length)]
                    return pick ? { x: pick.x, y: pick.y } : { x: best.x, y: best.y }
                }
                return { x: best.x, y: best.y }
            }
        }

        let huntTarget = null
        let huntScore = -Infinity
        if (myLen >= 50 || nearWin) {
            for (const other of alive) {
                if (!other.vel || (!other.vel.x && !other.vel.y)) continue
                const otherLen = (other.snake && other.snake.length) || 0
                const isBounty = other.playerId === bountyId
                if (!isBounty && otherLen >= myLen - 6) continue
                if (isBounty && otherLen >= myLen - 4) continue
                const nextX = other.pos.x + other.vel.x * 2
                const nextY = other.pos.y + other.vel.y * 2
                const dist = Math.abs(nextX - px) + Math.abs(nextY - py)
                if (dist > 12) continue
                let score = 120 - dist
                if (isBounty) score += 80
                if (nearWin) score += 40
                if (score > huntScore) {
                    huntScore = score
                    huntTarget = { x: nextX, y: nextY }
                }
            }
        }
        if (huntTarget) {
            let best = null
            let bestDist = Infinity
            for (const d of choices) {
                const nx = px + d.x
                const ny = py + d.y
                if (isCellBlocked(state, nx, ny, player) || isInFireZone(state, nx, ny, occ)) continue
                const exits = aiCountSafeExits(state, nx, ny, player)
                if (exits === 0) continue
                const dist = Math.abs(nx - huntTarget.x) + Math.abs(ny - huntTarget.y)
                if (dist < bestDist) {
                    bestDist = dist
                    best = d
                }
            }
            if (best) {
                if (Math.random() < 0.015) {
                    const pick = choices[Math.floor(Math.random() * choices.length)]
                    return pick ? { x: pick.x, y: pick.y } : { x: best.x, y: best.y }
                }
                return { x: best.x, y: best.y }
            }
        }

        let bestDir = null
        let bestScore = Infinity
        for (const d of choices) {
            const nx = px + d.x
            const ny = py + d.y
            if (isCellBlocked(state, nx, ny, player) || isInFireZone(state, nx, ny, occ)) continue
            const exits = aiCountSafeExits(state, nx, ny, player)
            const deadEndPenalty = exits === 0 ? 500 : (exits === 1 ? 50 : 0)
            const foodScore = aiScoreFoodTarget(nx, ny, foodList)
            const edge = aiEdgePenalty(nx, ny)
            let score = foodScore + edge - exits * 4 + deadEndPenalty
            if (nearWin && foodList.length > 0) {
                for (const f of foodList) {
                    if (POWER_UP_FOOD_TYPES.indexOf(f.foodType) < 0) continue
                    const d2 = Math.abs(f.x - nx) + Math.abs(f.y - ny)
                    if (d2 < 20) score -= 25
                }
            }
            if (score < bestScore) {
                bestScore = score
                bestDir = d
            }
        }
        if (bestDir) {
            if (Math.random() < 0.015) {
                const rand = choices.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player) && !isInFireZone(state, px + d.x, py + d.y, occ))
                const pick = (rand.length ? rand : choices)[Math.floor(Math.random() * (rand.length || choices.length))]
                return pick ? { x: pick.x, y: pick.y } : { x: bestDir.x, y: bestDir.y }
            }
            return { x: bestDir.x, y: bestDir.y }
        }
        const fallback = choices[0] || safeFromBlock[0] || allowed[0]
        return fallback ? { x: fallback.x, y: fallback.y } : { x: allowed[0].x, y: allowed[0].y }
    }

    return { x: allowed[0].x, y: allowed[0].y }
}

function setAIBoost(state, player) {
    if (!player.isAI || !(player.vel.x || player.vel.y)) {
        player.boostHeld = false
        return
    }
    const myLen = (player.snake && player.snake.length) || 0
    const px = player.pos.x
    const py = player.pos.y
    const vx = player.vel.x
    const vy = player.vel.y
    const level = player.aiModeEnabled ? 3 : (player.aiLevel || 1)
    const minLenToBoost = MIN_SNAKE_LENGTH + 5

    if (myLen <= minLenToBoost) {
        player.boostHeld = false
        return
    }

    if (level === 1) {
        player.boostHeld = myLen > MIN_SNAKE_LENGTH + 10 && Math.random() < 0.12
        return
    }

    if (level === 2) {
        const foodList = state.foodList || []
        let foodAhead = false
        let closestFoodDist = Infinity
        for (const f of foodList) {
            const dx = f.x - px
            const dy = f.y - py
            const dist = Math.abs(dx) + Math.abs(dy)
            if (dist > 18) continue
            const inDir = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
            if (inDir && dist < 14) {
                foodAhead = true
                if (dist < closestFoodDist) closestFoodDist = dist
            }
        }
        const bounty = state.bountyPlayerId != null ? state.players.find(p => p.playerId === state.bountyPlayerId && !p.dead && p.pos) : null
        let bountyAhead = false
        if (bounty && bounty.playerId !== player.playerId) {
            const dx = bounty.pos.x - px
            const dy = bounty.pos.y - py
            const dist = Math.abs(dx) + Math.abs(dy)
            const inDir = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
            bountyAhead = inDir && dist < 18 && dist > 2
        }
        player.boostHeld = (foodAhead && closestFoodDist < 10) || bountyAhead
        return
    }

    if (level === 3) {
        const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
        const foodList = state.foodList || []
        const bountyId = state.bountyPlayerId

        let shouldBoost = false
        for (const other of alive) {
            const len = (other.snake && other.snake.length) || 0
            const dist = Math.abs(other.pos.x - px) + Math.abs(other.pos.y - py)
            const isBounty = other.playerId === bountyId
            if (len >= myLen + 12 && dist < 18) {
                const dx = px - other.pos.x
                const dy = py - other.pos.y
                const away = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
                if (away) shouldBoost = true
            }
            if (len <= myLen - 5 && dist < 22) {
                const dx = other.pos.x - px
                const dy = other.pos.y - py
                const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
                if (toward) shouldBoost = true
            }
            if (isBounty && len <= myLen + 4 && dist < 25) {
                const dx = other.pos.x - px
                const dy = other.pos.y - py
                const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
                if (toward) shouldBoost = true
            }
        }
        for (const f of foodList) {
            if (POWER_UP_FOOD_TYPES.indexOf(f.foodType) < 0) continue
            const dist = Math.abs(f.x - px) + Math.abs(f.y - py)
            if (dist > 16) continue
            const dx = f.x - px
            const dy = f.y - py
            const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
            if (toward) shouldBoost = true
        }
        player.boostHeld = shouldBoost
    }

    if (level === 4) {
        const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
        const foodList = state.foodList || []
        const bountyId = state.bountyPlayerId

        let shouldBoost = false
        for (const other of alive) {
            const len = (other.snake && other.snake.length) || 0
            const dist = Math.abs(other.pos.x - px) + Math.abs(other.pos.y - py)
            const isBounty = other.playerId === bountyId
            if (len >= myLen + 10 && dist < 16) {
                const dx = px - other.pos.x
                const dy = py - other.pos.y
                const away = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
                if (away) shouldBoost = true
            }
            if (len <= myLen - 4 && dist < 20) {
                const dx = other.pos.x - px
                const dy = other.pos.y - py
                const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
                if (toward) shouldBoost = true
            }
            if (isBounty && len <= myLen + 3 && dist < 22) {
                const dx = other.pos.x - px
                const dy = other.pos.y - py
                const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
                if (toward) shouldBoost = true
            }
        }
        for (const f of foodList) {
            if (POWER_UP_FOOD_TYPES.indexOf(f.foodType) < 0) continue
            const dist = Math.abs(f.x - px) + Math.abs(f.y - py)
            if (dist > 14) continue
            const dx = f.x - px
            const dy = f.y - py
            const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
            if (toward) shouldBoost = true
        }
        player.boostHeld = shouldBoost
    }

    if (level === 5) {
        const occ = getOccupancy(player)
        const nx = px + (vx || 0)
        const ny = py + (vy || 0)
        const inFire = isInFireZone(state, nx, ny, occ)
        const exits = aiCountSafeExits(state, nx, ny, player)
        if (inFire || exits === 0) {
            player.boostHeld = false
            return
        }
        const foodList = state.foodList || []
        const bountyId = state.bountyPlayerId
        const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
        const nearWin = myLen >= WIN_TARGET - 30
        let shouldBoost = false
        for (const f of foodList) {
            const dist = Math.abs(f.x - px) + Math.abs(f.y - py)
            if (dist > 20) continue
            const dx = f.x - px
            const dy = f.y - py
            const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
            if (toward && (nearWin || POWER_UP_FOOD_TYPES.indexOf(f.foodType) >= 0 || dist < 12)) shouldBoost = true
        }
        if (bountyId && alive.length > 0) {
            const bounty = alive.find(p => p.playerId === bountyId)
            if (bounty) {
                const dist = Math.abs(bounty.pos.x - px) + Math.abs(bounty.pos.y - py)
                const dx = bounty.pos.x - px
                const dy = bounty.pos.y - py
                const toward = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
                if (toward && dist < 22 && (bounty.snake && bounty.snake.length) <= myLen + 3) shouldBoost = true
            }
        }
        for (const other of alive) {
            const len = (other.snake && other.snake.length) || 0
            if (len <= myLen + 4) continue
            const dist = Math.abs(other.pos.x - px) + Math.abs(other.pos.y - py)
            if (dist > 18) continue
            const dx = px - other.pos.x
            const dy = py - other.pos.y
            const away = (vx && (dx * vx > 0)) || (vy && (dy * vy > 0))
            if (away) shouldBoost = true
        }
        player.boostHeld = shouldBoost && (exits >= 1)
    }
}

function getUpdatedVelocity(previousVel, keyCode) {
    switch(keyCode) {
        case 37: // left (arrow)
        case 65: // A (WASD)
            return (previousVel.x !== 1) ? { x: -1, y: 0 } : { x: 1, y: 0 }
        case 38: // up (arrow)
        case 87: // W (WASD)
            return (previousVel.y !== 1) ? { x: 0, y: -1 } : { x: 0, y: 1 }
        case 39: // right (arrow)
        case 68: // D (WASD)
            return (previousVel.x !== -1) ? { x: 1, y: 0 } : { x: -1, y: 0 }
        case 40: // down (arrow)
        case 83: // S (WASD)
            return (previousVel.y !== -1) ? { x: 0, y: 1 } : { x: 0, y: -1 }
    }
}