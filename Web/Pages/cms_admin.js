(function () {
  const state = {
    activeTab: 'pages',
    pages: [],
    installedBlocks: [],
    marketplaceBlocks: [],
    repositories: [],
    
    activePage: null,
    activeLayout: [],
    selectedInstanceId: null
  };

  let DOM = {};
  let activePageEl = null;

  function getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('api_key') || urlParams.get('token');
    const urlUserId = urlParams.get('user_id');
    if (urlToken) {
      const creds = { AccessToken: urlToken };
      if (urlUserId) {
        creds.UserId = urlUserId;
      }
      localStorage.setItem('user_credentials', JSON.stringify(creds));
    }

    if (window.ApiClient) {
      headers['X-MediaBrowser-Token'] = ApiClient.accessToken();
      headers['Authorization'] = `MediaBrowser Token="${ApiClient.accessToken()}"`;
    } else {
      const creds = JSON.parse(localStorage.getItem('user_credentials') || '{}');
      const token = creds.AccessToken || creds.Token || '';
      if (token) {
        headers['X-MediaBrowser-Token'] = token;
        headers['Authorization'] = `MediaBrowser Token="${token}"`;
      }
    }
    return headers;
  }

  function init(page) {
    if (page.dataset.cmsInitialized) return;
    page.dataset.cmsInitialized = "true";
    activePageEl = page;

    let token = '';
    let userId = '';
    if (window.ApiClient) {
      token = ApiClient.accessToken();
      userId = ApiClient.getCurrentUserId();
    } else {
      try {
        const creds = JSON.parse(localStorage.getItem('user_credentials') || '{}');
        token = creds.AccessToken || creds.Token || '';
        userId = creds.UserId || '';
      } catch {}
    }
    window.JellyBuilder = Object.assign(window.JellyBuilder || {}, {
      ServerUrl: window.location.origin,
      ApiToken: token,
      UserId: userId
    });

    DOM = {
      navItems: page.querySelectorAll('.nav-item'),
      tabContents: page.querySelectorAll('.tab-content'),
      
      pagesList: page.querySelector('#pages-list'),
      btnCreatePage: page.querySelector('#btn-create-page'),
      
      settingHeadHtml: page.querySelector('#setting-head-html'),
      settingCss: page.querySelector('#setting-css'),
      settingJs: page.querySelector('#setting-js'),
      btnSaveSettings: page.querySelector('#btn-save-settings'),
      
      marketplaceList: page.querySelector('#marketplace-list'),
      repositoriesList: page.querySelector('#repositories-list'),
      installedBlocksList: page.querySelector('#installed-blocks-list'),
      repoAddForm: page.querySelector('#repo-add-form'),
      repoName: page.querySelector('#repo-name'),
      repoUrl: page.querySelector('#repo-url'),

      builderStudio: page.querySelector('#builder-studio'),
      builderPageTitle: page.querySelector('#builder-page-title'),
      builderPageSlug: page.querySelector('#builder-page-slug'),
      builderBtnBack: page.querySelector('#builder-btn-back'),
      builderBtnSettings: page.querySelector('#builder-btn-settings'),
      builderBtnDraft: page.querySelector('#builder-btn-draft'),
      builderBtnPublish: page.querySelector('#builder-btn-publish'),
      deviceBtns: page.querySelectorAll('.device-btn'),
      builderCanvas: page.querySelector('#builder-canvas'),
      canvasEmptyState: page.querySelector('#canvas-empty-state'),
      
      inspectorTabBtns: page.querySelectorAll('.inspector-tab-btn'),
      subtabPalette: page.querySelector('#subtab-palette'),
      subtabInspector: page.querySelector('#subtab-inspector'),
      paletteBlocksList: page.querySelector('#palette-blocks'),
      inspectorNoSelection: page.querySelector('#inspector-no-selection'),
      inspectorEditor: page.querySelector('#inspector-editor'),
      selectedBlockIcon: page.querySelector('#selected-block-icon'),
      selectedBlockName: page.querySelector('#selected-block-name'),
      dynamicPropertiesRoot: page.querySelector('#dynamic-properties-root'),
      
      modalOverlay: page.querySelector('#page-settings-modal'),
      modalCloseBtns: page.querySelectorAll('.modal-close'),
      modalBtnSave: page.querySelector('#modal-btn-save'),
      modalPageTitle: page.querySelector('#modal-page-title'),
      modalPageSlug: page.querySelector('#modal-page-slug'),
      modalSeoDesc: page.querySelector('#modal-seo-desc'),
      modalSeoKeywords: page.querySelector('#modal-seo-keywords'),
      modalSeoAuthor: page.querySelector('#modal-seo-author'),
      modalPageDraft: page.querySelector('#modal-page-draft'),
      modalLayoutStyle: page.querySelector('#modal-layout-style'),
      modalMaxWidthGroup: page.querySelector('#modal-max-width-group'),
      modalMaxWidth: page.querySelector('#modal-max-width'),
      modalBgColor: page.querySelector('#modal-bg-color')
    };

    const btnFullscreen = page.querySelector('#btn-fullscreen-studio');
    if (btnFullscreen) {
      if (window.location.pathname.endsWith('/editor')) {
        btnFullscreen.style.display = 'none';
      } else {
        btnFullscreen.addEventListener('click', () => {
          const token = window.ApiClient ? window.ApiClient.accessToken() : '';
          const userId = window.ApiClient ? window.ApiClient.getCurrentUserId() : '';
          window.open(`/cms/admin/editor?api_key=${token}&user_id=${userId}`, '_blank');
        });
      }
    }

    bindEvents();
    loadDashboardData();
  }

  function bindEvents() {
    DOM.navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.navItems.forEach(i => i.classList.remove('active'));
        DOM.tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        activePageEl.querySelector(`#tab-${tabId}`).classList.add('active');
        state.activeTab = tabId;
      });
    });

    DOM.inspectorTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.inspectorTabBtns.forEach(b => b.classList.remove('active'));
        DOM.subtabPalette.classList.remove('active');
        DOM.subtabInspector.classList.remove('active');

        btn.classList.add('active');
        const subtabId = btn.getAttribute('data-subtab');
        activePageEl.querySelector(`#subtab-${subtabId}`).classList.add('active');
      });
    });

    DOM.btnCreatePage.addEventListener('click', () => openPageSettingsModal());
    
    DOM.btnSaveSettings.addEventListener('click', saveGlobalSettings);

    DOM.repoAddForm.addEventListener('submit', addRepository);

    DOM.builderBtnBack.addEventListener('click', closeBuilderStudio);
    DOM.builderBtnSettings.addEventListener('click', () => openPageSettingsModal(state.activePage));
    DOM.builderBtnDraft.addEventListener('click', () => saveActivePage(true));
    DOM.builderBtnPublish.addEventListener('click', () => saveActivePage(false));

    DOM.deviceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.deviceBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-viewport');
        DOM.builderCanvas.className = `canvas-inner ${mode}`;
        renderCanvas();
      });
    });

    DOM.modalCloseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.modalOverlay.style.display = 'none';
      });
    });

    DOM.modalBtnSave.addEventListener('click', applyPageSettings);

    if (DOM.modalLayoutStyle) {
      DOM.modalLayoutStyle.addEventListener('change', () => {
        if (DOM.modalLayoutStyle.value === 'contained') {
          DOM.modalMaxWidthGroup.style.display = 'block';
        } else {
          DOM.modalMaxWidthGroup.style.display = 'none';
        }
      });
    }
  }

  async function loadDashboardData() {
    await fetchPages();
    await fetchGlobalSettings();
    await fetchInstalledBlocks();
    await loadAndRegisterBlocksAssets();
    await fetchRepositories();
    await fetchMarketplaceBlocks();

    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get('page_id');
    if (pageId) {
      const pageToEdit = state.pages.find(p => p.Id === pageId);
      if (pageToEdit) {
        openBuilderStudio(pageToEdit);
      }
    }
  }

  async function fetchPages() {
    try {
      const response = await fetch('/cms/admin/pages', { headers: getHeaders() });
      if (response.ok) {
        state.pages = await response.json();
        renderPagesList();
      }
    } catch (e) {
      console.error('JellyCMS: Failed to fetch pages', e);
    }
  }

  async function fetchGlobalSettings() {
    try {
      const response = await fetch('/cms/admin/settings', { headers: getHeaders() });
      if (response.ok) {
        const settings = await response.json();
        DOM.settingHeadHtml.value = settings.GlobalHeadHtml || '';
        DOM.settingCss.value = settings.GlobalCss || '';
        DOM.settingJs.value = settings.GlobalJs || '';
      }
    } catch (e) {
      console.error('JellyCMS: Failed to fetch settings', e);
    }
  }

  async function fetchInstalledBlocks() {
    try {
      const response = await fetch('/cms/admin/blocks', { headers: getHeaders() });
      if (response.ok) {
        state.installedBlocks = await response.json();
        renderInstalledBlocksList();
        renderBlockPalette();
      }
    } catch (e) {
      console.error('JellyCMS: Failed to fetch installed blocks', e);
    }
  }

  async function fetchRepositories() {
    try {
      const response = await fetch('/cms/admin/marketplace/repositories', { headers: getHeaders() });
      if (response.ok) {
        state.repositories = await response.json();
        renderRepositoriesList();
      }
    } catch (e) {
      console.error('JellyCMS: Failed to fetch repositories', e);
    }
  }

  async function fetchMarketplaceBlocks() {
    try {
      const response = await fetch('/cms/admin/marketplace', { headers: getHeaders() });
      if (response.ok) {
        state.marketplaceBlocks = await response.json();
        renderMarketplaceBlocksList();
      }
    } catch (e) {
      console.error('JellyCMS: Failed to fetch marketplace blocks', e);
    }
  }

  function renderPagesList() {
    DOM.pagesList.innerHTML = '';
    if (state.pages.length === 0) {
      DOM.pagesList.innerHTML = `
        <div class="loading-state">
          <p>No pages created yet. Click "Create New Page" to start designing.</p>
        </div>`;
      return;
    }

    state.pages.forEach(page => {
      const card = document.createElement('div');
      card.className = 'page-card';
      
      const statusClass = page.IsDraft ? 'draft' : 'published';
      const statusText = page.IsDraft ? 'Draft' : 'Published';

      card.innerHTML = `
        <div class="page-info" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; width: 100%;">
          <div style="flex-grow: 1; min-width: 0;">
            <h3 style="margin: 0 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(page.Title)}</h3>
            <a href="/CMS/${escapeHtml(page.Slug)}" target="_blank" class="page-slug-badge" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px; color: var(--primary);">
              <span class="material-symbols-outlined" style="font-size: 14px;">open_in_new</span>
              /CMS/${escapeHtml(page.Slug)}
            </a>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0;">
            <span class="page-status-badge ${statusClass}">${statusText}</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn-icon btn-edit-seo" data-id="${page.Id}" title="SEO & Settings" style="padding: 6px; border-radius: 4px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size: 18px;">settings</span>
              </button>
              <button class="btn-icon btn-delete-page" data-id="${page.Id}" title="Delete Page" style="padding: 6px; border-radius: 4px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: var(--danger); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
              </button>
            </div>
          </div>
        </div>
        <div class="page-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: auto;">
          <a href="/CMS/${escapeHtml(page.Slug)}" target="_blank" class="btn btn-secondary btn-view-page" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; padding: 8px 12px;">
            <span class="material-symbols-outlined" style="font-size: 16px;">visibility</span> View Page
          </a>
          <button class="btn btn-primary btn-edit-layout" data-id="${page.Id}" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; padding: 8px 12px; border: none; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 16px;">design_services</span> Design Layout
          </button>
        </div>`;

      card.querySelector('.btn-edit-layout').addEventListener('click', () => openBuilderStudio(page));
      card.querySelector('.btn-edit-seo').addEventListener('click', () => openPageSettingsModal(page));
      card.querySelector('.btn-delete-page').addEventListener('click', () => deletePage(page.Id));

      DOM.pagesList.appendChild(card);
    });
  }

  async function saveGlobalSettings() {
    const payload = {
      GlobalHeadHtml: DOM.settingHeadHtml.value,
      GlobalCss: DOM.settingCss.value,
      GlobalJs: DOM.settingJs.value
    };

    try {
      const response = await fetch('/cms/admin/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Global layouts successfully saved!');
      } else {
        alert('Failed to save settings: ' + await response.text());
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to the backend.');
    }
  }

  function renderRepositoriesList() {
    DOM.repositoriesList.innerHTML = '';
    if (state.repositories.length === 0) {
      DOM.repositoriesList.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No repositories registered.</div>';
      return;
    }

    state.repositories.forEach(repo => {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.innerHTML = `
        <div class="repo-item-meta">
          <span>${escapeHtml(repo.Name)}</span>
          <span>${escapeHtml(repo.ManifestUrl)}</span>
        </div>
        <button class="btn-icon btn-delete-repo" data-id="${repo.Id}">
          <span class="material-symbols-outlined" style="color:var(--danger)">delete</span>
        </button>`;

      item.querySelector('.btn-delete-repo').addEventListener('click', () => deleteRepository(repo.Id));
      DOM.repositoriesList.appendChild(item);
    });
  }

  async function addRepository(e) {
    e.preventDefault();
    const payload = {
      Name: DOM.repoName.value,
      ManifestUrl: DOM.repoUrl.value
    };

    try {
      const response = await fetch('/cms/admin/marketplace/repositories', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        DOM.repoName.value = '';
        DOM.repoUrl.value = '';
        await fetchRepositories();
        await fetchMarketplaceBlocks();
      } else {
        alert('Failed to add repo: ' + await response.text());
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteRepository(id) {
    if (!confirm('Are you sure you want to delete this repository?')) return;
    try {
      const response = await fetch(`/cms/admin/marketplace/repositories/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (response.ok) {
        await fetchRepositories();
        await fetchMarketplaceBlocks();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderInstalledBlocksList() {
    DOM.installedBlocksList.innerHTML = '';
    state.installedBlocks.forEach(block => {
      const item = document.createElement('div');
      item.className = 'installed-item';
      item.innerHTML = `
        <div class="installed-item-meta">
          <span>${escapeHtml(block.Name)}</span>
          <span>ID: ${escapeHtml(block.Id)} (${escapeHtml(block.Category)})</span>
        </div>
        ${block.IsBuiltIn ? '<span style="font-size:0.75rem; color:var(--primary); font-weight:600;">System</span>' : `
        <button class="btn-icon btn-uninstall-block" data-id="${block.Id}">
          <span class="material-symbols-outlined" style="color:var(--danger)">delete</span>
        </button>`}`;

      const uninstallBtn = item.querySelector('.btn-uninstall-block');
      if (uninstallBtn) {
        uninstallBtn.addEventListener('click', () => uninstallBlock(block.Id));
      }

      DOM.installedBlocksList.appendChild(item);
    });
  }

  async function uninstallBlock(blockId) {
    if (!confirm(`Are you sure you want to uninstall block "${blockId}"? This will delete the files on disk.`)) return;
    try {
      const response = await fetch(`/cms/admin/blocks/${blockId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (response.ok) {
        await fetchInstalledBlocks();
      } else {
        alert('Failed to uninstall: ' + await response.text());
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderMarketplaceBlocksList() {
    DOM.marketplaceList.innerHTML = '';
    if (state.marketplaceBlocks.length === 0) {
      DOM.marketplaceList.innerHTML = '<div class="loading-state">No blocks available in registered repositories.</div>';
      return;
    }

    state.marketplaceBlocks.forEach(block => {
      const isInstalled = state.installedBlocks.some(b => b.Id === block.Id);

      const card = document.createElement('div');
      card.className = 'market-card';
      card.innerHTML = `
        <div class="market-card-header">
          <div class="market-card-title">
            <h4>${escapeHtml(block.Name)}</h4>
            <span>Repo: ${escapeHtml(block.RepoName)}</span>
          </div>
          <span class="market-ver-tag">v${escapeHtml(block.Version)}</span>
        </div>
        <p class="market-desc">${escapeHtml(block.Description)}</p>
        <button class="btn btn-secondary btn-install-block" data-id="${block.Id}" ${isInstalled ? 'disabled' : ''}>
          <span class="material-symbols-outlined">${isInstalled ? 'check' : 'download'}</span>
          ${isInstalled ? 'Installed' : 'Install Block'}
        </button>`;

      card.querySelector('.btn-install-block').addEventListener('click', () => installBlock(block));
      DOM.marketplaceList.appendChild(card);
    });
  }

  async function installBlock(block) {
    try {
      const response = await fetch('/cms/admin/marketplace/install', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          BlockId: block.Id,
          DownloadUrl: block.DownloadUrl
        })
      });

      if (response.ok) {
        await fetchInstalledBlocks();
        await loadAndRegisterBlocksAssets();
        await fetchMarketplaceBlocks();
      } else {
        alert('Failed to install block: ' + await response.text());
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function deletePage(id) {
    if (!confirm('Are you sure you want to delete this page? This cannot be undone.')) return;
    try {
      const response = await fetch(`/cms/admin/pages/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (response.ok) {
        await fetchPages();
      }
    } catch (e) {
      console.error(e);
    }
  }

  let modalEditingPage = null;

  function openPageSettingsModal(page = null) {
    modalEditingPage = page;
    if (page) {
      DOM.modalPageTitle.value = page.Title;
      DOM.modalPageSlug.value = page.Slug;
      DOM.modalPageDraft.checked = page.IsDraft;
      
      try {
        const seo = JSON.parse(page.SeoMetadata || '{}');
        DOM.modalSeoDesc.value = seo.description || '';
        DOM.modalSeoKeywords.value = seo.keywords || '';
        DOM.modalSeoAuthor.value = seo.author || '';
        DOM.modalLayoutStyle.value = seo.pageLayout || 'full-width';
        DOM.modalMaxWidth.value = seo.maxWidth || '1200px';
        DOM.modalBgColor.value = seo.backgroundColor || '';

        if (seo.pageLayout === 'contained') {
          DOM.modalMaxWidthGroup.style.display = 'block';
        } else {
          DOM.modalMaxWidthGroup.style.display = 'none';
        }
      } catch {
        DOM.modalSeoDesc.value = '';
        DOM.modalSeoKeywords.value = '';
        DOM.modalSeoAuthor.value = '';
        DOM.modalLayoutStyle.value = 'full-width';
        DOM.modalMaxWidth.value = '1200px';
        DOM.modalBgColor.value = '';
        DOM.modalMaxWidthGroup.style.display = 'none';
      }
    } else {
      DOM.modalPageTitle.value = '';
      DOM.modalPageSlug.value = '';
      DOM.modalPageDraft.checked = true;
      DOM.modalSeoDesc.value = '';
      DOM.modalSeoKeywords.value = '';
      DOM.modalSeoAuthor.value = '';
      DOM.modalLayoutStyle.value = 'full-width';
      DOM.modalMaxWidth.value = '1200px';
      DOM.modalBgColor.value = '';
      DOM.modalMaxWidthGroup.style.display = 'none';
    }
    DOM.modalOverlay.style.display = 'flex';
  }

  async function applyPageSettings() {
    const title = DOM.modalPageTitle.value.trim();
    let slug = DOM.modalPageSlug.value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-\/]/g, '').toLowerCase();

    if (!title) {
      alert('Title is required');
      return;
    }

    const seo = {
      description: DOM.modalSeoDesc.value.trim(),
      keywords: DOM.modalSeoKeywords.value.trim(),
      author: DOM.modalSeoAuthor.value.trim(),
      pageLayout: DOM.modalLayoutStyle.value,
      maxWidth: DOM.modalMaxWidth.value.trim(),
      backgroundColor: DOM.modalBgColor.value.trim()
    };

    if (modalEditingPage) {
      modalEditingPage.Title = title;
      modalEditingPage.Slug = slug;
      modalEditingPage.IsDraft = DOM.modalPageDraft.checked;
      modalEditingPage.SeoMetadata = JSON.stringify(seo);

      if (state.activePage && state.activePage.Id === modalEditingPage.Id) {
        DOM.builderPageTitle.textContent = title;
        DOM.builderPageSlug.textContent = `/CMS/${slug}`;
        applyCanvasLayoutStyles(modalEditingPage);
      }
      
      DOM.modalOverlay.style.display = 'none';
      
      if (state.activeTab === 'pages') {
        await savePageRecord(modalEditingPage);
        await fetchPages();
      }
    } else {
      const newPage = {
        Title: title,
        Slug: slug,
        IsDraft: DOM.modalPageDraft.checked,
        SeoMetadata: JSON.stringify(seo),
        LayoutSchema: '[]'
      };

      DOM.modalOverlay.style.display = 'none';
      const page = await savePageRecord(newPage);
      if (page) {
        await fetchPages();
        openBuilderStudio(page);
      }
    }
  }

  async function savePageRecord(pageObj) {
    try {
      const response = await fetch('/cms/admin/pages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(pageObj)
      });
      if (response.ok) {
        return await response.json();
      } else {
        alert('Failed to save page settings: ' + await response.text());
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  function openBuilderStudio(page) {
    if (!window.location.pathname.endsWith('/editor')) {
      const token = window.ApiClient ? window.ApiClient.accessToken() : '';
      const userId = window.ApiClient ? window.ApiClient.getCurrentUserId() : '';
      window.open(`/cms/admin/editor?api_key=${token}&user_id=${userId}&page_id=${page.Id}`, '_blank');
      return;
    }

    state.activePage = page;
    state.selectedInstanceId = null;
    
    try {
      state.activeLayout = JSON.parse(page.LayoutSchema || '[]');
    } catch {
      state.activeLayout = [];
    }

    DOM.builderPageTitle.textContent = page.Title;
    DOM.builderPageSlug.textContent = `/CMS/${page.Slug}`;
    DOM.builderStudio.style.display = 'flex';

    DOM.deviceBtns.forEach(btn => btn.classList.remove('active'));
    DOM.deviceBtns[0].classList.add('active');
    DOM.builderCanvas.className = 'canvas-inner desktop';

    DOM.inspectorTabBtns.forEach(b => b.classList.remove('active'));
    DOM.inspectorTabBtns[0].classList.add('active');
    DOM.subtabPalette.classList.add('active');
    DOM.subtabInspector.classList.remove('active');

    renderCanvas();
    applyCanvasLayoutStyles(page);
    hideInspectorEditor();
  }

  function closeBuilderStudio() {
    if (confirm('Close editor? Any unsaved layout changes will be lost.')) {
      DOM.builderStudio.style.display = 'none';
      state.activePage = null;
      state.activeLayout = [];
      state.selectedInstanceId = null;
      fetchPages();
    }
  }

  function renderBlockPalette() {
    DOM.paletteBlocksList.innerHTML = '';
    state.installedBlocks.forEach(block => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.innerHTML = `
        <span class="material-symbols-outlined">${escapeHtml(block.Icon)}</span>
        <p>${escapeHtml(block.Name)}</p>`;
      
      item.addEventListener('click', () => addBlockInstance(block.Id));
      DOM.paletteBlocksList.appendChild(item);
    });
  }

  function addBlockInstance(blockId) {
    const block = state.installedBlocks.find(b => b.Id === blockId);
    if (!block) return;

    const settings = {};
    try {
      const schema = JSON.parse(block.SchemaJson);
      if (schema.settings && Array.isArray(schema.settings)) {
        schema.settings.forEach(s => {
          settings[s.name] = s.default !== undefined ? s.default : '';
        });
      }
    } catch (e) {
      console.error('Failed to parse block defaults schema', e);
    }

    const instanceId = 'inst-' + Math.random().toString(36).substring(2, 11) + '-' + Math.random().toString(36).substring(2, 11);
    const newInstance = {
      Id: instanceId,
      BlockId: blockId,
      Settings: settings,
      Responsive: {
        Desktop: { Visible: true, Margin: '0px 0px 24px 0px', Padding: '', Align: '' },
        Tablet: { Visible: true, Margin: '', Padding: '', Align: '' },
        Mobile: { Visible: true, Margin: '0px 0px 16px 0px', Padding: '', Align: '' }
      }
    };

    state.activeLayout.push(newInstance);
    renderCanvas();
    selectBlockInstance(instanceId);
  }

  function renderCanvas() {
    const previousWrappers = DOM.builderCanvas.querySelectorAll('.canvas-block-wrapper');
    previousWrappers.forEach(w => w.remove());

    if (state.activeLayout.length === 0) {
      DOM.canvasEmptyState.style.display = 'flex';
      return;
    }
    
    DOM.canvasEmptyState.style.display = 'none';

    state.activeLayout.forEach((instance, index) => {
      const block = state.installedBlocks.find(b => b.Id === instance.BlockId);
      const blockName = block ? block.Name : instance.BlockId;
      const blockIcon = block ? block.Icon : 'widgets';

      const wrapper = document.createElement('div');
      wrapper.className = 'canvas-block-wrapper';
      wrapper.setAttribute('data-instance-id', instance.Id);
      if (state.selectedInstanceId === instance.Id) {
        wrapper.classList.add('selected');
      }

      const label = document.createElement('div');
      label.className = 'block-label';
      label.textContent = blockName;
      wrapper.appendChild(label);

      const rows = getLayoutRows();
      let itemRowIdx = -1;
      let itemColIdx = -1;
      for (let r = 0; r < rows.length; r++) {
        const col = rows[r].findIndex(cell => cell.index === index);
        if (col !== -1) {
          itemRowIdx = r;
          itemColIdx = col;
          break;
        }
      }

      const canLeft = itemColIdx > 0;
      const canRight = itemRowIdx !== -1 && itemColIdx < rows[itemRowIdx].length - 1;
      const canUp = itemRowIdx > 0;
      const canDown = itemRowIdx !== -1 && itemRowIdx < rows.length - 1;

      const controls = document.createElement('div');
      controls.className = 'block-controls';
      controls.innerHTML = `
        ${canLeft ? `<button class="btn-ctrl-left" title="Move Left"><span class="material-symbols-outlined" style="font-size: 16px">arrow_back</span></button>` : ''}
        ${canUp ? `<button class="btn-ctrl-up" title="Move Up"><span class="material-symbols-outlined" style="font-size: 16px">arrow_upward</span></button>` : ''}
        ${canDown ? `<button class="btn-ctrl-down" title="Move Down"><span class="material-symbols-outlined" style="font-size: 16px">arrow_downward</span></button>` : ''}
        ${canRight ? `<button class="btn-ctrl-right" title="Move Right"><span class="material-symbols-outlined" style="font-size: 16px">arrow_forward</span></button>` : ''}
        <button class="btn-ctrl-delete" title="Delete Block"><span class="material-symbols-outlined" style="font-size: 16px">delete</span></button>`;

      if (canLeft) {
        controls.querySelector('.btn-ctrl-left').addEventListener('click', (e) => {
          e.stopPropagation();
          moveInstanceDirection(index, 'left');
        });
      }
      if (canRight) {
        controls.querySelector('.btn-ctrl-right').addEventListener('click', (e) => {
          e.stopPropagation();
          moveInstanceDirection(index, 'right');
        });
      }
      if (canUp) {
        controls.querySelector('.btn-ctrl-up').addEventListener('click', (e) => {
          e.stopPropagation();
          moveInstanceDirection(index, 'up');
        });
      }
      if (canDown) {
        controls.querySelector('.btn-ctrl-down').addEventListener('click', (e) => {
          e.stopPropagation();
          moveInstanceDirection(index, 'down');
        });
      }
      controls.querySelector('.btn-ctrl-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteInstance(instance.Id);
      });

      wrapper.appendChild(controls);

      const elementTag = `jf-${instance.BlockId}`;
      const previewEl = document.createElement(elementTag);
      previewEl.id = `preview-${instance.Id}`;

      for (let key in instance.Settings) {
        previewEl.setAttribute(`data-${key}`, instance.Settings[key]);
      }

      wrapper.appendChild(previewEl);

      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        selectBlockInstance(instance.Id);
      });

      DOM.builderCanvas.appendChild(wrapper);
    });

    applyCanvasBlockWidths();
  }



  function deleteInstance(instanceId) {
    state.activeLayout = state.activeLayout.filter(inst => inst.Id !== instanceId);
    if (state.selectedInstanceId === instanceId) {
      state.selectedInstanceId = null;
      hideInspectorEditor();
    }
    renderCanvas();
  }

  function selectBlockInstance(instanceId) {
    state.selectedInstanceId = instanceId;

    DOM.builderCanvas.querySelectorAll('.canvas-block-wrapper').forEach(w => {
      if (w.getAttribute('data-instance-id') === instanceId) {
        w.classList.add('selected');
      } else {
        w.classList.remove('selected');
      }
    });

    const instance = state.activeLayout.find(inst => inst.Id === instanceId);
    const block = state.installedBlocks.find(b => b.Id === instance.BlockId);
    if (!instance || !block) return;

    DOM.inspectorTabBtns.forEach(b => b.classList.remove('active'));
    DOM.inspectorTabBtns[1].classList.add('active');
    DOM.subtabPalette.classList.remove('active');
    DOM.subtabInspector.classList.add('active');

    DOM.selectedBlockIcon.textContent = block.Icon;
    DOM.selectedBlockName.textContent = block.Name;
    
    generateInspectorProperties(instance, block);
  }

  function hideInspectorEditor() {
    DOM.inspectorNoSelection.style.display = 'flex';
    DOM.inspectorEditor.style.display = 'none';
  }

  function generateInspectorProperties(instance, block) {
    DOM.inspectorNoSelection.style.display = 'none';
    DOM.inspectorEditor.style.display = 'block';
    DOM.dynamicPropertiesRoot.innerHTML = '';

    let schema = { settings: [] };
    try {
      schema = JSON.parse(block.SchemaJson);
    } catch (e) {
      console.error(e);
    }

    const groups = {};
    if (schema.settings && Array.isArray(schema.settings)) {
      schema.settings.forEach(field => {
        const groupName = field.group || 'Content';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(field);
      });
    }

    for (let groupName in groups) {
      const accordion = createAccordionSection(groupName);
      const fieldsContainer = accordion.querySelector('.accordion-content');

      groups[groupName].forEach(field => {
        const fieldEl = createFieldControl(field, instance);
        fieldsContainer.appendChild(fieldEl);
      });

      DOM.dynamicPropertiesRoot.appendChild(accordion);
    }

    const responsiveAccordion = createAccordionSection('Responsive Layout');
    const respContainer = responsiveAccordion.querySelector('.accordion-content');
    
    respContainer.appendChild(createResponsiveVisibilityRow(instance));
    
    respContainer.appendChild(createResponsiveStylesForm(instance));

    DOM.dynamicPropertiesRoot.appendChild(responsiveAccordion);
  }

  function createAccordionSection(title) {
    const wrapper = document.createElement('div');
    wrapper.className = 'accordion-group';
    
    const header = document.createElement('div');
    header.className = 'accordion-header';
    header.innerHTML = `
      <span>${escapeHtml(title)}</span>
      <span class="material-symbols-outlined accordion-arrow" style="font-size:18px">expand_more</span>`;
    
    const content = document.createElement('div');
    content.className = 'accordion-content';

    header.addEventListener('click', () => {
      const arrow = header.querySelector('.accordion-arrow');
      if (content.style.display === 'none') {
        content.style.display = 'flex';
        arrow.textContent = 'expand_less';
      } else {
        content.style.display = 'none';
        arrow.textContent = 'expand_more';
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    return wrapper;
  }

  function createFieldControl(field, instance) {
    const wrapper = document.createElement('div');
    const isHalf = field.layout === 'half';
    wrapper.className = `form-group ${isHalf ? 'field-half' : 'field-full'}`;

    const label = document.createElement('label');
    label.textContent = field.label || field.name;
    wrapper.appendChild(label);

    const currentValue = instance.Settings[field.name] !== undefined 
      ? instance.Settings[field.name] 
      : (field.default !== undefined ? field.default : '');

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
      input.value = currentValue;
    } else if (field.type === 'select') {
      input = document.createElement('select');
      if (field.options && Array.isArray(field.options)) {
        field.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (opt === currentValue) option.selected = true;
          input.appendChild(option);
        });
      }
    } else if (field.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.value = currentValue || '#000000';
      input.style.padding = '0';
      input.style.height = '40px';
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.value = currentValue;
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = currentValue;
    }

    input.addEventListener('input', (e) => {
      let val = e.target.value;
      if (field.type === 'number') val = parseInt(val, 10) || 0;
      
      instance.Settings[field.name] = val;

      const previewNode = DOM.builderCanvas.querySelector(`#preview-${instance.Id}`);
      if (previewNode) {
        previewNode.setAttribute(`data-${field.name}`, val);
      }
    });

    input.addEventListener('change', (e) => {
      let val = e.target.value;
      if (field.type === 'number') val = parseInt(val, 10) || 0;
      instance.Settings[field.name] = val;
      const previewNode = DOM.builderCanvas.querySelector(`#preview-${instance.Id}`);
      if (previewNode) {
        previewNode.setAttribute(`data-${field.name}`, val);
      }
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  function createResponsiveVisibilityRow(instance) {
    const row = document.createElement('div');
    row.className = 'form-group field-full';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.background = 'rgba(255,255,255,0.01)';
    row.style.padding = '10px';
    row.style.borderRadius = '6px';
    row.style.border = '1px solid var(--border-color)';
    row.style.boxSizing = 'border-box';

    const label = document.createElement('label');
    label.textContent = 'Device Visibility:';
    row.appendChild(label);

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '16px';

    const devices = ['Desktop', 'Tablet', 'Mobile'];
    devices.forEach(device => {
      const devLower = device.toLowerCase();
      
      const devContainer = document.createElement('div');
      devContainer.style.display = 'flex';
      devContainer.style.flexDirection = 'column';
      devContainer.style.alignItems = 'center';
      devContainer.style.gap = '4px';

      const devLabel = document.createElement('span');
      devLabel.textContent = device;
      devLabel.style.fontSize = '0.75rem';
      devLabel.style.color = 'var(--text-muted)';
      devContainer.appendChild(devLabel);

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'switch';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      
      if (!instance.Responsive) instance.Responsive = {};
      if (!instance.Responsive[device]) instance.Responsive[device] = { Visible: true };
      
      checkbox.checked = instance.Responsive[device].Visible !== false;

      checkbox.addEventListener('change', () => {
        instance.Responsive[device].Visible = checkbox.checked;
      });

      const spanSlider = document.createElement('span');
      spanSlider.className = 'slider';

      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(spanSlider);
      devContainer.appendChild(toggleLabel);
      container.appendChild(devContainer);
    });

    row.appendChild(container);
    return row;
  }

  function createResponsiveStylesForm(instance) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-full';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '16px';

    const rules = ['Desktop', 'Tablet', 'Mobile'];
    rules.forEach(rule => {
      if (!instance.Responsive) instance.Responsive = {};
      if (!instance.Responsive[rule]) {
        instance.Responsive[rule] = { Visible: true, Margin: '', Padding: '', Align: '', Width: '' };
      }

      const blockTitle = document.createElement('div');
      blockTitle.style.fontSize = '0.8rem';
      blockTitle.style.fontWeight = '700';
      blockTitle.style.textTransform = 'uppercase';
      blockTitle.style.color = 'var(--primary)';
      blockTitle.style.marginTop = '8px';
      blockTitle.textContent = `${rule} Styling Overrides`;
      wrapper.appendChild(blockTitle);

      const grid = document.createElement('div');
      grid.style.display = 'flex';
      grid.style.flexWrap = 'wrap';
      grid.style.gap = '12px';

      const marginField = document.createElement('div');
      marginField.className = 'form-group field-half';
      marginField.innerHTML = `<label style="font-size:0.8rem">Margin</label>`;
      const marginInput = document.createElement('input');
      marginInput.type = 'text';
      marginInput.placeholder = 'e.g. 0px 0px 20px 0px';
      marginInput.value = instance.Responsive[rule].Margin || '';
      marginInput.addEventListener('input', (e) => {
        instance.Responsive[rule].Margin = e.target.value.trim();
      });
      marginField.appendChild(marginInput);
      grid.appendChild(marginField);

      const paddingField = document.createElement('div');
      paddingField.className = 'form-group field-half';
      paddingField.innerHTML = `<label style="font-size:0.8rem">Padding</label>`;
      const paddingInput = document.createElement('input');
      paddingInput.type = 'text';
      paddingInput.placeholder = 'e.g. 20px 10px';
      paddingInput.value = instance.Responsive[rule].Padding || '';
      paddingInput.addEventListener('input', (e) => {
        instance.Responsive[rule].Padding = e.target.value.trim();
      });
      paddingField.appendChild(paddingInput);
      grid.appendChild(paddingField);

      const alignField = document.createElement('div');
      alignField.className = 'form-group field-half';
      alignField.innerHTML = `<label style="font-size:0.8rem">Alignment</label>`;
      const alignSelect = document.createElement('select');
      const aligns = ['', 'left', 'center', 'right'];
      aligns.forEach(a => {
        const option = document.createElement('option');
        option.value = a;
        option.textContent = a === '' ? 'Inherit' : a;
        if (instance.Responsive[rule].Align === a) option.selected = true;
        alignSelect.appendChild(option);
      });
      alignSelect.addEventListener('change', (e) => {
        instance.Responsive[rule].Align = e.target.value;
      });
      alignField.appendChild(alignSelect);
      grid.appendChild(alignField);

      const widthField = document.createElement('div');
      widthField.className = 'form-group field-half';
      widthField.innerHTML = `<label style="font-size:0.8rem">Block Width</label>`;
      const widthSelect = document.createElement('select');
      const widths = [
        { value: '', label: '100% (Full Width)' },
        { value: '75%', label: '75% (3/4 Width)' },
        { value: '66.6%', label: '66.6% (2/3 Width)' },
        { value: '50%', label: '50% (Half Width)' },
        { value: '33.3%', label: '33.3% (1/3 Width)' },
        { value: '25%', label: '25% (1/4 Width)' },
        { value: 'auto', label: 'Auto (Fit Content)' }
      ];
      widths.forEach(w => {
        const option = document.createElement('option');
        option.value = w.value;
        option.textContent = w.label;
        if ((instance.Responsive[rule].Width || '') === w.value) option.selected = true;
        widthSelect.appendChild(option);
      });
      widthSelect.addEventListener('change', (e) => {
        instance.Responsive[rule].Width = e.target.value;
        renderCanvas();
      });
      widthField.appendChild(widthSelect);
      grid.appendChild(widthField);

      wrapper.appendChild(grid);
    });

    return wrapper;
  }

  async function saveActivePage(isDraft) {
    if (!state.activePage) return;

    state.activePage.IsDraft = isDraft;
    state.activePage.LayoutSchema = JSON.stringify(state.activeLayout);

    try {
      const response = await fetch('/cms/admin/pages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(state.activePage)
      });

      if (response.ok) {
        state.activePage = await response.json();
        alert(`Page layout successfully saved as ${isDraft ? 'DRAFT' : 'PUBLISHED'}!`);
      } else {
        alert('Failed to save page layout: ' + await response.text());
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to the server.');
    }
  }

  function applyCanvasLayoutStyles(page) {
    if (!page) return;
    let seo = {};
    try {
      seo = JSON.parse(page.SeoMetadata || '{}');
    } catch {}

    const layoutStyle = seo.pageLayout || 'full-width';
    const maxWidth = seo.maxWidth || '1200px';
    const bgColor = seo.backgroundColor || '';

    DOM.builderCanvas.style.maxWidth = '';
    DOM.builderCanvas.style.marginLeft = '';
    DOM.builderCanvas.style.marginRight = '';
    DOM.builderCanvas.style.display = '';
    DOM.builderCanvas.style.gridTemplateColumns = '';
    DOM.builderCanvas.style.gap = '';
    DOM.builderCanvas.style.backgroundColor = '';

    if (layoutStyle === 'contained') {
      DOM.builderCanvas.style.maxWidth = maxWidth;
      DOM.builderCanvas.style.marginLeft = 'auto';
      DOM.builderCanvas.style.marginRight = 'auto';
      DOM.builderCanvas.style.width = '100%';
    } else if (layoutStyle === 'grid') {
      DOM.builderCanvas.style.display = 'grid';
      DOM.builderCanvas.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
      DOM.builderCanvas.style.gap = '20px';
      DOM.builderCanvas.style.width = '100%';
      DOM.builderCanvas.style.maxWidth = maxWidth;
      DOM.builderCanvas.style.marginLeft = 'auto';
      DOM.builderCanvas.style.marginRight = 'auto';
    }

    if (bgColor) {
      DOM.builderCanvas.style.backgroundColor = bgColor;
    }
  }

  async function loadAndRegisterBlocksAssets() {
    try {
      const response = await fetch('/cms/admin/blocks/assets', { headers: getHeaders() });
      if (response.ok) {
        const assetsList = await response.json();
        assetsList.forEach(asset => {
          let tplEl = document.getElementById(`tpl-jf-${asset.Id}`);
          if (!tplEl) {
            const div = document.createElement('div');
            div.innerHTML = asset.Template.trim();
            const templateNode = div.firstChild;
            if (templateNode) {
              document.body.appendChild(templateNode);
            }
          }

          if (asset.Script) {
            if (!customElements.get(`jf-${asset.Id}`)) {
              try {
                const scriptEl = document.createElement('script');
                scriptEl.id = `script-jf-${asset.Id}`;
                scriptEl.textContent = asset.Script;
                document.body.appendChild(scriptEl);
              } catch (err) {
                console.error(`Failed to register custom element for block: ${asset.Id}`, err);
              }
            }
          }
        });
      }
    } catch (e) {
      console.error('JellyCMS: Failed to load block assets', e);
    }
  }

  function getFormattedWidth(widthVal) {
    if (!widthVal || widthVal === '100%' || widthVal === 'Auto') return widthVal || '100%';
    if (widthVal === '50%') return 'calc(50% - 8px)';
    if (widthVal === '33.3%') return 'calc(33.3% - 11px)';
    if (widthVal === '25%') return 'calc(25% - 12px)';
    if (widthVal === '75%') return 'calc(75% - 4px)';
    if (widthVal === '66.6%') return 'calc(66.6% - 6px)';
    return widthVal;
  }

  function applyCanvasBlockWidths() {
    if (!state.activePage) return;

    const activeBtn = DOM.deviceBtns ? Array.from(DOM.deviceBtns).find(b => b.classList.contains('active')) : null;
    const viewport = activeBtn ? activeBtn.getAttribute('data-viewport') : 'desktop';

    let ruleKey = 'Desktop';
    if (viewport === 'mobile') ruleKey = 'Mobile';
    else if (viewport === 'tablet') ruleKey = 'Tablet';

    state.activeLayout.forEach(instance => {
      const wrapper = DOM.builderCanvas.querySelector(`.canvas-block-wrapper[data-instance-id="${instance.Id}"]`);
      if (wrapper) {
        let width = '100%';
        if (instance.Responsive && instance.Responsive[ruleKey] && instance.Responsive[ruleKey].Width !== undefined) {
          width = instance.Responsive[ruleKey].Width || '100%';
        } else if (instance.Responsive && instance.Responsive.Desktop && instance.Responsive.Desktop.Width) {
          width = instance.Responsive.Desktop.Width;
        }
        wrapper.style.width = getFormattedWidth(width);
      }
    });
  }

  function getLayoutRows() {
    const activeBtn = DOM.deviceBtns ? Array.from(DOM.deviceBtns).find(b => b.classList.contains('active')) : null;
    const viewport = activeBtn ? activeBtn.getAttribute('data-viewport') : 'desktop';

    let ruleKey = 'Desktop';
    if (viewport === 'mobile') ruleKey = 'Mobile';
    else if (viewport === 'tablet') ruleKey = 'Tablet';

    const rows = [];
    let currentRow = [];
    let currentRowWidthSum = 0;

    state.activeLayout.forEach((instance, index) => {
      let widthPct = 100;
      let widthVal = '100%';
      if (instance.Responsive && instance.Responsive[ruleKey] && instance.Responsive[ruleKey].Width !== undefined) {
        widthVal = instance.Responsive[ruleKey].Width || '100%';
      } else if (instance.Responsive && instance.Responsive.Desktop && instance.Responsive.Desktop.Width) {
        widthVal = instance.Responsive.Desktop.Width;
      }

      if (widthVal === '50%') widthPct = 50;
      else if (widthVal === '33.3%') widthPct = 33.3;
      else if (widthVal === '25%') widthPct = 25;
      else if (widthVal === '75%') widthPct = 75;
      else if (widthVal === '66.6%') widthPct = 66.6;
      else if (widthVal === 'auto' || widthVal === 'Auto') widthPct = 50; // default fallback

      if (currentRowWidthSum + widthPct > 100.1 && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentRowWidthSum = 0;
      }

      currentRow.push({ index, widthPct, item: instance });
      currentRowWidthSum += widthPct;
    });

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  function moveInstanceDirection(index, direction) {
    const rows = getLayoutRows();
    
    let itemRowIndex = -1;
    let itemColIndex = -1;
    for (let r = 0; r < rows.length; r++) {
      const col = rows[r].findIndex(cell => cell.index === index);
      if (col !== -1) {
        itemRowIndex = r;
        itemColIndex = col;
        break;
      }
    }

    if (itemRowIndex === -1) return;

    const row = rows[itemRowIndex];
    const itemCell = row[itemColIndex];

    if (direction === 'left') {
      if (itemColIndex === 0) return;
      const prevCell = row[itemColIndex - 1];
      swapItemsInLayout(itemCell.index, prevCell.index);
    } 
    else if (direction === 'right') {
      if (itemColIndex === row.length - 1) return;
      const nextCell = row[itemColIndex + 1];
      swapItemsInLayout(itemCell.index, nextCell.index);
    } 
    else if (direction === 'up') {
      if (itemRowIndex === 0) return;
      const targetRow = rows[itemRowIndex - 1];
      const targetIndex = targetRow[0].index;
      moveItemBeforeIndex(itemCell.index, targetIndex);
    } 
    else if (direction === 'down') {
      if (itemRowIndex === rows.length - 1) return;
      const targetRow = rows[itemRowIndex + 1];
      const targetIndex = targetRow[targetRow.length - 1].index;
      moveItemAfterIndex(itemCell.index, targetIndex);
    }
  }

  function swapItemsInLayout(idx1, idx2) {
    const temp = state.activeLayout[idx1];
    state.activeLayout[idx1] = state.activeLayout[idx2];
    state.activeLayout[idx2] = temp;
    renderCanvas();
  }

  function moveItemBeforeIndex(srcIdx, destIdx) {
    const item = state.activeLayout.splice(srcIdx, 1)[0];
    let insertIdx = destIdx;
    if (srcIdx < destIdx) {
      insertIdx--;
    }
    state.activeLayout.splice(insertIdx, 0, item);
    renderCanvas();
  }

  function moveItemAfterIndex(srcIdx, destIdx) {
    const item = state.activeLayout.splice(srcIdx, 1)[0];
    let insertIdx = destIdx;
    if (srcIdx > destIdx) {
      insertIdx++;
    }
    state.activeLayout.splice(insertIdx, 0, item);
    renderCanvas();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('pageshow', (e) => {
    if (e.target.id === 'JellyCMS') {
      init(e.target);
    }
  });

  const existingPage = document.getElementById('JellyCMS');
  if (existingPage) {
    init(existingPage);
  }
})();
