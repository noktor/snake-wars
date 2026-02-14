const BG_COLOR      = '#231f20'
const SNAKE_COLOR   = '#c2c2c2'
const FOOD_COLOR    = '#e66916'
const FOOD_COLOR_POISON    = '#00FF00'
const FOOD_COLOR_SUPER    = '#0000FF'
const FOOD_COLOR_FRENZY    = '#FF0000'
const FOOD_TYPES = ['NORMAL', 'POISON', 'SUPER', 'FRENZY']

const BOUNDARY_COLOR = '#e74c3c'

const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
  '#4caf50', '#ff9800', '#795548', '#607d8b', '#3f51b5',
  '#009688', '#ff5722', '#673ab7', '#8bc34a', '#ffeb3b'
]
function getPlayerColor(playerId) {
  return PLAYER_COLORS[(playerId - 1) % PLAYER_COLORS.length]
}

const VIEWPORT_CELLS_W = 25
const VIEWPORT_CELLS_H = 25

function worldToScreen(wx, wy, cameraX, cameraY, cellSizePx) {
  return {
    x: (wx - cameraX) * cellSizePx,
    y: (wy - cameraY) * cellSizePx
  }
}

function isInView(wx, wy, cameraX, cameraY, vw, vh) {
  return wx >= cameraX && wx < cameraX + vw && wy >= cameraY && wy < cameraY + vh
}

function paintBoundaries(gridSize, cameraX, cameraY, cellSizePx, vw, vh) {
  ctx.strokeStyle = BOUNDARY_COLOR
  ctx.lineWidth = 3
  if (0 >= cameraX && 0 < cameraX + vw) {
    const { x: sx } = worldToScreen(0, 0, cameraX, cameraY, cellSizePx)
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, canvas.height)
    ctx.stroke()
  }
  if (gridSize >= cameraX && gridSize < cameraX + vw) {
    const { x: sx } = worldToScreen(gridSize, 0, cameraX, cameraY, cellSizePx)
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, canvas.height)
    ctx.stroke()
  }
  if (0 >= cameraY && 0 < cameraY + vh) {
    const { y: sy } = worldToScreen(0, 0, cameraX, cameraY, cellSizePx)
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(canvas.width, sy)
    ctx.stroke()
  }
  if (gridSize >= cameraY && gridSize < cameraY + vh) {
    const { y: sy } = worldToScreen(0, gridSize, cameraX, cameraY, cellSizePx)
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(canvas.width, sy)
    ctx.stroke()
  }
}

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
const aliveCount = document.getElementById('aliveCount')
const leaderboardEl = document.getElementById('leaderboard')
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
let minimapCanvas, minimapCtx
let playerNumber
let gameActive = false
let lastGameState = null

const MINIMAP_SIZE = 120

function init() {
    initialScreen.style.display = 'none'
    gameListScreen.style.display = 'none'
    gameScreen.style.display = 'block'
    pointsContainer.style.display = 'block'
    canvas = document.getElementById('canvas')
    ctx = canvas.getContext('2d')
    minimapCanvas = document.getElementById('minimap')
    minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null
    if (minimapCanvas) {
        minimapCanvas.width = minimapCanvas.height = MINIMAP_SIZE
    }

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
    if(!ctx || !canvas || !state || !state.players || state.players.length < 1) return
    const gridSize = state.gridSize || 40
    const me = state.players.find(p => p.playerId === playerNumber)
    if (!me || me.dead) {
        ctx.fillStyle = BG_COLOR
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        aliveCount.textContent = 'Alive: ' + state.players.filter(p => !p.dead).length
        updateLeaderboard(state.players.filter(p => !p.dead))
        paintMinimap(state, 0, 0, VIEWPORT_CELLS_W, VIEWPORT_CELLS_H)
        return
    }

    let cameraX = me.pos.x - VIEWPORT_CELLS_W / 2
    let cameraY = me.pos.y - VIEWPORT_CELLS_H / 2
    cameraX = Math.max(0, Math.min(cameraX, gridSize - VIEWPORT_CELLS_W))
    cameraY = Math.max(0, Math.min(cameraY, gridSize - VIEWPORT_CELLS_H))

    const cellSizePx = canvas.width / VIEWPORT_CELLS_W
    const vw = VIEWPORT_CELLS_W
    const vh = VIEWPORT_CELLS_H

    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const foodList = state.foodList || []
    for (const food of foodList) {
        if (!isInView(food.x, food.y, cameraX, cameraY, vw, vh)) continue
        const { x: sx, y: sy } = worldToScreen(food.x, food.y, cameraX, cameraY, cellSizePx)
        ctx.fillStyle = getFoodColor(food)
        ctx.fillRect(sx, sy, cellSizePx + 1, cellSizePx + 1)
    }

    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        const color = player.playerId === playerNumber ? '#00ff00' : getPlayerColor(player.playerId)
        paintPlayerViewport(player, cameraX, cameraY, cellSizePx, vw, vh, color)
    }

    paintBoundaries(gridSize, cameraX, cameraY, cellSizePx, vw, vh)

    playerPoints.textContent = 'Length: ' + (me.snake ? me.snake.length : 0)
    aliveCount.textContent = 'Alive: ' + alive.length
    updateLeaderboard(alive)

    paintMinimap(state, cameraX, cameraY, vw, vh)
}

function paintMinimap(state, cameraX, cameraY, viewportW, viewportH) {
    if (!minimapCtx || !minimapCanvas) return
    const gridSize = state.gridSize || 40
    const scale = MINIMAP_SIZE / (gridSize + 1)
    minimapCtx.fillStyle = BG_COLOR
    minimapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
    for (const food of (state.foodList || [])) {
        minimapCtx.fillStyle = getFoodColor(food)
        const mx = food.x * scale
        const my = food.y * scale
        minimapCtx.fillRect(mx, my, 2, 2)
    }
    const alive = state.players.filter(p => !p.dead)
    for (const player of alive) {
        minimapCtx.fillStyle = player.playerId === playerNumber ? '#00ff00' : getPlayerColor(player.playerId)
        const snake = player.snake
        if (!snake || !snake.length) continue
        for (const cell of snake) {
            minimapCtx.fillRect(cell.x * scale, cell.y * scale, 1.5, 1.5)
        }
    }
    minimapCtx.strokeStyle = 'rgba(255,200,0,0.8)'
    minimapCtx.lineWidth = 1
    minimapCtx.strokeRect(cameraX * scale, cameraY * scale, viewportW * scale, viewportH * scale)
    minimapCtx.strokeStyle = BOUNDARY_COLOR
    minimapCtx.lineWidth = 2
    minimapCtx.strokeRect(0, 0, (gridSize + 1) * scale, (gridSize + 1) * scale)
}

function paintPlayerViewport(playerState, cameraX, cameraY, cellSizePx, vw, vh, color) {
    const snake = playerState && playerState.snake
    if (!snake || !snake.length) return
    ctx.fillStyle = color
    for (const cell of snake) {
        if (!isInView(cell.x, cell.y, cameraX, cameraY, vw, vh)) continue
        const { x: sx, y: sy } = worldToScreen(cell.x, cell.y, cameraX, cameraY, cellSizePx)
        ctx.fillRect(sx, sy, cellSizePx + 1, cellSizePx + 1)
    }
}

function updateLeaderboard(alivePlayers) {
    if (!leaderboardEl) return
    leaderboardEl.innerHTML = ''
    const sorted = alivePlayers.slice().sort((a, b) => (b.snake ? b.snake.length : 0) - (a.snake ? a.snake.length : 0))
    sorted.slice(0, 5).forEach((p, i) => {
        const div = document.createElement('div')
        div.textContent = (i + 1) + '. ' + (p.nickName || 'Player' + p.playerId) + ': ' + (p.snake ? p.snake.length : 0)
        if (p.playerId === playerNumber) div.style.fontWeight = 'bold'
        leaderboardEl.appendChild(div)
    })
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
    if(!state || !state.players || state.players.length < 1) return
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

    if (data.winner === false || data.winner == null) {
        alert('Game over (draw)')
    } else if (data.winner === playerNumber) {
        alert('You win!')
    } else {
        alert('You lose! Winner: ' + data.winner)
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