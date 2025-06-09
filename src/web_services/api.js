const express = require('express');
const rateLimit = require('express-rate-limit');

const cors = require('cors');

const api = express();
const { api_log:log, api_debug:debug, api_warn:warn, api_error:error, api_info:info } = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');

const { AccessResponse, SignupResponse, SignupUser, LoginResponse, LoginUser, LogoutResponse,SessionResponse, HandleResponse, SearchResponse, InitResponse, Message, MessageResponse,CreateChatResponse,Chat,CreateGroupResponse,Group,MembersResponse, UpdateResponse,JoinGroupResponse,JoinCommsResponse,LeaveCommsResponse,StartScreenShareResponse,StopScreenShareResponse} = require('../database/object');

const io = require('./socketio');

api.use(express.json());
api.use(express.urlencoded({ extended: true }));

const envManager = require('../security/envManager');
const { sessionMiddleware, trackSessionCreationMiddleware, destroySession, enforceSessionLimit, verifySession } = require('../security/sessionMiddleware');

// api path 

const version = '/' + envManager.readVersion() + '/';

info('EXPRESS','API base path: '+version, null);

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

// /comms
const comms_base = version + 'comms/';

const join_comms_path = comms_base + 'join';
const leave_comms_path = comms_base + 'leave';

const start_screen_share_path = comms_base + 'screen_share/start';
const stop_screen_share_path = comms_base + 'screen_share/stop';

const comms_get_base = comms_base + 'get/';
const comms_members_path = comms_get_base + 'members';

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

const join_comms_response_type = 'comms_joined';
const leave_comms_response_type = 'comms_left';

const start_screen_share_response_type = 'screen_share_started';
const stop_screen_share_response_type = 'screen_share_stopped';

const comms_members_response_type = 'comms_members_list';

// api configurations

// Sessions configuration

api.use(sessionMiddleware);
api.use(trackSessionCreationMiddleware);

// CORS Rules

let WEB_DOMAIN = envManager.readDomain();

if (WEB_DOMAIN == 'localhost') {
  WEB_DOMAIN = 'http://localhost:' + envManager.readAPIPort();
  warn('CORS','Running on localhost, CORS will be set to localhost',WEB_DOMAIN);
} else {
  WEB_DOMAIN = 'https://web.' + WEB_DOMAIN;
  info('CORS',`Running on domain, CORS will be set to ${WEB_DOMAIN}`,WEB_DOMAIN);
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

    const errorDescription = 'Too many requests, please try again later.';
    const code = 429;

    const jsonResponse = { error_message: errorDescription };

    res.status(code).json(jsonResponse);

    log(req.path,'ALERT',`IP ${req.ip} has exceeded the rate limit!`,code,JSON.stringify(jsonResponse));

    next(new Error(errorDescription));
  }
});

api.use(limiter);


// Metrics

const {metricsDurationMiddleware,apiCallMiddleware} = require('../dashboard/metrics');

api.use(metricsDurationMiddleware);
api.use(apiCallMiddleware);

// Documentation on Scalar
const scalarRouter = require('./scalar/api-scalar');

api.use('/'+envManager.readVersion()+'/docs', scalarRouter);

// Favicon.ico request
// This is a workaround to avoid the favicon.ico request to be logged in the console

api.all('/favicon.ico', (req, res) => {
  res.status(204).end();
});


// Api methods

// GET METHODS

// Auth based on session

async function isAuthenticated(req, res, next) {
  if (await verifySession(req.sessionID)) {
    debug('',req.path,'AUTH', 'User is authenticated!', 200, req.session.user_id);
    next();
  } else {
    const code = 401;
    const errorDescription = 'Unauthorized';

    const jsonResponse = { errorMessage: errorDescription }

    res.status(code).json(jsonResponse);

    error(req.path,'AUTH','User unauthorized',code,JSON.stringify(jsonResponse));
  }
}

// Path: /user
// Path: .../auth

// returns the access type of the user (login -> already registered, signup -> not registered)

api.get(access_path, async (req, res) => {

  const email = req.query.email;

  const start = res.locals.start;
  debug('',req.path,'REQUEST','','',JSON.stringify(req.query));

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
    } catch (err) {
      error(req.path,'DATABASE','database.check_email_existence',code,err);
    }
  }

  const accessResponse = new AccessResponse(type, confirmation, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE','',code,JSON.stringify(accessResponse.toJson()));
  return res.status(code).json(accessResponse.toJson());
});

// returns the status of signup request (true = signed_up successfully, false = error [see error code/description])

api.get(signup_path, async (req, res) => {

  const email = req.query.email;
  const name = req.query.name;
  const surname = req.query.surname;
  const handle = req.query.handle;
  const password = req.query.password;

  const sanitizedQuery = { ...req.query };
  if (sanitizedQuery.password) {
    sanitizedQuery.password = '*'.repeat(sanitizedQuery.password.length);
  }

  const start = res.locals.start;
  debug('',req.path,'REQUEST','','',JSON.stringify(sanitizedQuery));

  const type = signup_response_type;
  let code = 500;
  let confirmation = false;
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
  }else if (!(validator.generic(handle))) {
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
  } else if(!(await database.check_handle_availability(handle))){ // handle should not exist
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
    } catch (err) {
      error(req.path,'DATABASE','database.add_user_to_db',code,err);
    }
  }

  const signupResponse = new SignupResponse(type, confirmation, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE','',code,JSON.stringify(signupResponse.toJson()));
  return res.status(code).json(signupResponse.toJson());

});

api.get(login_path, async (req, res) => {
  const email = req.query.email;
  const password = req.query.password;

  const sanitizedQuery = { ...req.query };
  if (sanitizedQuery.password) {
    sanitizedQuery.password = '*'.repeat(sanitizedQuery.password.length);
  }

  const start = res.locals.start;
  debug('',req.path,'REQUEST','','',JSON.stringify(sanitizedQuery));

  const type = login_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;
  let user_id = null;
  let token = null; 

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

        debug('',req.path,'SESSION','Session opened.',code,user_id)
        req.session.user_id = user_id;
        debug('',req.path,'SESSION','Session set.',code,user_id)

        req.session.save(async (err) => {
          if (req.session.user_id && !err) {
            debug('',req.path,'SESSION','Session saved.',code,user_id)
            await enforceSessionLimit(req, res);
            token = req.sessionID;
            const loginResponse = new LoginResponse(type, confirmation, errorDescription,token);
            debug(Date.now() - start,req.path,'RESPONSE','',code,JSON.stringify(loginResponse.toJson()));
            res.status(code).json(loginResponse.toJson());
          } else {
            error(req.path,'SESSION','Error while saving session',code,err.message);
            await destroySession(req, res); // destroy session in redis and in the cookie
            code = 500;
            errorDescription = 'Failed to save session';
            const loginResponse = new LoginResponse(type, false, errorDescription,token);
            res.status(code).json(loginResponse.toJson());
          }
        });
        return;
      } else {
        code = 401;
        errorDescription = 'Login failed';
      }
    } catch (err) {
      error(req.path,'DATABASE','database.login',code,err);
      errorDescription = 'Database error';
    }
  }

  // if the user is not logged in, send the error response
  const loginResponse = new LoginResponse(type, confirmation, errorDescription,token);
  debug(Date.now() - start,req.path,'RESPONSE','',code,JSON.stringify(loginResponse.toJson()));
  return res.status(code).json(loginResponse.toJson());
});


api.get(logout_path, isAuthenticated, async (req, res) => {

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

  let user_id = null;

  let type = logout_response_type;
  let confirmation = false;
  let code = 500;
  let errorDescription = 'Generic error';

  if (req.session.user_id) {
    user_id = req.session.user_id;

    try{
      const session_id = req.session.id;
      const socket_id = io.get_socket_id(session_id); // get the socket id from the activeSessions map using the session_id

      io.close_socket(socket_id); // close socket connection
      confirmation = await destroySession(req, res); // destroy session in redis and in the cookie


      if (confirmation) {
        code = 200;
        errorDescription = '';
      }
    }catch (err) {
      error(req.path,'SESSION','session.destroy',code,err);
    }
  } 

    const logoutResponse = new LogoutResponse(type, confirmation, errorDescription);
    debug(Date.now() - start,req.path,'RESPONSE',user_id,code,JSON.stringify(logoutResponse.toJson()));
    return res.status(code).json(logoutResponse.toJson());

});

api.get(session_path, isAuthenticated, (req, res) => { // DEPRECATED
  
  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

  const type = session_response_type;
  let code = 500;
  let session_id = null;
  let errorDescription = 'Generic error';
  let user_id = null;

  	
  if (req.session.user_id) {
    code = 200;
    errorDescription = '';
    session_id = req.sessionID;
    user_id = req.session.user_id;
  } 

  const sessionResponse = new SessionResponse(type, session_id, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',user_id,code,JSON.stringify(sessionResponse.toJson()));
  return res.status(code).json(sessionResponse.toJson());

});                                               // DEPRECATED

// Path: .../data
// Path: .../check

// return state of handle (available = true, unavailable = false)

api.get(handle_availability_path, async (req, res) => {

  const handle = req.query.handle;

  const start = res.locals.start;
  debug('',req.path,'REQUEST','','',JSON.stringify(req.query));

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
    } catch (err) {
      error(req.path,'DATABASE','database.check_handle_availability',code,err);
    }
  }

  const handleResponse = new HandleResponse(type, confirmation, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE','',code,JSON.stringify(handleResponse.toJson()));
  return res.status(code).json(handleResponse.toJson());

});
// Path: .../get

api.get(init_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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

      const date = new Date();
      init_data = {
        ...init_data,
        date: date
      };

    }

  } catch (err) {
    error(req.path,'DATABASE','database.client_init',code,err);
  }

  const initResponse = new InitResponse(type, confirmation, errorDescription, init_data);
  debug(Date.now() - start,req.path, 'RESPONSE', req.session.user_id, code, JSON.stringify(initResponse.toJson()).substring(0, 200) + "...");
  return res.status(code).json(initResponse.toJson());

});

api.get(update_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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
  
    } catch (err) {
      error(req.path,'DATABASE','database.client_update',code,err);
    }
  }

  const updateResponse = new UpdateResponse(type, confirmation, errorDescription, update_data);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(updateResponse.toJson()));
  return res.status(code).json(updateResponse.toJson());

});

// Path: .../search

api.get(search_users_path, isAuthenticated,async (req, res) => {

  const handle = req.query.handle;

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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
    } catch (err) {
      error(req.path,'DATABASE','database.search_users',code,err);
    }
  }

  const searchResponse = new SearchResponse(type, searched_list, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(searchResponse.toJson()));
  return res.status(code).json(searchResponse.toJson());

});

api.get(search_all_path, isAuthenticated,async (req, res) => {

  const handle = req.query.handle;

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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
    } catch (err) {
      error(req.path,'DATABASE','database.search',code,err);
    }
  }

  const searchResponse = new SearchResponse(type, searched_list, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(searchResponse.toJson()));
  return res.status(code).json(searchResponse.toJson());

});


// Path: /chat
// Path: .../send

api.get(message_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  const text = req.query.text;
  const chat_id = req.query.chat_id;

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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

    } catch (err) {
      error(req.path,'DATABASE','database.send_message',code,err);
    }
  }

  const messageResponse = new MessageResponse(type, confirmation, errorDescription, message_data);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(messageResponse.toJson()));
  res.status(code).json(messageResponse.toJson());

  // Send messages to recipients after sending the response to sender
  if (message_data != null && recipient_list != null) {
    const sender_socket_id = io.get_socket_id(req.session.id); 
    setImmediate(() => {
      io.send_messages_to_recipients(recipient_list, message_data,sender_socket_id);
    });
  }

  return;
});

// Path: .../create

api.get(chat_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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
        }catch (err) {
          error(req.path,'DATABASE','database.create_chat',code,err);
        }
      }
    } catch (err) {
      error(req.path,'DATABASE','database.get_user_id_from_handle',code,err);
    
    }
  }

  const createChatResponse = new CreateChatResponse(type, confirmation, errorDescription, chat_id);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(createChatResponse.toJson()));
  return res.status(code).json(createChatResponse.toJson());

});

api.get(group_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id;

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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
  let date = null;

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
        }catch (err) {
          error(req.path,'DATABASE','database.get_user_id_from_handle',code,err);
        }
      }
    } 
    try {
      const group = new Group(handle,name, description, members, admins);
      const result = await database.create_group(group);
      chat_id = result.chat_id;
      date = result.date;
      if (chat_id != null && date != null) {
        confirmation = true;
        code = 200;
        errorDescription = '';
      }
    } catch (err) {
      error(req.path,'DATABASE','database.create_group',code,err);
    }
  }

  const createGroupResponse = new CreateGroupResponse(type, confirmation, errorDescription, chat_id);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(createGroupResponse.toJson()));
  res.status(code).json(createGroupResponse.toJson());


  // Send group to recipients after sending the response to sender
  if (chat_id != null && date != null) {
    const group_data = {
      chat_id: chat_id,
      name: name,
      description: description,
      members: members,
      admins: admins,
      date: date
    };

    setImmediate(() => {
      const sender_socket_id = io.get_socket_id(req.session.id); 
      io.send_groups_to_recipients(members, group_data,sender_socket_id);
    });
  }

  return;

});

// Path: .../get

api.get(members_path, isAuthenticated, async (req, res) => {

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

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
    } catch (err) {
      error(req.path,'DATABASE','database.get_members',code,err);
    }
  }

  const membersResponse = new MembersResponse(type, members_list, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(membersResponse.toJson()));
  return res.status(code).json(membersResponse.toJson());

});


// Path: .../join

api.get(join_group_path, isAuthenticated, async (req, res) => {

  const user_id = req.session.user_id; // all public groups are visible to all users

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

  const type = join_group_response_type;
  let code = 500;
  let errorDescription = 'Generic error';
  let confirmation = false;
  let validated = true;

  let group_name = null;

  let data = {};
  let date = null;

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
        } catch (err) {
          error(req.path,'DATABASE','database.get_members_as_user_id',code,err);
        }
      } else {
        code = 400;
        errorDescription = 'Handle not valid';
      }
    } catch (err) {
      error(req.path,'DATABASE','database.get_chat_id_from_handle',code,err);
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
        const result = await database.add_members_to_group(chat_id, user_id);
        confirmation = result.confirmation;
        date = result.date;
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
      } catch (err) {
        error(req.path,'DATABASE','database.add_member_to_group',code,err);      
      }

    } catch (err) {
      error(req.path,'DATABASE','database.get_group_name_from_chat_id',code,err);
    }


  }

  
  const joinGroupResponse = new JoinGroupResponse(type, confirmation, errorDescription, data);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(joinGroupResponse.toJson()));
  res.status(code).json(joinGroupResponse.toJson());

  // Send group to recipients after sending the response to sender
  if(validated && confirmation && chat_id != null) {
      const user_data = {
        chat_id: chat_id,
        handle: handle,
        date: date
      };  

      data = {
        ...data,
        date: date
      };

      setImmediate(() => {
        const sender_socket_id = io.get_socket_id(req.session.id); 
        io.send_group_member_joined(members, user_data, sender_socket_id);
        io.send_member_member_joined(user_id, data, sender_socket_id);
      });
  }

  return;
});

// Path: /comms

api.get(join_comms_path, isAuthenticated, async (req, res) => {

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

  const type = join_comms_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;
  let comms_id = Math.random().toString(36).substring(2, 15); // generate a random id for the comms

  const chat_id = req.query.chat_id;

  if (!(validator.chat_id(chat_id))) {
    code = 400;
    errorDescription = 'Chat_id not valid';
    validated = false;
  }else if (!(await database.is_member(req.session.user_id,chat_id))){
    code = 400;
    errorDescription = 'No access to request chat';
    validated = false;
  }

  if (validated) {
    try {

      const socket_id = io.get_socket_id(req.session.id);

      if(socket_id != null){

        confirmation = io.join_comms(socket_id, chat_id, comms_id); // join the socket to the room

        if(confirmation) {
          code = 200;
          errorDescription = '';
        }else{
          comms_id = null;
          code = 200;
          errorDescription = 'User already in a comms';
        }
      }else{
        comms_id = null;
        code = 200;
        errorDescription = 'No opened socket.io found.';
        confirmation = false;
      }
    } catch (err) {
      comms_id = null;
      error(req.path,'IO','io.join_comms',code,err);
    }
  }

  const joinCommsResponse = new JoinCommsResponse(type, confirmation, comms_id, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(joinCommsResponse.toJson()));
  res.status(code).json(joinCommsResponse.toJson());

  if(confirmation){

    let recipient_list = null;
    let from_handle = null;

    try{
      recipient_list = await database.get_members_as_user_id(chat_id);
    }catch (err) {  
      error(req.path,'DATABASE','database.get_members_as_user_id',code,err);
    }
    try{
      from_handle = await database.get_handle_from_id(req.session.user_id); // handle of the sender
    }catch (err) {
      error(req.path,'DATABASE','database.get_handle_from_id',code,err);
    }

    if(recipient_list != null || from_handle != null) {
      const join_data = {
        chat_id: chat_id,
        handle: from_handle,
        from: comms_id
      };
     const from_socket_id = io.get_socket_id(req.session.id); 
     io.send_joined_member_to_comms(recipient_list,join_data,from_socket_id);
    }
  }
});

api.get(leave_comms_path, isAuthenticated, async (req, res) => {
  
  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

  const type = leave_comms_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;

  let chat_id = null;
  let comms_id = null;

  if (validated) {
    try {

      const socket_id = io.get_socket_id(req.session.id);

      if(socket_id != null) {
        
        [chat_id,comms_id] = io.leave_comms(socket_id); // leave room

        if(chat_id && comms_id) {
          confirmation = true;
          code = 200;
          errorDescription = '';
        }else{
          confirmation = false;
          code = 200;
          errorDescription = 'User is not in a comms';
        }
      }else{
        code = 200;
        errorDescription = 'No opened socket.io found.';
        confirmation = false;
      }

    } catch (err) {
      error(req.path,'IO','io.leave_comms',code,err);
    }
  }

  const leaveCommsResponse = new LeaveCommsResponse(type, confirmation, chat_id, comms_id, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(leaveCommsResponse.toJson()));
  res.status(code).json(leaveCommsResponse.toJson());

  if(confirmation){

    let recipient_list = null;

    try{
      recipient_list = await database.get_members_as_user_id(chat_id);
    }catch (err) {
      error(req.path,'DATABASE','database.get_members_as_user_id',code,err);
    }

    if(recipient_list != null  || from != null) {
      const left_data = {
        chat_id: chat_id,
        from: comms_id
      };
     
     const from_socket_id = io.get_socket_id(req.session.id); 
     io.send_left_member_to_comms(recipient_list,left_data,from_socket_id);
    }
  }
});

api.get(comms_members_path, isAuthenticated, async (req, res) => {

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));

  const type = comms_members_response_type;
  let code = 500;
  let errorDescription = 'Generic error';
  let validated = true;

  const chat_id = req.query.chat_id;
  
  let members_data = [];

  if (!(validator.chat_id(chat_id))) {
    code = 400;
    errorDescription = 'Chat_id not valid';
    validated = false;
  }else if (!(await database.is_member(req.session.user_id,chat_id))){
    code = 400;
    errorDescription = 'No access to request chat';
    validated = false;
  }

  if (validated) {
    try {
      const [members_ids,comms_ids,is_speaking,active_screen_shares] = await io.get_users_info_room(chat_id);
      
      for (let i = 0; i < members_ids.length; i++) {
        try{
          const handle = await database.get_handle_from_id(members_ids[i]);
          const comms_id = comms_ids[i];

          members_data.push({
            handle: handle,
            from: comms_id,
            is_speaking: is_speaking[i],
            active_screen_share: active_screen_shares[i]
          });

        }catch (err) {
          error(req.path,'DATABASE','database.get_handle_from_id',code,err);
        }
      }
        
      code = 200;
      errorDescription = '';
    } catch (err) {
      error(req.path,'IO','io.get_user_id_room',code,err);
    }
  }

  const membersResponse = new MembersResponse(type, members_data, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(membersResponse.toJson()));
  return res.status(code).json(membersResponse.toJson());

});

api.get(start_screen_share_path, isAuthenticated, async (req, res) => {

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));
  const type = start_screen_share_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;   

  const chat_id = req.query.chat_id;
  let comms_id = null;

  if (!(validator.chat_id(chat_id))) {
    code = 400;
    errorDescription = 'Chat_id not valid';
    validated = false;
  }else if (!(await database.is_member(req.session.user_id,chat_id))){
    code = 400;
    errorDescription = 'No access to request chat';
    validated = false;
  }
  if (validated) {
    try {
      const socket_id = io.get_socket_id(req.session.id);

      if(socket_id != null) {
        const recipient_list = await database.get_members_as_user_id(chat_id);
        const screen_share_uuid = io.start_screen_share(socket_id, chat_id,recipient_list); // start screen share

        if(screen_share_uuid !== null) {
          confirmation = true;
          code = 200;
          errorDescription = '';
        }else{
          code = 200;
          errorDescription = 'User already started a screen share';
        }
      }else{
        code = 200;
        errorDescription = 'No opened socket.io found.';
      }
    } catch (err) {
      error(req.path,'IO','io.start_screen_share',code,err);
    }
  }
  const startScreenShareResponse = new StartScreenShareResponse(type, confirmation, screen_share_uuid, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(startScreenShareResponse.toJson()));
  res.status(code).json(startScreenShareResponse.toJson());
});

api.get(stop_screen_share_path, isAuthenticated, async (req, res) => {

  const start = res.locals.start;
  debug('',req.path,'REQUEST',req.session.user_id,'',JSON.stringify(req.query));
  const type = stop_screen_share_response_type;
  let code = 500;
  let confirmation = false;
  let errorDescription = 'Generic error';
  let validated = true;
  const chat_id = req.query.chat_id;
  let screen_share_uuid = req.query.screen_share_uuid;

  if (!(validator.chat_id(chat_id))) {
    code = 400;
    errorDescription = 'Chat_id not valid';
    validated = false;
  }else if (!(await database.is_member(req.session.user_id,chat_id))){
    code = 400;
    errorDescription = 'No access to request chat';
    validated = false;
  }
  if (!(validator.generic(screen_share_uuid))) {
    code = 400;
    errorDescription = 'Screen share id not valid';
    validated = false;
  }
  if (validated) {
    try {
      const socket_id = io.get_socket_id(req.session.id);

      if(socket_id != null) {
        const recipient_list = await database.get_members_as_user_id(chat_id);
        confirmation = io.stop_screen_share(socket_id, chat_id, screen_share_uuid,recipient_list); // stop screen share

        if(confirmation) {
          code = 200;
          errorDescription = '';
        }else{
          code = 200;
          errorDescription = 'User is not sharing the screen';
        }
      }else{
        code = 200;
        errorDescription = 'No opened socket.io found.';
      }
    } catch (err) {
      error(req.path,'IO','io.stop_screen_share',code,err);
    }
  }
  const stopScreenShareResponse = new StopScreenShareResponse(type, confirmation, screen_share_uuid, errorDescription);
  debug(Date.now() - start,req.path,'RESPONSE',req.session.user_id,code,JSON.stringify(stopScreenShareResponse.toJson()));
  res.status(code).json(stopScreenShareResponse.toJson());

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

postToGetWrapper(join_comms_path);
postToGetWrapper(leave_comms_path);

postToGetWrapper(start_screen_share_path);
postToGetWrapper(stop_screen_share_path);

postToGetWrapper(comms_members_path);

// Middleware per gestire richieste a endpoints non esistenti
api.all('*', (req, res) => {
    
  const code = 404;
  const errorDescription = 'Not found';

  const jsonResponse = {error_message: errorDescription};

  res.status(code).json(jsonResponse);

  error(req.path,'RESPONSE',`Endpoint not found: ${req.method} ${req.originalUrl}`,code,JSON.stringify(jsonResponse));
});

module.exports = api;