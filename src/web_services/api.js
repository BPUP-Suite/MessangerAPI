const express = require('express');
const rateLimit = require('express-rate-limit');

const api = express();
const logger = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');
const { AccessResponse , SignupResponse, SignupUser,LoginResponse,LoginUser,HandleResponse,UserIDResponse} = require('../database/object');
 
api.use(express.json());

logger.log('API Server starting...');
logger.debug('Getting PORT and HOST...');

const envManager = require('../security/envManager');
const PORT = envManager.readAPIPort();
const HOST = envManager.readServerIP();

logger.debug(`PORT: ${PORT}`);
logger.debug(`HOST: ${HOST}`);

// api configurations

api.set('trust proxy', 'loopback','172.16.0.0/16'); // da mettere nella configurazione env

const limiter = rateLimit({
  windowMs: 10000,
  max: 100,
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
api.get('/user/action/signup', (req, res) => {

  // da fare prima stampa della req raw, dopo check che tutti i parametri esistano e siano validi e dopo parte
  logger.debug("Signup request received -> email: " + req.query.email + " name: " + req.query.name + " surname: " + req.query.surname + " handle: " + req.query.handle + " password: " + req.query.password);
  const email = req.query.email;
  const name = req.query.name;
  const surnace = req.query.surname;
  const handle = req.query.handle;
  const password = req.query.password;

  const type = "signed_up";
  const code = 500;
  const confirmation = null;
  const errorDescription = "Generic error";

  const validated = true;

  // check if every parameter is valid
  if(!(validator.email(email))){
    code = 400;
    errorDescription = "Email not valid";
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
      confirmation = database.add_user_to_db(signupUser)
      if(confirmation){
        code = 200;
        errorDescription = "";
      }else{
        code = 500;
      }
    }catch(err){ 
      logger.error("Error in database.add_user_to_db");
    }
  }

  const signupResponse = new SignupResponse(type, confirmation, code, errorDescription);
  signupResponse.logResponse;
  return res.json(signupResponse.toJson);

});

api.get('/user/action/login', (req, res) => {

  // da fare prima stampa della req raw, dopo check che tutti i parametri esistano e siano validi e dopo parte
  logger.debug("Login request received -> email: " + req.query.email  + " password: " + req.query.password);
  const email = req.query.email;
  const password = req.query.password;

  const type = "logged_in";
  const code = 500;
  const confirmation = null;
  const errorDescription = "Generic error";
  const api_key = null;

  const validated = true;

  // check if every parameter is valid
  if(!(validator.email(email))){
    code = 400;
    errorDescription = "Email not valid";
    validated = false;
  }

  if(!(validator.password(password))){
    code = 400;
    errorDescription = "Password not valid";
    validated = false;
  }

  // only if everything is valid, try to sign up 
  if(validated){
    const loginUser = new LoginUser(email, password);
    try{
      api_key = database.login(loginUser);
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
  loginResponse.logResponse;
  return res.json(loginResponse.toJson);

});

api.get('/user/action/check-handle-availability', (req, res) => {

  logger.debug("Check handle availability request received -> handle: " + req.query.handle);

  const handle = req.query.handle;
  const type = "handle_available";
  const code = 500;
  const confirmation = "error";
  const errorDescription = "Generic error";
  const validated = true;

  if(handle == null){
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  }

  if(validated){
    try{
      confirmation = database.check_handle_availability(handle);
      code = 200;
      errorDescription = "";
    }catch(err){
      logger.error("Error in database.check_handle_availability");
    }
  }

  const handleResponse = new HandleResponse(type, confirmation, code, errorDescription);
  handleResponse.logResponse;
  return res.json(handleResponse.toJson);

});

api.get('/user/action/get-user-id', (req, res) => {

  logger.debug("Get user id request received -> api_key: " + req.query.api_key);

  const api_key = req.query.api_key;
  const type = "user_id";
  const code = 500;
  const confirmation = null;
  const errorDescription = "Generic error";
  const validated = true;

  if(handle == null){
    code = 400;
    errorDescription = "Handle not valid";
    validated = false;
  }

  if(validated){
    try{
      confirmation = database.get_user_id(api_key); // user_id if exists, null otherwise
      code = 200;
      errorDescription = "";
    }catch(err){
      logger.error("Error in database.get_user_id");
    }
  }

  const userIDResponse = new UserIDResponse(type, confirmation, code, errorDescription);
  userIDResponse.logResponse;
  return res.json(userIDResponse.toJson);

});

async function startServer() {
  // Check database connection if it is healthy then start the api else exit
  if(await database.testConnection()){
    api.listen(PORT, HOST, () => {
      logger.log(`API Server listening on http://${HOST}:${PORT}`);
      logger.log('=+----------------------------------------------------------------Server started!----------------------------------------------------------------+=');
    });
  }else{
    logger.log('Server could not start. Exiting...');
    process.exit(1);	
  }
}

startServer();

module.exports = api;
