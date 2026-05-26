(function () {
  if (window.JellyBuilder && window.JellyBuilder.Api) return;

  // Global Context Setup
  window.JellyBuilder = Object.assign({
    ServerUrl: '',
    ApiToken: '',
    UserId: '',
  }, window.JellyBuilder);

  // Core API Client Wrapper
  window.JellyBuilder.Api = {
    async getItems(query = {}) {
      const server = window.JellyBuilder.ServerUrl || window.location.origin;
      const url = new URL(`${server}/Items`);
      
      if (window.JellyBuilder.UserId) {
        url.searchParams.append('UserId', window.JellyBuilder.UserId);
      }
      
      Object.keys(query).forEach(key => {
        url.searchParams.append(key, query[key]);
      });
      
      const headers = {
        'Accept': 'application/json'
      };
      
      if (window.JellyBuilder.ApiToken) {
        headers['X-MediaBrowser-Token'] = window.JellyBuilder.ApiToken;
        headers['Authorization'] = `MediaBrowser Token="${window.JellyBuilder.ApiToken}"`;
      }
      
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Jellyfin API error: ${response.statusText}`);
      }
      return response.json();
    }
  };

  // Pub/Sub Event Bus
  window.JellyBuilder.EventBus = {
    listeners: {},
    
    on(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    },
    
    off(event, callback) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    },
    
    emit(event, data) {
      if (!this.listeners[event]) return;
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`JellyCMS EventBus: Error calling listener for event '${event}'`, e);
        }
      });
    }
  };

  // Fallbacks if not injected (e.g. running in Jellyfin Client localStorage context)
  try {
    if (!window.JellyBuilder.ApiToken && window.localStorage) {
      const credentialsJson = window.localStorage.getItem('user_credentials') || window.localStorage.getItem('api_key');
      if (credentialsJson) {
        try {
          const creds = JSON.parse(credentialsJson);
          window.JellyBuilder.ApiToken = creds.AccessToken || creds.Token || '';
          window.JellyBuilder.UserId = creds.UserId || '';
        } catch {
          window.JellyBuilder.ApiToken = credentialsJson;
        }
      }

      if (!window.JellyBuilder.ApiToken) {
        const serversJson = window.localStorage.getItem('servers');
        if (serversJson) {
          try {
            const servers = JSON.parse(serversJson);
            const activeServer = servers.find(s => s.accessToken) || servers[0];
            if (activeServer) {
              window.JellyBuilder.ApiToken = activeServer.accessToken || '';
              window.JellyBuilder.UserId = activeServer.userId || '';
              if (!window.JellyBuilder.ServerUrl) {
                window.JellyBuilder.ServerUrl = activeServer.url || '';
              }
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('JellyCMS: Could not load credentials from localStorage', e);
  }

  // WebSocket connection & proxy
  let wsConn = null;
  function connectWebSocket() {
    if (!window.JellyBuilder.ApiToken) {
      // Retry in 3 seconds to wait for login/token load
      setTimeout(connectWebSocket, 3000);
      return;
    }
    
    try {
      const server = window.JellyBuilder.ServerUrl || window.location.origin;
      const wsProto = server.startsWith('https:') ? 'wss:' : 'ws:';
      
      let host = window.location.host;
      try {
        const u = new URL(server);
        host = u.host;
      } catch {}

      const wsUrl = `${wsProto}//${host}/api?api_key=${window.JellyBuilder.ApiToken}`;
      wsConn = new WebSocket(wsUrl);
      
      wsConn.onopen = () => {
        console.log('JellyCMS: Core WebSocket connected to Jellyfin');
      };

      wsConn.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.MessageType) {
            // Re-broadcast Jellyfin socket events on EventBus
            window.JellyBuilder.EventBus.emit(`jellyfin:${msg.MessageType}`, msg.Data || msg);
          }
        } catch (err) {
          // Silent parse failure for non-JSON frame payloads
        }
      };

      wsConn.onclose = () => {
        console.log('JellyCMS: Core WebSocket closed. Reconnecting in 5s...');
        setTimeout(connectWebSocket, 5000);
      };

      wsConn.onerror = (err) => {
        console.error('JellyCMS: Core WebSocket error', err);
        wsConn.close();
      };
    } catch (e) {
      console.error('JellyCMS: Failed to initialize WebSocket', e);
      setTimeout(connectWebSocket, 5000);
    }
  }

  // Start connection
  connectWebSocket();
})();
