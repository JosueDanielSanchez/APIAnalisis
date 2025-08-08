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




// Obtener tokens con estado = 1 (pendientes)
app.get('/tokens/pending', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM token WHERE tok_estado = 1');
    res.json({ success: true, tokens: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener tokens' });
  }
});


// Actualizar estado del token (aprobar o rechazar)
app.put('/tokens/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // debe ser 0 para aprobado o rechazado según convenga

  if (estado === undefined) {
    return res.status(400).json({ success: false, message: 'Estado requerido' });
  }

  try {
    const [result] = await pool.query('UPDATE token SET tok_estado = ? WHERE tok_id = ?', [estado, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Token no encontrado' });
    }

    res.json({ success: true, message: 'Estado actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar token' });
  }
});
