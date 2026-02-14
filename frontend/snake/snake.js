const BG_COLOR      = '#231f20'
const SNAKE_COLOR   = '#c2c2c2'
const FOOD_COLOR    = '#e66916'
const FOOD_COLOR_POISON    = '#00FF00'
const FOOD_COLOR_SUPER    = '#0000FF'
const FOOD_COLOR_FRENZY    = '#FF0000'
const FOOD_COLOR_STAR    = '#f1c40f'
const FOOD_COLOR_SPEED    = '#3498db'
const FOOD_COLOR_MAGNET  = '#9b59b6'
const FOOD_COLOR_REVERSE = '#1abc9c'
const FOOD_COLOR_BIG = '#e67e22'
const FOOD_TYPES = ['NORMAL', 'POISON', 'SUPER', 'FRENZY']
const STAR_GOLD = '#f1c40f'
const STAR_GOLD_LIGHT = '#f9e79f'

const BOUNDARY_COLOR = '#e74c3c'
const OUT_OF_BOUNDS_COLOR = '#1a0a0a'
const BOUNDARY_WARNING_ZONE = 5
const CAMERA_OVERFLOW_CELLS = 4
const WIN_TARGET = 250
const FOOD_PER_OCCUPANCY_TIER = 50
const INITIAL_SNAKE_LENGTH = 3

function getOccupancyFromPlayer(playerOrState) {
    if (!playerOrState) return 1
    if (typeof playerOrState.occupancy === 'number' && playerOrState.occupancy >= 1) {
        return Math.max(1, playerOrState.occupancy)
    }
    const foodEaten = playerOrState.foodEaten
    if (typeof foodEaten === 'number' && foodEaten >= 0) {
        return Math.max(1, 1 + Math.floor(foodEaten / FOOD_PER_OCCUPANCY_TIER))
    }
    const len = (playerOrState.snake && playerOrState.snake.length) || INITIAL_SNAKE_LENGTH
    return Math.max(1, 1 + Math.floor((len - INITIAL_SNAKE_LENGTH) / FOOD_PER_OCCUPANCY_TIER))
}
const PORTAL_COLOR = '#9b59b6'
const PORTAL_COLOR_INNER = '#e8daef'

const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
  '#4caf50', '#ff9800', '#795548', '#607d8b', '#3f51b5',
  '#009688', '#ff5722', '#673ab7', '#8bc34a', '#ffeb3b'
]
function getPlayerColor(playerId) {
  return PLAYER_COLORS[(playerId - 1) % PLAYER_COLORS.length]
}

let selectedColor = (function () {
  try { return localStorage.getItem('snakeWarsColor') || PLAYER_COLORS[0] } catch (e) { return PLAYER_COLORS[0] }
})()
let selectedSkinId = 0

const ZOOM_LEVELS = [40, 28, 18]
const VIEWPORT_EXTRA_PER_OCCUPANCY = 10
let zoomLevel = 0

function getViewportCells(occupancy) {
  const base = ZOOM_LEVELS[Math.max(0, Math.min(zoomLevel, ZOOM_LEVELS.length - 1))]
  const occ = Math.max(1, occupancy || 1)
  const extra = (occ - 1) * VIEWPORT_EXTRA_PER_OCCUPANCY
  const c = base + extra
  return { w: c, h: c }
}

function worldToScreen(wx, wy, cameraX, cameraY, cellSizePx) {
  return {
    x: (wx - cameraX) * cellSizePx,
    y: (wy - cameraY) * cellSizePx
  }
}

function isInView(wx, wy, cameraX, cameraY, vw, vh) {
  return wx >= cameraX && wx < cameraX + vw && wy >= cameraY && wy < cameraY + vh
}

function paintPortal(wx, wy, cameraX, cameraY, cellSizePx) {
  const { x: sx, y: sy } = worldToScreen(wx, wy, cameraX, cameraY, cellSizePx)
  const cx = sx + cellSizePx / 2
  const cy = sy + cellSizePx / 2
  const r = cellSizePx * 0.45
  const t = Date.now() / 80
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  gradient.addColorStop(0, PORTAL_COLOR_INNER)
  gradient.addColorStop(0.6, PORTAL_COLOR)
  gradient.addColorStop(1, '#6c3483')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = PORTAL_COLOR
  ctx.lineWidth = 2
  ctx.stroke()
  const particleCount = 8
  for (let i = 0; i < particleCount; i++) {
    const angle = (t + i * 0.78) * 0.5
    const spiralRadius = r * (0.15 + (angle % 1) * 0.7)
    const px = cx + Math.cos(angle) * spiralRadius
    const py = cy + Math.sin(angle) * spiralRadius
    ctx.fillStyle = PORTAL_COLOR_INNER
    ctx.beginPath()
    ctx.arc(px, py, cellSizePx * 0.08, 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintOutOfBounds(gridSize, cameraX, cameraY, cellSizePx, vw, vh) {
  ctx.fillStyle = OUT_OF_BOUNDS_COLOR
  if (cameraX < 0) {
    const w = Math.min(-cameraX, vw) * cellSizePx
    ctx.fillRect(0, 0, w, canvas.height)
  }
  if (cameraX + vw > gridSize) {
    const overflow = (cameraX + vw) - gridSize
    const w = Math.min(overflow, vw) * cellSizePx
    ctx.fillRect(canvas.width - w, 0, w, canvas.height)
  }
  if (cameraY < 0) {
    const h = Math.min(-cameraY, vh) * cellSizePx
    ctx.fillRect(0, 0, canvas.width, h)
  }
  if (cameraY + vh > gridSize) {
    const overflow = (cameraY + vh) - gridSize
    const h = Math.min(overflow, vh) * cellSizePx
    ctx.fillRect(0, canvas.height - h, canvas.width, h)
  }
}

function paintBoundaries(gridSize, cameraX, cameraY, cellSizePx, vw, vh, me) {
  const lineW = 5
  ctx.strokeStyle = BOUNDARY_COLOR
  ctx.lineWidth = lineW
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
  const headX = me && me.pos ? me.pos.x : -999
  const headY = me && me.pos ? me.pos.y : -999
  const nearLeft = headX < BOUNDARY_WARNING_ZONE
  const nearRight = headX > gridSize - BOUNDARY_WARNING_ZONE
  const nearTop = headY < BOUNDARY_WARNING_ZONE
  const nearBottom = headY > gridSize - BOUNDARY_WARNING_ZONE
  if (nearLeft || nearRight || nearTop || nearBottom) {
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)'
    ctx.lineWidth = lineW + 8
    if (nearLeft && 0 >= cameraX && 0 < cameraX + vw) {
      const { x: sx } = worldToScreen(0, 0, cameraX, cameraY, cellSizePx)
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, canvas.height)
      ctx.stroke()
    }
    if (nearRight && gridSize >= cameraX && gridSize < cameraX + vw) {
      const { x: sx } = worldToScreen(gridSize, 0, cameraX, cameraY, cellSizePx)
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, canvas.height)
      ctx.stroke()
    }
    if (nearTop && 0 >= cameraY && 0 < cameraY + vh) {
      const { y: sy } = worldToScreen(0, 0, cameraX, cameraY, cellSizePx)
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(canvas.width, sy)
      ctx.stroke()
    }
    if (nearBottom && gridSize >= cameraY && gridSize < cameraY + vh) {
      const { y: sy } = worldToScreen(0, gridSize, cameraX, cameraY, cellSizePx)
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(canvas.width, sy)
      ctx.stroke()
    }
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
socket.on('fart', (payload) => {
    try {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload
        if (data && data.playerId != null) {
            fartTremblePlayerId = data.playerId
            fartTrembleUntil = Date.now() + 350
            playFartSound()
        }
    } catch (e) {}
})
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
const buffIndicatorEl = document.getElementById('buffIndicator')
const staminaFillEl = document.getElementById('staminaFill')
const STAMINA_MAX = 100
const leaderboardEl = document.getElementById('leaderboard')
const scoreBoardContainer = document.getElementById('scoreBoardContainer')
const errorMessage = document.getElementById('errorMessage')
const gameListContainer = document.getElementById('gameListContainer')
const gameListScreen = document.getElementById('gameListScreen')
const backButton = document.getElementById('backButton')
const userListDOM = document.getElementById('userList')
const previewCanvas = document.getElementById('previewCanvas')
const colorSwatchesEl = document.getElementById('colorSwatches')
const nicknameDisplay = document.getElementById('nicknameDisplay')

const NICKNAME_KEY = 'snake_wars_nickname'
const MAX_NICKNAME_LENGTH = 30
try {
  const nick = (sessionStorage.getItem(NICKNAME_KEY) || '').trim().slice(0, MAX_NICKNAME_LENGTH)
  if (!nick) { window.location.href = '../index.html'; throw new Error('redirect') }
  if (nickNameInput) nickNameInput.value = nick
  if (nicknameDisplay) nicknameDisplay.textContent = nick
} catch (e) { if (e.message !== 'redirect') throw e }

newGameBtn.addEventListener('click', newGame)
joinGameBtn2.addEventListener('click', showGameList)
if (backButton) backButton.addEventListener('click', returnHome)

function zoomIn() {
  if (zoomLevel < ZOOM_LEVELS.length - 1) {
    zoomLevel++
    if (lastGameState && gameActive) requestAnimationFrame(() => paintGame(lastGameState))
  }
}
function zoomOut() {
  if (zoomLevel > 0) {
    zoomLevel--
    if (lastGameState && gameActive) requestAnimationFrame(() => paintGame(lastGameState))
  }
}

const zoomInBtn = document.getElementById('zoomInBtn')
const zoomOutBtn = document.getElementById('zoomOutBtn')
const hackBtn = document.getElementById('hackBtn')
const noktorPanel = document.getElementById('noktorPanel')
const powerButtonsContainer = document.getElementById('powerButtonsContainer')
const noktorAIContainer = document.getElementById('noktorAIContainer')
if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn)
if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut)
if (hackBtn) hackBtn.addEventListener('click', () => { if (gameActive) socket.emit('hack') })

const POWER_BUTTONS = [
    { power: 'star', label: '⭐', title: 'Star (invincible)' },
    { power: 'speed', label: '⚡', title: 'Speed' },
    { power: 'magnet', label: '🧲', title: 'Magnet' },
    { power: 'reverse', label: '↩', title: 'Reverse' }
]
function initPowerButtons() {
    if (!powerButtonsContainer || powerButtonsContainer.children.length > 0) return
    powerButtonsContainer.style.display = 'flex'
    for (const { power, label, title } of POWER_BUTTONS) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.title = title + ' (Noktor only)'
        btn.textContent = label
        btn.style.cssText = 'width: 36px; height: 36px; font-size: 18px; line-height: 1; border: 2px solid #444; border-radius: 6px; background: #2a2a2a; color: #eee; cursor: pointer; padding: 0;'
        btn.addEventListener('click', () => { if (gameActive) socket.emit('triggerPower', { power }) })
        powerButtonsContainer.appendChild(btn)
    }
}

function initNoktorAIContainer() {
    if (!noktorAIContainer || noktorAIContainer.children.length > 0) return
    noktorAIContainer.style.display = 'flex'
    const btnStyle = 'padding: 6px 10px; font-size: 12px; border: 2px solid #444; border-radius: 6px; background: #2a2a2a; color: #eee; cursor: pointer;'
    const inputStyle = 'width: 40px; padding: 4px; font-size: 12px; border: 2px solid #444; border-radius: 4px; background: #1a1a1a; color: #eee;'
    const freezeBtn = document.createElement('button')
    freezeBtn.type = 'button'
    freezeBtn.textContent = '❄ Freeze nearby AI'
    freezeBtn.title = 'Freeze all AI within range (Noktor only)'
    freezeBtn.style.cssText = btnStyle
    freezeBtn.addEventListener('click', () => { if (gameActive) socket.emit('freezeNearbyAI') })
    noktorAIContainer.appendChild(freezeBtn)
    const addRow = document.createElement('div')
    addRow.style.display = 'flex'
    addRow.style.alignItems = 'center'
    addRow.style.gap = '6px'
    const addInput = document.createElement('input')
    addInput.type = 'number'
    addInput.min = 1
    addInput.max = 50
    addInput.value = 1
    addInput.style.cssText = inputStyle
    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.textContent = 'Add AI'
    addBtn.title = 'Add AI players (Noktor only)'
    addBtn.style.cssText = btnStyle
    addBtn.addEventListener('click', () => {
        if (gameActive) socket.emit('addAIPlayers', { count: parseInt(addInput.value, 10) || 1 })
    })
    const addLabel = document.createElement('span')
    addLabel.textContent = 'Add:'
    addLabel.style.color = '#eee'
    addLabel.style.fontSize = '12px'
    addRow.appendChild(addLabel)
    addRow.appendChild(addInput)
    addRow.appendChild(addBtn)
    noktorAIContainer.appendChild(addRow)
    const removeRow = document.createElement('div')
    removeRow.style.display = 'flex'
    removeRow.style.alignItems = 'center'
    removeRow.style.gap = '6px'
    const removeInput = document.createElement('input')
    removeInput.type = 'number'
    removeInput.min = 1
    removeInput.value = 1
    removeInput.style.cssText = inputStyle
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.textContent = 'Remove AI'
    removeBtn.title = 'Remove AI players (Noktor only)'
    removeBtn.style.cssText = btnStyle
    removeBtn.addEventListener('click', () => {
        if (gameActive) socket.emit('removeAIPlayers', { count: parseInt(removeInput.value, 10) || 1 })
    })
    const removeLabel = document.createElement('span')
    removeLabel.textContent = 'Remove:'
    removeLabel.style.color = '#eee'
    removeLabel.style.fontSize = '12px'
    removeRow.appendChild(removeLabel)
    removeRow.appendChild(removeInput)
    removeRow.appendChild(removeBtn)
    noktorAIContainer.appendChild(removeRow)
    const addSegRow = document.createElement('div')
    addSegRow.style.display = 'flex'
    addSegRow.style.alignItems = 'center'
    addSegRow.style.gap = '6px'
    const addSegInput = document.createElement('input')
    addSegInput.type = 'number'
    addSegInput.min = 1
    addSegInput.max = 100
    addSegInput.value = 5
    addSegInput.style.cssText = inputStyle
    const addSegBtn = document.createElement('button')
    addSegBtn.type = 'button'
    addSegBtn.textContent = '+ Body'
    addSegBtn.title = 'Add N segments to your snake (Noktor only)'
    addSegBtn.style.cssText = btnStyle
    addSegBtn.addEventListener('click', () => {
        if (gameActive) socket.emit('addSnakeSegments', { count: parseInt(addSegInput.value, 10) || 1 })
    })
    const addSegLabel = document.createElement('span')
    addSegLabel.textContent = 'Add:'
    addSegLabel.style.color = '#eee'
    addSegLabel.style.fontSize = '12px'
    addSegRow.appendChild(addSegLabel)
    addSegRow.appendChild(addSegInput)
    addSegRow.appendChild(addSegBtn)
    noktorAIContainer.appendChild(addSegRow)
    const removeSegRow = document.createElement('div')
    removeSegRow.style.display = 'flex'
    removeSegRow.style.alignItems = 'center'
    removeSegRow.style.gap = '6px'
    const removeSegInput = document.createElement('input')
    removeSegInput.type = 'number'
    removeSegInput.min = 1
    removeSegInput.value = 5
    removeSegInput.style.cssText = inputStyle
    const removeSegBtn = document.createElement('button')
    removeSegBtn.type = 'button'
    removeSegBtn.textContent = '− Body'
    removeSegBtn.title = 'Remove N segments from your snake (Noktor only)'
    removeSegBtn.style.cssText = btnStyle
    removeSegBtn.addEventListener('click', () => {
        if (gameActive) socket.emit('removeSnakeSegments', { count: parseInt(removeSegInput.value, 10) || 1 })
    })
    const removeSegLabel = document.createElement('span')
    removeSegLabel.textContent = 'Remove:'
    removeSegLabel.style.color = '#eee'
    removeSegLabel.style.fontSize = '12px'
    removeSegRow.appendChild(removeSegLabel)
    removeSegRow.appendChild(removeSegInput)
    removeSegRow.appendChild(removeSegBtn)
    noktorAIContainer.appendChild(removeSegRow)
}

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
    window.location.href = '../index.html'
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
    socket.emit('newGame', { nickName: nickNameInput.value, color: selectedColor, skinId: selectedSkinId })
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
        nickName: nickNameInput.value,
        color: selectedColor,
        skinId: selectedSkinId
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
let fartTremblePlayerId = null
let fartTrembleUntil = 0

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
    document.addEventListener('keyup', keyup)
    gameActive = true
}

function keydown(e) {
    if (!gameActive) return
    if (e.keyCode === 61 || e.keyCode === 107) {
      zoomIn()
      e.preventDefault()
      return
    }
    if (e.keyCode === 173 || e.keyCode === 109) {
      zoomOut()
      e.preventDefault()
      return
    }
    if (e.keyCode === 70 || e.keyCode === 102) {
      e.preventDefault()
      socket.emit('fart')
      return
    }
    if (e.keyCode === 32) {
      e.preventDefault()
    }
    socket.emit('keydown', e.keyCode)
}

function keyup(e) {
    if (!gameActive) return
    if (e.keyCode === 32) {
      e.preventDefault()
      socket.emit('keyup', e.keyCode)
    }
}

function playFartSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const duration = 0.22
        const bufferSize = ctx.sampleRate * duration
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate
            const env = Math.exp(-t * 14)
            data[i] = (Math.random() * 2 - 1) * env * 0.35
        }
        const noise = ctx.createBufferSource()
        noise.buffer = buffer
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 260
        filter.Q.value = 0.5
        noise.connect(filter)
        filter.connect(ctx.destination)
        noise.start(0)
    } catch (e) {}
}

function paintGame(state) {
    if(!ctx || !canvas || !state || !state.players || state.players.length < 1) return
    const gridSize = state.gridSize || 40
    const me = state.players.find(p => p.playerId === playerNumber)
    const occupancy = me && !me.dead ? getOccupancyFromPlayer(me) : 1
    const { w: vw, h: vh } = getViewportCells(occupancy)
    if (!me || me.dead) {
        ctx.fillStyle = BG_COLOR
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        updateBuffIndicator(me && !me.dead ? me : null)
        updateStaminaBar(me || null)
        updateLeaderboard(state.players.filter(p => !p.dead), state)
        if (noktorPanel) noktorPanel.style.display = 'none'
        paintMinimap(state, 0, 0, vw, vh)
        return
    }

    let cameraX = me.pos.x - vw / 2 + (occupancy - 1) / 2
    let cameraY = me.pos.y - vh / 2 + (occupancy - 1) / 2
    const overflow = CAMERA_OVERFLOW_CELLS
    cameraX = Math.max(-overflow, Math.min(cameraX, gridSize - vw + overflow))
    cameraY = Math.max(-overflow, Math.min(cameraY, gridSize - vh + overflow))

    const cellSizePx = canvas.width / vw

    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    paintOutOfBounds(gridSize, cameraX, cameraY, cellSizePx, vw, vh)

    const foodList = state.foodList || []
    for (const food of foodList) {
        if (!isInView(food.x, food.y, cameraX, cameraY, vw, vh)) continue
        const { x: sx, y: sy } = worldToScreen(food.x, food.y, cameraX, cameraY, cellSizePx)
        if (food.foodType === 'STAR') paintStarPowerUp(sx, sy, cellSizePx)
        else if (food.foodType === 'SPEED') paintSpeedPowerUp(sx, sy, cellSizePx)
        else if (food.foodType === 'MAGNET') paintMagnetPowerUp(sx, sy, cellSizePx)
        else if (food.foodType === 'REVERSE') paintReversePowerUp(sx, sy, cellSizePx)
        else {
            ctx.fillStyle = getFoodColor(food)
            ctx.fillRect(sx, sy, cellSizePx + 1, cellSizePx + 1)
        }
    }

    const portals = state.portals || []
    for (const portal of portals) {
        if (isInView(portal.a.x, portal.a.y, cameraX, cameraY, vw, vh)) paintPortal(portal.a.x, portal.a.y, cameraX, cameraY, cellSizePx)
        if (isInView(portal.b.x, portal.b.y, cameraX, cameraY, vw, vh)) paintPortal(portal.b.x, portal.b.y, cameraX, cameraY, cellSizePx)
    }

    const alive = state.players.filter(p => !p.dead)
    const bountyPlayerId = (state && state.bountyPlayerId) || null
    for (const player of alive) {
        const color = player.color || (player.playerId === playerNumber ? '#00ff00' : getPlayerColor(player.playerId))
        paintPlayerViewport(player, cameraX, cameraY, cellSizePx, vw, vh, color, bountyPlayerId)
    }
    for (const player of alive) {
        paintPlayerName(player, cameraX, cameraY, cellSizePx, vw, vh, state)
    }

    paintBoundaries(gridSize, cameraX, cameraY, cellSizePx, vw, vh, me)

    const myLength = me.snake ? me.snake.length : 0
    playerPoints.textContent = 'Length: ' + myLength + ' / ' + WIN_TARGET
    updateBuffIndicator(me)
    updateStaminaBar(me)
    updateLeaderboard(alive, state)
    const isNoktor = (me.nickName || '').trim() === 'Noktor'
    if (noktorPanel) noktorPanel.style.display = isNoktor ? 'flex' : 'none'
    if (isNoktor) {
        if (powerButtonsContainer) {
            initPowerButtons()
            powerButtonsContainer.style.display = 'flex'
        }
        if (noktorAIContainer) {
            initNoktorAIContainer()
            noktorAIContainer.style.display = 'flex'
        }
    }

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
    for (const portal of (state.portals || [])) {
        minimapCtx.fillStyle = PORTAL_COLOR
        minimapCtx.fillRect(portal.a.x * scale, portal.a.y * scale, 2, 2)
        minimapCtx.fillRect(portal.b.x * scale, portal.b.y * scale, 2, 2)
    }
    const alive = state.players.filter(p => !p.dead)
    const bountyPlayerId = (state && state.bountyPlayerId) || null
    const now = Date.now()
    for (const player of alive) {
        if ((player.starUntil || 0) > now) minimapCtx.fillStyle = STAR_GOLD
        else if ((player.speedUntil || 0) > now) minimapCtx.fillStyle = FOOD_COLOR_SPEED
        else minimapCtx.fillStyle = player.color || (player.playerId === playerNumber ? '#00ff00' : getPlayerColor(player.playerId))
        const snake = player.snake
        if (!snake || !snake.length) continue
        const occ = getOccupancyFromPlayer(player)
        const dot = Math.max(1, 1.5 * occ)
        for (const cell of snake) {
            minimapCtx.fillRect(cell.x * scale, cell.y * scale, dot, dot)
        }
    }
    if (bountyPlayerId) {
        const bounty = alive.find(p => p.playerId === bountyPlayerId)
        if (bounty && bounty.snake && bounty.snake.length) {
            const head = bounty.snake[bounty.snake.length - 1]
            const occ = getOccupancyFromPlayer(bounty)
            const hx = (head.x + (occ - 1) / 2) * scale
            const hy = (head.y + (occ - 1) / 2) * scale
            const r = 6
            minimapCtx.fillStyle = 'rgba(241,196,15,0.95)'
            minimapCtx.beginPath()
            minimapCtx.arc(hx, hy, r, 0, Math.PI * 2)
            minimapCtx.fill()
            minimapCtx.strokeStyle = '#b8860b'
            minimapCtx.lineWidth = 2
            minimapCtx.stroke()
            minimapCtx.beginPath()
            minimapCtx.arc(hx, hy, r + 4, 0, Math.PI * 2)
            minimapCtx.strokeStyle = 'rgba(255,215,0,0.9)'
            minimapCtx.lineWidth = 1.5
            minimapCtx.stroke()
        }
    }
    minimapCtx.strokeStyle = 'rgba(255,200,0,0.8)'
    minimapCtx.lineWidth = 1
    minimapCtx.strokeRect(cameraX * scale, cameraY * scale, viewportW * scale, viewportH * scale)
    minimapCtx.strokeStyle = BOUNDARY_COLOR
    minimapCtx.lineWidth = 2
    minimapCtx.strokeRect(0, 0, (gridSize + 1) * scale, (gridSize + 1) * scale)
}

function getHeadDirection(snake) {
    if (!snake || snake.length < 2) return { dx: 1, dy: 0 }
    const head = snake[snake.length - 1]
    const neck = snake[snake.length - 2]
    let dx = head.x - neck.x
    let dy = head.y - neck.y
    const len = Math.hypot(dx, dy) || 1
    return { dx: dx / len, dy: dy / len }
}

const SNAKE_FACE_COUNT = 4
function paintSnakeFace(ctx, cx, cy, cellSizePx, dir, faceId, fillColor) {
    const face = Math.max(0, Math.min(SNAKE_FACE_COUNT - 1, (faceId || 0) | 0))
    const s = cellSizePx * 0.35
    const angle = Math.atan2(dir.dy, dir.dx)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.translate(-cx, -cy)
    if (face === 0) {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(cx - s * 0.5, cy - s * 0.3, s * 0.22, 0, Math.PI * 2)
        ctx.arc(cx + s * 0.5, cy - s * 0.3, s * 0.22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.arc(cx - s * 0.5, cy - s * 0.3, s * 0.1, 0, Math.PI * 2)
        ctx.arc(cx + s * 0.5, cy - s * 0.3, s * 0.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = Math.max(1, cellSizePx * 0.08)
        ctx.beginPath()
        ctx.arc(cx, cy + s * 0.35, s * 0.4, 0.2 * Math.PI, 0.8 * Math.PI)
        ctx.stroke()
    } else if (face === 1) {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.ellipse(cx - s * 0.45, cy - s * 0.25, s * 0.28, s * 0.35, 0, 0, Math.PI * 2)
        ctx.ellipse(cx + s * 0.45, cy - s * 0.25, s * 0.28, s * 0.35, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.ellipse(cx - s * 0.45, cy - s * 0.25, s * 0.1, s * 0.12, 0, 0, Math.PI * 2)
        ctx.ellipse(cx + s * 0.45, cy - s * 0.25, s * 0.1, s * 0.12, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255, 150, 150, 0.6)'
        ctx.beginPath()
        ctx.arc(cx - s * 0.85, cy + s * 0.1, s * 0.18, 0, Math.PI * 2)
        ctx.arc(cx + s * 0.85, cy + s * 0.1, s * 0.18, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = Math.max(1, cellSizePx * 0.06)
        ctx.beginPath()
        ctx.ellipse(cx, cy + s * 0.5, s * 0.35, s * 0.15, 0, 0, Math.PI)
        ctx.stroke()
    } else if (face === 2) {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(cx - s * 0.5, cy - s * 0.3, s * 0.22, 0, Math.PI * 2)
        ctx.arc(cx + s * 0.5, cy - s * 0.3, s * 0.22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.arc(cx - s * 0.5, cy - s * 0.3, s * 0.1, 0, Math.PI * 2)
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = Math.max(1, cellSizePx * 0.07)
        ctx.moveTo(cx + s * 0.35, cy - s * 0.45)
        ctx.lineTo(cx + s * 0.65, cy - s * 0.15)
        ctx.stroke()
        ctx.fill()
        ctx.fillStyle = '#ff69b4'
        ctx.beginPath()
        ctx.ellipse(cx, cy + s * 0.5, s * 0.2, s * 0.35, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#c71585'
        ctx.lineWidth = Math.max(1, cellSizePx * 0.05)
        ctx.stroke()
    } else {
        ctx.fillStyle = '#f4c48a'
        ctx.beginPath()
        ctx.ellipse(cx, cy, s * 0.9, s * 1.05, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#e8b87a'
        ctx.beginPath()
        ctx.ellipse(cx, cy - s * 0.5, s * 0.75, s * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.arc(cx - s * 0.4, cy - s * 0.2, s * 0.12, 0, Math.PI * 2)
        ctx.arc(cx + s * 0.4, cy - s * 0.2, s * 0.12, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#2c1810'
        ctx.lineWidth = Math.max(1, cellSizePx * 0.06)
        ctx.beginPath()
        ctx.moveTo(cx - s * 0.5, cy + s * 0.3)
        ctx.lineTo(cx, cy + s * 0.5)
        ctx.lineTo(cx + s * 0.5, cy + s * 0.3)
        ctx.stroke()
    }
    ctx.restore()
}

function paintBountyCrown(ctx, cx, cy, cellSizePx) {
    const s = Math.max(4, cellSizePx * 0.45)
    const top = cy - s * 1.2
    ctx.save()
    ctx.translate(cx, top)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-s * 0.85, s * 0.35)
    ctx.lineTo(-s * 0.45, 0)
    ctx.lineTo(0, -s * 0.55)
    ctx.lineTo(s * 0.45, 0)
    ctx.lineTo(s * 0.85, s * 0.35)
    ctx.lineTo(s * 0.4, s * 0.2)
    ctx.lineTo(0, s * 0)
    ctx.lineTo(-s * 0.4, s * 0.2)
    ctx.closePath()
    ctx.fillStyle = '#f1c40f'
    ctx.fill()
    ctx.strokeStyle = '#b8860b'
    ctx.lineWidth = Math.max(1, s * 0.08)
    ctx.stroke()
    ctx.restore()
}

function paintPlayerViewport(playerState, cameraX, cameraY, cellSizePx, vw, vh, color, bountyPlayerId) {
    const snake = playerState && playerState.snake
    if (!snake || !snake.length) return
    const now = Date.now()
    const isStar = (playerState.starUntil || 0) > now
    const isSpeed = (playerState.speedUntil || 0) > now
    const fillColor = isStar ? STAR_GOLD : (isSpeed ? '#7dd3fc' : color)
    const tremble = (playerState.playerId === fartTremblePlayerId && now < fartTrembleUntil)
    const offsetX = tremble ? (Math.random() - 0.5) * 4 : 0
    const offsetY = tremble ? (Math.random() - 0.5) * 4 : 0
    const headDir = getHeadDirection(snake)
    const faceId = (playerState.skinId != null ? playerState.skinId : 0)
    const isBounty = bountyPlayerId != null && bountyPlayerId === playerState.playerId
    const occ = getOccupancyFromPlayer(playerState)
    const offsets = []
    for (let dx = 0; dx < occ; dx++) {
        for (let dy = 0; dy < occ; dy++) {
            offsets.push({ x: dx, y: dy })
        }
    }
    ctx.fillStyle = fillColor
    const cellW = cellSizePx + 1
    for (let i = 0; i < snake.length; i++) {
        const cell = snake[i]
        for (const off of offsets) {
            const gx = cell.x + off.x
            const gy = cell.y + off.y
            if (!isInView(gx, gy, cameraX, cameraY, vw, vh)) continue
            let { x: sx, y: sy } = worldToScreen(gx, gy, cameraX, cameraY, cellSizePx)
            sx += offsetX
            sy += offsetY
            const cx = sx + cellW / 2
            const cy = sy + cellW / 2
            ctx.fillRect(sx, sy, cellW, cellW)
            if (isStar) {
                const t = (now / 80) + cell.x * 0.3 + cell.y * 0.3
                for (let j = 0; j < 3; j++) {
                    const a = t + j * (Math.PI * 2 / 3)
                    const px = cx + Math.cos(a) * (cellSizePx * 0.25)
                    const py = cy + Math.sin(a) * (cellSizePx * 0.25)
                    ctx.fillStyle = 'rgba(255,255,255,0.95)'
                    ctx.beginPath()
                    ctx.arc(px, py, cellSizePx * 0.12, 0, Math.PI * 2)
                    ctx.fill()
                }
                ctx.fillStyle = STAR_GOLD
            }
            if (isSpeed && !isStar) {
                ctx.strokeStyle = 'rgba(125,211,252,0.9)'
                ctx.lineWidth = 2
                ctx.strokeRect(sx, sy, cellW, cellW)
            }
        }
        if (i === snake.length - 1) {
            const headCenterX = cell.x + (occ - 1) / 2
            const headCenterY = cell.y + (occ - 1) / 2
            if (isInView(headCenterX, headCenterY, cameraX, cameraY, vw, vh)) {
                const sc = worldToScreen(headCenterX, headCenterY, cameraX, cameraY, cellSizePx)
                const headCx = sc.x + offsetX
                const headCy = sc.y + offsetY
                const headSize = cellSizePx * occ
                if (isBounty) paintBountyCrown(ctx, headCx, headCy, headSize)
                if (!isStar) paintSnakeFace(ctx, headCx, headCy, headSize, headDir, faceId, fillColor)
            }
        }
    }
    if (isStar) ctx.fillStyle = color
}

function paintPreviewSnake(color, skinId) {
    if (!previewCanvas || !color) return
    const pctx = previewCanvas.getContext('2d')
    if (!pctx) return
    const w = previewCanvas.width
    const h = previewCanvas.height
    pctx.fillStyle = '#1a1a1a'
    pctx.fillRect(0, 0, w, h)
    const segSize = 12
    const segGap = 2
    const totalWidth = 5 * (segSize + segGap) - segGap
    let x0 = (w - totalWidth) / 2 + segSize / 2 + segGap / 2
    const y0 = h / 2
    pctx.fillStyle = color
    for (let i = 0; i < 5; i++) {
        const sx = x0 + i * (segSize + segGap)
        pctx.fillRect(sx - segSize / 2, y0 - segSize / 2, segSize, segSize)
    }
    const faceId = (skinId != null ? skinId : 0)
    const headCx = x0 + 4 * (segSize + segGap)
    const headCy = y0
    paintSnakeFace(pctx, headCx, headCy, segSize, { dx: 1, dy: 0 }, faceId, color)
}

const facePickerLabels = ['😊', '🥹', '😜', '🦅']
function initFacePicker() {
    const el = document.getElementById('facePicker')
    if (!el) return
    el.innerHTML = ''
    for (let f = 0; f < SNAKE_FACE_COUNT; f++) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.setAttribute('aria-label', 'Face ' + (f + 1))
        btn.textContent = facePickerLabels[f] || ('Face ' + (f + 1))
        btn.style.cssText = 'width: 40px; height: 40px; font-size: 22px; border: 2px solid #444; border-radius: 8px; background: #2a2a2a; cursor: pointer; padding: 0; line-height: 1;'
        if (selectedSkinId === f) btn.style.borderColor = '#fff'
        btn.addEventListener('click', function () {
            selectedSkinId = f
            try { localStorage.setItem('snakeWarsFaceId', String(f)) } catch (e) {}
            initFacePicker()
            paintPreviewSnake(selectedColor, selectedSkinId)
        })
        el.appendChild(btn)
    }
}

function initPreview() {
    const storedFace = (function () { try { return parseInt(localStorage.getItem('snakeWarsFaceId'), 10) } catch (e) { return NaN } })()
    if (!isNaN(storedFace) && storedFace >= 0 && storedFace < SNAKE_FACE_COUNT) selectedSkinId = storedFace
    initFacePicker()
    if (!colorSwatchesEl) return
    colorSwatchesEl.innerHTML = ''
    for (const c of PLAYER_COLORS) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.style.cssText = 'width: 24px; height: 24px; border: 2px solid #444; border-radius: 4px; background: ' + c + '; cursor: pointer; padding: 0;'
        if (c === selectedColor) btn.style.borderColor = '#fff'
        btn.addEventListener('click', function () {
            selectedColor = c
            try { localStorage.setItem('snakeWarsColor', c) } catch (e) {}
            initPreview()
            paintPreviewSnake(selectedColor, selectedSkinId)
        })
        colorSwatchesEl.appendChild(btn)
    }
    paintPreviewSnake(selectedColor, selectedSkinId)
}

function paintPlayerName(player, cameraX, cameraY, cellSizePx, vw, vh, state) {
    if (!ctx || !isInView(player.pos.x, player.pos.y, cameraX, cameraY, vw, vh)) return
    const { x: sx, y: sy } = worldToScreen(player.pos.x, player.pos.y, cameraX, cameraY, cellSizePx)
    const tx = sx + (cellSizePx + 1) / 2
    let ty = sy - 8
    if (state && state.bountyPlayerId === player.playerId) {
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#f1c40f'
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1.5
        ctx.strokeText('BOUNTY', tx, ty - 10)
        ctx.fillText('BOUNTY', tx, ty - 10)
        ty -= 4
    }
    const name = player.nickName || ('Player' + player.playerId)
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 2
    ctx.strokeText(name, tx, ty)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(name, tx, ty)
}

function updateStaminaBar(me) {
    if (!staminaFillEl) return
    const pct = me && typeof me.stamina === 'number' ? Math.max(0, Math.min(100, (me.stamina / STAMINA_MAX) * 100)) : 100
    staminaFillEl.style.width = pct + '%'
}

function updateBuffIndicator(me) {
    if (!buffIndicatorEl) return
    const now = Date.now()
    const parts = []
    if (me && (me.starUntil || 0) > now) {
        const sec = ((me.starUntil - now) / 1000).toFixed(1)
        parts.push('<span style="color:#f1c40f;">⭐ Invincible ' + sec + 's</span>')
    }
    if (me && (me.speedUntil || 0) > now) {
        const sec = ((me.speedUntil - now) / 1000).toFixed(1)
        parts.push('<span style="color:#3498db;">⚡ Speed ' + sec + 's</span>')
    }
    if (me && (me.magnetUntil || 0) > now) {
        const sec = ((me.magnetUntil - now) / 1000).toFixed(1)
        parts.push('<span style="color:#9b59b6;">🧲 Magnet ' + sec + 's</span>')
    }
    if (me && (me.streakSpeedUntil || 0) > now) {
        const sec = ((me.streakSpeedUntil - now) / 1000).toFixed(1)
        parts.push('<span style="color:#e67e22;">🔥 Streak speed ' + sec + 's</span>')
    }
    buffIndicatorEl.innerHTML = parts.length ? parts.join('<br>') : ''
}

const LEADERBOARD_MAX_NAME = 14
const BOUNTY_ICON = '👑'
const FEED_STREAK_ICON = '🔥'
function updateLeaderboard(alivePlayers, state) {
    if (!leaderboardEl) return
    leaderboardEl.innerHTML = ''
    const bountyPlayerId = (state && state.bountyPlayerId) || null
    const sorted = alivePlayers.slice().sort((a, b) => (b.snake ? b.snake.length : 0) - (a.snake ? a.snake.length : 0))
    sorted.forEach((p, i) => {
        const div = document.createElement('div')
        const name = (p.nickName || ('Player' + p.playerId)).trim()
        const shortName = name.length > LEADERBOARD_MAX_NAME ? name.slice(0, LEADERBOARD_MAX_NAME - 1) + '…' : name
        const len = p.snake ? p.snake.length : 0
        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 6px; margin-bottom: 2px; font-size: 12px; line-height: 1.3; border-radius: 4px;'
        if (i % 2 === 1) div.style.background = 'rgba(255,255,255,0.06)'
        if (p.playerId === playerNumber) {
            div.style.fontWeight = 'bold'
            div.style.color = '#00ff00'
            div.style.background = 'rgba(0,255,0,0.12)'
        }
        const rank = document.createElement('span')
        rank.style.flexShrink = '0'
        rank.style.minWidth = '18px'
        rank.textContent = (i + 1) + '.'
        const label = document.createElement('span')
        label.style.overflow = 'hidden'
        label.style.textOverflow = 'ellipsis'
        label.style.whiteSpace = 'nowrap'
        label.style.display = 'flex'
        label.style.alignItems = 'center'
        label.style.gap = '4px'
        const icons = []
        if (bountyPlayerId === p.playerId) icons.push(BOUNTY_ICON)
        if (p.feedStreak) icons.push(FEED_STREAK_ICON)
        label.textContent = (icons.length ? icons.join(' ') + ' ' : '') + shortName
        const score = document.createElement('span')
        score.style.flexShrink = '0'
        score.style.fontWeight = '600'
        score.textContent = String(len)
        div.appendChild(rank)
        div.appendChild(label)
        div.appendChild(score)
        leaderboardEl.appendChild(div)
    })
}

function getFoodColor(food) {
    switch (food.foodType) {
        case FOOD_TYPES[0]: return FOOD_COLOR
        case FOOD_TYPES[1]: return FOOD_COLOR_POISON
        case FOOD_TYPES[2]: return FOOD_COLOR_SUPER
        case FOOD_TYPES[3]: return FOOD_COLOR_FRENZY
        case 'STAR': return FOOD_COLOR_STAR
        case 'SPEED': return FOOD_COLOR_SPEED
        case 'MAGNET': return FOOD_COLOR_MAGNET
        case 'REVERSE': return FOOD_COLOR_REVERSE
        case 'BIG': return FOOD_COLOR_BIG
    }
    return FOOD_COLOR
}

function paintBigPowerUp(sx, sy, cellSizePx) {
    const cx = sx + cellSizePx / 2
    const cy = sy + cellSizePx / 2
    const r = cellSizePx * 0.45
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#f5b041')
    grad.addColorStop(0.6, FOOD_COLOR_BIG)
    grad.addColorStop(1, '#924e0e')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f5b041'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = (cellSizePx * 0.7) + 'px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('⬛', cx, cy)
}

function paintReversePowerUp(sx, sy, cellSizePx) {
    const cx = sx + cellSizePx / 2
    const cy = sy + cellSizePx / 2
    const r = cellSizePx * 0.42
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#76d7c4')
    grad.addColorStop(0.6, FOOD_COLOR_REVERSE)
    grad.addColorStop(1, '#0e6655')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#76d7c4'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(1.5, cellSizePx * 0.12)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.6, Math.PI * 0.25, Math.PI * 1.75)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + r * 0.5, cy - r * 0.35)
    ctx.lineTo(cx + r * 0.25, cy - r * 0.1)
    ctx.lineTo(cx + r * 0.5, cy + r * 0.15)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.5, cy + r * 0.35)
    ctx.lineTo(cx - r * 0.25, cy + r * 0.1)
    ctx.lineTo(cx - r * 0.5, cy - r * 0.15)
    ctx.stroke()
}

function paintStarPowerUp(sx, sy, cellSizePx) {
    const cx = sx + cellSizePx / 2
    const cy = sy + cellSizePx / 2
    const r = cellSizePx * 0.45
    const t = Date.now() / 60
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, STAR_GOLD_LIGHT)
    grad.addColorStop(0.5, STAR_GOLD)
    grad.addColorStop(1, '#b7950b')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = STAR_GOLD_LIGHT
    ctx.lineWidth = 1.5
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
        const a = t + i * (Math.PI / 3)
        const px = cx + Math.cos(a) * r * 0.7
        const py = cy + Math.sin(a) * r * 0.7
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.arc(px, py, cellSizePx * 0.1, 0, Math.PI * 2)
        ctx.fill()
    }
}

function paintSpeedPowerUp(sx, sy, cellSizePx) {
    const cx = sx + cellSizePx / 2
    const cy = sy + cellSizePx / 2
    const r = cellSizePx * 0.4
    const t = Date.now() / 100
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#aed6f1')
    grad.addColorStop(0.6, FOOD_COLOR_SPEED)
    grad.addColorStop(1, '#2471a3')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#aed6f1'
    ctx.lineWidth = 1.5
    ctx.stroke()
    for (let i = 0; i < 4; i++) {
        const a = (t + i * Math.PI / 2) % (Math.PI * 2)
        const px = cx + Math.cos(a) * r * 0.6
        const py = cy + Math.sin(a) * r * 0.6
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.beginPath()
        ctx.arc(px, py, cellSizePx * 0.08, 0, Math.PI * 2)
        ctx.fill()
    }
}

function paintMagnetPowerUp(sx, sy, cellSizePx) {
    const cx = sx + cellSizePx / 2
    const cy = sy + cellSizePx / 2
    const r = cellSizePx * 0.4
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#e8daef')
    grad.addColorStop(0.6, FOOD_COLOR_MAGNET)
    grad.addColorStop(1, '#6c3483')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#e8daef'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#2c1810'
    ctx.font = (cellSizePx * 0.9) + 'px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🧲', cx, cy)
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

function runConfetti(callback) {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;'
    const c = document.createElement('canvas')
    c.width = window.innerWidth
    c.height = window.innerHeight
    overlay.appendChild(c)
    document.body.appendChild(overlay)
    const ctx = c.getContext('2d')
    const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c']
    const particles = []
    for (let i = 0; i < 70; i++) {
        particles.push({
            x: Math.random() * c.width,
            y: Math.random() * c.height,
            vx: (Math.random() - 0.5) * 8,
            vy: -(Math.random() * 6 + 4),
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 4 + Math.random() * 6
        })
    }
    const start = Date.now()
    const duration = 2500
    function tick() {
        ctx.clearRect(0, 0, c.width, c.height)
        const dt = 0.016
        for (const p of particles) {
            p.x += p.vx
            p.y += p.vy
            p.vy += 0.4
            if (p.x < 0 || p.x > c.width || p.y > c.height) continue
            ctx.fillStyle = p.color
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
        }
        if (Date.now() - start < duration) requestAnimationFrame(tick)
        else {
            overlay.remove()
            if (callback) callback()
        }
    }
    tick()
}

function handleGameOver(data) {
    if(!gameActive) return

    data = JSON.parse(data)
    gameActive = false
    lastGameState = null

    document.removeEventListener('keydown', keydown)
    document.removeEventListener('keyup', keyup)

    const winner = data && data.winner
    const msg = winner
        ? (winner.nickName || ('Player ' + winner.playerId)) + ' wins with length ' + (winner.snake ? winner.snake.length : WIN_TARGET) + '!'
        : 'Game ended'

    if (winner) {
        runConfetti(() => {
            initialScreen.style.display = 'block'
            gameScreen.style.display = 'none'
            pointsContainer.style.display = 'none'
            gameListScreen.style.display = 'none'
            alert(msg)
        })
    } else {
        initialScreen.style.display = 'block'
        gameScreen.style.display = 'none'
        pointsContainer.style.display = 'none'
        gameListScreen.style.display = 'none'
        alert(msg)
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreview)
} else {
    initPreview()
}