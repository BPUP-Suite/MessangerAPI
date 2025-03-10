const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');
const database = require('../database/database');
const encrypter = require('../security/encrypter');
const { Message } = require('../database/object');

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
        init_data = {init:false, code: 500, error_message: 'Internal server error'};
      }else{
        init_data = { ...init_data, init: true, code: 200, error_message: '' };
      }

      logger.log(`[IO] [RESPONSE] Event init response: ${JSON.stringify(init_data)}`);
      socket.emit('init', init_data);

    } catch (error) {
      logger.error(`database.client_init: ${error}`);
    }
   
  });
  	

  // Let users send message to every socket associated to their account and recipients
  socket.on('send_message', async (data) => {
    logger.log(`[IO] [RECEIVED] Event send_message received`);
    logger.debug(`-->  ${JSON.stringify(data)}`);

    const user_id = socket.user_id;

    const text = data.text;
    const chat_id = data.chat_id;

    // validate data
    if(text.lenght > 2056 || text.lenght == 0 || text == null){
      logger.error('[IO] Message too long or missing. Text: ' + text);

      let response_data = {
        send_message: false,
        code: 400,
        error_message: 'Message too long or missing'
      };

      socket.emit('send_message',response_data);
      return;
    }

    if(chat_id.lenght == 0 || chat_id == null){
      logger.error('[IO] No chat id found');

      let response_data = {
        send_message: false,
        code: 400,
        error_message: 'No chat id found'
      };

      socket.emit('send_message',response_data);
      return;
    }

    // then try sending message

    const message = new Message(chat_id,user_id, text);
    let {response_data, message_data, recipient_list} = await database.send_message(message);

    if(response_data != null && message_data != null && recipient_list != null){

      const salt = data.salt;

      if(salt != null){
        const hash = encrypter.generateHash(text,salt);
        logger.debug('[IO] Salt found, generated hash: ' + JSON.stringify(hash));
        response_data = { ...response_data, hash: hash };
      }

      response_data = { ...response_data, send_message: true, code: 200, error_message: '' };
      logger.log(`[IO] [RESPONSE] Event send_message response: ${JSON.stringify(response_data)}`);
      socket.emit('send_message', response_data);

      for (const recipient of recipient_list) {
        // send message to everyone on the group except the sender socket
        socket.broadcast.to(recipient).emit('receive_message', message_data);
        logger.log(`[IO] [RESPONSE] Event receive_message sent to ${recipient}`);
      }
    }


  });

  // When a user disconnects
  socket.on('disconnect', () => {
    logger.debug('User on IO disconnected'+ socket.user_id);
  });
});


module.exports = server;