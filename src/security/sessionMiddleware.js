
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
  rolling: true,
  name: '_' + DOMAIN + '_sid'
});

async function verifySession(session_id) {
    // Validator
    if (!session_id || typeof session_id !== 'string') {
      logger.warn('[SESSION] Invalid session ID format');
      return Promise.resolve(null);
    }
  
    // Limit lenght of session id to 100 characters
    // to prevent memory overflow and DoS attack
    if (session_id.length > 100) {
      logger.warn('[SESSION] Session ID too long');
      return Promise.resolve(null);
    }

    // verify session id and return session object
    return new Promise((resolve, reject) => {
      redisStore.get(session_id, (error, session) => {
        if (error) {
          logger.error(`[SESSION] Error retrieving session: ${error.message}`);
          reject(error);
        } else if (!session) {
          logger.debug(`[SESSION] Session not found: ${session_id.substring(0, 10)}...`);
          resolve(null);
        } else {
          // Session validation
          // Check if session has expired
          const now = Date.now();
          if (session.cookie && session.cookie.expires && new Date(session.cookie.expires) < now) {
            logger.debug(`[SESSION] Session expired`);
            redisStore.destroy(session_id, () => {});
            resolve(null);
          } else {
            resolve(session);
          }
        }
      });
    });
  }

logger.log('[SESSION] Session middleware started');

module.exports = {
  sessionMiddleware,
  verifySession
};