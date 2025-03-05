const express = require('express');
const api = express();
const logger = require('../logger');

api.use(express.json());

logger.log('API Server starting...');
logger.debug('Getting PORT and HOST...');

const envManager = require('../security/envManager');
const PORT = envManager.readAPIPort();
const HOST = envManager.readServerIP();

logger.debug(`PORT: ${PORT}`);
logger.debug(`HOST: ${HOST}`);


api.get('/', (req, res) => {
  res.send('Ciao, sesso!');
});

api.listen(PORT, HOST, () => {
  logger.log(`API Server listening on http://${HOST}:${PORT}`);
  logger.log('=+----------------------------------------------------------------Server started!----------------------------------------------------------------+=');	
});

module.exports = api;
