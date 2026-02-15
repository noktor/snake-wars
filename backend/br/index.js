const { initGame, gameLoop, addPlayerToGame, setWeaponIndex, setWeaponMode, buyItem, useGrenadeBlind, placeTrap, useDrone } = require('./game')
const { FRAME_RATE, BR_MAX_PLAYERS } = require('./constants')
const { makeId, normalizeNickname } = require('../utils')

const brState = {}
const brClientRooms = {}
const brRoomIntervals = {}

function attachBRNamespace(io) {
    const brNamespace = io.of('/br')

    brNamespace.on('connection', client => {
        client.on('newGame', handleNewGame)
        client.on('joinGame', handleJoinGame)
        client.on('requestGameList', handleRequestGameList)
        client.on('move', handleMove)
        client.on('attack', handleAttack)
        client.on('selectWeapon', handleSelectWeapon)
        client.on('buyItem', handleBuyItem)
        client.on('useItem', handleUseItem)
        client.on('placeTrap', handlePlaceTrap)
        client.on('setWeaponMode', handleSetWeaponMode)

        function handleRequestGameList() {
            const list = {}
            for (const [code, game] of Object.entries(brState)) {
                if (game != null) list[code] = { code, playerCount: game.players.length }
            }
            client.emit('loadGameList', list)
        }

        function handleNewGame(data) {
            const nickName = normalizeNickname(typeof data === 'string' ? data : (data && data.nickName))
            const color = typeof data === 'object' && data ? data.color : null
            if (!nickName) return
            const roomName = makeId(5)
            brClientRooms[client.id] = roomName
            client.emit('gameCode', roomName)
            brState[roomName] = initGame(nickName, color)
            client.join(roomName)
            client.playerId = 1
            client.emit('init', 1)
            client.emit('gameState', JSON.stringify(brState[roomName]))
            startBRGameInterval(roomName)
            brNamespace.emit('loadGameList', getBRGameList())
        }

        function handleJoinGame(data) {
            if (!data || !data.gameCode) {
                client.emit('unknownGame')
                return
            }
            const gameState = brState[data.gameCode]
            if (!gameState) {
                client.emit('unknownGame')
                return
            }
            const room = brNamespace.adapter.rooms.get(data.gameCode)
            const numClients = room ? room.size : 0
            if (numClients === 0) {
                client.emit('unknownGame')
                return
            }
            if (numClients >= BR_MAX_PLAYERS) {
                client.emit('tooManyPlayers')
                return
            }
            const nextPlayerId = Math.max(0, ...gameState.players.map(p => p.playerId)) + 1
            addPlayerToGame(gameState, nextPlayerId, normalizeNickname(data.nickName), data.color)
            brClientRooms[client.id] = data.gameCode
            client.join(data.gameCode)
            client.playerId = nextPlayerId
            client.emit('init', nextPlayerId)
            const payload = JSON.stringify(gameState)
            setImmediate(() => {
                if (brState[data.gameCode]) {
                    client.emit('gameState', payload)
                    brNamespace.to(data.gameCode).emit('gameState', payload)
                }
            })
        }

        function handleMove(data) {
            const roomName = brClientRooms[client.id]
            if (!roomName || !brState[roomName]) return
            const player = brState[roomName].players.find(p => p.playerId === client.playerId)
            if (!player || player.dead) return
            player.moveDir = { x: data.x || 0, y: data.y || 0 }
            if (typeof data.angle === 'number') player.angle = data.angle
        }

        function handleAttack() {
            const roomName = brClientRooms[client.id]
            if (!roomName || !brState[roomName]) return
            const player = brState[roomName].players.find(p => p.playerId === client.playerId)
            if (!player || player.dead) return
            player.attackRequested = true
        }

        function handleSelectWeapon(index) {
            const roomName = brClientRooms[client.id]
            if (!roomName || !brState[roomName]) return
            setWeaponIndex(brState[roomName], client.playerId, index)
        }

        function handleBuyItem(data) {
            const roomName = brClientRooms[client.id]
            if (!roomName || !brState[roomName]) return
            const itemId = typeof data === 'object' && data != null ? data.itemId : data
            buyItem(brState[roomName], client.playerId, itemId)
        }

        function handleUseItem(data) {
            const roomName = brClientRooms[client.id]
            if (!roomName || !brState[roomName]) return
            const itemType = (typeof data === 'object' && data != null ? data.itemType : data) || ''
            if (itemType === 'grenade_blind') {
                useGrenadeBlind(brState[roomName], client.playerId)
            } else if (itemType === 'item_drone') {
                useDrone(brState[roomName], client.playerId)
            }
        }

        function handlePlaceTrap() {
            const roomName = brClientRooms[client.id]
            if (!roomName || !brState[roomName]) return
            placeTrap(brState[roomName], client.playerId)
        }

        function handleSetWeaponMode(data) {
            const roomName = brClientRooms[client.id]
            if (!roomName || !brState[roomName]) return
            const mode = (typeof data === 'object' && data != null ? data.mode : data) || 'normal'
            setWeaponMode(brState[roomName], client.playerId, mode)
        }
    })

    function startBRGameInterval(roomName) {
        if (brRoomIntervals[roomName]) return
        brRoomIntervals[roomName] = setInterval(() => {
            const gameState = brState[roomName]
            if (!gameState) {
                clearInterval(brRoomIntervals[roomName])
                delete brRoomIntervals[roomName]
                return
            }
            const winner = gameLoop(gameState)
            if (winner === false) {
                brNamespace.to(roomName).emit('gameState', JSON.stringify(gameState))
            } else {
                brNamespace.to(roomName).emit('gameOver', JSON.stringify({ winner: winner || null }))
                brState[roomName] = null
                clearInterval(brRoomIntervals[roomName])
                delete brRoomIntervals[roomName]
                brNamespace.emit('loadGameList', getBRGameList())
            }
        }, 1000 / FRAME_RATE)
    }

    function getBRGameList() {
        const list = {}
        for (const [code, game] of Object.entries(brState)) {
            if (game != null) list[code] = { code, playerCount: game.players.length }
        }
        return list
    }
}

module.exports = { attachBRNamespace }
