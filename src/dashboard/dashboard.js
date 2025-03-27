const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const envManager = require('../security/envManager');
const logger = require('../logger');
const redisClient = require('../database/cache');
const database = require('../database/database');
const socketio = require('../web_services/socketio');

const LOGS_PATH = envManager.readLogsPath();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get all active sockets
app.get('/api/sockets', async (req, res) => {
  try {
      const rawSockets = socketio.getActiveSockets();
      
      // Estrai tutti gli user_id unici
      const userIds = [...new Set(rawSockets.map(socket => socket.user_id))];
      
      // Recupera tutti gli handle in una singola query
      logger.debug("[DASHBOARD] Recover handles from ids -> sockets");
      const handleMap = await database.get_handles_from_ids(userIds);
      
      // Trasforma i socket con gli handle recuperati
      const sockets = rawSockets.map(socket => ({
          id: socket.socket_id,
          user_id: socket.user_id,
          handle: handleMap[socket.user_id] || 'Unknown',
          connected_at: socket.connected_at
      }));
      
      res.json(sockets);
  } catch (error) {
      logger.error('[DASHBOARD] Error fetching sockets:', error);
      res.status(500).json({ error: 'Failed to fetch socket data' });
  }
});

// API endpoint to get all log files
app.get('/api/logs', (req, res) => {
  try {
    const logsDir = LOGS_PATH;
    
    // Read all files in logs directory
    fs.readdir(logsDir, (err, files) => {
      if (err) {
        logger.error('Error reading logs directory:', err);
        return res.status(500).json({ error: 'Failed to read logs directory' });
      }
      
      // Filter to only include .log files
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      console.log('Sending log files:', logFiles); // Debug output
      res.json(logFiles);
    });
  } catch (error) {
    logger.error('Error fetching log files:', error);
    res.status(500).json({ error: 'Failed to fetch log files' });
  }
});

// API endpoint to get log file content
app.get('/api/logs/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    // Basic security check to prevent directory traversal
    if (filename.includes('..') || !filename.endsWith('.log')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(LOGS_PATH, filename);
    const content = await promisify(fs.readFile)(filePath, 'utf8');
    res.send(content);
  } catch (error) {
    logger.error(`[DASHBOARD] Error reading log file ${req.params.filename}:`, error);
    res.status(500).json({ error: 'Failed to read log file' });
  }
});

// API endpoint to get Redis sessions
app.get('/api/redis/sessions', async (req, res) => {
  try {
      const keys = await redisClient.keys('sess:*');
      
      // Estrai tutti gli user_id unici
      const userIds = [...new Set(
          keys
              .map(async key => {
                  const sessionData = JSON.parse(await redisClient.get(key));
                  return sessionData.user_id;
              })
              .filter(id => id && id !== "unknown")
      )];
      
      // Recupera tutti gli handle in una singola query
      logger.debug("[DASHBOARD] Recover handles from ids -> sessions");
      const handleMap = await database.get_handles_from_ids(userIds);
      
      const sessionGroups = {};
      
      for (const key of keys) {
          const sessionData = await redisClient.get(key);
          let parsedData;
          
          try {
              parsedData = JSON.parse(sessionData);
          } catch (e) {
              parsedData = { data: sessionData, error: "Could not parse as JSON" };
          }
          
          const sessionId = key.split(':')[1];
          const userId = parsedData.user_id || "unknown";
          
          // Usa la mappa degli handle
          const handle = userId !== "unknown" 
              ? handleMap[userId] || userId 
              : "unknown";
          
          if (!sessionGroups[handle]) {
              sessionGroups[handle] = [];
          }
          
          sessionGroups[handle].push({
              key,
              sessionId,
              data: parsedData,
              userId: userId
          });
      }
      
      res.json(sessionGroups);
  } catch (error) {
      logger.error('Error fetching Redis sessions:', error);
      res.status(500).json({ error: 'Failed to fetch Redis sessions' });
  }
});

// WebSocket setup for real-time log updates
wss.on('connection', (ws) => {
  logger.log('[DASHBOARD] WebSocket client connected');
  
  // Set up file watcher for logs
  const logsDir = LOGS_PATH;
  let currentLogFile = null;
  let watcher = null;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'watchFile' && data.filename) {
        // Stop watching previous file if any
        if (watcher) {
          watcher.close();
        }
        
        currentLogFile = path.join(logsDir, data.filename);
        
        // Start watching the new file
        watcher = fs.watch(currentLogFile, (eventType) => {
          if (eventType === 'change') {
            fs.readFile(currentLogFile, 'utf8', (err, content) => {
              if (err) {
                logger.error('[DASHBOARD] Error reading log file:', err);
                return;
              }
              
              ws.send(JSON.stringify({
                type: 'logUpdate',
                content
              }));
            });
          }
        });
        
        // Send initial content
        fs.readFile(currentLogFile, 'utf8', (err, content) => {
          if (err) {
            logger.error('[DASHBOARD] Error reading log file:', err);
            return;
          }
          
          ws.send(JSON.stringify({
            type: 'logUpdate',
            content
          }));
        });
      }
    } catch (error) {
      logger.error('[DASHBOARD] Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    logger.log('[DASHBOARD] WebSocket client disconnected');
    if (watcher) {
      watcher.close();
    }
  });
});

// Default route to serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'index.html'));
  });

  app.get('/logs.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'logs.html'));
  });
  
  app.get('/io.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'io.html'));
  });
  
  app.get('/sessions.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'sessions.html'));
  });
  
  app.get('*', (req, res) => {
    res.status(404).send('Page not found');
  });

  

function startServer(port, callback) {
    server.listen(port, () => {
      if (callback) callback();
    });
  }

module.exports = {
  startServer
};