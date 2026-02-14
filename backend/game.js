const { GRID_SIZE, FOOD_TYPES, PORTAL_SPAWN_CHANCE, STAR_DURATION_MS, SPEED_DURATION_MS, SPEED_BOOST_FACTOR } = require('./constants')

module.exports = {
    initGame,
    gameLoop,
    getUpdatedVelocity,
    addPlayerToGame,
    getRandomSpawn
}

function createPlayer(playerId, nickName, spawn) {
    const { x, y } = spawn
    return {
        playerId,
        nickName: nickName || null,
        color: null,
        dead: false,
        starUntil: 0,
        speedUntil: 0,
        pos: { x, y },
        vel: { x: 0, y: 0 },
        snake: [
            { x: x - 2, y },
            { x: x - 1, y },
            { x, y }
        ]
    }
}

function getRandomSpawn(state) {
    const maxAttempts = 500
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = 3 + Math.floor(Math.random() * (GRID_SIZE - 6))
        const y = 3 + Math.floor(Math.random() * (GRID_SIZE - 6))
        let occupied = false
        for (const player of (state.players || [])) {
            if (player.dead) continue
            for (const cell of player.snake) {
                if (cell.x === x && cell.y === y) { occupied = true; break }
            }
            if (occupied) break
        }
        if (occupied) continue
        for (const food of (state.foodList || [])) {
            if (food.x === x && food.y === y) { occupied = true; break }
        }
        if (occupied) continue
        for (const portal of (state.portals || [])) {
            if ((portal.a.x === x && portal.a.y === y) || (portal.b.x === x && portal.b.y === y)) {
                occupied = true
                break
            }
        }
        if (occupied) continue
        return { x, y }
    }
    return { x: 10, y: 10 }
}

function addPlayerToGame(state, playerId, nickName) {
    const spawn = getRandomSpawn(state)
    const player = createPlayer(playerId, nickName, spawn)
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
    state.portals.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } })
}

function initGame(nickName) {
    const spawn = getRandomSpawn({ players: [], foodList: [], portals: [] })
    const state = {
        players: [createPlayer(1, nickName, spawn)],
        foodList: [],
        portals: [],
        gridSize: GRID_SIZE
    }
    randomFood(state)
    return state
}

function gameLoop(state) {
    if(!state) {
        return false
    }

    const now = Date.now()
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        player.pos.x += player.vel.x
        player.pos.y += player.vel.y
        if (player.speedUntil > now && (player.vel.x || player.vel.y)) {
            player.pos.x += Math.round(player.vel.x * SPEED_BOOST_FACTOR)
            player.pos.y += Math.round(player.vel.y * SPEED_BOOST_FACTOR)
        }
    }

    return processPlayerSnakes(state)
}

function respawn(state, player) {
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
}

function processPlayerSnakes(state) {
    const alive = state.players.filter(p => !p.dead)

    for (const player of alive) {
        player.justRespawned = false
    }

    for (const player of alive) {
        if (player.pos.x < 0 || player.pos.x > GRID_SIZE || player.pos.y < 0 || player.pos.y > GRID_SIZE) {
            if (player.starUntil <= Date.now()) respawn(state, player)
            continue
        }

        for (const portal of (state.portals || [])) {
            if (player.pos.x === portal.a.x && player.pos.y === portal.a.y) {
                player.pos.x = portal.b.x
                player.pos.y = portal.b.y
                break
            }
            if (player.pos.x === portal.b.x && player.pos.y === portal.b.y) {
                player.pos.x = portal.a.x
                player.pos.y = portal.a.y
                break
            }
        }

        for (let i = 0; i < state.foodList.length; i++) {
            const food = state.foodList[i]
            if (food.x === player.pos.x && food.y === player.pos.y) {
                switch (food.foodType) {
                    case FOOD_TYPES[2]:
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.snake.push({ ...player.pos })
                        player.snake.push({ ...player.pos })
                        player.snake.push({ ...player.pos })
                        player.pos.x += player.vel.x
                        player.pos.y += player.vel.y
                        break
                    case FOOD_TYPES[0]:
                        state.foodList.splice(i, 1)
                        randomFood(state)
                        player.snake.push({ ...player.pos })
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
                            respawn(state, player)
                            died = true
                            break
                        }
                    }
                    if (died) break
                }
            }
            if (!died && !player.justRespawned) {
                player.snake.push({ ...player.pos })
                player.snake.shift()
            }
        }
    }

    let genRandomFood = Math.random() * 100
    if (genRandomFood <= 6) randomFood(state)

    if (Math.random() < PORTAL_SPAWN_CHANCE) addPortalPair(state)

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
    if (randomNumber < 5) return 'SPEED'
    if (randomNumber >= 51) return FOOD_TYPES[0]
    if (randomNumber >= 21) return FOOD_TYPES[1]
    if (randomNumber >= 5) return FOOD_TYPES[2]
    if (randomNumber >= 1) return FOOD_TYPES[3]
}

function getUpdatedVelocity(previousVel, keyCode) {
    switch(keyCode) {
        case 37: // left
            return (previousVel.x !== 1) ? { x: -1, y: 0 } : { x: 1, y: 0 }
            break
        case 38: // down
            return (previousVel.y !== 1) ? { x: 0, y: -1 } : { x: 0, y: 1 }
            break
        case 39: // right
            return (previousVel.x !== -1) ? { x: 1, y: 0 } : { x: -1, y: 0 }
            break
        case 40: // left
            return (previousVel.y !== -1) ? { x: 0, y: 1 } : { x: 0, y: -1 }
            break                        
    }
}