class JfFeatureCards extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-feature-cards');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return [
      'data-columns',
      'data-card_bg',
      'data-hover_accent',
      'data-card1_icon',
      'data-card1_title',
      'data-card1_desc',
      'data-card2_icon',
      'data-card2_title',
      'data-card2_desc',
      'data-card3_icon',
      'data-card3_title',
      'data-card3_desc'
    ];
  }

  attributeChangedCallback() {
    this.update();
  }

  connectedCallback() {
    this.update();
  }

  update() {
    const grid = this.shadowRoot.getElementById('cards-grid');
    if (!grid) return;

    const cols = this.getAttribute('data-columns') || '3';
    const cardBg = this.getAttribute('data-card_bg') || '#14151b';
    const hoverAccent = this.getAttribute('data-hover_accent') || '#00a4dc';

    this.style.setProperty('--columns', cols);
    this.style.setProperty('--card-bg', cardBg);
    this.style.setProperty('--hover-accent', hoverAccent);

    grid.innerHTML = '';
    
    for (let i = 1; i <= 3; i++) {
      const icon = this.getAttribute(`data-card${i}_icon`);
      const title = this.getAttribute(`data-card${i}_title`);
      const desc = this.getAttribute(`data-card${i}_desc`);

      if (title || icon) {
        const card = document.createElement('div');
        card.className = 'feature-card';
        card.innerHTML = `
          <div class="card-icon-wrapper">
            <span class="material-symbols-outlined">${icon || 'star'}</span>
          </div>
          <h4 class="card-title">${title || ''}</h4>
          <p class="card-desc">${desc || ''}</p>
        `;
        grid.appendChild(card);
      }
    }
  }
}

if (!customElements.get('jf-feature-cards')) {
  customElements.define('jf-feature-cards', JfFeatureCards);
}
