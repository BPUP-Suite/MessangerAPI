// Log Viewer script

document.addEventListener('DOMContentLoaded', function() {
    const logFilesList = document.getElementById('log-files-list');
    const logDisplay = document.getElementById('log-display');
    const currentLogTitle = document.getElementById('current-log-title');
    const refreshLogsButton = document.getElementById('refresh-logs');
    const autoScrollCheckbox = document.getElementById('auto-scroll');
    
    let ws = null;
    let currentLogFile = null;
    
    // Initial fetch of log files
    fetchLogFiles();
    
    // Add refresh button event listener
    refreshLogsButton.addEventListener('click', fetchLogFiles);
    
    // Function to fetch log files
    async function fetchLogFiles() {
      try {
        logFilesList.innerHTML = '<li class="loading">Loading log files...</li>';
        
        const response = await fetch('/api/logs');
        const logFiles = await response.json();
        
        console.log('Retrieved log files:', logFiles); // Debug to see what's returned
        
        if (!logFiles || logFiles.length === 0) {
          logFilesList.innerHTML = '<li class="empty-state">No log files found</li>';
          return;
        }
        
        // Sort log files by date (assuming format like YYYY-MM-DD.log)
        logFiles.sort((a, b) => {
          // Extract date part from filename
          const dateA = a.replace('.log', '');
          const dateB = b.replace('.log', '');
          return new Date(dateB) - new Date(dateA); // Newest first
        });
        
        // Clear list
        logFilesList.innerHTML = '';
        
        // Add log files to list
        logFiles.forEach(file => {
          const li = document.createElement('li');
          li.textContent = file;
          li.addEventListener('click', () => loadLogFile(file));
          
          // Mark active if this is the current log
          if (file === currentLogFile) {
            li.classList.add('active');
          }
          
          logFilesList.appendChild(li);
        });
        
      } catch (error) {
        console.error('Error fetching log files:', error);
        logFilesList.innerHTML = `
          <li class="error">Error loading log files: ${error.message}</li>
        `;
      }
    }
    
    // Function to load log file content
    function loadLogFile(filename) {
      // Update UI to show which file is selected
      const items = logFilesList.querySelectorAll('li');
      items.forEach(item => item.classList.remove('active'));
      const selectedItem = Array.from(items).find(item => item.textContent === filename);
      if (selectedItem) {
        selectedItem.classList.add('active');
      }
      
      currentLogTitle.textContent = filename;
      currentLogFile = filename;
      
      // Close existing WebSocket connection if any
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      
      // Create new WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onopen = function() {
        // Request to watch the selected log file
        ws.send(JSON.stringify({
          type: 'watchFile',
          filename: filename
        }));
      };
      
      ws.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'logUpdate') {
            displayLogContent(data.content);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        logDisplay.innerHTML = `<p class="error">Error connecting to server</p>`;
    };
    
    ws.onclose = function() {
      console.log('WebSocket connection closed');
    };
  }
  
  // Function to display log content with colorization
  function displayLogContent(content) {
    // Clear the display area
    logDisplay.innerHTML = '';
    
    if (!content || content.trim() === '') {
      logDisplay.innerHTML = '<p class="empty-state">Log file is empty</p>';
      return;
    }
    
    // Split the content into lines
    const lines = content.split('\n');
    
    // Process each line and add colorization based on log type
    lines.forEach(line => {
      if (line.trim() === '') return;
      
      const logLine = document.createElement('div');
      logLine.className = 'log-line';
      
      // Check for log type patterns and apply appropriate class
      if (line.includes('[LOG]')) {
        logLine.classList.add('log');
      } else if (line.includes('[DEBUG]')) {
        logLine.classList.add('debug');
      } else if (line.includes('[WARN]')) {
        logLine.classList.add('warn');
      } else if (line.includes('[ERROR]')) {
        logLine.classList.add('error');
      } else {
        logLine.classList.add('log'); // Default to log style
      }
      
      logLine.textContent = line;
      logDisplay.appendChild(logLine);
    });
    
    // Auto-scroll to bottom if checked
    if (autoScrollCheckbox.checked) {
      logDisplay.scrollTop = logDisplay.scrollHeight;
    }
  }
});