const { GRID_SIZE, FOOD_TYPES } = require('./constants')

module.exports = {
    initGame,
    gameLoop,
    getUpdatedVelocity
}

function initGame(nickName) {
    const state = createGameState(nickName)
    randomFood(state)
    return state
}

function createGameState(nickName) {
    return {
        players: [{
            playerId: 1,
            nickName: nickName,
            color: null,
            pos: {
                x: 0,
                y: 0,
            },
            vel: {
                x: 0,
                y: 0
            },
            snake: [
                {x: 1, y: 5},
                {x: 2, y: 5},
                {x: 3, y: 5},
            ]
        },
        {
            playerId: 2,
            nickName: null,
            color: null,
            pos: {
                x: 38,
                y: 35,
            },
            vel: {
                x: 0,
                y: 0
            },
            snake: [
                {x: 40, y: 35},
                {x: 39, y: 35},
                {x: 38, y: 35},
            ]
        }],
        foodList: [],
        gridSize: GRID_SIZE
    }
}

function gameLoop(state) {
    if(!state) {
        return
    }

    for(let player of state.players) {
        player.pos.x += player.vel.x
        player.pos.y += player.vel.y        
    }

    return processPlayerSnakes(state)
}

function processPlayerSnakes(state) {
    for(let player of state.players) {
        if(player.pos.x < 0 || player.pos.x > GRID_SIZE || player.pos.y < 0 ||player.pos.y > GRID_SIZE) {
            return player.playerId 
        }
    
        for(let food in state.foodList) {
            if(state.foodList[food].x === player.pos.x && state.foodList[food].y === player.pos.y) {



                switch(state.foodList[food].foodType) {
                    case FOOD_TYPES[2]:
                        state.foodList.splice(food, 1)                
                        randomFood(state)
                        player.snake.push({...player.pos})
                        player.snake.push({...player.pos})
                        player.snake.push({...player.pos})
                        player.pos.x += player.vel.x
                        player.pos.y += player.vel.y
                        break
                    case FOOD_TYPES[0]:
                        state.foodList.splice(food, 1)                
                        randomFood(state)
                        player.snake.push({...player.pos})
                        player.pos.x += player.vel.x
                        player.pos.y += player.vel.y
                        break
                    case FOOD_TYPES[1]:
                        state.foodList.splice(food, 1)                
                        randomFood(state)
                        player.snake.shift({...player.pos})
                        break
                    case FOOD_TYPES[3]:
                        state.foodList.splice(food, 1)                
                        for(let i = 0; i <= 10; i++) {
                            randomFood(state)
                        }
                        break
                }
                break
            }
        }
    
        if(player.vel.x || player.vel.y) {
            for(let p of state.players){ 
                for(let cell of p.snake) {
                    if(cell.x === player.pos.x && cell.y === player.pos.y) {
                        return player.playerId
                    }
                }
            }

            player.snake.push({...player.pos})
            player.snake.shift()
        }
    }

    let genRandomFood = Math.random() * 100
    if(genRandomFood <= 2.5)  randomFood(state)

    return false
}

function randomFood(state) {
    food = {
        foodType: generateFoodType(),
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
    }

    for(let player of state.players){
        for(let cell of player.snake) {
            if(cell.x === food.x && cell.y === food.y) {
                return randomFood(state)
            }
        }
    }

    for(let food2 of state.foodList) {
        if(food2.x === food.x && food2.y === food.y) {
            return randomFood(state)
        }
    }

    state.foodList.push(food)
}

function generateFoodType() {
    let randomNumber = Math.floor(Math.random() * 100)
    if(randomNumber >= 51) return FOOD_TYPES[0]
    if(randomNumber >= 21) return FOOD_TYPES[1]
    if(randomNumber >= 5) return FOOD_TYPES[2]
    if(randomNumber >= 1) return FOOD_TYPES[3]    
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