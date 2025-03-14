const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Data (simpan di memori server - TIDAK UNTUK PRODUKSI)
const users = {};       // { socketId: username }
const groups = {};      // { groupName: { members: [socketId, ...], messages: [{sender, message, timestamp}, ...] } }
const privateMessages = {}; // { 'user1:user2': [{sender, message, timestamp}, ...] }  // Kunci unik untuk percakapan

io.on('connection', (socket) => {
    let currentUsername = null;
    let currentTarget = null;  // Grup atau pengguna yang sedang diajak chat


    socket.on('user joined', (username) => {
        currentUsername = username;
        users[socket.id] = username;
        console.log(`${username} joined with ID ${socket.id}`);

        // Kirim daftar pengguna dan grup ke klien baru
        socket.emit('initial data', {
            users: Object.values(users).filter(u => u !== currentUsername), // Semua pengguna kecuali diri sendiri
            groups: Object.keys(groups),
            // privateMessages: tidak dikirim di sini, hanya saat chat dengan user tertentu
        });

        // Beritahu semua klien lain tentang pengguna baru
        socket.broadcast.emit('user joined', username);
    });

    socket.on('create group', (groupName) => {
        if (!groups[groupName]) {
            groups[groupName] = { members: [socket.id], messages: [] };
            console.log(`${currentUsername} created group ${groupName}`);

            // Bergabung ke room Socket.IO untuk grup ini
            socket.join(groupName);

             // Kirim daftar grup yang diperbarui ke semua klien
            io.emit('group list update', Object.keys(groups));
        }
    });


    socket.on('join group', (groupName) => {
        if (groups[groupName]) {
          // Cek apakah user sudah jadi anggota
          if (!groups[groupName].members.includes(socket.id)) {
              groups[groupName].members.push(socket.id);
              socket.join(groupName); // Bergabung ke room Socket.IO
              console.log(`${currentUsername} joined group ${groupName}`);
              // Kirim riwayat pesan grup ke user yang baru bergabung
              socket.emit('chat history', {target: groupName, messages: groups[groupName].messages});
              // Tidak perlu broadcast, karena sudah di-handle oleh server
          }
          currentTarget = groupName;
        }
    });


    socket.on('leave group', (groupName) => {
      if (groups[groupName] && groups[groupName].members.includes(socket.id)) {
        groups[groupName].members = groups[groupName].members.filter(id => id !== socket.id);
        socket.leave(groupName); // Keluar dari room Socket.IO
        console.log(`${currentUsername} left group ${groupName}`);
        currentTarget = null;

          //opsional: Hapus grup jika kosong
          if(groups[groupName].members.length === 0){
              delete groups[groupName];
              io.emit('group list update', Object.keys(groups)); // Update group list untuk semua client
          }
      }
    });

    socket.on('start private chat', (targetUser) => {
        currentTarget = targetUser;

        // Buat kunci unik untuk percakapan ini
        const sortedUsernames = [currentUsername, targetUser].sort();
        const chatKey = `${sortedUsernames[0]}:${sortedUsernames[1]}`;

        // Kirim riwayat pesan privat (jika ada)
        socket.emit('chat history', {
            target: targetUser,
            messages: privateMessages[chatKey] || []
        });
    });


    socket.on('chat message', (data) => {
        const { message } = data;
        const timestamp = new Date();
        const messageData = { sender: currentUsername, message, timestamp };

        if (currentTarget) {
            if (groups[currentTarget]) {
                // Pesan grup
                groups[currentTarget].messages.push(messageData);
                io.to(currentTarget).emit('chat message', { ...messageData, target: currentTarget }); // Kirim ke room
            } else {
                // Pesan privat
                const targetSocketId = Object.keys(users).find(key => users[key] === currentTarget);
                if (targetSocketId) {
                    // Buat kunci unik
                    const sortedUsernames = [currentUsername, currentTarget].sort();
                    const chatKey = `${sortedUsernames[0]}:${sortedUsernames[1]}`;

                    if (!privateMessages[chatKey]) {
                        privateMessages[chatKey] = [];
                    }
                    privateMessages[chatKey].push(messageData);
					// Kirim ke pengirim dan penerima
                    socket.emit('chat message', { ...messageData, target: currentTarget });
                    io.to(targetSocketId).emit('chat message', { ...messageData, target: currentUsername });
                }
            }
        }
    });


    socket.on('disconnect', () => {
        if (currentUsername) {
            console.log(`${currentUsername} disconnected`);
            delete users[socket.id];

             // Hapus user dari semua grup tempat dia berada
            for (const groupName in groups) {
                if (groups[groupName].members.includes(socket.id)) {
                  groups[groupName].members = groups[groupName].members.filter(id => id !== socket.id);
                  socket.leave(groupName);

                   // Hapus grup jika kosong
                    if (groups[groupName].members.length === 0) {
                        delete groups[groupName];
                    }
                }
            }

            // Beritahu klien lain
            socket.broadcast.emit('user left', currentUsername);
			io.emit('group list update', Object.keys(groups));
        }
    });
});



server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
