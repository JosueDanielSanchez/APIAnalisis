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

// =====================
// Obtener tokens pendientes (estado = 1)
// =====================
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
      INNER JOIN ventas v ON v.id = t.id_venta
      INNER JOIN venta_productos vp ON vp.id_venta = v.id
      INNER JOIN productos p ON p.id = vp.id_producto
      WHERE t.tok_estado = 1
      ORDER BY t.tok_fecha_creacion DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener tokens con ventas y productos' });
  }
});

// =====================
// Aprobar un token
// =====================
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

// =====================
// Rechazar un token
// =====================
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

// =====================
// Actualizar la cantidad de un producto asociado al token
// =====================
router.put('/tokens/:id/cantidad', async (req, res) => {
  const { id } = req.params; // id del token
  const { cantidad } = req.body; // nueva cantidad

  if (!cantidad || cantidad <= 0) {
    return res.status(400).json({ message: 'Cantidad inválida' });
  }

  try {
    // Buscar el producto relacionado con el token
    const [rows] = await pool.query(
      `SELECT vp.id AS id_venta_producto
       FROM token t
       INNER JOIN ventas v ON v.id = t.id_venta
       INNER JOIN venta_productos vp ON vp.id_venta = v.id
       WHERE t.tok_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No se encontró el producto asociado a este token' });
    }

    const idVentaProducto = rows[0].id_venta_producto;

    // Actualizar la cantidad en la tabla venta_productos
    await pool.query(
      `UPDATE venta_productos SET cantidad = ? WHERE id = ?`,
      [cantidad, idVentaProducto]
    );

    res.json({ success: true, message: 'Cantidad actualizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar la cantidad' });
  }
});

module.exports = router;
