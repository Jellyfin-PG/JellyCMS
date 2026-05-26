class JfMusicPlayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-music-player');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
    this._tracks = [];
    this._currentIdx = 0;
    this._playing = false;
    this._audio = new Audio();
    this._audio.crossOrigin = 'anonymous';

    this._simCurrentTime = 0;
    this._simDuration = 180;
  }

  static get observedAttributes() {
    return ['data-title'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    const titleEl = this.shadowRoot.querySelector('#player-title');
    if (titleEl) titleEl.textContent = newValue || 'Music Player';
  }

  connectedCallback() {
    const titleEl = this.shadowRoot.querySelector('#player-title');
    if (titleEl) titleEl.textContent = this.getAttribute('data-title') || 'Music Player';

    this.initPlayer();

    const playPauseBtn = this.shadowRoot.querySelector('#play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => this.togglePlay());
    }

    const prevBtn = this.shadowRoot.querySelector('#prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevTrack());
    }

    const nextBtn = this.shadowRoot.querySelector('#next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextTrack());
    }

    const progressBar = this.shadowRoot.querySelector('#progress-bar-track');
    if (progressBar) {
      progressBar.addEventListener('click', (e) => this.seek(e));
    }

    this._audio.addEventListener('timeupdate', () => this.updateProgress());
    this._audio.addEventListener('ended', () => this.nextTrack());
  }

  disconnectedCallback() {
    this._audio.pause();
    if (this._simInterval) clearInterval(this._simInterval);
  }

  async initPlayer() {
    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
      this._tracks = this.getMockTracks();
      this.loadTrack(0);
      return;
    }

    try {
      const res = await window.JellyBuilder.Api.getItems({
        Recursive: true,
        IncludeItemTypes: 'Audio',
        Limit: 15
      });
      const items = res.Items || [];

      if (items.length === 0) {
        this._tracks = this.getMockTracks();
      } else {
        this._tracks = items.map(item => ({
          Id: item.Id,
          Name: item.Name,
          Artist: item.Artists ? item.Artists.join(', ') : 'Unknown Artist',
          Duration: Math.round((item.RunTimeTicks || 0) / 10000000) || 180
        }));
      }

      this.loadTrack(0);

    } catch (err) {
      console.error(err);
      this._tracks = this.getMockTracks();
      this.loadTrack(0);
    }
  }

  getMockTracks() {
    return [
      { Name: 'Night Drive', Artist: 'Lofi Horizons', Duration: 165 },
      { Name: 'Cyberpunk Ambient', Artist: 'Neon Pulse', Duration: 210 },
      { Name: 'Retro Waves', Artist: 'Synth Collector', Duration: 142 }
    ];
  }

  loadTrack(idx) {
    if (!this._tracks || this._tracks.length === 0) return;
    this._currentIdx = idx;
    const track = this._tracks[idx];

    const nameTxt = this.shadowRoot.querySelector('#track-name-txt');
    const artistTxt = this.shadowRoot.querySelector('#artist-name-txt');
    const disc = this.shadowRoot.querySelector('#disc-art-img');
    const totalTimeEl = this.shadowRoot.querySelector('#total-time');

    if (nameTxt) nameTxt.textContent = track.Name;
    if (artistTxt) artistTxt.textContent = track.Artist;
    if (totalTimeEl) totalTimeEl.textContent = this.formatTime(track.Duration);

    if (disc) {
      if (track.Id && window.JellyBuilder && window.JellyBuilder.ServerUrl) {
        const serverUrl = window.JellyBuilder.ServerUrl;
        disc.style.backgroundImage = `url('${serverUrl}/Items/${track.Id}/Images/Primary?maxWidth=200')`;
      } else {
        disc.style.backgroundImage = '';
      }
    }

    if (track.Id && window.JellyBuilder && window.JellyBuilder.ServerUrl) {
      const serverUrl = window.JellyBuilder.ServerUrl;
      const apiToken = window.JellyBuilder.ApiToken;
      this._audio.src = `${serverUrl}/Audio/${track.Id}/stream?api_key=${apiToken}`;
      this._audio.load();
    } else {
      this._audio.src = '';
      this._simCurrentTime = 0;
      this.updateSimulatedProgress();
    }

    if (this._playing) {
      this.playActive();
    }
  }

  togglePlay() {
    if (this._playing) {
      this.pauseActive();
    } else {
      this.playActive();
    }
  }

  playActive() {
    this._playing = true;
    const disc = this.shadowRoot.querySelector('#disc-art-img');
    const playIcon = this.shadowRoot.querySelector('#play-icon');
    if (disc) disc.classList.add('playing');
    if (playIcon) playIcon.textContent = 'pause';

    const track = this._tracks[this._currentIdx];
    if (track && track.Id && this._audio.src) {
      this._audio.play().catch(e => console.warn('Autoplay prevented', e));
    } else {
      if (this._simInterval) clearInterval(this._simInterval);
      this._simInterval = setInterval(() => {
        this._simCurrentTime = (this._simCurrentTime + 1) % (track ? track.Duration : 180);
        this.updateSimulatedProgress();
      }, 1000);
    }
  }

  pauseActive() {
    this._playing = false;
    const disc = this.shadowRoot.querySelector('#disc-art-img');
    const playIcon = this.shadowRoot.querySelector('#play-icon');
    if (disc) disc.classList.remove('playing');
    if (playIcon) playIcon.textContent = 'play_arrow';

    this._audio.pause();
    if (this._simInterval) clearInterval(this._simInterval);
  }

  prevTrack() {
    let prev = this._currentIdx - 1;
    if (prev < 0) prev = this._tracks.length - 1;
    this.loadTrack(prev);
  }

  nextTrack() {
    let next = this._currentIdx + 1;
    if (next >= this._tracks.length) next = 0;
    this.loadTrack(next);
  }

  seek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const track = this._tracks[this._currentIdx];
    if (!track) return;

    const duration = track.Id ? this._audio.duration || track.Duration : track.Duration;
    const newTime = pos * duration;

    if (track.Id) {
      this._audio.currentTime = newTime;
    } else {
      this._simCurrentTime = Math.round(newTime);
      this.updateSimulatedProgress();
    }
  }

  updateProgress() {
    const curTimeEl = this.shadowRoot.querySelector('#current-time');
    const fill = this.shadowRoot.querySelector('#progress-bar-fill');
    if (!curTimeEl || !fill) return;

    const cur = this._audio.currentTime || 0;
    const dur = this._audio.duration || 1;
    const pct = (cur / dur) * 100;

    curTimeEl.textContent = this.formatTime(Math.round(cur));
    fill.style.width = `${pct}%`;
  }

  updateSimulatedProgress() {
    const curTimeEl = this.shadowRoot.querySelector('#current-time');
    const fill = this.shadowRoot.querySelector('#progress-bar-fill');
    if (!curTimeEl || !fill) return;

    const track = this._tracks[this._currentIdx];
    const dur = track ? track.Duration : 180;
    const pct = (this._simCurrentTime / dur) * 100;

    curTimeEl.textContent = this.formatTime(this._simCurrentTime);
    fill.style.width = `${pct}%`;
  }

  formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}

if (!customElements.get('jf-music-player')) {
  customElements.define('jf-music-player', JfMusicPlayer);
}
