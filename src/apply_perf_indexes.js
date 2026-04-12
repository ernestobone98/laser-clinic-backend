const database = require('./config/database');

async function run() {
  console.log('--- Starting Performance Index Optimization ---');
  
  try {
    // Initialize connection pool
    await database.initialize();
    
    const indexes = [
      'CREATE INDEX idx_paciente_ime_lower ON paciente(LOWER(ime))',
      'CREATE INDEX idx_paciente_email_lower ON paciente(LOWER(email))',
      'CREATE INDEX idx_paciente_telefon ON paciente(telefon)'
    ];

    for (const sql of indexes) {
      console.log(`Executing: ${sql}`);
      try {
        await database.simpleExecute(sql);
        console.log('✅ Success');
      } catch (err) {
        if (err.message.includes('ORA-00955')) {
          console.log('ℹ️ Index already exists, skipping.');
        } else {
          console.error(`❌ Error executing: ${err.message}`);
        }
      }
    }

    console.log('--- Optimization Complete ---');
  } catch (err) {
    console.error('❌ Critical Error during initialization:', err);
  } finally {
    process.exit(0);
  }
}

run();
