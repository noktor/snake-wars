const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: process.env.PORT || 3000 },()=>{
    console.log('server started')
    console.log(process.env.PORT)
})
wss.on('connection', function connection(ws) {
   ws.on('message', (data) => {
      console.log('data received \n %o',data)
      ws.send(data);
   })
})
wss.on('listening',()=>{
   console.log('listening on 8080')
})
