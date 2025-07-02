require('dotenv').config();
const express = require('express');
const cors = require('cors');
const database = require('./database.js');

const app = express();
const port = process.env.PORT || 8080;

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON requests
app.use(express.json());

// --- API Endpoints for 'paciente' table ---
app.get('/api/pacientes', async (req, res) => {
  const query = `SELECT id_paciente "id", ime, pol, telefon, email FROM paciente`;
  try {
    const result = await database.simpleExecute(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new patient
app.post('/api/pacientes', async (req, res) => {
  const { ime, pol, telefon, email } = req.body;
  console.log('Received data for new patient:', { ime, pol, telefon, email });

  if (!ime) {
    return res.status(400).json({ error: 'Ime is required' });
  }

  const query = `INSERT INTO paciente (ime, pol, telefon, email) VALUES (:ime, :pol, :telefon, :email)`;

  const binds = { ime, pol, telefon, email };
  const options = {
    autoCommit: true, // Commit the transaction
  };

  try {
    const result = await database.simpleExecute(query, binds, options);
    res.status(201).json({ message: 'Patient created successfully', rowsAffected: result.rowsAffected });
  } catch (err) {
    console.error('Error creating patient:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update an existing patient
app.put('/api/pacientes/:id', async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  const { ime, pol, telefon, email } = req.body;
  if (!ime) {
    return res.status(400).json({ error: 'Ime is required' });
  }

  const query = `UPDATE paciente SET ime = :ime, pol = :pol, telefon = :telefon, email = :email WHERE id_paciente = :id_paciente`;
  const binds = { ime, pol, telefon, email, id_paciente: patientId };
  const options = { autoCommit: true };

  try {
    const result = await database.simpleExecute(query, binds, options);
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient updated successfully', id: patientId });
  } catch (err) {
    console.error('Error updating patient:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a patient
app.delete('/api/pacientes/:id', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// --- API Endpoints for 'zona_telo' table ---
app.get('/api/zonas', async (req, res) => {
  const query = `SELECT id_zona "idZona", nazvanie, nazvanie_es "nazvanieEs", pol_specifichen "polSpecifichen" FROM zona_telo`;
  try {
    const result = await database.simpleExecute(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API Endpoints for 'procedura' table ---
// Get all procedures for a specific patient
app.get('/api/pacientes/:id/proceduras', async (req, res) => {
  const patientId = parseInt(req.params.id);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  const query = `
    SELECT 
      p.id_procedura AS "idProcedura",
      p.data,
      p.obshta_cena AS "obshtaCena",
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
      p.id_procedura, p.data, p.obshta_cena
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
      // Parse the uppercase ZONAS property and assign it to a lowercase 'zonas' key
      zonas: typeof row.ZONAS === 'string' ? JSON.parse(row.ZONAS) : row.ZONAS
    }));
    
    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching procedures:', err);
    res.status(500).json({ error: err.message });
  }
});


// Get all procedures
app.get('/api/proceduras', async (req, res) => {
    const query = `
        SELECT
            p.id_procedura AS "idProcedura",
            p.id_paciente AS "idPaciente",
            pa.ime AS "nombrePaciente",
            p.data,
            p.obshta_cena AS "obshtaCena",
            zt.nazvanie AS "zona"
        FROM procedura p
        JOIN paciente pa ON p.id_paciente = pa.id_paciente
        JOIN procedura_zona pz ON p.id_procedura = pz.id_procedura
        JOIN zona_telo zt ON pz.id_zona = zt.id_zona
        GROUP BY p.id_procedura, p.id_paciente, pa.ime, p.data, p.obshta_cena, zt.nazvanie
        ORDER BY p.data DESC
    `;
    try {
        const result = await database.simpleExecute(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new procedure with multiple zones
const oracledb = require('oracledb'); 

app.post('/api/proceduras', async (req, res) => {
    // FIX: Changed to match the incoming request payload
    const { id_paciente, data, obshta_cena, zonas } = req.body;
    
    // FIX: Updated validation to use id_paciente
    if (!id_paciente || !data || obshta_cena === undefined || !Array.isArray(zonas)) {
        return res.status(400).json({ 
            error: 'Missing required fields. Required: id_paciente, data, obshta_cena, and zonas array' 
        });
    }

    let connection;
    try {
        connection = await database.getConnection(); // Assuming database.js has a getConnection method

        // 1. Insert into the main 'procedura' table.
        const proceduraQuery = `
            INSERT INTO procedura (id_paciente, data, obshta_cena)
            VALUES (:id_paciente, TO_DATE(:data, 'YYYY-MM-DD'), :obshta_cena)
            RETURNING id_procedura INTO :new_id
        `;
        
        const result = await connection.execute(
            proceduraQuery,
            {
                // FIX: Use the correct variable name from the request
                id_paciente: id_paciente,
                data: data,
                obshta_cena: parseFloat(obshta_cena),
                // This line now works because 'oracledb' is defined
                new_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: false } // IMPORTANT: Do not commit yet, it's a transaction
        );

        const newProceduraId = result.outBinds.new_id[0];

        // 2. Now, insert into the 'procedura_zona' junction table.
        const zonaQuery = `
            INSERT INTO procedura_zona (id_procedura, id_zona, pulsaciones)
            VALUES (:id_procedura, :id_zona, :pulsaciones)
        `;

        // Debug log the zonas data
        console.log('Processing zonas:', JSON.stringify(zonas, null, 2));

        for (const zona of zonas) {
            if (zona.id_zona === undefined) {
                throw new Error('Each zone object in the array must have an "id_zona" property.');
            }
            
            // Convert empty string to null for pulsaciones if needed
            const pulsacionesValue = (zona.pulsaciones === '' || zona.pulsaciones === null || zona.pulsaciones === undefined) 
                ? null 
                : zona.pulsaciones;
            
            console.log('Inserting zona:', {
                id_procedura: newProceduraId,
                id_zona: zona.id_zona,
                pulsaciones: pulsacionesValue
            });

            try {
                const result = await connection.execute(
                    zonaQuery,
                    {
                        id_procedura: newProceduraId,
                        id_zona: zona.id_zona,
                        pulsaciones: pulsacionesValue
                    },
                    { autoCommit: false } // Keep the transaction open
                );
                console.log('Insert result:', result);
            } catch (error) {
                console.error('Error inserting zona:', error);
                throw error; // Re-throw to be caught by the outer try-catch
            }
        }

        // If all inserts were successful, commit the entire transaction
        await connection.commit();

        res.status(201).json({
            message: 'Procedure created successfully',
            id_procedura: newProceduraId
        });

    } catch (err) {
        // If any error occurred, roll back the entire transaction
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        console.error('Error creating procedure:', err);
        res.status(500).json({ 
            error: 'Failed to create procedure',
            details: err.message 
        });
    } finally {
        // Always release the connection
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error('Error closing connection:', closeErr);
            }
        }
    }
});

// DELETE procedure
app.delete('/api/proceduras/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid procedure ID' });
    }
    
    let connection;
    try {
        // First, delete from procedura_zona to avoid foreign key constraint
        await database.simpleExecute(
            `DELETE FROM procedura_zona WHERE id_procedura = :id`,
            [id],
            { autoCommit: false }
        );
        
        // Then delete from procedura
        const result = await database.simpleExecute(
            `DELETE FROM procedura WHERE id_procedura = :id`,
            [id],
            { autoCommit: true }
        );
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Procedure not found' });
        }
        
        res.json({ 
            message: 'Procedure deleted successfully', 
            rowsAffected: result.rowsAffected 
        });
    } catch (err) {
        console.error('Error deleting procedure:', err);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        res.status(500).json({ 
            error: 'Failed to delete procedure',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Edit procedure
app.put('/api/proceduras/:id', async (req, res) => {
  // Get the procedure ID from the URL parameters
  const { id } = req.params;
  // Get the updated data from the request body
  const { data, obshta_cena, zonas } = req.body;

  // Basic validation
  if (!data || obshta_cena === undefined || !Array.isArray(zonas)) {
      return res.status(400).json({ 
          error: 'Missing required fields. Required: data, obshta_cena, and zonas array' 
      });
  }

  let connection;
  try {
      connection = await database.getConnection(); // Get a connection from your pool

      // Step 1: Update the main procedure record
      const updateProceduraQuery = `
          UPDATE procedura
          SET data = TO_DATE(:data, 'YYYY-MM-DD'), obshta_cena = :obshta_cena
          WHERE id_procedura = :id
      `;
      await connection.execute(
          updateProceduraQuery,
          {
              data,
              obshta_cena: parseFloat(obshta_cena),
              id
          },
          { autoCommit: false } // Do not commit yet
      );

      // Step 2: Delete all old zone associations for this procedure
      const deleteZonasQuery = `DELETE FROM procedura_zona WHERE id_procedura = :id`;
      await connection.execute(
          deleteZonasQuery,
          { id },
          { autoCommit: false } // Keep the transaction open
      );

      // Step 3: Insert the new set of zone associations
      const insertZonaQuery = `
          INSERT INTO procedura_zona (id_procedura, id_zona)
          VALUES (:id_procedura, :id_zona)
      `;
      for (const zona of zonas) {
          if (zona.id_zona === undefined) {
              throw new Error('Each zone object in the array must have an "id_zona" property.');
          }
          await connection.execute(
              insertZonaQuery,
              {
                  id_procedura: id,
                  id_zona: zona.id_zona
              },
              { autoCommit: false } // Keep the transaction open
          );
      }

      // If all steps succeeded, commit the transaction
      await connection.commit();

      res.status(200).json({
          message: 'Procedure updated successfully',
          id_procedura: id
      });

  } catch (err) {
      // If any error occurred, roll back the entire transaction
      if (connection) {
          try {
              await connection.rollback();
          } catch (rollbackErr) {
              console.error('Error rolling back transaction:', rollbackErr);
          }
      }
      console.error('Error updating procedure:', err);
      res.status(500).json({ 
          error: 'Failed to update procedure',
          details: err.message 
      });
  } finally {
      // Always release the connection back to the pool
      if (connection) {
          try {
              await connection.close();
          } catch (closeErr) {
              console.error('Error closing connection:', closeErr);
          }
      }
  }
});

// --- Server Initialization and Shutdown ---
async function startup() {
  console.log('Starting application');
  try {
    console.log('Initializing database module');
    await database.initialize();
  } catch (err) {
    console.error(err);
    process.exit(1); // Non-zero failure code
  }

  app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
  });
}

async function shutdown(e) {
  let err = e;
  console.log('Shutting down');
  try {
    console.log('Closing database module');
    await database.close();
  } catch (e) {
    console.error(e);
    err = err || e;
  }

  console.log('Exiting process');
  if (err) {
    process.exit(1); // Non-zero failure code
  } else {
    process.exit(0);
  }
}

// Start the server
startup();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM');
  shutdown();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT');
  shutdown();
});

process.on('uncaughtException', err => {
  console.log('Uncaught exception');
  console.error(err);
  shutdown(err);
});