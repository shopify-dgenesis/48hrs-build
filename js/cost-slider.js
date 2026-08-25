(() => {
  const header = document.querySelector('[data-nehemiah-header]');
  const toggle = header?.querySelector('[data-mobile-toggle]');
  const panel = header?.querySelector('[data-mobile-panel]');

  if (header && toggle && panel && header.dataset.mobileMenuReady !== 'true') {
    header.dataset.mobileMenuReady = 'true';

    const closeMenu = () => {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      panel.classList.remove('is-open');
      panel.hidden = true;
    };

    toggle.addEventListener('click', () => {
      const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(willOpen));
      toggle.setAttribute('aria-label', willOpen ? 'Close navigation menu' : 'Open navigation menu');
      panel.classList.toggle('is-open', willOpen);
      panel.hidden = !willOpen;
    });

    panel.querySelectorAll('[data-mobile-link]').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 989) closeMenu();
    }, { passive: true });
  }

  const mobile = matchMedia('(max-width: 700px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const selectors = ['.mini-costs', '.breakdown-grid', '.range-grid', '.saving-grid'];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((slider) => {
      const slides = [...slider.children];
      if (slides.length < 2) return;

      const pagination = document.createElement('div');
      pagination.className = 'cost-slider-pagination';
      pagination.setAttribute('aria-label', 'Slider navigation');

      const dots = slides.map((slide, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Show slide ${index + 1}`);
        if (index === 0) {
          dot.classList.add('is-active');
          dot.setAttribute('aria-current', 'true');
        }
        dot.addEventListener('click', () => {
          if (!mobile.matches) return;
          slider.scrollTo({
            left: slide.offsetLeft - slides[0].offsetLeft,
            behavior: reducedMotion.matches ? 'auto' : 'smooth'
          });
        });
        pagination.append(dot);
        return dot;
      });

      slider.insertAdjacentElement('afterend', pagination);
      let frame;
      slider.addEventListener('scroll', () => {
        if (!mobile.matches) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const left = slider.getBoundingClientRect().left;
          const active = slides.reduce((closest, slide, index) => {
            const distance = Math.abs(slide.getBoundingClientRect().left - left);
            return distance < closest.distance ? { index, distance } : closest;
          }, { index: 0, distance: Infinity }).index;

          dots.forEach((dot, index) => {
            dot.classList.toggle('is-active', index === active);
            if (index === active) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
          });
        });
      }, { passive: true });
    });
  });
})();
