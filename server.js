const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// --- In-Memory Storage (for simplicity; use a real database in production) ---
const uploadedFiles = new Map();
const apiKeys = new Map(); // Store API keys (key: userId, value: apiKey)
// In a real app, you'd also have user data (passwords, etc.)

// --- Utility Functions ---
function generateRandomString(length = 8) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

function generateApiKey() {
    // 6-digit alphanumeric API key (for demo only - NOT SECURE)
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function getFileExtension(filename) {
    return path.extname(filename);
}

// --- Multer Configuration (for streaming) ---
const upload = multer({
    storage: multer.memoryStorage(), // Keep this for buffer access
    limits: { fileSize: 1024 * 1024 * 20 }
});

// --- API Key Middleware ---
function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key']; // Get API key from header

    if (!apiKey) {
        return res.status(401).json({ message: 'Unauthorized: API key required.' });
    }

    // In a real app, you'd look up the user by API key in the database.
    let userId = null;
    for (const [key, value] of apiKeys) {
        if (value === apiKey) {
            userId = key;
            break;
        }
    }
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: Invalid API key.' });
    }

    req.userId = userId; // Attach userId to the request object
    next(); // Continue to the next middleware/route handler
}

// --- ROUTES ---

// 1. Halaman Utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Upload File
app.post('/uploads', upload.single('berkas'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
    }

    const fileId = generateRandomString();
    const fileExtension = getFileExtension(req.file.originalname);
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileId}${fileExtension}`;

    // Simpan informasi file
    uploadedFiles.set(fileId, {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
        extension: fileExtension,
    });
    res.json({ fileUrl });
});

// 3. Akses File (GET /uploads/:fileId)
app.get('/uploads/:fileId', (req, res) => {
    const { fileId } = req.params;
    const fileIdWithoutExtension = path.basename(fileId, path.extname(fileId));
    if (!uploadedFiles.has(fileIdWithoutExtension)) {
        return res.status(404).json({ message: 'File tidak ditemukan.' });
    }
    const fileData = uploadedFiles.get(fileIdWithoutExtension);
    const hasExtension = path.extname(req.params.fileId) !== "";
    if (!hasExtension) {
        // Jika TIDAK ada ekstensi, kirim data sebagai JSON
        const jsonData = {
            filename: fileData.originalname,
            mimetype: fileData.mimetype,
            size: fileData.size,
            url: `${req.protocol}://${req.get('host')}/uploads/${fileIdWithoutExtension}${fileData.extension}`
        };
        return res.json(jsonData);
    }
    const previewMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/ogg',
        'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
        'text/plain'
    ];
    // Daftar ekstensi yang akan ditampilkan kontennya (HTML, CSS, JS, TXT)
    const displayContentExtensions = ['.html', '.css', '.js', '.txt'];
    if (displayContentExtensions.includes(fileData.extension)) {
        let contentType = 'text/plain'; // Default untuk .txt
        if (fileData.extension === '.html') {
            contentType = 'text/html';
        } else if (fileData.extension === '.css') {
            contentType = 'text/css';
        } else if (fileData.extension === '.js') {
            contentType = 'application/javascript';
        }
        res.setHeader('Content-Type', contentType);
        res.send(fileData.buffer.toString()); // Kirim konten sebagai string (UTF-8)
    } else if (previewMimeTypes.includes(fileData.mimetype)) {
        // Preview langsung (gambar, video, audio)
        res.setHeader('Content-Type', fileData.mimetype);
        res.send(fileData.buffer);
    } else {
        // Download file
        res.setHeader('Content-Disposition', `attachment; filename="${fileData.originalname}"`);
        res.setHeader('Content-Type', 'application/octet-stream'); // Force download
        res.send(fileData.buffer);
    }
});

// 4. API Endpoint (List Files) - Requires Authentication
app.get('/api/v1/files', authenticateApiKey, (req, res) => {
    const fileList = [];
    for (const [fileId, fileData] of uploadedFiles) {
        fileList.push({
            id: fileId,
            filename: fileData.originalname,
            mimetype: fileData.mimetype,
            size: fileData.size,
            url: `${req.protocol}://${req.get('host')}/uploads/${fileId}${fileData.extension}`
        });
    }
    res.json(fileList);
});

// 5.  Generate API Key
app.get('/generate-api-key', (req, res) => {
    const userId = generateRandomString(); // Simulate a user ID
    const newApiKey = generateApiKey();
    apiKeys.set(userId, newApiKey);
    res.json({ apiKey: newApiKey }); // Return ONLY the API key
});

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof multer.MulterError) {
        res.status(400).json({ message: err.message });
    } else {
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// --- START SERVER ---
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
