const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Sediakan index.html (karena tidak ada folder public)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const users = {}; // Menyimpan daftar user yang online

io.on('connection', (socket) => {
  let user = null; // Simpan username untuk socket ini.

  socket.on('user joined', (username) => {
    user = username; // Simpan username yang terhubung ke socket ini.
    users[socket.id] = username; //Tambahkan ke daftar user online
    console.log('User joined:', username, 'dengan ID:', socket.id);
    io.emit('user joined', username); // Broadcast ke semua klien
  });

  socket.on('chat message', (data) => {
    console.log('Pesan dari', data.username, ':', data.message);
    io.emit('chat message', data);
  });

  socket.on('disconnect', () => {
    if (user) {
      console.log(user, 'terputus');
      delete users[socket.id]; //Hapus user dari daftar online
      io.emit('user left', user); // Beritahu klien lain
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
