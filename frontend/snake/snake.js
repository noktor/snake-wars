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
const FRAME_RATE = 10
const SPEED_BOOST_FACTOR = 0.8
const STREAK_SPEED_BOOST_FACTOR = 0.35
const BOOST_SPEED_FACTOR = 0.5
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

let mySocketId = null

const gameScreen = document.getElementById('gameScreen')
const initiateScreen = document.getElementById('initialScreen')
const newGameBtn = document.getElementById('newGameButton')
const joinGameBtn2 = document.getElementById('joinGameButton2')
const gameCodeInput = document.getElementById('gameCodeInput')
const nickNameInput = document.getElementById('nickNameInput')
const gameCodeTitleDisplay = document.getElementById('gameCodeTitle')
const gameCodeDisplay = document.getElementById('gameCodeDisplay')
const pointsContainer = document.getElementById('pointsContainer')
const playerPoints = document.getElementById('playerPoints')
const buffIndicatorEl = document.getElementById('buffIndicator')
const speedDisplayEl = document.getElementById('speedDisplay')
const leaderboardEl = document.getElementById('leaderboard')
const scoreBoardContainer = document.getElementById('scoreBoardContainer')
const errorMessage = document.getElementById('errorMessage')
const gameListContainer = document.getElementById('gameListContainer')
const gameListEmpty = document.getElementById('gameListEmpty')
const gameListScreen = document.getElementById('gameListScreen')
const backButton = document.getElementById('backButton')
const leaveGameBtn = document.getElementById('leaveGameBtn')
const userListDOM = document.getElementById('userList')
const previewCanvas = document.getElementById('previewCanvas')
const colorSwatchesEl = document.getElementById('colorSwatches')
const nicknameDisplay = document.getElementById('nicknameDisplay')
const chatPanel = document.getElementById('chatPanel')
const chatTabs = document.querySelectorAll('#chatPanel .chat-tab')
const chatPrivateSidebar = document.getElementById('chatPrivateSidebar')
const chatMessages = document.getElementById('chatMessages')
const chatPlaceholder = document.getElementById('chatPlaceholder')
const chatInput = document.getElementById('chatInput')
const chatSendBtn = document.getElementById('chatSendBtn')
const musicPanel = document.getElementById('musicPanel')
const musicToggleBtn = document.getElementById('musicToggleBtn')
const musicVolume = document.getElementById('musicVolume')
const playerOptionsBackdrop = document.getElementById('playerOptionsBackdrop')
const playerOptionsPopup = document.getElementById('playerOptionsPopup')

const MUSIC_VOLUME_KEY = 'snake_wars_music_volume'
const BG_MUSIC_FILES = ['bg-music-1.mp3', 'bg-music-2.mp3', 'bg-music-3.mp3', 'bg-music-4.mp3']
const AFK_THRESHOLD_MS = 2 * 60 * 1000

let latestUserList = {}

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
socket.on('allGamesCleared', () => {
    gameActive = false
    lastGameState = null
    cachedIsNoktor = false
    initialScreen.style.display = 'none'
    gameListScreen.style.display = 'block'
    gameScreen.style.display = 'none'
    if (pointsContainer) pointsContainer.style.display = 'none'
    document.removeEventListener('keydown', keydown)
    document.removeEventListener('keyup', keyup)
    hideMusicPanelAndPause()
    socket.emit('requestGameList')
})

let chatUserList = {}
let chatTab = 'general'
let chatPrivateTargetId = null
const chatGeneralMessages = []
const chatPrivateMessages = {}

socket.on('chatGeneral', (data) => {
    if (!data || data.fromSocketId == null) return
    const text = data.text != null ? String(data.text) : ''
    chatGeneralMessages.push({ fromSocketId: data.fromSocketId, fromNickname: data.fromNickname, text, ts: data.ts, isOwn: data.fromSocketId === mySocketId })
    chatRenderMessages()
})
socket.on('chatPrivate', (data) => {
    if (!data || data.fromSocketId == null) return
    const text = data.text != null ? String(data.text) : ''
    const key = data.fromSocketId
    if (!chatPrivateMessages[key]) chatPrivateMessages[key] = []
    chatPrivateMessages[key].push({ fromSocketId: data.fromSocketId, fromNickname: data.fromNickname, text, ts: data.ts, isOwn: false })
    chatRenderMessages()
})

function chatRenderMessages() {
    if (!chatMessages) return
    if (chatTab === 'general') {
        chatMessages.style.display = 'block'
        if (chatPlaceholder) chatPlaceholder.style.display = 'none'
        chatMessages.innerHTML = chatGeneralMessages.map(m => {
            const time = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const body = escapeHtml(m.text != null ? String(m.text) : '')
            return '<div class="chat-msg ' + (m.isOwn ? 'own' : '') + '"><span class="chat-msg-author">' + escapeHtml(m.fromNickname || 'Anonymous') + '</span><span class="chat-msg-time">' + time + '</span><div class="chat-msg-body">' + body + '</div></div>'
        }).join('')
    } else {
        if (chatPrivateTargetId) {
            chatMessages.style.display = 'block'
            if (chatPlaceholder) chatPlaceholder.style.display = 'none'
            const list = chatPrivateMessages[chatPrivateTargetId] || []
            const myNick = (nickNameInput && nickNameInput.value) ? nickNameInput.value.trim() : 'Me'
            const theirNick = (chatUserList[chatPrivateTargetId] && chatUserList[chatPrivateTargetId].nickName) ? String(chatUserList[chatPrivateTargetId].nickName).trim() : 'Unknown'
            chatMessages.innerHTML = list.map(m => {
                const time = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const author = m.fromSocketId === mySocketId ? myNick : theirNick
                const body = escapeHtml(m.text != null ? String(m.text) : '')
                return '<div class="chat-msg ' + (m.isOwn ? 'own' : '') + '"><span class="chat-msg-author">' + escapeHtml(author) + '</span><span class="chat-msg-time">' + time + '</span><div class="chat-msg-body">' + body + '</div></div>'
            }).join('')
        } else {
            chatMessages.style.display = 'none'
            if (chatPlaceholder) chatPlaceholder.style.display = 'block'
        }
    }
    chatMessages.scrollTop = chatMessages.scrollHeight
}
function escapeHtml(s) {
    if (s == null) return ''
    const div = document.createElement('div')
    div.textContent = s
    return div.innerHTML
}
function chatSend() {
    const text = chatInput && chatInput.value ? chatInput.value.trim() : ''
    if (!text) return
    if (chatTab === 'general') {
        socket.emit('chatGeneral', text)
        // Server broadcasts to all including us, so message appears via chatGeneral
    } else if (chatPrivateTargetId) {
        socket.emit('chatPrivate', { toSocketId: chatPrivateTargetId, text })
        if (!chatPrivateMessages[chatPrivateTargetId]) chatPrivateMessages[chatPrivateTargetId] = []
        chatPrivateMessages[chatPrivateTargetId].push({ fromSocketId: mySocketId, fromNickname: (nickNameInput && nickNameInput.value) ? nickNameInput.value.trim() : 'Me', text, ts: Date.now(), isOwn: true })
    }
    if (chatInput) chatInput.value = ''
    chatRenderMessages()
}
function chatRenderPrivateSidebar() {
    if (!chatPrivateSidebar) return
    chatPrivateSidebar.innerHTML = ''
    const entries = Object.entries(chatUserList).filter(([id]) => id !== mySocketId && id != null)
    entries.forEach(([id, u]) => {
        const name = (u.nickName != null && u.nickName !== '') ? String(u.nickName) : 'Anonymous'
        const el = document.createElement('div')
        el.className = 'chat-user' + (id === chatPrivateTargetId ? ' active' : '')
        el.textContent = name
        el.dataset.socketId = id
        el.addEventListener('click', () => {
            chatPrivateTargetId = id
            chatRenderPrivateSidebar()
            chatRenderMessages()
        })
        chatPrivateSidebar.appendChild(el)
    })
}

if (chatTabs && chatTabs.length) {
    chatTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            chatTab = tab.dataset.tab || 'general'
            chatTabs.forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            if (chatTab === 'private') {
                if (chatPrivateSidebar) chatPrivateSidebar.style.display = 'block'
                chatRenderPrivateSidebar()
            } else {
                if (chatPrivateSidebar) chatPrivateSidebar.style.display = 'none'
            }
            chatRenderMessages()
        })
    })
}
if (chatSendBtn) chatSendBtn.addEventListener('click', chatSend)
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatSend() }
    })
}
const chatHeader = document.getElementById('chatHeader')
const chatToggleBtn = document.getElementById('chatToggleBtn')
if (chatPanel && chatHeader) {
    chatHeader.addEventListener('click', (e) => {
        if (e.target === chatToggleBtn) return
        chatPanel.classList.remove('chat-minimized')
    })
}
if (chatPanel && chatToggleBtn) {
    chatToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        chatPanel.classList.toggle('chat-minimized')
    })
}
function chatUpdateUserList(list) {
    chatUserList = list && typeof list === 'object' ? list : {}
    if (chatTab === 'private') chatRenderPrivateSidebar()
}

const NICKNAME_KEY = 'snake_wars_nickname'
const MAX_NICKNAME_LENGTH = 30
try {
  const nick = (sessionStorage.getItem(NICKNAME_KEY) || '').trim().slice(0, MAX_NICKNAME_LENGTH)
  if (!nick) { window.location.href = '../index.html'; throw new Error('redirect') }
  if (nickNameInput) nickNameInput.value = nick
  if (nicknameDisplay) nicknameDisplay.textContent = nick
  // Send nickname to server immediately so user list and game show correct name (not Anonymous)
  socket.emit('nickname', nick)
} catch (e) { if (e.message !== 'redirect') throw e }

socket.on('connect', () => {
  mySocketId = socket.id
  if (nickNameInput && nickNameInput.value) socket.emit('nickname', nickNameInput.value)
})

newGameBtn.addEventListener('click', newGame)
joinGameBtn2.addEventListener('click', showGameList)
if (backButton) backButton.addEventListener('click', returnHome)
if (leaveGameBtn) leaveGameBtn.addEventListener('click', leaveGame)

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
const aiModeBtn = document.getElementById('aiModeBtn')
const hackBtn = document.getElementById('hackBtn')
const hackFunnyBtn = document.getElementById('hackFunnyBtn')
const aiNormaliseBtn = document.getElementById('aiNormaliseBtn')
const noktorPanel = document.getElementById('noktorPanel')
const powerButtonsContainer = document.getElementById('powerButtonsContainer')
const noktorAIContainer = document.getElementById('noktorAIContainer')
const noktorDeleteAllGamesBtn = document.getElementById('noktorDeleteAllGamesBtn')
if (noktorDeleteAllGamesBtn) {
    noktorDeleteAllGamesBtn.style.display = (nickNameInput && nickNameInput.value.trim() === 'Noktor') ? 'block' : 'none'
    noktorDeleteAllGamesBtn.addEventListener('click', () => {
        if (confirm('Delete all games? This will end every active game and clear server state.')) socket.emit('noktorDeleteAllGames')
    })
}
if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn)
if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut)
if (aiModeBtn) aiModeBtn.addEventListener('click', () => { if (gameActive) socket.emit('toggleAIMode') })
if (hackBtn) hackBtn.addEventListener('click', () => { if (gameActive) socket.emit('hack') })
if (hackFunnyBtn) hackFunnyBtn.addEventListener('click', () => { if (gameActive) socket.emit('hackFunny') })
if (aiNormaliseBtn) aiNormaliseBtn.addEventListener('click', () => { if (gameActive) socket.emit('aiNormalise') })

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

function isUserAfk(user) {
    if (!user || user.lastActivity == null) return true
    return (Date.now() - Number(user.lastActivity)) > AFK_THRESHOLD_MS
}

function openPlayerOptionsPopup(userId, anchorElement) {
    const user = latestUserList[userId]
    if (!user || !playerOptionsPopup || !playerOptionsBackdrop) return
    const nameEl = playerOptionsPopup.querySelector('.popup-name')
    const statusEl = playerOptionsPopup.querySelector('.popup-status')
    const actionsEl = playerOptionsPopup.querySelector('.popup-actions')
    if (!nameEl || !statusEl || !actionsEl) return
    const displayName = (user.nickName != null && user.nickName !== '') ? String(user.nickName) : 'Anonymous'
    nameEl.textContent = displayName
    const afk = isUserAfk(user)
    statusEl.textContent = afk ? 'AFK (inactiu)' : 'En línia'
    statusEl.className = 'popup-status ' + (afk ? 'status-afk' : 'status-online')
    actionsEl.innerHTML = ''
    const canJoin = !gameActive && user.gameCode && user.id !== mySocketId
    if (canJoin) {
        const joinBtn = document.createElement('button')
        joinBtn.type = 'button'
        joinBtn.className = 'join-game-btn'
        joinBtn.textContent = 'Join game'
        joinBtn.onclick = () => {
            closePlayerOptionsPopup()
            joinGameByCode(user.gameCode)
        }
        actionsEl.appendChild(joinBtn)
    }
    playerOptionsBackdrop.classList.add('show')
    playerOptionsPopup.classList.add('show')
    const gap = 8
    const pw = playerOptionsPopup.offsetWidth || 220
    const ph = playerOptionsPopup.offsetHeight || 120
    if (anchorElement && typeof anchorElement.getBoundingClientRect === 'function') {
        const anchorRect = anchorElement.getBoundingClientRect()
        let left = anchorRect.left + (anchorRect.width / 2) - (pw / 2)
        let top = anchorRect.top - ph - gap
        if (left < 12) left = 12
        if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12
        if (top < 12) top = anchorRect.bottom + gap
        playerOptionsPopup.style.left = left + 'px'
        playerOptionsPopup.style.top = top + 'px'
    } else {
        playerOptionsPopup.style.left = (window.innerWidth / 2 - pw / 2) + 'px'
        playerOptionsPopup.style.top = (window.innerHeight / 2 - ph / 2) + 'px'
    }
}

function closePlayerOptionsPopup() {
    if (playerOptionsBackdrop) playerOptionsBackdrop.classList.remove('show')
    if (playerOptionsPopup) playerOptionsPopup.classList.remove('show')
}

function handleUpdateUserList(userListPayload) {
    chatUpdateUserList(userListPayload)
    latestUserList = userListPayload && typeof userListPayload === 'object' ? userListPayload : {}
    if (!userListDOM) return
    userListDOM.innerHTML = ''
    if (!userListPayload || typeof userListPayload !== 'object') return
    const entries = Object.values(userListPayload).filter(u => u && u.id)
    entries.forEach((user) => {
        const li = document.createElement('li')
        li.className = 'user-item'
        li.dataset.userId = user.id
        const nameSpan = document.createElement('span')
        nameSpan.textContent = (user.nickName != null && user.nickName !== '') ? String(user.nickName) : 'Anonymous'
        li.appendChild(nameSpan)
        const statusSpan = document.createElement('span')
        statusSpan.className = 'user-item-status ' + (isUserAfk(user) ? 'status-afk' : 'status-online')
        statusSpan.textContent = isUserAfk(user) ? 'AFK' : 'En línia'
        li.appendChild(statusSpan)
        li.addEventListener('click', (e) => {
            e.preventDefault()
            openPlayerOptionsPopup(user.id, li)
        })
        userListDOM.appendChild(li)
    })
    if (entries.length === 0) {
        const li = document.createElement('li')
        li.className = 'user-item'
        li.style.color = '#888'
        li.textContent = 'No one connected'
        userListDOM.appendChild(li)
    }
}

function returnHome(){
    window.location.href = '../index.html'
}

function leaveGame() {
    socket.emit('leaveGame')
    gameActive = false
    lastGameState = null
    cachedIsNoktor = false
    initialScreen.style.display = 'block'
    gameListScreen.style.display = 'none'
    gameScreen.style.display = 'none'
    pointsContainer.style.display = 'none'
    document.removeEventListener('keydown', keydown)
    hideMusicPanelAndPause()
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

function joinGameByCode(gameCode) {
    if (!gameCode || nickNameInput.value.length === 0) {
        if (errorMessage) errorMessage.innerText = 'Nickname can\'t be empty'
        return
    }
    if (errorMessage) errorMessage.innerText = ''
    socket.emit('joinGame', {
        gameCode: String(gameCode),
        nickName: nickNameInput.value,
        color: selectedColor,
        skinId: selectedSkinId
    })
    init()
}

let canvas, ctx
let minimapCanvas, minimapCtx
let playerNumber
let gameActive = false
let lastGameState = null
let cachedIsNoktor = false
let fartTremblePlayerId = null
let fartTrembleUntil = 0
let bgMusicAudio = null
let bgMusicPausedByUser = false
let bgMusicTriedThisRound = new Set()
let bgMusicCurrentFile = ''

const MINIMAP_SIZE = 120

function pickRandomBgMusicFile() {
    return BG_MUSIC_FILES[Math.floor(Math.random() * BG_MUSIC_FILES.length)]
}

function pickUntriedBgMusicFile() {
    const untried = BG_MUSIC_FILES.filter(f => !bgMusicTriedThisRound.has(f))
    if (untried.length === 0) return null
    return untried[Math.floor(Math.random() * untried.length)]
}

function playNextBgTrack() {
    if (!bgMusicAudio || bgMusicPausedByUser) return
    const file = bgMusicTriedThisRound.size < BG_MUSIC_FILES.length ? pickUntriedBgMusicFile() : null
    if (!file) {
        pauseBgMusic()
        return
    }
    bgMusicCurrentFile = file
    bgMusicAudio.src = file
    bgMusicAudio.volume = (musicVolume && musicVolume.value != null) ? Number(musicVolume.value) / 100 : 0.7
    bgMusicAudio.play().then(() => { bgMusicTriedThisRound.clear() }).catch(() => {})
}

function onBgMusicError() {
    if (bgMusicCurrentFile) bgMusicTriedThisRound.add(bgMusicCurrentFile)
    playNextBgTrack()
}

function startBgMusic() {
    if (!musicPanel || !musicToggleBtn || !musicVolume) return
    if (!bgMusicAudio) {
        bgMusicAudio = new Audio()
        bgMusicAudio.addEventListener('ended', () => { playNextBgTrack() })
        bgMusicAudio.addEventListener('error', onBgMusicError)
    }
    bgMusicPausedByUser = false
    bgMusicTriedThisRound.clear()
    const vol = (musicVolume.value != null && musicVolume.value !== '') ? Number(musicVolume.value) / 100 : 0.7
    bgMusicAudio.volume = vol
    playNextBgTrack()
    musicToggleBtn.textContent = '❚❚ Pause'
    musicToggleBtn.classList.add('music-playing')
}

function pauseBgMusic() {
    bgMusicPausedByUser = true
    if (bgMusicAudio) bgMusicAudio.pause()
    if (musicToggleBtn) {
        musicToggleBtn.textContent = '▶ Play'
        musicToggleBtn.classList.remove('music-playing')
    }
}

function hideMusicPanelAndPause() {
    if (musicPanel) musicPanel.style.display = 'none'
    if (bgMusicAudio) bgMusicAudio.pause()
}

if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', () => {
        if (bgMusicPausedByUser) startBgMusic()
        else pauseBgMusic()
    })
}
if (musicVolume) {
    try {
        const saved = localStorage.getItem(MUSIC_VOLUME_KEY)
        if (saved != null) { const v = Math.min(100, Math.max(0, Number(saved))); if (!isNaN(v)) musicVolume.value = v }
    } catch (e) {}
    musicVolume.addEventListener('input', () => {
        const v = Math.min(1, Math.max(0, Number(musicVolume.value) / 100))
        if (bgMusicAudio) bgMusicAudio.volume = v
        try { localStorage.setItem(MUSIC_VOLUME_KEY, musicVolume.value) } catch (e) {}
    })
}
if (playerOptionsBackdrop) {
    playerOptionsBackdrop.addEventListener('click', closePlayerOptionsPopup)
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && playerOptionsPopup && playerOptionsPopup.classList.contains('show')) closePlayerOptionsPopup()
})

function init() {
    initialScreen.style.display = 'none'
    gameListScreen.style.display = 'none'
    gameScreen.style.display = 'block'
    pointsContainer.style.display = 'block'
    if (musicPanel) musicPanel.style.display = 'block'
    try {
        const saved = localStorage.getItem(MUSIC_VOLUME_KEY)
        if (saved != null && musicVolume) {
            const v = Math.min(100, Math.max(0, Number(saved)))
            if (!isNaN(v)) musicVolume.value = v
        }
    } catch (e) {}
    startBgMusic()
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
    const active = document.activeElement
    const tag = active && active.tagName ? active.tagName.toUpperCase() : ''
    const isTyping = active && (tag === 'INPUT' || tag === 'TEXTAREA' || (active.isContentEditable && active.closest('#chatPanel')) || active.closest('#chatPanel'))
    if (isTyping) return
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
    const active = document.activeElement
    const tag = active && active.tagName ? active.tagName.toUpperCase() : ''
    const isTyping = active && (tag === 'INPUT' || tag === 'TEXTAREA' || (active.isContentEditable && active.closest('#chatPanel')) || active.closest('#chatPanel'))
    if (isTyping) return
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
    if (aiModeBtn && me) {
        aiModeBtn.textContent = me.aiModeEnabled ? 'AI mode: ON' : 'AI mode'
        aiModeBtn.style.background = me.aiModeEnabled ? '#1a4d1a' : '#2a2a2a'
    }
    const occupancy = me && !me.dead ? getOccupancyFromPlayer(me) : 1
    const { w: vw, h: vh } = getViewportCells(occupancy)
    if (!me || me.dead) {
        ctx.fillStyle = BG_COLOR
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        updateSpeedDisplay(me || null)
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
    if (state.boss) {
        paintBossViewport(state.boss, cameraX, cameraY, cellSizePx, vw, vh)
        updateBossHonkSound(state.boss, cameraX, cameraY, vw, vh)
    }
    for (const player of alive) {
        paintPlayerName(player, cameraX, cameraY, cellSizePx, vw, vh, state)
    }

    paintBoundaries(gridSize, cameraX, cameraY, cellSizePx, vw, vh, me)

    const myLength = me.snake ? me.snake.length : 0
    playerPoints.textContent = 'Length: ' + myLength + ' / ' + WIN_TARGET
    updateSpeedDisplay(me)
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
    if (state.boss && state.boss.pos) {
        minimapCtx.fillStyle = BOSS_HEAD_COLOR
        const bossOcc = state.boss.occupancy || BOSS_OCCUPANCY
        const bossCells = [state.boss.pos, ...(state.boss.snake || [])]
        for (const cell of bossCells) {
            const mx = (cell.x + (bossOcc - 1) / 2) * scale
            const my = (cell.y + (bossOcc - 1) / 2) * scale
            minimapCtx.fillRect(mx - 1, my - 1, 3, 3)
        }
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

const BOSS_OCCUPANCY = 5
const BOSS_COLOR = '#4a0e0e'
const BOSS_HEAD_COLOR = '#8b0000'
let bossHonkAudio = null
let bossHonkPlaying = false

function paintBossViewport(boss, cameraX, cameraY, cellSizePx, vw, vh) {
    if (!boss || !ctx) return
    const occ = boss.occupancy || BOSS_OCCUPANCY
    const snake = boss.snake || []
    const headPos = boss.pos ? { x: boss.pos.x, y: boss.pos.y } : null
    if (!headPos) return
    const renderPos = snake.map((cell, i) => ({ x: cell.x, y: cell.y }))
    renderPos.push(headPos)
    const headDir = snake.length >= 1
        ? { dx: headPos.x - snake[snake.length - 1].x, dy: headPos.y - snake[snake.length - 1].y }
        : { dx: 1, dy: 0 }
    const len = Math.hypot(headDir.dx, headDir.dy) || 1
    headDir.dx /= len
    headDir.dy /= len
    ctx.fillStyle = BOSS_COLOR
    const cellW = cellSizePx + 1
    for (let i = 0; i < renderPos.length; i++) {
        const cell = renderPos[i]
        const isHead = i === renderPos.length - 1
        ctx.fillStyle = isHead ? BOSS_HEAD_COLOR : BOSS_COLOR
        for (let dx = 0; dx < occ; dx++) {
            for (let dy = 0; dy < occ; dy++) {
                const gx = cell.x + dx
                const gy = cell.y + dy
                if (!isInView(gx, gy, cameraX, cameraY, vw, vh)) continue
                const { x: sx, y: sy } = worldToScreen(gx, gy, cameraX, cameraY, cellSizePx)
                ctx.fillRect(sx, sy, cellW, cellW)
            }
        }
        if (isHead) {
            const headCenterX = cell.x + (occ - 1) / 2
            const headCenterY = cell.y + (occ - 1) / 2
            if (isInView(headCenterX, headCenterY, cameraX, cameraY, vw, vh)) {
                const sc = worldToScreen(headCenterX, headCenterY, cameraX, cameraY, cellSizePx)
                const headSize = cellSizePx * occ
                paintBossHorns(ctx, sc.x, sc.y, headSize, headDir)
            }
        }
    }
}

function paintBossHorns(ctx, cx, cy, headSizePx, dir) {
    const angle = Math.atan2(dir.dy, dir.dx)
    const hornLen = headSizePx * 0.5
    const spread = 0.4
    ctx.save()
    ctx.strokeStyle = '#2a0a0a'
    ctx.fillStyle = '#1a0505'
    ctx.lineWidth = Math.max(2, headSizePx * 0.08)
    for (const side of [-1, 1]) {
        const a = angle + side * spread
        const x1 = cx + Math.cos(a) * hornLen * 0.3
        const y1 = cy + Math.sin(a) * hornLen * 0.3
        const x2 = cx + Math.cos(a) * hornLen
        const y2 = cy + Math.sin(a) * hornLen
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x2, y2, headSizePx * 0.08, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
    }
    ctx.restore()
}

function updateBossHonkSound(boss, cameraX, cameraY, vw, vh) {
    if (!boss || !boss.pos) return
    const margin = Math.max(vw, vh) * 0.5
    const bossCenterX = boss.pos.x + (BOSS_OCCUPANCY - 1) / 2
    const bossCenterY = boss.pos.y + (BOSS_OCCUPANCY - 1) / 2
    const inView = bossCenterX >= cameraX - margin && bossCenterX < cameraX + vw + margin &&
        bossCenterY >= cameraY - margin && bossCenterY < cameraY + vh + margin
    if (inView) {
        if (!bossHonkAudio) {
            try {
                bossHonkAudio = new Audio('400894__bowlingballout__honk-alarm-repeat-loop.mp3')
                bossHonkAudio.loop = true
            } catch (e) {}
        }
        if (bossHonkAudio && !bossHonkPlaying) {
            bossHonkPlaying = true
            bossHonkAudio.play().catch(() => { bossHonkPlaying = false })
        }
    } else {
        if (bossHonkAudio && bossHonkPlaying) {
            bossHonkAudio.pause()
            bossHonkAudio.currentTime = 0
            bossHonkPlaying = false
        }
    }
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
    const headPos = (playerState.pos != null) ? { x: playerState.pos.x, y: playerState.pos.y } : (snake[snake.length - 1] ? { x: snake[snake.length - 1].x, y: snake[snake.length - 1].y } : null)
    const renderPos = snake.map((cell, i) => (i === snake.length - 1 && headPos) ? headPos : { x: cell.x, y: cell.y })
    const headDir = getHeadDirection(renderPos)
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
        const rx = renderPos[i].x
        const ry = renderPos[i].y
        for (const off of offsets) {
            const gx = rx + off.x
            const gy = ry + off.y
            if (!isInView(gx, gy, cameraX, cameraY, vw, vh)) continue
            let { x: sx, y: sy } = worldToScreen(gx, gy, cameraX, cameraY, cellSizePx)
            sx += offsetX
            sy += offsetY
            const cx = sx + cellW / 2
            const cy = sy + cellW / 2
            ctx.fillRect(sx, sy, cellW, cellW)
            if (isStar) {
                const t = (now / 80) + rx * 0.3 + ry * 0.3
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
            const headCenterX = rx + (occ - 1) / 2
            const headCenterY = ry + (occ - 1) / 2
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
    const stage = player.streakStage || 0
    if (stage >= 1) {
        const fireLabel = stage >= 3 ? '🔥🔥🔥' : (stage >= 2 ? '🔥🔥' : '🔥')
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = stage >= 3 ? '#c0392b' : (stage >= 2 ? '#d35400' : '#e67e22')
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1.5
        ctx.strokeText(fireLabel, tx, ty - 18)
        ctx.fillText(fireLabel, tx, ty - 18)
        ty -= 6
    }
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
    const me = state && state.players && state.players.find(p => p.playerId === playerNumber)
    const isNoktor = !!(me && (me.nickName || '').trim() === 'Noktor')
    const { name, color } = getAIDisplayNameAndColor(player, isNoktor)
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 2
    ctx.strokeText(name, tx, ty)
    ctx.fillStyle = color || 'rgba(255,255,255,0.75)'
    ctx.fillText(name, tx, ty)
}

function updateStaminaBar(_me) {
    // Boost now costs 1 length/sec; no stamina bar
}

function getEffectiveCellsPerSecond(me) {
    if (!me || me.dead || !me.vel || (!me.vel.x && !me.vel.y)) return 0
    const now = Date.now()
    let cellsPerTick = 1
    if ((me.speedUntil || 0) > now) cellsPerTick += SPEED_BOOST_FACTOR
    if ((me.streakSpeedUntil || 0) > now) cellsPerTick += STREAK_SPEED_BOOST_FACTOR
    if ((me.streakTripleUntil || 0) > now) cellsPerTick += 0.55
    if (me.boostHeld) cellsPerTick += BOOST_SPEED_FACTOR
    return Math.round(cellsPerTick * FRAME_RATE * 10) / 10
}

function updateSpeedDisplay(me) {
    if (!speedDisplayEl) return
    const cps = getEffectiveCellsPerSecond(me)
    if (cps <= 0) {
        speedDisplayEl.textContent = 'Speed: —'
        speedDisplayEl.style.color = '#666'
    } else {
        speedDisplayEl.textContent = 'Speed: ' + cps + ' c/s'
        speedDisplayEl.style.color = me && (me.speedUntil || 0) > Date.now() ? '#3498db' : (me && (me.streakTripleUntil || 0) > Date.now() ? '#c0392b' : (me && (me.streakSpeedUntil || 0) > Date.now() ? '#e67e22' : '#aaa'))
    }
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
        parts.push('<span style="color:#e67e22;">🔥 Streak 1 speed ' + sec + 's</span>')
    }
    if (me && (me.streakDoubleUntil || 0) > now) {
        const sec = ((me.streakDoubleUntil - now) / 1000).toFixed(1)
        parts.push('<span style="color:#d35400;">🔥🔥 x2 food ' + sec + 's</span>')
    }
    if (me && (me.streakTripleUntil || 0) > now) {
        const sec = ((me.streakTripleUntil - now) / 1000).toFixed(1)
        parts.push('<span style="color:#c0392b;">🔥🔥🔥 x3 food + speed ' + sec + 's</span>')
    }
    buffIndicatorEl.innerHTML = parts.length ? parts.join('<br>') : ''
}

const LEADERBOARD_MAX_NAME = 18
/** When local player is Noktor, AI names show level with color: blau cel (1) -> vermell (5) */
const AI_LEVEL_COLORS = ['#87CEEB', '#5dade2', '#e67e22', '#e74c3c', '#9b59b6']

function getAIDisplayNameAndColor(player, isNoktor) {
    const baseName = (player.nickName || ('Player' + player.playerId)).trim()
    if (!isNoktor || !player.isAI) return { name: baseName, color: null }
    const level = player.aiLevel || 1
    const name = baseName + ' (Nivell ' + level + ')'
    const color = AI_LEVEL_COLORS[Math.min(level - 1, AI_LEVEL_COLORS.length - 1)] || AI_LEVEL_COLORS[0]
    return { name, color }
}

const BOUNTY_ICON = '👑'
const FEED_STREAK_ICON = '🔥'
const REVENGE_TARGET_ICON = '🎯'
function updateLeaderboard(alivePlayers, state) {
    if (!leaderboardEl) return
    leaderboardEl.innerHTML = ''
    const bountyPlayerId = (state && state.bountyPlayerId) || null
    const me = state && state.players && state.players.find(pl => pl.playerId === playerNumber)
    const revengeTargetPlayerId = (me && me.revengeTargetPlayerId) || null
    const sorted = alivePlayers.slice().sort((a, b) => (b.snake ? b.snake.length : 0) - (a.snake ? a.snake.length : 0))
    const isNoktor = !!(me && (me.nickName || '').trim() === 'Noktor')
    sorted.forEach((p, i) => {
        const div = document.createElement('div')
        const { name, color: aiColor } = getAIDisplayNameAndColor(p, isNoktor)
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
        if (aiColor) label.style.color = aiColor
        const stats = p.snakeStats || {}
        label.title = 'Dodge: ' + (stats.dodge ?? 0) + ' · Attack: ' + (stats.attack ?? 0) + ' · Feed: ' + (stats.feed ?? 0)
        const icons = []
        if (bountyPlayerId === p.playerId) icons.push(BOUNTY_ICON)
        if (revengeTargetPlayerId === p.playerId) icons.push(REVENGE_TARGET_ICON)
        const stage = p.streakStage || 0
        if (stage >= 3) icons.push('🔥🔥🔥')
        else if (stage >= 2) icons.push('🔥🔥')
        else if (stage >= 1) icons.push('🔥')
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

const DEATH_TOAST_DURATION_MS = 5500

function showDeathCauseToast(message) {
    const existing = document.getElementById('deathCauseToast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'deathCauseToast'
    toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;' +
        'background:linear-gradient(135deg,#2c2c2c 0%,#1a1a1a 100%);color:#eee;' +
        'padding:12px 40px 12px 16px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.08);' +
        'font-size:15px;font-weight:500;max-width:90vw;display:flex;align-items:center;gap:12px;animation:deathToastIn 0.25s ease;'
    if (!document.getElementById('deathCauseToastStyle')) {
        const style = document.createElement('style')
        style.id = 'deathCauseToastStyle'
        style.textContent = '@keyframes deathToastIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
        document.head.appendChild(style)
    }
    const label = document.createElement('span')
    label.style.color = '#e74c3c'
    label.style.marginRight = '4px'
    label.textContent = '💀 '
    const text = document.createElement('span')
    text.textContent = message
    const close = document.createElement('button')
    close.type = 'button'
    close.innerHTML = '×'
    close.setAttribute('aria-label', 'Tancar')
    close.style.cssText = 'position:absolute;top:6px;right:8px;background:transparent;border:none;color:#888;cursor:pointer;font-size:22px;line-height:1;padding:0 6px;border-radius:4px;'
    close.onmouseover = () => { close.style.color = '#fff' }
    close.onmouseout = () => { close.style.color = '#888' }
    close.onclick = () => { toast.remove(); if (toast._timer) clearTimeout(toast._timer) }
    toast.appendChild(label)
    toast.appendChild(text)
    toast.appendChild(close)
    document.body.appendChild(toast)
    toast._timer = setTimeout(() => { toast.remove(); toast._timer = null }, DEATH_TOAST_DURATION_MS)
}

function getDeathCauseMessage(state, lastDeathCause) {
    if (!state || !state.players || !lastDeathCause || lastDeathCause.killerId == null) return null
    const killer = state.players.find(p => p.playerId === lastDeathCause.killerId)
    const name = killer ? ((killer.nickName || '').trim() || ('Player ' + killer.playerId)) : '?'
    const reason = lastDeathCause.reason || 'collision'
    return 'Col·lisió amb ' + name
}

function handleGameState(payload) {
    if(!gameActive) return
    const state = typeof payload === 'string' ? JSON.parse(payload) : payload
    if(!state || !state.players || state.players.length < 1) return
    lastGameState = state
    const me = state.players.find(p => p.playerId === playerNumber)
    cachedIsNoktor = !!(me && (me.nickName || '').trim() === 'Noktor')
    if (me && me.lastDeathCause) {
        const msg = getDeathCauseMessage(state, me.lastDeathCause)
        if (msg) showDeathCauseToast('Causa de la mort: ' + msg)
    }
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
    const winnerDisplayName = winner ? getAIDisplayNameAndColor(winner, cachedIsNoktor).name : ''
    const msg = winner
        ? winnerDisplayName + ' wins with length ' + (winner.snake ? winner.snake.length : WIN_TARGET) + '!'
        : 'Game ended'
    cachedIsNoktor = false

    if (winner) {
        runConfetti(() => {
            initialScreen.style.display = 'block'
            gameScreen.style.display = 'none'
            pointsContainer.style.display = 'none'
            gameListScreen.style.display = 'none'
            hideMusicPanelAndPause()
            alert(msg)
        })
    } else {
        initialScreen.style.display = 'block'
        gameScreen.style.display = 'none'
        pointsContainer.style.display = 'none'
        gameListScreen.style.display = 'none'
        hideMusicPanelAndPause()
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
    if (!scoreBoardContainer) return
    scoreBoardContainer.innerHTML = ''
    if (!Array.isArray(scoreBoard) || scoreBoard.length === 0) {
        const empty = document.createElement('div')
        empty.style.cssText = 'padding: 8px; color: #888; font-size: 13px; text-align: center;'
        empty.textContent = 'No wins yet'
        scoreBoardContainer.appendChild(empty)
        return
    }
    const sorted = scoreBoard.slice().sort((a, b) => (b.wins || 0) - (a.wins || 0))
    const medals = ['🥇', '🥈', '🥉']
    sorted.forEach((entry, i) => {
        const div = document.createElement('div')
        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; margin-bottom: 4px; font-size: 13px; border-radius: 6px;'
        if (i % 2 === 1) div.style.background = 'rgba(255,255,255,0.06)'
        const rank = document.createElement('span')
        rank.style.flexShrink = '0'
        rank.style.minWidth = '24px'
        rank.textContent = i < 3 ? medals[i] : (i + 1) + '.'
        const label = document.createElement('span')
        label.style.overflow = 'hidden'
        label.style.textOverflow = 'ellipsis'
        label.style.whiteSpace = 'nowrap'
        const name = (entry.nickName != null && entry.nickName !== '') ? String(entry.nickName) : 'Anonymous'
        label.textContent = name
        const winsSpan = document.createElement('span')
        winsSpan.style.cssText = 'flex-shrink: 0; font-weight: 600;'
        winsSpan.textContent = (entry.wins ?? 0) + ' win' + ((entry.wins ?? 0) === 1 ? '' : 's')
        div.appendChild(rank)
        div.appendChild(label)
        div.appendChild(winsSpan)
        scoreBoardContainer.appendChild(div)
    })
}

function handleLoadGameList(data) {
    if (!data || typeof data !== 'object') return
    const gameList = Object.keys(data).filter(function (game) { return data[game] != null })

    gameListContainer.innerHTML = ''
    if (gameListEmpty) gameListEmpty.style.display = gameList.length === 0 ? 'block' : 'none'

    for (const gameCode of gameList) {
        const card = document.createElement('div')
        card.className = 'game-card'
        card.dataset.id = gameCode
        card.innerHTML = '<span class="game-card-code">' + escapeHtml(gameCode) + '</span><span class="game-card-join">Unir-me →</span>'
        card.addEventListener('click', joinGame)
        gameListContainer.appendChild(card)
    }
}

function escapeHtml(s) {
    const div = document.createElement('div')
    div.textContent = s
    return div.innerHTML
}

function joinGame2() {
    console.log("TEST")
    console.log(this)
}

function reset() {
    playerNumber = null
    lastGameState = null
    cachedIsNoktor = false
    gameCodeDisplay.value = ''
    gameCodeInput.innerText =  ''
    initialScreen.style.display = 'block'
    pointsContainer.style.display = 'none'
    gameScreen.style.display = 'none'
    hideMusicPanelAndPause()
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreview)
} else {
    initPreview()
}