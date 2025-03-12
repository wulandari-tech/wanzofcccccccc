const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let chatHistory = []; // Simpan riwayat obrolan di memori

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');

  // Kirim riwayat obrolan ke klien yang baru terhubung
  socket.emit('chat history', chatHistory);

  socket.on('chat message', (msg) => {
    console.log('message: ' + msg);
    const messageObj = { sender: socket.id, msg: msg, timestamp: Date.now() };
    chatHistory.push(messageObj); // Tambahkan ke riwayat (di memori)
    io.emit('chat message', messageObj); // Kirim ke semua klien
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
