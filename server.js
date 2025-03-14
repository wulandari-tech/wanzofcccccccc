const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Struktur data utama untuk menyimpan history chat dan keanggotaan grup
const chatHistory = {
    private: {}, // { "user1-user2": [ {sender, recipient, message, timestamp, id} ] }
    group: {}     // { "groupId": [ {sender, message, timestamp, id, groupName} ] }
};

const registeredUsers = new Set(); // Menyimpan username, BUKAN daftar user online
const userSockets = new Map();      // Menyimpan socketId berdasarkan username

io.on('connection', (socket) => {
    console.log('a user connected');
    let currentUser = null;
    let currentGroup = null;


    socket.on('registerUsername', (username) => {
        if (registeredUsers.has(username)) {
            socket.emit('usernameTaken');
            return;
        }

        registeredUsers.add(username);
        currentUser = username;
        userSockets.set(username, socket.id); // Simpan socket ID
        socket.username = username; // Simpan username di objek socket
        socket.emit('usernameRegistered', username);
        io.emit('onlineUsers', getOnlineUsers()); // Kirim daftar user online ke semua
        socket.join('general');
        currentGroup = "general";
        // Kirim history chat "general"
        socket.emit('groupChatHistory', chatHistory.group['general'] || []);
    });

      // Event:  Logout
    socket.on('logout', () => {
        if (currentUser) {
            registeredUsers.delete(currentUser);
            userSockets.delete(currentUser);
            socket.leaveAll(); // Keluar dari semua room
            currentUser = null;
            currentGroup = null
            io.emit('onlineUsers', getOnlineUsers()); // Update daftar online
            //socket.disconnect(true); // Opsi: putuskan koneksi
        }
    });

    socket.on('privateMessage', ({ recipient, message }) => {
        if (!currentUser) return;

        const messageId = uuidv4();
        const timestamp = new Date().toISOString();
        const chatKey = [currentUser, recipient].sort().join('-');

        if (!chatHistory.private[chatKey]) {
            chatHistory.private[chatKey] = [];
        }
        const newMessage = { sender: currentUser, recipient, message, timestamp, id: messageId };
        chatHistory.private[chatKey].push(newMessage);

        // Kirim ke pengirim
        socket.emit('privateMessage', newMessage);

        // Kirim ke penerima, jika online
        const recipientSocketId = userSockets.get(recipient);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('privateMessage', newMessage);
        }
    });

    socket.on('groupMessage', ({ groupName, message }) => {
        if (!currentUser || !groupName) return;

        const messageId = uuidv4();
        const timestamp = new Date().toISOString();

        if (!chatHistory.group[groupName]) {
            chatHistory.group[groupName] = [];
        }
        const newMessage = { sender: currentUser, message, timestamp, id: messageId, groupName };
        chatHistory.group[groupName].push(newMessage);

        // Kirim ke SEMUA anggota grup
        io.to(groupName).emit('groupMessage', newMessage);
    });

    socket.on('createGroup', (groupName) => {
      if (!currentUser) return;
      if(groupName.trim() === '' || groupName.trim() === 'general'){
        socket.emit("groupError", "Nama Group tidak valid")
        return;
      }

      if (chatHistory.group[groupName]) {
        socket.emit('groupExists', groupName); // Beri tahu kalau grup sudah ada
      } else {
        chatHistory.group[groupName] = []; // Buat entry baru di chatHistory
        socket.join(groupName);          // Tambahkan user ke room grup
        currentGroup = groupName
        socket.emit('groupCreated', groupName);      // Konfirmasi ke user
        io.emit('groupListUpdate', Object.keys(chatHistory.group)); // Update daftar grup di semua klien
      }
    });

    socket.on('joinGroup', (groupName) => {
        if (!currentUser) return;
        socket.leaveAll(); // Tinggalkan semua grup sebelumnya
        socket.join(groupName);
        currentGroup = groupName;

        socket.emit('joinedGroup', groupName);
        // Kirim SELURUH history grup ke pengguna yang baru bergabung
        socket.emit('groupChatHistory', chatHistory.group[groupName] || []);
    });

    socket.on('requestPrivateChatHistory', (recipient) => {
        if (!currentUser) return;
        const chatKey = [currentUser, recipient].sort().join('-');
        socket.emit('privateChatHistory', chatHistory.private[chatKey] || []);
    });

    // Helper function untuk mendapatkan daftar user online
    function getOnlineUsers() {
        return Array.from(userSockets.keys());
    }

    socket.on('disconnect', () => {
        console.log('user disconnected');
        if (currentUser) {
            userSockets.delete(currentUser);
            io.emit('onlineUsers', getOnlineUsers());  // Update daftar user online
        }
    });
});

server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});
