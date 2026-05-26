class JfMediaGrid extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-media-grid');
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
  }

  async fetchData() {
    const itemsRoot = this.shadowRoot.querySelector('#items-root');
    const titleEl = this.shadowRoot.querySelector('#grid-title');
    if (!itemsRoot) return;

    const title = this.getAttribute('data-title') || 'Recently Added Movies';
    const limit = parseInt(this.getAttribute('data-limit'), 10) || 6;
    const itemType = this.getAttribute('data-item_type') || 'Movie';

    if (titleEl) titleEl.textContent = title;

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups(itemsRoot, itemType, limit);
      return;
    }

    itemsRoot.innerHTML = '<div class="loading">Loading items from Jellyfin...</div>';

    try {
      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;
      const data = await window.JellyBuilder.Api.getItems({
        IncludeItemTypes: itemType,
        Limit: limit,
        Recursive: true,
        SortBy: 'DateCreated',
        SortOrder: 'Descending',
        Fields: 'ProductionYear'
      });

      itemsRoot.innerHTML = '';

      if (!data || !data.Items || data.Items.length === 0) {
        itemsRoot.innerHTML = `<div class="loading">No items of type "${itemType}" found in your library.</div>`;
        return;
      }

      data.Items.forEach(item => {
        const card = document.createElement('a');
        card.className = 'media-card';
        card.href = `${serverUrl}/web/index.html#/details?id=${item.Id}`;
        card.target = '_blank';

        const poster = document.createElement('div');
        poster.className = 'media-poster';
        const imageUrl = `${serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=300`;
        poster.style.backgroundImage = `url('${imageUrl}')`;

        const info = document.createElement('div');
        info.className = 'media-info';

        const mTitle = document.createElement('div');
        mTitle.className = 'media-title';
        mTitle.textContent = item.Name;

        const mYear = document.createElement('div');
        mYear.className = 'media-year';
        mYear.textContent = item.ProductionYear || '';

        info.appendChild(mTitle);
        info.appendChild(mYear);
        card.appendChild(poster);
        card.appendChild(info);
        itemsRoot.appendChild(card);
      });
    } catch (err) {
      console.error('JellyCMS: Failed to fetch media grid items', err);
      itemsRoot.innerHTML = `<div class="error">Failed to connect to Jellyfin API: ${err.message}</div>`;
    }
  }

  renderMockups(container, type, count) {
    container.innerHTML = '';
    const icons = {
      Movie: '🎬',
      Series: '📺',
      MusicAlbum: '💿'
    };
    const icon = icons[type] || '🍿';

    for (let i = 1; i <= count; i++) {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.style.pointerEvents = 'none';
      card.style.opacity = '0.7';

      const poster = document.createElement('div');
      poster.className = 'media-poster';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '3.5rem';
      poster.style.background = 'linear-gradient(135deg, #181922 0%, #252736 100%)';
      poster.innerHTML = icon;

      const info = document.createElement('div');
      info.className = 'media-info';

      const title = document.createElement('div');
      title.className = 'media-title';
      title.textContent = `Library ${type} ${i}`;

      const year = document.createElement('div');
      year.className = 'media-year';
      year.textContent = 'Preview Placeholder';

      info.appendChild(title);
      info.appendChild(year);
      card.appendChild(poster);
      card.appendChild(info);
      container.appendChild(card);
    }
  }
}

if (!customElements.get('jf-media-grid')) {
  customElements.define('jf-media-grid', JfMediaGrid);
}
