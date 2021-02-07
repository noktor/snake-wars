const { makeId } = require('./utils')
const { initChat } = require('./chat')

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 },()=>{
    console.log('server started')
    console.log(process.env.PORT)
})

const chats = {}
const clientRooms = {}
const rooms = {}

wss.on('connection', socket => {
   const uuid = socket.id
   socket.on('message', (data) => {
      console.log('data received \n %o',data)
      socket.send('Bon dia pel matí a la vila del pingüí')
   })

   //socket.on('createChatRoom', handleCreateChatRoom)
   socket.on('joinChatRoom', handleCreateChatRoom)

   console.log("CLIENT CONNECTED")
   console.log(socket)
   console.log(socket.id)

   socket.on("close", () => {
      // for each room, remove the closed socket
      console.log("deleted rooms")
      Object.keys(rooms).forEach(room => leave(room));
      console.log(rooms)
   });

   function handleCreateChatRoom() {
         // const { message, meta, room } = data;
      
         if(! rooms['room1']) {
            console.log("create room")
           if(! rooms['room1']) rooms['room1'] = {}; // create the room
           if(! rooms['room1'][uuid]) rooms['room1'][uuid] = socket; // join the room
           Object.entries(rooms['room1']).forEach(([, sock]) => sock.send( 'Missatge de prova CREACIO' ));
         } else {
            console.log("join room")
           // send the message to all in the room
           Object.entries(rooms['room1']).forEach(([, sock]) => sock.send( 'Missatge de prova JOIN' ));
         }

         console.log(rooms)
         // if(Object.keys(clientRooms).length === 0) {
         //    let privateChatName = makeId(5)
         //    clientRooms[client.id] = privateChatName
         //    //  client.emit('privateChatCode', privateChatName)
         //    //  chats[privateChatName] = initGame()
         //    client.join(privateChatName)
         // } else {
         //    client.join(Object.keys(clientRooms)[0])

         //    const room = io.sockets.adapter.rooms[Object.keys(clientRooms)[0]]

         //    let allUsers
     
         //    if(room) {
         //        allUsers = room.sockets
         //    }
     
         //    let numClients = 0
         //    if(allUsers) {
         //        numClients = Object.keys(allUsers).length
         //    }
     
         //    //room.sockets.

         // }
         
      // }
      //  client.number = 1
      //  client.emit('init', 1)
   }

})

wss.on('listening',()=>{
   console.log('listening on 8080')
})



