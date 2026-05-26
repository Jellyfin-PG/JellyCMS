class JfHeroBanner extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-hero-banner');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-subtitle', 'data-bg_color', 'data-text_color', 'data-button_text', 'data-button_link'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.update();
  }

  connectedCallback() {
    this.update();
  }

  update() {
    const container = this.shadowRoot.querySelector('.hero-container');
    const titleEl = this.shadowRoot.querySelector('#title');
    const subtitleEl = this.shadowRoot.querySelector('#subtitle');
    const buttonEl = this.shadowRoot.querySelector('#cta-button');

    if (!container) return;

    const title = this.getAttribute('data-title') || 'Welcome to Jellyfin';
    const subtitle = this.getAttribute('data-subtitle') || 'Stream your media libraries anywhere, on any device.';
    const bgColor = this.getAttribute('data-bg_color') || '#00a4dc';
    const textColor = this.getAttribute('data-text_color') || '#ffffff';
    const buttonText = this.getAttribute('data-button_text') || 'Browse Library';
    const buttonLink = this.getAttribute('data-button_link') || '/web/index.html';

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (buttonEl) {
      buttonEl.textContent = buttonText;
      buttonEl.setAttribute('href', buttonLink);
      buttonEl.style.color = bgColor;
    }

    container.style.backgroundColor = bgColor;
    container.style.color = textColor;
  }
}

if (!customElements.get('jf-hero-banner')) {
  customElements.define('jf-hero-banner', JfHeroBanner);
}
