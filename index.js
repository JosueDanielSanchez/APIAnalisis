// index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

//
// IMPORTANTE: tfjs-node antes de face-api.js
//
require('@tensorflow/tfjs');

const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
const loadImage = canvas.loadImage;

const { downloadModels } = require('./downloadModels');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ------------------- MySQL -------------------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ------------------- Multer -------------------
const upload = multer({ dest: 'uploads/' });

// ------------------- Login -------------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña son requeridos' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Credenciales incorrectas' });

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Credenciales incorrectas' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const { password: pw, ...userWithoutPassword } = user;

    res.json({ success: true, token, user: userWithoutPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ------------------- FACE API -------------------
const MODEL_PATH = path.join(__dirname, 'models'); // carpeta donde se guardarán los modelos

async function loadFaceModels() {
  await downloadModels(); // descarga automática si no existen
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
  await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
  await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition_model'));
  console.log('✅ Modelos de face-api.js cargados');
}

async function getFaceDescriptor(input) {
  try {
    let img;
    if (Buffer.isBuffer(input)) {
      img = await loadImage(input);
    } else if (typeof input === 'string' && input.startsWith('data:')) {
      const base64 = input.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      img = await loadImage(buffer);
    } else {
      img = await loadImage(input);
    }

    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    if (!detection) return null;
    return detection.descriptor;
  } catch (err) {
    console.error('Error en getFaceDescriptor:', err);
    return null;
  }
}

// ------------------- Endpoint de verificación -------------------
app.post('/verify-face', upload.single('photo'), async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'userId es requerido' });
  }

  if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ninguna foto' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const dbPhoto = user.foto;

    if (!dbPhoto) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Usuario no tiene foto registrada' });
    }

    let dbInput;
    if (typeof dbPhoto === 'string' && dbPhoto.startsWith('data:')) {
      dbInput = dbPhoto;
    } else {
      dbInput = path.isAbsolute(dbPhoto) ? dbPhoto : path.join(__dirname, dbPhoto);
    }

    const uploadedPath = req.file.path;

    const dbDescriptor = await getFaceDescriptor(dbInput);
    const uploadedDescriptor = await getFaceDescriptor(uploadedPath);

    try { fs.unlinkSync(uploadedPath); } catch (e) {}

    if (!dbDescriptor || !uploadedDescriptor) {
      return res.status(400).json({ success: false, message: 'No se detectó rostro en una de las imágenes' });
    }

    const distance = faceapi.euclideanDistance(dbDescriptor, uploadedDescriptor);
    const THRESHOLD = 0.6;

    if (distance < THRESHOLD) {
      return res.json({ success: true, message: 'Rostro verificado', distance });
    } else {
      return res.status(401).json({ success: false, message: 'No coincide con el rostro registrado', distance });
    }

  } catch (error) {
    console.error('Error en /verify-face:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    res.status(500).json({ success: false, message: 'Error en servidor' });
  }
});

// ------------------- Iniciar servidor -------------------
const PORT = process.env.PORT || 3000;
loadFaceModels().then(() => {
  app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
}).catch(err => {
  console.error('No se pudieron cargar los modelos:', err);
  process.exit(1);
});
