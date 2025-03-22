
const session = require('express-session');
const { RedisStore } = require('connect-redis');

const redis = require('../database/cache');

const envManager = require('./envManager');
const fileManager = require('./fileManager');
const logger = require('../logger');

logger.log('Session middleware starting...');

logger.debug('Getting session data...');
const SESSION = fileManager.getSessionKey();
const NODE_ENV = envManager.readNodeEnv();
const DOMAIN = envManager.readAPIDomain();

logger.debug(`NODE_ENV: ${NODE_ENV}`);
logger.debug(`SESSION KEY: ${SESSION}`);

const sessionMiddleware = session({
  store: new RedisStore({ client: redis }),
  secret: SESSION,
  resave: false,            
  saveUninitialized: false, 
  cookie: {
    httpOnly: true,      
    secure: NODE_ENV == 'production', // HTTPS only in production
    maxAge: 30 * 24 * 60 * 60 * 1000,
    domain: DOMAIN,
    sameSite: 'none',
    partitioned: true
  },
  rolling: true  
});

logger.log('Session middleware started');

module.exports = sessionMiddleware;