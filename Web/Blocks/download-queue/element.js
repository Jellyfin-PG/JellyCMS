class JfDownloadQueue extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-download-queue');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-service_type', 'data-api_url', 'data-api_key'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
    this._interval = setInterval(() => this.fetchData(), 10000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  async fetchData() {
    const root = this.shadowRoot.querySelector('#queue-root');
    const titleEl = this.shadowRoot.querySelector('#queue-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Active Downloads';
    if (titleEl) titleEl.textContent = title;

    const apiUrl = this.getAttribute('data-api_url');
    const apiKey = this.getAttribute('data-api_key');
    const serviceType = this.getAttribute('data-service_type') || 'Sonarr';

    if (!apiUrl || !apiKey) {
      this.renderMockups(root, serviceType);
      return;
    }

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const url = `${cleanUrl}/api/v3/queue?apikey=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      
      const records = data.records || [];
      root.innerHTML = '';

      if (records.length === 0) {
        root.innerHTML = '<div class="empty">No active downloads in queue.</div>';
        return;
      }

      records.forEach(item => {
        const row = document.createElement('div');
        row.className = 'queue-row';

        const top = document.createElement('div');
        top.className = 'row-top';

        const name = document.createElement('div');
        name.className = 'media-title';
        name.textContent = item.title;
        top.appendChild(name);

        if (item.timeleft) {
          const eta = document.createElement('span');
          eta.className = 'eta-badge';
          eta.textContent = item.timeleft;
          top.appendChild(eta);
        }
        row.appendChild(top);

        const mid = document.createElement('div');
        mid.className = 'row-mid';

        const sizeleft = item.sizeleft || 0;
        const sizeTotal = item.size || 1;
        const progressPct = Math.min(100, Math.max(0, Math.floor(((sizeTotal - sizeleft) / sizeTotal) * 100)));

        const details = document.createElement('span');
        details.textContent = `${progressPct}% - ${item.status || 'downloading'}`;

        const sizeTxt = document.createElement('span');
        sizeTxt.textContent = `${this.formatBytes(sizeTotal - sizeleft)} / ${this.formatBytes(sizeTotal)}`;

        mid.appendChild(details);
        mid.appendChild(sizeTxt);
        row.appendChild(mid);

        const prog = document.createElement('div');
        prog.className = 'progress-container';
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.width = `${progressPct}%`;
        prog.appendChild(fill);
        row.appendChild(prog);

        root.appendChild(row);
      });

    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="error">Failed to query queue: ${err.message}</div>`;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  renderMockups(container, serviceType) {
    container.innerHTML = '';
    const mocks = serviceType === 'Sonarr' ? [
      { Title: 'Shogun S01E06 - Ladies of the Willow World', Size: 2450000000, Left: 820000000, ETA: '00:04:12', Status: 'downloading' },
      { Title: 'Fallout S01E08 - The Beginning', Size: 3200000000, Left: 3200000000, ETA: 'Queued', Status: 'paused' }
    ] : [
      { Title: 'Dune: Part Two (2024)', Size: 12800000000, Left: 4300000000, ETA: '00:18:45', Status: 'downloading' }
    ];

    mocks.forEach(item => {
      const row = document.createElement('div');
      row.className = 'queue-row';

      const top = document.createElement('div');
      top.className = 'row-top';

      const name = document.createElement('div');
      name.className = 'media-title';
      name.textContent = item.Title;
      top.appendChild(name);

      const eta = document.createElement('span');
      eta.className = 'eta-badge';
      eta.textContent = item.ETA;
      top.appendChild(eta);
      row.appendChild(top);

      const mid = document.createElement('div');
      mid.className = 'row-mid';

      const progressPct = Math.min(100, Math.floor(((item.Size - item.Left) / item.Size) * 100));
      const details = document.createElement('span');
      details.textContent = `${progressPct}% - ${item.Status}`;

      const sizeTxt = document.createElement('span');
      sizeTxt.textContent = `${this.formatBytes(item.Size - item.Left)} / ${this.formatBytes(item.Size)}`;

      mid.appendChild(details);
      mid.appendChild(sizeTxt);
      row.appendChild(mid);

      const prog = document.createElement('div');
      prog.className = 'progress-container';
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = `${progressPct}%`;
      prog.appendChild(fill);
      row.appendChild(prog);

      container.appendChild(row);
    });
  }
}

if (!customElements.get('jf-download-queue')) {
  customElements.define('jf-download-queue', JfDownloadQueue);
}
