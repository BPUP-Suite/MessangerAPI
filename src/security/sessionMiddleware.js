
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
const MAX_SESSIONS = envManager.readMaxSessionPerUser();

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
logger.debug(`[SESSION] MAX_SESSIONS: ${MAX_SESSIONS}`);

const sameSite = NODE_ENV == 'production' ? 'none' : 'lax';
const COOKIE_NAME = '_' + DOMAIN + '_sid';
const COOKIE_OPTIONS = {
  httpOnly: true,      
  secure: NODE_ENV == 'production', // HTTPS only in production
  maxAge: 30 * 24 * 60 * 60 * 1000,
  domain: DOMAIN,
  sameSite: sameSite,
  partitioned: true
};

const redisStore = new RedisStore({ client: redis });

// MIDDLEWARES

// Middleware to set up session
const sessionMiddleware = session({
  store: redisStore,
  secret: SESSION, 
  resave: false,            
  saveUninitialized: false, 
  cookie: COOKIE_OPTIONS,
  rolling: true,
  name: COOKIE_NAME
});

// Middleware to track session creation
const trackSessionCreationMiddleware = (req, res, next) => {
  if (req.session && !req.session.cookie.createdAt) {
    req.session.cookie.createdAt = new Date().toISOString();
  }
  next();
};

async function verifySession(session_id) {
  // Validator
  if (!session_id || typeof session_id !== 'string') {
    logger.warn('[SESSION] Invalid session ID format');
    return null;
  }

  // Limit lenght of session id to 100 characters
  // to prevent memory overflow and DoS attack
  if (session_id.length > 100) {
    logger.warn('[SESSION] Session ID too long');
    return null;
  }

  try {
    const session = await getSessionFromStore(session_id);
    
    if (!session) {
      logger.debug(`[SESSION] Session not found: ${session_id.substring(0, 10)}...`);
      return null;
    }
    
    // Session validation
    // Check if session has expired
    const now = Date.now();
    if (session.cookie && session.cookie.expires && new Date(session.cookie.expires) < now) {
      logger.debug(`[SESSION] Session expired`);
      await destroySessionById(session_id);
      return null;
    }
    
    return session;
  } catch (error) {
    logger.error(`[SESSION] Error retrieving session: ${error.message}`);
    throw error;
  }
}
  

async function destroySession(req, res) {
  if (!req.session) {
    logger.debug('[SESSION] No session to destroy during logout');
    return false;
  }
  
  const user_id = req.session.user_id;
  const session_id = req.sessionID;
  
  try {
    // Destroy the session
    await destroyReqSession(req);
    logger.debug(`[SESSION] Session destroyed for user ${user_id}`);

    // Clear the cookie
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    logger.debug(`[SESSION] Cookie cleared for user ${user_id}`);
    
    // Explicitly invalidate session in Redis
    await destroySessionById(session_id);
    logger.debug(`[SESSION] Session explicitly destroyed in Redis for user ${user_id}`);
    
    return true;
  } catch (err) {
    logger.error(`[SESSION] Error during logout: ${err.message}`);
    throw err;
  }
}

  async function enforceSessionLimit(req,res) {

    const user_id = req.session.user_id;
  
    const sessionKeysPattern = "sess:*" 
    const keys = await redis.keys(sessionKeysPattern);
  
    // Filter sessions by user_id
    const userSessions = [];
    for (const key of keys) {
      const sessionData = await redis.get(key);
      if (sessionData) {
        try {
          const parsedData = JSON.parse(sessionData);
          if (parsedData.user_id === user_id) {
            // Mark if this is the current session
            const isCurrentSession = key === `sess:${req.sessionID}`;
            userSessions.push({ 
              key, 
              createdAt: parsedData.cookie.createdAt,
              isCurrentSession
            });
          }
        } catch (err) {
          logger.error(`[SESSION] Error parsing session data: ${err.message}`);
        }
      }
    }

  // Sort sessions by creation date (oldest first)
  userSessions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  // Skip the current session when removing old ones
  const sessionsToRemove = userSessions.filter(session => !session.isCurrentSession);
  
  // If there are more than MAX_SESSIONS total sessions, destroy the oldest ones
  while (userSessions.length > MAX_SESSIONS) {
    const oldestSession = sessionsToRemove.shift() || userSessions.shift();
    if (oldestSession.isCurrentSession) continue; // Never destroy current session
    
    const sessionIdToDestroy = oldestSession.key.split(':')[1];
    await destroySessionById(sessionIdToDestroy);
    userSessions.splice(userSessions.indexOf(oldestSession), 1); // Remove from userSessions array
    
    logger.warn(`[SESSION] Session limit exceeded for user ${user_id}. Session ${sessionIdToDestroy.substring(0, 8)}... destroyed.`);
  }
}



// HELPER FUNCTIONS

// Helper function to promisify redisStore.get
function getSessionFromStore(session_id) {
  return new Promise((resolve, reject) => {
    redisStore.get(session_id, (error, session) => {
      if (error) reject(error);
      else resolve(session);
    });
  });
}

// Helper function to promisify redisStore.destroy
function destroySessionById(session_id) {
  return new Promise((resolve) => {
    redisStore.destroy(session_id, () => resolve());
  });
}

// Helper function to promisify req.session.destroy
function destroyReqSession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy(err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Destroy all sessions for a given user_id except the specified session_id.
 * If session_id is null, destroy all sessions for that user_id.
 * @param {string} user_id
 * @param {string|null} session_id
 * @returns {Promise<number>} Number of sessions destroyed
 */
async function destroyAllUserSessionsExcept(user_id, session_id = null) {
  if (!user_id) return 0;

  const sessionKeysPattern = "sess:*";
  const keys = await redis.keys(sessionKeysPattern);
  let destroyedCount = 0;

  for (const key of keys) {
    const sessionData = await redis.get(key);
    if (!sessionData) continue;

    try {
      const parsedData = JSON.parse(sessionData);
      const keySessionId = key.split(':')[1];
      if (
        parsedData.user_id === user_id &&
        (session_id === null || keySessionId !== session_id)
      ) {
        await destroySessionById(keySessionId);
        destroyedCount++;
        logger.debug(`[SESSION] Destroyed session ${keySessionId.substring(0, 8)}... for user ${user_id}`);
      }
    } catch (err) {
      logger.error(`[SESSION] Error parsing session data: ${err.message}`);
    }
  }

  return destroyedCount;
}

logger.log('[SESSION] Session middleware started');

module.exports = {
  sessionMiddleware,
  trackSessionCreationMiddleware,
  verifySession,
  destroySession,
  enforceSessionLimit,
  destroyAllUserSessionsExcept,
};