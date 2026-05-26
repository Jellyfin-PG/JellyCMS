class JfWeatherDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-weather-dashboard');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  static get observedAttributes() {
    return ['data-title', 'data-city', 'data-unit'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.fetchData();
  }

  connectedCallback() {
    this.fetchData();
    this._interval = setInterval(() => this.fetchData(), 600000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  async fetchData() {
    const root = this.shadowRoot.querySelector('#weather-root');
    const titleEl = this.shadowRoot.querySelector('#weather-title');
    if (!root) return;

    const title = this.getAttribute('data-title') || 'Local Weather';
    if (titleEl) titleEl.textContent = title;

    const city = this.getAttribute('data-city') || 'London';
    const unit = this.getAttribute('data-unit') || 'C';

    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error('Geocoding service unavailable');
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        root.innerHTML = `<div class="error">City "${city}" not found.</div>`;
        return;
      }

      const location = geoData.results[0];
      const lat = location.latitude;
      const lon = location.longitude;
      const resolvedName = `${location.name}, ${location.country_code ? location.country_code.toUpperCase() : ''}`;

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) throw new Error('Weather forecast service unavailable');
      const weatherData = await weatherRes.json();

      const current = weatherData.current_weather;
      if (!current) throw new Error('No weather data returned');

      let temp = current.temperature;
      if (unit === 'F') {
        temp = (temp * 9) / 5 + 32;
      }

      const weatherCode = current.weathercode;
      const { icon, desc } = this.mapWeatherCode(weatherCode);

      root.innerHTML = `
        <div class="weather-card">
          <div class="temp-box">
            <span class="city-name">${resolvedName}</span>
            <span class="temp-value">${Math.round(temp)}°${unit}</span>
            <span class="weather-desc">${desc}</span>
          </div>
          <div class="icon-box">
            <span class="material-symbols-outlined weather-main-icon">${icon}</span>
          </div>
        </div>
      `;

    } catch (err) {
      console.error(err);
      this.renderMockups(root, city, unit);
    }
  }

  mapWeatherCode(code) {
    if (code === 0) return { icon: 'sunny', desc: 'Clear sky' };
    if ([1, 2, 3].includes(code)) return { icon: 'partly_cloudy_day', desc: 'Partly cloudy' };
    if ([45, 48].includes(code)) return { icon: 'foggy', desc: 'Foggy' };
    if ([51, 53, 55].includes(code)) return { icon: 'rainy', desc: 'Drizzle' };
    if ([61, 63, 65, 80, 81, 82].includes(code)) return { icon: 'rainy', desc: 'Rain' };
    if ([71, 73, 75, 85, 86].includes(code)) return { icon: 'ac_unit', desc: 'Snow' };
    if ([95, 96, 99].includes(code)) return { icon: 'thunderstorm', desc: 'Thunderstorm' };
    return { icon: 'partly_cloudy_day', desc: 'Partly cloudy' };
  }

  renderMockups(container, city, unit) {
    container.innerHTML = `
      <div class="weather-card">
        <div class="temp-box">
          <span class="city-name">${city}</span>
          <span class="temp-value">${unit === 'C' ? '18' : '64'}°${unit}</span>
          <span class="weather-desc">Partly cloudy</span>
        </div>
        <div class="icon-box">
          <span class="material-symbols-outlined weather-main-icon">partly_cloudy_day</span>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('jf-weather-dashboard')) {
  customElements.define('jf-weather-dashboard', JfWeatherDashboard);
}
