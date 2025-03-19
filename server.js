const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Untuk operasi filesystem

const app = express();
const port = 3000;
const uploadDir = path.join(__dirname, 'uploads'); // Path absolut ke folder uploads

// Fungsi untuk memastikan direktori uploads ada
function ensureUploadsDirExists() {
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir);
      console.log("Direktori 'uploads' berhasil dibuat.");
    } catch (err) {
      console.error("Gagal membuat direktori 'uploads':", err);
      process.exit(1); // Hentikan server jika gagal membuat direktori
    }
  }
}

ensureUploadsDirExists(); // Panggil fungsi saat server dimulai

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Gunakan uploadDir yang sudah didefinisikan
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
      } else {
          cb(new Error('Jenis file tidak diizinkan. Hanya JPEG, PNG, dan GIF yang diperbolehkan.'), false);
      }
  },
  limits: { fileSize: 1024 * 1024 * 5 } // Batas ukuran file 5MB
});

// Serve static files dari folder uploads
app.use('/uploads', express.static(uploadDir));

// Route untuk upload (hanya POST)
app.post('/uploads', upload.single('gambar'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Tidak ada file yang diunggah atau jenis file tidak valid.');
  }

  // Buat URL gambar
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  // Kirim respons JSON
  res.json({
    message: 'File berhasil diunggah!',
    imageUrl: imageUrl,
  });
});

// Error handling untuk Multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading.
    res.status(400).send(err.message); // Kirim pesan error dari Multer
  } else if (err) {
    // An unknown error occurred when uploading.
    res.status(500).send(err.message);
  }
});



app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
