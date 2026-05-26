class JfLiveTvGuide extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-live-tv-guide');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-limit'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
  }

  async fetchData() {
    const root = this.shadowRoot.querySelector('#channels-root');
    const titleEl = this.shadowRoot.querySelector('#guide-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Live TV Guide';
    if (titleEl) titleEl.textContent = title;

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups(root);
      return;
    }

    try {
      const limit = parseInt(this.getAttribute('data-limit')) || 5;
      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;
      const headers = {
        'Accept': 'application/json',
        'X-MediaBrowser-Token': window.JellyBuilder.ApiToken,
        'Authorization': `MediaBrowser Token="${window.JellyBuilder.ApiToken}"`
      };

      const url = `${serverUrl}/LiveTv/Channels?limit=${limit}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      const items = data.Items || [];

      root.innerHTML = '';

      if (items.length === 0) {
        root.innerHTML = '<div class="empty">No live TV channels configured on the server.</div>';
        return;
      }

      items.forEach(channel => {
        const row = document.createElement('a');
        row.className = 'channel-row';
        row.href = `${serverUrl}/web/index.html#/details?id=${channel.Id}`;
        row.target = '_blank';

        const logo = document.createElement('div');
        logo.className = 'channel-badge';
        if (channel.ImageTags && channel.ImageTags.Primary) {
          logo.style.backgroundImage = `url('${serverUrl}/Items/${channel.Id}/Images/Primary?maxWidth=100')`;
        } else {
          logo.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
        }
        row.appendChild(logo);

        const info = document.createElement('div');
        info.className = 'channel-info';

        const nameRow = document.createElement('div');
        nameRow.className = 'channel-name-row';
        
        const num = document.createElement('span');
        num.className = 'channel-number';
        num.textContent = channel.Number || 'CH';
        
        const name = document.createElement('span');
        name.className = 'channel-name';
        name.textContent = channel.Name;

        nameRow.appendChild(num);
        nameRow.appendChild(name);
        info.appendChild(nameRow);

        const prog = channel.CurrentProgram || {};
        const pTitle = document.createElement('div');
        pTitle.className = 'now-airing-title';
        pTitle.textContent = prog.Name || 'Off Air / No Information';
        info.appendChild(pTitle);

        if (prog.StartDate && prog.EndDate) {
          const start = new Date(prog.StartDate);
          const end = new Date(prog.EndDate);
          const now = new Date();
          
          let pct = 0;
          const total = end - start;
          if (total > 0) {
            pct = Math.min(100, Math.max(0, ((now - start) / total) * 100));
          }

          const timeRow = document.createElement('div');
          timeRow.className = 'airing-time-row';
          const timeText = document.createElement('span');
          timeText.className = 'airing-time';
          timeText.textContent = `${this.formatTime(start)} - ${this.formatTime(end)}`;
          timeRow.appendChild(timeText);
          info.appendChild(timeRow);

          const barCont = document.createElement('div');
          barCont.className = 'progress-bar-container';
          const barFill = document.createElement('div');
          barFill.className = 'progress-bar-fill';
          barFill.style.width = `${pct}%`;
          barCont.appendChild(barFill);
          info.appendChild(barCont);
        }

        row.appendChild(info);

        const playBtn = document.createElement('div');
        playBtn.className = 'play-btn';
        playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        row.appendChild(playBtn);

        root.appendChild(row);
      });

    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="error">Failed to query Live TV Guide: ${err.message}</div>`;
    }
  }

  formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  renderMockups(container) {
    container.innerHTML = '';
    const mocks = [
      { Number: '2.1', Channel: 'HBO HD', Program: 'House of the Dragon', StartOff: -20, EndOff: 40 },
      { Number: '4.1', Channel: 'NBC', Program: 'NBC Nightly News', StartOff: -10, EndOff: 20 },
      { Number: '7.1', Channel: 'ESPN', Program: 'Live Sports Center', StartOff: -45, EndOff: 15 }
    ];

    mocks.forEach(mock => {
      const row = document.createElement('div');
      row.className = 'channel-row';
      row.style.pointerEvents = 'none';

      const logo = document.createElement('div');
      logo.className = 'channel-badge';
      logo.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      logo.style.display = 'flex';
      logo.style.alignItems = 'center';
      logo.style.justifyContent = 'center';
      logo.style.fontSize = '1.5rem';
      logo.innerHTML = '📺';
      row.appendChild(logo);

      const info = document.createElement('div');
      info.className = 'channel-info';

      const nameRow = document.createElement('div');
      nameRow.className = 'channel-name-row';
      
      const num = document.createElement('span');
      num.className = 'channel-number';
      num.textContent = mock.Number;
      
      const name = document.createElement('span');
      name.className = 'channel-name';
      name.textContent = mock.Channel;

      nameRow.appendChild(num);
      nameRow.appendChild(name);
      info.appendChild(nameRow);

      const pTitle = document.createElement('div');
      pTitle.className = 'now-airing-title';
      pTitle.textContent = mock.Program;
      info.appendChild(pTitle);

      const start = new Date(Date.now() + mock.StartOff * 60 * 1000);
      const end = new Date(Date.now() + mock.EndOff * 60 * 1000);
      const now = Date.now();
      const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

      const timeRow = document.createElement('div');
      timeRow.className = 'airing-time-row';
      const timeText = document.createElement('span');
      timeText.className = 'airing-time';
      timeText.textContent = `${this.formatTime(start)} - ${this.formatTime(end)}`;
      timeRow.appendChild(timeText);
      info.appendChild(timeRow);

      const barCont = document.createElement('div');
      barCont.className = 'progress-bar-container';
      const barFill = document.createElement('div');
      barFill.className = 'progress-bar-fill';
      barFill.style.width = `${pct}%`;
      barCont.appendChild(barFill);
      info.appendChild(barCont);

      row.appendChild(info);

      const playBtn = document.createElement('div');
      playBtn.className = 'play-btn';
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      row.appendChild(playBtn);

      container.appendChild(row);
    });
  }
}

if (!customElements.get('jf-live-tv-guide')) {
  customElements.define('jf-live-tv-guide', JfLiveTvGuide);
}
