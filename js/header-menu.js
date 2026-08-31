(() => {
  document.querySelectorAll('[data-nehemiah-header]').forEach((header) => {
    if (header.dataset.mobileMenuReady === 'true') return;
    const toggle = header.querySelector('[data-mobile-toggle]');
    const panel = header.querySelector('[data-mobile-panel]');
    if (!toggle || !panel) return;

    header.dataset.mobileMenuReady = 'true';
    const closeMenu = () => {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      panel.classList.remove('is-open');
      panel.hidden = true;
      panel.querySelectorAll('.nehemiah-header__mobile-dropdown[open]').forEach((dropdown) => {
        dropdown.removeAttribute('open');
      });
    };

    toggle.addEventListener('click', (event) => {
      // Some standalone pages include a legacy page bundle that also binds this
      // button. Own the click during capture so those handlers cannot toggle the
      // menu a second time and immediately undo this state change.
      event.stopImmediatePropagation();
      const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(willOpen));
      toggle.setAttribute('aria-label', willOpen ? 'Close navigation menu' : 'Open navigation menu');
      panel.classList.toggle('is-open', willOpen);
      panel.hidden = !willOpen;
    }, { capture: true });

    panel.querySelectorAll('[data-mobile-link]').forEach((link) => link.addEventListener('click', closeMenu));
    panel.querySelectorAll('.nehemiah-header__mobile-dropdown').forEach((dropdown) => {
      const summary = dropdown.querySelector('summary');
      if (!summary) return;
      summary.setAttribute('aria-expanded', String(dropdown.open));
      dropdown.addEventListener('toggle', () => {
        summary.setAttribute('aria-expanded', String(dropdown.open));
      });
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
  });
})();
