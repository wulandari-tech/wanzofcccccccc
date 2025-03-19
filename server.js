const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto'); // Tambahkan modul crypto
const app = express();
const port = 3000;
const uploadDir = path.join(__dirname, 'uploads');

// Fungsi untuk memastikan direktori uploads ada
function ensureUploadsDirExists() {
    if (!fs.existsSync(uploadDir)) {
        try {
            fs.mkdirSync(uploadDir);
            console.log("Direktori 'uploads' berhasil dibuat.");
        } catch (err) {
            console.error("Gagal membuat direktori 'uploads':", err);
            process.exit(1); // Hentikan aplikasi jika gagal
        }
    }
}

ensureUploadsDirExists();

// Fungsi untuk menghasilkan string acak 4 huruf
function generateRandomString(length = 4) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex') // Konversi ke heksadesimal
        .slice(0, length); // Ambil 4 karakter pertama
}

// Konfigurasi multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const randomName = generateRandomString(); // Gunakan fungsi untuk nama acak
        cb(null, randomName + ext);
    }
});

const upload = multer({
    storage: storage,
    // Hapus fileFilter karena kita ingin menerima semua jenis file
    limits: { fileSize: 1024 * 1024 * 20 } // Batas ukuran file 20MB (sesuaikan)
});

// Middleware untuk menyajikan file statis dari direktori uploads
app.use('/uploads', express.static(uploadDir));

// Route untuk halaman utama
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Upload wanzofc</title>
    </head>
    <body>
      <h1>Upload wanzofc</h1>
      <form action="/uploads" method="post" enctype="multipart/form-data">
        <input type="file" name="berkas" accept="*/*">
        <button type="submit">upload</button>
      </form>
      <div id="result" style="display:none;">
        <h2>Hasil Upload:</h2>
        <input type="text" id="fileUrl" readonly>
        <button id="copyButton">Copy</button>
        <p id="message"></p>
      </div>
      <script>
        const form = document.querySelector('form');
        const resultDiv = document.getElementById('result');
        const fileUrlInput = document.getElementById('fileUrl');
        const copyButton = document.getElementById('copyButton');
        const messageP = document.getElementById('message');


        form.addEventListener('submit', async (event) => {
          event.preventDefault(); // Mencegah pengiriman form standar
          const formData = new FormData(form);

           //Validasi Client side
          if (!form.berkas.files.length) {
                messageP.textContent = 'Pilih file terlebih dahulu.';
                return;
            }

          try {
            const response = await fetch('/uploads', {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              const data = await response.json();
              fileUrlInput.value = data.fileUrl;
              resultDiv.style.display = 'block'; // Tampilkan div hasil
              messageP.textContent = data.message; // Tampilkan pesan
              copyButton.disabled = false; // Aktifkan tombol copy
            } else {
              const errorData = await response.json();
              messageP.textContent = 'Error: ' + errorData.message;
               copyButton.disabled = true;
            }
          } catch (error) {
            messageP.textContent = 'Terjadi kesalahan: ' + error.message;
             copyButton.disabled = true;
          }
        });

        copyButton.addEventListener('click', () => {
          fileUrlInput.select();
          document.execCommand('copy');
          messageP.textContent = 'URL berhasil disalin!';

            setTimeout(() => { // hilang kan pesan dalam 2 detik
                messageP.textContent = '';
                }, 2000);
        });
      </script>
    </body>
    </html>
  `);
});

// Route untuk menangani upload file
app.post('/uploads', upload.single('berkas'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.json({
        message: 'File berhasil diunggah!',
        fileUrl: fileUrl
    });
});

// Middleware untuk menangani error
app.use((err, req, res, next) => {
    console.error(err); // Log error ke konsol
    if (err instanceof multer.MulterError) {
        // Error dari Multer (misalnya, ukuran file terlalu besar)
        res.status(400).json({ message: err.message });
    } else {
        // Error lainnya
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
