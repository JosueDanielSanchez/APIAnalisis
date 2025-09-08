require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Crear conexión pool MySQL
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

// Ruta login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son requeridos' });
  }

  try {
    // Buscar usuario en BD
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const user = rows[0];

    // Verificar contraseña (asumiendo que está hasheada con bcrypt)
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // Crear token JWT
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // Enviar token y datos de usuario (sin password)
    const { password: pw, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});

const tokenRoutes = require('./token.routes');
app.use('/api', tokenRoutes);


const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');

app.post('/verify-face', upload.single('photo'), async (req, res) => {
  const { userId } = req.body;

  try {
    // Buscar usuario en BD
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    const user = rows[0];

    // Foto de la BD (guardada como base64 o ruta de archivo)
    const dbPhotoPath = user.foto;

    // Aquí deberías implementar comparación con face-api.js o un servicio externo
    // De momento simulamos verificación:
    const match = true; // Aquí va tu lógica real de comparación

    if (match) {
      return res.json({ success: true, message: "Rostro verificado" });
    } else {
      return res.status(401).json({ success: false, message: "No coincide con el rostro registrado" });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});
