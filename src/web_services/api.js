const express = require('express');
const rateLimit = require('express-rate-limit');

const api = express();
const logger = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');
const { AccessResponse , SignupResponse, SignupUser,LoginResponse,LoginUser,HandleResponse,UserIDResponse} = require('../database/object');
 
api.use(express.json());

const envManager = require('../security/envManager');

// api configurations

const proxy_address = envManager.readProxyAddress();
api.set('trust proxy', 'loopback',proxy_address);

const rate_limiter_milliseconds = envManager.readRateLimiterMilliseconds();
const rate_limiter_number = envManager.readRateLimiterNumber();

const limiter = rateLimit({
  windowMs: rate_limiter_milliseconds,
  max: rate_limiter_number,
  handler: (req, res, next) => {
    logger.log(`[API] [ALERT] IP ${req.ip} has exceeded the rate limit on path: ${req.path}`);

    let type = "unknown";
    const errorDescription = "Too many requests, please try again later.";
    const code = 429;

    // response custom based on the path of the request 

    if(req.path == "/user/action/access"){
      type = "access_type";
    }
    if(req.path == "/user/action/signup"){
      type = "signed_up";
    }
    if(req.path == "/user/action/login"){
      type = "logged_in";
    }
    if(req.path == "/user/action/check-handle-availability"){
      type = "handle_available";
    }
    if(req.path == "/user/action/get-user-id"){
      type = "user_id";
    }
    
    res.status(429).json({[type]:null,code:code,errorDescription:errorDescription});
  }
});

api.use(limiter);


// starting methods

// returns the access type of the user (login -> already registered, signup -> not registered)
// if the email is not valid, returns 400
// if there is an error, returns 500
// all good = returns 200
api.get('/user/action/access', async (req, res) => {
  
  const email = req.query.email;

  logger.debug("[API] [REQUEST] Access request received -> email: " + email);

  const type = "access_type";
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

// da sistemare tutto il sottostante
api.get('/user/action/signup', async (req, res) => {
  
  const email = req.query.email;
  const name = req.query.name;
  const surname = req.query.surname;
  const handle = req.query.handle;
  const password = req.query.password;

  logger.debug("[API] [REQUEST] Signup request received -> email: " + email + " name: " + name + " surname: " + surname + " handle: " + handle + " password: " + password);

  const type = "signed_up";
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

api.get('/user/action/login', async (req, res) => {

  const email = req.query.email;  
  const password = req.query.password;

  logger.debug("[API] [REQUEST] Login request received -> email: " + email + " password: " + password);

  const type = "logged_in";
  let code = 500;
  let confirmation = null;
  let errorDescription = "Generic error";
  let validated = true;

  let api_key = null;

  if(!(validator.email(email))){
    code = 400;
    errorDescription = "Email not valid";
    validated = false;
  }

  if(password == null || password == ""){
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

api.get('/user/action/check-handle-availability', async (req, res) => {

  const handle = req.query.handle;

  logger.debug("[API] [REQUEST] Check handle availability request received -> handle: " + handle);

  const type = "handle_available";
  let code = 500;
  let confirmation = null;
  let errorDescription = "Generic error";
  let validated = true;

  if(handle == null || handle == ""){
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

api.get('/user/action/get-user-id', async (req, res) => {

  const api_key = req.query.api_key;

  logger.debug("[API] [REQUEST] Get user id request received -> api_key: " + api_key);

  const type = "user_id";
  let code = 500;
  let confirmation = null;
  let errorDescription = "Generic error";
  let validated = true;

  if(!validator.api_key(api_key)){
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

module.exports = api;
