require('dotenv').config();
const oracledb = require('oracledb');

async function initialize() {
  try {
    // By not calling initOracleClient, node-oracledb will run in Thin Mode
    // which doesn't require Oracle Instant Client libraries.
    // It will automatically use the wallet location from the TNS_ADMIN env var.
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      walletLocation: process.env.TNS_ADMIN,
      walletPassword: process.env.DB_WALLET_PASSWORD
    });
    console.log('Connection pool started');
  } catch (err) {
    console.error('Error creating connection pool:', err);
    process.exit(1);
  }
}

async function close() {
  await oracledb.getPool().close(10);
  console.log('Connection pool closed');
}

async function simpleExecute(statement, binds = [], opts = {}) {
  let connection;
  let result = [];
  opts.outFormat = oracledb.OUT_FORMAT_OBJECT;

  try {
    connection = await oracledb.getConnection();
    result = await connection.execute(statement, binds, opts);
  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
  return result;
}

async function getConnection() {
  return await oracledb.getConnection();
}

module.exports = {
  initialize,
  close,
  simpleExecute,
  getConnection,
  oracledb
};
