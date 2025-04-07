const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');
const { io_log:log, io_debug:debug, io_warn:warn, io_error:error, io_info:info } = require('../logger');
const validator = require('../database/validator');


const envManager = require('../security/envManager');
const { verifySession } = require('../security/sessionMiddleware');

const database = require('../database/database');  
const { join } = require('path');

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

const version = envManager.readVersion();
const path = '/' + version + '/' + 'io';

logger.debug(`[IO] IO base path: ${path}`);

const io = new Server(server, {
  path: path,
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

  // WebRTC

  socket.on('join', async (data) => {

    const user_id = socket.user_id;

    debug('join','ON','User ' + user_id + ' wants to join room ' + data.chat_id, JSON.stringify(data));

    const chat_id = data.chat_id;

    if(!(validator.chat_id(chat_id))){
      socket.emit('join', {chat_id: chat_id,success: false,error_message: 'Invalid chat_id'});
      return;
    }

    if(!(await database.is_member(user_id, chat_id))){
      socket.emit('join', {chat_id: chat_id,success: false,error_message: 'User is not a member of the chat'});
      return;
    }

    socket.join(chat_id);
    debug('join','ON','User ' + user_id + ' joined room ' + data.chat_id, JSON.stringify(data));

    const recipient_list = await database.get_members_as_user_id(chat_id);
    const sender = await database.get_handle_from_id(user_id); // handle of the sender

    const join_data = {
      chat_id: chat_id,
      success: true
    };

    const joined_data = {
      chat_id: chat_id,
      sender: sender
    };

    socket.emit('join', join_data);
    debug('join','EMIT','User ' + user_id + ' joined room ' + data.chat_id, JSON.stringify(join_data));
    send_to_all_except_sender(recipient_list,joined_data,'joined',socket.id);
  });

  socket.on('leave', async (data) => {

    const user_id = socket.user_id;

    debug('join','ON','User ' + user_id + ' wants to leave room ' + data.chat_id, JSON.stringify(data));

    const chat_id = data.chat_id;

    if(!(validator.chat_id(chat_id))){
      socket.emit('join', {chat_id: chat_id,success: false,error_message: 'Invalid chat_id'});
      return;
    }

    if(!(await database.is_member(user_id, chat_id))){
      socket.emit('join', {chat_id: chat_id,success: false,error_message: 'User is not a member of the chat'});
      return;
    }
    
    socket.leave(chat_id);
    debug('join','ON','User ' + user_id + ' left room ' + data.chat_id, JSON.stringify(data));
    
    const recipients_list = await database.get_members_as_user_id(chat_id);
    const sender = await database.get_handle_from_id(user_id); // handle of the sender

    const leave_data = {
      chat_id: chat_id,
      success: true
    }; 

    const left_data = {
      chat_id: chat_id,
      sender: sender
    };

    socket.emit('leave', leave_data);
    debug('leave','EMIT','User ' + user_id + ' left room ' + data.chat_id, JSON.stringify(leave_data));
    send_to_all_except_sender(recipients_list,left_data,'left',socket.id);
  });

  socket.on('candidate', (data) => {
    socket.to(data.to).emit('candidate', data);
  }); 

  // End of IO

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

// Alert of a new member joined to a group (to the member that joined)
function send_member_member_joined(member,group_data){
  send_to_all([member],group_data,'member_joined_group');
}

// Alert of a member left a group

// 

function send_to_all(recipient_list,data,type){

  if(!recipient_list || recipient_list.length === 0) {
    debug(type,'EMIT','No recipients to send to', JSON.stringify(data));
    return; // No recipients to send to
  }

  for (const recipient of recipient_list){
    io.to(recipient).emit(type,data);
    debug(type,'EMIT','User '+recipient, JSON.stringify(data));
  }
}

function send_to_a_room(room,data,type){
  io.to(room).emit(type,data);
  debug(type,'EMIT','Room '+room, JSON.stringify(data));
}

function send_to_all_except_sender(recipient_list, data, type, sender_socket_id) {

  if(!recipient_list || recipient_list.length === 0) {
    debug(type,'EMIT','No recipients to send to', JSON.stringify(data));
    return; // No recipients to send to
  }

  for (const recipient of recipient_list) {
    // For each recipient user_id, emit to all their sockets except the sender socket
    io.to(recipient).except(sender_socket_id).emit(type, data);
    debug(type,'EMIT','User '+recipient+' (except sender)', JSON.stringify(data));
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
  send_group_member_joined,
  send_member_member_joined
};
