// Database connection and query functions
// This module provides a simple way to connect to a PostgreSQL database and execute queries.

const { Pool } = require('pg');
const { SignupUser, LoginUser, Message} = require('./object');

const logger = require('../logger');
const encrypter = require('../security/encrypter');

const envManager = require('../security/envManager');

logger.log('[POSTGRES] Postgresql database starting...');

logger.debug('[POSTGRES] Getting PostgreSQL credentials...');

const POSTGRES_USER = envManager.readPostgresqlUser();
const POSTGRES_HOST = envManager.readPostgresqlHost();
const POSTGRES_DB = envManager.readPostgresqlDb();
const POSTGRES_PASSWORD = envManager.readPostgresqlPassword();
const POSTGRES_PORT = envManager.readPostgresqlPort();

logger.debug('[POSTGRES] PostgreSQL credentials acquired');

logger.debug(`[POSTGRES] POSTGRES_USER: ${POSTGRES_USER}`);
logger.debug(`[POSTGRES] POSTGRES_HOST: ${POSTGRES_HOST}`);
logger.debug(`[POSTGRES] POSTGRES_DB: ${POSTGRES_DB}`);
logger.debug(`[POSTGRES] POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}`);
logger.debug(`[POSTGRES] POSTGRES_PORT: ${POSTGRES_PORT}`);

logger.debug('[POSTGRES] Creating PostgreSQL pool...');
const pool = new Pool({
  user: POSTGRES_USER,   
  host: POSTGRES_HOST,
  database: POSTGRES_DB,
  password: POSTGRES_PASSWORD,
  port: POSTGRES_PORT
});    
logger.debug('[POSTGRES] PostgreSQL pool created');

async function query(text, params) {
  logger.debug(`[POSTGRES] Executing query: ${text} with parameters: ${JSON.stringify(params)}`);
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    logger.debug(`[POSTGRES] Query executed: ${text} with parameters: ${JSON.stringify(params)}, result: ${JSON.stringify(res.rows)}`);
    return res.rows;
  } catch (error) {
    logger.error(`[POSTGRES] Error executing query: ${text} with parameters: ${JSON.stringify(params)}. Error: ${error}`);
    throw error;
  } finally {
    client.release();
  }
}

async function testConnection() {
    try {
      const result = await query('SELECT 1', []);
      if (result && result.length > 0) {
        logger.log('[POSTGRES] Postgresql database connection is healthy.');
        return true;
      } else {
        logger.error('[POSTGRES] Postgresql database connection test failed: no result.');
        return false;
      }
    } catch (error) {
      logger.error('[POSTGRES] Postgresql database connection test failed: ' + error);
      return false;
    }
  }

// API Methods

// No Authentication needed

async function check_email_existence(email) {

    const QUERY = "SELECT email FROM public.users WHERE email = $1";
    
    let confirmation = true;

    try{
      const result = await query(QUERY, [email]);
      if (result.length === 0) {
          confirmation = false;
      }
    }catch(err){
      logger.error("[POSTGRES] database.check_email_existence: " + err);
    }


    return confirmation;
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
    logger.error("[POSTGRES] database.check_handle_availability: " + err);
    confirmation = null;
  }

  return confirmation;
}

async function add_user_to_db(signupUser) {
    
    let confirmation = false
    const password = encrypter.generatePasswordHash(signupUser.password)

    const QUERY = `WITH new_user AS (INSERT INTO public.users(email, name, surname, password) VALUES($1, $2, $3, $4) RETURNING user_id) INSERT INTO public.handles(user_id, handle) VALUES((SELECT user_id FROM new_user), $5);`
    logger.debug('[POSTGRES] ' + QUERY)
    try {
      await query(QUERY, [signupUser.email, signupUser.name, signupUser.surname, password, signupUser.handle]);
      confirmation = true
    } catch (err) {
      logger.error("[POSTGRES] database.add_user_to_db: " + err)
      confirmation = false
    }
    return confirmation
}

async function login(loginUser) {

    const QUERY = "SELECT user_id, password FROM public.users WHERE email = $1";
    let user_id = null;

    try{
      const result = await query(QUERY, [loginUser.email]);
      password = result[0].password;
  
      if(encrypter.checkPasswordHash(loginUser.password, password)){
        user_id = result[0].user_id;
      }
    }catch(err){
      logger.error("[POSTGRES] database.login: " + err);
    }

    return user_id;
}

// Authentication needed

// needs this to work: CREATE EXTENSION IF NOT EXISTS pg_trgm;
async function search(handle){
  const QUERY = "SELECT handle, user_id, group_id, channel_id FROM handles WHERE handle ILIKE '%' || $1 || '%' ORDER BY similarity(handle, $1) DESC LIMIT 10;";

  let results = [];

  try{
    const result = await query(QUERY, [handle]);
    // transfrom result in a handle list 
    // TBD: get images of users (or another method that passes images on request by socket managed by client)

    // Transform results to include handle type
    results = result.map(row => {
      let type = null;
      
      if (row.user_id !== null && row.user_id !== undefined) {
        type = "user";
      } else if (row.group_id !== null && row.group_id !== undefined) {
        type = "group";
      } else if (row.channel_id !== null && row.channel_id !== undefined) {
        type = "channel";
      }
      
      return {
        handle: row.handle,
        type: type
      };
    });

  }catch(err){
    logger.error("[POSTGRES] database.search: " + err);
  }

  return results;
}
async function search_users(handle){
  const QUERY = "SELECT handle FROM handles WHERE handle ILIKE '%' || $1 || '%' AND user_id IS NOT NULL ORDER BY similarity(handle, $1) DESC LIMIT 10;";

  let list = [];

  try{
    const result = await query(QUERY, [handle]);
    // transfrom result in a handle list 
    // TBD: get images of users (or another method that passes images on request by socket managed by client)

    list = result.map(row => row.handle); 

  }catch(err){
    logger.error("[POSTGRES] database.search_users: " + err);
  }

  return list;
}

async function get_members_as_handle(chat_id) {

    let members = [];

    const members_id = get_members_as_user_id(chat_id);
    if(members_id === null || members_id === undefined || members_id.length === 0){
      logger.debug("[POSTGRES] No members found for chat: " + chat_id);
      return null;
    }
    // Get the handles of the members

    for(let i = 0; i < members_id.length; i++){
      members.push(await get_handle_from_id(members_id[i]));
    }

  return members;

}

async function get_members_as_user_id(chat_id) {

  let QUERY = "";
  let personal = false;

  switch(get_chat_type(chat_id)){
    case "personal":
      QUERY = "SELECT user1, user2 FROM public.chats WHERE chat_id = $1";
      personal = true;
      break;
    case "group":
      QUERY = "SELECT members FROM public.groups WHERE chat_id = $1";
      break;
    case "channel":
      QUERY = "SELECT members FROM public.channels WHERE chat_id = $1";
      break;
    default:
      break;
  }

  let members_id = null;

  try{
    const result = await query(QUERY, [chat_id]);

    if(personal){
      members_id = [result[0].user1, result[0].user2];
    }else{
      members_id = result[0].members;
    }
  }catch(error){
    logger.error("[POSTGRES] database.get_members_as_handle: " + error);
  }

  return members_id;

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
    logger.error("[POSTGRES] database.client_init: " + err);
  }

  // if no data are found, return the empty json
  if(user_info === null || user_info === undefined |  user_info.length === 0){
    return null;
  }

  const email = user_info.email;
  const name  = user_info.name;
  const surname = user_info.surname;

  let json = {
    "localUser": {
      "handle": handle,
      "email": email,
      "name": name,
      "surname": surname,
      "user_id": user_id
    }
  };

  // Get user chats
  const chats = await get_chats(user_id);

  if(chats === null || chats === undefined || chats.length === 0){
    logger.debug("[POSTGRES] No chats found for user: " + user_id);
  }else{
    json["chats"] = chats;

    // Get user chat messages

    let messages = null;

    for(let i = 0; i < chats.length; i++){
      messages = await get_chat_messages(chats[i].chat_id);
      if(messages != null && messages != undefined &&  messages.length != 0){
        json["chats"][i]["messages"] = messages;
      }
    }
  }
  
  // Get groups 
  const groups = await get_groups(user_id);
  if(groups === null || groups === undefined || groups.length === 0){
    logger.debug("[POSTGRES] No groups found for user: " + user_id);
  }else{
    json["groups"] = groups;

    // Get group messages

    let messages = null;

    for(let i = 0; i < groups.length; i++){
      messages = await get_chat_messages(groups[i].chat_id);
      if(messages != null && messages != undefined &&  messages.length != 0){
        json["groups"][i]["messages"] = messages;
      }
    }
  }

  // Get channels

  //TDB: get channels from the database


  return json;
}

async function get_chat_messages(chat_id){
  const QUERY = "SELECT message_id, text, sender, date FROM public.messages WHERE chat_id = $1";
  let messages = null;

  try{
    const result = await query(QUERY, [chat_id]);
    messages = result;
  }catch(err){
    logger.error("[POSTGRES] database.get_chat_messages: " + err);
  }

  return messages;
}

async function get_chats(user_id){
  const QUERY_CHATS = "SELECT chat_id,user1,user2 FROM public.chats WHERE user1 = $1 OR user2 = $1";
  let chats = null;

  try{
    const result = await query(QUERY_CHATS, [user_id]);
    chats = result;
  }
  catch(err){
    logger.error("[POSTGRES] database.client_init: " + err);
  }

  // if no data are found, return only the info json
  if(chats === null || chats === undefined |  chats.length === 0){
    logger.debug("[POSTGRES] No chats found for user: " + user_id);
    return null;
  }

  // Remap of the chats array to a json object using a list for users 
  const chatPromises = chats.map(async chat => {
    return {
      chat_id: chat.chat_id,
      users: [
        {
          "handle": await get_handle_from_id(chat.user1)
        },
        {
          "handle": await get_handle_from_id(chat.user2)
        }
      ]
    };
  });

  return await Promise.all(chatPromises);
}

async function get_groups(user_id){

  const QUERY_GROUPS = "SELECT name,chat_id,members FROM public.groups WHERE members @> ARRAY[$1]::bigint[]";
  let groups = null;
  try{
    const result = await query(QUERY_GROUPS, [user_id]);
    groups = result;
  }
  catch(error){
    logger.error("[POSTGRES] database.client_init: " + error);
  }

  // if no data are found, return only the info json
  if(groups === null || groups === undefined |  groups.length === 0){
    logger.debug("[POSTGRES] No groups found for user: " + user_id);
    return null;
  }
  // Remap of the groups array to a json object using a list for users

  const groupPromises = groups.map(async group => {
    // Map all members to their user_id and handle
    const usersPromises = group.members.map(async memberId => {
      return {
        "user_id": memberId,
        "handle": await get_handle_from_id(memberId)
      };
    });
    
    return {
      name: group.name,
      chat_id: group.chat_id,
      users: await Promise.all(usersPromises)
    };
  });

  return await Promise.all(groupPromises);

}


async function client_update(datetime, user_id) {

  let json = {};

  // Find chats with new messages since the provided datetime
  const QUERY_CHATS_WITH_NEW_MESSAGES = `SELECT c.chat_id, c.user1, c.user2 FROM public.chats c WHERE (c.user1 = $1 OR c.user2 = $1) AND EXISTS (SELECT 1 FROM public.messages m WHERE m.chat_id = c.chat_id AND m.date > $2)`;

  let chatsWithNewMessages = null;

  try {
    const result = await query(QUERY_CHATS_WITH_NEW_MESSAGES, [user_id, datetime]);
    chatsWithNewMessages = result;
  } catch(error) {
    logger.error("[POSTGRES] database.client_update finding chats: " + error);
    return null;
  }

  // If no chats with new messages, return just null
  if(!chatsWithNewMessages || chatsWithNewMessages.length === 0) {
    logger.debug("[POSTGRES] No updated chats found for user since: " + datetime);
    return json;
  }

  // Format chats with new messages
  const chatPromises = chatsWithNewMessages.map(async chat => {
    return {
      chat_id: chat.chat_id,
      users: [
        {
          "handle": await get_handle_from_id(chat.user1)
        },
        {
          "handle": await get_handle_from_id(chat.user2)
        }
      ]
    };
  });

  json["chats"] = await Promise.all(chatPromises);
  
  // Get new messages for each chat
  for(let i = 0; i < chatsWithNewMessages.length; i++) {
    const QUERY_MESSAGES = "SELECT message_id, text, sender, date FROM public.messages WHERE chat_id = $1 AND date > $2";
    try {
      const result = await query(QUERY_MESSAGES, [chatsWithNewMessages[i].chat_id, datetime]);
      if(result && result.length > 0) {
        json["chats"][i]["messages"] = result;
      }
    } catch(err) {
      logger.error("[POSTGRES] database.client_update getting messages: " + err);
    }
  }

  // Get groups with new messages since the provided datetime

  const QUERY_GROUPS_WITH_NEW_MESSAGES = `SELECT g.chat_id, g.name, g.members FROM public.groups g WHERE g.members @> ARRAY[$1]::bigint[]" AND EXISTS (SELECT 1 FROM public.messages m WHERE m.chat_id = g.chat_id AND m.date > $2)`;
  let groupsWithNewMessages = null;
  const members = [user_id];
  try {
    const result = await query(QUERY_GROUPS_WITH_NEW_MESSAGES, [members, datetime]);
    groupsWithNewMessages = result;
  } catch(error) {
    logger.error("[POSTGRES] database.client_update finding groups: " + error);
    return null;
  }
  // If no groups with new messages, return just null

  if(!groupsWithNewMessages || groupsWithNewMessages.length === 0) {
    logger.debug("[POSTGRES] No updated groups found for user since: " + datetime);
    return json;
  }
  // Format groups with new messages

  const groupPromises = groupsWithNewMessages.map(async group => {
    return {
      name: group.name,
      chat_id: group.chat_id,
      users: [
        {
          "user_id": group.members[0],
          "handle": await get_handle_from_id(group.members[0])
        }
      ]
    };
  }

  );
  json["groups"] = await Promise.all(groupPromises);

  // Get new messages for each group

  for(let i = 0; i < groupsWithNewMessages.length; i++) {
    const QUERY_MESSAGES = "SELECT message_id, text, sender, date FROM public.messages WHERE chat_id = $1 AND date > $2";
    try {
      const result = await query(QUERY_MESSAGES, [groupsWithNewMessages[i].chat_id, datetime]);
      if(result && result.length > 0) {
        json["groups"][i]["messages"] = result;
      }
    } catch(err) {
      logger.error("[POSTGRES] database.client_update getting messages: " + err);
    }
  }

  // Get channels with new messages since the provided datetime
  // TBD: get channels from the database

  return json;
}

async function send_message(message){

  const chat_id= message.chat_id;
  const sender = message.sender;
  const text = message.text;
  const date = new Date();

  let QUERY = 'INSERT INTO public.messages (chat_id, text, sender, date) VALUES ($1, $2, $3, $4) RETURNING message_id';;
  let recipient_list = [];

  switch(get_chat_type(chat_id)){
    case "personal":

      recipient_list.push(sender);

      const recipient = await get_recipient(chat_id, sender);

      if(recipient === null){
        return { message_data: null, recipient_list: null };
      }

      recipient_list.push(recipient);
      break;

    case "group": 

      // sender is already inside the list of members
      recipient_list = await get_members_as_user_id(chat_id);
      break;
      
    case "channel": // not implemented yet
      return { message_data: null, recipient_list: null };
    default:
      return { message_data: null, recipient_list: null };
  }

  let message_id = null;

  try{
    const result = await query(QUERY, [chat_id, text, sender, date]);
    message_id = result[0].message_id;

  }catch(err){
    logger.error("[POSTGRES] database.send_message: " + err);
    return { message_data: null, recipient_list: null };
  }

  if(message_id != null && message_id != undefined && message_id != ''){

    logger.debug("[POSTGRES] Creating response message... message_id: "+ message_id + " chat_id: "+chat_id );
    const message_data = { 
      chat_id: chat_id,
      message_id: message_id,
      sender: sender,
      text: text,
      date: date
    };

    return { message_data, recipient_list};
  }

  return { message_data: null, recipient_list: null };
}

// Create new chat

async function create_chat(chat) {
  
  const user1 = chat.user1;
  const user2 = chat.user2;

  const QUERY = "INSERT INTO public.chats(user1, user2) VALUES ($1, $2) RETURNING chat_id";
  let chat_id = null;

  try{
    const result = await query(QUERY, [user1, user2]);
    chat_id = result[0].chat_id;
  }
  catch(err){
    logger.error("[POSTGRES] database.create_chat: " + err);
  }

  return chat_id;

}

// Create new group

async function create_group(group) {
  
  const name = group.name;
  const description = group.description;
  const members = group.members;
  const admins = group.admins;

  const QUERY = "INSERT INTO public.groups(name, description, members, admins) VALUES ($1, $2, $3, $4) RETURNING chat_id";
  let chat_id = null;

  try{  
    // Insert the group into the database
    const result = await query(QUERY, [name, description, members, admins]);
    chat_id = result[0].chat_id;
    logger.debug("[POSTGRES] Group created with ID: " + chat_id);

    const HANDLE_QUERY = "INSERT INTO public.handles(group_id, handle) VALUES ($1, $2)";
    const handle = group.handle;

    if(handle != null){ // if handle is null do not insert it into the database because group is private
        // Insert the group handle into the database
        await query(HANDLE_QUERY, [chat_id, handle]);
        logger.debug("[POSTGRES] Group handle inserted: " + handle);
    }

  }
  catch(err){
    logger.error("[POSTGRES] database.create_group: " + err);
  }

  return chat_id;

}

// Insert the new members into the group

async function add_members_to_group(chat_id, members) {
  const QUERY = "UPDATE public.groups SET members = array_append(members, $1) WHERE chat_id = $2";
  let confirmation = false;

  try{
    await query(QUERY, [members, chat_id]);
    confirmation = true;
  }catch(err){
    logger.error("[POSTGRES] database.add_members_to_group: " + err);
  }

  return confirmation;
}


// Utilities

async function get_user_id_from_handle(handle) {
  const QUERY = "SELECT user_id FROM public.handles WHERE handle = $1";
  let user_id = null;

  try{
    const result = await query(QUERY, [handle]);
    user_id = result[0].user_id;
  }catch(err){
    logger.error("[POSTGRES] database.get_user_id_from_handle: " + err);
  }
  
  return user_id;
}

async function get_chat_id_from_handle(handle) {

  const QUERY = "SELECT group_id,channel_id FROM public.handles WHERE handle = $1";
  let chat_id = null;

  try{
    const result = await query(QUERY, [handle]);
    chat_id = result[0].group_id;

    if(chat_id === null || chat_id === undefined || chat_id === ''){
      chat_id = result[0].channel_id;
    }
    
  }catch(err){
    logger.error("[POSTGRES] database.get_chat_id_from_handle: " + err);
  }

  return chat_id;
}


async function get_handle_from_id(id) {
  const QUERY = "SELECT handle FROM public.handles WHERE user_id = $1 OR group_id = $1 OR channel_id = $1";
  let handle = null;

  try{
    const result = await query(QUERY, [id]);
    handle = result[0].handle;
  }catch(err){
    logger.error("[POSTGRES] database.get_handle_from_id: " + err);
  }
  
  return handle;
}

async function get_recipient(chat_id, sender) {

  const QUERY = "SELECT user1, user2 FROM public.chats WHERE chat_id = $1 AND (user1 = $2 OR user2 = $2)";
  let recipient = null;

  try{
    const result = await query(QUERY, [chat_id, sender]);
    if(result[0].user1 === sender){
      recipient = result[0].user2;
    }else{
      recipient = result[0].user1;
    }

  }catch(err){
    logger.error("[POSTGRES] database.get_recipient: " + err);
  }

  return recipient;

}

function get_chat_type(id){

  if(id == null || id === undefined || id === ''){
    return null;
  }

  if (id.charAt(0) === '2') {
    return "personal"; 
  }
  if (id.charAt(0) === '3') {
    return "group";
  }
  if (id.charAt(0) === '4') {
    return "channel";
  }
  
  return null;
}

async function get_group_name_from_chat_id(chat_id){
  const QUERY = "SELECT name FROM public.groups WHERE chat_id = $1";
  let name = null;

  try{
    const result = await query(QUERY, [chat_id]);
    name = result[0].name;
  }catch(err){
    logger.error("[POSTGRES] database.get_group_name_from_chat_id: " + err);
  }

  return name;
}

async function check_chat_existance(handle,other_handle) {
  
  const QUERY = "SELECT chat_id FROM public.chats WHERE (user1 = $1 AND user2 = $2) OR (user1 = $2 AND user2 = $1)";
  let confirmation = false;

  let user_id = null;
  let other_user_id = null;
  try{
    user_id = await get_user_id_from_handle(handle);
    other_user_id = await get_user_id_from_handle(other_handle);
    const result = await query(QUERY, [user_id, other_user_id]);

    if(result.length != 0){
      confirmation = true;
    }

  }
  catch(error){
    logger.debug("[POSTGRES] database.check_chat_existance: " + error);
  }

  return confirmation;
}

module.exports = {
  testConnection,
  check_email_existence,
  add_user_to_db,
  login,
  check_handle_availability,
  client_init,
  client_update,
  send_message,
  search,
  search_users,
  get_user_id_from_handle,
  get_chat_id_from_handle,
  get_handle_from_id,
  create_chat,
  create_group,
  get_members_as_handle,
  get_members_as_user_id,
  add_members_to_group,
  get_group_name_from_chat_id,
  check_chat_existance,
  get_chat_messages
};
