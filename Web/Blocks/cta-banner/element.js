class JfCtaBanner extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-cta-banner');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return [
      'data-title',
      'data-subtitle',
      'data-primary_btn_text',
      'data-primary_btn_link',
      'data-secondary_btn_text',
      'data-secondary_btn_link',
      'data-bg_gradient_start',
      'data-bg_gradient_end',
      'data-glow_color'
    ];
  }

  attributeChangedCallback() {
    this.update();
  }

  connectedCallback() {
    this.update();
  }

  update() {
    const titleEl = this.shadowRoot.getElementById('cta-title');
    const subtitleEl = this.shadowRoot.getElementById('cta-subtitle');
    const primaryBtn = this.shadowRoot.getElementById('btn-primary');
    const secondaryBtn = this.shadowRoot.getElementById('btn-secondary');

    if (titleEl) titleEl.textContent = this.getAttribute('data-title') || 'Ready to Start Streaming?';
    if (subtitleEl) subtitleEl.textContent = this.getAttribute('data-subtitle') || 'Set up your own Jellyfin server today and enjoy free, open-source media streaming.';

    if (primaryBtn) {
      primaryBtn.textContent = this.getAttribute('data-primary_btn_text') || 'Get Started Now';
      primaryBtn.setAttribute('href', this.getAttribute('data-primary_btn_link') || '/web/index.html');
    }

    if (secondaryBtn) {
      secondaryBtn.textContent = this.getAttribute('data-secondary_btn_text') || 'Learn More';
      secondaryBtn.setAttribute('href', this.getAttribute('data-secondary_btn_link') || 'https://jellyfin.org');
    }

    const start = this.getAttribute('data-bg_gradient_start') || '#1a122e';
    const end = this.getAttribute('data-bg_gradient_end') || '#0b0c0f';
    const glow = this.getAttribute('data-glow_color') || '#00a4dc';

    this.style.setProperty('--gradient-start', start);
    this.style.setProperty('--gradient-end', end);
    this.style.setProperty('--glow-color', glow);
  }
}

if (!customElements.get('jf-cta-banner')) {
  customElements.define('jf-cta-banner', JfCtaBanner);
}
