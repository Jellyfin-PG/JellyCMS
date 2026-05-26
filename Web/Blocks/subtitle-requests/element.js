class JfSubtitleRequests extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-subtitle-requests');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-bazarr_url', 'data-bazarr_key'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'data-title') {
      const titleEl = this.shadowRoot.querySelector('#bazarr-title');
      if (titleEl) titleEl.textContent = newValue || 'Request Subtitles';
    }
  }

  connectedCallback() {
    const titleEl = this.shadowRoot.querySelector('#bazarr-title');
    if (titleEl) titleEl.textContent = this.getAttribute('data-title') || 'Request Subtitles';

    const input = this.shadowRoot.querySelector('#search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this.searchMedia(e.target.value.trim()), 500);
      });
    }
  }

  async searchMedia(query) {
    const root = this.shadowRoot.querySelector('#results-root');
    if (!root) return;

    if (!query) {
      root.innerHTML = '<div class="info-tip">Search a movie or TV show above to view and request subtitles.</div>';
      return;
    }

    const bazarrUrl = this.getAttribute('data-bazarr_url');
    const bazarrKey = this.getAttribute('data-bazarr_key');

    if (!bazarrUrl || !bazarrKey || !window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups(root, query);
      return;
    }

    try {
      root.innerHTML = '<div class="loading">Searching...</div>';

      const res = await window.JellyBuilder.Api.getItems({
        SearchTerm: query,
        IncludeItemTypes: 'Movie,Series',
        Recursive: true,
        Limit: 5
      });
      const items = res.Items || [];

      root.innerHTML = '';

      if (items.length === 0) {
        root.innerHTML = '<div class="empty">No matching media found in your library.</div>';
        return;
      }

      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'media-row';

        const info = document.createElement('div');
        info.className = 'media-info';
        const title = document.createElement('div');
        title.className = 'media-title';
        title.textContent = item.Name;
        const meta = document.createElement('div');
        meta.className = 'media-meta';
        meta.textContent = `${item.Type === 'Series' ? 'TV Series' : 'Movie'} ${item.ProductionYear ? `(${item.ProductionYear})` : ''}`;
        info.appendChild(title);
        info.appendChild(meta);
        row.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'action-box';

        const reqBtn = document.createElement('button');
        reqBtn.className = 'request-btn';
        reqBtn.textContent = 'Search Subs';
        reqBtn.addEventListener('click', async () => {
          reqBtn.disabled = true;
          reqBtn.textContent = 'Searching...';
          try {
            const cleanUrl = bazarrUrl.replace(/\/+$/, '');
            const searchType = item.Type === 'Series' ? 'series' : 'movies';
            
            const searchUrl = `${cleanUrl}/api/${searchType}/search?apikey=${bazarrKey}`;
            
            await fetch(searchUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dbid: item.Id })
            });

            reqBtn.className = 'request-btn requested';
            reqBtn.textContent = 'Triggered';
          } catch (err) {
            console.error(err);
            reqBtn.className = 'request-btn requested';
            reqBtn.textContent = 'Triggered';
          }
        });

        actions.appendChild(reqBtn);
        row.appendChild(actions);
        root.appendChild(row);
      });

    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="error">Error searching library: ${err.message}</div>`;
    }
  }

  renderMockups(container, query) {
    container.innerHTML = '';
    const mocks = [
      { Name: 'Interstellar', Type: 'Movie', Year: '2014', Languages: ['EN', 'ES'] },
      { Name: 'Shogun', Type: 'Series', Year: '2024', Languages: ['EN'] }
    ].filter(m => m.Name.toLowerCase().includes(query.toLowerCase()));

    if (mocks.length === 0) {
      container.innerHTML = '<div class="empty">No matching media found in library.</div>';
      return;
    }

    mocks.forEach(item => {
      const row = document.createElement('div');
      row.className = 'media-row';

      const info = document.createElement('div');
      info.className = 'media-info';
      const title = document.createElement('div');
      title.className = 'media-title';
      title.textContent = item.Name;
      const meta = document.createElement('div');
      meta.className = 'media-meta';
      meta.textContent = `${item.Type} (${item.Year})`;
      info.appendChild(title);
      info.appendChild(meta);
      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'action-box';

      item.Languages.forEach(lang => {
        const span = document.createElement('span');
        span.className = 'lang-badge';
        span.textContent = lang;
        actions.appendChild(span);
      });

      const reqBtn = document.createElement('button');
      reqBtn.className = 'request-btn';
      reqBtn.textContent = 'Search Subs';
      reqBtn.addEventListener('click', () => {
        reqBtn.disabled = true;
        reqBtn.className = 'request-btn requested';
        reqBtn.textContent = 'Requested';
      });

      actions.appendChild(reqBtn);
      row.appendChild(actions);
      container.appendChild(row);
    });
  }
}

if (!customElements.get('jf-subtitle-requests')) {
  customElements.define('jf-subtitle-requests', JfSubtitleRequests);
}
