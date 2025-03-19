const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const port = 3000;
const uploadDir = path.join(__dirname, 'uploads');

// ... (Fungsi ensureUploadsDirExists dan generateRandomString, sama seperti sebelumnya)
function ensureUploadsDirExists() {
    if (!fs.existsSync(uploadDir)) {
        try {
            fs.mkdirSync(uploadDir, { recursive: true }); // Tambahkan recursive: true
            console.log("Direktori 'uploads' berhasil dibuat.");
        } catch (err) {
            console.error("Gagal membuat direktori 'uploads':", err);
            process.exit(1);
        }
    }
}
function generateRandomString(length = 4) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}
// Konfigurasi multer (sama seperti sebelumnya)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const randomName = generateRandomString();
        cb(null, randomName + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 20 } // 20MB
});
// Middleware untuk static file, TAPI dengan opsi yang dimodifikasi
app.use('/uploads', express.static(uploadDir, {
    index: false,
    redirect: false,
    // Hapus setHeaders, kita akan tangani secara manual
}));

// Route untuk halaman utama (upload form) - PERBAIKAN DI SINI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route untuk menangani upload file
app.post('/uploads', upload.single('berkas'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    // Hanya kirim fileUrl ke halaman upload
    res.json({
        fileUrl: fileUrl
    });
});

// Route untuk menampilkan file ATAU JSON, tergantung tipe konten
app.get('/uploads/:filename', (req, res, next) => {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    fs.stat(filePath, (err, stats) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ message: 'File tidak ditemukan.' });
            }
            return next(err);
        }

        if (!stats.isFile()) {
            return res.status(404).json({ message: 'Bukan file.' });
        }
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

        // Daftar MIME types yang akan ditampilkan langsung (preview)
        const previewMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', // Gambar
            'video/mp4', 'video/webm', 'video/ogg',             // Video
            'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'  // Audio
        ];
		const mimeType = req.file ? req.file.mimetype : "unknown"; //perbaikan
        if (previewMimeTypes.includes(mimeType)) {
            // Tampilkan langsung (seperti express.static)
             res.sendFile(filePath);
        } else {
            // Kirim JSON metadata
            res.json({
                filename: filename,
				originalName: req.file ? req.file.originalname : "unknown", //original name
                size: stats.size,
                mimeType: mimeType,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                fileUrl : fileUrl,
            });
        }
    });
});

// ... (Middleware error handler, sama seperti sebelumnya)
app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof multer.MulterError) {
        res.status(400).json({ message: err.message });
    } else {
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
