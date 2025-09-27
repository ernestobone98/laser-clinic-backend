const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Get all patients
router.get('/', async (req, res) => {
  const query = `SELECT id_paciente "id", ime, pol, telefon, email, balance FROM paciente`;
  try {
    const result = await database.simpleExecute(query);
    res.json(result.rows);
  } catch (err) {
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

  const query = `INSERT INTO paciente (ime, pol, telefon, email, balance) VALUES (:ime, :pol, :telefon, :email, :balance)`;

  const binds = { ime, pol, telefon, email, balance };
  const options = {
    autoCommit: true, // Commit the transaction
  };

  try {
    const result = await database.simpleExecute(query, binds, options);
    if (result.rowsAffected === 1) {
      // Get the last inserted patient (assuming id_paciente is auto-incremented and highest value is the latest)
      const getQuery = `SELECT id_paciente "id", ime, pol, telefon, email, balance FROM paciente WHERE id_paciente = (SELECT MAX(id_paciente) FROM paciente)`;
      const getResult = await database.simpleExecute(getQuery);
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

module.exports = router;