
const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Get all procedures for a specific patient
router.get('/pacientes/:id/proceduras', async (req, res) => {
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

// Get all procedures
router.get('/', async (req, res) => {
    const query = `
        SELECT
            p.id_procedura AS "idProcedura",
            p.id_paciente AS "idPaciente",
            pa.ime AS "nombrePaciente",
            p.data,
            p.obshta_cena AS "obshtaCena",
            NVL(p.currency, 'EUR') AS "currency",
            p."COMMENT" AS "comment",
            zt.nazvanie AS "zona"
        FROM procedura p
        JOIN paciente pa ON p.id_paciente = pa.id_paciente
        JOIN procedura_zona pz ON p.id_procedura = pz.id_procedura
        JOIN zona_telo zt ON pz.id_zona = zt.id_zona
        GROUP BY p.id_procedura, p.id_paciente, pa.ime, p.data, p.obshta_cena, p.currency, p."COMMENT", zt.nazvanie
        ORDER BY p.data DESC
    `;
    try {
        const result = await database.simpleExecute(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST new procedure with multiple zones
router.post('/', async (req, res) => {
    // FIX: Changed to match the incoming request payload
    const { id_paciente, data, obshta_cena, zonas, comment, is_paid, currency } = req.body;
    const validCurrency = ['BGN', 'EUR'].includes(currency) ? currency : 'EUR';
    console.log('Received data for new procedure:', req.body);

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
            INSERT INTO procedura (id_paciente, data, obshta_cena, currency, "COMMENT")
            VALUES (:id_paciente, TO_DATE(:data, 'YYYY-MM-DD'), :obshta_cena, :currency, :comment_text)
            RETURNING id_procedura INTO :new_id
        `;

        const result = await connection.execute(
            proceduraQuery,
            {
                id_paciente: id_paciente,
                data: data,
                obshta_cena: parseFloat(obshta_cena),
                currency: validCurrency,
                comment_text: comment || null,
                new_id: { type: database.oracledb.NUMBER, dir: database.oracledb.BIND_OUT }
            },
            { autoCommit: false }
        );

        const newProceduraId = result.outBinds.new_id[0];

        // 2. Now, insert into the 'procedura_zona' junction table.
        const zonaQuery = `
            INSERT INTO procedura_zona (id_procedura, id_zona, pulsaciones)
            VALUES (:id_procedura, :id_zona, :pulsaciones)
        `;



        for (const zona of zonas) {
            if (zona.id_zona === undefined) {
                throw new Error('Each zone object in the array must have an "id_zona" property.');
            }

            // Convert empty string to null for pulsaciones if needed
            const pulsacionesValue = (zona.pulsaciones === '' || zona.pulsaciones === null || zona.pulsaciones === undefined)
                ? null
                : zona.pulsaciones;



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

            } catch (error) {
                console.error('Error inserting zona:', error);
                throw error; // Re-throw to be caught by the outer try-catch
            }
        }

        // Update the patient's balance by adding obshta_cena only if is_paid is false
        let newBalance = null;
        if (is_paid === false) {
            // 1. Get the current balance
            const balanceQuery = `SELECT balance FROM paciente WHERE id_paciente = :id_paciente`;
            const balanceResult = await connection.execute(balanceQuery, { id_paciente: id_paciente });
            let currentBalance = 0;
            if (balanceResult.rows.length > 0 && balanceResult.rows[0] !== null && balanceResult.rows[0] !== undefined) {
                currentBalance = balanceResult.rows[0];
            }
            // 2. Subtract obshta_cena from balance
            newBalance = currentBalance - parseFloat(obshta_cena);
            // 3. Update the balance in paciente
            const updateBalanceQuery = `UPDATE paciente SET balance = :balance WHERE id_paciente = :id_paciente`;
            await connection.execute(updateBalanceQuery, { balance: newBalance, id_paciente: id_paciente });
        }

        // If all inserts were successful, commit the entire transaction
        await connection.commit();

        const responseObj = {
            message: 'Procedure created successfully',
            id_procedura: newProceduraId
        };
        if (newBalance !== null) {
            responseObj.updated_balance = newBalance;
        }
        res.status(201).json(responseObj);

    } catch (err) {
        // If any error occurred, roll back the entire transaction
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {

            }
        }

        res.status(500).json({
            error: 'Failed to create procedure'
        });
    } finally {
        // Always release the connection
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {

            }
        }
    }
});

// DELETE procedure
router.delete('/:id', async (req, res) => {
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

        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {

            }
        }
        res.status(500).json({
            error: 'Failed to delete procedure'
        });
    }
});

// Edit procedure
router.put('/:id', async (req, res) => {
  // Get the procedure ID from the URL parameters
  const { id } = req.params;
  const { data, obshta_cena, zonas, comment, currency } = req.body;
  const validCurrencyEdit = ['BGN', 'EUR'].includes(currency) ? currency : 'EUR';

  // Basic validation
  if (!data || obshta_cena === undefined || !Array.isArray(zonas)) {
      return res.status(400).json({
          error: 'Missing required fields. Required: data, obshta_cena, and zonas array'
      });
  }
  // Additional validation for numbers
  if (isNaN(parseFloat(obshta_cena))) {
      return res.status(400).json({ error: 'obshta_cena must be a valid number' });
  }
  if (isNaN(Number(id))) {
      return res.status(400).json({ error: 'Procedure ID must be a valid number' });
  }

  let connection;
  try {
      connection = await database.getConnection(); // Get a connection from your pool

      // Step 1: Update the main procedure record
      const updateProceduraQuery = `
          UPDATE procedura
          SET data = TO_DATE(:data, 'YYYY-MM-DD'), obshta_cena = :obshta_cena, currency = :currency, "COMMENT" = :comment_text
          WHERE id_procedura = :id
      `;
      await connection.execute(
          updateProceduraQuery,
          {
              data,
              obshta_cena: parseFloat(obshta_cena),
              currency: validCurrencyEdit,
              comment_text: comment || null,
              id
          },
          { autoCommit: false }
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
          INSERT INTO procedura_zona (id_procedura, id_zona, pulsaciones)
          VALUES (:id_procedura, :id_zona, :pulsaciones)
      `;
      for (const zona of zonas) {
          if (zona.id_zona === undefined) {
              throw new Error('Each zone object in the array must have an "id_zona" property.');
          }
          // Convert empty string to null for pulsaciones if needed
          const pulsacionesValue = (zona.pulsaciones === '' || zona.pulsaciones === null || zona.pulsaciones === undefined)
              ? null
              : zona.pulsaciones;

          await connection.execute(
              insertZonaQuery,
              {
                  id_procedura: id,
                  id_zona: zona.id_zona,
                  pulsaciones: pulsacionesValue
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

          }
      }

      res.status(500).json({
          error: 'Failed to update procedure'
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

// Get zonas
router.get('/zonas', async (req, res) => {
  const query = `SELECT id_zona "idZona", nazvanie, nazvanie_es "nazvanieEs", pol_specifichen "polSpecifichen", mean_pulsaciones "meanPulsaciones" FROM zona_telo`;
  try {
    const result = await database.simpleExecute(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;