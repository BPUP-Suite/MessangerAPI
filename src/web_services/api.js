const express = require('express');
const rateLimit = require('express-rate-limit');

const cors = require('cors');

const api = express();
const logger = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');

const { AccessResponse, SignupResponse, SignupUser, LoginResponse, LoginUser, LogoutResponse,SessionResponse, HandleResponse, SearchResponse, InitResponse, Message, MessageResponse,CreateChatResponse,Chat,CreateGroupResponse,Group,MembersResponse, UpdateResponse,JoinGroupResponse} = require('../database/object');

const io = require('./socketio');

api.use(express.json());
api.use(express.urlencoded({ extended: true }));

const envManager = require('../security/envManager');
const { sessionMiddleware } = require('../security/sessionMiddleware');

// api path 

const version = '/v1/';

// /user
const user_base = version + 'user/';

const auth_base = user_base + 'auth/'

const access_path = auth_base + 'access';
const signup_path = auth_base + 'signup';
const login_path = auth_base + 'login';
const logout_path = auth_base + 'logout';
const session_path = auth_base + 'session';

const data_base = user_base + 'data/';

const check_base = data_base + 'check/';

const handle_availability_path = check_base + 'handle-availability';

const get_data_base = data_base + 'get/'

const init_path = get_data_base + 'init'
const update_path = get_data_base + 'update'

const search_base = data_base + 'search/';

const search_users_path = search_base + 'users';
const search_all_path = search_base + 'all';

// /chat
const chat_base = version + 'chat/';

const send_base = chat_base + 'send/';

const message_path = send_base + 'message';
const voice_message_path = send_base + 'voice_message';
const file_path = send_base + 'file';

const create_base = chat_base + 'create/';

const chat_path = create_base + 'chat';
const group_path = create_base + 'group';
const channel_path = create_base + 'channel';

const get_chat_base = chat_base + 'get/';

const members_path = get_chat_base + 'members';

const join_base = chat_base + 'join/';

const join_group_path = join_base + 'group';
const join_channel_path = join_base + 'channel';


// api response type

const access_response_type = 'access_type';
const signup_response_type = 'signed_up';
const login_response_type = 'logged_in';
const logout_response_type = 'logged_out';
const session_response_type = 'session_id';

const handle_availability_response_type = 'handle_available';

const init_response_type = 'init';
const update_response_type = 'update';

const message_response_type = 'message_sent';
const voice_message_response_type = '';
const file_response_type = '';

const chat_response_type = 'chat_created';
const group_response_type = 'group_created';
const channel_response_type = '';

const search_response_type = 'searched_list';
const get_members_response_type = 'members_list';

const join_group_response_type = 'group_joined';
const join_channel_response_type = 'channel_joined';

// api configurations

// Sessions configuration

api.use(sessionMiddleware);

// CORS Rules

let WEB_DOMAIN = envManager.readDomain();

if (WEB_DOMAIN == 'localhost') {
  WEB_DOMAIN = 'http://localhost' + envManager.readAPIPort();
  logger.warn('[API] Running on localhost, CORS will be set to localhost');
} else {
  WEB_DOMAIN = 'https://web.' + WEB_DOMAIN;
  logger.debug(`[API] Running on domain, CORS will be set to ${WEB_DOMAIN}`);
}

api.use(cors({
  origin: ['http://localhost:8081',WEB_DOMAIN], //TEMPORARY FOR TESTING PURPUSE 
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Allow proxy (nginx) to set the real ip address of the client
api.set('trust proxy', 1);

// api rate limiter

const rate_limiter_milliseconds = envManager.readRateLimiterMilliseconds();
const rate_limiter_number = envManager.readRateLimiterNumber();

const limiter = rateLimit({
  windowMs: rate_limiter_milliseconds,
  max: rate_limiter_number,
  handler: (req, res, next) => {
    logger.log(`[API] [ALERT] IP ${req.ip} has exceeded the rate limit on path: ${req.path}`);

    const errorDescription = 'Too many requests, please try again later.';
    const code = 429;

    res.status(code).json({  error_message: errorDescription });
  }
});

api.use(limiter);

// Api methods

// Docs:
// if the input items are not valid, returns 400
// if there is an error, returns 500
// all good, returns 200
// This is valid for every methods in this class

// GET METHODS

// Auth based on session

function isAuthenticated(req, res, next) {
  logger.debug('[API] [AUTH] Checking if user is authenticated: ' + req.session.user_id);
  if (req.session.user_id) {
    next();
  } else {
    const code = 401;
    const errorDescription = 'Non Authorized';

    logger.debug(`[API] [AUTH] User not authenticated`);

    res.status(code).json({ errorMessage: errorDescription });
  }
}

// Path: /user
// Path: .../auth

// returns the access type of the user (login -> already registered, signup -> not registered)

api.get(access_path, async (req, res) => {

  const email = req.query.email;

  logger.debug('[API] [REQUEST] Access request received ');
  logger.debug('-> ' + JSON.stringify(req.query))

  const type = access_response_type;
  let code = 500;
  let confirmation = null;
  let errorDescription = 'Generic error';
  let validated = true

  if (!(validator.email(email))) {
    code = 400;
    errorDescription = 'Email not valid';
    validated = false;
  }

  if (validated) {
    try {
      if (await database.check_email_existence(email)) {
        confirmation = 'login';
      } else {
        confirmation = 'signup';
      }
      errorDescription = '';
      code = 200;
    } catch (error) {
      logger.error('Error in database.check_email_existence: ' + error);
    }
  }

  const accessResponse = new AccessResponse(type, confirmation, errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(accessResponse.toJson()));
  return res.status(code).json(accessResponse.toJson());
});

// returns the status of signup request (true = signed_up successfully, false = error [see error code/description])

api.get(signup_path, async (req, res) => {

  const email = req.query.email;
  const name = req.query.name;
  const surname = req.query.surname;
  const handle = req.query.handle;
  const password = req.query.password;

  logger.debug('[API] [REQUEST] Signup request received ');
  logger.debug('-> ' + JSON.stringify(req.query))


  const type = signup_response_type;
  let code = 500;
  let confirmation = null;
  let errorDescription = 'Generic error';
  let validated = true;

  // check if every parameter is valid
  if (!(validator.email(email))) {
    code = 400;
    errorDescription = 'Email not valid';
    validated = false;
  }else if (!(validator.name(name))) {
    code = 400;
    errorDescription = 'Name not valid';
    validated = false;
  }else if (!(validator.surname(surname))) {
    code = 400;
    errorDescription = 'Surname not valid';
    validated = false;
  }else if (!(await validator.handle(handle))) {
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
  }else if (!(validator.password(password))) {
    code = 400;
    errorDescription = 'Password not valid';
    validated = false;
  }


  // only if everything is valid, try to sign up 
  if (validated) {
    const signupUser = new SignupUser(email, name, surname, handle, password);
    try {
      confirmation = await database.add_user_to_db(signupUser)
      if (confirmation) {
        code = 200;
        errorDescription = '';
      } else {
        code = 500;
      }
    } catch (error) {
      logger.error('Error in database.add_user_to_db: ' + error);
    }
  }

  const signupResponse = new SignupResponse(type, confirmation, errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(signupResponse.toJson()));
  return res.status(code).json(signupResponse.toJson());

});

// returns the api_key of the requested user if logged_in is true (true = logged_in successfully, false = error [see error code/description])
// if password is wrong return code 401 (Unauthorized)

api.get(login_path, async (req, res) => {
  const email = req.query.email;
  const password = req.query.password;

  logger.debug('[API] [REQUEST] Login request received ');
  logger.debug('-> ' + JSON.stringify(req.query));

  const type = login_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;
  let user_id = null;

  if (!validator.email(email)) {
    code = 400;
    errorDescription = 'Email not valid';
    validated = false;
  }else if (!validator.generic(password)) {
    code = 400;
    errorDescription = 'Password not valid';
    validated = false;
  }

  if (validated) {
    const loginUser = new LoginUser(email, password);
    try {
      user_id = await database.login(loginUser);
      if (validator.generic(user_id)) {
        confirmation = true;
        errorDescription = '';
        code = 200;

        logger.debug('[API] [SESSION] Session opened for: ' + user_id);
        req.session.user_id = user_id;

        req.session.save((error) => {
          if (error) {
            logger.error('[API] [SESSION] Error while saving session: ' + error.message);
            code = 500;
            errorDescription = 'Failed to save session';
            const loginResponse = new LoginResponse(type, false, errorDescription);
            res.status(code).json(loginResponse.toJson());
          } else {
            logger.debug('[API] [SESSION] Saved session');
            const loginResponse = new LoginResponse(type, confirmation, errorDescription);
            logger.debug('[API] [RESPONSE] ' + JSON.stringify(loginResponse.toJson()));
            res.status(code).json(loginResponse.toJson());
            logger.debug('[API] [SESSION] Set-Cookie header: ' + res.get('Set-Cookie'));
          }
        });
        return; // return to avoid sending the response twice
      } else {
        code = 401;
        errorDescription = 'Login failed';
      }
    } catch (error) {
      logger.error('Error in database.login: ' + error.message);
      errorDescription = 'Database error';
    }
  }

  // if the user is not logged in, send the error response
  if (!confirmation) {
    const loginResponse = new LoginResponse(type, confirmation, errorDescription);
    res.status(code).json(loginResponse.toJson());
  }
});


api.get(logout_path, isAuthenticated, (req, res) => {

  logger.debug('[API] [REQUEST] Logout request received ');

  req.session.destroy(error => {

    let type = logout_response_type;
    let code = 200;
    let errorDescription = '';
    let confirmation = true;

    if (error) {
      code = 500;
      errorDescription = 'Generic error';
      confirmation = false;
      logger.error('Error in session.destroy: ' + error);
    }

    const logoutResponse = new LogoutResponse(type, confirmation, errorDescription);
    logger.debug('[API] [RESPONSE] ' + JSON.stringify(logoutResponse.toJson()));
    return res.status(code).json(logoutResponse.toJson());
  });
});

api.get(session_path, isAuthenticated, (req, res) => {
  
  logger.debug('[API] [REQUEST] Session request received ');

  const type = session_response_type;
  let code = 500;
  let session_id = null;
  let errorDescription = 'Generic error';

  	
  if (req.session.user_id) {
    code = 200;
    errorDescription = '';
    session_id = req.sessionID;
  } 

  const sessionResponse = new SessionResponse(type, session_id, errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(sessionResponse.toJson()));
  return res.status(code).json(sessionResponse.toJson());

});

// Path: .../data
// Path: .../check

// return state of handle (available = true, unavailable = false)

api.get(handle_availability_path, async (req, res) => {

  const handle = req.query.handle;

  logger.debug('[API] [REQUEST] Check handle availability request received ');
  logger.debug('-> ' + JSON.stringify(req.query))

  const type = handle_availability_response_type;
  let code = 500;
  let confirmation = null;
  let errorDescription = 'Generic error';
  let validated = true;

  if (!(validator.generic(handle))) {
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
  }

  if (validated) {
    try {
      confirmation = await database.check_handle_availability(handle);

      if (confirmation != null) {
        code = 200;
        errorDescription = '';
      }
    } catch (error) {
      logger.error('Error in database.check_handle_availability: ' + error);
    }
  }

  const handleResponse = new HandleResponse(type, confirmation, errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(handleResponse.toJson()));
  return res.status(code).json(handleResponse.toJson());

});
// Path: .../get

api.get(init_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  logger.debug('[API] [REQUEST] Get init request received from: ' + user_id);

  const type = init_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let init_data = null;

  try {

    init_data = await database.client_init(user_id);

    if (init_data != null) {
      confirmation = true;
      code = 200;
      errorDescription = '';
    }

  } catch (error) {
    logger.error('database.client_init: ' + error);
  }

  const initResponse = new InitResponse(type, confirmation, errorDescription, init_data);
  logger.debug('[API] [RESPONSE] ' + type + ' ' + confirmation + ' ' + errorDescription);
  //logger.debug('[API] [RESPONSE] ' + JSON.stringify(initResponse.toJson()));  too big, i cry :(
  return res.status(code).json(initResponse.toJson());

});

api.get(update_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  logger.debug('[API] [REQUEST] Get update request received from: ' + user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const latest_update_datetime = req.query.latest_update_datetime;

  const type = update_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let update_data = null;

  let validated = true;

  if (!(validator.datetime(latest_update_datetime))) {
    code = 400;
    errorDescription = 'Latest update datetime not valid';
    validated = false;
  }

  if(validated){
    try {

      update_data = await database.client_update(latest_update_datetime,user_id);
  
      if (update_data != null) {
        confirmation = true;
        code = 200;
        errorDescription = '';
      }
  
    } catch (error) {
      logger.error('database.client_update: ' + error);
    }
  }

  const updateResponse = new UpdateResponse(type, confirmation, errorDescription, update_data);
  //logger.debug('[API] [RESPONSE] ' + type + ' ' + confirmation + ' ' + errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(updateResponse.toJson()));
  return res.status(code).json(updateResponse.toJson());

});

// Path: .../search

api.get(search_users_path, isAuthenticated,async (req, res) => {

  const handle = req.query.handle;

  logger.debug('[API] [REQUEST] Search (users) request received from: ' + req.session.user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const type = search_response_type;
  let code = 500;
  let searched_list = null;
  let errorDescription = 'Generic error';
  let validated = true;

  if (!(validator.generic(handle))) {
    code = 400;
    errorDescription = 'Search parameter (handle) not valid';
    validated = false;
  }

  if (validated) {
    try {
      searched_list = await database.search_users(handle); // a list of similar handles are returned (ONLY USERS)
      code = 200;
      errorDescription = '';
    } catch (error) {
      logger.error('Error in database.search_users: ' + error);
    }
  }

  const searchResponse = new SearchResponse(type, searched_list, errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(searchResponse.toJson()));
  return res.status(code).json(searchResponse.toJson());

});

api.get(search_all_path, isAuthenticated,async (req, res) => {

  const handle = req.query.handle;

  logger.debug('[API] [REQUEST] Search (all) request received from: ' + req.session.user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const type = search_response_type;
  let code = 500;
  let searched_list = null;
  let errorDescription = 'Generic error';
  let validated = true;

  if (!(validator.generic(handle))) {
    code = 400;
    errorDescription = 'Search parameter (handle) not valid';
    validated = false;
  }

  if (validated) {
    try {
      searched_list = await database.search(handle); // a list of similar handles are returned
      code = 200;
      errorDescription = '';
    } catch (error) {
      logger.error('Error in database.search: ' + error);
    }
  }

  const searchResponse = new SearchResponse(type, searched_list, errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(searchResponse.toJson()));
  return res.status(code).json(searchResponse.toJson());

});


// Path: /chat
// Path: .../send

api.get(message_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  const text = req.query.text;
  const chat_id = req.query.chat_id;

  logger.debug('[API] [REQUEST] Send message request received from: ' + user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const type = message_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;

  let message_data, recipient_list = null;

  if (!(validator.message(text))) {
    code = 400;
    errorDescription = 'Text message not valid (Too long [max 2056 char] or missing)';
    validated = false;
  }else if (!(validator.chat_id(chat_id))) {
    code = 400;
    errorDescription = 'Chat_id not valid';
    validated = false;
  }

  if (validated) {
    try {
      const message = new Message(chat_id, user_id, text)

      const response = await database.send_message(message);

      message_data = response.message_data;
      recipient_list = response.recipient_list;

      if (message_data != null && recipient_list != null) {
        confirmation = true;
        code = 200;
        errorDescription = '';
      }

    } catch (error) {
      logger.error('database.send_message: ' + error);
    }
  }

  const messageResponse = new MessageResponse(type, confirmation, errorDescription, message_data);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(messageResponse.toJson()));
  res.status(code).json(messageResponse.toJson());

  // Send messages to recipients after sending the response to sender
  if (message_data != null && recipient_list != null) {
    setImmediate(() => {
      io.send_messages_to_recipients(recipient_list, message_data);
    });
  }

  return;
});

// Path: .../create

api.get(chat_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  logger.debug('[API] [REQUEST] Create chat request received from: ' + user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const handle = await database.get_handle_from_id(user_id);
  const other_handle = req.query.handle;

  const type = chat_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;

  let chat_id = null;

  if (!(validator.generic(other_handle))) {
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
  } else if(await database.check_handle_availability(other_handle)){ // handle should exist
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
  } else if(handle == other_handle){
    code = 400;
    errorDescription = 'Handle not valid: You cannot create a chat with yourself';
    validated = false;
  } else if(await database.check_chat_existance(handle,other_handle)){
    code = 400;
    errorDescription = 'Chat already exists';
    validated = false;
  }

  if (validated) {
    try {
      const other_user_id = await database.get_user_id_from_handle(other_handle);

      if(other_user_id != null){
        try{
          const chat = new Chat(user_id, other_user_id);
          chat_id = await database.create_chat(chat);
          if (chat_id != null) {
            confirmation = true;
            code = 200;
            errorDescription = '';
          }
        }catch (error) {
          logger.error('database.create_chat: ' + error);
        }
      }
    } catch (error) {
      logger.error('database.get_user_id_from_handle: ' + error);
    }
  }

  const createChatResponse = new CreateChatResponse(type, confirmation, errorDescription, chat_id);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(createChatResponse.toJson()));
  return res.status(code).json(createChatResponse.toJson());

});

api.get(group_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  logger.debug('[API] [REQUEST] Create group request received from: ' + user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const name = req.query.name;
  let handle = req.query.handle;

  // optionals
  const description = req.query.description;
  const members_handles = req.query.members;
  // both can be empty

  // creator of the group is also an admin (and a member)
  const members = [user_id];
  const admins = [user_id];

  const type = group_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;

  let chat_id = null;

  if (!(validator.generic(name))) {
    code = 400;
    errorDescription = 'Name not valid';
    validated = false;
  }else if (validator.generic(handle)){  // skip if handle is not provided = group is private
    if(!(await validator.handle(handle))) {
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
    }
  }else{
    handle = null; // handle is not provided = group is private
  }

  if (validated) {  
    // get all members list from their handles
    if(members_handles != null){
      for (let i = 0; i < members_handles.length; i++) {
        try{
          const other_user_id = await database.get_user_id_from_handle(members_handles[i]);
          if (other_user_id != null) {
            members.push(other_user_id);
          }
        }catch (error) {
          logger.error('database.get_user_id_from_handle: ' + error);
        }
      }
    } 
    try {
      const group = new Group(handle,name, description, members, admins);
      chat_id = await database.create_group(group);
      if (chat_id != null) {
        confirmation = true;
        code = 200;
        errorDescription = '';
      }
    } catch (error) {
      logger.error('database.get_user_id_from_handle: ' + error);
    }
  }

  const createGroupResponse = new CreateGroupResponse(type, confirmation, errorDescription, chat_id);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(createGroupResponse.toJson()));
  res.status(code).json(createGroupResponse.toJson());


  // Send group to recipients after sending the response to sender
  if (chat_id != null) {
    const group_data = {
      chat_id: chat_id,
      name: name,
      description: description,
      members: members,
      admins: admins
    };

    setImmediate(() => {
      io.send_groups_to_recipients(members, group_data);
      logger.debug('[API] [IO] Group created and sent to members: ' + JSON.stringify(group_data));
    });
  }

  return;

});

// Path: .../get

api.get(members_path, isAuthenticated, async (req, res) => {

  logger.debug('[API] [REQUEST] Get members request received from: ' + req.session.user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const type = get_members_response_type;
  let code = 500;
  let members_list = null;
  let errorDescription = 'Generic error';
  let validated = true;

  const chat_id = req.query.chat_id;

  if (!(validator.chat_id(chat_id))) {
    code = 400;
    errorDescription = 'Chat_id not valid';
    validated = false;
  }

  if (validated) {
    try {
      members_list = await database.get_members_as_user_id(chat_id);
      code = 200;
      errorDescription = '';
    } catch (error) {
      logger.error('Error in database.get_members: ' + error);
    }
  }

  const membersResponse = new MembersResponse(type, members_list, errorDescription);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(membersResponse.toJson()));
  return res.status(code).json(membersResponse.toJson());

});


// Path: .../join

api.get(join_group_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id; // all public groups are visible to all users

  logger.debug('[API] [REQUEST] Join group request received from: ' + req.session.user_id);
  logger.debug('-> ' + JSON.stringify(req.query))

  const type = join_group_response_type;
  let code = 500;
  let errorDescription = 'Generic error';
  let confirmation = false;
  let validated = true;

  let group_name = null;

  let data = {};

  const handle = req.query.handle;
  let chat_id = null;
  let members = null; // get all members of the group

  if (!(validator.generic(handle))) {
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
  }else{
    try {

      chat_id = await database.get_chat_id_from_handle(handle);
      if (chat_id != null) {
        try {
          members = await database.get_members_as_user_id(chat_id);
        } catch (error) {
          logger.error('database.get_members_as_user_id: ' + error);
        }
      } else {
        code = 400;
        errorDescription = 'Handle not valid';
      }
    } catch (error) {
      logger.error('database.get_chat_id_from_handle: ' + error);
    }

    if(members == null) {
      code = 400;
      errorDescription = 'Handle not valid';
      validated = false;
    }else if (members.includes(user_id)) {
      code = 400;
      errorDescription = 'User already in group';
      validated = false;
    }
  }

  if (validated) {
    try{
      group_name = await database.get_group_name_from_chat_id(chat_id);

      try {
        confirmation = await database.add_members_to_group(chat_id, user_id);
        if (confirmation) {

          data.group_name = group_name;
          data.chat_id = chat_id;

          // Map each user_id to an object with both id and handle
          const members_handles = await Promise.all(members.map(async member_id => {
            return {
              user_id: member_id,
              handle: await database.get_handle_from_id(member_id)
            };
          }));
          
          // Add the current user to the members list
          members_handles.push({
            user_id: user_id,
            handle: await database.get_handle_from_id(user_id)
          });

          data.members = members_handles; // get all members of the group

          data.messages = await database.get_chat_messages(chat_id); // get all messages of the group

          code = 200;
          errorDescription = '';
        }
      } catch (error) {
        logger.error('database.add_member_to_group: ' + error);
      }

    } catch (error) {
      logger.error('database.get_group_name_from_chat_id: ' + error);
    }


  }

  
  const joinGroupResponse = new JoinGroupResponse(type, confirmation, errorDescription, data);
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(joinGroupResponse.toJson()));
  res.status(code).json(joinGroupResponse.toJson());

  // Send group to recipients after sending the response to sender
  if(validated && confirmation && chat_id != null) {
      const user_data = {
        chat_id: chat_id,
        user_id: user_id,
      };  

      setImmediate(() => {
        io.send_group_member_joined(members, user_data);
        logger.debug('[API] [IO] User joined and sent to members: ' + JSON.stringify(user_data));
        io.send_member_member_joined(user_id, data);
        logger.debug('[API] [IO] User joined and sent to member ' + user_id + ' : ' + JSON.stringify(data));
      });
  }

  return;
});



// POST METHODS

function postToGetWrapper(path) {
  api.post(path, (req, res) => {
    const queryParams = new URLSearchParams(req.body).toString();
    
    res.redirect(`${path}?${queryParams}`);
  });
}

// redirect every post request to a get request

postToGetWrapper(access_path);
postToGetWrapper(signup_path);
postToGetWrapper(login_path);
postToGetWrapper(logout_path);
postToGetWrapper(session_path);

postToGetWrapper(handle_availability_path);

postToGetWrapper(init_path);
postToGetWrapper(update_path);

postToGetWrapper(message_path);
//postToGetWrapper(voice_message_path);
//postToGetWrapper(file_path);

postToGetWrapper(chat_path);
postToGetWrapper(group_path);
//postToGetWrapper(channel_path);

postToGetWrapper(search_all_path);
postToGetWrapper(search_users_path);

postToGetWrapper(join_group_path);

// Middleware per gestire richieste a endpoints non esistenti
api.all('*', (req, res) => {
  logger.debug(`[API] [ERROR] Endpoint not found: ${req.method} ${req.originalUrl}`);
  
  const code = 404;
  const errorDescription = 'Not found';
  
  return res.status(code).json({
    error_message: errorDescription
  });
});

module.exports = api;