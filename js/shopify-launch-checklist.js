document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('[data-nehemiah-header]');
  const toggle = header?.querySelector('[data-mobile-toggle]');
  const panel = header?.querySelector('[data-mobile-panel]');

  const closeMenu = () => {
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
    panel.classList.remove('is-open');
    panel.hidden = true;
  };

  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const opening = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(opening));
      toggle.setAttribute('aria-label', opening ? 'Close navigation menu' : 'Open navigation menu');
      panel.hidden = !opening;
      panel.classList.toggle('is-open', opening);
    });

    panel.querySelectorAll('[data-mobile-link]').forEach((link) => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 749) closeMenu();
    });
  }

  const storageKey = 'nehemiah-shopify-launch-checklist';
  const checkboxes = [...document.querySelectorAll('.checklist-card__more input[type="checkbox"]')];
  const progressText = document.querySelector('[data-progress-text]');
  const progressBar = document.querySelector('[data-progress-bar]');
  let saved = [];

  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch {
    saved = [];
  }

  const updateProgress = () => {
    const completed = checkboxes.filter((checkbox) => checkbox.checked).length;
    const percentage = checkboxes.length ? (completed / checkboxes.length) * 100 : 0;
    if (progressText) progressText.textContent = `${completed} of ${checkboxes.length} tasks complete`;
    if (progressBar) progressBar.style.width = `${percentage}%`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(checkboxes.map((checkbox) => checkbox.checked)));
    } catch {
      // Progress still works for this visit when storage is unavailable.
    }
  };

  checkboxes.forEach((checkbox, index) => {
    checkbox.checked = Boolean(saved[index]);
    checkbox.addEventListener('change', updateProgress);
  });

  document.querySelectorAll('[data-checklist-card]').forEach((card) => {
    const button = card.querySelector('.checklist-card__toggle');
    const details = card.querySelector('.checklist-card__more');
    if (!button || !details) return;

    button.addEventListener('click', () => {
      const opening = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(opening));
      button.firstChild.textContent = opening ? 'Hide checklist ' : 'View checklist ';
      details.hidden = !opening;
    });
  });

  document.querySelector('[data-reset-progress]')?.addEventListener('click', () => {
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    updateProgress();
  });

  updateProgress();
});
