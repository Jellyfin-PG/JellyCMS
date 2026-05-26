class JfUserAchievements extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-user-achievements');
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
  }

  async fetchData() {
    const root = this.shadowRoot.querySelector('#badges-root');
    const titleEl = this.shadowRoot.querySelector('#achievements-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Your Watch Milestones';
    if (titleEl) titleEl.textContent = title;

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this.renderMockups(root);
      return;
    }

    try {
      const moviesRes = await window.JellyBuilder.Api.getItems({
        Recursive: true,
        IncludeItemTypes: 'Movie',
        Limit: 0
      });
      const movieCount = moviesRes.TotalRecordCount || 0;

      const seriesRes = await window.JellyBuilder.Api.getItems({
        Recursive: true,
        IncludeItemTypes: 'Series',
        Limit: 0
      });
      const seriesCount = seriesRes.TotalRecordCount || 0;

      const resumeRes = await window.JellyBuilder.Api.getItems({
        Filters: 'IsResumable',
        Recursive: true,
        Limit: 0
      });
      const inProgressCount = resumeRes.TotalRecordCount || 0;

      const achievements = [
        {
          name: 'First Steps',
          desc: 'Connect your Jellyfin library',
          icon: 'login',
          unlocked: true
        },
        {
          name: 'Movie Collector',
          desc: 'Have 20+ movies in your library',
          icon: 'movie',
          unlocked: movieCount >= 20
        },
        {
          name: 'Show Marathoner',
          desc: 'Have 5+ TV shows in library',
          icon: 'tv',
          unlocked: seriesCount >= 5
        },
        {
          name: 'Night Owl',
          desc: 'Have an active in-progress watch',
          icon: 'bedtime',
          unlocked: inProgressCount > 0
        },
        {
          name: 'Hoarder',
          desc: 'Library size exceeds 100 titles',
          icon: 'folder_open',
          unlocked: (movieCount + seriesCount) >= 100
        }
      ];

      this.renderAchievements(root, achievements);

    } catch (err) {
      console.error(err);
      this.renderMockups(root);
    }
  }

  renderAchievements(container, list) {
    container.innerHTML = '';
    list.forEach(badge => {
      const card = document.createElement('div');
      card.className = `badge-card ${badge.unlocked ? 'unlocked' : 'locked'}`;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'badge-icon-wrapper';
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.textContent = badge.unlocked ? badge.icon : 'lock';
      iconWrap.appendChild(icon);

      const name = document.createElement('div');
      name.className = 'badge-name';
      name.textContent = badge.name;

      const desc = document.createElement('div');
      desc.className = 'badge-desc';
      desc.textContent = badge.desc;

      card.appendChild(iconWrap);
      card.appendChild(name);
      card.appendChild(desc);
      container.appendChild(card);
    });
  }

  renderMockups(container) {
    const mocks = [
      { name: 'First Steps', desc: 'Connect your Jellyfin library', icon: 'login', unlocked: true },
      { name: 'Movie Collector', desc: 'Have 20+ movies in your library', icon: 'movie', unlocked: true },
      { name: 'Show Marathoner', desc: 'Have 5+ TV shows in library', icon: 'tv', unlocked: false },
      { name: 'Night Owl', desc: 'Have an active in-progress watch', icon: 'bedtime', unlocked: true },
      { name: 'Hoarder', desc: 'Library size exceeds 100 titles', icon: 'folder_open', unlocked: false }
    ];
    this.renderAchievements(container, mocks);
  }
}

if (!customElements.get('jf-user-achievements')) {
  customElements.define('jf-user-achievements', JfUserAchievements);
}
