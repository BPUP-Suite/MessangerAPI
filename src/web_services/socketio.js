const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('../logger');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Gestisce connessioni socket
io.on('connection', (socket) => {
  console.log('Un utente si è connesso:', socket.id);
  
  // Esempio di ricezione evento
  socket.on('messaggio', (data) => {
    console.log('Messaggio ricevuto:', data);
    // Invia a tutti i client connessi
    io.emit('messaggio', data);
  });
  
  // Disconnessione
  socket.on('disconnect', () => {
    console.log('Utente disconnesso:', socket.id);
  });
});


module.exports = server;