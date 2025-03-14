const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
// GANTI INI DENGAN STRING KONEKSI MONGODB ANDA (JANGAN LAKUKAN INI DI APLIKASI NYATA!)
// PASTIKAN SUDAH MENYERTAKAN NAMA DATABASE DI URL!!!
const MONGODB_URI = 'mongodb+srv://zanssxploit:pISqUYgJJDfnLW9b@cluster0.fgram.mongodb.net?retryWrites=true&w=majority'; // GANTI!!!


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- MongoDB Setup (Sederhana) ---

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true }) // Tambah opsi
  .then(() => console.log('Terhubung ke MongoDB'))
  .catch(err => console.error('Gagal terhubung ke MongoDB:', err));

// --- Mongoose Models (Langsung di server.js) ---

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // PLAIN TEXT PASSWORD - SANGAT TIDAK AMAN!
}, { timestamps: true });

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const Message = mongoose.model('Message', messageSchema);

// --- Routes (Sederhana) ---
// Signup (Sangat Tidak Aman)
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username, password }); // Menyimpan password plain text!
        await user.save();
        res.status(201).send({ message: 'Signup berhasil', userId: user._id });
    } catch (error) {
        res.status(500).send('Error');
    }
});

// Login (Sangat Tidak Aman)
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password }); // Membandingkan password plain text!
        if (!user) {
            return res.status(401).send('Login gagal');
        }
        res.status(200).send({ message: 'Login berhasil', userId: user._id });
    } catch (error) {
        res.status(500).send('Error');
    }
});

// --- Socket.IO (dengan Validasi User ID yang Sangat Lemah) ---
io.on('connection', (socket) => {
    let currentUsername = null;
    let currentTarget = null;

    socket.use(async (packet, next) => {
      const eventName = packet[0];
      const authEvents = ['user joined', 'create group', 'join group', 'leave group', 'start private chat', 'chat message', 'disconnect'];

        if (authEvents.includes(eventName)) {
            const userId = packet[1]?.userId;
            if (!userId) {
                return next(new Error("Authentication required."));
            }

            // Verifikasi SANGAT LEMAH (hanya cek apakah ID ada di database)
            const user = await User.findById(userId);
            if (!user) {
                return next(new Error("Invalid user ID."));
            }
            currentUsername = user.username;
            packet[1].username = currentUsername; //Tambahkan username ke data event
        }
        next();
    });

    socket.on('user joined', async (data) => {
      const { userId, username } = data;
        console.log(`${username} joined`);

        // Get all users (except current user)
        const users = await User.find({ _id: { $ne: userId } }).select('username');
        // Get all group names
        const groups = await Group.find().select('name');

        socket.emit('initial data', {
            users: users.map(u => u.username),
            groups: groups.map(g => g.name),
        });
        socket.broadcast.emit('user joined', username);
    });

    socket.on('create group', async (data) => {
        const { groupName, userId } = data;

        if (!groupName) return;

        try {
            // Simple check to prevent duplicate groups (could still have race conditions)
            const existingGroup = await Group.findOne({ name: groupName });
            if(existingGroup){
              return socket.emit('error message', 'Nama grup sudah ada.');
            }

            const group = new Group({ name: groupName, members: [userId] });
            await group.save();
            socket.join(groupName);
            io.emit('group list update', [groupName]); // Only send new group name

        } catch (error) {
            console.error("Error creating group:", error);
            socket.emit('error message', 'Gagal membuat grup.');

        }
    });

    socket.on('join group', async (data) => {
      const { groupName, userId } = data;
      if (!groupName) return;
      try {
        const group = await Group.findOne({ name: groupName });
        if (!group) {
            return socket.emit('error message', 'Grup tidak ditemukan.');
        }
        if (!group.members.includes(userId)) {
          group.members.push(userId);
          await group.save();
          socket.join(groupName);

          const messages = await Message.find({ group: group._id })
            .populate('sender', 'username')
            .sort({ createdAt: 1 });

            socket.emit('chat history', {
                target: groupName,
                messages: messages.map(m => ({
                    sender: m.sender.username,
                    message: m.message,
                    timestamp: m.createdAt
                }))
            });
          console.log(`${currentUsername} joined group ${groupName}`);
        }
        currentTarget = groupName;
      } catch(err){
        console.error("Error joining group:", err);
        socket.emit('error message', 'Gagal bergabung ke grup.');
      }

    });

    socket.on('leave group', async (data) => {
        const { groupName, userId } = data;
        if(!groupName) return;
        try {
          const group = await Group.findOne({name: groupName});
          if(!group) return;

          if(group.members.includes(userId)){
            group.members.pull(userId);
            await group.save();
            socket.leave(groupName);
            console.log(`${currentUsername} left group ${groupName}`);
            currentTarget = null;
            if(group.members.length === 0){
              await Group.deleteOne({_id: group._id});
              io.emit('group list update', (await Group.find().select('name')).map(g => g.name));
            }
          }
        } catch(err) {
          console.error("Error leave group", err);
          socket.emit('error message', "Gagal keluar dari grup");
        }
    });

    socket.on('start private chat', async (data) => {
        const { targetUser, userId } = data;
        currentTarget = targetUser;

        try {
          const targetUserObj = await User.findOne({username: targetUser});
          if(!targetUserObj) return;
            // Simple key generation (not robust)
            const users = [userId, targetUserObj._id].sort();
            const chatKey = `${users[0]}-${users[1]}`;

            const messages = await Message.find({
                $or: [
                    { sender: users[0], recipient: users[1] },
                    { sender: users[1], recipient: users[0] }
                ]
            })
            .populate('sender', 'username')
            .populate('recipient', 'username')
            .sort({ createdAt: 1 });


            socket.emit('chat history', {
                target: targetUser,
                messages: messages.map(m => ({
                    sender: m.sender.username,
                    message: m.message,
                    timestamp: m.createdAt
                }))
            });

        } catch (error) {
            console.error("Error starting private chat:", error);
            socket.emit('error message', 'Gagal memulai chat privat.');
        }
    });

    socket.on('chat message', async (data) => {
        const { message, userId } = data;
        if (!message) return;

        try {
            if (currentTarget) {
              // Check if currentTarget is group or user
              const group = await Group.findOne({name: currentTarget});

              if(group){
                // Group Message
                const newMessage = new Message({ sender: userId, group: group._id, message });
                await newMessage.save();

                const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username');

                io.to(currentTarget).emit('chat message', {
                    sender: populatedMessage.sender.username,
                    message: populatedMessage.message,
                    timestamp: populatedMessage.createdAt,
                    target: currentTarget
                });
              } else {
                // Private Message
                const targetUser = await User.findOne({username: currentTarget});
                if(!targetUser) return;

                const newMessage = new Message({ sender: userId, recipient: targetUser._id, message });

                await newMessage.save();

                const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username');


                // Send to both sender and receiver
                socket.emit('chat message', {
                    sender: populatedMessage.sender.username,
                    message: populatedMessage.message,
                    timestamp: populatedMessage.createdAt,
                    target: currentTarget
                });
                // Find the target user's socket ID (Very inefficient in real app)
                const targetSocketId = Object.keys(io.sockets.sockets).find(key => {
                  const s = io.sockets.sockets[key];
                  return s.currentUsername === targetUser.username;
                });
                if (targetSocketId) {
                    io.to(targetSocketId).emit('chat message', {
                        sender: populatedMessage.sender.username, // Use the populated sender
                        message: populatedMessage.message,
                        timestamp: populatedMessage.createdAt,
                        target: currentUsername // The sender becomes the target for the recipient
                    });
                }
              }
            }

        } catch (error) {
            console.error("Error sending message:", error);
            socket.emit('error message', 'Gagal mengirim pesan.');
        }
    });
    socket.on('disconnect', async () => {
        if (currentUsername) {
          console.log(`${currentUsername} disconnected`);
          socket.broadcast.emit('user left', currentUsername);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
