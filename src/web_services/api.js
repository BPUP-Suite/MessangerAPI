const express = require('express');
const rateLimit = require('express-rate-limit');
const favicon = require('serve-favicon')

const cors = require('cors');

const api = express();
const logger = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');

const { AccessResponse, SignupResponse, SignupUser, LoginResponse, LoginUser, LogoutResponse, HandleResponse, UserIDResponse, SearchResponse, InitResponse, Message, MessageResponse } = require('../database/object');

const { send_messages_to_recipients } = require('./socketio');

api.use(express.json());

const envManager = require('../security/envManager');
const sessionMiddleware = require('../security/sessionMiddleware');

// api path 

const version = '/v1/';
const user_base = version + 'user/';

const auth_base = user_base + 'auth/'

const access_path = auth_base + 'access';
const signup_path = auth_base + 'signup';
const login_path = auth_base + 'login';
const logout_path = auth_base + 'logout';

const data_base = user_base + 'data/';

const check_base = data_base + 'check/';

const handle_availability_path = check_base + 'handle-availability';

const get_base = data_base + 'get/'

const user_id_path = get_base + 'user-id'
const init_path = get_base + 'init'
const update_path = get_base + 'update'

const send_base = data_base + 'send/';

const message_path = send_base + 'message';
const voice_message_path = send_base + 'message';
const file_path = send_base + 'file';

const create_base = data_base + 'create/';

const chat_path = create_base + 'chat';
const group_path = create_base + 'group';
const channel_path = create_base + 'channel';

const search_path = data_base + 'search';

// api response type

const access_response_type = 'access_type';
const signup_response_type = 'signed_up';
const login_response_type = 'logged_in';
const logout_response_type = 'logged_out';

const handle_availability_response_type = 'handle_available';

const user_id_response_type = 'user_id';
const init_response_type = 'init';
const update_response_type = '';

const message_response_type = 'message_sent';
const voice_message_response_type = '';
const file_response_type = '';

const chat_response_type = '';
const group_response_type = '';
const channel_response_type = '';

const search_response_type = 'searched_list';

// api configurations

// Remove favicon error

api.get('/favicon.ico', (req, res) => res.status(200))

// Sessions configuration

api.use(sessionMiddleware);

// CORS Rules

const API_DOMAIN = envManager.readAPIDomain();
const IO_DOMAIN = envManager.readIODomain();

logger.debug(`API_DOMAIN: ${API_DOMAIN}`);
logger.debug(`IO_DOMAIN: ${IO_DOMAIN}`);

api.use(cors({
  origin: [API_DOMAIN, IO_DOMAIN],
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


// Auth based on session

function isAuthenticated(req, res, next) {
  logger.debug('[API] [AUTH] Checking if user is authenticated: ' + req.session.user_id);
  if (req.session.user_id) {
    next();
  } else {
    const code = 401;
    const errorDescription = 'Non authorized';

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
  }

  if (!(validator.name(name))) {
    code = 400;
    errorDescription = 'Name not valid';
    validated = false;
  }

  if (!(validator.surname(surname))) {
    code = 400;
    errorDescription = 'Surname not valid';
    validated = false;
  }

  if (!(await validator.handle(handle))) {
    code = 400;
    errorDescription = 'Handle not valid';
    validated = false;
  }

  if (!(validator.password(password))) {
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
  }

  if (!validator.generic(password)) {
    code = 400;
    errorDescription = 'Password not valid';
    validated = false;
  }

  if (validated) {
    const loginUser = new LoginUser(email, password);
    try {
      user_id = await database.login(loginUser);
      if (user_id != null) {
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

// DA MODIFICARE
api.get(logout_path, isAuthenticated, (req, res) => {
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
  logger.debug('[API] [RESPONSE] ' + JSON.stringify(initResponse.toJson()));
  return res.status(code).json(initResponse.toJson());

});

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
  }

  if (!(validator.chat_id(chat_id))) {
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
      send_messages_to_recipients(recipient_list, message_data);
    });
  }

  return;
});


api.get(search_path, isAuthenticated,async (req, res) => {

  const handle = req.query.handle;

  logger.debug('[API] [REQUEST] Search request received from: ' + req.session.user_id);
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

// POST methods



module.exports = api;