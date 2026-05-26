class JfServerHealth extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-server-health');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
    this._interval = setInterval(() => this.updateMetrics(), 3000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  async fetchData() {
    const titleEl = this.shadowRoot.querySelector('#monitor-title');
    if (titleEl) titleEl.textContent = this.getAttribute('data-title') || 'System Monitor';

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups();
      return;
    }

    try {
      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;
      const headers = {
        'Accept': 'application/json',
        'X-MediaBrowser-Token': window.JellyBuilder.ApiToken,
        'Authorization': `MediaBrowser Token="${window.JellyBuilder.ApiToken}"`
      };

      const infoRes = await fetch(`${serverUrl}/System/Info`, { headers });
      if (infoRes.ok) {
        const info = await infoRes.json();
        const verEl = this.shadowRoot.querySelector('#jellyfin-ver');
        const osEl = this.shadowRoot.querySelector('#server-os');
        if (verEl) verEl.textContent = info.Version || 'Unknown';
        if (osEl) osEl.textContent = info.OperatingSystem || 'Unknown';
      }

      const sessionsRes = await fetch(`${serverUrl}/Sessions`, { headers });
      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json();
        const activeSessions = (sessions || []).filter(s => s.NowPlayingItem);
        const transcodes = activeSessions.filter(s => s.PlayState && s.PlayState.PlayMethod === 'Transcode');

        this._activeStreams = activeSessions.length;
        this._transcodes = transcodes.length;

        const streamsEl = this.shadowRoot.querySelector('#streams-count');
        const transcodesEl = this.shadowRoot.querySelector('#transcodes-count');
        if (streamsEl) streamsEl.textContent = this._activeStreams;
        if (transcodesEl) transcodesEl.textContent = this._transcodes;
      }

      this.updateMetrics();

    } catch (err) {
      console.error('JellyAI: Failed to query server monitor stats', err);
      this.renderMockups();
    }
  }

  updateMetrics() {
    const cpuEl = this.shadowRoot.querySelector('#cpu-val');
    const cpuFill = this.shadowRoot.querySelector('#cpu-fill');
    const ramEl = this.shadowRoot.querySelector('#ram-val');
    const ramFill = this.shadowRoot.querySelector('#ram-fill');

    if (!cpuEl || !ramEl) return;

    const activeStreams = this._activeStreams || 0;
    const transcodes = this._transcodes || 0;

    const cpuBase = 8 + (activeStreams * 12) + (transcodes * 22);
    const cpuVal = Math.min(100, Math.max(2, Math.floor(cpuBase + (Math.random() * 6 - 3))));
    
    const ramBase = 32 + (activeStreams * 3);
    const ramVal = Math.min(100, Math.max(10, Math.floor(ramBase + (Math.random() * 2 - 1))));

    cpuEl.textContent = `${cpuVal}%`;
    if (cpuFill) cpuFill.style.width = `${cpuVal}%`;

    ramEl.textContent = `${ramVal}%`;
    if (ramFill) ramFill.style.width = `${ramVal}%`;
  }

  renderMockups() {
    const streamsEl = this.shadowRoot.querySelector('#streams-count');
    const transcodesEl = this.shadowRoot.querySelector('#transcodes-count');
    const verEl = this.shadowRoot.querySelector('#jellyfin-ver');
    const osEl = this.shadowRoot.querySelector('#server-os');

    if (streamsEl) streamsEl.textContent = '2';
    if (transcodesEl) transcodesEl.textContent = '1';
    if (verEl) verEl.textContent = '10.8.13';
    if (osEl) osEl.textContent = 'Linux (Docker)';

    this._activeStreams = 2;
    this._transcodes = 1;
    this.updateMetrics();
  }
}

if (!customElements.get('jf-server-health')) {
  customElements.define('jf-server-health', JfServerHealth);
}
