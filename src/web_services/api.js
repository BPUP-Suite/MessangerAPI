const express = require('express');
const api = express();
const logger = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');
const { AccessResponse , SignupResponse, SignupUser} = require('../database/object');
 
api.use(express.json());

logger.log('API Server starting...');
logger.debug('Getting PORT and HOST...');

const envManager = require('../security/envManager');
const PORT = envManager.readAPIPort();
const HOST = envManager.readServerIP();

logger.debug(`PORT: ${PORT}`);
logger.debug(`HOST: ${HOST}`);


// returns the access type of the user (login -> already registered, signup -> not registered)
// if the email is not valid, returns 400
// if there is an error, returns 500
// all good = returns 200
api.get('/user/action/access', (req, res) => {

  logger.debug("Access request received -> email: " + req.query.email);
  
  const email = req.query.email;
  const type = "access_type";
  const code = 500;
  const confirmation = "error";
  const errorDescription = "Generic error";

  if(!(validator.email(email))){
    code = 400;
    errorDescription = "Email not valid";
  }else{
    try{
      if(database.check_email_existence(email)){
        confirmation = "login";
      }else{
        confirmation = "signup";
      }
      errorDescription = "";
      code = 200;
    }catch(err){ 
      logger.error("Error in database.check_email_existence");
    }
  }
  const accessResponse = new AccessResponse(type, confirmation, code, errorDescription);
  AccessResponse.logResponse();
  return res.json(accessResponse.toJson);
});


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
  const confirmation = "error";
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
  signupResponse.logResponse();
  return res.json(signupResponse.toJson);

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
