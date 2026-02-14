(function () {
    const MAP_BG = '#2d4a2e'
    const OBSTACLE_COLOR = '#4a3728'
    const ZONE_COLOR = 'rgba(255, 200, 0, 0.15)'
    const ZONE_STROKE = 'rgba(255, 200, 0, 0.5)'
    const AREA_COLORS = {
        forest_big: '#1a3320',
        factory: '#4a4a4a',
        village: '#7a6348',
        city: '#3d3d3d',
        mountain: '#5c5346',
        forest_small: '#243d26',
        swamp: '#2d3d32',
        fields: '#a68b5c',
        port: '#3d4a55',
        military: '#3d4530'
    }
    const TREE_RADIUS = 22
    const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e']
    const VIEW_WIDTH = 500
    const VIEW_HEIGHT = 500
    const MINIMAP_SIZE = 120
    const MELEE_RANGE = 50
    const MELEE_ANGLE_RAD = Math.PI / 3
    const MELEE_ANIMATION_MS = 380

    let backendUrl = typeof window !== 'undefined' && window.SNAKE_WARS_BACKEND_URL
    if (!backendUrl || backendUrl === '__SNAKE_WARS_BACKEND_URL__') backendUrl = 'http://localhost:3000'

    const socket = io(backendUrl + '/br', { path: '/socket.io' })

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
    const canvas = document.getElementById('canvas')
    const minimap = document.getElementById('minimap')
    const healthBar = document.getElementById('healthBar')
    const zoneTimerEl = document.getElementById('zoneTimer')
    const errorMessage = document.getElementById('errorMessage')
    const winnerBanner = document.getElementById('winnerBanner')
    const gameUi = document.getElementById('gameUi')
    let leaveGameBtn = null

    let ctx, minimapCtx
    let playerId = null
    let lastState = null
    let gameActive = false
    const keys = { w: false, a: false, s: false, d: false }
    const SPECTATOR_CAM_SPEED = 12
    let spectatorCamX = null
    let spectatorCamY = null

    function getPlayerColor(id) {
        return PLAYER_COLORS[(id - 1) % PLAYER_COLORS.length]
    }

    function worldToScreen(wx, wy, camX, camY, scale) {
        return {
            x: (wx - camX) * scale,
            y: (wy - camY) * scale
        }
    }

    function paintLootItem(ctx, item, scale) {
        const x = item.x
        const y = item.y
        const lw = 1 / scale
        ctx.save()
        ctx.translate(x, y)
        if (item.type === 'health_pack') {
            ctx.fillStyle = '#e74c3c'
            ctx.strokeStyle = '#c0392b'
            ctx.lineWidth = lw
            ctx.beginPath()
            ctx.arc(0, 0, 10, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#fff'
            ctx.fillRect(-3, -8, 6, 16)
            ctx.fillRect(-8, -3, 16, 6)
        } else if (item.type === 'weapon_rifle') {
            ctx.fillStyle = '#5d4e37'
            ctx.strokeStyle = '#3d2e17'
            ctx.lineWidth = lw
            ctx.fillRect(-14, -3, 28, 6)
            ctx.strokeRect(-14, -3, 28, 6)
            ctx.fillStyle = '#4a3728'
            ctx.fillRect(-12, -2, 6, 4)
        } else if (item.type === 'weapon_shotgun') {
            ctx.fillStyle = '#2c1810'
            ctx.strokeStyle = '#1a0f08'
            ctx.lineWidth = lw
            ctx.fillRect(-12, -4, 24, 8)
            ctx.strokeRect(-12, -4, 24, 8)
            ctx.fillStyle = '#3d2e17'
            ctx.fillRect(-10, -2, 5, 4)
        } else if (item.type === 'weapon_machine_gun') {
            ctx.fillStyle = '#7f8c8d'
            ctx.strokeStyle = '#2c3e50'
            ctx.lineWidth = lw
            ctx.fillRect(-12, -2, 24, 4)
            ctx.strokeRect(-12, -2, 24, 4)
            ctx.fillStyle = '#95a5a6'
            ctx.fillRect(6, -3, 4, 6)
        } else if (item.type === 'weapon_sniper') {
            ctx.fillStyle = '#1c2833'
            ctx.strokeStyle = '#0e1114'
            ctx.lineWidth = lw
            ctx.fillRect(-18, -2, 36, 4)
            ctx.strokeRect(-18, -2, 36, 4)
            ctx.fillStyle = '#2e4053'
            ctx.beginPath()
            ctx.arc(14, 0, 4, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        } else if (item.type === 'weapon_bazooka') {
            ctx.fillStyle = '#4a5d23'
            ctx.strokeStyle = '#2d3816'
            ctx.lineWidth = lw
            ctx.fillRect(-8, -6, 16, 12)
            ctx.strokeRect(-8, -6, 16, 12)
            ctx.fillStyle = '#5c7a29'
            ctx.beginPath()
            ctx.arc(6, 0, 5, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#3d4d1e'
            ctx.fillRect(-10, -2, 6, 4)
        } else {
            ctx.fillStyle = '#95a5a6'
            ctx.beginPath()
            ctx.arc(0, 0, 10, 0, Math.PI * 2)
            ctx.fill()
        }
        if (item.ammo != null && item.ammo > 0 && (item.type || '').indexOf('weapon_') === 0) {
            ctx.font = '9px sans-serif'
            ctx.fillStyle = '#fff'
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1.5 / scale
            ctx.textAlign = 'center'
            ctx.strokeText(String(item.ammo), 0, 14)
            ctx.fillText(String(item.ammo), 0, 14)
        }
        ctx.restore()
    }

    function paintProjectile(ctx, proj, scale) {
        const type = proj.type || 'rifle'
        const lw = 1 / scale
        const angle = Math.atan2(proj.vy, proj.vx)
        ctx.save()
        ctx.translate(proj.x, proj.y)
        ctx.rotate(angle)
        if (type === 'rifle') {
            ctx.fillStyle = '#d4a84b'
            ctx.strokeStyle = '#8b6914'
            ctx.lineWidth = lw
            ctx.beginPath()
            ctx.arc(0, 0, 3, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        } else if (type === 'shotgun') {
            ctx.fillStyle = '#e67e22'
            ctx.strokeStyle = '#bf6516'
            ctx.lineWidth = lw
            ctx.beginPath()
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        } else if (type === 'machine_gun') {
            ctx.fillStyle = '#95a5a6'
            ctx.strokeStyle = '#5d6d7e'
            ctx.lineWidth = lw
            ctx.beginPath()
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        } else if (type === 'sniper') {
            ctx.fillStyle = '#1c2833'
            ctx.strokeStyle = '#0e1114'
            ctx.lineWidth = lw
            ctx.beginPath()
            ctx.ellipse(0, 0, 8, 2, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        } else if (type === 'bazooka') {
            ctx.fillStyle = '#5c7a29'
            ctx.strokeStyle = '#2d3816'
            ctx.lineWidth = lw
            ctx.fillRect(-14, -4, 24, 8)
            ctx.strokeRect(-14, -4, 24, 8)
            ctx.fillStyle = '#3d4d1e'
            ctx.beginPath()
            ctx.moveTo(10, 0)
            ctx.lineTo(16, -5)
            ctx.lineTo(16, 5)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = 'rgba(255, 140, 0, 0.6)'
            ctx.beginPath()
            ctx.moveTo(-14, 0)
            ctx.quadraticCurveTo(-20, -4, -22, 0)
            ctx.quadraticCurveTo(-20, 4, -14, 0)
            ctx.fill()
        } else {
            ctx.fillStyle = '#ff0'
            ctx.beginPath()
            ctx.arc(0, 0, 4, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.restore()
    }

    const EXPLOSION_DURATION_MS = 500
    function paintExplosions(ctx, state, scale) {
        const list = state.explosions || []
        const now = Date.now()
        for (const e of list) {
            const age = now - e.at
            if (age >= EXPLOSION_DURATION_MS) continue
            const t = age / EXPLOSION_DURATION_MS
            const r = e.radius * (0.3 + 0.7 * t)
            const alpha = 1 - t
            ctx.save()
            ctx.translate(e.x, e.y)
            ctx.fillStyle = 'rgba(255, 120, 40, ' + (0.5 * alpha) + ')'
            ctx.strokeStyle = 'rgba(255, 60, 0, ' + (0.9 * alpha) + ')'
            ctx.lineWidth = 3 / scale
            ctx.beginPath()
            ctx.arc(0, 0, r, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.restore()
        }
    }

    function paintArea(ctx, area) {
        const c = AREA_COLORS[area.type] || MAP_BG
        ctx.fillStyle = c
        ctx.fillRect(area.x, area.y, area.w, area.h)
    }

    function getBuildingFloorColor(type) {
        if (type === 'house') return '#5a4a3a'
        if (type === 'shop') return '#4a5260'
        if (type === 'church') return '#4a4845'
        if (type === 'barn') return '#6a5040'
        if (type === 'warehouse') return '#454d48'
        if (type === 'factory_hall') return '#40403a'
        if (type === 'shed') return '#505048'
        if (type === 'apartment') return '#424850'
        if (type === 'office') return '#484a50'
        if (type === 'skyscraper') return '#303038'
        if (type === 'barracks') return '#424a40'
        if (type === 'tower') return '#404238'
        return '#3a3835'
    }

    function paintBuilding(ctx, b, scale, wallThickness) {
        const wt = wallThickness || 12
        const lw = 1 / scale
        ctx.fillStyle = getBuildingFloorColor(b.type)
        ctx.fillRect(b.x + wt, b.y + wt, b.w - 2 * wt, b.h - 2 * wt)
    }

    function paintBuildingWalls(ctx, buildingWalls, scale) {
        if (!buildingWalls || !buildingWalls.length) return
        const lw = 1 / scale
        ctx.fillStyle = '#2a2520'
        ctx.strokeStyle = '#1a1510'
        ctx.lineWidth = lw
        for (const w of buildingWalls) {
            ctx.fillRect(w.x, w.y, w.w, w.h)
            ctx.strokeRect(w.x, w.y, w.w, w.h)
        }
    }

    function paintTree(ctx, t, scale) {
        const lw = 1 / scale
        ctx.strokeStyle = '#2d2015'
        ctx.fillStyle = '#2d2015'
        ctx.lineWidth = lw
        const trunkW = 6
        const trunkH = 14
        ctx.fillRect(t.x - trunkW / 2, t.y, trunkW, trunkH)
        if (t.type === 'pine') {
            ctx.fillStyle = '#1a3820'
            ctx.beginPath()
            ctx.moveTo(t.x, t.y - TREE_RADIUS)
            ctx.lineTo(t.x + TREE_RADIUS * 0.9, t.y + 8)
            ctx.lineTo(t.x - TREE_RADIUS * 0.9, t.y + 8)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
        } else {
            ctx.fillStyle = '#2d4a28'
            ctx.beginPath()
            ctx.arc(t.x, t.y - 4, TREE_RADIUS * 0.85, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        }
    }

    function paintWorld(state, camCenterX, camCenterY, scale) {
        ctx.fillStyle = MAP_BG
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.scale(scale, scale)
        ctx.translate(-camCenterX, -camCenterY)
        for (const area of (state.areas || [])) {
            paintArea(ctx, area)
        }
        for (const r of (state.roads || [])) {
            ctx.fillStyle = '#4a4538'
            ctx.fillRect(r.x, r.y, r.w, r.h)
            ctx.strokeStyle = '#3a3528'
            ctx.lineWidth = 1 / scale
            ctx.strokeRect(r.x, r.y, r.w, r.h)
        }
        const wt = state.wallThickness || 12
        for (const b of (state.buildings || [])) {
            paintBuilding(ctx, b, scale, wt)
        }
        paintBuildingWalls(ctx, state.buildingWalls, scale)
        paintBuildingWalls(ctx, state.roadWalls, scale)
        for (const t of (state.trees || [])) {
            paintTree(ctx, t, scale)
        }
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
            paintLootItem(ctx, item, scale)
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
            if (p.lastMeleeAt && (Date.now() - p.lastMeleeAt) < MELEE_ANIMATION_MS && p.angle !== undefined) {
                const a = p.angle
                const half = MELEE_ANGLE_RAD / 2
                ctx.beginPath()
                ctx.moveTo(p.x, p.y)
                ctx.arc(p.x, p.y, MELEE_RANGE, a - half, a + half)
                ctx.closePath()
                ctx.fillStyle = 'rgba(220, 60, 60, 0.45)'
                ctx.fill()
                ctx.strokeStyle = 'rgba(180, 40, 40, 0.9)'
                ctx.lineWidth = 2 / scale
                ctx.stroke()
            }
        }
        for (const proj of (state.projectiles || [])) {
            paintProjectile(ctx, proj, scale)
        }
        paintExplosions(ctx, state, scale)
        ctx.restore()
    }

    function paint(state) {
        if (!ctx || !canvas || !state || !state.players) return
        const me = state.players.find(p => p.playerId === playerId)
        const scale = Math.min(canvas.width / VIEW_WIDTH, canvas.height / VIEW_HEIGHT)

        if (!me || me.dead) {
            const mw = state.mapWidth || 2000
            const mh = state.mapHeight || 2000
            if (spectatorCamX == null || spectatorCamY == null) {
                spectatorCamX = mw / 2
                spectatorCamY = mh / 2
            }
            const halfViewW = VIEW_WIDTH / 2
            const halfViewH = VIEW_HEIGHT / 2
            spectatorCamX = Math.max(halfViewW, Math.min(mw - halfViewW, spectatorCamX))
            spectatorCamY = Math.max(halfViewH, Math.min(mh - halfViewH, spectatorCamY))
            paintWorld(state, spectatorCamX, spectatorCamY, scale)
            paintPlayerNames(state, spectatorCamX, spectatorCamY, scale)
            if (healthBar) healthBar.textContent = 'Spectator — WASD move camera'
            const now = Date.now()
            const shrinkAt = state.zoneShrinkAt || 0
            if (zoneTimerEl) {
                if (now < shrinkAt) zoneTimerEl.textContent = 'Zone shrinks in: ' + Math.ceil((shrinkAt - now) / 1000) + 's'
                else zoneTimerEl.textContent = 'Zone shrinking — stay inside circle'
            }
            paintMinimap(state, spectatorCamX, spectatorCamY)
            ctx.fillStyle = 'rgba(0,0,0,0.7)'
            ctx.fillRect(0, canvas.height - 48, canvas.width, 48)
            ctx.fillStyle = '#fff'
            ctx.font = '14px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('You died. WASD to move camera. Watch until the end or leave.', canvas.width / 2, canvas.height - 28)
            if (leaveGameBtn) {
                leaveGameBtn.style.display = 'block'
            }
            return
        }

        if (leaveGameBtn) leaveGameBtn.style.display = 'none'
        const camX = me.x - VIEW_WIDTH / 2
        const camY = me.y - VIEW_HEIGHT / 2
        paintWorld(state, me.x, me.y, scale)

        const slots = me.weapons || []
        const idx = Math.max(0, Math.min(2, me.weaponIndex != null ? me.weaponIndex : 0))
        const current = slots[idx]
        const weaponLabel = current && (current.ammo || 0) > 0
            ? (current.type === 'rifle' ? 'Rifle' : current.type === 'shotgun' ? 'Shotgun' : current.type === 'machine_gun' ? 'Machine Gun' : current.type === 'sniper' ? 'Sniper' : current.type === 'bazooka' ? 'Bazooka' : 'Melee')
            : 'Melee'
        const ammoStr = current && (current.ammo || 0) > 0 ? '  |  Ammo: ' + (current.ammo || 0) : ''
        const slotStr = '  |  [1] ' + (slots[0] ? (slots[0].type + ' ' + (slots[0].ammo || 0)) : '—') +
            '  [2] ' + (slots[1] ? (slots[1].type + ' ' + (slots[1].ammo || 0)) : '—') +
            '  [3] ' + (slots[2] ? (slots[2].type + ' ' + (slots[2].ammo || 0)) : '—')
        if (healthBar) healthBar.textContent = 'Health: ' + Math.max(0, Math.round(me.health)) + '  |  Weapon: ' + weaponLabel + ammoStr + slotStr
        const now = Date.now()
        const shrinkAt = state.zoneShrinkAt || 0
        if (zoneTimerEl) {
            if (now < shrinkAt) {
                const sec = Math.ceil((shrinkAt - now) / 1000)
                zoneTimerEl.textContent = 'Zone shrinks in: ' + sec + 's'
            } else {
                zoneTimerEl.textContent = 'Zone shrinking — stay inside circle'
            }
        }
        paintMinimap(state, me.x, me.y)
        paintPlayerNames(state, me.x, me.y, scale)
    }

    function paintPlayerNames(state, camCenterX, camCenterY, scale) {
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.scale(scale, scale)
        ctx.translate(-camCenterX, -camCenterY)
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
        const cx = state.zoneCenterX
        const cy = state.zoneCenterY
        const r = Math.max(1, state.zoneRadius)
        const scale = MINIMAP_SIZE / (2 * r)
        const toMinimap = (wx, wy) => ({
            x: (wx - cx + r) * scale,
            y: (wy - cy + r) * scale
        })
        minimapCtx.fillStyle = '#1a1a1a'
        minimapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
        minimapCtx.save()
        minimapCtx.beginPath()
        minimapCtx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 0, Math.PI * 2)
        minimapCtx.clip()
        for (const area of (state.areas || [])) {
            const tl = toMinimap(area.x, area.y)
            const br = toMinimap(area.x + area.w, area.y + area.h)
            minimapCtx.fillStyle = AREA_COLORS[area.type] || MAP_BG
            minimapCtx.fillRect(tl.x, tl.y, Math.max(1, br.x - tl.x), Math.max(1, br.y - tl.y))
        }
        for (const r of (state.roads || [])) {
            const tl = toMinimap(r.x, r.y)
            const br = toMinimap(r.x + r.w, r.y + r.h)
            minimapCtx.fillStyle = 'rgba(60,55,48,0.9)'
            minimapCtx.fillRect(tl.x, tl.y, Math.max(1, br.x - tl.x), Math.max(1, br.y - tl.y))
        }
        const wt = state.wallThickness || 12
        for (const b of (state.buildings || [])) {
            const tl = toMinimap(b.x + wt, b.y + wt)
            const br = toMinimap(b.x + b.w - wt, b.y + b.h - wt)
            minimapCtx.fillStyle = 'rgba(50,45,40,0.85)'
            minimapCtx.fillRect(tl.x, tl.y, Math.max(1, br.x - tl.x), Math.max(1, br.y - tl.y))
        }
        for (const w of (state.buildingWalls || [])) {
            const tl = toMinimap(w.x, w.y)
            const br = toMinimap(w.x + w.w, w.y + w.h)
            minimapCtx.fillStyle = 'rgba(30,25,20,0.9)'
            minimapCtx.fillRect(tl.x, tl.y, Math.max(1, br.x - tl.x), Math.max(1, br.y - tl.y))
        }
        for (const w of (state.roadWalls || [])) {
            const tl = toMinimap(w.x, w.y)
            const br = toMinimap(w.x + w.w, w.y + w.h)
            minimapCtx.fillStyle = 'rgba(28,22,18,0.9)'
            minimapCtx.fillRect(tl.x, tl.y, Math.max(1, br.x - tl.x), Math.max(1, br.y - tl.y))
        }
        for (const o of (state.obstacles || [])) {
            const tl = toMinimap(o.x, o.y)
            const br = toMinimap(o.x + o.w, o.y + o.h)
            minimapCtx.fillStyle = OBSTACLE_COLOR
            minimapCtx.fillRect(tl.x, tl.y, Math.max(1, br.x - tl.x), Math.max(1, br.y - tl.y))
        }
        const now = Date.now()
        for (const ping of (state.dropPings || [])) {
            const age = now - ping.at
            if (age > 15000) continue
            const p = toMinimap(ping.x, ping.y)
            const pulse = 0.4 + 0.6 * Math.sin(age / 200) * Math.max(0, 1 - age / 15000)
            minimapCtx.fillStyle = 'rgba(255, 200, 0, ' + (0.5 * pulse) + ')'
            minimapCtx.beginPath()
            minimapCtx.arc(p.x, p.y, 6, 0, Math.PI * 2)
            minimapCtx.fill()
            minimapCtx.strokeStyle = 'rgba(255, 220, 0, ' + pulse + ')'
            minimapCtx.lineWidth = 2
            minimapCtx.stroke()
        }
        for (const item of (state.loot || [])) {
            const p = toMinimap(item.x, item.y)
            if (item.type === 'health_pack') minimapCtx.fillStyle = '#e74c3c'
            else if (item.type === 'weapon_rifle') minimapCtx.fillStyle = '#5d4e37'
            else if (item.type === 'weapon_shotgun') minimapCtx.fillStyle = '#2c1810'
            else if (item.type === 'weapon_machine_gun') minimapCtx.fillStyle = '#7f8c8d'
            else if (item.type === 'weapon_sniper') minimapCtx.fillStyle = '#1c2833'
            else if (item.type === 'weapon_bazooka') minimapCtx.fillStyle = '#4a5d23'
            else minimapCtx.fillStyle = '#95a5a6'
            minimapCtx.fillRect(p.x, p.y, 2, 2)
        }
        const me = state.players.find(p => p.playerId === playerId && !p.dead)
        if (me) {
            const p = toMinimap(me.x, me.y)
            minimapCtx.fillStyle = me.color || getPlayerColor(me.playerId)
            minimapCtx.beginPath()
            minimapCtx.arc(p.x, p.y, 3, 0, Math.PI * 2)
            minimapCtx.fill()
            minimapCtx.strokeStyle = '#fff'
            minimapCtx.lineWidth = 1
            minimapCtx.stroke()
        }
        minimapCtx.restore()
        minimapCtx.strokeStyle = ZONE_STROKE
        minimapCtx.lineWidth = 2
        minimapCtx.beginPath()
        minimapCtx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 0, Math.PI * 2)
        minimapCtx.stroke()
        const camP = toMinimap(camX, camY)
        const viewHalf = 20 * scale
        minimapCtx.strokeStyle = '#fff'
        minimapCtx.lineWidth = 1
        minimapCtx.strokeRect(camP.x - viewHalf, camP.y - viewHalf, viewHalf * 2, viewHalf * 2)
    }

    let lastAngle = 0
    function sendMove() {
        if (lastState) {
            const me = lastState.players.find(p => p.playerId === playerId)
            if (me && me.dead) return
        }
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
        if (k === '1') { e.preventDefault(); socket.emit('selectWeapon', 0) }
        if (k === '2') { e.preventDefault(); socket.emit('selectWeapon', 1) }
        if (k === '3') { e.preventDefault(); socket.emit('selectWeapon', 2) }
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
        if (!gameActive) return
        if (lastState) {
            const me = lastState.players.find(p => p.playerId === playerId)
            if (me && me.dead) {
                const mw = lastState.mapWidth || 2000
                const mh = lastState.mapHeight || 2000
                const halfViewW = VIEW_WIDTH / 2
                const halfViewH = VIEW_HEIGHT / 2
                if (keys.w) spectatorCamY -= SPECTATOR_CAM_SPEED
                if (keys.s) spectatorCamY += SPECTATOR_CAM_SPEED
                if (keys.a) spectatorCamX -= SPECTATOR_CAM_SPEED
                if (keys.d) spectatorCamX += SPECTATOR_CAM_SPEED
                if (spectatorCamX != null && spectatorCamY != null) {
                    spectatorCamX = Math.max(halfViewW, Math.min(mw - halfViewW, spectatorCamX))
                    spectatorCamY = Math.max(halfViewH, Math.min(mh - halfViewH, spectatorCamY))
                    requestAnimationFrame(() => paint(lastState))
                }
                return
            }
        }
        sendMove()
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
        if (lastState) {
            const me = lastState.players.find(p => p.playerId === playerId)
            if (me && me.dead) return
        }
        e.preventDefault()
        socket.emit('attack')
    })
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && gameActive) {
            if (lastState) {
                const me = lastState.players.find(p => p.playerId === playerId)
                if (me && me.dead) return
            }
            e.preventDefault()
            socket.emit('attack')
        }
    })

    function init() {
        if (canvas) ctx = canvas.getContext('2d')
        if (minimap) {
            minimap.width = MINIMAP_SIZE
            minimap.height = MINIMAP_SIZE
            minimapCtx = minimap.getContext('2d')
        }
        if (gameUi && !leaveGameBtn) {
            leaveGameBtn = document.createElement('a')
            leaveGameBtn.href = '../index.html'
            leaveGameBtn.textContent = 'Leave game'
            leaveGameBtn.className = 'btn btn-danger'
            leaveGameBtn.id = 'leaveGameBtn'
            leaveGameBtn.style.display = 'none'
            leaveGameBtn.style.position = 'absolute'
            leaveGameBtn.style.bottom = '14px'
            leaveGameBtn.style.left = '50%'
            leaveGameBtn.style.transform = 'translateX(-50%)'
            leaveGameBtn.style.zIndex = '10'
            gameUi.appendChild(leaveGameBtn)
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
    } else {
        init()
    }
})()
