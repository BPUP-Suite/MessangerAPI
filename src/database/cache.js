const redis = require('redis');

const logger = require('../logger');

const envManager = require('../security/envManager');

logger.log('Redis database (cache) starting...');

logger.debug('Getting REDIS_HOST and REDIS_PORT...');
const REDIS_HOST = envManager.readRedisHost();
const REDIS_PORT = envManager.readRedisPort();

logger.debug(`REDIS_HOST: ${REDIS_HOST}`);
logger.debug(`REDIS_PORT: ${REDIS_PORT}`);

// Create a Redis client
logger.debug('Creating Redis client...');
const cache = redis.createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT
    }    
  });
logger.debug('Redis client created');

async function connectRedis() {
    try {
      await cache.connect();
      logger.log('Redis client connected successfully');
    } catch (error) {
      logger.error('Error connecting to Redis:' + error);
      throw error;
    }
  }
  
  connectRedis().catch(error => {
    logger.error('Failed to initialize Redis:' + error);
  });
  
  cache.on('error', (error) => {
    logger.error('Redis Client Error:' + error);
  });

module.exports = cache;