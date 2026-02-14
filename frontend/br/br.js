(function () {
    const MAP_BG = '#2d4a2e'
    const OBSTACLE_COLOR = '#4a3728'
    const ZONE_COLOR = 'rgba(255, 200, 0, 0.15)'
    const ZONE_STROKE = 'rgba(255, 200, 0, 0.5)'
    const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e']
    const VIEW_WIDTH = 500
    const VIEW_HEIGHT = 500
    const MINIMAP_SIZE = 120

    let backendUrl = typeof window !== 'undefined' && window.SNAKE_WARS_BACKEND_URL
    if (!backendUrl || backendUrl === '__SNAKE_WARS_BACKEND_URL__') backendUrl = 'http://localhost:3000'

    const socket = io(backendUrl + '/br', { path: '/socket.io' })

    const initialScreen = document.getElementById('initialScreen')
    const gameListScreen = document.getElementById('gameListScreen')
    const gameScreen = document.getElementById('gameScreen')
    const nickNameInput = document.getElementById('nickNameInput')
    const showGameListBtn = document.getElementById('showGameListBtn')
    const newGameBtn = document.getElementById('newGameBtn')
    const backBtn = document.getElementById('backBtn')
    const gameListContainer = document.getElementById('gameListContainer')
    const gameCodeDisplay = document.getElementById('gameCodeDisplay')
    const canvas = document.getElementById('canvas')
    const minimap = document.getElementById('minimap')
    const healthBar = document.getElementById('healthBar')
    const errorMessage = document.getElementById('errorMessage')
    const winnerBanner = document.getElementById('winnerBanner')

    let ctx, minimapCtx
    let playerId = null
    let lastState = null
    let gameActive = false
    const keys = { w: false, a: false, s: false, d: false }

    function getPlayerColor(id) {
        return PLAYER_COLORS[(id - 1) % PLAYER_COLORS.length]
    }

    function worldToScreen(wx, wy, camX, camY, scale) {
        return {
            x: (wx - camX) * scale,
            y: (wy - camY) * scale
        }
    }

    function paint(state) {
        if (!ctx || !canvas || !state || !state.players) return
        const me = state.players.find(p => p.playerId === playerId)
        if (!me || me.dead) {
            ctx.fillStyle = MAP_BG
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            if (state.players.some(p => !p.dead)) {
                ctx.fillStyle = '#fff'
                ctx.font = '24px sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText('You died. Waiting for winner...', canvas.width / 2, canvas.height / 2)
            }
            paintMinimap(state, state.mapWidth / 2, state.mapHeight / 2)
            return
        }

        const scale = Math.min(canvas.width / VIEW_WIDTH, canvas.height / VIEW_HEIGHT)
        const camX = me.x - VIEW_WIDTH / 2
        const camY = me.y - VIEW_HEIGHT / 2

        ctx.fillStyle = MAP_BG
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.scale(scale, scale)
        ctx.translate(-me.x, -me.y)

        ctx.fillStyle = ZONE_COLOR
        ctx.beginPath()
        ctx.arc(state.zoneCenterX, state.zoneCenterY, state.zoneRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = ZONE_STROKE
        ctx.lineWidth = 2 / scale
        ctx.stroke()

        for (const o of (state.obstacles || [])) {
            ctx.fillStyle = OBSTACLE_COLOR
            ctx.fillRect(o.x, o.y, o.w, o.h)
        }

        for (const item of (state.loot || [])) {
            ctx.fillStyle = item.type === 'weapon_rifle' ? '#8b4513' : '#2ecc71'
            ctx.beginPath()
            ctx.arc(item.x, item.y, 10, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1 / scale
            ctx.stroke()
        }

        for (const p of state.players) {
            if (p.dead) continue
            const color = p.color || getPlayerColor(p.playerId)
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(p.x, p.y, 14, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1 / scale
            ctx.stroke()
            if (p.angle !== undefined) {
                ctx.strokeStyle = '#fff'
                ctx.lineWidth = 2 / scale
                ctx.beginPath()
                ctx.moveTo(p.x, p.y)
                ctx.lineTo(p.x + Math.cos(p.angle) * 25, p.y + Math.sin(p.angle) * 25)
                ctx.stroke()
            }
        }

        for (const proj of (state.projectiles || [])) {
            ctx.fillStyle = '#ff0'
            ctx.beginPath()
            ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.restore()

        if (healthBar) healthBar.textContent = 'Health: ' + Math.max(0, Math.round(me.health)) + '  |  Weapon: ' + (me.weapon === 'rifle' ? 'Rifle' : 'Melee')
        paintMinimap(state, me.x, me.y)
        paintPlayerNames(state, me, scale, camX, camY)
    }

    function paintPlayerNames(state, me, scale, camX, camY) {
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.scale(scale, scale)
        ctx.translate(-me.x, -me.y)
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.lineWidth = 1 / scale
        for (const p of state.players) {
            if (p.dead) continue
            const name = p.nickName || ('Player' + p.playerId)
            ctx.strokeText(name, p.x, p.y - 22)
            ctx.fillText(name, p.x, p.y - 22)
        }
        ctx.restore()
    }

    function paintMinimap(state, camX, camY) {
        if (!minimap || !minimapCtx) return
        const mw = state.mapWidth || 2000
        const mh = state.mapHeight || 2000
        const scale = MINIMAP_SIZE / Math.max(mw, mh)
        minimapCtx.fillStyle = MAP_BG
        minimapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
        minimapCtx.strokeStyle = ZONE_STROKE
        minimapCtx.beginPath()
        minimapCtx.arc(state.zoneCenterX * scale, state.zoneCenterY * scale, state.zoneRadius * scale, 0, Math.PI * 2)
        minimapCtx.stroke()
        for (const o of (state.obstacles || [])) {
            minimapCtx.fillStyle = OBSTACLE_COLOR
            minimapCtx.fillRect(o.x * scale, o.y * scale, o.w * scale, o.h * scale)
        }
        for (const poi of (state.pois || [])) {
            minimapCtx.fillStyle = 'rgba(255,255,255,0.2)'
            minimapCtx.fillRect(poi.x * scale, poi.y * scale, (poi.w || 20) * scale, (poi.h || 20) * scale)
            minimapCtx.font = '6px sans-serif'
            minimapCtx.fillStyle = 'rgba(255,255,255,0.7)'
            minimapCtx.textAlign = 'center'
            minimapCtx.fillText(poi.name || poi.id, (poi.x + (poi.w || 20) / 2) * scale, (poi.y + (poi.h || 20) / 2) * scale - 4)
        }
        for (const item of (state.loot || [])) {
            minimapCtx.fillStyle = item.type === 'weapon_rifle' ? '#8b4513' : '#2ecc71'
            minimapCtx.fillRect(item.x * scale, item.y * scale, 2, 2)
        }
        for (const p of state.players) {
            if (p.dead) continue
            minimapCtx.fillStyle = p.color || getPlayerColor(p.playerId)
            minimapCtx.beginPath()
            minimapCtx.arc(p.x * scale, p.y * scale, 2, 0, Math.PI * 2)
            minimapCtx.fill()
        }
        minimapCtx.strokeStyle = '#fff'
        minimapCtx.lineWidth = 1
        minimapCtx.strokeRect(camX * scale - 20, camY * scale - 20, 40, 40)
    }

    let lastAngle = 0
    function sendMove() {
        let dx = 0, dy = 0
        if (keys.w) dy -= 1
        if (keys.s) dy += 1
        if (keys.a) dx -= 1
        if (keys.d) dx += 1
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy) || 1
            dx /= len
            dy /= len
        }
        socket.emit('move', { x: dx, y: dy, angle: lastAngle })
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

    backBtn.addEventListener('click', () => {
        gameListScreen.style.display = 'none'
        initialScreen.style.display = 'block'
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

    socket.on('init', (id) => {
        playerId = id
        if (gameScreen.style.display !== 'block') {
            gameCodeDisplay.textContent = joinedGameCode || '—'
            initialScreen.style.display = 'none'
            gameListScreen.style.display = 'none'
            gameScreen.style.display = 'block'
            gameActive = true
        }
    })

    socket.on('gameState', (payload) => {
        try {
            lastState = typeof payload === 'string' ? JSON.parse(payload) : payload
            if (gameActive && lastState) requestAnimationFrame(() => paint(lastState))
        } catch (e) {}
    })

    socket.on('gameOver', (payload) => {
        gameActive = false
        try {
            const data = typeof payload === 'string' ? JSON.parse(payload) : payload
            if (winnerBanner) {
                winnerBanner.style.display = 'block'
                winnerBanner.textContent = data.winner ? (data.winner.nickName || 'Player' + data.winner.playerId) + ' wins!' : 'Game over'
            }
        } catch (e) {}
    })

    let joinedGameCode = null
    socket.on('loadGameList', (list) => {
        gameListContainer.innerHTML = ''
        if (!list || typeof list !== 'object') return
        for (const code of Object.keys(list)) {
            const el = document.createElement('div')
            el.className = 'joinGameContainer'
            el.textContent = code
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

    socket.on('unknownGame', () => {
        errorMessage.textContent = 'Unknown or invalid game'
    })
    socket.on('tooManyPlayers', () => {
        errorMessage.textContent = 'Game is full'
    })

    document.addEventListener('keydown', (e) => {
        if (!gameActive) return
        const k = e.key.toLowerCase()
        if (k === 'w') keys.w = true
        if (k === 's') keys.s = true
        if (k === 'a') keys.a = true
        if (k === 'd') keys.d = true
        if (['w', 'a', 's', 'd'].includes(k)) {
            e.preventDefault()
            sendMove()
        }
    })
    document.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase()
        if (k === 'w') keys.w = false
        if (k === 's') keys.s = false
        if (k === 'a') keys.a = false
        if (k === 'd') keys.d = false
        if (['w', 'a', 's', 'd'].includes(k)) {
            e.preventDefault()
            sendMove()
        }
    })

    setInterval(() => {
        if (gameActive) sendMove()
    }, 50)

    canvas.addEventListener('mousemove', (e) => {
        if (!gameActive || !lastState) return
        const me = lastState.players.find(p => p.playerId === playerId)
        if (!me || me.dead) return
        const rect = canvas.getBoundingClientRect()
        const scale = Math.min(canvas.width / VIEW_WIDTH, canvas.height / VIEW_HEIGHT)
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
        const my = (e.clientY - rect.top) * (canvas.height / rect.height)
        const wx = (mx - canvas.width / 2) / scale + me.x
        const wy = (my - canvas.height / 2) / scale + me.y
        lastAngle = Math.atan2(wy - me.y, wx - me.x)
    })
    canvas.addEventListener('click', (e) => {
        if (!gameActive) return
        e.preventDefault()
        socket.emit('attack')
    })
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && gameActive) {
            e.preventDefault()
            socket.emit('attack')
        }
    })

    function init() {
        if (canvas) ctx = canvas.getContext('2d')
        if (minimap) minimapCtx = minimap.getContext('2d')
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
    } else {
        init()
    }
})()
