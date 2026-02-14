const { initGame, gameLoop, addPlayerToGame, getMap, tryGrab, releaseGrab } = require('./game')
const { FRAME_RATE, PLAYERS_PER_GAME } = require('./constants')
const { makeId } = require('../utils')

const hhState = {}
const hhClientRooms = {}
const hhRoomIntervals = {}

function attachHeaveHoNamespace(io) {
    const ns = io.of('/heaveho')

    ns.on('connection', client => {
        client.on('newGame', handleNewGame)
        client.on('joinGame', handleJoinGame)
        client.on('requestGameList', handleRequestGameList)
        client.on('input', handleInput)
        client.on('releaseGrab', handleReleaseGrab)
        client.on('startLevel', handleStartLevel)

        function handleRequestGameList() {
            const list = {}
            for (const [code, game] of Object.entries(hhState)) {
                if (game != null) {
                    const count = game.players.filter(p => p.playerId != null).length
                    list[code] = { code, playerCount: count, maxPlayers: PLAYERS_PER_GAME }
                }
            }
            client.emit('loadGameList', list)
        }

        function handleNewGame(data) {
            const nickName = typeof data === 'string' ? data : (data && data.nickName)
            if (!nickName) return
            const roomName = makeId(5)
            hhClientRooms[client.id] = roomName
            hhState[roomName] = initGame(0)
            addPlayerToGame(hhState[roomName], 1, nickName)
            client.join(roomName)
            client.playerId = 1
            client.emit('gameCode', roomName)
            client.emit('init', { playerId: 1, levelIndex: 0 })
            client.emit('gameState', JSON.stringify(hhState[roomName]))
            ns.emit('loadGameList', getList())
        }

        function handleJoinGame(data) {
            if (!data || !data.gameCode) {
                client.emit('unknownGame')
                return
            }
            const game = hhState[data.gameCode]
            if (!game) {
                client.emit('unknownGame')
                return
            }
            const room = ns.adapter.rooms.get(data.gameCode)
            const inRoom = room ? room.size : 0
            const filled = game.players.filter(p => p.playerId != null).length
            if (inRoom >= PLAYERS_PER_GAME || filled >= PLAYERS_PER_GAME) {
                client.emit('tooManyPlayers')
                return
            }
            const nextId = Math.max(1, ...game.players.filter(p => p.playerId != null).map(p => p.playerId)) + 1
            addPlayerToGame(game, nextId, data.nickName)
            hhClientRooms[client.id] = data.gameCode
            client.join(data.gameCode)
            client.playerId = nextId
            client.emit('init', { playerId: nextId, levelIndex: game.levelIndex })
            const payload = JSON.stringify(game)
            setImmediate(() => {
                if (hhState[data.gameCode]) {
                    client.emit('gameState', payload)
                    ns.to(data.gameCode).emit('gameState', payload)
                }
            })
            if (game.players.filter(p => p.playerId != null).length === PLAYERS_PER_GAME) {
                game.started = true
                startGameInterval(data.gameCode)
                ns.to(data.gameCode).emit('gameState', JSON.stringify(game))
            }
            ns.emit('loadGameList', getList())
        }

        function handleStartLevel() {
            const roomName = hhClientRooms[client.id]
            if (!roomName || !hhState[roomName]) return
            const game = hhState[roomName]
            if (client.playerId !== 1) return
            const filled = game.players.filter(p => p.playerId != null).length
            if (filled < PLAYERS_PER_GAME) return
            game.started = true
            startGameInterval(roomName)
        }

        function handleInput(data) {
            const roomName = hhClientRooms[client.id]
            if (!roomName || !hhState[roomName]) return
            const player = hhState[roomName].players.find(p => p.playerId === client.playerId)
            if (!player) return
            player.move = data.move != null ? data.move : 0
            player.jump = !!data.jump
            if (data.grab) tryGrab(hhState[roomName], client.playerId)
        }

        function handleReleaseGrab() {
            const roomName = hhClientRooms[client.id]
            if (!roomName || !hhState[roomName]) return
            releaseGrab(hhState[roomName], client.playerId)
        }
    })

    function startGameInterval(roomName) {
        if (hhRoomIntervals[roomName]) return
        hhRoomIntervals[roomName] = setInterval(() => {
            const game = hhState[roomName]
            if (!game) {
                clearInterval(hhRoomIntervals[roomName])
                delete hhRoomIntervals[roomName]
                return
            }
            const result = gameLoop(game)
            ns.to(roomName).emit('gameState', JSON.stringify(game))
            if (result === 'levelComplete') {
                game.levelIndex += 1
                const nextMap = getMap(game.levelIndex)
                game.map = nextMap
                game.links = []
                for (let i = 0; i < game.players.length; i++) {
                    const p = game.players[i]
                    if (p.playerId != null) {
                        const spawn = nextMap.spawns[i] || nextMap.spawns[0]
                        p.x = spawn.x
                        p.y = spawn.y
                        p.vx = 0
                        p.vy = 0
                        p.onGround = false
                    }
                }
                game.object = nextMap.object ? { x: nextMap.object.x, y: nextMap.object.y, vx: 0, vy: 0 } : null
                ns.to(roomName).emit('levelComplete', { levelIndex: game.levelIndex })
            } else if (result === 'campaignComplete') {
                ns.to(roomName).emit('campaignComplete', {})
                clearInterval(hhRoomIntervals[roomName])
                delete hhRoomIntervals[roomName]
                hhState[roomName] = null
            }
        }, 1000 / FRAME_RATE)
    }

    function getList() {
        const list = {}
        for (const [code, game] of Object.entries(hhState)) {
            if (game != null) {
                const count = game.players.filter(p => p.playerId != null).length
                list[code] = { code, playerCount: count, maxPlayers: PLAYERS_PER_GAME }
            }
        }
        return list
    }
}

module.exports = { attachHeaveHoNamespace }
