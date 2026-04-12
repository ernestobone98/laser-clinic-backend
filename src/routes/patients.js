const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Get all patients with pagination, search and sorting
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || 'id'; // default sort column
  const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';

  // Validate sortBy to prevent SQL injection
  const allowedSortColumns = {
    'id': 'id_paciente',
    'ime': 'ime',
    'name': 'ime',
    'email': 'email',
    'telefon': 'telefon',
    'balance': 'balance'
  };
  const actualSortColumn = allowedSortColumns[sortBy.toLowerCase()] || 'id_paciente';

  const offset = (page - 1) * limit;

  let query = `SELECT id_paciente "id", ime, pol, telefon, email, balance FROM paciente`;
  let countQuery = `SELECT count(*) "total" FROM paciente`;
  let binds = {};

  if (search) {
    const words = search.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length > 0) {
      const conditions = words.map((_, i) => 
        `(LOWER(ime) LIKE :word${i} OR LOWER(email) LIKE :word${i} OR telefon LIKE :word${i})`
      );
      const searchFilter = ` WHERE ${conditions.join(' AND ')}`;
      query += searchFilter;
      countQuery += searchFilter;
      words.forEach((word, i) => {
        binds[`word${i}`] = `%${word}%`;
      });
    }
  }

  // Use Oracle's OFFSET/FETCH for pagination (supported in 12c+)
  query += ` ORDER BY ${actualSortColumn} ${sortOrder} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  binds.offset = offset;
  binds.limit = limit;

  try {
    const result = await database.simpleExecute(query, binds);
    
    // Prepare binds for count query (only word binds)
    const countBinds = {};
    Object.keys(binds).forEach(key => {
      if (key.startsWith('word')) countBinds[key] = binds[key];
    });
    
    const countResult = await database.simpleExecute(countQuery, countBinds);
    const total = countResult.rows[0].total;

    res.json({
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export all patients (no pagination) with procedure stats, split by gender
router.get('/export', async (req, res) => {
  const query = `
    SELECT
      p.id_paciente "id",
      p.ime "ime",
      p.pol "pol",
      p.telefon "telefon",
      p.email "email",
      NVL(p.balance, 0) "balance",
      COUNT(pr.id_procedura) "totalProcedures",
      NVL(SUM(pr.obshta_cena), 0) "totalSpent",
      MAX(pr.data) "lastVisit"
    FROM paciente p
    LEFT JOIN procedura pr ON pr.id_paciente = p.id_paciente
    GROUP BY p.id_paciente, p.ime, p.pol, p.telefon, p.email, p.balance
    ORDER BY p.ime ASC
  `;

  try {
    const result = await database.simpleExecute(query, {});
    const women = result.rows.filter(r => r.pol === 'Ж');
    const men   = result.rows.filter(r => r.pol === 'H');
    res.json({ women, men });
  } catch (err) {
    console.error('Error exporting patients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a patient by ID
router.get('/:id', async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  const query = `SELECT id_paciente "id", ime, pol, telefon, email, balance FROM paciente WHERE id_paciente = :id_paciente`;
  const binds = { id_paciente: patientId };
  try {
    const result = await database.simpleExecute(query, binds);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new patient
router.post('/', async (req, res) => {
  const { ime, pol, telefon, email, balance } = req.body;
  console.log('Received data for new patient:', { ime, pol, telefon, email, balance });

  if (!ime) {
    return res.status(400).json({ error: 'Ime is required' });
  }

  const { oracledb } = database;
  const query = `INSERT INTO paciente (ime, pol, telefon, email, balance) VALUES (:ime, :pol, :telefon, :email, :balance) RETURNING id_paciente INTO :newId`;

  const binds = { ime, pol, telefon, email, balance, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } };
  const options = {
    autoCommit: true,
  };

  try {
    const result = await database.simpleExecute(query, binds, options);
    const newId = result.outBinds.newId[0];
    if (newId) {
      const getQuery = `SELECT id_paciente "id", ime, pol, telefon, email, balance FROM paciente WHERE id_paciente = :id_paciente`;
      const getResult = await database.simpleExecute(getQuery, { id_paciente: newId });
      if (getResult.rows.length > 0) {
        return res.status(201).json(getResult.rows[0]);
      }
    }
    res.status(201).json({ message: 'Patient created successfully', rowsAffected: result.rowsAffected });
  } catch (err) {
    console.error('Error creating patient:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an existing patient
router.put('/:id', async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  const { ime, pol, telefon, email, balance } = req.body;
  if (!ime) {
    return res.status(400).json({ error: 'Ime is required' });
  }

  // get the balance from the paciente with the given id, this will be called originalBalance
  const originalQuery = `SELECT balance FROM paciente WHERE id_paciente = :id_paciente`;
  const originalBinds = { id_paciente: patientId };
  let originalBalance;

  try {
    const originalResult = await database.simpleExecute(originalQuery, originalBinds);
    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    originalBalance = originalResult.rows[0].BALANCE;
    if (originalBalance === null || originalBalance === undefined) {
      originalBalance = 0;
    }
    // Validate balance
    let newBalance = originalBalance;
    if (balance !== undefined) {
      if (isNaN(parseInt(balance, 10))) {
        return res.status(400).json({ error: 'Balance must be a valid integer' });
      }
      newBalance = originalBalance + parseInt(balance, 10);
    }

    const query = `UPDATE paciente SET ime = :ime, pol = :pol, telefon = :telefon, email = :email, balance = :balance WHERE id_paciente = :id_paciente`;
    const binds = { ime, pol, telefon, email, balance: newBalance, id_paciente: patientId };
    const options = { autoCommit: true };

    const result = await database.simpleExecute(query, binds, options);
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient updated successfully', id: patientId, balance: newBalance });
  } catch (err) {
    console.error('Error updating patient:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a patient
router.delete('/:id', async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  const query = `DELETE FROM paciente WHERE id_paciente = :id_paciente`;
  const binds = { id_paciente: patientId };
  const options = { autoCommit: true };

  try {
    const result = await database.simpleExecute(query, binds, options);
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient deleted successfully', id: patientId });
  } catch (err) {
    console.error('Error deleting patient:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all procedures for a specific patient
router.get('/:id/proceduras', async (req, res) => {
  const patientId = parseInt(req.params.id);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  const query = `
    SELECT
      p.id_procedura AS "idProcedura",
      p.data,
      p.obshta_cena AS "obshtaCena",
      NVL(p.currency, 'EUR') AS "currency",
      p."COMMENT" AS "comment",
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'zona' VALUE z.nazvanie,
          'pulsaciones' VALUE pz.pulsaciones
        )
      ) AS zonas
    FROM
      procedura p
    JOIN
      procedura_zona pz ON p.id_procedura = pz.id_procedura
    JOIN
      zona_telo z ON z.id_zona = pz.id_zona
    WHERE
      p.id_paciente = :id_paciente
    GROUP BY
      p.id_procedura, p.data, p.obshta_cena, p.currency, p."COMMENT"
    ORDER BY
      p.data DESC
  `;

  try {
    const result = await database.simpleExecute(query, [patientId]);

    // Parse zonas from JSON string to array
    const parsedRows = result.rows.map(row => ({
      idProcedura: row.idProcedura,
      data: row.DATA,
      obshtaCena: row.obshtaCena,
      currency: row.currency || 'EUR',
      comment: row.comment,
      zonas: typeof row.ZONAS === 'string' ? JSON.parse(row.ZONAS) : row.ZONAS
    }));

    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching procedures:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;