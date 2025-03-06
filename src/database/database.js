// Database connection and query functions
// This module provides a simple way to connect to a PostgreSQL database and execute queries.

const { Pool } = require('pg');
const { SignupUser, LoginUser} = require('./object');

const logger = require('../logger');
const encrypter = require('../security/encrypter');

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
    logger.debug(`Query executed: ${text} with parameters: ${JSON.stringify(params)}, result: ${JSON.stringify(res.rows)}`);
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
        return true;
      } else {
        logger.error('Database connection test failed: no result.');
        return false;
      }
    } catch (err) {
      logger.error('Database connection test failed.', err);
      return false;
    }
  }

async function check_email_existence(email) {

    const QUERY = "SELECT email FROM public.users WHERE email = $1";
    
    let confirmation = true;

    try{
      const result = await query(QUERY, [email]);
      if (result.length === 0) {
          confirmation = false;
      }
    }catch(err){
      logger.error("database.check_email_existence: " + err);
    }


    return confirmation;
}

async function add_user_to_db(signupUser) {
    
    let confirmation = false

    let api_key = encrypter.generateApiKey()
    const API_KEY_QUERY = "SELECT api_key FROM public.apiKeys WHERE api_key = $1";
    while (await query(API_KEY_QUERY, [api_key]).length > 0) {
      logger.error("Duplicated api_key, generating a new one");
      api_key = encrypter.generateApiKey()
    }
    
    const password = encrypter.generatePasswordHash(signupUser.password)

    const QUERY = `
    WITH new_user AS (
      INSERT INTO public.users(email, name, surname, password)
      VALUES($1, $2, $3, $4)
      RETURNING user_id
    ), new_handle AS (
      INSERT INTO public.handles(user_id, handle)
      VALUES((SELECT user_id FROM new_user), $5)
    )
    INSERT INTO public.apiKeys(user_id, api_key)
    VALUES((SELECT user_id FROM new_user), $6)
    `
    logger.debug(QUERY)
    try {
      await query(QUERY, [signupUser.email, signupUser.name, signupUser.surname, password, signupUser.handle, api_key])
      confirmation = true
    } catch (err) {
      logger.error("database.add_user_to_db: " + err)
      confirmation = false
    }
    return confirmation
}


async function login(loginUser) {
    const QUERY = "";

    let api_key = null;
    return api_key;
}

async function get_user_id(api_key) {
    const QUERY = "";

    let user_id = null;
    return user_id;
}

async function check_handle_availability(handle) {
    const QUERY = "SELECT handle FROM public.handles WHERE handle = $1";

    let confirmation = true;

    try{
      const result = await query(QUERY, [handle]);
      if (result.length > 0) {
          confirmation = false;
      }
    }
    catch(err){
      logger.error("database.check_handle_availability: " + err);
      confirmation = null;
    }

    return confirmation;
}



module.exports = {
  testConnection,
  check_email_existence,
  add_user_to_db,
  login,
  get_user_id,
  check_handle_availability
};
