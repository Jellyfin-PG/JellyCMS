class JfOverseerrRequests extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-overseerr-requests');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
    this._debounceTimeout = null;
  }

  static get observedAttributes() {
    return ['data-title', 'data-overseerr_url', 'data-api_key'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.updateHeader();
  }

  connectedCallback() {
    this.updateHeader();
    
    const input = this.shadowRoot.querySelector('#search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        clearTimeout(this._debounceTimeout);
        const query = e.target.value.trim();
        this._debounceTimeout = setTimeout(() => this.searchMedia(query), 400);
      });
    }
  }

  updateHeader() {
    const titleEl = this.shadowRoot.querySelector('#request-title');
    if (titleEl) {
      titleEl.textContent = this.getAttribute('data-title') || 'Request Movies & TV Shows';
    }
  }

  async searchMedia(query) {
    const root = this.shadowRoot.querySelector('#results-root');
    if (!root) return;

    if (!query) {
      root.innerHTML = '<div class="search-tip">Type a movie or show name above to start requesting!</div>';
      return;
    }

    const url = this.getAttribute('data-overseerr_url') || 'http://localhost:5055';
    const apiKey = this.getAttribute('data-api_key');

    // Visual editor or unconfigured fallback
    if (!apiKey || !apiKey.trim() || !window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockSearch(root, query);
      return;
    }

    root.innerHTML = '<div class="loading">Searching Overseerr...</div>';

    try {
      const searchUrl = `${url}/api/v1/search?query=${encodeURIComponent(query)}`;
      const headers = {
        'Accept': 'application/json',
        'X-Api-Key': apiKey
      };

      const res = await fetch(searchUrl, { headers });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      root.innerHTML = '';
      const results = data.results || [];

      if (results.length === 0) {
        root.innerHTML = '<div class="no-results">No movies or TV shows found matching that search.</div>';
        return;
      }

      results.slice(0, 12).forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const poster = document.createElement('div');
        poster.className = 'media-poster';
        if (item.posterPath) {
          poster.style.backgroundImage = `url('https://image.tmdb.org/t/p/w154${item.posterPath}')`;
        }
        card.appendChild(poster);

        const details = document.createElement('div');
        details.className = 'media-details';

        const top = document.createElement('div');
        top.className = 'media-info-top';

        const mTitle = document.createElement('div');
        mTitle.className = 'media-title';
        mTitle.textContent = item.title || item.name || 'Untitled';
        top.appendChild(mTitle);

        const meta = document.createElement('div');
        meta.className = 'media-meta';
        const year = (item.releaseDate || item.firstAirDate || '').substring(0, 4);
        meta.textContent = `${item.mediaType === 'movie' ? 'Movie' : 'TV Show'} ${year ? `• ${year}` : ''}`;
        top.appendChild(meta);

        const overview = document.createElement('div');
        overview.className = 'media-overview';
        overview.textContent = item.overview || 'No overview description available.';
        top.appendChild(overview);

        details.appendChild(top);

        const bottom = document.createElement('div');
        bottom.className = 'media-info-bottom';

        const status = item.mediaInfo ? item.mediaInfo.status : 1; 
        // Status definitions: 1 = unknown/not requested, 2 = pending, 3 = processing, 4 = partially available, 5 = available
        
        const badge = document.createElement('span');
        badge.className = 'status-badge';

        if (status === 5 || status === 4) {
          badge.className += ' available';
          badge.textContent = 'Available';
          bottom.appendChild(badge);
        } else if (status === 2) {
          badge.className += ' pending';
          badge.textContent = 'Pending';
          bottom.appendChild(badge);
        } else if (status === 3) {
          badge.className += ' requested';
          badge.textContent = 'Processing';
          bottom.appendChild(badge);
        } else {
          // Add Request Button
          const reqBtn = document.createElement('button');
          reqBtn.className = 'request-btn';
          reqBtn.textContent = 'Request';
          reqBtn.addEventListener('click', () => this.submitRequest(item, reqBtn, badge, bottom));
          bottom.appendChild(reqBtn);
        }

        details.appendChild(bottom);
        card.appendChild(details);
        root.appendChild(card);
      });

    } catch (err) {
      console.error('JellyCMS: Overseerr search error:', err);
      root.innerHTML = `<div class="error">Failed to query Overseerr: ${err.message}</div>`;
    }
  }

  async submitRequest(item, button, badge, container) {
    button.textContent = 'Requesting...';
    button.className += ' loading-btn';

    const url = this.getAttribute('data-overseerr_url') || 'http://localhost:5055';
    const apiKey = this.getAttribute('data-api_key');

    try {
      const requestUrl = `${url}/api/v1/request`;
      const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      };

      const body = {
        mediaType: item.mediaType,
        mediaId: item.id
      };

      // If TV, default request is requesting the first season (or all if we want to request whole show)
      if (item.mediaType === 'tv') {
        body.seasons = [1];
      }

      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`Request submission failed with status ${res.status}`);

      // Change button to status badge
      button.remove();
      badge.className = 'status-badge pending';
      badge.textContent = 'Pending';
      container.appendChild(badge);

    } catch (err) {
      console.error('JellyCMS: Overseerr request failed:', err);
      button.textContent = 'Failed';
      button.className = 'request-btn';
      alert(`Failed to submit request: ${err.message}`);
    }
  }

  renderMockSearch(container, query) {
    container.innerHTML = '';
    const mocks = [
      {
        id: 1,
        title: 'Interstellar',
        type: 'movie',
        year: '2014',
        overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.',
        status: 5
      },
      {
        id: 2,
        title: 'Stranger Things',
        type: 'tv',
        year: '2016',
        overview: 'When a young boy vanishes, a town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
        status: 2
      },
      {
        id: 3,
        title: 'Dune: Part Two',
        type: 'movie',
        year: '2024',
        overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators.',
        status: 1
      }
    ].filter(m => m.title.toLowerCase().includes(query.toLowerCase()));

    if (mocks.length === 0) {
      container.innerHTML = `<div class="no-results">No mockup results matching "${query}". Try searching "Dune", "Stranger", or "Interstellar".</div>`;
      return;
    }

    mocks.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';

      const poster = document.createElement('div');
      poster.className = 'media-poster';
      poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '1.8rem';
      poster.innerHTML = item.type === 'movie' ? '🎬' : '📺';
      card.appendChild(poster);

      const details = document.createElement('div');
      details.className = 'media-details';

      const top = document.createElement('div');
      top.className = 'media-info-top';

      const mTitle = document.createElement('div');
      mTitle.className = 'media-title';
      mTitle.textContent = item.title;
      top.appendChild(mTitle);

      const meta = document.createElement('div');
      meta.className = 'media-meta';
      meta.textContent = `${item.type === 'movie' ? 'Movie' : 'TV Show'} • ${item.year}`;
      top.appendChild(meta);

      const overview = document.createElement('div');
      overview.className = 'media-overview';
      overview.textContent = item.overview;
      top.appendChild(overview);

      details.appendChild(top);

      const bottom = document.createElement('div');
      bottom.className = 'media-info-bottom';

      const badge = document.createElement('span');
      badge.className = 'status-badge';

      if (item.status === 5) {
        badge.className += ' available';
        badge.textContent = 'Available';
        bottom.appendChild(badge);
      } else if (item.status === 2) {
        badge.className += ' pending';
        badge.textContent = 'Pending';
        bottom.appendChild(badge);
      } else {
        const reqBtn = document.createElement('button');
        reqBtn.className = 'request-btn';
        reqBtn.textContent = 'Request';
        reqBtn.addEventListener('click', () => {
          reqBtn.textContent = 'Requesting...';
          reqBtn.className += ' loading-btn';
          setTimeout(() => {
            reqBtn.remove();
            badge.className = 'status-badge pending';
            badge.textContent = 'Pending';
            bottom.appendChild(badge);
          }, 800);
        });
        bottom.appendChild(reqBtn);
      }

      details.appendChild(bottom);
      card.appendChild(details);
      container.appendChild(card);
    });
  }
}

if (!customElements.get('jf-overseerr-requests')) {
  customElements.define('jf-overseerr-requests', JfOverseerrRequests);
}
