// Redis Sessions Manager script

document.addEventListener('DOMContentLoaded', function() {
    const sessionsContainer = document.getElementById('sessions-container');
    const refreshButton = document.getElementById('refresh-sessions');
    
    // Initial fetch
    fetchSessions();
    
    // Add refresh button event listener
    refreshButton.addEventListener('click', fetchSessions);
    
    // Function to fetch and display Redis sessions
    async function fetchSessions() {
      try {
        sessionsContainer.innerHTML = '<div class="loading">Loading sessions...</div>';
        
        const response = await fetch('/api/redis/sessions');
        const sessionGroups = await response.json();
        
        if (Object.keys(sessionGroups).length === 0) {
          sessionsContainer.innerHTML = '<p class="empty-state">No Redis sessions found</p>';
          return;
        }
        
        // Clear container
        sessionsContainer.innerHTML = '';
        
        // Create session group elements
        Object.keys(sessionGroups).forEach(async user_id => {
          const sessions = sessionGroups[user_id];
          
          const sessionGroup = document.createElement('div');
          sessionGroup.className = 'socket-group'; // Reuse socket group styling
          
          const sessionGroupHeader = document.createElement('div');
          sessionGroupHeader.className = 'socket-group-header'; // Reuse socket group header styling
          
          // Create toggle arrow
          const toggleArrow = document.createElement('span');
          toggleArrow.className = 'toggle-arrow collapsed'; // Use 'collapsed' instead of 'expanded'
          toggleArrow.innerHTML = '&#9654;'; // Right arrow (collapsed state)
          toggleArrow.style.cursor = 'pointer';
          toggleArrow.style.marginRight = '8px';
          toggleArrow.style.display = 'inline-block';
          
          // Create header with title
          const headerTitle = document.createElement('h3');
          headerTitle.style.display = 'inline-block';
          const response = await fetch('/api/get/handle?user_id='+user_id);
          const { handle } = await response.json();
          headerTitle.textContent = handle;
          
          const sessionCount = document.createElement('div');
          sessionCount.className = 'session-count';
          sessionCount.textContent = sessions.length; 
          
          // Add elements to header
          sessionGroupHeader.appendChild(toggleArrow);
          sessionGroupHeader.appendChild(headerTitle);
          sessionGroupHeader.appendChild(sessionCount);
          
          const sessionList = document.createElement('ul');
          sessionList.className = 'session-list';
          sessionList.style.display = 'none'; // Hide list by default
          
          // Add toggle functionality
          toggleArrow.addEventListener('click', () => {
            // Toggle visibility of session list
            if (sessionList.style.display === 'none') {
              sessionList.style.display = 'block';
              toggleArrow.innerHTML = '&#9660;'; // Down arrow
              toggleArrow.classList.remove('collapsed');
              toggleArrow.classList.add('expanded');
            } else {
              sessionList.style.display = 'none';
              toggleArrow.innerHTML = '&#9654;'; // Right arrow
              toggleArrow.classList.remove('expanded');
              toggleArrow.classList.add('collapsed');
            }
          });
          
          sessions.forEach(session => {
            const sessionItem = document.createElement('li');
            sessionItem.className = 'socket-item'; // Reuse socket item styling
            
            // Create container for session details
            const sessionDetails = document.createElement('div');
            sessionDetails.className = 'session-details';
            
            // Create session header with ID
            const sessionHeader = document.createElement('div');
            sessionHeader.className = 'session-header-small';
            sessionHeader.innerHTML = `<strong>Session ID:</strong> ${session.sessionId}`;
            
            // Create expandable container for session data
            const expandButton = document.createElement('button');
            expandButton.className = 'btn btn-small';
            expandButton.textContent = 'View Data';
            expandButton.addEventListener('click', function() {
              const dataContent = sessionItem.querySelector('.session-data-content');
              dataContent.classList.toggle('active');
              this.textContent = dataContent.classList.contains('active') 
                ? 'Hide Data' 
                : 'View Data';
            });
            
            // Container for session data
            const sessionDataContent = document.createElement('div');
            sessionDataContent.className = 'session-data-content';
            
            // Format session data as JSON with indentation
            const formattedData = JSON.stringify(session.data, null, 2);
            
            const sessionData = document.createElement('pre');
            sessionData.className = 'session-data';
            sessionData.textContent = formattedData;
            
            // Assemble the components
            sessionDataContent.appendChild(sessionData);
            sessionDetails.appendChild(sessionHeader);
            sessionDetails.appendChild(expandButton);
            sessionDetails.appendChild(sessionDataContent);
            sessionItem.appendChild(sessionDetails);
            sessionList.appendChild(sessionItem);
          });
          
          sessionGroup.appendChild(sessionGroupHeader);
          sessionGroup.appendChild(sessionList);
          sessionsContainer.appendChild(sessionGroup);
        });
        
      } catch (error) {
        console.error('Error fetching Redis sessions:', error);
        sessionsContainer.innerHTML = `
          <p class="error">Error loading sessions: ${error.message}</p>
        `;
      }
    }


    function displaySessionData(sessionData, container) {
        // Clear previous content
        container.innerHTML = '';

        // Create element for the session data
        const dataElement = document.createElement('pre');
        dataElement.className = 'session-data';

        // Format the JSON data and add to element
        dataElement.textContent = JSON.stringify(sessionData, null, 2);

        // Add to container
        container.appendChild(dataElement);
    }
  });