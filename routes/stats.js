// routes/stats.js (ESM)
import express from 'express';
const router = express.Router();

export default function makeStatsRouter(pool) {
  function getRange(q) {
    const today = new Date();
    const to = (q.to
      ? new Date(q.to)
      : new Date(today.getFullYear(), today.getMonth(), today.getDate())
    ).toISOString().slice(0,10);
    const from = (q.from
      ? new Date(q.from)
      : new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
    ).toISOString().slice(0,10);
    return { from, to };
  }

  // Ventas por día (conteo y monto)
  router.get('/sales-by-day', async (req, res) => {
    const { from, to } = getRange(req.query);
    try {
      const [rows] = await pool.query(
        `SELECT DATE(v.fecha) AS dia,
                COUNT(*)      AS ventas,
                COALESCE(SUM(v.total),0) AS ingresos
           FROM ventas v
          WHERE v.estado = 'Finalizada'
            AND v.fecha >= ? AND v.fecha < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY DATE(v.fecha)
          ORDER BY dia;`,
        [from, to]
      );
      res.json(rows);
    } catch (e) {
      console.error('stats/sales-by-day', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // Ventas por sucursal (monto por día)
  router.get('/by-branch', async (req, res) => {
    const { from, to } = getRange(req.query);
    try {
      const [rows] = await pool.query(
        `SELECT s.id          AS sucursal_id,
                s.nombre      AS sucursal,
                DATE(v.fecha) AS dia,
                COALESCE(SUM(v.total),0) AS ingresos
           FROM ventas v
           JOIN sucursales s ON s.id = v.id_sucursal
          WHERE v.estado = 'Finalizada'
            AND v.fecha >= ? AND v.fecha < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY s.id, DATE(v.fecha)
          ORDER BY dia, ingresos DESC;`,
        [from, to]
      );
      res.json(rows);
    } catch (e) {
      console.error('stats/by-branch', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // Ventas por método de pago
  router.get('/payment-methods', async (req, res) => {
    const { from, to } = getRange(req.query);
    try {
      const [rows] = await pool.query(
        `SELECT v.metodo_pago,
                COUNT(*) AS ventas,
                COALESCE(SUM(v.total),0) AS ingresos
           FROM ventas v
          WHERE v.estado = 'Finalizada'
            AND v.fecha >= ? AND v.fecha < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY v.metodo_pago
          ORDER BY ingresos DESC;`,
        [from, to]
      );
      res.json(rows);
    } catch (e) {
      console.error('stats/payment-methods', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // Top productos (unidades)
  router.get('/top-products', async (req, res) => {
    const { from, to } = getRange(req.query);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '10', 10), 50));
    try {
      const [rows] = await pool.query(
        `SELECT p.id           AS producto_id,
                p.descripcion  AS descripcion,
                COALESCE(SUM(vp.cantidad),0)                AS unidades,
                COALESCE(SUM(vp.cantidad * vp.precio),0.0)  AS ingreso
           FROM venta_productos vp
           JOIN productos p ON p.id = vp.id_producto
           JOIN ventas v    ON v.id = vp.id_venta
          WHERE v.estado = 'Finalizada'
            AND v.fecha >= ? AND v.fecha < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY p.id
          ORDER BY unidades DESC
          LIMIT ?;`,
        [from, to, limit]
      );
      res.json(rows);
    } catch (e) {
      console.error('stats/top-products', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // Ticket promedio
  router.get('/ticket-avg', async (req, res) => {
    const { from, to } = getRange(req.query);
    try {
      const [rows] = await pool.query(
        `SELECT ROUND(AVG(v.total), 2) AS ticket_promedio
           FROM ventas v
          WHERE v.estado = 'Finalizada'
            AND v.fecha >= ? AND v.fecha < DATE_ADD(?, INTERVAL 1 DAY);`,
        [from, to]
      );
      res.json(rows[0] || { ticket_promedio: 0 });
    } catch (e) {
      console.error('stats/ticket-avg', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // (Opcional) Por tipo de producto
  router.get('/by-product-type', async (req, res) => {
    const { from, to } = getRange(req.query);
    try {
      const [rows] = await pool.query(
        `SELECT tp.tipp_codigo         AS tipo_codigo,
                tp.tipp_descripcion    AS tipo,
                COALESCE(SUM(vp.cantidad),0) AS unidades
           FROM venta_productos vp
           JOIN productos p    ON p.id = vp.id_producto
           JOIN ventas v       ON v.id = vp.id_venta
           JOIN tip_producto tp ON tp.tipp_codigo = p.p_control
          WHERE v.estado = 'Finalizada'
            AND v.fecha >= ? AND v.fecha < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY tp.tipp_codigo
          ORDER BY unidades DESC;`,
        [from, to]
      );
      res.json(rows);
    } catch (e) {
      console.error('stats/by-product-type', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  return router;
}
