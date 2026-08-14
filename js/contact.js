
  (function () {

    var section =
      document.getElementById(
        'nehemiah-header-sections--21367313334350__nehemiah_header_FWDbLd'
      );

    if (!section) {
      return;
    }


    /* ======================================================
       MOBILE MENU
       ====================================================== */

    var toggle =
      section.querySelector(
        '[data-mobile-toggle]'
      );

    var panel =
      section.querySelector(
        '[data-mobile-panel]'
      );

    var shell =
      section.querySelector(
        '[data-header-shell]'
      );


    function openMenu() {

      if (!toggle || !panel) {
        return;
      }

      toggle.setAttribute(
        'aria-expanded',
        'true'
      );

      panel.hidden = false;

      requestAnimationFrame(
        function () {

          panel.classList.add(
            'is-open'
          );

        }
      );

    }


    function closeMenu() {

      if (!toggle || !panel) {
        return;
      }

      toggle.setAttribute(
        'aria-expanded',
        'false'
      );

      panel.classList.remove(
        'is-open'
      );

      panel.hidden = true;

    }


    function toggleMenu() {

      if (!toggle) {
        return;
      }

      var isOpen =
        toggle.getAttribute(
          'aria-expanded'
        ) === 'true';

      if (isOpen) {

        closeMenu();

      } else {

        openMenu();

      }

    }


    if (toggle && panel) {

      toggle.addEventListener(
        'click',
        toggleMenu
      );


      section
        .querySelectorAll(
          '[data-mobile-link]'
        )
        .forEach(
          function (link) {

            link.addEventListener(
              'click',
              closeMenu
            );

          }
        );


      document.addEventListener(
        'keydown',
        function (event) {

          if (
            event.key !== 'Escape'
          ) {
            return;
          }

          if (
            toggle.getAttribute(
              'aria-expanded'
            ) === 'true'
          ) {

            closeMenu();

            toggle.focus();

          }

        }
      );


      document.addEventListener(
        'click',
        function (event) {

          if (
            toggle.getAttribute(
              'aria-expanded'
            ) !== 'true'
          ) {
            return;
          }

          if (
            section.contains(
              event.target
            )
          ) {
            return;
          }

          closeMenu();

        }
      );


      window.addEventListener(
        'resize',
        function () {

          if (
            window.innerWidth > 989
          ) {

            closeMenu();

          }

        },
        {
          passive: true
        }
      );

    }


    /* ======================================================
       SCROLLED HEADER STATE
       ====================================================== */

    function updateHeaderScrollState() {

      if (!shell) {
        return;
      }

      if (
        window.scrollY > 10
      ) {

        shell.classList.add(
          'is-scrolled'
        );

      } else {

        shell.classList.remove(
          'is-scrolled'
        );

      }

    }


    updateHeaderScrollState();


    window.addEventListener(
      'scroll',
      updateHeaderScrollState,
      {
        passive: true
      }
    );

  })();


  (() => {
    const sectionId = "section1";
    const section = document.getElementById(sectionId);

    if (!section || section.dataset.dreamFeatureSliderReady === 'true') return;

    const slider = section.querySelector('[data-dream-feature-slider]');
    const slides = Array.from(section.querySelectorAll('[data-dream-feature-slide]'));
    const dots = Array.from(section.querySelectorAll('[data-dream-feature-dot]'));
    const mobileQuery = window.matchMedia('(max-width: 700px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!slider || slides.length <= 1) return;

    section.dataset.dreamFeatureSliderReady = 'true';

    let scrollTimer = null;

    const updateDots = (activeIndex) => {
      dots.forEach((dot, index) => {
        const isActive = index === activeIndex;

        dot.classList.toggle('is-active', isActive);

        if (isActive) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    };

    const getClosestSlideIndex = () => {
      const sliderRect = slider.getBoundingClientRect();
      let closestIndex = 0;
      let closestDistance = Infinity;

      slides.forEach((slide, index) => {
        const slideRect = slide.getBoundingClientRect();
        const distance = Math.abs(slideRect.left - sliderRect.left);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    };

    const updateActiveSlide = () => {
      if (!mobileQuery.matches) return;
      updateDots(getClosestSlideIndex());
    };

    const scrollToSlide = (index) => {
      if (!mobileQuery.matches) return;

      const slide = slides[index];
      if (!slide) return;

      const sliderRect = slider.getBoundingClientRect();
      const slideRect = slide.getBoundingClientRect();
      const targetLeft = slider.scrollLeft + (slideRect.left - sliderRect.left);

      slider.scrollTo({
        left: targetLeft,
        behavior: reducedMotion ? 'auto' : 'smooth'
      });

      updateDots(index);
    };

    slider.addEventListener(
      'scroll',
      () => {
        if (!mobileQuery.matches) return;

        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(updateActiveSlide, 60);
      },
      { passive: true }
    );

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        scrollToSlide(Number(dot.dataset.index));
      });
    });

    const handleBreakpointChange = () => {
      if (!mobileQuery.matches) {
        slider.scrollLeft = 0;
        updateDots(0);
        return;
      }

      updateActiveSlide();
    };

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleBreakpointChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(handleBreakpointChange);
    }

    updateDots(0);
  })();


  (function() {
    const section = document.getElementById("section2");
    if (!section || section.dataset.consultationInitialized === 'true') return;
    section.dataset.consultationInitialized = 'true';

    const form = section.querySelector('.consultation-form');
    const timeButtons = Array.from(section.querySelectorAll('.consultation-time'));
    const timeInput = section.querySelector('[data-selected-time]');
    const dateInput = section.querySelector('[data-consultation-date]');

    if (dateInput) {
      const today = new Date();
      const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
      dateInput.min = localDate;
    }

    timeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        timeButtons.forEach((item) => {
          item.classList.remove('is-selected');
          item.setAttribute('aria-checked', 'false');
        });

        button.classList.add('is-selected');
        button.setAttribute('aria-checked', 'true');

        if (timeInput) {
          timeInput.value = button.dataset.timeValue || button.textContent.trim();
        }
      });
    });

    if (form) {
      form.addEventListener('submit', (event) => {
        
          if (timeInput && !timeInput.value) {
            event.preventDefault();
            const firstTime = timeButtons[0];
            if (firstTime) {
              firstTime.focus();
              firstTime.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            alert('Please select a preferred consultation time.');
          }
        
      });
    }
  })();

;(()=>{const b=document.querySelector('.mockup-back-to-top');if(b){const u=()=>b.classList.toggle('is-visible',scrollY>300);b.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));addEventListener('scroll',u,{passive:true});u()}document.querySelectorAll('[data-placeholder-form]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();let m=f.querySelector('[data-standalone-status]');if(!m){m=document.createElement('p');m.dataset.standaloneStatus='true';m.style.cssText='color:#b9f234;font-size:12px;margin:12px 0 0';f.append(m)}m.textContent='Form delivery will be connected when the backend is ready.'}))})();
(() => {
  const section = document.getElementById('section1');
  const canvas = section?.querySelector('[data-dream-contact-particles]');
  if (!section || !canvas || canvas.dataset.particlesReady === 'true') return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  canvas.dataset.particlesReady = 'true';

  const palette = ['#95bf47', '#3b82f6', '#8b5cf6', '#ffffff'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speedScale = 1;
  const mouseScale = 1;
  const scrollScale = 1;
  let width = 0, height = 0, pixelRatio = 1, particles = [], animationFrame = 0, visible = true;
  let targetScroll = scrollY, smoothScroll = targetScroll;
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  const resetParticle = (particle, randomDepth = false) => {
    particle.x = (Math.random() - .5) * width * 1.5;
    particle.y = (Math.random() - .5) * height * 1.5;
    particle.z = randomDepth ? Math.random() * 1000 + 1 : 1000;
    particle.size = Math.random() * 1.6 + .7;
    particle.color = palette[Math.floor(Math.random() * palette.length)];
    return particle;
  };
  const resizeCanvas = () => {
    const rect = section.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width)); height = Math.max(1, Math.round(rect.height));
    pixelRatio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const count = reducedMotion ? 45 : Math.min(150, Math.max(85, Math.round(width / 9)));
    particles = Array.from({ length: count }, () => resetParticle({}, true));
    ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, width, height);
  };
  const updatePointer = event => {
    if (event.pointerType === 'touch') return;
    const rect = section.getBoundingClientRect();
    mouse.targetX = (event.clientX - rect.left - rect.width / 2) * mouseScale;
    mouse.targetY = (event.clientY - rect.top - rect.height / 2) * mouseScale;
  };
  const animateBackground = () => {
    if (!visible) { animationFrame = requestAnimationFrame(animateBackground); return; }
    smoothScroll += (targetScroll - smoothScroll) * .08;
    mouse.x += (mouse.targetX - mouse.x) * .045; mouse.y += (mouse.targetY - mouse.y) * .045;
    const scrollSpeed = Math.min(42, Math.abs(targetScroll - smoothScroll));
    ctx.fillStyle = 'rgba(5, 7, 11, 0.28)'; ctx.fillRect(0, 0, width, height);
    particles.forEach(particle => {
      const previousZ = particle.z;
      particle.z -= reducedMotion ? .35 : (1.8 * speedScale) + (scrollSpeed * .12 * scrollScale);
      if (particle.z <= 1) resetParticle(particle);
      const perspective = 290 / particle.z, previousPerspective = 290 / Math.max(previousZ, 1);
      const offsetX = mouse.x * .38, offsetY = mouse.y * .38;
      const x = (particle.x + offsetX) * perspective + width / 2;
      const y = (particle.y + offsetY) * perspective + height / 2;
      const previousX = (particle.x + offsetX) * previousPerspective + width / 2;
      const previousY = (particle.y + offsetY) * previousPerspective + height / 2;
      if (x < -40 || x > width + 40 || y < -40 || y > height + 40) { resetParticle(particle); return; }
      const alpha = Math.max(.18, Math.min(.9, 1 - particle.z / 1150));
      ctx.globalAlpha = alpha; ctx.strokeStyle = particle.color; ctx.fillStyle = particle.color;
      ctx.lineWidth = Math.max(.45, particle.size * perspective * .9);
      ctx.beginPath(); ctx.moveTo(previousX, previousY); ctx.lineTo(x, y); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, Math.max(.5, particle.size * perspective * 1.5), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; animationFrame = requestAnimationFrame(animateBackground);
  };
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resizeCanvas) : null;
  const visibilityObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; }, { rootMargin: '150px 0px' }) : null;
  resizeObserver?.observe(section); visibilityObserver?.observe(section);
  section.addEventListener('pointermove', updatePointer, { passive: true });
  section.addEventListener('pointerleave', () => { mouse.targetX = 0; mouse.targetY = 0; }, { passive: true });
  addEventListener('scroll', () => { targetScroll = scrollY; }, { passive: true });
  addEventListener('resize', resizeCanvas, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(animationFrame); else animationFrame = requestAnimationFrame(animateBackground); });
  resizeCanvas(); animationFrame = requestAnimationFrame(animateBackground);
})();
