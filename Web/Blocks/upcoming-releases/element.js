class JfUpcomingReleases extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-upcoming-releases');
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
    const root = this.shadowRoot.querySelector('#events-root');
    const titleEl = this.shadowRoot.querySelector('#calendar-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Airing TV Shows';
    if (titleEl) titleEl.textContent = title;

    const apiUrl = this.getAttribute('data-api_url');
    const apiKey = this.getAttribute('data-api_key');

    if (!apiUrl || !apiKey) {
      this.renderMockups(root);
      return;
    }

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const start = new Date().toISOString().split('T')[0];
      const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const url = `${cleanUrl}/api/v3/calendar?start=${start}&end=${end}&apikey=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      
      const items = (data || []).sort((a, b) => new Date(a.airDate) - new Date(b.airDate));
      
      root.innerHTML = '';

      if (items.length === 0) {
        root.innerHTML = '<div class="empty">No upcoming releases scheduled for this week.</div>';
        return;
      }

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'event-row';

        const left = document.createElement('div');
        left.className = 'event-left';

        const sTitle = document.createElement('div');
        sTitle.className = 'show-title';
        sTitle.textContent = item.series ? item.series.title : 'TV Show';

        const eDetails = document.createElement('div');
        eDetails.className = 'episode-details';
        eDetails.textContent = `S${item.seasonNumber}E${item.episodeNumber} - ${item.title || 'TBA'}`;

        left.appendChild(sTitle);
        left.appendChild(eDetails);
        row.appendChild(left);

        const right = document.createElement('div');
        right.className = 'event-right';

        const airDate = new Date(item.airDate);
        const diffTime = airDate - Date.now();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const badge = document.createElement('span');
        badge.className = 'countdown-badge';

        if (diffDays <= 0) {
          badge.className = 'countdown-badge today';
          badge.textContent = 'Airing Today';
        } else if (diffDays === 1) {
          badge.textContent = 'Airing Tomorrow';
        } else {
          badge.textContent = `In ${diffDays} Days`;
        }

        const time = document.createElement('span');
        time.className = 'air-time';
        time.textContent = airDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

        right.appendChild(badge);
        right.appendChild(time);
        row.appendChild(right);

        root.appendChild(row);
      });

    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="error">Failed to query calendar: ${err.message}</div>`;
    }
  }

  renderMockups(container) {
    container.innerHTML = '';
    const mocks = [
      { Show: 'Shogun', Episode: 'S01E07 - A Stick of Time', Days: 0, DateTxt: 'Today' },
      { Show: 'Severance', Episode: 'S02E01 - Line Cuts', Days: 2, DateTxt: 'Thu, May 28' },
      { Show: 'The Last of Us', Episode: 'S02E03 - Hard Memories', Days: 5, DateTxt: 'Sun, May 31' }
    ];

    mocks.forEach(item => {
      const row = document.createElement('div');
      row.className = 'event-row';

      const left = document.createElement('div');
      left.className = 'event-left';

      const sTitle = document.createElement('div');
      sTitle.className = 'show-title';
      sTitle.textContent = item.Show;

      const eDetails = document.createElement('div');
      eDetails.className = 'episode-details';
      eDetails.textContent = item.Episode;

      left.appendChild(sTitle);
      left.appendChild(eDetails);
      row.appendChild(left);

      const right = document.createElement('div');
      right.className = 'event-right';

      const badge = document.createElement('span');
      if (item.Days === 0) {
        badge.className = 'countdown-badge today';
        badge.textContent = 'Airing Today';
      } else if (item.Days === 1) {
        badge.className = 'countdown-badge';
        badge.textContent = 'Airing Tomorrow';
      } else {
        badge.className = 'countdown-badge';
        badge.textContent = `In ${item.Days} Days`;
      }

      const time = document.createElement('span');
      time.className = 'air-time';
      time.textContent = item.DateTxt;

      right.appendChild(badge);
      right.appendChild(time);
      row.appendChild(right);

      container.appendChild(row);
    });
  }
}

if (!customElements.get('jf-upcoming-releases')) {
  customElements.define('jf-upcoming-releases', JfUpcomingReleases);
}
