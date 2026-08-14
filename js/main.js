
    document.addEventListener('DOMContentLoaded', () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const processSurface = document.querySelector('#MainContent [data-process-section]');
      if (!processSurface) return;
      const launchSurface = document.querySelector('#MainContent .launch48') || processSurface;
      const launchWrapper = launchSurface.closest('.shopify-section');

      const canvas = document.createElement('canvas');
      canvas.className = 'mockup-flow-field';
      canvas.setAttribute('aria-hidden', 'true');
      launchSurface.prepend(canvas);

      const staticBackground = document.createElement('div');
      staticBackground.className = 'mockup-static-wave-background';
      staticBackground.setAttribute('aria-hidden', 'true');
      document.body.prepend(staticBackground);

      const remainingBackgroundColor = processSurface.dataset.sharedBackgroundColor || '#061318';
      const remainingBackground = `
        radial-gradient(circle at 18% 22%, rgba(185, 242, 52, .14) 0%, rgba(154, 200, 62, .065) 18%, transparent 42%),
        radial-gradient(circle at 82% 72%, rgba(36, 139, 128, .13) 0%, transparent 38%),
        ${remainingBackgroundColor}
      `;
      staticBackground.style.setProperty('background-color', remainingBackgroundColor, 'important');

      const context = canvas.getContext('2d', { alpha: true });
      if (!context) return;

      const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
      const bands = [
        { y: 0.16, amplitude: 58, speed: 0.12, phase: 0.2 },
        { y: 0.51, amplitude: 82, speed: -0.085, phase: 2.4 },
        { y: 0.84, amplitude: 68, speed: 0.1, phase: 4.8 }
      ];
      const particles = Array.from({ length: 36 }, (_, index) => ({
        x: ((index * 47) % 101) / 100,
        y: ((index * 71) % 97) / 96,
        size: 0.45 + (index % 4) * 0.32,
        phase: index * 0.73
      }));

      let width = 0;
      let height = 0;
      let frame = 0;
      let gradient = null;
      let lastDraw = -34;
      let scrolling = false;
      let scrollTimer = 0;

      const resize = () => {
        width = launchSurface.clientWidth;
        const launchBottom = Math.ceil(launchSurface.getBoundingClientRect().bottom + window.scrollY);
        height = launchSurface.offsetHeight;
        /* Render above CSS resolution so the fine gradient lines stay crisp on
           Retina/mobile displays, while capping the scale for smooth animation. */
        const pixelRatio = Math.min(window.devicePixelRatio || 1, width < 750 ? 1.5 : 2);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const processSection = processSurface.closest('.shopify-section');
        const footerGroup = document.querySelector('.shopify-section-group-footer-group');
        const customFooter = Array.from(document.querySelectorAll('#MainContent .custom-footer-menus')).pop();
        const backgroundTop = processSection
          ? processSection.getBoundingClientRect().top + window.scrollY
          : launchBottom;
        const footerBottom = footerGroup
          ? footerGroup.getBoundingClientRect().bottom + window.scrollY
          : 0;
        const customFooterBottom = customFooter
          ? customFooter.getBoundingClientRect().bottom + window.scrollY
          : 0;
        const backgroundBottom = footerBottom || customFooterBottom
          ? Math.max(footerBottom, customFooterBottom)
          : document.documentElement.scrollHeight;
        staticBackground.style.top = `${backgroundTop}px`;
        staticBackground.style.height = `${Math.max(0, backgroundBottom - backgroundTop)}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        gradient = context.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(55, 151, 126, 0.42)');
        gradient.addColorStop(0.38, 'rgba(168, 231, 45, 0.68)');
        gradient.addColorStop(0.72, 'rgba(185, 242, 52, 0.82)');
        gradient.addColorStop(1, 'rgba(36, 139, 128, 0.34)');
      };

      const draw = (time = 0) => {
        if (scrolling || (!reducedMotion && time - lastDraw < 16.67)) {
          frame = requestAnimationFrame(draw);
          return;
        }
        lastDraw = time;
        const seconds = time * 0.001;
        const mobile = width < 750;
        const heightScale = mobile ? 0.68 : 1;
        const spacing = mobile ? 4.2 : 6.4;
        const pointerStrength = mobile ? -44 : -78;

        pointer.x += (pointer.targetX - pointer.x) * 0.035;
        pointer.y += (pointer.targetY - pointer.y) * 0.035;
        context.clearRect(0, 0, width, height);

        bands.forEach((band, bandIndex) => {
          const centerY = height * band.y;
          const phase = band.phase + seconds * band.speed;
          for (let filament = 0; filament < 11; filament += 1) {
            const spread = (filament - 5) * spacing;
            const alpha = 0.045 + (1 - Math.abs(spread) / 70) * 0.08;
            const points = [];

            for (let x = -22; x <= width + 22; x += 22) {
              const nx = x / Math.max(width, 1);
              const primary = Math.sin(nx * 9.2 + phase + filament * 0.035) * band.amplitude * heightScale;
              const detail = Math.sin(nx * 22 - phase * 1.7 + bandIndex) * band.amplitude * 0.17 * heightScale;
              const distance = nx - pointer.x;
              const lift = Math.exp(-(distance * distance) / 0.025) * (pointer.y - band.y) * pointerStrength;
              points.push({ x, y: centerY + primary + detail + spread + lift });
            }

            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            for (let index = 1; index < points.length - 1; index += 1) {
              const point = points[index];
              const next = points[index + 1];
              context.quadraticCurveTo(point.x, point.y, (point.x + next.x) * 0.5, (point.y + next.y) * 0.5);
            }
            const last = points[points.length - 1];
            context.lineTo(last.x, last.y);
            context.globalAlpha = Math.min(0.85, alpha * 5.6);
            context.strokeStyle = gradient;
            context.lineWidth = filament % 6 === 0 ? 1.05 : 0.55;
            context.stroke();
          }
        });

        context.globalAlpha = 1;
        particles.forEach((particle) => {
          const pulse = 0.38 + Math.sin(seconds * 0.8 + particle.phase) * 0.24;
          context.beginPath();
          context.arc(particle.x * width, particle.y * height, particle.size, 0, Math.PI * 2);
          context.fillStyle = `rgba(185, 242, 52, ${Math.max(0.08, pulse)})`;
          context.fill();
        });

        if (!reducedMotion) frame = requestAnimationFrame(draw);
      };

      const updatePointer = (x, y) => {
        const launchRect = launchSurface.getBoundingClientRect();
        pointer.targetX = (x - launchRect.left) / Math.max(launchRect.width, 1);
        pointer.targetY = (y - launchRect.top) / Math.max(launchRect.height, 1);
      };

      resize();
      draw();
      window.addEventListener('resize', resize, { passive: true });
      window.addEventListener('load', resize, { once: true });
      if ('ResizeObserver' in window) {
        let resizeFrame = 0;
        const layoutObserver = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(resize);
        });
        layoutObserver.observe(launchSurface);
        layoutObserver.observe(document.querySelector('#MainContent'));
      }
      window.addEventListener('scroll', () => {
        scrolling = true;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => { scrolling = false; }, 90);
      }, { passive: true });
      window.addEventListener('pointermove', event => updatePointer(event.clientX, event.clientY), { passive: true });
      window.addEventListener('touchmove', event => {
        const touch = event.touches && event.touches[0];
        if (touch) updatePointer(touch.clientX, touch.clientY);
      }, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (reducedMotion) return;
        if (document.hidden && frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        } else if (!document.hidden && !frame) {
          frame = requestAnimationFrame(draw);
        }
      });

      const revealSections = Array.from(
        document.querySelectorAll('#MainContent > .shopify-section')
      );

      let afterLaunch = false;
      revealSections.forEach(section => {
        if (section === launchWrapper) {
          afterLaunch = true;
          return;
        }
        if (!afterLaunch) return;

        /* Keep one shared page gradient. Per-section fixed gradients restart
           at every mobile boundary and create visible horizontal bands. */
        section.style.setProperty('background', 'transparent', 'important');
        section.style.setProperty('background-color', 'transparent', 'important');
        section.style.setProperty('background-image', 'none', 'important');
        section.style.removeProperty('background-size');
        section.style.removeProperty('background-position');
        section.style.removeProperty('background-repeat');
        section.style.removeProperty('background-attachment');

        Array.from(section.children).forEach(child => {
          if (!child.matches('section, [id], .gradient, [class*="color-"]')) return;
          child.style.setProperty('background', 'transparent', 'important');
          child.style.setProperty('background-color', 'transparent', 'important');
          child.style.setProperty('background-image', 'none', 'important');
        });
      });

      revealSections.forEach((section, index) => {
        section.dataset.mockupReveal = index === 0 ? 'up' : (index % 2 ? 'left' : 'right');
        section.style.setProperty('--mockup-reveal-delay', `${Math.min(index, 3) * 45}ms`);
      });

      document.documentElement.classList.add('mockup-motion-ready');

      if (reducedMotion || !('IntersectionObserver' in window)) {
        revealSections.forEach(section => section.classList.add('is-mockup-visible'));
      } else {
        const revealObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-mockup-visible');
            observer.unobserve(entry.target);
          });
        }, {
          threshold: 0.12,
          rootMargin: '0px 0px -8% 0px'
        });

        revealSections.forEach(section => revealObserver.observe(section));
      }
    }, { once: true });
  

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
    const section = document.querySelector('.launch48--template--21367318315086__shopify_48_hour_launch_KRiqaR');

    if (!section || section.dataset.trustSliderReady === 'true') return;

    const slider = section.querySelector('.launch48__trust-bar');
    const slides = Array.from(section.querySelectorAll('.launch48__trust-item'));
    const dots = Array.from(section.querySelectorAll('.launch48__trust-dot'));

    if (!slider || !slides.length || !dots.length) return;

    section.dataset.trustSliderReady = 'true';

    const setActiveDot = (index) => {
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;

        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    };

    const getActiveIndex = () => {
      if (!slider.clientWidth) return 0;

      return Math.max(
        0,
        Math.min(
          slides.length - 1,
          Math.round(slider.scrollLeft / slider.clientWidth)
        )
      );
    };

    let scrollFrame = null;

    slider.addEventListener(
      'scroll',
      () => {
        if (scrollFrame) cancelAnimationFrame(scrollFrame);

        scrollFrame = requestAnimationFrame(() => {
          setActiveDot(getActiveIndex());
        });
      },
      { passive: true }
    );

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const index = Number(dot.dataset.trustSlide);
        const slide = slides[index];

        if (!slide) return;

        slider.scrollTo({
          left: slide.offsetLeft,
          behavior: 'smooth'
        });

        setActiveDot(index);
      });
    });

    window.addEventListener('resize', () => {
      if (window.matchMedia('(max-width: 749px)').matches) {
        const index = getActiveIndex();

        slider.scrollTo({
          left: slides[index].offsetLeft,
          behavior: 'auto'
        });

        setActiveDot(index);
      }
    });

    setActiveDot(getActiveIndex());
  })();


(function () {

  var sectionId = "template--21367318315086__process_scroll_MRgxzC";


  function initProcessSection() {

    var section = document.querySelector(
      '[data-process-section="' + sectionId + '"]'
    );


    if (!section) {
      return;
    }


    /*
     * Prevent duplicate initialization when Shopify
     * reloads the section in Theme Editor.
     */

    if (section.dataset.processInitialized === 'true') {
      return;
    }


    section.dataset.processInitialized = 'true';


    var list =
      section.querySelector(
        '[data-process-list]'
      );


    var timeline =
      section.querySelector(
        '[data-process-timeline]'
      );


    var progressLine =
      section.querySelector(
        '[data-process-progress]'
      );


    var steps =
      Array.prototype.slice.call(
        section.querySelectorAll(
          '[data-process-step]'
        )
      );


    var screens =
      Array.prototype.slice.call(
        section.querySelectorAll(
          '[data-process-screen]'
        )
      );


    if (
      !list ||
      !timeline ||
      !progressLine ||
      !steps.length
    ) {

      return;

    }


    var markerPositions = [];

    var railStart = 0;

    var railEnd = 1;

    var currentIndex = 0;

    var ticking = false;


    /*
     * ========================================================
     * CHANGE ACTIVE IMAGE
     * ========================================================
     */

    function setActiveScreen(index) {

      if (!screens.length) {
        return;
      }


      if (index < 0) {
        index = 0;
      }


      if (index > screens.length - 1) {

        index =
          screens.length - 1;

      }


      if (currentIndex === index) {
        return;
      }


      currentIndex = index;


      screens.forEach(
        function (screen, screenIndex) {

          screen.classList.toggle(
            'is-active',
            screenIndex === index
          );

        }
      );

    }


    /*
     * ========================================================
     * MEASURE TIMELINE
     * ========================================================
     */

    function measureTimeline() {

      var listRect =
        list.getBoundingClientRect();


      markerPositions =
        steps.map(
          function (step) {

            var marker =
              step.querySelector(
                '.step-num'
              );


            if (!marker) {
              return 0;
            }


            var markerRect =
              marker.getBoundingClientRect();


            return (
              markerRect.top -
              listRect.top +
              markerRect.height / 2
            );

          }
        );


      railStart =
        markerPositions[0] ||
        0;


      railEnd =
        markerPositions[
          markerPositions.length - 1
        ] ||
        Math.max(
          list.offsetHeight,
          1
        );


      var railHeight =
        Math.max(
          1,
          railEnd - railStart
        );


      timeline.style.top =
        railStart + 'px';


      timeline.style.height =
        railHeight + 'px';

    }


    /*
     * ========================================================
     * SCROLL UPDATE
     * ========================================================
     */

    function updateProcess() {

      ticking = false;


      if (!markerPositions.length) {

        measureTimeline();

      }


      var listRect =
        list.getBoundingClientRect();


      /*
       * Playhead sits around the middle
       * of the viewport.
       */

      var viewportAnchor =
        window.innerHeight * 0.52;


      var playhead =
        viewportAnchor -
        listRect.top;


      var railDistance =
        Math.max(
          1,
          railEnd - railStart
        );


      var progress =
        (
          playhead -
          railStart
        ) /
        railDistance;


      progress =
        Math.max(
          0,
          Math.min(
            1,
            progress
          )
        );


      progressLine.style.transform =
        'translateX(-50%) scaleY(' +
        progress +
        ')';


      /*
       * Find marker nearest
       * to the playhead.
       */

      var nearestIndex = 0;

      var nearestDistance =
        Infinity;


      markerPositions.forEach(
        function (
          markerPosition,
          index
        ) {

          var distance =
            Math.abs(
              playhead -
              markerPosition
            );


          if (
            distance <
            nearestDistance
          ) {

            nearestDistance =
              distance;

            nearestIndex =
              index;

          }

        }
      );


      /*
       * Before timeline begins,
       * keep step 1 active.
       */

      if (
        playhead <=
        railStart
      ) {

        nearestIndex = 0;

      }


      /*
       * After timeline finishes,
       * keep last step active.
       */

      if (
        playhead >=
        railEnd
      ) {

        nearestIndex =
          steps.length - 1;

      }


      /*
       * Update step states.
       */

      steps.forEach(
        function (
          step,
          index
        ) {

          step.classList.toggle(
            'is-active',
            index === nearestIndex
          );


          step.classList.toggle(
            'is-passed',
            index < nearestIndex
          );

        }
      );


      setActiveScreen(
        nearestIndex
      );

    }


    /*
     * ========================================================
     * REQUEST ANIMATION FRAME
     * ========================================================
     */

    function requestUpdate() {

      if (ticking) {
        return;
      }


      ticking = true;


      window.requestAnimationFrame(
        updateProcess
      );

    }


    /*
     * ========================================================
     * REFRESH
     * ========================================================
     */

    function refreshProcess() {

      markerPositions = [];


      measureTimeline();


      requestUpdate();

    }


    /*
     * ========================================================
     * EVENTS
     * ========================================================
     */

    window.addEventListener(
      'scroll',
      requestUpdate,
      {
        passive: true
      }
    );


    window.addEventListener(
      'resize',
      refreshProcess,
      {
        passive: true
      }
    );


    /*
     * Recalculate after images load.
     */

    section
      .querySelectorAll('img')
      .forEach(
        function (image) {

          if (!image.complete) {

            image.addEventListener(
              'load',
              refreshProcess,
              {
                once: true
              }
            );

          }

        }
      );


    /*
     * Initial state.
     */

    currentIndex = -1;


    measureTimeline();


    updateProcess();

  }


  /*
   * Standard storefront initialization.
   */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initProcessSection,
      {
        once: true
      }
    );

  } else {

    initProcessSection();

  }


  /*
   * Shopify Theme Editor
   * section reload.
   */

  document.addEventListener(
    'shopify:section:load',
    function (event) {

      if (
        event.detail &&
        String(
          event.detail.sectionId
        ) ===
        String(sectionId)
      ) {

        initProcessSection();

      }

    }
  );

})();


(() => {

  const section =
    document.getElementById(
      "whatsincluded"
    );


  if (!section) return;


  /*
   * Prevent duplicate initialization
   * in Shopify Theme Editor.
   */
  if (
    section.dataset.includedInitialized ===
    'true'
  ) {
    return;
  }


  section.dataset.includedInitialized =
    'true';


  const animationEnabled =
    section.dataset.enableAnimation ===
    'true';


  const tiltEnabled =
    section.dataset.enableTilt ===
    'true';


  const reducedMotion =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;


  const coarsePointer =
    window.matchMedia(
      '(pointer: coarse)'
    ).matches;


  const mobileQuery =
    window.matchMedia(
      '(max-width: 640px)'
    );


  /* =====================================================
     SCROLL REVEAL
     ===================================================== */

  if (
    animationEnabled &&
    !reducedMotion &&
    'IntersectionObserver' in window
  ) {

    section.classList.add(
      'included-features--animation-ready'
    );


    const heading =
      section.querySelector(
        '[data-included-reveal]'
      );


    const cards =
      Array.from(
        section.querySelectorAll(
          '[data-included-card]'
        )
      );


    const headingObserver =
      new IntersectionObserver(
        (entries, observer) => {

          entries.forEach(
            (entry) => {

              if (!entry.isIntersecting) {
                return;
              }


              entry.target.classList.add(
                'is-visible'
              );


              observer.unobserve(
                entry.target
              );

            }
          );

        },
        {
          threshold:
            0.15,

          rootMargin:
            '0px 0px -5% 0px'
        }
      );


    if (heading) {

      headingObserver.observe(
        heading
      );

    }


    const cardObserver =
      new IntersectionObserver(
        (entries, observer) => {

          entries.forEach(
            (entry) => {

              if (!entry.isIntersecting) {
                return;
              }


              const card =
                entry.target;


              const index =
                cards.indexOf(card);


              window.setTimeout(
                () => {

                  card.classList.add(
                    'is-visible'
                  );

                },
                index * 60
              );


              observer.unobserve(
                card
              );

            }
          );

        },
        {
          threshold:
            0.08,

          rootMargin:
            '0px 0px -3% 0px'
        }
      );


    cards.forEach(
      (card) => {

        cardObserver.observe(
          card
        );

      }
    );

  } else {

    section
      .querySelectorAll(
        '[data-included-reveal], [data-included-card]'
      )
      .forEach(
        (element) => {

          element.classList.add(
            'is-visible'
          );

        }
      );

  }


  /* =====================================================
     DESKTOP TILT EFFECT
     ===================================================== */

  if (
    tiltEnabled &&
    !reducedMotion &&
    !coarsePointer
  ) {

    const cards =
      section.querySelectorAll(
        '[data-included-card]'
      );


    cards.forEach(
      (card) => {

        card.addEventListener(
          'mousemove',
          (event) => {

            /*
             * Never apply tilt while the mobile slider
             * breakpoint is active.
             */
            if (mobileQuery.matches) {
              return;
            }


            const rect =
              card.getBoundingClientRect();


            const x =
              (
                event.clientX -
                rect.left
              ) /
              rect.width -
              0.5;


            const y =
              (
                event.clientY -
                rect.top
              ) /
              rect.height -
              0.5;


            const rotateY =
              x * 5;


            const rotateX =
              y * -5;


            card.style.transform =
              `
                perspective(900px)
                rotateX(${rotateX}deg)
                rotateY(${rotateY}deg)
                translateY(-4px)
              `;

          }
        );


        card.addEventListener(
          'mouseleave',
          () => {

            if (mobileQuery.matches) {
              card.style.transform = '';
              return;
            }


            card.style.transform =
              `
                perspective(900px)
                rotateX(0deg)
                rotateY(0deg)
                translateY(0)
              `;

          }
        );

      }
    );

  }


  /* =====================================================
     MOBILE SLIDER
     ===================================================== */

  const slider =
    section.querySelector(
      '[data-included-slider]'
    );


  const slides =
    Array.from(
      section.querySelectorAll(
        '[data-included-slide]'
      )
    );


  const dots =
    Array.from(
      section.querySelectorAll(
        '[data-included-dot]'
      )
    );


  if (
    slider &&
    slides.length > 1
  ) {

    let scrollTimer = null;


    const updateDots =
      (activeIndex) => {

        dots.forEach(
          (dot, index) => {

            const active =
              index === activeIndex;


            dot.classList.toggle(
              'is-active',
              active
            );


            if (active) {

              dot.setAttribute(
                'aria-current',
                'true'
              );

            } else {

              dot.removeAttribute(
                'aria-current'
              );

            }

          }
        );

      };


    const getClosestSlideIndex =
      () => {

        const sliderRect =
          slider.getBoundingClientRect();


        let closestIndex =
          0;


        let closestDistance =
          Infinity;


        slides.forEach(
          (slide, index) => {

            const slideRect =
              slide.getBoundingClientRect();


            const distance =
              Math.abs(
                slideRect.left -
                sliderRect.left
              );


            if (
              distance <
              closestDistance
            ) {

              closestDistance =
                distance;


              closestIndex =
                index;

            }

          }
        );


        return closestIndex;

      };


    const updateActiveSlide =
      () => {

        if (!mobileQuery.matches) {
          return;
        }


        updateDots(
          getClosestSlideIndex()
        );

      };


    slider.addEventListener(
      'scroll',
      () => {

        if (!mobileQuery.matches) {
          return;
        }


        window.clearTimeout(
          scrollTimer
        );


        scrollTimer =
          window.setTimeout(
            updateActiveSlide,
            60
          );

      },
      {
        passive:
          true
      }
    );


    dots.forEach(
      (dot) => {

        dot.addEventListener(
          'click',
          () => {

            if (!mobileQuery.matches) {
              return;
            }


            const index =
              Number(
                dot.dataset.index
              );


            const slide =
              slides[index];


            if (!slide) {
              return;
            }


            slider.scrollTo({
              left:
                slide.offsetLeft -
                slider.offsetLeft,

              behavior:
                reducedMotion
                  ? 'auto'
                  : 'smooth'
            });


            updateDots(
              index
            );

          }
        );

      }
    );


    const handleBreakpointChange =
      () => {

        /*
         * Returning to desktop/tablet should restore
         * the original grid at its natural starting
         * position.
         */
        if (!mobileQuery.matches) {

          slider.scrollLeft =
            0;


          slides.forEach(
            (slide) => {

              slide.style.transform =
                '';

            }
          );


          updateDots(
            0
          );

          return;

        }


        updateActiveSlide();

      };


    if (
      typeof mobileQuery.addEventListener ===
      'function'
    ) {

      mobileQuery.addEventListener(
        'change',
        handleBreakpointChange
      );

    } else if (
      typeof mobileQuery.addListener ===
      'function'
    ) {

      mobileQuery.addListener(
        handleBreakpointChange
      );

    }


    updateDots(
      0
    );

  }

})();


(() => {

  const section =
    document.getElementById(
      "pricingpackage"
    );


  if (!section) return;


  /*
   * Prevent duplicate initialization
   * when Shopify reloads the section.
   */
  if (
    section.dataset.pricingInitialized ===
    'true'
  ) {
    return;
  }


  section.dataset.pricingInitialized =
    'true';


  const slider =
    section.querySelector(
      '[data-pricing-slider]'
    );


  const pagination =
    section.querySelector(
      '[data-pricing-pagination]'
    );


  if (!slider || !pagination) return;


  const slides =
    Array.from(
      slider.querySelectorAll(
        '.pricing-card'
      )
    );


  const dots =
    Array.from(
      pagination.querySelectorAll(
        '[data-pricing-dot]'
      )
    );


  if (
    slides.length < 2 ||
    dots.length < 2
  ) {
    return;
  }


  const mobileQuery =
    window.matchMedia(
      '(max-width: 749px)'
    );


  const reducedMotionQuery =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );


  let activeIndex = 0;

  let ticking = false;


  /* =========================================
     ACTIVE DOT
  ========================================= */

  const setActiveDot = (index) => {

    if (
      index < 0 ||
      index >= dots.length
    ) {
      return;
    }


    activeIndex = index;


    dots.forEach(
      (dot, dotIndex) => {

        const isActive =
          dotIndex === activeIndex;


        dot.classList.toggle(
          'is-active',
          isActive
        );


        if (isActive) {

          dot.setAttribute(
            'aria-current',
            'true'
          );

        } else {

          dot.removeAttribute(
            'aria-current'
          );

        }

      }
    );

  };


  /* =========================================
     FIND CLOSEST SLIDE
  ========================================= */

  const getClosestSlideIndex = () => {

    const sliderRect =
      slider.getBoundingClientRect();


    let closestIndex = 0;

    let closestDistance =
      Infinity;


    slides.forEach(
      (slide, index) => {

        const slideRect =
          slide.getBoundingClientRect();


        const distance =
          Math.abs(
            slideRect.left -
            sliderRect.left
          );


        if (
          distance <
          closestDistance
        ) {

          closestDistance =
            distance;

          closestIndex =
            index;

        }

      }
    );


    return closestIndex;

  };


  /* =========================================
     UPDATE PAGINATION WHILE SWIPING
  ========================================= */

  const updateFromScroll = () => {

    if (!mobileQuery.matches) {

      ticking = false;

      return;

    }


    const newIndex =
      getClosestSlideIndex();


    if (
      newIndex !==
      activeIndex
    ) {

      setActiveDot(
        newIndex
      );

    }


    ticking = false;

  };


  slider.addEventListener(
    'scroll',
    () => {

      if (
        !mobileQuery.matches
      ) {
        return;
      }


      if (!ticking) {

        ticking = true;


        window.requestAnimationFrame(
          updateFromScroll
        );

      }

    },
    {
      passive: true
    }
  );


  /* =========================================
     CLICK / TAP DOT
  ========================================= */

  dots.forEach(
    (dot, index) => {

      dot.addEventListener(
        'click',
        () => {

          if (
            !mobileQuery.matches
          ) {
            return;
          }


          const slide =
            slides[index];


          if (!slide) return;


          const sliderRect =
            slider.getBoundingClientRect();


          const slideRect =
            slide.getBoundingClientRect();


          const targetLeft =
            slider.scrollLeft +
            (
              slideRect.left -
              sliderRect.left
            );


          slider.scrollTo({
            left: targetLeft,

            behavior:
              reducedMotionQuery.matches
                ? 'auto'
                : 'smooth'
          });


          setActiveDot(
            index
          );

        }
      );

    }
  );


  /* =========================================
     HANDLE VIEWPORT CHANGES
  ========================================= */

  const handleViewportChange = () => {

    if (
      mobileQuery.matches
    ) {

      window.requestAnimationFrame(
        () => {

          setActiveDot(
            getClosestSlideIndex()
          );

        }
      );

    } else {

      setActiveDot(0);

    }

  };


  if (
    typeof mobileQuery.addEventListener ===
    'function'
  ) {

    mobileQuery.addEventListener(
      'change',
      handleViewportChange
    );

  } else if (
    typeof mobileQuery.addListener ===
    'function'
  ) {

    mobileQuery.addListener(
      handleViewportChange
    );

  }


  handleViewportChange();

})();


  (() => {
    const section = document.getElementById('client-feedback-template--21367318315086__client_feedback_4VzBCG');

    if (!section) return;

    const slider = section.querySelector('[data-client-feedback-slider]');
    const slides = Array.from(
      section.querySelectorAll('[data-client-feedback-slide]')
    );
    const dots = Array.from(
      section.querySelectorAll('[data-client-feedback-dot]')
    );

    if (!slider || slides.length <= 1) return;

    const mobileQuery = window.matchMedia('(max-width: 749px)');

    let scrollTimer = null;

    const getClosestSlideIndex = () => {
      const sliderRect = slider.getBoundingClientRect();

      let closestIndex = 0;
      let closestDistance = Infinity;

      slides.forEach((slide, index) => {
        const slideRect = slide.getBoundingClientRect();

        const distance = Math.abs(
          slideRect.left - sliderRect.left
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    };

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

    const handleScroll = () => {
      if (!mobileQuery.matches) return;

      window.clearTimeout(scrollTimer);

      scrollTimer = window.setTimeout(() => {
        const activeIndex = getClosestSlideIndex();
        updateDots(activeIndex);
      }, 60);
    };

    slider.addEventListener(
      'scroll',
      handleScroll,
      { passive: true }
    );

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        if (!mobileQuery.matches) return;

        const index = Number(dot.dataset.index);
        const targetSlide = slides[index];

        if (!targetSlide) return;

        slider.scrollTo({
          left: targetSlide.offsetLeft - slider.offsetLeft,
          behavior: 'smooth'
        });

        updateDots(index);
      });
    });

    const resetDesktopSlider = () => {
      if (!mobileQuery.matches) {
        slider.scrollLeft = 0;
        updateDots(0);
      }
    };

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener(
        'change',
        resetDesktopSlider
      );
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(
        resetDesktopSlider
      );
    }

    updateDots(0);
  })();


(function () {

  const section =
    document.getElementById(
      "faq"
    );


  if (!section) {
    return;
  }


  /*
   * Prevent duplicate initialization
   * when Shopify reloads the section
   * inside the Theme Editor.
   */
  if (
    section.dataset.faqInitialized ===
    'true'
  ) {
    return;
  }


  section.dataset.faqInitialized =
    'true';


  const items =
    section.querySelectorAll(
      '.launch-faq__item'
    );


  /* ======================================
     OPEN ITEM
     ====================================== */

  function openItem(item) {

    const button =
      item.querySelector(
        '[data-faq-button]'
      );


    const answer =
      item.querySelector(
        '[data-faq-answer]'
      );


    if (
      !button ||
      !answer
    ) {
      return;
    }


    item.classList.add(
      'is-open'
    );


    button.setAttribute(
      'aria-expanded',
      'true'
    );


    answer.style.maxHeight =
      answer.scrollHeight +
      'px';

  }


  /* ======================================
     CLOSE ITEM
     ====================================== */

  function closeItem(item) {

    const button =
      item.querySelector(
        '[data-faq-button]'
      );


    const answer =
      item.querySelector(
        '[data-faq-answer]'
      );


    if (
      !button ||
      !answer
    ) {
      return;
    }


    item.classList.remove(
      'is-open'
    );


    button.setAttribute(
      'aria-expanded',
      'false'
    );


    answer.style.maxHeight =
      '0px';

  }


  /* ======================================
     INITIALIZE ITEMS
     ====================================== */

  function initializeItems() {

    items.forEach(
      function (item) {

        if (
          item.classList.contains(
            'is-open'
          )
        ) {

          openItem(
            item
          );

        } else {

          closeItem(
            item
          );

        }

      }
    );

  }


  initializeItems();


  /* ======================================
     ACCORDION CLICK
     ====================================== */

  items.forEach(
    function (item) {

      const button =
        item.querySelector(
          '[data-faq-button]'
        );


      if (!button) {
        return;
      }


      button.addEventListener(
        'click',
        function () {

          const isOpen =
            item.classList.contains(
              'is-open'
            );


          

            items.forEach(
              function (otherItem) {

                if (
                  otherItem !==
                  item
                ) {

                  closeItem(
                    otherItem
                  );

                }

              }
            );

          


          if (isOpen) {

            closeItem(
              item
            );

          } else {

            openItem(
              item
            );

          }

        }
      );

    }
  );


  /* ======================================
     RECALCULATE OPEN ACCORDION HEIGHTS
     ====================================== */

  window.addEventListener(
    'resize',
    function () {

      items.forEach(
        function (item) {

          if (
            !item.classList.contains(
              'is-open'
            )
          ) {
            return;
          }


          const answer =
            item.querySelector(
              '[data-faq-answer]'
            );


          if (!answer) {
            return;
          }


          answer.style.maxHeight =
            answer.scrollHeight +
            'px';

        }
      );

    },
    {
      passive: true
    }
  );

})();

;(()=>{
  const b=document.querySelector('.mockup-back-to-top');
  if(b){
    const u=()=>b.classList.toggle('is-visible',scrollY>300);
    b.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
    addEventListener('scroll',u,{passive:true});u();
  }
  document.querySelectorAll('[data-placeholder-form]').forEach(form=>form.addEventListener('submit',event=>{
    event.preventDefault();
    const old=form.querySelector('[data-standalone-status]');
    if(old)old.remove();
    const message=document.createElement('p');
    message.dataset.standaloneStatus='true';
    message.textContent='Form delivery will be connected when the backend is ready.';
    message.style.cssText='color:#b9f234;font-size:12px;margin:12px 0 0';
    form.append(message);
  }));
})();
