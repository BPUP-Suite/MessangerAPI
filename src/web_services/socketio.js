const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');
const { io_log:log, io_debug:debug, io_warn:warn, io_error:error, io_info:info } = require('../logger');


const envManager = require('../security/envManager');
const { verifySession } = require('../security/sessionMiddleware');
const { start } = require('repl');

const app = express();
const server = http.createServer(app);

const activeSockets = new Map();
const activeSessions = new Map();

// CORS config

let WEB_DOMAIN = envManager.readDomain();

if (WEB_DOMAIN == 'localhost') {
  WEB_DOMAIN = 'http://localhost' + envManager.readIOPort();
  warn('STARTING',`Running on localhost, CORS will be set to localhost`);
} else {
  WEB_DOMAIN = 'https://web.' + WEB_DOMAIN;
  info('STARTING',`Running on domain, CORS will be set to ${WEB_DOMAIN}`,null);
}

// init socket server

const version = envManager.readVersion();
const path = '/' + version + '/' + 'io';

info('STARTING',`Base path: ${path}`,null);

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

    // takes session_id from the socket handshake
    const session_id = socket.handshake.auth.sessionId;
    

    if(!session_id) {
      logger.error('[IO] IO authentication error: no session_id provided');
      return next({ 
        message: 'Authentication error - No active session', 
        data: { status: 401 } 
      });
    }

    logger.debug(`[IO] session_id: ${session_id}`);

    // verify session_id returning a session object
    const session = await verifySession(session_id);
    
    // if no session is returned, the session id is invalid
    if (!session || !session.user_id) {
      logger.error('[IO] IO authentication error: no active session');
      return next({ 
        message: 'Authentication error - No active session', 
        data: { status: 401 } 
      });
    }

    if (activeSessions.has(session_id)) {
      const existingSocketId = activeSessions.get(session_id);
      
      // check if the socket is already connected
      // if it is, disconnect it
      // this is to prevent multiple sockets from being connected with the same session id
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        logger.warn(`[IO] Another socket already connected with session ${session_id}. Disconnecting previous socket.`);
        existingSocket.disconnect(true);
      }
      activeSessions.delete(session_id);
    }

    const user_id = session.user_id;
    logger.debug(`[IO] IO authentication successful: user_id ${user_id}, added to group`);
    
    socket.session_id = session_id;
    socket.user_id = user_id;
    socket.join(user_id);

    activeSessions.set(session_id, socket.id);

    // add the socket to the activeSockets map
    // activeSockets is a Map that stores the socket.id, user_id and session_id of each connected socket
    activeSockets.set(socket.id, {
      socket_id: socket.id,
      user_id: user_id,
      session_id: session_id,
      comms_id: null,
      connected_at: new Date(),
      is_speaking: false,
      active_screen_shares: []
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

  // Negotiate WebRTC connections

  socket.on('candidate', (data) => {
    send_to_comms_id(data.to, data, 'candidate');
  }); 

  socket.on('offer', (data) => {
    send_to_comms_id(data.to, data, 'offer');
  }); 

  socket.on('answer', (data) => {
    send_to_comms_id(data.to, data, 'answer');
  }); 

  // Information signaling for WebRTC

  socket.on('speaking', (data) => {
    // Update speaking status
    const socketData = activeSockets.get(socket.id);
    if (socketData) {
      socketData.is_speaking = true;
      activeSockets.set(socket.id, socketData);
    }
    send_to_a_room(data.to, data, 'speaking');
  }); 

  socket.on('not_speaking', (data) => {
    // Update speaking status
    const socketData = activeSockets.get(socket.id);
    if (socketData) {
      socketData.is_speaking = false;
      activeSockets.set(socket.id, socketData);
    }
    send_to_a_room(data.to, data, 'not_speaking');
  }); 

  socket.on('speaking', (data) => {
    // Update speaking status
    const socketData = activeSockets.get(socket.id);
    if (socketData) {
      socketData.is_speaking = true;
      activeSockets.set(socket.id, socketData);
    }
    send_to_a_room(data.to, data, 'speaking');
  }); 

  socket.on('not_speaking', (data) => {
    // Update speaking status
    const socketData = activeSockets.get(socket.id);
    if (socketData) {
      socketData.is_speaking = false;
      activeSockets.set(socket.id, socketData);
    }
    send_to_a_room(data.to, data, 'not_speaking');
  }); 

  // End of IO

  socket.on('disconnecting', async () => {  

    logger.debug(`[IO] User ${socket.user_id} disconnecting from IO`);

    // When a socket is disconnecting

    try{
      // quit from the room
      const [room,comms_id] = leave_comms(socket.id);
      if (room) {
        const [members_ids,comms_ids] = await get_users_info_room(room);
        const left_data = {
          chat_id: room,
          from: comms_id,
        };
        // Filter out the disconnecting user's ID if necessary before sending
        const recipients = members_ids.filter(id => id !== socket.user_id);
        if (recipients.length > 0) {
            send_left_member_to_comms(recipients, left_data, socket.id);
        }
        debug('disconnect','FUNCTION','User '+socket.user_id+' left room',room);
      }

      }catch(err){
          error('disconnecting', 'FUNCTION', `Error getting room info` + err);
      }
   });

  socket.on('disconnect', () => {
    logger.debug(`[IO] User ${socket.user_id} disconnected`);
    // When a socket disconnects

    // remove it from the activeSockets map
    // and the activeSessions map
    activeSockets.delete(socket.id);
    activeSessions.delete(socket.session_id);
  });

});

// Close socket connection on logout
function close_socket(socket_id) {
  const socket = io.sockets.sockets.get(socket_id);
  if (socket) {
    socket.disconnect(true);
    debug('close_socket','FUNCTION','Socket '+socket_id+' disconnected');
  }
  else {
    error('close_socket','FUNCTION','Socket '+socket_id+' not found');
  }
}


// Message to all sockets in a group
function send_messages_to_recipients(recipient_list,message_data,sender_socket_id) {
  send_to_all_except_sender(recipient_list,message_data,'receive_message',sender_socket_id);
}

// Group creating alert to all sockets in a group
function send_groups_to_recipients(members,group_data,sender_socket_id){
  send_to_all_except_sender(members,group_data,'group_created',sender_socket_id);
}

// Alert of a new member joined to a group
function send_group_member_joined(members,group_data,sender_socket_id){
  send_to_all_except_sender(members,group_data,'group_member_joined',sender_socket_id);
}

// Alert of a new member joined to a group (to the member that joined)
function send_member_member_joined(member,group_data,sender_socket_id){
  send_to_all_except_sender([member],group_data,'member_joined_group',sender_socket_id);
}

// Alert of a member left a group

// ....

// New member in comms chat

function send_joined_member_to_comms(members,comms_data,sender_socket_id){
  send_to_all_except_sender(members,comms_data,'member_joined_comms',sender_socket_id);
}

function send_left_member_to_comms(members,comms_data,sender_socket_id){
  send_to_all_except_sender(members,comms_data,'member_left_comms',sender_socket_id);
}

// Join Comms / Leave Comms

function join_comms(socket_id,room_id,comms_id) {

  const socket = io.sockets.sockets.get(socket_id);
  
  // Check if the socket is already in another room
  const existingRoom = is_already_in_room(socket);
  if (existingRoom) {
    debug('join_comms','FUNCTION','User '+socket.user_id+' is already in comms',existingRoom);
    return false; // User is already in another room
  }

  socket.join(room_id);
  socket.comms_id = comms_id;

  // Store the comms_id in the activeSockets map
  // This is to keep track of the comms_id for each socket
  const socketData = activeSockets.get(socket.id) || {};
  socketData.comms_id = comms_id;
  activeSockets.set(socket.id, socketData);

  debug('join_comms','FUNCTION','User '+socket.user_id+' joined comms with comms_id'+comms_id,room_id);

  return true;
}

function leave_comms(socket_id) {

  const socket = io.sockets.sockets.get(socket_id);

  // Check if the socket is already in another room
  const existingRoom = is_already_in_room(socket);

  if (existingRoom) {

    socket.leave(existingRoom);
    const comms_id = socket.comms_id;

    const socketData = activeSockets.get(socket_id);
    // Check if there are active screen shares and destroy them
    if (socketData && socketData.active_screen_shares && socketData.active_screen_shares.length > 0) {
      const activeScreenShares = [...socketData.active_screen_shares];
      
      // Notify users about each stopped screen share
      for (const screen_share_uuid of activeScreenShares) {
        const stopData = {
          to: existingRoom,
          from: socket_id,
          screen_share_uuid: screen_share_uuid
        };
        send_to_a_room(stopData.to, stopData, 'screen_share_stopped');
      }
      
      // Clear the active screen shares array
      socketData.active_screen_shares = [];
      socketData.is_speaking = false; // Reset speaking status
      activeSockets.set(socket_id, socketData);
      
      debug('leave_comms','FUNCTION',`Destroyed ${activeScreenShares.length} active screen shares for user ${socket.user_id}`);
    }

    socket.comms_id = null;
    debug('leave_comms','FUNCTION','User '+socket.user_id+' left comms with comms_id -> '+ comms_id +'and room ',existingRoom);
    return [existingRoom,comms_id];
  }

  debug('leave_comms','FUNCTION','User '+socket.user_id+' is not in any room','');
  return [null,null]; // User is not in any room
}

// Check if already in another room

function is_already_in_room(socket) {
  try {
    // Get all rooms this socket is in
    const rooms = Array.from(socket.rooms);
    
    // Filter out the socket's own room (socket.id) and user_id room
    const chat_rooms = rooms.filter(room => {
      return room !== socket.id && 
             room !== socket.user_id
    });
    
    if (chat_rooms.length > 0) {
      debug('is_already_in_room', 'FUNCTION', `User ${socket.user_id} is already in rooms:`, JSON.stringify(chat_rooms));
      return chat_rooms[0]; // Return the first room found
    }
    
    debug('is_already_in_room', 'FUNCTION', `User ${socket.user_id} is not in any other room`);
    return null;
  }catch (err) {
    error('is_already_in_room', 'FUNCTION', `Error checking rooms for user ${socket.user_id}. `+ err);
    return null;
  }
}

// Sending methods

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

// Send to a single comms_id

function send_to_comms_id(comms_id,data,type){
  // Send to a single socket id
  const socket_id = get_socket_id_from_comms_id(comms_id);
  if (!socket_id) {
    logger.error(`[IO] Error getting socket id for comms ${comms_id} [DEPRECATED]`);
    return;
  }
  io.to(socket_id).emit(type,data);
  debug(type,'EMIT','Comms '+comms_id, JSON.stringify(data));
}

// Send to a all but a specific socket

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

// Get methods

async function get_users_info_room(chat_id) {
  try {
    // Get all socket instances in the room
    const sockets = await io.in(chat_id).fetchSockets();
    
    // Extract unique user_ids from the sockets
    const members_ids = [...new Set(sockets.map(socket => socket.user_id))];
    const comms_ids = [...new Set(sockets.map(socket => socket.comms_id))];
    const is_speaking = sockets.map(socket => {
      const socketData = activeSockets.get(socket.id);
      return socketData ? socketData.is_speaking : false;
    });
    const screen_shares = sockets.map(socket => {
      const socketData = activeSockets.get(socket.id);
      return socketData ? socketData.active_screen_shares : [];
    });
    
    debug('getUserIdsInRoom', 'FUNCTION', `Retrieved ${members_ids.length} user_ids, ${comms_ids.length} comms_ids, ${is_speaking.length} speaking states, and ${screen_shares.length} screen shares from room ${chat_id}`, JSON.stringify(members_ids));
    return [members_ids, comms_ids, is_speaking, screen_shares];
  } catch (err) {
    error('getUserIdsInRoom', 'FUNCTION', `Error getting user_ids from room ${chat_id}` + err);
    return [[], [], [], []];
  }
}


function get_socket_id(session_id) { 
  // get the socket id from the activeSessions map using the session_id
  const socket_id = activeSessions.get(session_id);
  if (!socket_id) {
    logger.error(`[IO] Error getting socket id for session ${session_id}`);
    return null;
  }
  return socket_id;
}

function get_comms_id(socket_id) {
  const socket = io.sockets.sockets.get(socket_id);
  if (!socket) {
    logger.error(`[IO] Error getting comms id for socket ${socket_id}`);
    return null;
  }
  return socket.comms_id;
}

function get_socket_id_from_comms_id(comms_id) {
  // get the socket id from the activeSockets map using the comms_id
  const socket = Array.from(activeSockets.values()).find(socket => socket.comms_id === comms_id);
  if (!socket) {
    logger.error(`[IO] Error getting socket id for comms ${comms_id}`);
    return null;
  }
  return socket.socket_id;
}

function getActiveSockets() {
  return Array.from(activeSockets.values());
}


function start_screen_share(socket_id, chat_id,members) {
  // Start screen sharing
  const socketData = activeSockets.get(socket_id);

  let comms_id = null;
  let screen_share_uuid = null;

  let data = {
    to: chat_id,
    from: comms_id,
    screen_share_uuid: screen_share_uuid
  };

  if (socketData) {

    comms_id = socketData.comms_id;
    data.from = comms_id;
    
    socketData.active_screen_shares.push(screen_share_uuid);
    activeSockets.set(socket_id, socketData);

    screen_share_uuid = crypto.randomUUID(); // Generate a unique UUID for the screen share
    data.screen_share_uuid = screen_share_uuid;
  } 
  
  send_to_all_except_sender(members,data,'screen_share_started',socket_id);
  return screen_share_uuid;
}

function stop_screen_share(socket_id, chat_id,screen_share_uuid,members) {
  // Stop screen sharing
  const socketData = activeSockets.get(socket_id);
  let comms_id = null;

  if (socketData) {
    comms_id = socketData.comms_id;
    socketData.active_screen_shares = socketData.active_screen_shares.filter(id => id !== screen_share_uuid);
    activeSockets.set(socket_id, socketData);
  }
  const data = {
    to: chat_id,
    from: comms_id,
    screen_share_uuid: screen_share_uuid
  };

  send_to_all_except_sender(members,data,'screen_share_stopped',socket_id);
  return true;
}

module.exports = { 
  server, 
  close_socket,
  send_messages_to_recipients, 
  send_groups_to_recipients,
  getActiveSockets,
  send_group_member_joined,
  send_member_member_joined,
  get_users_info_room,
  send_left_member_to_comms,
  send_joined_member_to_comms,
  join_comms,
  leave_comms,
  get_socket_id,
  get_comms_id,
  send_to_all_except_sender,
  start_screen_share,
  stop_screen_share,
};
