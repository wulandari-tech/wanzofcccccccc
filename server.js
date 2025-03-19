const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// --- In-Memory Storage (Penyimpanan di Memori) ---

// Konfigurasi Multer untuk penyimpanan *dalam memori*.
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 20 } // Batas 20MB
});

// --- Simpan file di Map (sebagai database sementara) ---
const uploadedFiles = new Map();

// Fungsi untuk menghasilkan string acak (untuk ID file)
function generateRandomString(length = 8) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

// --- ROUTES ---

// 1. Halaman Utama (Form Upload)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Kirim file index.html (frontend)
});

// 2. Endpoint untuk Upload File (POST /uploads)
app.post('/uploads', upload.single('berkas'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
    }

    const fileId = generateRandomString(); // Buat ID unik untuk file
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileId}`;

    // Simpan informasi file di Map
    uploadedFiles.set(fileId, {
        buffer: req.file.buffer, // Data file (buffer)
        mimetype: req.file.mimetype, // MIME type
        originalname: req.file.originalname, // Nama asli
        size: req.file.size, //ukuran file
    });

    res.json({ fileUrl }); // Kirim URL file
});

// 3. Endpoint untuk Mengakses File (GET /uploads/:fileId)
app.get('/uploads/:fileId', (req, res) => {
    const { fileId } = req.params;

    // Cek apakah file ada di Map
    if (!uploadedFiles.has(fileId)) {
        return res.status(404).json({ message: 'File tidak ditemukan.' });
    }

    const fileData = uploadedFiles.get(fileId); // Ambil data file

    // Daftar MIME types untuk preview (seperti sebelumnya)
    const previewMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/ogg',
        'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'
    ];

    if (previewMimeTypes.includes(fileData.mimetype)) {
        // Jika bisa di-preview, kirim langsung
        res.setHeader('Content-Type', fileData.mimetype);
        res.send(fileData.buffer);  // Kirim buffer file
    } else {
        // Jika tidak, kirim metadata (termasuk nama asli)

      // Set header untuk download, dengan nama file asli
        res.setHeader('Content-Disposition', `attachment; filename="${fileData.originalname}"`);
        res.setHeader('Content-Type', 'application/octet-stream'); // Force download
        res.send(fileData.buffer);
    }
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
