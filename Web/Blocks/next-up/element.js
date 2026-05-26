class JfNextUp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-next-up');
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
    const grid = this.shadowRoot.querySelector('#grid-root');
    const titleEl = this.shadowRoot.querySelector('#next-up-title');
    if (!grid) return;

    const title = this.getAttribute('data-title') || 'Continue Watching';
    if (titleEl) titleEl.textContent = title;

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups(grid);
      return;
    }

    try {
      const limit = parseInt(this.getAttribute('data-limit')) || 8;
      
      const res = await window.JellyBuilder.Api.getItems({
        Filters: 'IsResumable',
        Recursive: true,
        Fields: 'UserData',
        Limit: limit
      });

      const items = res.Items || [];
      grid.innerHTML = '';

      if (items.length === 0) {
        grid.innerHTML = '<div class="empty">No in-progress media to continue watching.</div>';
        return;
      }

      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;

      items.forEach(item => {
        const a = document.createElement('a');
        a.className = 'card-item';
        a.href = `${serverUrl}/web/index.html#/details?id=${item.Id}`;
        a.target = '_blank';

        const thumb = document.createElement('div');
        thumb.className = 'thumbnail-wrapper';
        
        const imageId = item.BackdropImageTags && item.BackdropImageTags.length > 0 ? item.Id : (item.SeriesId || item.Id);
        const imageType = item.BackdropImageTags && item.BackdropImageTags.length > 0 ? 'Backdrop' : 'Primary';
        thumb.style.backgroundImage = `url('${serverUrl}/Items/${imageId}/Images/${imageType}?maxWidth=320')`;

        const playHover = document.createElement('div');
        playHover.className = 'play-hover';
        playHover.innerHTML = '<span class="material-symbols-outlined">play_circle_filled</span>';
        thumb.appendChild(playHover);

        const userData = item.UserData || {};
        const position = userData.PlaybackPositionTicks || 0;
        const total = item.RunTimeTicks || 0;
        let percent = 0;
        if (total > 0) {
          percent = Math.min(100, Math.max(0, (position / total) * 100));
        }

        const barBg = document.createElement('div');
        barBg.className = 'progress-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'progress-bar-fill';
        barFill.style.width = `${percent}%`;
        barBg.appendChild(barFill);
        thumb.appendChild(barBg);

        const details = document.createElement('div');
        details.className = 'card-details';

        const mTitle = document.createElement('div');
        mTitle.className = 'card-title';
        mTitle.textContent = item.Name;

        const mSub = document.createElement('div');
        mSub.className = 'card-subtitle';
        if (item.Type === 'Episode') {
          mSub.textContent = `S${item.ParentIndexNumber || 0}E${item.IndexNumber || 0} - ${item.SeriesName || ''}`;
        } else {
          mSub.textContent = 'Movie';
        }

        details.appendChild(mTitle);
        details.appendChild(mSub);
        a.appendChild(thumb);
        a.appendChild(details);
        grid.appendChild(a);
      });

    } catch (err) {
      console.error(err);
      grid.innerHTML = `<div class="error">Failed to load continue watching list: ${err.message}</div>`;
    }
  }

  renderMockups(grid) {
    grid.innerHTML = '';
    const mocks = [
      { Name: 'Interstellar', Sub: 'Movie', Percent: 74 },
      { Name: 'Episode 3', Sub: 'S01E03 - Shogun', Percent: 45 },
      { Name: 'Episode 5', Sub: 'S01E05 - Fallout', Percent: 15 }
    ];

    mocks.forEach(mock => {
      const a = document.createElement('div');
      a.className = 'card-item';
      a.style.pointerEvents = 'none';

      const thumb = document.createElement('div');
      thumb.className = 'thumbnail-wrapper';
      thumb.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';

      const playHover = document.createElement('div');
      playHover.className = 'play-hover';
      playHover.innerHTML = '<span class="material-symbols-outlined">play_circle_filled</span>';
      thumb.appendChild(playHover);

      const barBg = document.createElement('div');
      barBg.className = 'progress-bar-bg';
      const barFill = document.createElement('div');
      barFill.className = 'progress-bar-fill';
      barFill.style.width = `${mock.Percent}%`;
      barBg.appendChild(barFill);
      thumb.appendChild(barBg);

      const details = document.createElement('div');
      details.className = 'card-details';

      const mTitle = document.createElement('div');
      mTitle.className = 'card-title';
      mTitle.textContent = mock.Name;

      const mSub = document.createElement('div');
      mSub.className = 'card-subtitle';
      mSub.textContent = mock.Sub;

      details.appendChild(mTitle);
      details.appendChild(mSub);
      a.appendChild(thumb);
      a.appendChild(details);
      grid.appendChild(a);
    });
  }
}

if (!customElements.get('jf-next-up')) {
  customElements.define('jf-next-up', JfNextUp);
}
