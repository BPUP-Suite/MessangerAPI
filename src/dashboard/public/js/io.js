// Socket Manager script

document.addEventListener('DOMContentLoaded', function() {
    const socketGroupsContainer = document.getElementById('socket-groups');
    const refreshButton = document.getElementById('refresh-sockets');
    
    // Initial fetch
    fetchSockets();
    
    // Add refresh button event listener
    refreshButton.addEventListener('click', fetchSockets);
    
    // Function to fetch and display sockets
    async function fetchSockets() {
      try {
        socketGroupsContainer.innerHTML = '<div class="loading">Loading sockets...</div>';
        
        const response = await fetch('/api/sockets');
        const sockets = await response.json();
        
        if (sockets.length === 0) {
          socketGroupsContainer.innerHTML = '<p class="empty-state">No active sockets found</p>';
          return;
        }
        
        // Group sockets by handle instead of user_id
        const socketGroups = {};
        sockets.forEach(socket => {
          // Use handle as the group key, fallback to user_id if handle is not available
          const groupKey = socket.handle || `User ${socket.user_id}`;
          
          if (!socketGroups[groupKey]) {
            socketGroups[groupKey] = [];
          }
          socketGroups[groupKey].push(socket);
        });
        
        // Clear container
        socketGroupsContainer.innerHTML = '';
        
        // Create socket group elements
        Object.keys(socketGroups).forEach(handle => {
          const groupSockets = socketGroups[handle];
          
          const socketGroup = document.createElement('div');
          socketGroup.className = 'socket-group';
          
          const socketGroupHeader = document.createElement('div');
          socketGroupHeader.className = 'socket-group-header';
          
          // Create toggle arrow
          const toggleArrow = document.createElement('span');
          toggleArrow.className = 'toggle-arrow collapsed';
          toggleArrow.innerHTML = '&#9654;'; // Right arrow (collapsed state)
          toggleArrow.style.cursor = 'pointer';
          toggleArrow.style.marginRight = '8px';
          toggleArrow.style.display = 'inline-block';
          
          // Create header with title
          const headerTitle = document.createElement('h3');
          headerTitle.style.display = 'inline-block';
          headerTitle.textContent = handle;
          
          const socketCount = document.createElement('div');
          socketCount.className = 'socket-count';
          socketCount.textContent = groupSockets.length;
          
          // Add elements to header
          socketGroupHeader.appendChild(toggleArrow);
          socketGroupHeader.appendChild(headerTitle);
          socketGroupHeader.appendChild(socketCount);
          
          const socketList = document.createElement('ul');
          socketList.className = 'socket-list';
          socketList.style.display = 'none'; // Hide list by default
          
          // Add toggle functionality
          toggleArrow.addEventListener('click', () => {
            // Toggle visibility of socket list
            if (socketList.style.display === 'none') {
              socketList.style.display = 'block';
              toggleArrow.innerHTML = '&#9660;'; // Down arrow
              toggleArrow.classList.remove('collapsed');
              toggleArrow.classList.add('expanded');
            } else {
              socketList.style.display = 'none';
              toggleArrow.innerHTML = '&#9654;'; // Right arrow
              toggleArrow.classList.remove('expanded');
              toggleArrow.classList.add('collapsed');
            }
          });
          
          groupSockets.forEach(socket => {
            const socketItem = document.createElement('li');
            socketItem.className = 'socket-item';
            
            const connectedDate = new Date(socket.connected_at);
            const formattedDate = connectedDate.toLocaleString();
            
            socketItem.innerHTML = `
              <div class="socket-id">Socket ID: ${socket.id}</div>
              <div class="socket-time">Connected at: ${formattedDate}</div>
              <div class="socket-user">User ID: ${socket.user_id}</div>
            `;
            
            socketList.appendChild(socketItem);
          });
          
          socketGroup.appendChild(socketGroupHeader);
          socketGroup.appendChild(socketList);
          socketGroupsContainer.appendChild(socketGroup);
        });
        
      } catch (error) {
        console.error('Error fetching sockets:', error);
        socketGroupsContainer.innerHTML = `<p class="error">Error loading sockets: ${error.message}</p>`;
      }
    }
  });