const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Data (simpan di memori - HILANG JIKA SERVER RESTART)
const users = {}; // { socketId: { username, userId } }  // Simpan userId juga
const groups = {}; // { groupName: { members: [userId, ...], messages: [] } }
const privateMessages = {}; // { 'user1Id:user2Id': [] }

let nextUserId = 1; // ID user yang di-generate (simulasi)
let nextGroupId = 1; // ID grup yang di generate (simulasi)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// --- Simulasi Routes (tanpa database) ---

app.post('/signup', (req, res) => {
    const { username, password } = req.body; // Password masih plain text!
    if (!username || !password) {
        return res.status(400).send('Username dan password harus diisi.');
    }
    // Cek username sudah ada (simulasi)
    if (Object.values(users).some(user => user.username === username)) {
        return res.status(400).send('Username sudah digunakan.');
    }

    const userId = nextUserId++;
    users[userId] = { username, password, userId }; // Simpan password plain text dan userId!
    res.status(201).send({ message: 'Signup berhasil', userId: userId });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = Object.values(users).find(u => u.username === username && u.password === password); // Bandingkan plain text!
    if (!user) {
        return res.status(401).send('Login gagal');
    }
    res.status(200).send({ message: 'Login berhasil', userId: user.userId });
});

// --- Socket.IO ---
io.on('connection', (socket) => {
    let currentUsername = null;
    let currentUserId = null;
    let currentTarget = null; // Group name atau username

    // Middleware (simulasi autentikasi)
    socket.use((packet, next) => {
        const eventName = packet[0];
        const authEvents = ['user joined', 'create group', 'join group', 'leave group', 'start private chat', 'chat message', 'disconnect'];
        if (authEvents.includes(eventName)) {
            const userId = packet[1]?.userId;
            if (!userId) {
                return next(new Error("Authentication required."));
            }
            // Verifikasi (simulasi)
            const user = users[userId];
             if (!user) {
                return next(new Error("Invalid user ID."));
            }
            currentUsername = user.username; // Set username
            currentUserId = userId;  // Set userId
            packet[1].username = currentUsername;//tambah username ke packet
        }
        next();
    });


    socket.on('user joined', (data) => {
      const { userId, username } = data;
        console.log(`${username} joined`);

        // Kirim data awal
        socket.emit('initial data', {
            users: Object.values(users).filter(u => u.userId !== userId).map(u=> u.username),
            groups: Object.keys(groups),
        });
        socket.broadcast.emit('user joined', username);
    });

    socket.on('create group', (data) => {
        const { groupName, userId } = data;
        if (!groupName) return;

        // Cek duplikat (simulasi)
        if (groups[groupName]) {
            return socket.emit('error message', 'Nama grup sudah ada.');
        }

        const groupId = nextGroupId++;
        groups[groupName] = { members: [userId], messages: [], groupId: groupId };
        socket.join(groupName);
		console.log(`${currentUsername} membuat grup ${groupName}`);
        io.emit('group list update', Object.keys(groups));
    });

    socket.on('join group', (data) => {
      const { groupName, userId } = data;
      if (!groupName) return;

      const group = groups[groupName];
      if (!group) {
          return socket.emit('error message', 'Grup tidak ditemukan.');
      }

      if (!group.members.includes(userId)) {
          group.members.push(userId);
          socket.join(groupName);

          // Kirim riwayat pesan grup
          socket.emit('chat history', {
              target: groupName,
              messages: group.messages,
          });
        console.log(`${currentUsername} bergabung ke grup ${groupName}`);
      }
        currentTarget = groupName;
    });

    socket.on('leave group', (data) => {
      const {groupName, userId} = data;
      if(!groupName) return;

      const group = groups[groupName];
      if(!group) return;

      if(group.members.includes(userId)){
        group.members = group.members.filter(id => id !== userId);
        socket.leave(groupName);
        console.log(`${currentUsername} meninggalkan grup ${groupName}`);
        currentTarget = null;

        if(group.members.length === 0){
          delete groups[groupName];
          io.emit('group list update', Object.keys(groups));
        }
      }
    });

    socket.on('start private chat', (data) => {
      const { targetUser, userId } = data;
        currentTarget = targetUser;

        // Cari userId dari targetUser
        const targetUserObj = Object.values(users).find(u => u.username === targetUser);
        if (!targetUserObj) return;

        // Buat key (simulasi)
        const usersKey = [userId, targetUserObj.userId].sort().join(':');

        // Kirim riwayat pesan privat
        socket.emit('chat history', {
            target: targetUser,
            messages: privateMessages[usersKey] || [],
        });
    });

    socket.on('chat message', (data) => {
      const { message, userId } = data;
        if (!message) return;

        const messageData = {
            sender: currentUsername,
            message,
            timestamp: new Date(),
        };

        if (currentTarget) {
            if (groups[currentTarget]) {
                // Pesan grup
                groups[currentTarget].messages.push(messageData);
                io.to(currentTarget).emit('chat message', { ...messageData, target: currentTarget });
            } else {
                // Pesan privat

                // Cari userId dari targetUser
                const targetUserObj = Object.values(users).find(u => u.username === currentTarget);

                if (!targetUserObj) return;

                // Buat key (simulasi)
                const usersKey = [userId, targetUserObj.userId].sort().join(':');
                if (!privateMessages[usersKey]) {
                    privateMessages[usersKey] = [];
                }
                privateMessages[usersKey].push(messageData);

                // Kirim ke pengirim dan penerima
                socket.emit('chat message', { ...messageData, target: currentTarget });
                // Find the target user's socket (Very inefficient)
                const targetSocketId = Object.keys(io.sockets.sockets).find(key => {
                  const s = io.sockets.sockets[key];
                  return s.currentUsername === targetUserObj.username
                });

                if (targetSocketId) {
                  io.to(targetSocketId).emit('chat message', { ...messageData, target: currentUsername });
                }
            }
        }
    });

    socket.on('disconnect', () => {
        if (currentUsername) {
            console.log(`${currentUsername} disconnected`);
            // Hapus user dari grup (simulasi)
            for(const groupName in groups){
              if(groups[groupName].members.includes(currentUserId)){
                groups[groupName].members = groups[groupName].members.filter(id => id !== currentUserId);
              }
            }

            socket.broadcast.emit('user left', currentUsername);
        }
    });
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
