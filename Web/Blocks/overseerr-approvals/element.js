class JfOverseerrApprovals extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-overseerr-approvals');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-api_url', 'data-api_key'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
  }

  async fetchData() {
    const root = this.shadowRoot.querySelector('#requests-root');
    const titleEl = this.shadowRoot.querySelector('#approvals-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Pending Requests';
    if (titleEl) titleEl.textContent = title;

    const apiUrl = this.getAttribute('data-api_url');
    const apiKey = this.getAttribute('data-api_key');

    if (!apiUrl || !apiKey) {
      this.renderMockups(root);
      return;
    }

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const url = `${cleanUrl}/api/v1/request?filter=pending&limit=10`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      const requests = data.results || [];

      root.innerHTML = '';

      if (requests.length === 0) {
        root.innerHTML = '<div class="empty">No pending requests to approve.</div>';
        return;
      }

      requests.forEach(req => {
        const row = document.createElement('div');
        row.className = 'request-row';

        const info = document.createElement('div');
        info.className = 'request-info';

        const poster = document.createElement('div');
        poster.className = 'media-poster';
        const posterPath = req.media ? req.media.posterPath : '';
        if (posterPath) {
          poster.style.backgroundImage = `url('https://image.tmdb.org/t/p/w154${posterPath}')`;
        } else {
          poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
        }

        const details = document.createElement('div');
        details.className = 'request-details';
        const mTitle = document.createElement('div');
        mTitle.className = 'media-title';
        mTitle.textContent = req.media ? (req.media.title || req.media.name || 'Unknown Title') : 'Unknown Title';

        const requester = document.createElement('div');
        requester.className = 'requester-name';
        const name = req.requestedBy ? (req.requestedBy.displayName || req.requestedBy.email) : 'User';
        requester.textContent = `Requested by ${name}`;

        details.appendChild(mTitle);
        details.appendChild(requester);
        info.appendChild(poster);
        info.appendChild(details);
        row.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'action-box';

        const appBtn = document.createElement('button');
        appBtn.className = 'approve-btn';
        appBtn.textContent = 'Approve';
        appBtn.addEventListener('click', () => this.handleAction(req.id, 'approve', row));

        const denyBtn = document.createElement('button');
        denyBtn.className = 'deny-btn';
        denyBtn.textContent = 'Deny';
        denyBtn.addEventListener('click', () => this.handleAction(req.id, 'decline', row));

        actions.appendChild(appBtn);
        actions.appendChild(denyBtn);
        row.appendChild(actions);

        root.appendChild(row);
      });

    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="error">Failed to load requests: ${err.message}</div>`;
    }
  }

  async handleAction(requestId, action, rowElement) {
    const apiUrl = this.getAttribute('data-api_url');
    const apiKey = this.getAttribute('data-api_key');
    if (!apiUrl || !apiKey) {
      rowElement.style.opacity = '0.3';
      rowElement.style.pointerEvents = 'none';
      return;
    }

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const url = `${cleanUrl}/api/v1/request/${requestId}/${action}`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey
        }
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      
      rowElement.remove();
      const root = this.shadowRoot.querySelector('#requests-root');
      if (root && root.children.length === 0) {
        root.innerHTML = '<div class="empty">No pending requests to approve.</div>';
      }

    } catch (err) {
      console.error(err);
      alert(`Action failed: ${err.message}`);
    }
  }

  renderMockups(container) {
    container.innerHTML = '';
    const mocks = [
      { id: 1, Title: 'Gladiator II', Requester: 'Sean' },
      { id: 2, Title: 'Severance Season 2', Requester: 'Jane' }
    ];

    mocks.forEach(item => {
      const row = document.createElement('div');
      row.className = 'request-row';

      const info = document.createElement('div');
      info.className = 'request-info';

      const poster = document.createElement('div');
      poster.className = 'media-poster';
      poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '1.2rem';
      poster.innerHTML = '🎬';

      const details = document.createElement('div');
      details.className = 'request-details';
      const mTitle = document.createElement('div');
      mTitle.className = 'media-title';
      mTitle.textContent = item.Title;

      const requester = document.createElement('div');
      requester.className = 'requester-name';
      requester.textContent = `Requested by ${item.Requester}`;

      details.appendChild(mTitle);
      details.appendChild(requester);
      info.appendChild(poster);
      info.appendChild(details);
      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'action-box';

      const appBtn = document.createElement('button');
      appBtn.className = 'approve-btn';
      appBtn.textContent = 'Approve';
      appBtn.addEventListener('click', () => this.handleAction(item.id, 'approve', row));

      const denyBtn = document.createElement('button');
      denyBtn.className = 'deny-btn';
      denyBtn.textContent = 'Deny';
      denyBtn.addEventListener('click', () => this.handleAction(item.id, 'decline', row));

      actions.appendChild(appBtn);
      actions.appendChild(denyBtn);
      row.appendChild(actions);

      container.appendChild(row);
    });
  }
}

if (!customElements.get('jf-overseerr-approvals')) {
  customElements.define('jf-overseerr-approvals', JfOverseerrApprovals);
}
