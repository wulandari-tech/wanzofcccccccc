const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session({
    secret: 'secret-key-wanzofc', // Ganti dengan secret key yang kuat
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 60000 * 60 * 24 } // Sesuaikan untuk produksi (secure: true, dll.)
});

app.use(sessionMiddleware);
app.use(express.json()); // Untuk parsing body JSON

let chatHistory = [];
let users = {}; // Menyimpan data pengguna { userId: { username, password, profilePic }, ... }
let onlineUsers = {}; // Menyimpan socketId dan userId { socketId: userId, ... }

io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

// API untuk Login
app.post('/login', (req, res) => {
    const { username, password, profilePic } = req.body;
    const user = Object.values(users).find(u => u.username === username && u.password === password);

    if (user) {
        req.session.userId = user.userId;
        req.session.username = user.username;
        req.session.profilePic = profilePic;

        res.json({ success: true, user: { userId: user.userId, username: user.username, profilePic: user.profilePic } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// API untuk Signup
app.post('/signup', (req, res) => {
    const { username, password, profilePic } = req.body;
    if (Object.values(users).find(u => u.username === username)) {
        return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const userId = 'user_' + Math.random().toString(36).substring(2, 15);
    users[userId] = { userId, username, password, profilePic };
    req.session.userId = userId;
    req.session.username = username;
    req.session.profilePic = profilePic;

    res.json({ success: true, user: { userId, username, profilePic } });
});

// API untuk Logout
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// API untuk Cek Status Login
app.get('/check-login', (req, res) => {
    if (req.session.userId) {
        res.json({
            isLoggedIn: true,
            user: { userId: req.session.userId, username: req.session.username, profilePic: req.session.profilePic }
        });
    } else {
        res.json({ isLoggedIn: false });
    }
});

io.on('connection', (socket) => {
    const session = socket.request.session;

    if (session.userId) {
        onlineUsers[socket.id] = session.userId;
    }

    socket.emit('chat history', chatHistory);

    socket.on('chat message', (msgObj) => {
        if (!session.userId) { // Cek apakah pengguna sudah login
            return;
        }
        const messageObj = {
            sender: session.userId,
            msg: msgObj.msg,
            timestamp: Date.now(),
            user: { userId: session.userId, username: session.username, profilePic: session.profilePic },
        };
        chatHistory.push(messageObj);
        io.emit('chat message', messageObj);

        //Admin
        if (socket.handshake.headers.referer.endsWith('/admin')) {
            adminSocket = socket;
            adminSocket.emit('admin:chat-history', chatHistory);
            socket.on('admin:clear-chat', () => {
                 chatHistory = [];
                 io.emit('chat history cleared');
                 adminSocket.emit('admin:chat-cleared');
            });
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});
