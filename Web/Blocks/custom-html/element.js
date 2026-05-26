class JfCustomHtml extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-custom-html');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-html_content', 'data-css_content', 'data-js_content'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const markupEl = this.shadowRoot.querySelector('#custom-markup');
    const stylesEl = this.shadowRoot.querySelector('#custom-styles');
    if (!markupEl || !stylesEl) return;

    const htmlContent = this.getAttribute('data-html_content') || '';
    const cssContent = this.getAttribute('data-css_content') || '';
    const jsContent = this.getAttribute('data-js_content') || '';

    stylesEl.textContent = cssContent;
    markupEl.innerHTML = htmlContent;

    if (jsContent.trim()) {
      try {
        const runScript = new Function('element', jsContent);
        runScript.call(this, this);
      } catch (err) {
        console.error('JellyCMS Custom HTML: Javascript execution error:', err);
      }
    }
  }
}

if (!customElements.get('jf-custom-html')) {
  customElements.define('jf-custom-html', JfCustomHtml);
}
