const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Creamos la conexión directamente aquí, sin importar ningún archivo externo
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

// Obtener tokens con estado 1, incluyendo venta, producto y cantidad
router.get('/tokens', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.tok_id,
        t.tok_codigo,
        t.tok_fecha_creacion,
        v.codigo AS venta_codigo,
        v.fecha AS venta_fecha,
        p.descripcion AS producto,
        vp.cantidad
      FROM token t
      INNER JOIN autorizacion a ON a.aut_tok_id = t.tok_id
      INNER JOIN ventas v ON v.id = a.aut_ventas_id
      INNER JOIN productos p ON p.id = a.aut_pro_codigo
      LEFT JOIN venta_productos vp 
             ON vp.id_venta = v.id AND vp.id_producto = p.id
      WHERE t.tok_estado = 1
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener tokens con ventas y productos' });
  }
});



// Aprobar un token
router.put('/tokens/:id/aprobar', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE token SET tok_estado = 2 WHERE tok_id = ?', [id]);
    res.json({ success: true, message: 'Token aprobado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al aprobar token' });
  }
});

// Rechazar un token (opcional: eliminar o cambiar a estado 2)
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
