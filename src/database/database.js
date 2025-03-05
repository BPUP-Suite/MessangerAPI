// Database connection and query functions
// This module provides a simple way to connect to a PostgreSQL database and execute queries.

const { Pool } = require('pg');

const logger = require('../logger');

const envManager = require('../security/envManager');

logger.debug('Getting PostgreSQL credentials...');
const pool = new Pool({
  user: envManager.readPostgresqlUser(),       
  host: envManager.readPostgresqlHost(),
  database: envManager.readPostgresqlDb(),
  password: envManager.readPostgresqlPassword(),
  port: envManager.readPostgresqlPort(),
});    

logger.debug('PostgreSQL credentials acquired');

async function query(text, params) {
  logger.debug(`Executing query: ${text} with parameters: ${JSON.stringify(params)}`);
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    logger.debug(`Query executed: ${text} with parameters: ${JSON.stringify(params)}`);
    return res.rows;
  } catch (err) {
    logger.error(`Error executing query: ${text} with parameters: ${JSON.stringify(params)}. Error: ${err}`);
    throw err;
  } finally {
    client.release();
  }
}

async function testConnection() {
    try {
      const result = await query('SELECT 1', []);
      if (result && result.length > 0) {
        logger.log('Database connection is healthy.');
      } else {
        logger.error('Database connection test failed: no result.');
      }
    } catch (err) {
      logger.error('Database connection test failed.', err);
    }
  }

async function check_email_existence(email) {

    const QUERY = "SELECT email FROM public.users WHERE email = $1";
    
    let confirmation = true;

    const result = await query(QUERY, [email]);
    if (result.length === 0) {
        confirmation = false;
    }

    return confirmation;
}

module.exports = {
  testConnection,
  check_email_existence
};
