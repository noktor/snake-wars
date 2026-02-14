const { GRID_SIZE, WIN_TARGET, FOOD_TYPES, TARGET_FOOD_COUNT, INITIAL_FOOD_COUNT, REFILL_FOOD_PER_TICK, PORTAL_SPAWN_CHANCE, PORTAL_MAX_ENTRIES, PORTAL_MAX_AGE_MS, STAR_DURATION_MS, SPEED_DURATION_MS, SPEED_BOOST_FACTOR, MAGNET_DURATION_MS, MAGNET_PULL_PER_TICK, MAGNET_RANGE, FART_RADIUS, BOUNTY_BONUS_LENGTH, FEED_STREAK_WINDOW_MS, FEED_STREAK_MIN, STREAK_SPEED_DURATION_MS, STREAK_SPEED_BOOST_FACTOR, BIG_DURATION_MS, AI_COUNT, AI_ID_BASE, FREEZE_AI_RANGE, FREEZE_AI_DURATION_MS } = require('./constants')
const { getCatalanName } = require('./catalanNames')

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
                const butt = player.snake[0]
                player.pos.x = newHead.x
                player.pos.y = newHead.y
                let dx = butt.x - newHead.x
                let dy = butt.y - newHead.y
                if (dx !== 0 || dy !== 0) {
                    player.vel.x = dx !== 0 ? (dx > 0 ? 1 : -1) : 0
                    player.vel.y = dy !== 0 ? (dy > 0 ? 1 : -1) : 0
                }
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
    applyPower,
    freezeNearbyAI,
    spawnMoreAI,
    removeAIPlayers
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
        feedTimes: []
    }
}

function isCellOccupied(state, cx, cy) {
    for (const player of (state.players || [])) {
        if (player.dead) continue
        for (const cell of player.snake) {
            if (cell.x === cx && cell.y === cy) return true
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
        for (const cell of player.snake) {
            if (cell.x === nx && cell.y === ny) return false
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
        huntTargets: []
    }
    for (let i = 0; i < INITIAL_FOOD_COUNT; i++) randomFood(state)
    addAIPlayers(state)
    return state
}

function addAIPlayers(state) {
    for (let i = 0; i < AI_COUNT; i++) {
        const spawn = getRandomSpawn(state)
        const level = i < 12 ? 1 : (i < 22 ? 2 : 3)
        const ai = createPlayer(AI_ID_BASE + i, getCatalanName(i), spawn, { isAI: true, aiLevel: level })
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
    const aiCount = state.players.filter(p => p.isAI).length
    let added = 0
    for (let i = 0; i < n; i++) {
        const spawn = getRandomSpawn(state)
        if (!spawn) break
        const nextId = maxId + 1 + i
        const level = (aiCount + i) < 12 ? 1 : (aiCount + i) < 22 ? 2 : 3
        const ai = createPlayer(nextId, getCatalanName(aiCount + i), spawn, { isAI: true, aiLevel: level })
        state.players.push(ai)
        added++
    }
    return added
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

function gameLoop(state) {
    if(!state) {
        return false
    }

    const now = Date.now()
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        if (player.isAI && (player.frozenUntil || 0) <= now) {
            const aiVel = getAIVelocity(state, player)
            if (aiVel) player.vel = aiVel
        }
        if ((player.frozenUntil || 0) > now) continue
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

function respawn(state, player) {
    const wasBounty = state.bountyPlayerId === player.playerId
    const killerId = player.killedBy
    player.snake = []
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

function processPlayerSnakes(state) {
    const now = Date.now()
    const alive = state.players.filter(p => !p.dead)

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
        p.feedStreak = feedTimes.length >= FEED_STREAK_MIN
        if (p.feedStreak) p.streakSpeedUntil = now + STREAK_SPEED_DURATION_MS
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
                dropFoodFromCorpse(state, player.snake)
                respawn(state, player)
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

        const headBig = player.snake && player.snake.length && player.snake[player.snake.length - 1].big
        const headGrabDx = headBig ? [-1, 0, 1] : [0]
        const headGrabDy = headBig ? [-1, 0, 1] : [0]
        for (let i = 0; i < state.foodList.length; i++) {
            const food = state.foodList[i]
            let onHead = false
            for (const dx of headGrabDx) {
                for (const dy of headGrabDy) {
                    if (food.x === player.pos.x + dx && food.y === player.pos.y + dy) {
                        onHead = true
                        break
                    }
                }
                if (onHead) break
            }
            if (!onHead) continue
            {
                const feedNow = Date.now()
                if (!player.feedTimes) player.feedTimes = []
                player.feedTimes.push(feedNow)
                switch (food.foodType) {
                    case FOOD_TYPES[2]:
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.snake.push({ ...player.pos, big: (player.bigUntil || 0) > Date.now() })
                        player.snake.push({ ...player.pos, big: (player.bigUntil || 0) > Date.now() })
                        player.snake.push({ ...player.pos, big: (player.bigUntil || 0) > Date.now() })
                        player.pos.x += player.vel.x
                        player.pos.y += player.vel.y
                        break
                    case FOOD_TYPES[0]:
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.snake.push({ ...player.pos, big: (player.bigUntil || 0) > Date.now() })
                        player.pos.x += player.vel.x
                        player.pos.y += player.vel.y
                        break
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
                            const butt = player.snake[0]
                            player.pos.x = newHead.x
                            player.pos.y = newHead.y
                            let dx = butt.x - newHead.x
                            let dy = butt.y - newHead.y
                            if (dx !== 0 || dy !== 0) {
                                player.vel.x = dx !== 0 ? (dx > 0 ? 1 : -1) : 0
                                player.vel.y = dy !== 0 ? (dy > 0 ? 1 : -1) : 0
                            }
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

        if (player.vel.x || player.vel.y) {
            let died = false
            if (player.starUntil <= Date.now()) {
                for (const p of alive) {
                    for (const cell of p.snake) {
                        if (cell.x === player.pos.x && cell.y === player.pos.y) {
                            if (p !== player) player.killedBy = p.playerId
                            dropFoodFromCorpse(state, player.snake)
                            respawn(state, player)
                            died = true
                            break
                        }
                    }
                    if (died) break
                }
            }
            if (!died && !player.justRespawned) {
                player.snake.push({ ...player.pos, big: (player.bigUntil || 0) > Date.now() })
                player.snake.shift()
            }
        }
    }

    let genRandomFood = Math.random() * 100
    if (genRandomFood <= 6) randomFood(state)
    for (let i = 0; i < REFILL_FOOD_PER_TICK && (state.foodList || []).length < TARGET_FOOD_COUNT; i++) {
        randomFood(state)
    }

    if (Math.random() < PORTAL_SPAWN_CHANCE) addPortalPair(state)

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
        for (const cell of player.snake) {
            if (cell.x === food.x && cell.y === food.y) {
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
    if (randomNumber < 10) return 'BIG'
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
        for (let i = 0; i < snake.length; i++) {
            if (isSelf && i === 0) continue
            if (snake[i].x === nx && snake[i].y === ny) return true
        }
    }
    return false
}

function getAIVelocity(state, player) {
    const allowed = getAllowedVelocities(player.vel)
    const px = player.pos.x
    const py = player.pos.y

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

    const level = player.aiLevel || 1
    if (level === 1) {
        const pick = allowed[Math.floor(Math.random() * allowed.length)]
        return { x: pick.x, y: pick.y }
    }

    const safeAllowed = allowed.filter(d => !isCellBlocked(state, px + d.x, py + d.y, player))
    const choices = safeAllowed.length ? safeAllowed : allowed

    if (level === 2) {
        const foodList = state.foodList || []
        let best = null
        let bestDist = Infinity
        for (const d of choices) {
            const nx = px + d.x
            const ny = py + d.y
            let minDist = Infinity
            for (const f of foodList) {
                const dist = Math.abs(f.x - nx) + Math.abs(f.y - ny)
                if (dist < minDist) minDist = dist
            }
            if (minDist < bestDist) {
                bestDist = minDist
                best = d
            }
        }
        if (best) return { x: best.x, y: best.y }
        return { x: choices[0].x, y: choices[0].y }
    }

    if (level === 3) {
        const alive = state.players.filter(p => !p.dead && p.playerId !== player.playerId)
        let huntTarget = null
        let huntScore = -Infinity
        for (const other of alive) {
            if (!other.vel || (!other.vel.x && !other.vel.y)) continue
            const nextX = other.pos.x + other.vel.x
            const nextY = other.pos.y + other.vel.y
            const dist = Math.abs(nextX - px) + Math.abs(nextY - py)
            if (dist > 25) continue
            const score = 100 - dist
            if (score > huntScore) {
                huntScore = score
                huntTarget = { x: nextX, y: nextY }
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
        const foodList = state.foodList || []
        let best = null
        let bestDist = Infinity
        for (const d of choices) {
            const nx = px + d.x
            const ny = py + d.y
            let minDist = Infinity
            for (const f of foodList) {
                const dist = Math.abs(f.x - nx) + Math.abs(f.y - ny)
                if (dist < minDist) minDist = dist
            }
            if (minDist < bestDist) {
                bestDist = minDist
                best = d
            }
        }
        if (best) return { x: best.x, y: best.y }
        return { x: choices[0].x, y: choices[0].y }
    }

    return { x: allowed[0].x, y: allowed[0].y }
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