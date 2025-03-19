const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Konfigurasi Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, '/'); }, // Simpan di root
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'audio/mpeg', 'audio/mp3',
            'video/mp4', 'video/webm',
        ];
        if (allowedMimeTypes.includes(file.mimetype)) { cb(null, true); }
        else { cb(new Error('Jenis file tidak diizinkan!'), false); }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// --- Routing ---

// 1. Upload file (POST)
app.post('/uploads', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'Tidak ada file yang diunggah.' }); // Lebih baik dalam format JSON
    }
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.send({ message: 'File berhasil diunggah!', url: fileUrl });
});

// 2. Sajikan file yang diupload (GET)
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, filename);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send({ message: 'File tidak ditemukan.' }); // JSON
        }
        res.sendFile(filePath);
    });
});

// 3. Sajikan index.html atau 404
app.get('/', (req, res, next) => { // Tambahkan 'next'
    const indexPath = path.join(__dirname, 'index.html');

    fs.access(indexPath, fs.constants.F_OK, (err) => {
        if (err) {
            next(); // Lanjutkan ke error handler 404
        } else {
            res.sendFile(indexPath);
        }
    });
});

// 4. Error handler 404 (Custom)
app.use((req, res, next) => {
    res.status(404).send({ message: '404 Not Found - Halaman tidak ditemukan.' }); // JSON
});


// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
