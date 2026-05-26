class JfRecentlyAdded extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-recently-added');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-limit', 'data-item_type'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
    
    const prev = this.shadowRoot.querySelector('#prev-btn');
    const next = this.shadowRoot.querySelector('#next-btn');
    const track = this.shadowRoot.querySelector('#track-root');
    
    if (prev && next && track) {
      prev.addEventListener('click', () => {
        track.scrollBy({ left: -320, behavior: 'smooth' });
      });
      next.addEventListener('click', () => {
        track.scrollBy({ left: 320, behavior: 'smooth' });
      });
    }
  }

  async fetchData() {
    const track = this.shadowRoot.querySelector('#track-root');
    const titleEl = this.shadowRoot.querySelector('#carousel-title');
    if (!track) return;

    const title = this.getAttribute('data-title') || 'Recently Added';
    if (titleEl) titleEl.textContent = title;

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups(track);
      return;
    }

    try {
      const limit = parseInt(this.getAttribute('data-limit')) || 12;
      const itemType = this.getAttribute('data-item_type') || 'All';
      
      const query = {
        Limit: limit,
        SortBy: 'DateCreated',
        SortOrder: 'Descending',
        Recursive: true,
        Fields: 'ProductionYear'
      };

      if (itemType !== 'All') {
        query.IncludeItemTypes = itemType;
      } else {
        query.IncludeItemTypes = 'Movie,Series';
      }

      const res = await window.JellyBuilder.Api.getItems(query);
      const items = res.Items || [];

      track.innerHTML = '';

      if (items.length === 0) {
        track.innerHTML = '<div class="empty">No recently added items found.</div>';
        return;
      }

      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;

      items.forEach(item => {
        const a = document.createElement('a');
        a.className = 'carousel-item';
        a.href = `${serverUrl}/web/index.html#/details?id=${item.Id}`;
        a.target = '_blank';

        const poster = document.createElement('div');
        poster.className = 'poster-wrapper';
        poster.style.backgroundImage = `url('${serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=200')`;

        const badge = document.createElement('span');
        badge.className = 'badge-new';
        badge.textContent = 'NEW';
        poster.appendChild(badge);

        const mTitle = document.createElement('div');
        mTitle.className = 'media-title';
        mTitle.textContent = item.Name;

        const mMeta = document.createElement('div');
        mMeta.className = 'media-meta';
        mMeta.textContent = `${item.Type === 'Series' ? 'TV Series' : 'Movie'} ${item.ProductionYear ? `(${item.ProductionYear})` : ''}`;

        a.appendChild(poster);
        a.appendChild(mTitle);
        a.appendChild(mMeta);
        track.appendChild(a);
      });

    } catch (err) {
      console.error(err);
      track.innerHTML = `<div class="error">Failed to load additions: ${err.message}</div>`;
    }
  }

  renderMockups(track) {
    track.innerHTML = '';
    const mocks = [
      { Name: 'Dune: Part Two', Year: '2024', Type: 'Movie' },
      { Name: 'Shogun', Year: '2024', Type: 'Series' },
      { Name: 'Fallout', Year: '2024', Type: 'Series' },
      { Name: 'The Matrix Resurrections', Year: '2021', Type: 'Movie' },
      { Name: 'Oppenheimer', Year: '2023', Type: 'Movie' }
    ];

    mocks.forEach((mock, idx) => {
      const a = document.createElement('div');
      a.className = 'carousel-item';
      a.style.pointerEvents = 'none';

      const poster = document.createElement('div');
      poster.className = 'poster-wrapper';
      poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '2.5rem';
      poster.innerHTML = mock.Type === 'Movie' ? '🎬' : '📺';

      if (idx < 2) {
        const badge = document.createElement('span');
        badge.className = 'badge-new';
        badge.textContent = 'NEW';
        poster.appendChild(badge);
      }

      const mTitle = document.createElement('div');
      mTitle.className = 'media-title';
      mTitle.textContent = mock.Name;

      const mMeta = document.createElement('div');
      mMeta.className = 'media-meta';
      mMeta.textContent = `${mock.Type === 'Series' ? 'TV Series' : 'Movie'} (${mock.Year})`;

      a.appendChild(poster);
      a.appendChild(mTitle);
      a.appendChild(mMeta);
      track.appendChild(a);
    });
  }
}

if (!customElements.get('jf-recently-added')) {
  customElements.define('jf-recently-added', JfRecentlyAdded);
}
