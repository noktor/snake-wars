(function () {
    'use strict'

    // ─── Configuration ──────────────────────────────────────────────
    const TILE_SIZE = 32
    const MINIMAP_SIZE = 160
    const EDGE_SCROLL_MARGIN = 12
    const EDGE_SCROLL_SPEED = 12
    const TOP_BAR_HEIGHT = 40
    const BOTTOM_PANEL_HEIGHT = 140
    const MINIMAP_W = 160
    const MINIMAP_H = 160

    // Player colors
    const PLAYER_COLORS = { 1: '#3498db', 2: '#e74c3c' }
    const PLAYER_COLORS_DARK = { 1: '#1a5276', 2: '#7b241c' }

    // Tile rendering colors
    const TILE_COLORS = {
        0: '#3a7d3a', // GRASS
        1: '#2980b9', // WATER
        2: '#1d6b1d', // TREE
        3: '#d4ac0d', // GOLD_MINE
        4: '#7f8c8d'  // ROCK
    }

    // ─── DOM Elements ───────────────────────────────────────────────
    const lobbyScreen = document.getElementById('lobbyScreen')
    const gameListScreen = document.getElementById('gameListScreen')
    const waitingScreen = document.getElementById('waitingScreen')
    const gameScreen = document.getElementById('gameScreen')
    const gameOverScreen = document.getElementById('gameOverScreen')
    const nicknameDisplay = document.getElementById('nicknameDisplay')
    const nickNameInput = document.getElementById('nickNameInput')
    const showGameListBtn = document.getElementById('showGameListBtn')
    const gameListContainer = document.getElementById('gameListContainer')
    const newGameBtn = document.getElementById('newGameBtn')
    const backToLobbyBtn = document.getElementById('backToLobbyBtn')
    const waitingGameCode = document.getElementById('waitingGameCode')
    const gameCanvas = document.getElementById('gameCanvas')
    const minimapCanvas = document.getElementById('minimapCanvas')
    const goldCountEl = document.getElementById('goldCount')
    const woodCountEl = document.getElementById('woodCount')
    const popCountEl = document.getElementById('popCount')
    const selectionInfo = document.getElementById('selectionInfo')
    const actionPanel = document.getElementById('actionPanel')
    const gameOverTitle = document.getElementById('gameOverTitle')
    const gameOverReason = document.getElementById('gameOverReason')
    const backToHubBtn = document.getElementById('backToHubBtn')

    const ctx = gameCanvas ? gameCanvas.getContext('2d') : null
    const mmCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null

    // Draw resource icons
    function drawResourceIcons() {
        const goldIcon = document.getElementById('goldIcon')
        if (goldIcon) {
            const c = goldIcon.getContext('2d')
            c.fillStyle = '#f1c40f'
            c.beginPath(); c.arc(9, 9, 7, 0, Math.PI * 2); c.fill()
            c.fillStyle = '#d4ac0d'
            c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
            c.fillText('G', 9, 10)
        }
        const woodIcon = document.getElementById('woodIcon')
        if (woodIcon) {
            const c = woodIcon.getContext('2d')
            c.fillStyle = '#8B4513'
            c.fillRect(4, 2, 10, 14)
            c.fillStyle = '#228B22'
            c.beginPath(); c.arc(9, 4, 6, 0, Math.PI * 2); c.fill()
        }
    }
    drawResourceIcons()

    // ─── State ──────────────────────────────────────────────────────
    let socket = null
    let myPlayerId = null
    let gameState = null
    let mapData = null
    let playerNames = {}
    let nickname = ''

    // Camera
    let camX = 0, camY = 0
    let canvasW = 800, canvasH = 600

    // Selection
    let selectedUnitIds = []
    let selectedBuildingId = null
    let selectionBoxStart = null
    let selectionBoxEnd = null
    let isDragging = false

    // Input
    let mouseX = 0, mouseY = 0
    let mouseWorldX = 0, mouseWorldY = 0
    let commandMode = null // null, 'attack', 'build_BARRACKS', 'build_FARM'
    let keysDown = {}

    // Interpolation: smooth unit positions between server ticks
    const unitPositions = {} // unitId -> { x, y, targetX, targetY }
    const LERP_SPEED = 0.25

    // ─── Nickname ───────────────────────────────────────────────────
    try {
        nickname = sessionStorage.getItem('snake_wars_nickname') || ''
    } catch (e) {}
    if (nickNameInput) nickNameInput.value = nickname
    if (nicknameDisplay) nicknameDisplay.textContent = nickname || 'Unknown'

    // ─── Screen Switching ───────────────────────────────────────────
    function showScreen(screen) {
        ;[lobbyScreen, gameListScreen, waitingScreen, gameScreen, gameOverScreen].forEach(s => {
            if (s) s.style.display = 'none'
        })
        if (screen) screen.style.display = screen === gameScreen ? 'block' : 'flex'
    }

    // ─── Socket Connection ──────────────────────────────────────────
    const backendUrl = window.SNAKE_WARS_BACKEND_URL || 'https://snake-wars-production.up.railway.app'
    socket = io(backendUrl + '/rts', { transports: ['websocket', 'polling'] })

    socket.on('connect', () => { console.log('[RTS] Connected:', socket.id) })

    socket.on('gameCode', code => {
        if (waitingGameCode) waitingGameCode.textContent = code
        showScreen(waitingScreen)
    })

    socket.on('waiting', () => {
        showScreen(waitingScreen)
    })

    socket.on('loadGameList', list => {
        renderGameList(list)
    })

    socket.on('init', data => {
        myPlayerId = data.playerId
        mapData = data.mapData
        playerNames = data.playerNames || {}
        showScreen(gameScreen)
        resizeCanvas()
        // Center camera on own town hall
        if (gameState) {
            const myTH = gameState.buildings.find(b => b.playerId === myPlayerId && b.type === 'TOWN_HALL')
            if (myTH) {
                camX = myTH.x * TILE_SIZE - canvasW / 2 + TILE_SIZE
                camY = myTH.y * TILE_SIZE - canvasH / 2 + TILE_SIZE
            }
        }
    })

    socket.on('gameState', data => {
        gameState = data
        // Center camera on first state arrival if not done yet
        if (gameState && mapData && camX === 0 && camY === 0) {
            const myTH = gameState.buildings.find(b => b.playerId === myPlayerId && b.type === 'TOWN_HALL')
            if (myTH) {
                camX = myTH.x * TILE_SIZE - canvasW / 2 + TILE_SIZE
                camY = myTH.y * TILE_SIZE - canvasH / 2 + TILE_SIZE
            }
        }
        // Update interpolation targets
        if (gameState && gameState.units) {
            const seen = new Set()
            for (const u of gameState.units) {
                seen.add(u.id)
                if (!unitPositions[u.id]) {
                    unitPositions[u.id] = { x: u.x, y: u.y, targetX: u.x, targetY: u.y }
                } else {
                    unitPositions[u.id].targetX = u.x
                    unitPositions[u.id].targetY = u.y
                }
            }
            for (const id of Object.keys(unitPositions)) {
                if (!seen.has(Number(id))) delete unitPositions[id]
            }
        }
        updateUI()
    })

    socket.on('gameOver', data => {
        const won = data.winnerId === myPlayerId
        if (gameOverTitle) gameOverTitle.textContent = won ? 'Victory!' : 'Defeat'
        if (gameOverTitle) gameOverTitle.style.color = won ? '#2ecc71' : '#e74c3c'
        if (gameOverReason) {
            if (data.reason === 'disconnect') gameOverReason.textContent = 'Opponent disconnected.'
            else gameOverReason.textContent = won ? 'All enemy buildings destroyed!' : 'Your base was destroyed.'
        }
        if (gameOverScreen) gameOverScreen.style.display = 'flex'
    })

    socket.on('unknownGame', () => alert('Game not found.'))
    socket.on('tooManyPlayers', () => alert('Game is full.'))

    // ─── UI Button Handlers ─────────────────────────────────────────
    if (showGameListBtn) showGameListBtn.addEventListener('click', () => {
        socket.emit('requestGameList')
        showScreen(gameListScreen)
    })

    if (newGameBtn) newGameBtn.addEventListener('click', () => {
        socket.emit('newGame', { nickName: nickname || 'Player' })
    })

    // AI difficulty buttons
    const aiEasyBtn = document.getElementById('aiEasyBtn')
    const aiMediumBtn = document.getElementById('aiMediumBtn')
    const aiHardBtn = document.getElementById('aiHardBtn')
    function startAIGame(difficulty) {
        socket.emit('newGame', { nickName: nickname || 'Player', vsAI: true, aiDifficulty: difficulty })
    }
    if (aiEasyBtn) aiEasyBtn.addEventListener('click', () => startAIGame('easy'))
    if (aiMediumBtn) aiMediumBtn.addEventListener('click', () => startAIGame('medium'))
    if (aiHardBtn) aiHardBtn.addEventListener('click', () => startAIGame('hard'))

    if (backToLobbyBtn) backToLobbyBtn.addEventListener('click', () => {
        showScreen(lobbyScreen)
    })

    if (backToHubBtn) backToHubBtn.addEventListener('click', () => {
        window.location.href = '../index.html'
    })

    function renderGameList(list) {
        if (!gameListContainer) return
        gameListContainer.innerHTML = ''
        const entries = Object.values(list)
        if (entries.length === 0) {
            gameListContainer.innerHTML = '<p style="color: #666;">No games available. Create one!</p>'
            return
        }
        for (const g of entries) {
            const div = document.createElement('div')
            div.className = 'game-list-item'
            div.textContent = (g.hostName || 'Unknown') + "'s game (" + g.code + ')'
            div.addEventListener('click', () => {
                socket.emit('joinGame', { gameCode: g.code, nickName: nickname || 'Player' })
            })
            gameListContainer.appendChild(div)
        }
    }

    // ─── Canvas Resize ──────────────────────────────────────────────
    function resizeCanvas() {
        if (!gameCanvas) return
        canvasW = window.innerWidth
        canvasH = window.innerHeight - TOP_BAR_HEIGHT - BOTTOM_PANEL_HEIGHT
        gameCanvas.width = canvasW
        gameCanvas.height = canvasH
        gameCanvas.style.marginTop = TOP_BAR_HEIGHT + 'px'
    }
    window.addEventListener('resize', resizeCanvas)

    // ─── Rendering ──────────────────────────────────────────────────
    function render() {
        if (!ctx || !gameState) { requestAnimationFrame(render); return }

        const mapW = gameState.mapWidth * TILE_SIZE
        const mapH = gameState.mapHeight * TILE_SIZE

        // Edge scrolling
        if (gameScreen && gameScreen.style.display !== 'none') {
            if (mouseX < EDGE_SCROLL_MARGIN) camX -= EDGE_SCROLL_SPEED
            if (mouseX > canvasW - EDGE_SCROLL_MARGIN) camX += EDGE_SCROLL_SPEED
            if (mouseY < EDGE_SCROLL_MARGIN) camY -= EDGE_SCROLL_SPEED
            if (mouseY > canvasH - EDGE_SCROLL_MARGIN) camY += EDGE_SCROLL_SPEED
            if (keysDown['ArrowLeft']) camX -= EDGE_SCROLL_SPEED
            if (keysDown['ArrowRight']) camX += EDGE_SCROLL_SPEED
            if (keysDown['ArrowUp']) camY -= EDGE_SCROLL_SPEED
            if (keysDown['ArrowDown']) camY += EDGE_SCROLL_SPEED
        }
        camX = Math.max(0, Math.min(camX, mapW - canvasW))
        camY = Math.max(0, Math.min(camY, mapH - canvasH))

        ctx.clearRect(0, 0, canvasW, canvasH)

        // Calculate visible tile range
        const startTileX = Math.max(0, Math.floor(camX / TILE_SIZE))
        const startTileY = Math.max(0, Math.floor(camY / TILE_SIZE))
        const endTileX = Math.min(gameState.mapWidth - 1, Math.ceil((camX + canvasW) / TILE_SIZE))
        const endTileY = Math.min(gameState.mapHeight - 1, Math.ceil((camY + canvasH) / TILE_SIZE))

        // Draw tiles
        for (let ty = startTileY; ty <= endTileY; ty++) {
            for (let tx = startTileX; tx <= endTileX; tx++) {
                const tileType = gameState.tiles[ty][tx]
                const sx = tx * TILE_SIZE - camX
                const sy = ty * TILE_SIZE - camY

                ctx.fillStyle = TILE_COLORS[tileType] || '#333'
                ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE)

                // Tile detail
                if (tileType === 2) { // TREE
                    ctx.fillStyle = '#2d8a2d'
                    ctx.beginPath()
                    ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2 - 4, 10, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.fillStyle = '#5C3317'
                    ctx.fillRect(sx + 13, sy + 18, 6, 12)
                } else if (tileType === 3) { // GOLD_MINE
                    ctx.fillStyle = '#f39c12'
                    ctx.beginPath()
                    ctx.moveTo(sx + 16, sy + 4)
                    ctx.lineTo(sx + 28, sy + 16)
                    ctx.lineTo(sx + 20, sy + 28)
                    ctx.lineTo(sx + 4, sy + 20)
                    ctx.closePath()
                    ctx.fill()
                } else if (tileType === 4) { // ROCK
                    ctx.fillStyle = '#95a5a6'
                    ctx.beginPath()
                    ctx.arc(sx + 16, sy + 18, 10, 0, Math.PI * 2)
                    ctx.fill()
                }

                // Grid lines
                ctx.strokeStyle = 'rgba(0,0,0,0.1)'
                ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE)
            }
        }

        // Draw fog of war
        if (gameState.visibility) {
            for (let ty = startTileY; ty <= endTileY; ty++) {
                for (let tx = startTileX; tx <= endTileX; tx++) {
                    if (!gameState.visibility[ty] || !gameState.visibility[ty][tx]) {
                        const sx = tx * TILE_SIZE - camX
                        const sy = ty * TILE_SIZE - camY
                        ctx.fillStyle = 'rgba(0,0,0,0.65)'
                        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE)
                    }
                }
            }
        }

        // Draw buildings
        for (const b of gameState.buildings) {
            const bx = b.x * TILE_SIZE - camX
            const by = b.y * TILE_SIZE - camY
            const bw = b.sizeX * TILE_SIZE
            const bh = b.sizeY * TILE_SIZE

            if (bx + bw < 0 || bx > canvasW || by + bh < 0 || by > canvasH) continue

            const pColor = PLAYER_COLORS[b.playerId] || '#888'
            const pColorDark = PLAYER_COLORS_DARK[b.playerId] || '#444'

            // Building base
            ctx.fillStyle = b.buildComplete ? pColor : 'rgba(128,128,128,0.5)'
            ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4)

            // Building border
            ctx.strokeStyle = pColorDark
            ctx.lineWidth = 2
            ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4)

            // Building type icon
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 12px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            let label = ''
            if (b.type === 'TOWN_HALL') label = 'TH'
            else if (b.type === 'BARRACKS') label = 'BK'
            else if (b.type === 'FARM') label = 'FM'
            ctx.fillText(label, bx + bw / 2, by + bh / 2)

            // Health bar
            if (b.hp < b.maxHp) {
                const hpPct = b.hp / b.maxHp
                ctx.fillStyle = '#333'
                ctx.fillRect(bx + 4, by - 6, bw - 8, 4)
                ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : hpPct > 0.25 ? '#f39c12' : '#e74c3c'
                ctx.fillRect(bx + 4, by - 6, (bw - 8) * hpPct, 4)
            }

            // Build progress
            if (!b.buildComplete) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)'
                ctx.font = '10px sans-serif'
                const pct = Math.floor((b.buildProgress / (b.buildProgress + 10)) * 100)
                ctx.fillText(pct + '%', bx + bw / 2, by + bh / 2 + 14)
            }

            // Selection highlight
            if (selectedBuildingId === b.id) {
                ctx.strokeStyle = '#2ecc71'
                ctx.lineWidth = 2
                ctx.strokeRect(bx, by, bw, bh)
            }
        }

        // Lerp unit positions for smooth movement
        for (const id of Object.keys(unitPositions)) {
            const p = unitPositions[id]
            p.x += (p.targetX - p.x) * LERP_SPEED
            p.y += (p.targetY - p.y) * LERP_SPEED
            if (Math.abs(p.x - p.targetX) < 0.05) p.x = p.targetX
            if (Math.abs(p.y - p.targetY) < 0.05) p.y = p.targetY
        }

        // Draw units
        for (const u of gameState.units) {
            const pos = unitPositions[u.id]
            const drawX = pos ? pos.x : u.x
            const drawY = pos ? pos.y : u.y
            const ux = drawX * TILE_SIZE + TILE_SIZE / 2 - camX
            const uy = drawY * TILE_SIZE + TILE_SIZE / 2 - camY

            if (ux < -20 || ux > canvasW + 20 || uy < -20 || uy > canvasH + 20) continue

            const pColor = PLAYER_COLORS[u.playerId] || '#888'
            const isSelected = selectedUnitIds.includes(u.id)

            // Selection circle
            if (isSelected) {
                ctx.strokeStyle = '#2ecc71'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(ux, uy, 14, 0, Math.PI * 2)
                ctx.stroke()
            }

            // Unit shape
            ctx.fillStyle = pColor
            if (u.type === 'PEASANT') {
                // Circle
                ctx.beginPath()
                ctx.arc(ux, uy, 8, 0, Math.PI * 2)
                ctx.fill()
                // Carry indicator
                if (u.carryAmount > 0) {
                    ctx.fillStyle = u.carryResource === 'GOLD' ? '#f1c40f' : '#8B4513'
                    ctx.fillRect(ux + 4, uy - 10, 6, 6)
                }
            } else if (u.type === 'FOOTMAN') {
                // Square
                ctx.fillRect(ux - 8, uy - 8, 16, 16)
                ctx.fillStyle = '#ddd'
                ctx.fillRect(ux - 2, uy - 12, 4, 8) // sword
            } else if (u.type === 'ARCHER') {
                // Triangle
                ctx.beginPath()
                ctx.moveTo(ux, uy - 10)
                ctx.lineTo(ux + 9, uy + 8)
                ctx.lineTo(ux - 9, uy + 8)
                ctx.closePath()
                ctx.fill()
            }

            // Health bar
            if (u.hp < u.maxHp) {
                const hpPct = u.hp / u.maxHp
                ctx.fillStyle = '#333'
                ctx.fillRect(ux - 10, uy - 16, 20, 3)
                ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : hpPct > 0.25 ? '#f39c12' : '#e74c3c'
                ctx.fillRect(ux - 10, uy - 16, 20 * hpPct, 3)
            }
        }

        // Selection box
        if (isDragging && selectionBoxStart && selectionBoxEnd) {
            const sx = Math.min(selectionBoxStart.x, selectionBoxEnd.x)
            const sy = Math.min(selectionBoxStart.y, selectionBoxEnd.y)
            const sw = Math.abs(selectionBoxEnd.x - selectionBoxStart.x)
            const sh = Math.abs(selectionBoxEnd.y - selectionBoxStart.y)
            ctx.strokeStyle = '#2ecc71'
            ctx.lineWidth = 1
            ctx.strokeRect(sx, sy, sw, sh)
            ctx.fillStyle = 'rgba(46, 204, 113, 0.1)'
            ctx.fillRect(sx, sy, sw, sh)
        }

        // Command mode cursor hint
        if (commandMode) {
            ctx.fillStyle = 'rgba(255,255,0,0.3)'
            ctx.font = '14px sans-serif'
            ctx.textAlign = 'left'
            let hint = ''
            if (commandMode === 'attack') hint = 'Attack mode - click target'
            else if (commandMode.startsWith('build_')) hint = 'Place building - click to build'
            ctx.fillText(hint, 10, canvasH - 10)

            // Building placement preview
            if (commandMode.startsWith('build_')) {
                const buildType = commandMode.replace('build_', '')
                let sz = buildType === 'FARM' ? 2 : 3
                const tileX = Math.floor((mouseX + camX) / TILE_SIZE)
                const tileY = Math.floor((mouseY + camY) / TILE_SIZE)
                const px = tileX * TILE_SIZE - camX
                const py = tileY * TILE_SIZE - camY
                ctx.fillStyle = 'rgba(46, 204, 113, 0.3)'
                ctx.fillRect(px, py, sz * TILE_SIZE, sz * TILE_SIZE)
                ctx.strokeStyle = '#2ecc71'
                ctx.lineWidth = 1
                ctx.strokeRect(px, py, sz * TILE_SIZE, sz * TILE_SIZE)
            }
        }

        // Draw minimap
        renderMinimap()

        requestAnimationFrame(render)
    }
    requestAnimationFrame(render)

    function renderMinimap() {
        if (!mmCtx || !gameState) return
        const mw = gameState.mapWidth
        const mh = gameState.mapHeight
        const scaleX = MINIMAP_W / mw
        const scaleY = MINIMAP_H / mh

        mmCtx.fillStyle = '#111'
        mmCtx.fillRect(0, 0, MINIMAP_W, MINIMAP_H)

        // Draw tiles (simplified)
        for (let ty = 0; ty < mh; ty++) {
            for (let tx = 0; tx < mw; tx++) {
                const t = gameState.tiles[ty][tx]
                if (t === 0) continue // skip grass for speed
                mmCtx.fillStyle = TILE_COLORS[t] || '#333'
                mmCtx.fillRect(tx * scaleX, ty * scaleY, Math.ceil(scaleX), Math.ceil(scaleY))
            }
        }

        // Fog
        if (gameState.visibility) {
            for (let ty = 0; ty < mh; ty++) {
                for (let tx = 0; tx < mw; tx++) {
                    if (!gameState.visibility[ty] || !gameState.visibility[ty][tx]) {
                        mmCtx.fillStyle = 'rgba(0,0,0,0.6)'
                        mmCtx.fillRect(tx * scaleX, ty * scaleY, Math.ceil(scaleX), Math.ceil(scaleY))
                    }
                }
            }
        }

        // Buildings
        for (const b of gameState.buildings) {
            mmCtx.fillStyle = PLAYER_COLORS[b.playerId] || '#888'
            mmCtx.fillRect(b.x * scaleX, b.y * scaleY, b.sizeX * scaleX + 1, b.sizeY * scaleY + 1)
        }

        // Units
        for (const u of gameState.units) {
            mmCtx.fillStyle = PLAYER_COLORS[u.playerId] || '#888'
            mmCtx.fillRect(u.x * scaleX - 0.5, u.y * scaleY - 0.5, 2, 2)
        }

        // Viewport box
        mmCtx.strokeStyle = '#fff'
        mmCtx.lineWidth = 1
        mmCtx.strokeRect(
            (camX / TILE_SIZE) * scaleX,
            (camY / TILE_SIZE) * scaleY,
            (canvasW / TILE_SIZE) * scaleX,
            (canvasH / TILE_SIZE) * scaleY
        )
    }

    // ─── UI Updates ─────────────────────────────────────────────────
    function updateUI() {
        if (!gameState || !gameState.player) return

        if (goldCountEl) goldCountEl.textContent = gameState.player.gold
        if (woodCountEl) woodCountEl.textContent = gameState.player.wood
        if (popCountEl) popCountEl.textContent = gameState.player.pop + '/' + gameState.player.popCap

        updateSelectionPanel()
    }

    // Track what selection the action buttons were built for, so we only rebuild on change
    let actionPanelKey = ''

    function updateSelectionPanel() {
        if (!selectionInfo || !actionPanel || !gameState) return

        if (selectedUnitIds.length > 0) {
            const units = gameState.units.filter(u => selectedUnitIds.includes(u.id) && u.playerId === myPlayerId)
            if (units.length === 0) {
                selectedUnitIds = []
                selectionInfo.innerHTML = '<span style="color: #666;">Select units or buildings</span>'
                rebuildActionPanel('')
                return
            }

            // Update info text (every frame is fine, no DOM destruction)
            let html = '<div style="font-size: 12px; color: #c9a84c; margin-bottom: 4px;">Selected: ' + units.length + ' unit' + (units.length > 1 ? 's' : '') + '</div>'
            const typeCounts = {}
            for (const u of units) {
                typeCounts[u.type] = (typeCounts[u.type] || 0) + 1
            }
            for (const [type, count] of Object.entries(typeCounts)) {
                html += '<div style="font-size: 11px;">' + type + ' x' + count + '</div>'
            }
            if (units.length === 1) {
                const u = units[0]
                html += '<div style="font-size: 11px; color: #888;">HP: ' + u.hp + '/' + u.maxHp + '</div>'
                html += '<div style="font-size: 11px; color: #888;">State: ' + u.state + '</div>'
                if (u.carryAmount > 0) {
                    html += '<div style="font-size: 11px; color: ' + (u.carryResource === 'GOLD' ? '#f1c40f' : '#8B4513') + ';">Carrying: ' + u.carryAmount + ' ' + u.carryResource + '</div>'
                }
            }
            selectionInfo.innerHTML = html

            // Only rebuild action buttons when selection changes
            const hasPeasant = units.some(u => u.type === 'PEASANT')
            const key = 'units_' + selectedUnitIds.sort().join(',') + '_p' + (hasPeasant ? '1' : '0')
            if (key !== actionPanelKey) {
                rebuildActionPanel(key)
                addActionBtn('Move', 'M', () => { /* default right-click */ })
                addActionBtn('Stop', 'S', () => { cmdStop() })
                addActionBtn('Attack', 'A', () => { commandMode = 'attack' })
                if (hasPeasant) {
                    addActionBtn('Build Barracks', 'B', () => { commandMode = 'build_BARRACKS' })
                    addActionBtn('Build Farm', 'F', () => { commandMode = 'build_FARM' })
                }
            }

        } else if (selectedBuildingId != null) {
            const b = gameState.buildings.find(b => b.id === selectedBuildingId && b.playerId === myPlayerId)
            if (!b) {
                selectedBuildingId = null
                selectionInfo.innerHTML = '<span style="color: #666;">Select units or buildings</span>'
                rebuildActionPanel('')
                return
            }

            // Update info text every frame
            let html = '<div style="font-size: 12px; color: #c9a84c;">' + b.type.replace(/_/g, ' ') + '</div>'
            html += '<div style="font-size: 11px; color: #888;">HP: ' + b.hp + '/' + b.maxHp + '</div>'
            if (!b.buildComplete) {
                html += '<div style="font-size: 11px; color: #f39c12;">Under construction</div>'
            }
            if (b.productionQueue.length > 0) {
                html += '<div style="font-size: 11px; color: #8bc34a;">Training: ' + b.productionQueue[0] + '</div>'
                html += '<div style="font-size: 11px; color: #666;">Queue: ' + b.productionQueue.length + '</div>'
            }
            selectionInfo.innerHTML = html

            // Only rebuild action buttons when building selection changes
            const key = 'bld_' + b.id + '_' + b.type + '_' + (b.buildComplete ? '1' : '0')
            if (key !== actionPanelKey) {
                rebuildActionPanel(key)
                if (b.buildComplete) {
                    if (b.type === 'TOWN_HALL') {
                        addActionBtn('Peasant', 'P', () => trainUnit(b.id, 'PEASANT'))
                    } else if (b.type === 'BARRACKS') {
                        addActionBtn('Footman', 'F', () => trainUnit(b.id, 'FOOTMAN'))
                        addActionBtn('Archer', 'A', () => trainUnit(b.id, 'ARCHER'))
                    }
                }
            }
        } else {
            selectionInfo.innerHTML = '<span style="color: #666;">Select units or buildings</span>'
            rebuildActionPanel('')
        }
    }

    function rebuildActionPanel(key) {
        if (key === actionPanelKey) return
        actionPanelKey = key
        actionPanel.innerHTML = ''
    }

    function addActionBtn(label, icon, onClick) {
        const btn = document.createElement('button')
        btn.className = 'action-btn'
        btn.innerHTML = '<span>' + icon + '</span>' + label
        btn.addEventListener('click', onClick)
        actionPanel.appendChild(btn)
    }

    // ─── Commands ───────────────────────────────────────────────────
    function cmdMove(tileX, tileY) {
        if (selectedUnitIds.length === 0) return
        socket.emit('command', { unitIds: selectedUnitIds, type: 'move', targetX: tileX, targetY: tileY })
    }

    function cmdAttack(targetId) {
        if (selectedUnitIds.length === 0) return
        socket.emit('command', { unitIds: selectedUnitIds, type: 'attack', targetId })
    }

    function cmdGather(tileX, tileY) {
        if (selectedUnitIds.length === 0) return
        socket.emit('command', { unitIds: selectedUnitIds, type: 'gather', targetX: tileX, targetY: tileY })
    }

    function cmdStop() {
        if (selectedUnitIds.length === 0) return
        socket.emit('command', { unitIds: selectedUnitIds, type: 'move', targetX: null, targetY: null })
    }

    function cmdBuild(buildingType, tileX, tileY) {
        if (selectedUnitIds.length === 0) return
        const peasant = gameState.units.find(u => selectedUnitIds.includes(u.id) && u.type === 'PEASANT' && u.playerId === myPlayerId)
        if (!peasant) return
        socket.emit('buildBuilding', { unitId: peasant.id, buildingType, x: tileX, y: tileY })
    }

    function trainUnit(buildingId, unitType) {
        socket.emit('trainUnit', { buildingId, unitType })
    }

    // ─── Input Handling ─────────────────────────────────────────────
    function getWorldTile(screenX, screenY) {
        return {
            x: Math.floor((screenX + camX) / TILE_SIZE),
            y: Math.floor((screenY + camY) / TILE_SIZE)
        }
    }

    function getEntityAt(worldTileX, worldTileY) {
        if (!gameState) return null
        // Check units first
        for (const u of gameState.units) {
            if (u.x === worldTileX && u.y === worldTileY) return { type: 'unit', entity: u }
        }
        // Check buildings
        for (const b of gameState.buildings) {
            if (worldTileX >= b.x && worldTileX < b.x + b.sizeX && worldTileY >= b.y && worldTileY < b.y + b.sizeY) {
                return { type: 'building', entity: b }
            }
        }
        return null
    }

    if (gameCanvas) {
        gameCanvas.addEventListener('mousedown', e => {
            if (e.button === 0) { // Left click
                const rect = gameCanvas.getBoundingClientRect()
                const sx = e.clientX - rect.left
                const sy = e.clientY - rect.top

                if (commandMode) {
                    const tile = getWorldTile(sx, sy)
                    if (commandMode === 'attack') {
                        const target = getEntityAt(tile.x, tile.y)
                        if (target) cmdAttack(target.entity.id)
                    } else if (commandMode.startsWith('build_')) {
                        const buildType = commandMode.replace('build_', '')
                        cmdBuild(buildType, tile.x, tile.y)
                    }
                    commandMode = null
                    return
                }

                selectionBoxStart = { x: sx, y: sy }
                selectionBoxEnd = { x: sx, y: sy }
                isDragging = true
            }
        })

        gameCanvas.addEventListener('mousemove', e => {
            const rect = gameCanvas.getBoundingClientRect()
            mouseX = e.clientX - rect.left
            mouseY = e.clientY - rect.top
            mouseWorldX = mouseX + camX
            mouseWorldY = mouseY + camY

            if (isDragging) {
                selectionBoxEnd = { x: mouseX, y: mouseY }
            }
        })

        gameCanvas.addEventListener('mouseup', e => {
            if (e.button === 0 && isDragging) {
                isDragging = false
                const rect = gameCanvas.getBoundingClientRect()
                const endX = e.clientX - rect.left
                const endY = e.clientY - rect.top

                const dx = Math.abs(endX - selectionBoxStart.x)
                const dy = Math.abs(endY - selectionBoxStart.y)

                if (dx < 5 && dy < 5) {
                    // Click selection
                    const tile = getWorldTile(selectionBoxStart.x, selectionBoxStart.y)
                    const hit = getEntityAt(tile.x, tile.y)
                    selectedUnitIds = []
                    selectedBuildingId = null
                    if (hit) {
                        if (hit.type === 'unit' && hit.entity.playerId === myPlayerId) {
                            selectedUnitIds = [hit.entity.id]
                        } else if (hit.type === 'building' && hit.entity.playerId === myPlayerId) {
                            selectedBuildingId = hit.entity.id
                        }
                    }
                } else {
                    // Box selection
                    const minSX = Math.min(selectionBoxStart.x, endX) + camX
                    const minSY = Math.min(selectionBoxStart.y, endY) + camY
                    const maxSX = Math.max(selectionBoxStart.x, endX) + camX
                    const maxSY = Math.max(selectionBoxStart.y, endY) + camY

                    selectedUnitIds = []
                    selectedBuildingId = null
                    if (gameState) {
                        for (const u of gameState.units) {
                            if (u.playerId !== myPlayerId) continue
                            const ux = u.x * TILE_SIZE + TILE_SIZE / 2
                            const uy = u.y * TILE_SIZE + TILE_SIZE / 2
                            if (ux >= minSX && ux <= maxSX && uy >= minSY && uy <= maxSY) {
                                selectedUnitIds.push(u.id)
                            }
                        }
                    }
                }
                selectionBoxStart = null
                selectionBoxEnd = null
                updateSelectionPanel()
            }
        })

        // Right click - commands
        gameCanvas.addEventListener('contextmenu', e => {
            e.preventDefault()
            if (!gameState || selectedUnitIds.length === 0) return

            const rect = gameCanvas.getBoundingClientRect()
            const sx = e.clientX - rect.left
            const sy = e.clientY - rect.top
            const tile = getWorldTile(sx, sy)
            const target = getEntityAt(tile.x, tile.y)

            if (target) {
                if (target.entity.playerId !== myPlayerId) {
                    // Attack enemy
                    cmdAttack(target.entity.id)
                } else if (target.type === 'building') {
                    // Right click own building? Move near it
                    cmdMove(tile.x, tile.y)
                }
            } else {
                // Check if tile is a resource
                const key = tile.x + ',' + tile.y
                if (gameState.resources && gameState.resources[key] && gameState.resources[key].amount > 0) {
                    cmdGather(tile.x, tile.y)
                } else {
                    cmdMove(tile.x, tile.y)
                }
            }
        })

        // Minimap click
        if (minimapCanvas) {
            minimapCanvas.addEventListener('mousedown', e => {
                if (!gameState) return
                const rect = minimapCanvas.getBoundingClientRect()
                const mx = e.clientX - rect.left
                const my = e.clientY - rect.top
                const scaleX = MINIMAP_W / gameState.mapWidth
                const scaleY = MINIMAP_H / gameState.mapHeight
                camX = (mx / scaleX) * TILE_SIZE - canvasW / 2
                camY = (my / scaleY) * TILE_SIZE - canvasH / 2
            })
        }
    }

    // Keyboard
    document.addEventListener('keydown', e => {
        keysDown[e.key] = true
        if (gameScreen && gameScreen.style.display !== 'none') {
            if (e.key === 'a' || e.key === 'A') { commandMode = 'attack' }
            if (e.key === 's' || e.key === 'S') { cmdStop(); commandMode = null }
            if (e.key === 'h' || e.key === 'H') { cmdStop(); commandMode = null }
            if (e.key === 'Escape') {
                commandMode = null
                selectedUnitIds = []
                selectedBuildingId = null
                updateSelectionPanel()
            }
            if (e.key === 'b' || e.key === 'B') {
                if (selectedUnitIds.length > 0 && gameState) {
                    const hasPeasant = gameState.units.some(u => selectedUnitIds.includes(u.id) && u.type === 'PEASANT')
                    if (hasPeasant) commandMode = 'build_BARRACKS'
                }
            }
            if (e.key === 'f' || e.key === 'F') {
                if (selectedUnitIds.length > 0 && gameState) {
                    const hasPeasant = gameState.units.some(u => selectedUnitIds.includes(u.id) && u.type === 'PEASANT')
                    if (hasPeasant) commandMode = 'build_FARM'
                }
            }
        }
    })

    document.addEventListener('keyup', e => {
        delete keysDown[e.key]
    })

    // Mouse position tracking for edge scrolling
    document.addEventListener('mousemove', e => {
        if (gameScreen && gameScreen.style.display !== 'none') {
            const rect = gameCanvas ? gameCanvas.getBoundingClientRect() : null
            if (rect) {
                mouseX = e.clientX - rect.left
                mouseY = e.clientY - rect.top
            }
        }
    })

})()
