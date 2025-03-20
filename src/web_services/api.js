const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const api = express();
const logger = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');
const { AccessResponse, SignupResponse, SignupUser,LoginResponse,LoginUser,HandleResponse,UserIDResponse,SearchResponse} = require('../database/object');
 
api.use(express.json());

const envManager = require('../security/envManager');

// api path 

const version = '/v1/';
  const user_base = version + 'user/';

    const auth_base = user_base + 'auth/'

      const access_path = auth_base + 'access';
      const signup_path = auth_base + 'signup';
      const login_path = auth_base + 'login';

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

const handle_availability_response_type = 'handle_available';

const user_id_response_type = 'user_id';
const init_response_type = '';
const update_response_type = '';

const message_response_type = '';
const voice_message_response_type = '';
const file_response_type = '';

const chat_response_type = '';
const group_response_type = '';
const channel_response_type = '';

const search_response_type = 'searched_list';

// api configurations

api.use(cors({
  origin: '*', 
  methods: ['POST'], 
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));

const proxy_address = envManager.readProxyAddress();
api.set('trust proxy', 'loopback',proxy_address);

const rate_limiter_milliseconds = envManager.readRateLimiterMilliseconds();
const rate_limiter_number = envManager.readRateLimiterNumber();

  // api rate limiter

  const limiter = rateLimit({
    windowMs: rate_limiter_milliseconds,
    max: rate_limiter_number,
    handler: (req, res, next) => {
      logger.log(`[API] [ALERT] IP ${req.ip} has exceeded the rate limit on path: ${req.path}`);

      let type = "unknown";
      const errorDescription = "Too many requests, please try again later.";
      const code = 429;

      // response custom based on the path of the request 

      switch(req.path) {
        case access_path:
          type = access_response_type;
          break;
        case signup_path:
          type = signup_response_type;
          break;
        case login_path:
          type = login_response_type;
          break;
        case handle_availability_path:
          type = handle_availability_response_type;
          break;
        case user_id_path:
          type = user_id_response_type;
          break;
        case search_path:
          type = search_response_type;
          break;
        default:
          type = "unknown";
      }
      
      res.status(429).json({[type]:null,code:code,errorDescription:errorDescription});
    }
  });

api.use(limiter);

// Api methods

// Docs:
    // if the input items are not valid, returns 400
    // if there is an error, returns 500
    // all good, returns 200
    // This is valid for every methods in this class

// Path: /user
  // Path: .../auth

    // returns the access type of the user (login -> already registered, signup -> not registered)

    api.post(access_path, async (req, res) => {
      
      const email = req.query.email;

      logger.debug("[API] [REQUEST] Access request received -> email: " + email);

      const type = access_response_type;
      let code = 500;
      let confirmation = null;
      let errorDescription = "Generic error";
      let validated = true

      if(!(validator.email(email))){
        code = 400;
        errorDescription = "Email not valid";
        validated = false;
      }

      if(validated){
        try{
          if(await database.check_email_existence(email)){
            confirmation = "login";
          }else{
            confirmation = "signup";
          }
          errorDescription = "";
          code = 200;
        }catch(err){ 
          logger.error("Error in database.check_email_existence: " + err);
        }
      }

      const accessResponse = new AccessResponse(type, confirmation, code, errorDescription);
      logger.debug("[API] [RESPONSE] "+ JSON.stringify(accessResponse.toJson()));
      return res.json(accessResponse.toJson());
    });

    // returns the status of signup request (true = signed_up successfully, false = error [see error code/description])

    api.post(signup_path, async (req, res) => {
      
      const email = req.query.email;
      const name = req.query.name;
      const surname = req.query.surname;
      const handle = req.query.handle;
      const password = req.query.password;

      logger.debug("[API] [REQUEST] Signup request received -> email: " + email + " name: " + name + " surname: " + surname + " handle: " + handle + " password: " + password);

      const type = signup_response_type;
      let code = 500;
      let confirmation = null;
      let errorDescription = "Generic error";
      let validated = true;

      // check if every parameter is valid
      if(!(validator.email(email))){
        code = 400;
        errorDescription = "Email not valid";
        validated = false;
      }

      if(!(validator.name(name))){
        code = 400;
        errorDescription = "Name not valid";
        validated = false;
      }

      if(!(validator.surname(surname))){
        code = 400;
        errorDescription = "Surname not valid";
        validated = false;
      }
      
      if(!(await validator.handle(handle))){
        code = 400;
        errorDescription = "Handle not valid";
        validated = false;
      }

      if(!(validator.password(password))){
        code = 400;
        errorDescription = "Password not valid";
        validated = false;
      }


      // only if everything is valid, try to sign up 
      if(validated){
        const signupUser = new SignupUser(email, name, surname, handle, password);
        try{
          confirmation = await database.add_user_to_db(signupUser)
          if(confirmation){
            code = 200;
            errorDescription = "";
          }else{
            code = 500;
          }
        }catch(err){ 
          logger.error("Error in database.add_user_to_db: "+ err); 
        }
      }

      const signupResponse = new SignupResponse(type, confirmation, code, errorDescription);
      logger.debug("[API] [RESPONSE] "+ JSON.stringify(signupResponse.toJson()));
      return res.json(signupResponse.toJson());

    });

    // returns the api_key of the requested user if logged_in is true (true = logged_in successfully, false = error [see error code/description])
    // if password is wrong return code 401 (Unauthorized)

    api.post(login_path, async (req, res) => {

      const email = req.query.email;  
      const password = req.query.password;

      logger.debug("[API] [REQUEST] Login request received -> email: " + email + " password: " + password);

      const type = login_response_type;
      let code = 500;
      let confirmation = false;
      let errorDescription = "Generic error";
      let validated = true;

      let api_key = null;

      if(!(validator.email(email))){
        code = 400;
        errorDescription = "Email not valid";
        validated = false;
      }

      if(!(validator.generic(password))){
        code = 400;
        errorDescription = "Password not valid";
        validated = false;
      }

      if(validated){
        const loginUser = new LoginUser(email, password);
        try{
          api_key = await database.login(loginUser);
          if(api_key != null){
            confirmation = true;
            errorDescription = "";
            code = 200;
          }else{
            code = 401;
            errorDescription = "Login failed";
          }
        }catch(err){
          logger.error("Error in database.login");
        }
      }

      const loginResponse = new LoginResponse(type, confirmation,api_key, code, errorDescription);
      logger.debug("[API] [RESPONSE] "+ JSON.stringify(loginResponse.toJson()));
      return res.json(loginResponse.toJson());

    });

  // Path: .../data
    // Path: .../check

      // return state of handle (available = true, unavailable = false)

      api.post(handle_availability_path, async (req, res) => {

        const handle = req.query.handle;

        logger.debug("[API] [REQUEST] Check handle availability request received -> handle: " + handle);

        const type = handle_availability_response_type;
        let code = 500;
        let confirmation = null;
        let errorDescription = "Generic error";
        let validated = true;

        if(!(validator.generic(handle))){
          code = 400;
          errorDescription = "Handle not valid";
          validated = false;
        }

        if(validated){
          try{
            confirmation = await database.check_handle_availability(handle);

            if(confirmation != null){
              code = 200;
              errorDescription = "";
            }
          }catch(err){
            logger.error("Error in database.check_handle_availability");
          }
        }

        const handleResponse = new HandleResponse(type, confirmation, code, errorDescription);
        logger.debug("[API] [RESPONSE] "+ JSON.stringify(handleResponse.toJson()));
        return res.json(handleResponse.toJson());

      });
    // Path: .../get
      api.post(user_id_path, async (req, res) => {

        const api_key = req.query.api_key;

        logger.debug("[API] [REQUEST] Get user id request received -> api_key: " + api_key);

        const type = user_id_response_type;
        let code = 500;
        let confirmation = null;
        let errorDescription = "Generic error";
        let validated = true;

        if(!(validator.api_key(api_key))){
          code = 400;
          errorDescription = "Api_key not valid";
          validated = false;
        }

        if(validated){
          try{
            confirmation = await database.get_user_id(api_key); // user_id if exists, null otherwise
            code = 200;
            errorDescription = "";
          }catch(err){
            logger.error("Error in database.get_user_id");
          }
        }

        const userIDResponse = new UserIDResponse(type, confirmation, code, errorDescription);
        logger.debug("[API] [RESPONSE] "+ JSON.stringify(userIDResponse.toJson()));
        return res.json(userIDResponse.toJson());

      });

    api.post(search_path, async (req, res) => {

      const api_key = req.query.api_key;
      const handle = req.query.handle;

      logger.debug("[API] [REQUEST] Search request received -> handle: " + handle + " api_key: " + api_key);

      const type = search_response_type;
      let code = 500;
      let searched_list = null;
      let errorDescription = "Generic error";
      let validated = true;

      if(!(validator.api_key(api_key))){
        code = 400;
        errorDescription = "Api_key not valid";
        validated = false;
      }

      if(!(validator.generic(handle))){
        code = 400;
        errorDescription = "Search parameter (handle) not valid";
        validated = false;
      }

      if(validated){
        try{
          searched_list = await database.search(handle); // a list of similar handles are returned
          code = 200;
          errorDescription = "";
        }catch(err){
          logger.error("Error in database.search");
        }
      }

      const searchResponse = new SearchResponse(type, searched_list, code, errorDescription);
      logger.debug("[API] [RESPONSE] "+ JSON.stringify(searchResponse.toJson()));
      return res.json(searchResponse.toJson());

    });


module.exports = api;