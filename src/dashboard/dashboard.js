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

// Metrics setup
const register = require('./metrics').register;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});


app.get('/api/get/handle', async(req,res) => {
  const user_id = req.query.user_id;
  const handle = await database.get_handle_from_id(user_id);
  return res.status(200).json({handle:handle});
});

// API endpoint to get all active sockets
app.get('/api/sockets', async (req, res) => {
    try {
        const rawSockets = socketio.getActiveSockets();
        
        // Transform sockets data to include handles instead of user_ids
        const sockets = await Promise.all(rawSockets.map(async socket => {
          
          return {
            id: socket.socket_id,
            user_id: socket.user_id,
            connected_at: socket.connected_at
          };
        }));
        
        res.json(sockets);
      } catch (error) {
        logger.error('[DASHBOARD] Error fetching sockets:', error);
        res.status(500).json({ error: 'Failed to fetch socket data' });
      }
});

// API endpoint to get log files list
app.get('/api/logs', async (req, res) => {
  try {
    const logsDir = path.join(LOGS_PATH); 
    const files = await promisify(fs.readdir)(logsDir);
    const logFiles = files.filter(file => file.endsWith('.log'));
    res.json(logFiles);
  } catch (error) {
    logger.error('[DASHBOARD] Error fetching log files:', error);
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
      // Get all keys matching the pattern for sessions
      const keys = await redisClient.keys('sess:*');
      
      // Object to store sessions grouped by handle
      const sessionGroups = {};
      
      for (const key of keys) {
        const sessionData = await redisClient.get(key);
        let parsedData;
        
        try {
          parsedData = JSON.parse(sessionData);
        } catch (e) {
          parsedData = { data: sessionData, error: "Could not parse as JSON" };
        }
        
        // Extract session ID from the key
        const sessionId = key.split(':')[1];
        
        // Get the user_id from the session data or use "unknown" if not available
        const userId = parsedData.user_id || "unknown";
        
        // Initialize group if it doesn't exist
        if (!sessionGroups[userId]) {
          sessionGroups[userId] = [];
        }
        
        // Add this session to the appropriate group
        sessionGroups[userId].push({
          key,
          sessionId,
          data: parsedData,
          userId: userId // Keep the user_id in the data for reference
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
  logger.debug('[DASHBOARD] WebSocket client connected');
  
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