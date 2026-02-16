const { initGame, gameLoop, getStateForPlayer, commandMove, commandAttack, commandGather, commandBuild, commandTrainUnit } = require('./game')
const { FRAME_RATE, MAX_PLAYERS } = require('./constants')
const { makeId, normalizeNickname } = require('../utils')

const rtsState = {}
const rtsClientRooms = {}
const rtsRoomIntervals = {}
const rtsPlayerMap = {} // clientId -> { roomName, playerId, name }

function attachRTSNamespace(io) {
    const rtsNs = io.of('/rts')

    rtsNs.on('connection', client => {
        client.on('newGame', handleNewGame)
        client.on('joinGame', handleJoinGame)
        client.on('requestGameList', handleRequestGameList)
        client.on('command', handleCommand)
        client.on('trainUnit', handleTrainUnit)
        client.on('buildBuilding', handleBuildBuilding)
        client.on('disconnect', handleDisconnect)

        function handleRequestGameList() {
            client.emit('loadGameList', getRTSGameList())
        }

        function handleNewGame(data) {
            const nickName = normalizeNickname(typeof data === 'string' ? data : (data && data.nickName))
            if (!nickName) return

            const vsAI = data && data.vsAI
            const aiDifficulty = (data && data.aiDifficulty) || 'easy'

            const roomName = makeId(5)
            rtsClientRooms[client.id] = roomName
            rtsPlayerMap[client.id] = { roomName, playerId: 1, name: nickName }

            const state = initGame()

            if (vsAI) {
                // AI game: start immediately
                const diffLabel = aiDifficulty.charAt(0).toUpperCase() + aiDifficulty.slice(1)
                const aiName = 'AI (' + diffLabel + ')'
                state.ai = { playerId: 2, difficulty: aiDifficulty, lastDecisionTick: 0 }
                rtsState[roomName] = { game: state, playerNames: { 1: nickName, 2: aiName }, started: true }

                client.join(roomName)
                client.emit('init', {
                    playerId: 1,
                    mapData: {
                        tiles: state.tiles,
                        resources: state.resources,
                        mapWidth: state.mapWidth,
                        mapHeight: state.mapHeight
                    },
                    playerNames: { 1: nickName, 2: aiName }
                })

                startRTSGameInterval(roomName)
            } else {
                // PvP game: wait for opponent
                rtsState[roomName] = { game: state, playerNames: { 1: nickName, 2: null }, started: false }

                client.join(roomName)
                client.emit('gameCode', roomName)
                client.emit('waiting', { message: 'Waiting for opponent...' })
            }
            rtsNs.emit('loadGameList', getRTSGameList())
        }

        function handleJoinGame(data) {
            if (!data || !data.gameCode) { client.emit('unknownGame'); return }

            const room = rtsState[data.gameCode]
            if (!room || !room.game) { client.emit('unknownGame'); return }

            if (room.started) { client.emit('tooManyPlayers'); return }

            const rtsRoom = rtsNs.adapter.rooms.get(data.gameCode)
            const numClients = rtsRoom ? rtsRoom.size : 0
            if (numClients >= MAX_PLAYERS) { client.emit('tooManyPlayers'); return }

            const nickName = normalizeNickname(data.nickName)
            rtsClientRooms[client.id] = data.gameCode
            rtsPlayerMap[client.id] = { roomName: data.gameCode, playerId: 2, name: nickName }
            room.playerNames[2] = nickName

            client.join(data.gameCode)

            // Start the game
            room.started = true

            // Send init to both players
            const sockets = rtsNs.adapter.rooms.get(data.gameCode)
            if (sockets) {
                for (const sid of sockets) {
                    const s = rtsNs.sockets.get(sid)
                    if (!s) continue
                    const pInfo = rtsPlayerMap[sid]
                    if (!pInfo) continue
                    s.emit('init', {
                        playerId: pInfo.playerId,
                        mapData: {
                            tiles: room.game.tiles,
                            resources: room.game.resources,
                            mapWidth: room.game.mapWidth,
                            mapHeight: room.game.mapHeight
                        },
                        playerNames: room.playerNames
                    })
                }
            }

            startRTSGameInterval(data.gameCode)
            rtsNs.emit('loadGameList', getRTSGameList())
        }

        function handleCommand(data) {
            if (!data) return
            const pInfo = rtsPlayerMap[client.id]
            if (!pInfo) return
            const room = rtsState[pInfo.roomName]
            if (!room || !room.game || !room.started) return

            const { unitIds, type, targetX, targetY, targetId } = data
            if (!unitIds || !Array.isArray(unitIds)) return

            switch (type) {
                case 'move':
                    commandMove(room.game, pInfo.playerId, unitIds, targetX, targetY)
                    break
                case 'attack':
                    commandAttack(room.game, pInfo.playerId, unitIds, targetId)
                    break
                case 'gather':
                    commandGather(room.game, pInfo.playerId, unitIds, targetX, targetY)
                    break
            }
        }

        function handleTrainUnit(data) {
            if (!data) return
            const pInfo = rtsPlayerMap[client.id]
            if (!pInfo) return
            const room = rtsState[pInfo.roomName]
            if (!room || !room.game || !room.started) return
            commandTrainUnit(room.game, pInfo.playerId, data.buildingId, data.unitType)
        }

        function handleBuildBuilding(data) {
            if (!data) return
            const pInfo = rtsPlayerMap[client.id]
            if (!pInfo) return
            const room = rtsState[pInfo.roomName]
            if (!room || !room.game || !room.started) return
            commandBuild(room.game, pInfo.playerId, data.unitId, data.buildingType, data.x, data.y)
        }

        function handleDisconnect() {
            const pInfo = rtsPlayerMap[client.id]
            if (!pInfo) return
            const roomName = pInfo.roomName
            delete rtsPlayerMap[client.id]
            delete rtsClientRooms[client.id]

            const room = rtsState[roomName]
            if (!room) return

            if (room.started) {
                // AI game: just clean up (no opponent to notify)
                // PvP game: the other player wins
                if (!room.game || !room.game.ai) {
                    const winnerId = pInfo.playerId === 1 ? 2 : 1
                    rtsNs.to(roomName).emit('gameOver', { winnerId, reason: 'disconnect' })
                }
                clearInterval(rtsRoomIntervals[roomName])
                delete rtsRoomIntervals[roomName]
                delete rtsState[roomName]
            } else {
                delete rtsState[roomName]
            }
            rtsNs.emit('loadGameList', getRTSGameList())
        }
    })

    function startRTSGameInterval(roomName) {
        if (rtsRoomIntervals[roomName]) return
        rtsRoomIntervals[roomName] = setInterval(() => {
            const room = rtsState[roomName]
            if (!room || !room.game) {
                clearInterval(rtsRoomIntervals[roomName])
                delete rtsRoomIntervals[roomName]
                return
            }

            const result = gameLoop(room.game)
            if (result === false) {
                // Send fog-of-war filtered state to each player
                const sockets = rtsNs.adapter.rooms.get(roomName)
                if (sockets) {
                    for (const sid of sockets) {
                        const s = rtsNs.sockets.get(sid)
                        if (!s) continue
                        const pInfo = rtsPlayerMap[sid]
                        if (!pInfo) continue
                        const filtered = getStateForPlayer(room.game, pInfo.playerId)
                        s.emit('gameState', filtered)
                    }
                }
            } else {
                rtsNs.to(roomName).emit('gameOver', { winnerId: result.winnerId, reason: 'destroyed' })
                clearInterval(rtsRoomIntervals[roomName])
                delete rtsRoomIntervals[roomName]
                delete rtsState[roomName]
                rtsNs.emit('loadGameList', getRTSGameList())
            }
        }, 1000 / FRAME_RATE)
    }

    function getRTSGameList() {
        const list = {}
        for (const [code, room] of Object.entries(rtsState)) {
            if (room && !room.started) {
                list[code] = { code, playerCount: 1, hostName: room.playerNames[1] || 'Unknown' }
            }
        }
        return list
    }
}

module.exports = { attachRTSNamespace }
