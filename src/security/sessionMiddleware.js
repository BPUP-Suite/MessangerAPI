
const session = require('express-session');
const { RedisStore } = require('connect-redis');

const redis = require('../database/cache');

const envManager = require('./envManager');
const fileManager = require('./fileManager');
const logger = require('../logger');

logger.log('[SESSION] Session middleware starting...');

logger.debug('[SESSION] Getting session data...');
const SESSION = fileManager.getSessionKey();
const NODE_ENV = envManager.readNodeEnv();

let DOMAIN = '';

if(envManager.readDomain() == 'localhost') {
  DOMAIN = 'localhost';
  logger.warn('[SESSION] Running on localhost, session cookie domain will be set to localhost');
}else{
  DOMAIN = 'api.' + envManager.readDomain();
  logger.debug(`[SESSION] Running on domain, session cookie domain will be set to ${DOMAIN}`);
}

logger.debug(`[SESSION] DOMAIN: ${DOMAIN}`);
logger.debug(`[SESSION] NODE_ENV: ${NODE_ENV}`);
logger.debug(`[SESSION] SESSION KEY: ${SESSION}`);

const sameSite = NODE_ENV == 'production' ? 'none' : 'lax';

const redisStore = new RedisStore({ client: redis });

const sessionMiddleware = session({
  store: redisStore,
  secret: SESSION,
  resave: false,            
  saveUninitialized: false, 
  cookie: {
    httpOnly: true,      
    secure: NODE_ENV == 'production', // HTTPS only in production
    maxAge: 30 * 24 * 60 * 60 * 1000,
    domain: DOMAIN,
    sameSite: sameSite,
    partitioned: true
  },
  rolling: true  
});

async function verifySession(session_id) {
  // verify session id and return session object
    return new Promise((resolve, reject) => {
      redisStore.get(session_id, (error, session) => {
        if (error) reject(error);
        else resolve(session);
      });
    });
  }

logger.log('[SESSION] Session middleware started');

module.exports = {
  sessionMiddleware,
  verifySession
};