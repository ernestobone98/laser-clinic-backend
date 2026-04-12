const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Helper to wrap async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /api/analytics/summary
router.get('/summary', asyncHandler(async (req, res) => {
  const resultPatients = await database.simpleExecute(`SELECT COUNT(*) as "count" FROM paciente`);
  const resultProcedures = await database.simpleExecute(`SELECT COUNT(*) as "count", NVL(SUM(CASE WHEN NVL(currency, 'BGN') = 'EUR' THEN obshta_cena * 1.95583 ELSE obshta_cena END), 0) as "revenue" FROM procedura`);
  
  res.json({
    totalPatients: resultPatients.rows[0].count,
    totalProcedures: resultProcedures.rows[0].count,
    totalRevenue: resultProcedures.rows[0].revenue
  });
}));

// GET /api/analytics/top-patients
router.get('/top-patients', asyncHandler(async (req, res) => {
  // Find patients generating most revenue
  const query = `
    SELECT p.id_paciente as "id", p.ime as "name", NVL(SUM(CASE WHEN NVL(pr.currency, 'BGN') = 'EUR' THEN pr.obshta_cena * 1.95583 ELSE pr.obshta_cena END), 0) as "totalSpent", COUNT(pr.id_procedura) as "visits"
    FROM paciente p
    JOIN procedura pr ON p.id_paciente = pr.id_paciente
    GROUP BY p.id_paciente, p.ime
    ORDER BY "totalSpent" DESC
    FETCH NEXT 10 ROWS ONLY
  `;
  const result = await database.simpleExecute(query);
  res.json(result.rows);
}));

// GET /api/analytics/popular-zones
router.get('/popular-zones', asyncHandler(async (req, res) => {
  const query = `
    SELECT z.id_zona as "id", z.nazvanie as "name", COUNT(pz.id_procedura) as "count"
    FROM zona_telo z
    JOIN procedura_zona pz ON z.id_zona = pz.id_zona
    GROUP BY z.id_zona, z.nazvanie
    ORDER BY "count" DESC
    FETCH NEXT 10 ROWS ONLY
  `;
  const result = await database.simpleExecute(query);
  res.json(result.rows);
}));

// GET /api/analytics/monthly-trends
router.get('/monthly-trends', asyncHandler(async (req, res) => {
  const query = `
    SELECT TO_CHAR(data, 'YYYY-MM') as "month", COUNT(id_procedura) as "visits", NVL(SUM(CASE WHEN NVL(currency, 'BGN') = 'EUR' THEN obshta_cena * 1.95583 ELSE obshta_cena END), 0) as "revenue"
    FROM procedura
    GROUP BY TO_CHAR(data, 'YYYY-MM')
    ORDER BY "month" ASC
  `;
  const result = await database.simpleExecute(query);
  res.json(result.rows);
}));

// GET /api/analytics/gender-split
router.get('/gender-split', asyncHandler(async (req, res) => {
  const query = `
    SELECT pol as "gender", COUNT(id_paciente) as "count"
    FROM paciente
    GROUP BY pol
  `;
  const result = await database.simpleExecute(query);
  
  // optionally map H -> Men, Ж -> Women
  const formattedRows = result.rows.map(r => ({
    gender: r.gender === 'H' ? 'Мъже' : (r.gender === 'Ж' ? 'Жени' : 'Друго'),
    count: r.count
  }));
  
  res.json(formattedRows);
}));

module.exports = router;
