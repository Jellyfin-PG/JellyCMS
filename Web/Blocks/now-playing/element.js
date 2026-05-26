class JfNowPlaying extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-now-playing');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
    this._wsCallback = () => this.fetchData();
  }

  static get observedAttributes() {
    return ['data-title', 'data-show_admin_only'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
    // Connect to JellyBuilder EventBus for real-time WebSocket session updates
    if (window.JellyBuilder && window.JellyBuilder.EventBus) {
      window.JellyBuilder.EventBus.on('jellyfin:Sessions', this._wsCallback);
    }
    // Fallback polling every 10 seconds just in case WS drops
    this._pollInterval = setInterval(() => this.fetchData(), 10000);
  }

  disconnectedCallback() {
    if (window.JellyBuilder && window.JellyBuilder.EventBus) {
      window.JellyBuilder.EventBus.off('jellyfin:Sessions', this._wsCallback);
    }
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
    }
  }

  async fetchData() {
    const root = this.shadowRoot.querySelector('#sessions-root');
    const titleEl = this.shadowRoot.querySelector('#sessions-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Live Server Activity';
    if (titleEl) titleEl.textContent = title;

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups(root);
      return;
    }

    try {
      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;
      const url = `${serverUrl}/Sessions`;
      const headers = {
        'Accept': 'application/json',
        'X-MediaBrowser-Token': window.JellyBuilder.ApiToken,
        'Authorization': `MediaBrowser Token="${window.JellyBuilder.ApiToken}"`
      };

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const sessions = await res.json();

      root.innerHTML = '';

      // Filter active playback sessions only
      const activeSessions = (sessions || []).filter(s => s.NowPlayingItem);

      if (activeSessions.length === 0) {
        root.innerHTML = '<div class="no-sessions">No active streams on the server right now.</div>';
        return;
      }

      activeSessions.forEach(session => {
        const item = session.NowPlayingItem;
        const card = document.createElement('div');
        card.className = 'session-card';

        const poster = document.createElement('div');
        poster.className = 'session-poster';
        if (item.Id) {
          poster.style.backgroundImage = `url('${serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=200')`;
        }
        card.appendChild(poster);

        const details = document.createElement('div');
        details.className = 'session-details';

        // User row
        const userRow = document.createElement('div');
        userRow.className = 'session-user-row';
        const avatar = document.createElement('div');
        avatar.className = 'session-user-avatar';
        if (session.UserId) {
          avatar.style.backgroundImage = `url('${serverUrl}/Users/${session.UserId}/Images/Primary?tag=${session.UserPrimaryImageTag || ""}')`;
        }
        avatar.textContent = session.UserName ? session.UserName.charAt(0).toUpperCase() : '?';
        const name = document.createElement('span');
        name.className = 'session-username';
        name.textContent = session.UserName || 'Anonymous';
        userRow.appendChild(avatar);
        userRow.appendChild(name);
        details.appendChild(userRow);

        // Media Title
        const mTitle = document.createElement('div');
        mTitle.className = 'session-media-title';
        mTitle.textContent = item.Name;
        details.appendChild(mTitle);

        // Subtitle (Season/Episode info or year)
        const mSubtitle = document.createElement('div');
        mSubtitle.className = 'session-media-subtitle';
        if (item.IndexNumber !== undefined && item.ParentIndexNumber !== undefined) {
          mSubtitle.textContent = `S${item.ParentIndexNumber}E${item.IndexNumber} - ${item.SeriesName || ''}`;
        } else {
          mSubtitle.textContent = item.ProductionYear || '';
        }
        details.appendChild(mSubtitle);

        // Progress Bar
        const playState = session.PlayState || {};
        const positionTicks = playState.PositionTicks || 0;
        const totalTicks = item.RunTimeTicks || 0;
        let percentage = 0;
        let durationText = '';

        if (totalTicks > 0) {
          percentage = Math.min(100, Math.max(0, (positionTicks / totalTicks) * 100));
          const posSec = Math.floor(positionTicks / 10000000);
          const totSec = Math.floor(totalTicks / 10000000);
          durationText = `${this.formatTime(posSec)} / ${this.formatTime(totSec)}`;
        }

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        const barBg = document.createElement('div');
        barBg.className = 'progress-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'progress-bar-fill';
        barFill.style.width = `${percentage}%`;
        barBg.appendChild(barFill);

        const timeRow = document.createElement('div');
        timeRow.className = 'progress-time-row';
        timeRow.innerHTML = `<span>${durationText}</span>`;
        progressContainer.appendChild(barBg);
        progressContainer.appendChild(timeRow);
        details.appendChild(progressContainer);

        // Footer Info Row
        const footerRow = document.createElement('div');
        footerRow.className = 'session-footer-row';
        const client = document.createElement('span');
        client.className = 'session-client';
        client.textContent = session.Client || 'Unknown Device';
        
        // Direct Play / Transcode badge
        const badge = document.createElement('span');
        const isTranscoding = playState.PlayMethod === 'Transcode' || (session.TranscodingInfo && session.TranscodingInfo.IsVideoDirect === false);
        badge.className = `session-stream-badge ${isTranscoding ? 'transcoding' : 'direct-play'}`;
        badge.textContent = isTranscoding ? 'Transcoding' : 'Direct Play';

        footerRow.appendChild(client);
        footerRow.appendChild(badge);
        details.appendChild(footerRow);

        card.appendChild(details);
        root.appendChild(card);
      });
    } catch (err) {
      console.error('JellyCMS: Failed to fetch active sessions', err);
      root.innerHTML = `<div class="error">Error querying active streams: ${err.message}</div>`;
    }
  }

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  renderMockups(container) {
    container.innerHTML = '';
    const mocks = [
      {
        user: 'Jane Doe',
        avatarText: 'J',
        title: 'Inception',
        sub: '2010 • Sci-Fi / Thriller',
        percent: 68,
        time: '1:40:22 / 2:28:00',
        client: 'Apple TV',
        transcode: false
      },
      {
        user: 'John Smith',
        avatarText: 'S',
        title: 'The Alchemist',
        sub: 'S01E03 • Episode Title',
        percent: 22,
        time: '11:15 / 51:00',
        client: 'Web Client',
        transcode: true
      }
    ];

    mocks.forEach(mock => {
      const card = document.createElement('div');
      card.className = 'session-card';
      card.style.opacity = '0.85';
      card.style.pointerEvents = 'none';

      const poster = document.createElement('div');
      poster.className = 'session-poster';
      poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '2.5rem';
      poster.innerHTML = '🎬';
      card.appendChild(poster);

      const details = document.createElement('div');
      details.className = 'session-details';

      // User row
      const userRow = document.createElement('div');
      userRow.className = 'session-user-row';
      const avatar = document.createElement('div');
      avatar.className = 'session-user-avatar';
      avatar.textContent = mock.avatarText;
      const name = document.createElement('span');
      name.className = 'session-username';
      name.textContent = mock.user;
      userRow.appendChild(avatar);
      userRow.appendChild(name);
      details.appendChild(userRow);

      // Media Title
      const mTitle = document.createElement('div');
      mTitle.className = 'session-media-title';
      mTitle.textContent = mock.title;
      details.appendChild(mTitle);

      // Subtitle
      const mSubtitle = document.createElement('div');
      mSubtitle.className = 'session-media-subtitle';
      mSubtitle.textContent = mock.sub;
      details.appendChild(mSubtitle);

      // Progress Bar
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-container';
      const barBg = document.createElement('div');
      barBg.className = 'progress-bar-bg';
      const barFill = document.createElement('div');
      barFill.className = 'progress-bar-fill';
      barFill.style.width = `${mock.percent}%`;
      barBg.appendChild(barFill);

      const timeRow = document.createElement('div');
      timeRow.className = 'progress-time-row';
      timeRow.innerHTML = `<span>${mock.time}</span>`;
      progressContainer.appendChild(barBg);
      progressContainer.appendChild(timeRow);
      details.appendChild(progressContainer);

      // Footer Row
      const footerRow = document.createElement('div');
      footerRow.className = 'session-footer-row';
      const client = document.createElement('span');
      client.className = 'session-client';
      client.textContent = mock.client;
      
      const badge = document.createElement('span');
      badge.className = `session-stream-badge ${mock.transcode ? 'transcoding' : 'direct-play'}`;
      badge.textContent = mock.transcode ? 'Transcoding' : 'Direct Play';

      footerRow.appendChild(client);
      footerRow.appendChild(badge);
      details.appendChild(footerRow);

      card.appendChild(details);
      container.appendChild(card);
    });
  }
}

if (!customElements.get('jf-now-playing')) {
  customElements.define('jf-now-playing', JfNowPlaying);
}
