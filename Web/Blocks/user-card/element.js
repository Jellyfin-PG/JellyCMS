class JfUserCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-user-card');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-welcome_prefix', 'data-bg_color', 'data-text_color'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.update();
  }

  connectedCallback() {
    this.update();
    this.loadUser();
  }

  update() {
    const container = this.shadowRoot.querySelector('.user-card-container');
    const prefixEl = this.shadowRoot.querySelector('#prefix');

    if (!container) return;

    const prefix = this.getAttribute('data-welcome_prefix') || 'Welcome back,';
    const bgColor = this.getAttribute('data-bg_color') || '#1a1c24';
    const textColor = this.getAttribute('data-text_color') || '#ffffff';

    if (prefixEl) prefixEl.textContent = prefix;

    container.style.backgroundColor = bgColor;
    container.style.color = textColor;
  }

  async loadUser() {
    const usernameEl = this.shadowRoot.querySelector('#username');
    const avatarEl = this.shadowRoot.querySelector('#avatar');

    if (window.JellyBuilder && window.JellyBuilder.UserName) {
      if (usernameEl) {
        usernameEl.textContent = window.JellyBuilder.UserName;
      }
      if (window.JellyBuilder.UserImageTag) {
        if (avatarEl) {
          const server = window.JellyBuilder.ServerUrl || window.location.origin;
          const userId = window.JellyBuilder.UserId;
          const imgUrl = `${server}/Users/${userId}/Images/Primary?tag=${window.JellyBuilder.UserImageTag}`;
          avatarEl.textContent = '';
          avatarEl.style.backgroundImage = `url('${imgUrl}')`;
        }
        return;
      }
      if (window.JellyBuilder.ApiToken && window.JellyBuilder.UserId) {
        try {
          const server = window.JellyBuilder.ServerUrl || window.location.origin;
          const userId = window.JellyBuilder.UserId;
          const token = window.JellyBuilder.ApiToken;
          const headers = {
            'Accept': 'application/json',
            'X-MediaBrowser-Token': token,
            'Authorization': `MediaBrowser Token="${token}"`
          };
          fetch(`${server}/Users/${userId}`, { headers })
            .then(res => res.json())
            .then(user => {
              if (user.PrimaryImageTag) {
                window.JellyBuilder.UserImageTag = user.PrimaryImageTag;
                if (avatarEl) {
                  const imgUrl = `${server}/Users/${userId}/Images/Primary?tag=${user.PrimaryImageTag}`;
                  avatarEl.textContent = '';
                  avatarEl.style.backgroundImage = `url('${imgUrl}')`;
                }
              }
            }).catch(() => {});
        } catch (e) {}
      }
      return;
    }

    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken || !window.JellyBuilder.UserId) {
      if (usernameEl) usernameEl.textContent = 'Jellyfin Viewer';
      return;
    }

    try {
      const server = window.JellyBuilder.ServerUrl || window.location.origin;
      const userId = window.JellyBuilder.UserId;
      const token = window.JellyBuilder.ApiToken;

      const headers = {
        'Accept': 'application/json',
        'X-MediaBrowser-Token': token,
        'Authorization': `MediaBrowser Token="${token}"`
      };

      const response = await fetch(`${server}/Users/${userId}`, { headers });
      if (!response.ok) throw new Error('Failed to load user info');

      const user = await response.json();
      
      if (usernameEl) {
        usernameEl.textContent = user.Name;
      }

      if (user.PrimaryImageTag && avatarEl) {
        const imgUrl = `${server}/Users/${userId}/Images/Primary?tag=${user.PrimaryImageTag}`;
        avatarEl.textContent = '';
        avatarEl.style.backgroundImage = `url('${imgUrl}')`;
      }
    } catch (e) {
      console.warn('JellyCMS: Could not load user details', e);
    }
  }
}

if (!customElements.get('jf-user-card')) {
  customElements.define('jf-user-card', JfUserCard);
}
