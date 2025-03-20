const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');
const database = require('../database/database');

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
    logger.debug('REDACTED = ' + api_key);
    return next(new Error('Authentication error - Invalid credentials'));
  } catch (error) {
    logger.error(`IO server authentication error: ${error.message}`);
    return next(new Error('Internal authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.debug('Connetion to IO established');

  // ..

  // When a user disconnects
  socket.on('disconnect', () => {
    logger.debug('User on IO disconnected: ' + socket.user_id);
  });
});


// Function to send a message to all sockets in a group
function send_messages_to_recipients(recipient_list,message_data) {
  for (const recipient of recipient_list) {
    // send message to everyone on the group except the sender socket
    io.to(recipient).emit('receive_message', message_data);
    logger.log(`[IO] [RESPONSE] Event receive_message sent to ${recipient}: ${JSON.stringify(message_data)}`);
  }
}

module.exports = { server, send_messages_to_recipients };
