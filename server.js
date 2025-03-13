const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
let chatHistory = [];
let adminSocket = null; // Menyimpan socket admin

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

io.on('connection', (socket) => {
    console.log('a user connected');
    logActivity(`User terhubung: ${socket.id}`); // Log aktivitas koneksi

    // Kirim riwayat chat ke pengguna yang baru terhubung
    socket.emit('chat history', chatHistory);

    socket.on('chat message', (msg) => {
        console.log('message: ' + msg);
        const messageObj = { sender: socket.id, msg: msg, timestamp: Date.now() };
        chatHistory.push(messageObj);
        io.emit('chat message', messageObj);
        logActivity(`Pesan baru dari ${socket.id}: ${msg}`); //log aktifitas chat
        if (adminSocket) {
             adminSocket.emit('admin:chat-history', chatHistory);
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        logActivity(`User terputus: ${socket.id}`); // Log aktivitas diskoneksi
    });

    //Admin events
    if (socket.handshake.headers.referer.endsWith('/admin')) {
        adminSocket = socket;
         adminSocket.emit('admin:chat-history', chatHistory);

        socket.on('admin:clear-chat', () => {
             chatHistory = []; //Hapus chat history
             io.emit('chat history cleared'); //inform client
             adminSocket.emit('admin:chat-cleared');
             logActivity('Admin menghapus riwayat chat');
        });
    }
});

 // Fungsi untuk mencatat aktivitas ke admin
function logActivity(message) {
    if (adminSocket) {
        adminSocket.emit('admin:activity', message);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});
