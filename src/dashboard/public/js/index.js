document.addEventListener('DOMContentLoaded', async function() {
  // Fetch counts for dashboard
  try {
    // Fetch active sockets count
    const socketsResponse = await fetch('/api/sockets');
    const sockets = await socketsResponse.json();
    document.getElementById('sockets-count').textContent = sockets.length;
    
    // Fetch log files count
    const logsResponse = await fetch('/api/logs');
    const logFiles = await logsResponse.json();
    document.getElementById('logs-count').textContent = logFiles.length;
    
    // Fetch Redis sessions count - Fix the endpoint to match your actual API
    const redisResponse = await fetch('/api/redis/sessions'); 
    const sessionGroups = await redisResponse.json();
    
    // Count total sessions across all groups
    const totalSessions = Object.values(sessionGroups).reduce((total, sessions) => {
      return total + sessions.length;
    }, 0);
    
    // Update the counter with the correct element ID
    document.getElementById('sessions-counter').textContent = totalSessions;
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }
});