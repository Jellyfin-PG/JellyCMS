class JfLetterboxdSync extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-letterboxd-sync');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-username'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
  }

  async fetchData() {
    const root = this.shadowRoot.querySelector('#reviews-root');
    const titleEl = this.shadowRoot.querySelector('#letterboxd-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Letterboxd Activity';
    if (titleEl) titleEl.textContent = title;

    const username = this.getAttribute('data-username');
    if (!username) {
      this.renderMockups(root);
      return;
    }

    try {
      const feedUrl = `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;
      const jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;

      const res = await fetch(jsonUrl);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      if (data.status !== 'ok' || !data.items || data.items.length === 0) {
        root.innerHTML = '<div class="empty">No recent reviews or activity found.</div>';
        return;
      }

      root.innerHTML = '';
      const items = data.items.slice(0, 4);

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'review-row';

        const poster = document.createElement('div');
        poster.className = 'movie-poster';

        // Extract poster from item description using regex if available
        // Letterboxd RSS includes a poster img tag in description
        let posterUrl = '';
        const descHtml = item.description || '';
        const imgMatch = descHtml.match(/src="([^"]+)"/);
        if (imgMatch) {
          posterUrl = imgMatch[1];
        }

        if (posterUrl) {
          poster.style.backgroundImage = `url('${posterUrl}')`;
        } else {
          poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
        }

        const details = document.createElement('div');
        details.className = 'review-details';

        const titleLine = document.createElement('div');
        titleLine.className = 'movie-title-line';

        const mTitle = document.createElement('div');
        mTitle.className = 'movie-title';
        // Extract movie title from Letterboxd RSS title (e.g. "Movie Title, Year - ★★★★")
        const rawTitle = item.title || 'Untitled Movie';
        const cleanTitle = rawTitle.split(',')[0].trim();
        mTitle.textContent = cleanTitle;

        // Try to extract star rating from raw title or custom field
        const starsMatch = rawTitle.match(/[★½]+/);
        const rating = starsMatch ? starsMatch[0] : '';

        const ratingEl = document.createElement('span');
        ratingEl.className = 'rating-stars';
        ratingEl.textContent = rating;

        titleLine.appendChild(mTitle);
        titleLine.appendChild(ratingEl);
        details.appendChild(titleLine);

        // Strip HTML tag markup from description to extract text review
        const temp = document.createElement('div');
        temp.innerHTML = descHtml;
        // Strip out the image paragraph
        const pTags = temp.getElementsByTagName('p');
        let reviewContent = '';
        for (let i = 0; i < pTags.length; i++) {
          const text = pTags[i].textContent.trim();
          if (text && !text.includes('Watched on') && !text.includes('Letterboxd')) {
            reviewContent = text;
            break;
          }
        }

        if (!reviewContent) {
          reviewContent = 'Watched / Logged on Letterboxd';
        }

        const revText = document.createElement('p');
        revText.className = 'review-text';
        revText.textContent = reviewContent;
        details.appendChild(revText);

        row.appendChild(poster);
        row.appendChild(details);
        root.appendChild(row);
      });

    } catch (err) {
      console.error(err);
      this.renderMockups(root);
    }
  }

  renderMockups(container) {
    container.innerHTML = '';
    const mocks = [
      { Title: 'Dune: Part Two', Rating: '★★★★★', Review: 'A sweeping cinematic achievement. Villeneuve masterfully translates Herbert\'s work to the big screen.' },
      { Title: 'Challengers', Rating: '★★★★', Review: 'Incredibly energetic editing and music score. Luca Guadagnino keeps the tension high throughout.' }
    ];

    mocks.forEach(item => {
      const row = document.createElement('div');
      row.className = 'review-row';

      const poster = document.createElement('div');
      poster.className = 'movie-poster';
      poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '1.2rem';
      poster.innerHTML = '🎬';

      const details = document.createElement('div');
      details.className = 'review-details';

      const titleLine = document.createElement('div');
      titleLine.className = 'movie-title-line';

      const mTitle = document.createElement('div');
      mTitle.className = 'movie-title';
      mTitle.textContent = item.Title;

      const ratingEl = document.createElement('span');
      ratingEl.className = 'rating-stars';
      ratingEl.textContent = item.Rating;

      titleLine.appendChild(mTitle);
      titleLine.appendChild(ratingEl);
      details.appendChild(titleLine);

      const revText = document.createElement('p');
      revText.className = 'review-text';
      revText.textContent = item.Review;
      details.appendChild(revText);

      row.appendChild(poster);
      row.appendChild(details);
      container.appendChild(row);
    });
  }
}

if (!customElements.get('jf-letterboxd-sync')) {
  customElements.define('jf-letterboxd-sync', JfLetterboxdSync);
}
