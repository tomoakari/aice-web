const socket = io({
    autoConnect: false,
});
const videos = [];

const app = Vue.createApp({
    data: function () {
        return {
            message: "",
            messages: [""],
            name: '',
            roomId: '',
            members: [],
            myPeer: new Peer(),
            myVideo: '',
            onVideo: true,
            onMute: false,
            myStream: '',
        }
    },
    created() {
    },
    mounted() {
        socket.on('message', (msg) => {
            this.messages.push(msg)
        });
        socket.on('members', (members) => {
            this.members = members;
        });
        this.setVideo()
    },
    methods: {
        sendMessage() {
            socket.emit('message', this.message)
            this.message = ''
        },
        joinRoom(roomId) {
            this.roomId = roomId;
            this.myPeer = new Peer(undefined, {
                host: '/',
                port: 8446,
                path: '/peerjs',
                debug: 3
            });
            socket.open();
            this.myPeer.on('open', peerId => {
                socket.emit('join-room', this.roomId, this.name, peerId);
            })
        },
        leaveRoom() {
            this.roomId = "";
            this.name = "";
            this.messages = [];
            this.members = [];
            this.myPeer.destroy();
            socket.close();
        },
        startVideo() {
            this.onVideo = true;
            const tracks = this.myStream.getVideoTracks();
            tracks[0].enabled = true;
        },
        stopVideo() {
            this.onVideo = false;
            const tracks = this.myStream.getVideoTracks();
            tracks[0].enabled = false;
        },
        startAudio() {
            this.onMute = false;
            const tracks = this.myStream.getVideoTracks();
            tracks[0].mute = false;
        },
        stopAudio() {
            this.onMute = true;
            const tracks = this.myStream.getVideoTracks();
            tracks[0].mute = true;
        },
        setVideo() {
            this.myVideo = document.createElement('video')
            this.myVideo.muted = true

            navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
            }).then(stream => {
                this.myStream = stream;
                this.myVideo.srcObject = this.myStream;
                this.myVideo.play()
                this.$refs.video.append(this.myVideo)

                this.myPeer.on('call', call => {
                    const video = document.createElement('video')
                    videos.push({
                        video: video,
                        peerId: call.peer,
                    });
                    call.answer(stream);

                    call.on('stream', stream => {
                        video.srcObject = stream;
                        video.play()
                        this.$refs.video.append(video)
                    });

                    call.on('close', () => {
                        console.log('answerしたブラウザが退出')
                        video.remove()
                    })
                });

                socket.on('user-connected', (peerId) => {
                    const call = this.myPeer.call(peerId, stream)
                    const video = document.createElement('video')
                    videos.push({
                        video: video,
                        peerId: call.peer,
                    });
                    call.on('stream', stream => {
                        video.srcObject = stream;
                        video.play()
                        this.$refs.video.append(video)
                    });
                    //callした方が退室する際に実行
                    call.on('close', () => {
                        console.log('callしたブラウザで退出')
                        video.remove()
                    })
                });

                socket.on('user-disconnected', (peerId) => {
                    const video = videos.find(video => video.peerId == peerId)
                    if (video) video.video.remove();
                })

            }).catch(e => {
                console.log(e)
            })
        }
    }
}).mount('#app')

