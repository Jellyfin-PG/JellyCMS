class JfServerAnnouncements extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-server-announcements');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-announcement_text'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.updateContent();
  }

  connectedCallback() {
    this.updateContent();
  }

  updateContent() {
    const titleEl = this.shadowRoot.querySelector('#announcements-title');
    const msgEl = this.shadowRoot.querySelector('#announcement-msg');
    
    if (titleEl) {
      titleEl.textContent = this.getAttribute('data-title') || 'Server Board';
    }

    if (msgEl) {
      msgEl.textContent = this.getAttribute('data-announcement_text') || 
        'Welcome to the media portal! Maintenance scheduled for Friday at midnight.';
    }
  }
}

if (!customElements.get('jf-server-announcements')) {
  customElements.define('jf-server-announcements', JfServerAnnouncements);
}
