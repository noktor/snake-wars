(function () {
    const WORLD_WIDTH = 800
    const WORLD_HEIGHT = 400
    const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']

    let backendUrl = typeof window !== 'undefined' && window.SNAKE_WARS_BACKEND_URL
    if (!backendUrl || backendUrl === '__SNAKE_WARS_BACKEND_URL__') backendUrl = 'http://localhost:3000'

    const socket = io(backendUrl + '/heaveho', { path: '/socket.io' })

    const NICKNAME_KEY = 'snake_wars_nickname'
    const MAX_NICKNAME_LENGTH = 30
    try {
        const nick = (sessionStorage.getItem(NICKNAME_KEY) || '').trim().slice(0, MAX_NICKNAME_LENGTH)
        if (!nick) { window.location.href = '../index.html'; return }
        sessionStorage.setItem(NICKNAME_KEY, nick)
    } catch (e) { window.location.href = '../index.html'; return }

    const initialScreen = document.getElementById('initialScreen')
    const gameListScreen = document.getElementById('gameListScreen')
    const gameScreen = document.getElementById('gameScreen')
    const nickNameInput = document.getElementById('nickNameInput')
    const nicknameDisplay = document.getElementById('nicknameDisplay')
    const showGameListBtn = document.getElementById('showGameListBtn')
    const newGameBtn = document.getElementById('newGameBtn')
    const backBtn = document.getElementById('backBtn')
    const gameListContainer = document.getElementById('gameListContainer')
    const gameCodeDisplay = document.getElementById('gameCodeDisplay')
    const levelDisplay = document.getElementById('levelDisplay')
    const canvas = document.getElementById('canvas')
    const errorMessage = document.getElementById('errorMessage')
    const levelCompleteBanner = document.getElementById('levelCompleteBanner')
    const campaignCompleteBanner = document.getElementById('campaignCompleteBanner')
    const startGameBtn = document.getElementById('startGameBtn')

    let ctx
    let playerId = null
    let lastState = null
    let gameActive = false
    let joinedGameCode = null
    const keys = { left: false, right: false, jump: false, grab: false }

    function getPlayerColor(slotIndex) {
        return PLAYER_COLORS[slotIndex % PLAYER_COLORS.length]
    }

    function paint(state) {
        if (!ctx || !canvas || !state || !state.map) return
        const map = state.map
        const platforms = map.platforms || []
        const goal = map.goal
        const filled = state.players.filter(p => p.playerId != null)
        const camX = filled.length ? filled.reduce((s, p) => s + p.x, 0) / filled.length : WORLD_WIDTH / 2
        const viewW = WORLD_WIDTH
        const scaleX = canvas.width / viewW
        const scaleY = canvas.height / WORLD_HEIGHT
        const scale = Math.min(scaleX, scaleY)
        const screenW = viewW * scale
        const offX = (canvas.width - screenW) / 2
        const camLeft = Math.max(0, Math.min(camX - screenW / 2, WORLD_WIDTH - screenW))
        const camTop = 0

        ctx.fillStyle = '#87ceeb'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.save()
        ctx.translate(offX, 0)
        ctx.scale(scale, scale)
        ctx.translate(-camLeft, 0)

        if (goal) {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.4)'
            ctx.fillRect(goal.x, goal.y, goal.w, goal.h)
            ctx.strokeStyle = '#27ae60'
            ctx.lineWidth = 2 / scale
            ctx.strokeRect(goal.x, goal.y, goal.w, goal.h)
        }
        if (map.objectGoal) {
            const og = map.objectGoal
            ctx.fillStyle = 'rgba(155, 89, 182, 0.4)'
            ctx.fillRect(og.x, og.y, og.w, og.h)
            ctx.strokeStyle = '#8e44ad'
            ctx.lineWidth = 2 / scale
            ctx.strokeRect(og.x, og.y, og.w, og.h)
        }
        if (state.object) {
            ctx.fillStyle = '#e67e22'
            ctx.beginPath()
            ctx.arc(state.object.x, state.object.y, 18, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#d35400'
            ctx.lineWidth = 2 / scale
            ctx.stroke()
        }

        for (const p of platforms) {
            ctx.fillStyle = '#8b4513'
            ctx.fillRect(p.x, p.y, p.w, p.h)
            ctx.strokeStyle = '#654321'
            ctx.lineWidth = 1 / scale
            ctx.strokeRect(p.x, p.y, p.w, p.h)
        }

        for (const link of (state.links || [])) {
            const pa = state.players.find(p => p.playerId === link.a)
            const posA = pa ? { x: pa.x, y: pa.y } : null
            const posB = link.b === 'object'
                ? (state.object ? { x: state.object.x, y: state.object.y } : null)
                : (state.players.find(p => p.playerId === link.b) ? { x: state.players.find(p => p.playerId === link.b).x, y: state.players.find(p => p.playerId === link.b).y } : null)
            if (posA && posB) {
                ctx.strokeStyle = 'rgba(255,200,0,0.9)'
                ctx.lineWidth = 3 / scale
                ctx.beginPath()
                ctx.moveTo(posA.x, posA.y)
                ctx.lineTo(posB.x, posB.y)
                ctx.stroke()
            }
        }

        for (const p of state.players) {
            if (p.playerId == null) continue
            const color = getPlayerColor(p.slotIndex)
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(p.x, p.y, 14, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1 / scale
            ctx.stroke()
            ctx.fillStyle = '#fff'
            ctx.font = '10px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(p.nickName || 'P' + p.playerId, p.x, p.y - 20)
        }

        ctx.restore()
    }

    function sendInput() {
        socket.emit('input', {
            move: keys.right ? 1 : (keys.left ? -1 : 0),
            jump: keys.jump,
            grab: keys.grab
        })
    }

    showGameListBtn.addEventListener('click', () => {
        if (!nickNameInput.value.trim()) {
            errorMessage.textContent = 'Enter a nickname'
            return
        }
        errorMessage.textContent = ''
        initialScreen.style.display = 'none'
        gameListScreen.style.display = 'block'
        socket.emit('requestGameList')
    })

    if (nickNameInput) nickNameInput.value = (sessionStorage.getItem(NICKNAME_KEY) || '').trim().slice(0, MAX_NICKNAME_LENGTH)
    if (nicknameDisplay) nicknameDisplay.textContent = nickNameInput ? nickNameInput.value : ''

    if (backBtn) backBtn.addEventListener('click', (e) => {
        e.preventDefault()
        window.location.href = '../index.html'
    })

    newGameBtn.addEventListener('click', () => {
        if (!nickNameInput.value.trim()) {
            errorMessage.textContent = 'Enter a nickname'
            return
        }
        errorMessage.textContent = ''
        socket.emit('newGame', { nickName: nickNameInput.value })
    })

    socket.on('gameCode', (code) => {
        joinedGameCode = code
        gameCodeDisplay.textContent = code
        initialScreen.style.display = 'none'
        gameListScreen.style.display = 'none'
        gameScreen.style.display = 'block'
        gameActive = true
    })

    socket.on('init', (data) => {
        const id = typeof data === 'object' ? data.playerId : data
        playerId = id
        if (typeof data === 'object' && data.levelIndex != null) {
            if (levelDisplay) levelDisplay.textContent = (data.levelIndex + 1)
        }
        if (gameScreen.style.display !== 'block') {
            gameCodeDisplay.textContent = joinedGameCode || '—'
            initialScreen.style.display = 'none'
            gameListScreen.style.display = 'none'
            gameScreen.style.display = 'block'
            gameActive = true
        }
        if (startGameBtn && playerId === 1) startGameBtn.style.display = 'inline-block'
    })

    socket.on('gameState', (payload) => {
        try {
            lastState = typeof payload === 'string' ? JSON.parse(payload) : payload
            if (levelDisplay && lastState.levelIndex != null) levelDisplay.textContent = lastState.levelIndex + 1
            if (startGameBtn) {
                startGameBtn.style.display = (playerId === 1 && lastState && !lastState.started) ? 'inline-block' : 'none'
            }
            if (gameActive && lastState) requestAnimationFrame(() => paint(lastState))
        } catch (e) {}
    })

    socket.on('levelComplete', (data) => {
        if (levelCompleteBanner) {
            levelCompleteBanner.style.display = 'block'
            levelCompleteBanner.textContent = 'Level ' + (data.levelIndex + 1) + ' complete!'
            setTimeout(() => { levelCompleteBanner.style.display = 'none' }, 3000)
        }
    })

    socket.on('campaignComplete', () => {
        gameActive = false
        if (campaignCompleteBanner) campaignCompleteBanner.style.display = 'block'
    })

    socket.on('loadGameList', (list) => {
        gameListContainer.innerHTML = ''
        if (!list || typeof list !== 'object') return
        for (const code of Object.keys(list)) {
            const info = list[code]
            const el = document.createElement('div')
            el.className = 'joinGameContainer'
            el.textContent = code + ' (' + (info.playerCount || 0) + '/4)'
            el.dataset.code = code
            el.addEventListener('click', function () {
                if (!nickNameInput.value.trim()) {
                    errorMessage.textContent = 'Enter a nickname'
                    return
                }
                errorMessage.textContent = ''
                joinedGameCode = this.dataset.code
                socket.emit('joinGame', { gameCode: this.dataset.code, nickName: nickNameInput.value })
            })
            gameListContainer.appendChild(el)
        }
    })

    socket.on('unknownGame', () => { errorMessage.textContent = 'Unknown or invalid game' })
    socket.on('tooManyPlayers', () => { errorMessage.textContent = 'Game is full (4 players)' })

    document.addEventListener('keydown', (e) => {
        if (!gameActive) return
        if (e.code === 'ArrowLeft' || e.key === 'a') keys.left = true
        if (e.code === 'ArrowRight' || e.key === 'd') keys.right = true
        if (e.code === 'Space' || e.key === ' ') { keys.jump = true; e.preventDefault() }
        if (e.key === 'e' || e.key === 'E') { keys.grab = true; e.preventDefault() }
        sendInput()
    })
    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.key === 'a') keys.left = false
        if (e.code === 'ArrowRight' || e.key === 'd') keys.right = false
        if (e.code === 'Space' || e.key === ' ') { keys.jump = false; e.preventDefault() }
        if (e.key === 'e' || e.key === 'E') {
            keys.grab = false
            e.preventDefault()
            socket.emit('releaseGrab')
        }
        sendInput()
    })

    setInterval(() => { if (gameActive) sendInput() }, 50)

    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            if (playerId === 1) socket.emit('startLevel')
        })
    }

    function init() {
        if (canvas) ctx = canvas.getContext('2d')
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
    } else {
        init()
    }
})()
