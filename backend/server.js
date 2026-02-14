process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

const http = require('http')
const { Server } = require('socket.io')

// CORS: allow Netlify frontend and localhost (Socket.IO needs this for cross-origin polling)
const ALLOWED_ORIGINS = [
  'https://competent-bhabha-e702ed.netlify.app',
  /^https:\/\/[\w-]+\.netlify\.app$/,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
]

// No request handler here – Socket.IO must receive requests for /socket.io/
const httpServer = http.createServer()

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  },
  // Accept EIO=3 so crawlers / direct hits don't flood 400 "Unsupported protocol version"
  allowEIO3: true
})

// Health check (Socket.IO attaches its own listener and handles /socket.io/)
httpServer.on('request', (req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Snake Wars backend')
  }
  // do not respond for other paths – Socket.IO will handle /socket.io/
})

const { initGame, gameLoop, getUpdatedVelocity, addPlayerToGame, applyFart, activateHunt } = require('./game')
const { FRAME_RATE, MAX_PLAYERS } = require('./constants')
const { makeId, logGameScore, scoreBoard, normalizeNickname } = require('./utils')
const { attachBRNamespace } = require('./br')
const { attachHeaveHoNamespace } = require('./heaveho')

const state = {}
const clientRooms = {}
const userList = {}

io.on('connection', client => {
    client.on('keydown', handleKeydown)
    client.on('newGame', handleNewGame)
    client.on('joinGame', handleJoinGame)
    client.on('retry', handleRetry)
    client.on('requestGameList', handleRequestGameList)
    client.on('nickname', handleNickname)
    client.on('fart', handleFart)
    client.on('hack', handleHack)

    console.log("CLIENT CONNECTED")
    console.log(client.id)

    userList[client.id] = {}
    userList[client.id].id = client.id

    client.emit('scoreBoard', scoreBoard())
    io.emit('updateUserList', userList)

    function handleNickname(nickName) {
        userList[client.id].nickName = normalizeNickname(nickName)
        io.emit('updateUserList', userList)
    }

    function handleRequestGameList() {
        client.emit('loadGameList', state)
    }

    function handleJoinGame(data) {
        if (!data || !data.gameCode) {
            client.emit('unknownGame')
            return
        }
        const rooms = io.sockets.adapter.rooms
        const room = typeof rooms.get === 'function' ? rooms.get(data.gameCode) : rooms[data.gameCode]
        const gameState = state[data.gameCode]

        if (!gameState) {
            client.emit('unknownGame')
            return
        }

        userList[client.id].nickName = normalizeNickname(data.nickName)

        let numClients = 0
        if (room) {
            numClients = typeof room.size === 'number' ? room.size : Object.keys(room.sockets || {}).length
        }

        if (numClients === 0) {
            client.emit('unknownGame')
            return
        }
        if (numClients >= MAX_PLAYERS) {
            client.emit('tooManyPlayers')
            return
        }

        const nextPlayerId = Math.max(0, ...gameState.players.map(p => p.playerId)) + 1
        addPlayerToGame(gameState, nextPlayerId, normalizeNickname(data.nickName), data.color, data.skinId)

        clientRooms[client.id] = data.gameCode
        client.join(data.gameCode)
        client.number = nextPlayerId
        client.emit('init', nextPlayerId)
        // Defer first gameState so client has processed 'init' and canvas is ready
        const statePayload = JSON.stringify(gameState)
        setImmediate(() => {
            if (state[data.gameCode]) {
                client.emit('gameState', statePayload)
                io.to(data.gameCode).emit('gameState', statePayload)
            }
        })
        console.log("USER LIST")
        console.log(userList)
        io.emit('updateUserList', userList)
    }

    function handleNewGame(data) {
        const nickName = normalizeNickname(typeof data === 'string' ? data : (data && data.nickName))
        const color = typeof data === 'object' && data ? data.color : null
        const skinId = typeof data === 'object' && data ? data.skinId : 0
        if (!nickName) return
        let roomName = makeId(5)
        clientRooms[client.id] = roomName
        client.emit('gameCode', roomName)

        userList[client.id].nickName = nickName

        state[roomName] = initGame(nickName, color, skinId)

        client.join(roomName)
        client.number = 1
        client.emit('init', 1)
        client.emit('gameState', JSON.stringify(state[roomName]))
        startGameInterval(roomName)
        io.emit('loadGameList', state)
        console.log("USER LIST")
        console.log(userList)
        io.emit('updateUserList', userList)
    }

    function handleKeydown(keyCode) {
        const roomName = clientRooms[client.id]

        if(!roomName) {
            return
        }

        try {
            keyCode = parseInt(keyCode)
        } catch(e) {
            // console.log(e)
            return
        }

        if (state[roomName]) {
            const player = state[roomName].players.find(p => p.playerId === client.number)
            if (!player || player.dead) return
            const vel = getUpdatedVelocity(player.vel, keyCode)
            if (vel) player.vel = vel
        }
    }

    function handleFart() {
        const roomName = clientRooms[client.id]
        if (!roomName || !state[roomName]) return
        const gameState = state[roomName]
        const farter = gameState.players.find(p => p.playerId === client.number && !p.dead)
        if (!farter || !farter.pos) return
        applyFart(gameState, client.number)
        io.to(roomName).emit('fart', JSON.stringify({ playerId: client.number, x: farter.pos.x, y: farter.pos.y }))
    }

    function handleHack() {
        const roomName = clientRooms[client.id]
        if (!roomName || !state[roomName]) return
        const gameState = state[roomName]
        if (activateHunt(gameState, client.number)) {
            io.to(roomName).emit('huntActivated', JSON.stringify({ by: client.number }))
        }
    }

    function handleRetry(retry) {
        const roomName = clientRooms[client.id]

        if(!roomName) {
            return
        }

        if(retry) {
            client.emit('init', 2)
        } else {
            state[roomName] = null
        }
    }
})

const roomIntervals = {}

function startGameInterval(roomName) {
    if (roomIntervals[roomName]) return
    roomIntervals[roomName] = setInterval(() => {
        const gameState = state[roomName]
        if (!gameState) {
            clearInterval(roomIntervals[roomName])
            delete roomIntervals[roomName]
            return
        }
        const winner = gameLoop(gameState)
        if (winner === false) {
            emitGameState(roomName, gameState)
        } else {
            emitGameOver(roomName, winner)
            logGameScore(gameState.players)
            state[roomName] = null
            clearInterval(roomIntervals[roomName])
            delete roomIntervals[roomName]
            io.emit('loadGameList', state)
        }
    }, 1000 / FRAME_RATE)
}

function emitGameState(roomName, state) {
    io.sockets.in(roomName)
        .emit('gameState', JSON.stringify(state))
}

function emitGameOver(roomName, winner) {
    io.sockets.in(roomName)
        .emit('gameOver', JSON.stringify({ winner }))
}

attachBRNamespace(io)
attachHeaveHoNamespace(io)

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Snake Wars backend listening on port ${PORT}`)
})