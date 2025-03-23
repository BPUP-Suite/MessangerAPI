const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');
const envManager = require('../security/envManager');
const database = require('../database/database');
const { sessionMiddleware, verifySession } = require('../security/sessionMiddleware');

const app = express();
const server = http.createServer(app);

// CORS config

let WEB_DOMAIN = envManager.readDomain();

if (WEB_DOMAIN == 'localhost') {
  WEB_DOMAIN = 'http://localhost' + envManager.readIOPort();
  logger.warn('[IO] Running on localhost, CORS will be set to localhost');
} else {
  WEB_DOMAIN = 'https://web.' + WEB_DOMAIN;
  logger.debug(`[IO] Running on domain, CORS will be set to ${WEB_DOMAIN}`);
}

// init socket server

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:8081',WEB_DOMAIN], //TEMPORARY FOR TESTING PURPUSE 
    methods: ["GET","POST"],
    credentials: true 
  }
});

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

io.use(async (socket, next) => {
  try {
    //logger.debug('[IO] IO authentication starting... with header: ' + JSON.stringify(socket.request.headers)); disabled for security reasons

    // takes session_id from the socket handshake
    const session_id = socket.handshake.auth.sessionId;
    logger.debug(`[IO] session_id: ${session_id}`);

    if(!session_id) {
      logger.error('[IO] IO authentication error: no session_id provided');
      const error = new Error('Authentication error - No session_id provided');
      error.data = { status: 401 };
      return next(error);
    }

    // verify session_id returning a session object
    const session = await verifySession(session_id);
    
    // if no session is returned, the session id is invalid
    if (!session || !session.user_id) {
      logger.error('[IO] IO authentication error: no active session');
      const error = new Error('Authentication error - No active session');
      error.data = { status: 401 };
      return next(error);
    }

    const user_id = session.user_id;
    logger.debug(`[IO] IO authentication successful: user_id ${user_id}, added to group`);
    
    socket.user_id = user_id;
    socket.join(user_id);

    return next();
  } catch (error) {
    logger.error(`[IO] IO server authentication error: ${error.message}`);
    const authError = new Error('Internal authentication error');
    authError.data = { status: 401 }; 
    return next(authError);
  }
});

io.on('connection', (socket) => {
  logger.debug(`[IO] User ${socket.user_id} connected to IO`);

  socket.on('disconnect', () => {
    logger.debug(`[IO] User ${socket.user_id} disconnected`);
  });
});



// Function to send a message to all sockets in a group
function send_messages_to_recipients(recipient_list,message_data) {
  for (const recipient of recipient_list) {
    // send message to everyone on the group
    io.to(recipient).emit('receive_message', message_data);
    logger.log(`[IO] [RESPONSE] Event receive_message sent to ${recipient}: ${JSON.stringify(message_data)}`);
  }
}

module.exports = { server, send_messages_to_recipients };
