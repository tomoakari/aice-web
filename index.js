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


const cors = require('cors')
app.use(cors())

const server = require('https').createServer(options, app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
});

// Peerサーバ
const { ExpressPeerServer } = require('peer');

const peerServer = ExpressPeerServer(server, {
    debug: true,
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
})

app.use('/peerjs', peerServer)


// EJS、ファイルアクセス
app.set('view engine', 'ejs')
app.set("views", __dirname + "/views");
//app.set("public", __dirname + "/public");
//app.use(express.static('public'));
app.use(express.static(__dirname + "/public"));


// POSTにも対応
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

server.listen(port, () => {
    console.log('listening on *:' + port);
})

/**
 ***************************************************************
 * ルーティング
 ***************************************************************
 */

app.get('/', (req, res) => {
    res.render("./login.ejs");
});

/**
 * 会議室ページ
 */
app.post("/", (req, res) => {
    var data = {
        user_name: req.body.user_name,
        room_id: req.body.room_id,
    };
    res.render("./client.ejs", data);
});



/**
 ***************************************************************
 * シグナリング
 ***************************************************************
 */
const rooms = []
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.emit('message', 'ソケットサーバに接続しました');
    // socket.broadcast.emit('message', '新しいユーザが接続されました。');

    socket.on('message', (msg) => {
        console.log("msg:" + msg)
        const room = rooms.find(room => room.id == socket.id)
        if (room) io.to(room.roomId).emit('message', `${room.name}: ${msg}`)
    })

    socket.on('join-room', (roomId, name, peerId) => {
        console.log('join-room:' + roomId + '_' + name + '_' + peerId)
        rooms.push({
            roomId,
            name,
            id: socket.id,
            peerId
        })
        socket.join(roomId);
        console.log("roomId:" + roomId)
        socket.emit('message', `${name}さん、AICE CLOUD へようこそ`);
        socket.broadcast.to(roomId).emit('message', `${name}さんが${roomId}に入室しました。`)
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
            socket.broadcast.to(room.roomId).emit('user-disconnected', room.peerId)
            const members = rooms.filter(rm => rm.roomId == room.roomId);
            io.to(room.roomId).emit('members', members);
        }
    });

});