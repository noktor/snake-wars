const BG_COLOR      = '#231f20'
const SNAKE_COLOR   = '#c2c2c2'
const FOOD_COLOR    = '#e66916'
const FOOD_COLOR_POISON    = '#00FF00'
const FOOD_COLOR_SUPER    = '#0000FF'
const FOOD_COLOR_FRENZY    = '#FF0000'
const FOOD_TYPES = ['NORMAL', 'POISON', 'SUPER', 'FRENZY']

// Backend URL: SNAKE_WARS_BACKEND_URL (in index.html) must be set to your Railway URL when deployed on Netlify
const SOCKET_SERVER = (function () {
  let url = typeof window.SNAKE_WARS_BACKEND_URL === 'string' && window.SNAKE_WARS_BACKEND_URL
    ? window.SNAKE_WARS_BACKEND_URL.trim()
    : ''
  if (url === '__SNAKE_WARS_BACKEND_URL__') url = ''
  if (url && !/^https?:\/\//i.test(url)) url = 'http://' + url
  if (url) return url
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000'
  console.error('Snake Wars: Set SNAKE_WARS_BACKEND_URL in index.html to your Railway backend URL (e.g. https://your-app.up.railway.app)')
  return window.location.origin
})()
const socket = io(SOCKET_SERVER)

socket.on('init', handleInit)
socket.on('gameState', handleGameState)
socket.on('gameOver', handleGameOver)
socket.on('gameCode', handleGameCode)
socket.on('unknownGame', handleUnknownGame)
socket.on('tooManyPlayers', handleTooManyPlayers)
socket.on('scoreBoard', handleScoreBoard)
socket.on('loadGameList', handleLoadGameList)
socket.on('updateUserList', handleUpdateUserList)

const gameScreen = document.getElementById('gameScreen')
const initiateScreen = document.getElementById('initialScreen')
const newGameBtn = document.getElementById('newGameButton')
// const joinGameBtn = document.getElementById('joinGameButton')
const joinGameBtn2 = document.getElementById('joinGameButton2')
const gameCodeInput = document.getElementById('gameCodeInput')
const nickNameInput = document.getElementById('nickNameInput')
const gameCodeTitleDisplay = document.getElementById('gameCodeTitle')
const gameCodeDisplay = document.getElementById('gameCodeDisplay')
const pointsContainer = document.getElementById('pointsContainer')
const playerPoints = document.getElementById('playerPoints')
const enemyPoints = document.getElementById('enemyPoints')
const scoreBoardContainer = document.getElementById('scoreBoardContainer')
const errorMessage = document.getElementById('errorMessage')
const gameListContainer = document.getElementById('gameListContainer')
const gameListScreen = document.getElementById('gameListScreen')
const backButton = document.getElementById('backButton')
const userListDOM = document.getElementById('userList')

newGameBtn.addEventListener('click', newGame)
joinGameBtn2.addEventListener('click', showGameList)
backButton.addEventListener('click', returnHome)

function handleUpdateUserList(userList){
    console.log("user list")
    console.log(userList)
    userListDOM.innerHTML = ''
    for(let user of Object.keys(userList)) {
        console.log(user)
        console.log("USER!")
        if(userList[user].nickName){
            let userDOM = document.createElement('div')
            userDOM.innerText = userList[user].nickName
            userListDOM.appendChild(userDOM)
        }
    }
}

function returnHome(){
    initialScreen.style.display = 'block'
    gameListScreen.style.display = 'none'
    gameScreen.style.display = 'none'
    pointsContainer.style.display = 'none'    
}

function showGameList() {
    if(nickNameInput.value.length === 0) {
        errorMessage.innerText = 'Nickname can\'t be empty'
        return
    }
    errorMessage.innerText = ''
    initialScreen.style.display = 'none'
    gameListScreen.style.display = 'block'
    gameScreen.style.display = 'none'
    pointsContainer.style.display = 'none'

    console.log("REQUEST GAME LIST!!!")
    socket.emit('requestGameList')
    socket.emit('nickname', nickNameInput.value)
}

function newGame() {
    if(nickNameInput.value.length === 0) {
        errorMessage.innerText = 'Nickname can\'t be empty'
        return
    }
    errorMessage.innerText = ''
    socket.emit('newGame', nickNameInput.value)
    init()
}

function joinGame() {
    console.log(this.dataset.id)
    if(nickNameInput.value.length === 0) {
        errorMessage.innerText = 'Nickname can\'t be empty'
        return
    }
    const data = {
        gameCode: this.dataset.id,
        nickName: nickNameInput.value
    }
    errorMessage.innerText = ''
    socket.emit('joinGame', data)
    init()
}

let canvas, ctx
let playerNumber
let gameActive = false
let lastGameState = null

function init() {
    initialScreen.style.display = 'none'
    gameListScreen.style.display = 'none'
    gameScreen.style.display = 'block'
    pointsContainer.style.display = 'block'
    canvas = document.getElementById('canvas')
    ctx = canvas.getContext('2d')

    canvas.width = canvas.height = 600

    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    document.addEventListener('keydown', keydown)
    gameActive = true
}

function keydown(e) {
    console.log(e.keyCode)
    if(!gameActive) return
    socket.emit('keydown', e.keyCode)
}

function paintGame(state) {
    if(!ctx || !canvas || !state || !state.players || state.players.length < 2) return
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const foodList = state.foodList || []
    const gridSize = (state.gridSize || 40) + 1
    const size = canvas.width / gridSize

    for(let food of foodList) {
        ctx.fillStyle = getFoodColor(food)
        ctx.fillRect(food.x * size, food.y * size, size, size)
    }

    paintPlayer(state.players[0], size, 'red')
    paintPlayer(state.players[1], size, SNAKE_COLOR)

    for(let player of state.players) {
        if(player.playerId === playerNumber) {
            playerPoints.innerText = player.snake.length
        } else {
            enemyPoints.innerText = player.snake.length
        }
    }
}

function getFoodColor(food) {
    switch(food.foodType) {
        case FOOD_TYPES[0]:
            return FOOD_COLOR
        case FOOD_TYPES[1]:
            return FOOD_COLOR_POISON
        case FOOD_TYPES[2]:
            return FOOD_COLOR_SUPER
        case FOOD_TYPES[3]:
            return FOOD_COLOR_FRENZY
    }
}

function paintPlayer(playerState, size, color) {
    const snake = playerState && playerState.snake
    if(!snake || !snake.length) return
    ctx.fillStyle = color
    for(let cell of snake) {
        ctx.fillRect(cell.x * size, cell.y * size, size, size)
    }
}

function handleInit(number) {
    playerNumber = number
    if (lastGameState && gameActive) {
        requestAnimationFrame(() => paintGame(lastGameState))
    }
}

function handleGameState(payload) {
    if(!gameActive) return
    const state = typeof payload === 'string' ? JSON.parse(payload) : payload
    if(!state || !state.players || state.players.length < 2) return
    lastGameState = state
    requestAnimationFrame(() => paintGame(state))
}

function handleGameOver(data) {
    if(!gameActive) return

    data = JSON.parse(data)
    gameActive = false
    lastGameState = null

    document.removeEventListener('keydown', keydown)

    initialScreen.style.display = 'block'
    gameScreen.style.display = 'none'
    pointsContainer.style.display = 'none'
    gameListScreen.style.display = 'none'

    if(data.winner !== playerNumber) {
        alert('You win!')
    } else {
        alert('You lose!')
    }
}

function handleGameCode(gameCode) {
    gameCodeDisplay.innerText = gameCode
}

function handleUnknownGame() {
    reset()
    alert('Unknown game code')
}

function handleTooManyPlayers() {
    reset()
    alert('The game is already in progress')
}

function handleScoreBoard(scoreBoard) {
    console.log(scoreBoard)
    for(let score of scoreBoard) {
        let scoreDOM = document.createElement('div')
        scoreDOM.innerText = score.nickName + ': ' + score.score + ' on: ' + score.date
        scoreBoardContainer.appendChild(scoreDOM)
    }
}

function handleLoadGameList(data) {
    if (!data || typeof data !== 'object') return
    let gameList = Object.keys(data).filter(function (game) { return data[game] != null })

    gameListContainer.innerHTML = ''

    for(let game of gameList) {
        console.log('single game')
        console.log(game)
        let gameDOM = document.createElement('div')
        gameDOM.classList.add('joinGameContainer')
        gameDOM.dataset.id = game
        gameDOM.innerText = game
        // gameDOM.dataset.id = game.code
        // gameDOM.innerText = game.code

        gameDOM.addEventListener('click', joinGame)

        gameListContainer.appendChild(gameDOM)
    }
}

function joinGame2() {
    console.log("TEST")
    console.log(this)
}

function reset() {
    playerNumber = null
    lastGameState = null
    gameCodeDisplay.value = ''
    gameCodeInput.innerText =  ''
    initialScreen.style.display = 'block'
    pointsContainer.style.display = 'none'
    gameScreen.style.display = 'none'
}