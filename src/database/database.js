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

// API Methods

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

    const QUERY = "SELECT user_id, password FROM public.users WHERE email = $1";
    let api_key = null;

    try{
      const result = await query(QUERY, [loginUser.email]);
      password = result[0].password;
  
      if(encrypter.checkPasswordHash(loginUser.password, password)){
        const QUERY_2 = "SELECT api_key FROM public.apiKeys WHERE user_id = $1";
        const result_2 = await query(QUERY_2, [result[0].user_id]);
        api_key = result_2[0].api_key;
      }
    }catch(err){
      logger.error("database.login: " + err);
    }

    return api_key;
}

async function get_user_id(api_key) {
  
    const QUERY = "SELECT user_id FROM public.apiKeys WHERE api_key = $1";
    let user_id = null;

    try{
      const result = await query(QUERY, [api_key]);
      user_id = result[0].user_id;
    }catch(err){
      logger.error("database.get_user_id: " + err);
    }
    
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

// IO Methods

async function client_init(user_id) {

  const handle = await get_handle_from_id(user_id);

  // Get user info

  const QUERY_INFO = "SELECT name, surname, email FROM public.users WHERE user_id = $1";
  let user_info = null;

  try{
    const result = await query(QUERY_INFO, [user_id]);
    user_info = result[0];
  }
  catch(err){
    logger.error("database.client_init: " + err);
  }

  // if no data are found, return the empty json
  if(user_info === null || user_info === undefined |  user_info.length === 0){
    return null;
  }

  const email = user_info.email;
  const name  = user_info.name;
  const surname = user_info.surname;

  let json = {
    "handle": handle,
    "email": email,
    "name": name,
    "surname": surname
  };

  // Get user chats

  const QUERY_CHATS = "SELECT chat_id FROM public.chats WHERE user1 = $1 OR user2 = $1";
  let chats = null;

  try{
    const result = await query(QUERY_CHATS, [user_id]);
    chats = result;
  }
  catch(err){
    logger.error("database.client_init: " + err);
  }

  // if no data are found, return only the info json
  if(chats === null || chats === undefined |  chats.length === 0){
    logger.debug("No chats found for user: " + user_id);
    return json;
  }

  json["chats"] = chats;
  
  // Get user messages

  let messages = null;

  for(let i = 0; i < chats.length; i++){
    const QUERY_MESSAGES = "SELECT message_id, message FROM public.messages WHERE chat_id = $1";
    try{
      const result = await query(QUERY_MESSAGES, [chats[i].chat_id]);
      messages = result;
    }
    catch(err){
      logger.error("database.client_init: " + err);
    }

    if(messages != null && messages != undefined &&  messages.length != 0){
      json["chats"][i]["messages"] = messages;
    }
  }

  return json;
}

// Utilities

async function get_user_id_from_handle(handle) {
  const QUERY = "SELECT user_id FROM public.handles WHERE handle = $1";
  let user_id = null;

  try{
    const result = await query(QUERY, [handle]);
    user_id = result[0].user_id;
  }catch(err){
    logger.error("database.get_user_id_from_handle: " + err);
  }
  
  return user_id;
}

async function get_handle_from_id(id) {
  const QUERY = "SELECT handle FROM public.handles WHERE user_id = $1 OR group_id = $1 OR channel_id = $1";
  let handle = null;

  try{
    const result = await query(QUERY, [id]);
    handle = result[0].handle;
  }catch(err){
    logger.error("database.get_handle_from_id: " + err);
  }
  
  return handle;
}

module.exports = {
  testConnection,
  check_email_existence,
  add_user_to_db,
  login,
  get_user_id,
  check_handle_availability,
  client_init
};
