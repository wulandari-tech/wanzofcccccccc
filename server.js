const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname));

// In-memory database (HANYA UNTUK DEMO)
const users = {}; // { username: { messages: [] } }  <-- Struktur lebih sederhana

// API Endpoints
app.post('/api/register', (req, res) => {
    const { username } = req.body;

    if (!username || username.trim() === "") {
        return res.status(400).json({ error: 'Username is required' });
    }
    if (users[username]) {
        return res.status(409).json({ error: 'Username already taken' });
    }

    users[username] = { messages: [] }; // Simpan hanya username dan messages
    res.json({ username }); // Kembalikan hanya username
});

app.post('/api/send/:username', (req, res) => {
    const { username } = req.params;
    const { message } = req.body;

    if (!users[username]) {
        return res.status(404).json({ error: 'User not found' });
    }
    if(!message || message.trim() === ""){
        return res.status(400).json({error: "Message is required"})
    }

    users[username].messages.push({ text: message, timestamp: new Date() });
    res.json({ success: true });
});

app.get('/api/messages/:username', (req, res) => {
    const { username } = req.params;
    if (!users[username]) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ messages: users[username].messages });
});

// API baru untuk mendapatkan username dari URL
app.get('/api/user/:username', (req, res) => {
    const { username } = req.params;
    if (!users[username]) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ username }); // Kembalikan username
});

// Route untuk melayani index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route untuk melayani halaman user (dengan username di URL)
app.get('/user/:username', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
