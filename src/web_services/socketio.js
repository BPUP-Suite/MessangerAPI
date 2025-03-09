const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');
const database = require('../database/database');
const { SocketAddress } = require('net');
const { init } = require('./api');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Authecation middleware
io.use(async (socket, next) => {
  try {
    const user_id = socket.handshake.auth.user_id;
    const api_key = socket.handshake.auth.api_key;
    
    if (!user_id || !api_key) {
      logger.error('IO authentication error: missing credentials');
      return next(new Error('Authentication error - Missing credentials'));
    }
    
    const userIdFromApiKey = await database.get_user_id(api_key);
    
    if (userIdFromApiKey == user_id) {
      // Check if user_id and api_key match
      logger.debug(`IO authentication successful: user_id ${user_id} and api_key, added to his group`);
      socket.user_id = user_id;
      socket.join(user_id);

      return next();
    }
    
    logger.error(`IO authentication error: user_id ${user_id} and api_key REDACTED do not match`);
    logger.debug('REDATED = ' + api_key);
    return next(new Error('Authentication error - Invalid credentials'));
  } catch (error) {
    logger.error(`IO server authentication error: ${error.message}`);
    return next(new Error('Internal authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.debug('Connetion to IO established');

  // Local client database initialization
  socket.on('init', async () => {
    logger.log(`[IO] [RECEIVED] Event init received`);

    const user_id = socket.user_id;

    try {
      let init_data = await database.client_init(user_id);

      if(init_data === null){
        init_data = {init:false};
      }else{
        init_data = { ...init_data, init: true };
      }

      logger.log(`[IO] [RESPONSE] Event init response: ${JSON.stringify(init_data)}`);
      socket.emit('init', init_data);

    } catch (error) {
      logger.error(`database.client_init: ${error}`);
    }
   
  });
  	

  // DA RIVEDERE
  socket.on('send_message', async (data) => {
    logger.debug(`[IO] [RECEIVED] Event send_message received: ${data}`);
    const user_id = socket.user_id;
    
    try {
      const handle = await database.get_user_id_from_handle(user_id);
      const message = data.message;
      const recipient = data.recipient;

      const recipient_id = await database.get_user_id_from_handle(recipient);

      if (recipient_id) {
        io.to(recipient_id).emit('receive_message', { handle, message });
        logger.debug(`[IO] [RESPONSE] Event receive_message sent to ${recipient_id}`);
      } else {
        logger.debug(`[IO] [RESPONSE] Event receive_message not sent to ${recipient_id}`);
      }
    } catch (error) {
      logger.error(`database.get_user_id_from_handle: ${error}`);
    }
  });

  // When a user disconnects
  socket.on('disconnect', () => {
    logger.debug('User on IO disconnected'+ socket.user_id);
  });
});


module.exports = server;