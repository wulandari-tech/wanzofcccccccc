const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); 
const app = express();
const port = 3000;
const uploadDir = path.join(__dirname, 'uploads');
function ensureUploadsDirExists() {
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir);
      console.log("Direktori 'uploads' berhasil dibuat.");
    } catch (err) {
      console.error("Gagal membuat direktori 'uploads':", err);
      process.exit(1); 
    }
  }
}
ensureUploadsDirExists(); 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); 
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
  limits: { fileSize: 1024 * 1024 * 200 } 
});
app.use('/uploads', express.static(uploadDir));
app.post('/uploads', upload.single('gambar'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Tidak ada file yang diunggah atau jenis file tidak valid.');
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({
    message: 'File berhasil diunggah!',
    imageUrl: imageUrl,
  });
});
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {.
    res.status(400).send(err.message); 
  } else if (err) {.
    res.status(500).send(err.message);
  }
});



app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
