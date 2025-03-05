const express = require('express');
const api = express();
const logger = require('../logger');

const validator = require('../database/validator');
const database = require('../database/database');
const { AccessResponse } = require('../database/object');

api.use(express.json());

logger.log('API Server starting...');
logger.debug('Getting PORT and HOST...');

const envManager = require('../security/envManager');
const PORT = envManager.readAPIPort();
const HOST = envManager.readServerIP();

logger.debug(`PORT: ${PORT}`);
logger.debug(`HOST: ${HOST}`);

api.get('/user/action/access', (req, res) => {

  const email = req.query.email;
  const type = "access_type";
  const code = 500;
  const confirmation = "error";

  if(!(validator.email(email))){
    code = 404;
  }else{
    try{
      if(database.check_email_existence(email)){
        confirmation = "login";
      }else{
        confirmation = "signup";
      }
      code = 200;
    }catch(err){ 
      logger.error("Error in database.check_email_existence");
    }
  }
  const accessResponse = new AccessResponse(type, confirmation, code, "errore");

  return res.json(accessResponse.toJson);
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
