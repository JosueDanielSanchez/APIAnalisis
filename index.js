// index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import fetch from 'node-fetch'; // para descargar imágenes remotas

// ------------------- TensorFlow -------------------
import '@tensorflow/tfjs';
try {
  await import('@tensorflow/tfjs-node');
  console.log("✅ TensorFlow.js con backend nativo (rápido)");
} catch (err) {
  console.log("⚠️ TensorFlow.js en modo genérico (más lento)");
}

import * as faceapi from '@vladmandic/face-api';
import canvas from 'canvas';
const { Canvas, Image, ImageData, loadImage } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// ESM no tiene __dirname
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
const upload = multer({ dest: UPLOAD_DIR });

// ------------------- Login -------------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const { password: pw, ...userWithoutPassword } = user;

    res.json({ success: true, token, user: userWithoutPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// ------------------- FACE API -------------------
const FACE_THRESHOLD = parseFloat(process.env.FACE_THRESHOLD) || 0.6;
const MODEL_PATH = path.join(__dirname, 'models');

async function loadFaceModels() {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('🌐 Cargando modelos desde CDN...');
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    } else {
      console.log('📂 Cargando modelos desde disco...');
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
      await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
      await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition'));
    }
    console.log('✅ Modelos cargados');
  } catch (error) {
    console.error('❌ Error al cargar los modelos:', error);
    throw error;
  }
}

// ------------------- Función para cargar imágenes remotas -------------------
async function loadRemoteImage(url) {
  try {
    console.log('🔗 Intentando descargar imagen:', url);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ Error HTTP al descargar la imagen: ${res.status} ${res.statusText}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const tmpPath = path.join(UPLOAD_DIR, `tmp_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));
    const img = await loadImage(tmpPath);
    await fs.promises.unlink(tmpPath);
    return img;
  } catch (err) {
    console.error('❌ Error descargando imagen remota:', err.message);
    return null;
  }
}


// ------------------- Obtener descriptor facial -------------------
async function getFaceDescriptor(input) {
  try {
    let img;

    if (Buffer.isBuffer(input)) {
      const tmpPath = path.join(UPLOAD_DIR, `tmp_${Date.now()}.jpg`);
      fs.writeFileSync(tmpPath, input);
      img = await loadImage(tmpPath);
      await fs.promises.unlink(tmpPath);
    } else if (typeof input === 'string' && input.startsWith('data:')) {
      const buffer = Buffer.from(input.split(',')[1], 'base64');
      const tmpPath = path.join(UPLOAD_DIR, `tmp_${Date.now()}.jpg`);
      fs.writeFileSync(tmpPath, buffer);
      img = await loadImage(tmpPath);
      await fs.promises.unlink(tmpPath);
    } else if (typeof input === 'string' && input.startsWith('http')) {
    img = await loadRemoteImage(input);
    if (!img) {
      console.error('❌ No se pudo cargar la imagen remota');
      return null; // evita pasar null a face-api.js
    }
    } else {
      img = await loadImage(input);
    }

    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    if (!detection) return null;
    return detection.descriptor;
  } catch (err) {
    console.error('❌ Error en getFaceDescriptor:', err.message);
    return null;
  }
}

// ------------------- Endpoint de verificación -------------------
app.post('/verify-face', upload.single('photo'), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ success: false, message: 'userId es requerido' });
  }

  if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ninguna foto' });

  try {
    // Obtener usuario
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const user = rows[0];

    if (!user.foto) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'Usuario no tiene foto registrada' });
    }

    const uploadedPath = req.file.path;

    // Construir URL de la foto de base de datos
    let dbImageURL;
    if (user.foto.startsWith('http')) {
      dbImageURL = encodeURI(user.foto);
    } else {
      dbImageURL = encodeURI(`https://yruggdjexmsxtepcthos.supabase.co/storage/v1/object/public/users/${user.foto}`);
    }

    console.log('📌 Comparando rostros:');
    console.log('DB image:', dbImageURL);
    console.log('Uploaded image:', uploadedPath);

    // Función para validar que la imagen es cargable
    const safeGetFaceDescriptor = async (input) => {
      const descriptor = await getFaceDescriptor(input);
      if (!descriptor) throw new Error('No se pudo detectar rostro en la imagen');
      return descriptor;
    };

    // Obtener descriptores
    const dbDescriptor = await safeGetFaceDescriptor(dbImageURL);
    const uploadedDescriptor = await safeGetFaceDescriptor(uploadedPath);

    // Limpiar archivo subido
    await fs.promises.unlink(uploadedPath).catch(() => {});

    // Comparar distancia euclidiana
    const distance = faceapi.euclideanDistance(dbDescriptor, uploadedDescriptor);
    console.log('📏 Distancia facial calculada:', distance.toFixed(4));

    if (distance < FACE_THRESHOLD) {
      return res.json({ success: true, message: 'Rostro verificado', distance });
    } else {
      return res.status(401).json({ success: false, message: 'No coincide con el rostro registrado', distance });
    }

  } catch (error) {
    console.error('❌ Error en /verify-face:', error.message);
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ success: false, message: 'Error en servidor' });
  }
});

// ------------------- Rutas de Tokens -------------------
import tokenRoutes from './token.routes.js';
app.use('/api', tokenRoutes);


// ------------------- Iniciar servidor -------------------
import http from 'http';
const PORT = process.env.PORT || 3000;

// Primero cargamos los modelos, luego levantamos el servidor
loadFaceModels()
  .then(() => {
    const server = http.createServer(app);
    server.setTimeout(180000); // 120 segundos de espera antes de cortar
    server.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Error cargando modelos:', err);
    process.exit(1);
  });
