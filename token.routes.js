// token.routes.js
const express = require('express');
const router = express.Router();
const pool = require('./db'); // conexión exportada desde otro archivo o usa el pool directamente aquí

// Obtener tokens pendientes (estado = 1)
router.get('/tokens', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM token WHERE tok_estado = 1');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener tokens' });
  }
});

// Aprobar token (cambiar estado a 0)
router.put('/tokens/:id/aprobar', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE token SET tok_estado = 0 WHERE tok_id = ?', [id]);
    res.json({ success: true, message: 'Token aprobado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al aprobar token' });
  }
});

// Rechazar token (opcional: eliminar o cambiar estado a otro valor, como 2)
router.put('/tokens/:id/rechazar', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM token WHERE tok_id = ?', [id]);
    res.json({ success: true, message: 'Token rechazado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al rechazar token' });
  }
});

module.exports = router;
