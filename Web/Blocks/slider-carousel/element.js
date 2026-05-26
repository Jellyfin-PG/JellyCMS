class JfSliderCarousel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-slider-carousel');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
    this.currentSlide = 0;
    this.autoplayInterval = null;
  }

  static get observedAttributes() {
    return [
      'data-height',
      'data-transition_speed',
      'data-slide1_image',
      'data-slide1_title',
      'data-slide1_desc',
      'data-slide1_link',
      'data-slide2_image',
      'data-slide2_title',
      'data-slide2_desc',
      'data-slide2_link'
    ];
  }

  attributeChangedCallback() {
    this.update();
  }

  connectedCallback() {
    this.update();
    this.setupListeners();
    this.startAutoplay();
  }

  disconnectedCallback() {
    this.stopAutoplay();
  }

  setupListeners() {
    const prev = this.shadowRoot.getElementById('prev-btn');
    const next = this.shadowRoot.getElementById('next-btn');

    if (prev) prev.addEventListener('click', () => this.changeSlide(-1));
    if (next) next.addEventListener('click', () => this.changeSlide(1));
  }

  update() {
    const carousel = this.shadowRoot.getElementById('carousel');
    const wrapper = this.shadowRoot.getElementById('slides-wrapper');
    const indicators = this.shadowRoot.getElementById('indicators');

    if (!carousel || !wrapper || !indicators) return;

    const height = this.getAttribute('data-height') || '400px';
    carousel.style.height = height;

    const slides = [];
    for (let i = 1; i <= 2; i++) {
      const img = this.getAttribute(`data-slide${i}_image`);
      const title = this.getAttribute(`data-slide${i}_title`);
      const desc = this.getAttribute(`data-slide${i}_desc`);
      const link = this.getAttribute(`data-slide${i}_link`);

      if (img || title) {
        slides.push({ img, title, desc, link });
      }
    }

    if (slides.length === 0) {
      wrapper.innerHTML = '<div style="padding: 40px; text-align: center; color: white;">Carousel Empty. Define slides in block settings.</div>';
      return;
    }

    wrapper.innerHTML = '';
    indicators.innerHTML = '';

    slides.forEach((slide, idx) => {
      const slideEl = document.createElement('div');
      slideEl.className = `carousel-slide ${idx === this.currentSlide ? 'active' : ''}`;
      slideEl.style.backgroundImage = `url('${slide.img || ''}')`;

      slideEl.innerHTML = `
        <div class="carousel-overlay">
          <div class="slide-content">
            <h3 class="slide-title">${slide.title || ''}</h3>
            <p class="slide-desc">${slide.desc || ''}</p>
            ${slide.link ? `<a class="slide-btn" href="${slide.link}">Learn More <span class="material-symbols-outlined" style="font-size: 18px;">arrow_forward</span></a>` : ''}
          </div>
        </div>
      `;

      wrapper.appendChild(slideEl);

      const ind = document.createElement('div');
      ind.className = `indicator ${idx === this.currentSlide ? 'active' : ''}`;
      ind.addEventListener('click', () => this.goToSlide(idx));
      indicators.appendChild(ind);
    });

    this.slidesCount = slides.length;
    this.scrollSlide();
  }

  changeSlide(direction) {
    this.stopAutoplay();
    this.currentSlide = (this.currentSlide + direction + this.slidesCount) % this.slidesCount;
    this.scrollSlide();
    this.startAutoplay();
  }

  goToSlide(index) {
    this.stopAutoplay();
    this.currentSlide = index;
    this.scrollSlide();
    this.startAutoplay();
  }

  scrollSlide() {
    const wrapper = this.shadowRoot.getElementById('slides-wrapper');
    if (!wrapper) return;
    
    wrapper.style.transform = `translateX(-${this.currentSlide * 100}%)`;

    const slides = this.shadowRoot.querySelectorAll('.carousel-slide');
    slides.forEach((slide, idx) => {
      if (idx === this.currentSlide) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    const indicators = this.shadowRoot.querySelectorAll('.indicator');
    indicators.forEach((ind, idx) => {
      if (idx === this.currentSlide) {
        ind.classList.add('active');
      } else {
        ind.classList.remove('active');
      }
    });
  }

  startAutoplay() {
    this.stopAutoplay();
    const speed = parseInt(this.getAttribute('data-transition_speed') || '5000', 10);
    this.autoplayInterval = setInterval(() => {
      if (this.slidesCount > 1) {
        this.currentSlide = (this.currentSlide + 1) % this.slidesCount;
        this.scrollSlide();
      }
    }, speed);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }
}

if (!customElements.get('jf-slider-carousel')) {
  customElements.define('jf-slider-carousel', JfSliderCarousel);
}
