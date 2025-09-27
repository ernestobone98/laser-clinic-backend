const app = require('./src/app');
const database = require('./src/config/database');

const port = process.env.PORT || 8080;

// --- Server Initialization and Shutdown ---
async function startup() {

  try {

    await database.initialize();
  } catch (err) {
    console.error(err);
    process.exit(1); // Non-zero failure code
  }

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

async function shutdown(e) {
  let err = e;

  try {

    await database.close();
  } catch (e) {
    console.error(e);
    err = err || e;
  }


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
  shutdown();
});

process.on('SIGINT', () => {
  shutdown();
});

process.on('uncaughtException', err => {
  shutdown(err);
});