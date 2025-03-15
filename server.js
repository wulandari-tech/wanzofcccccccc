// (Kode server.js sama seperti sebelumnya)
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname));

// In-memory database (HANYA DEMO)
const users = {}; // { username: { userId: ..., messages: [] } }

// API Endpoints
app.post('/api/register', (req, res) => {
    const { username } = req.body;

    if (!username || username.trim() === "") {
        return res.status(400).json({ error: 'Username is required' });
    }
    if (users[username]) {
        return res.status(409).json({ error: 'Username already taken' });
    }

    const userId = Math.random().toString(36).substring(2, 15);
    users[username] = { userId, messages: [] };
    res.json({ username, userId });
});

app.post('/api/send/:userId', (req, res) => {
    const { userId } = req.params;
    const { message } = req.body;
    const user = Object.values(users).find(u => u.userId === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
     if (!message || message.trim() === "") {
        return res.status(400).json({ error: 'Message is required' });
    }
    user.messages.push({ text: message, timestamp: new Date() });
    res.json({ success: true });
});

app.get('/api/messages/:username', (req, res) => {
    const { username } = req.params;
    if (!users[username]) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ messages: users[username].messages });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
