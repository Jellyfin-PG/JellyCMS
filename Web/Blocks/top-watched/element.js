class JfTopWatched extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-top-watched');
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
    const titleEl = this.shadowRoot.querySelector('#trending-title');
    if (!itemsRoot) return;

    const title = this.getAttribute('data-title') || 'Most Watched Movies';
    const limit = parseInt(this.getAttribute('data-limit'), 10) || 6;
    const itemType = this.getAttribute('data-item_type') || 'Movie';

    if (titleEl) titleEl.textContent = title;

    if (!window.JellyBuilder || !window.JellyBuilder.Api || !window.JellyBuilder.ApiToken) {
      this.renderMockups(itemsRoot, itemType, limit);
      return;
    }

    itemsRoot.innerHTML = '<div class="loading">Loading top watched items...</div>';

    try {
      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;
      const data = await window.JellyBuilder.Api.getItems({
        IncludeItemTypes: itemType,
        Limit: limit,
        Recursive: true,
        SortBy: 'PlayCount',
        SortOrder: 'Descending',
        Fields: 'ProductionYear,PlayCount'
      });

      itemsRoot.innerHTML = '';

      if (!data || !data.Items || data.Items.length === 0) {
        itemsRoot.innerHTML = `<div class="loading">No watched items of type "${itemType}" found.</div>`;
        return;
      }

      data.Items.forEach((item, index) => {
        const card = document.createElement('a');
        card.className = 'media-card';
        card.href = `${serverUrl}/web/index.html#/details?id=${item.Id}`;
        card.target = '_blank';

        const badge = document.createElement('div');
        badge.className = 'trending-badge';
        badge.textContent = index + 1;
        card.appendChild(badge);

        const poster = document.createElement('div');
        poster.className = 'media-poster';
        const imageUrl = `${serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=300`;
        poster.style.backgroundImage = `url('${imageUrl}')`;
        card.appendChild(poster);

        const info = document.createElement('div');
        info.className = 'media-info';

        const mTitle = document.createElement('div');
        mTitle.className = 'media-title';
        mTitle.textContent = item.Name;

        const metaRow = document.createElement('div');
        metaRow.className = 'media-meta-row';

        const mYear = document.createElement('div');
        mYear.className = 'media-year';
        mYear.textContent = item.ProductionYear || '';

        const mPlays = document.createElement('div');
        mPlays.className = 'media-play-count';
        const playCount = item.PlayCount || 0;
        mPlays.innerHTML = `<span class="material-symbols-outlined">trending_up</span> ${playCount}`;

        metaRow.appendChild(mYear);
        metaRow.appendChild(mPlays);
        info.appendChild(mTitle);
        info.appendChild(metaRow);
        card.appendChild(info);
        itemsRoot.appendChild(card);
      });
    } catch (err) {
      console.error('JellyCMS: Failed to fetch trending items', err);
      itemsRoot.innerHTML = `<div class="error">Failed to connect to Jellyfin API: ${err.message}</div>`;
    }
  }

  renderMockups(container, type, count) {
    container.innerHTML = '';
    const icons = {
      Movie: '🎬',
      Series: '📺',
      Episode: '📹',
      MusicAlbum: '💿'
    };
    const icon = icons[type] || '🍿';

    for (let i = 1; i <= count; i++) {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.style.pointerEvents = 'none';
      card.style.opacity = '0.85';

      const badge = document.createElement('div');
      badge.className = 'trending-badge';
      badge.textContent = i;
      card.appendChild(badge);

      const poster = document.createElement('div');
      poster.className = 'media-poster';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '3.5rem';
      poster.style.background = 'linear-gradient(135deg, #181922 0%, #252736 100%)';
      poster.innerHTML = icon;
      card.appendChild(poster);

      const info = document.createElement('div');
      info.className = 'media-info';

      const title = document.createElement('div');
      title.className = 'media-title';
      title.textContent = `Trending ${type} ${i}`;

      const metaRow = document.createElement('div');
      metaRow.className = 'media-meta-row';

      const year = document.createElement('div');
      year.className = 'media-year';
      year.textContent = 'Popularity Rank';

      const plays = document.createElement('div');
      plays.className = 'media-play-count';
      plays.innerHTML = `<span class="material-symbols-outlined">trending_up</span> ${Math.floor(100 - i * 8)}+`;

      metaRow.appendChild(year);
      metaRow.appendChild(plays);
      info.appendChild(title);
      info.appendChild(metaRow);
      card.appendChild(info);
      container.appendChild(card);
    }
  }
}

if (!customElements.get('jf-top-watched')) {
  customElements.define('jf-top-watched', JfTopWatched);
}
