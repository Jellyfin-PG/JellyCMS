class JfRecommendationRoulette extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-recommendation-roulette');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
    this._isSpinning = false;
    this._currentRotation = 0;
  }

  static get observedAttributes() {
    return ['data-title'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    const titleEl = this.shadowRoot.querySelector('#roulette-title');
    if (titleEl) titleEl.textContent = newValue || 'Decide What to Watch';
  }

  connectedCallback() {
    const titleEl = this.shadowRoot.querySelector('#roulette-title');
    if (titleEl) titleEl.textContent = this.getAttribute('data-title') || 'Decide What to Watch';

    this.initRoulette();

    const spinBtn = this.shadowRoot.querySelector('#spin-trigger');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => this.spinWheel());
    }

    const svg = this.shadowRoot.querySelector('#wheel-graphic');
    if (svg) {
      svg.addEventListener('transitionend', () => this.onSpinComplete());
    }
  }

  async initRoulette() {
    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this._candidates = this.getMockCandidates();
      this.drawWheel();
      return;
    }

    try {
      const res = await window.JellyBuilder.Api.getItems({
        Recursive: true,
        IncludeItemTypes: 'Movie',
        Limit: 100,
        SortBy: 'Random'
      });
      const items = res.Items || [];

      if (items.length < 6) {
        this._candidates = this.getMockCandidates();
      } else {
        // Pick 6 random
        this._candidates = items.slice(0, 6).map(item => ({
          Id: item.Id,
          Name: item.Name,
          Year: item.ProductionYear || '',
          Type: 'Movie'
        }));
      }

      this.drawWheel();

    } catch (err) {
      console.error(err);
      this._candidates = this.getMockCandidates();
      this.drawWheel();
    }
  }

  getMockCandidates() {
    return [
      { Name: 'Interstellar', Year: '2014' },
      { Name: 'The Dark Knight', Year: '2008' },
      { Name: 'Inception', Year: '2010' },
      { Name: 'Pulp Fiction', Year: '1994' },
      { Name: 'The Matrix', Year: '1999' },
      { Name: 'Spider-Man', Year: '2002' }
    ];
  }

  drawWheel() {
    const svg = this.shadowRoot.querySelector('#wheel-graphic');
    if (!svg) return;

    svg.innerHTML = '';
    const sliceCount = 6;
    const colors = ['#00e5ff', '#00b4cc', '#00838f', '#1d1e2c', '#2a2c41', '#3d405b'];

    for (let i = 0; i < sliceCount; i++) {
      const angleStart = (i * 360) / sliceCount;
      const angleEnd = ((i + 1) * 360) / sliceCount;
      
      const x1 = 100 + 100 * Math.cos((Math.PI * angleStart) / 180);
      const y1 = 100 + 100 * Math.sin((Math.PI * angleStart) / 180);
      const x2 = 100 + 100 * Math.cos((Math.PI * angleEnd) / 180);
      const y2 = 100 + 100 * Math.sin((Math.PI * angleEnd) / 180);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`);
      path.setAttribute('fill', colors[i % colors.length]);
      svg.appendChild(path);

      // Label text
      const midAngle = angleStart + (angleEnd - angleStart) / 2;
      const tx = 100 + 60 * Math.cos((Math.PI * midAngle) / 180);
      const ty = 100 + 60 * Math.sin((Math.PI * midAngle) / 180);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty);
      text.setAttribute('fill', '#ffffff');
      text.setAttribute('font-size', '6');
      text.setAttribute('font-family', 'sans-serif');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('transform', `rotate(${midAngle + 180}, ${tx}, ${ty})`);
      
      const title = this._candidates[i] ? this._candidates[i].Name : 'Media';
      text.textContent = title.length > 12 ? title.substring(0, 10) + '...' : title;
      
      svg.appendChild(text);
    }
  }

  spinWheel() {
    if (this._isSpinning || !this._candidates || this._candidates.length === 0) return;

    this._isSpinning = true;

    const resultCard = this.shadowRoot.querySelector('#result-display');
    if (resultCard) resultCard.style.display = 'none';

    // Choose winning index
    this._winnerIdx = Math.floor(Math.random() * this._candidates.length);

    // Calculate rotation:
    // Slices are 60 degrees. Spin pointer is at top (270 degrees).
    // The slice starts from 0 deg (right side). 
    // We want the slice to land at 270 deg (top).
    // Winning angle will be: 270 - (winningIndex * 60 + 30)
    const winningSliceCenter = this._winnerIdx * 60 + 30;
    const targetAngle = 270 - winningSliceCenter;

    // Spin at least 4 full circles (1440 degrees)
    const extraSpins = 1440;
    this._currentRotation += extraSpins + (targetAngle - (this._currentRotation % 360));

    const svg = this.shadowRoot.querySelector('#wheel-graphic');
    if (svg) {
      svg.style.transform = `rotate(${this._currentRotation}deg)`;
    }
  }

  onSpinComplete() {
    this._isSpinning = false;
    
    const display = this.shadowRoot.querySelector('#result-display');
    const titleTxt = this.shadowRoot.querySelector('#result-title-txt');
    const metaTxt = this.shadowRoot.querySelector('#result-meta-txt');
    const poster = this.shadowRoot.querySelector('#result-poster-img');
    const link = this.shadowRoot.querySelector('#result-link');

    if (!display || !this._candidates || this._winnerIdx === undefined) return;

    const winner = this._candidates[this._winnerIdx];
    
    if (titleTxt) titleTxt.textContent = winner.Name;
    if (metaTxt) metaTxt.textContent = winner.Year ? `Movie (${winner.Year})` : 'Movie';

    if (poster) {
      if (winner.Id && window.JellyBuilder && window.JellyBuilder.ServerUrl) {
        const serverUrl = window.JellyBuilder.ServerUrl;
        poster.style.backgroundImage = `url('${serverUrl}/Items/${winner.Id}/Images/Primary?maxWidth=100')`;
      } else {
        poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      }
    }

    if (link) {
      if (winner.Id && window.JellyBuilder && window.JellyBuilder.ServerUrl) {
        const serverUrl = window.JellyBuilder.ServerUrl;
        link.href = `${serverUrl}/web/index.html#/details?id=${winner.Id}`;
        link.style.display = 'inline-block';
      } else {
        link.style.display = 'none';
      }
    }

    display.style.display = 'flex';
  }
}

if (!customElements.get('jf-recommendation-roulette')) {
  customElements.define('jf-recommendation-roulette', JfRecommendationRoulette);
}
