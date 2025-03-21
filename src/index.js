const logger = require('./logger'); // Logger

logger.log('=+----------------------------------------------------------------Server starting!----------------------------------------------------------------+=');

const database = require('./database/database'); // Database
const envManager = require('./security/envManager'); // Environment Variables Manager

const api = require('./web_services/api'); // API Server
const { server: io } = require('./web_services/socketio'); // Socket.IO Server

async function startServer() {
    // Check database connection if it is healthy then start the api else exit
    if(await database.testConnection()){

      // Get the PORT and HOST for API from the environment variables

      logger.log('API Server starting...');
      logger.debug('Getting API_PORT and HOST...');

      const API_PORT = envManager.readAPIPort();
      const HOST = envManager.readServerIP();

      logger.debug(`API_PORT: ${API_PORT}`);
      logger.debug(`HOST: ${HOST}`);

      // Start the API and Socket.IO servers
      api.listen(API_PORT, HOST, () => {

        logger.log(`API Server listening on http://${HOST}:${API_PORT}`);

        logger.log('IO Server starting...');
        logger.debug('Getting IO_PORT...');

        const IO_PORT = envManager.readIOPort();
        logger.debug(`IO_PORT: ${IO_PORT}`);

        io.listen(IO_PORT, () => {
            logger.log(`Socket IO Server listening on http://${HOST}:${IO_PORT}`);

            logger.log('=+----------------------------------------------------------------Server started!----------------------------------------------------------------+=');
          });         
      });
    }else{
      logger.log('Server could not start. Exiting...');
      process.exit(1);	
    }
  }

  startServer();