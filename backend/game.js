const { GRID_SIZE, FOOD_TYPES } = require('./constants')

module.exports = {
    initGame,
    gameLoop,
    getUpdatedVelocity
}

function initGame() {
    const state = createGameState()
    randomFood(state)
    return state
}

function createGameState() {
    return {
        players: [{
            playerId: 1,
            pos: {
                x: 3,
                y: 5,
            },
            vel: {
                x: 1,
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
            pos: {
                x: 18,
                y: 15,
            },
            vel: {
                x: -1,
                y: 0
            },
            snake: [
                {x: 20, y: 15},
                {x: 19, y: 15},
                {x: 18, y: 15},
            ]
        }],
        food: {},
        gridSize: GRID_SIZE
    }
}

function gameLoop(state) {
    if(!state) {
        return
    }

    // const playerOne = state.players[0]
    // const playerTwo = state.players[1]

    // playerTwo.pos.x += playerTwo.vel.x
    // playerTwo.pos.y += playerTwo.vel.y

    for(let player of state.players) {
        player.pos.x += player.vel.x
        player.pos.y += player.vel.y        
    }

    // console.log(playerOne)
    // console.log(playerTwo)

    // let winner

    // if(playerOne.pos.x < 0 || playerOne.pos.x > GRID_SIZE || playerOne.pos.y < 0 ||playerOne.pos.y > GRID_SIZE) {
    //     return 2
    // }

    // if(playerTwo.pos.x < 0 || playerTwo.pos.x > GRID_SIZE || playerTwo.pos.y < 0 ||playerTwo.pos.y > GRID_SIZE) {
    //     return 1
    // }

    // if(state.food.x === playerOne.pos.x && state.food.y === playerOne.pos.y) {
    //     playerOne.snake.push({...playerOne.pos})
    //     playerOne.pos.x += playerOne.vel.x
    //     playerOne.pos.y += playerOne.vel.y
    //     randomFood(state)
    // }

    // if(state.food.x === playerTwo.pos.x && state.food.y === playerTwo.pos.y) {
    //     playerTwo.snake.push({...playerTwo.pos})
    //     playerTwo.pos.x += playerTwo.vel.x
    //     playerTwo.pos.y += playerTwo.vel.y
    //     randomFood(state)
    // }

    // if(playerOne.vel.x || playerOne.vel.y) {
    //     for(let cell of playerOne.snake) {
    //         if(cell.x === playerOne.pos.x && cell.y === playerOne.pos.y) {
    //             return 2
    //         }
    //     }
    //     playerOne.snake.push({...playerOne.pos})
    //     playerOne.snake.shift()
    // }

    // if(playerTwo.vel.x || playerTwo.vel.y) {
    //     for(let cell of playerTwo.snake) {
    //         if(cell.x === playerTwo.pos.x && cell.y === playerTwo.pos.y) {
    //             return 2
    //         }
    //     }
    //     playerTwo.snake.push({...playerTwo.pos})
    //     playerTwo.snake.shift()
    // }
    
    return processPlayerSnakes(state)
}

function processPlayerSnakes(state) {
    console.log(state)
    console.log(state.players)
    for(let player of state.players) {
        if(player.pos.x < 0 || player.pos.x > GRID_SIZE || player.pos.y < 0 ||player.pos.y > GRID_SIZE) {
            console.log("one")
            console.log(player.playerId)
            return player.playerId 
        }
    
        if(state.food.x === player.pos.x && state.food.y === player.pos.y) {
            switch(state.food.foodType) {
                case FOOD_TYPES[2]:
                    player.snake.push({...player.pos})
                    player.snake.push({...player.pos})
                case FOOD_TYPES[0]:
                    player.snake.push({...player.pos})
                    player.pos.x += player.vel.x
                    player.pos.y += player.vel.y        
                    break;
                case FOOD_TYPES[1]:
                    player.snake.shift({...player.pos})
                    break;

            }
            randomFood(state)
        }
    
        if(player.vel.x || player.vel.y) {
            for(let p of state.players){ 
                for(let cell of p.snake) {
                    if(cell.x === player.pos.x && cell.y === player.pos.y) {
                        console.log("two")
                        console.log(player.playerId)
                        return player.playerId
                    }
                }
            }
            player.snake.push({...player.pos})
            player.snake.shift()
        }
    }
    return false
}

function randomFood(state) {
    food = {
        foodType: foodType(),
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
    }

    for(let cell of state.players[0].snake) {
        if(cell.x === food.x && cell.y === food.y) {
            return randomFood(state)
        }
    }

    for(let cell of state.players[1].snake) {
        if(cell.x === food.x && cell.y === food.y) {
            return randomFood(state)
        }
    }

    state.food = food
}

function foodType() {
    let randomNumber = Math.floor(Math.random() * 100)
    if(randomNumber >= 51) return FOOD_TYPES[0]
    if(randomNumber >= 21) return FOOD_TYPES[1]
    if(randomNumber >= 1) return FOOD_TYPES[2]
}

function getUpdatedVelocity(keyCode) {
    switch(keyCode) {
        case 37: // left
            return { x: -1, y: 0 }
            break
        case 38: // down
            return { x: 0, y: -1 }
            break
        case 39: // right
            return { x: 1, y: 0 }
            break
        case 40: // left
            return { x: 0, y: 1 }
            break                        
    }
}