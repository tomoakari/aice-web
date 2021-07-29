/**
 ***************************************************************
 * 設定
 ***************************************************************
 */
var fs = require("fs");

const port = 8446;
const ssl_server_key = "/etc/letsencrypt/live/conftest.aice.cloud/privkey.pem";
const ssl_server_crt = "/etc/letsencrypt/live/conftest.aice.cloud/fullchain.pem";
var options = {
    key: fs.readFileSync(ssl_server_key),
    cert: fs.readFileSync(ssl_server_crt),
};

const express = require('express')
const app = express()
const server = require('https').createServer(options, app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});
const { ExpressPeerServer } = require('peer');
//const port = 3000
const cors = require('cors')
app.use(cors())


const peerServer = ExpressPeerServer(server, {
    debug: true,
})

app.use('/peerjs', peerServer)


// EJS、ファイルアクセス
app.set('view engine', 'ejs')
app.set("views", __dirname + "/views");
app.set("public", __dirname + "/public");
//app.use(express.static('public'));

server.listen(port, () => {
    console.log('listening on *:' + port);
})

/**
 ***************************************************************
 * ルーティング
 ***************************************************************
 */
app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.get('/aice', (req, res) => {
    // res.render('view/client');
    // res.sendFile(__dirname + "/views/index_aiforus.html");
    res.render("./client.ejs");
});



/**
 ***************************************************************
 * シグナリング
 ***************************************************************
 */
const rooms = []
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.emit('message', 'ログインしました');
    socket.broadcast.emit('message', '新しいユーザが接続されました。');

    socket.on('message', (msg) => {
        const room = rooms.find(room => room.id == socket.id)
        if (room) io.to(room.roomId).emit('message', `${room.name}: ${msg}`)
    })

    socket.on('disconnect', () => {
        io.emit('message', 'ユーザからの接続が切れました。')
    });


    socket.on('join-room', (roomId, name, peerId) => {
        rooms.push({
            roomId,
            name,
            id: socket.id,
            peerId
        })
        socket.join(roomId);
        console.log("roomId:" + roomId)
        socket.emit('message', `Bot: ${name}さん、Zoomクローンにようこそ!`);
        socket.broadcast.to(roomId).emit('message', `Bot: ${name}さんが接続しました。`)
        socket.broadcast.to(roomId).emit('user-connected', peerId, socket.id)
        const members = rooms.filter(room => room.roomId == roomId);
        io.to(roomId).emit('members', members);
    })

    socket.on('disconnect', () => {
        const room = rooms.find(room => room.id == socket.id)
        const index = rooms.findIndex(room => room.id == socket.id)
        if (index !== -1) rooms.splice(index, 1)
        if (room) {
            io.to(room.roomId).emit('message', `Bot :${room.name}が退出しました。`)
            socket.to(room.roomId).broadcast.emit('user-disconnected', room.peerId)
            const members = rooms.filter(rm => rm.roomId == room.roomId);
            io.to(room.roomId).emit('members', members);
        }
    });
});