const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');
const envManager = require('../security/envManager');
const database = require('../database/database');
const { sessionMiddleware, verifySession } = require('../security/sessionMiddleware');

const app = express();
const server = http.createServer(app);

const activeSockets = new Map();

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


    // add the socket to the activeSockets map
    // activeSockets is a Map that stores the socket.id and user_id of each connected socket
    activeSockets.set(socket.id, {
      socket_id: socket.id,
      user_id: user_id,
      connected_at: new Date()
    });

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
    activeSockets.delete(socket.id);
  });
});



// Message to all sockets in a group
function send_messages_to_recipients(recipient_list,message_data) {
  send_to_all(recipient_list,message_data,'receive_message');
}

// Group creating alert to all sockets in a group
function send_groups_to_recipients(members,group_data){
  send_to_all(members,group_data,'group_created');
}

// Alert of a new member joined to a group
function send_group_member_joined(members,group_data){
  send_to_all(members,group_data,'group_member_joined');
}

// Alert of a member left a group

// 

function send_to_all(recipient_list,data,type){
  for (const recipient of recipient_list){
    io.to(recipient).emit(type,data);
    logger.debug(`[IO] [RESPONSE] Event ${type} sent to ${recipient}: ${JSON.stringify(data)}`);
  }
}

function getActiveSockets() {
  return Array.from(activeSockets.values());
}

module.exports = { 
  server, 
  send_messages_to_recipients, 
  send_groups_to_recipients,
  getActiveSockets,
  send_group_member_joined

};
