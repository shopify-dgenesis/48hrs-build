(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('[data-header]');
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  const topButton = document.querySelector('.back-to-top');

  const updateScrollUI = () => {
    header?.classList.toggle('scrolled', scrollY > 12);
    topButton?.classList.toggle('visible', scrollY > 300);
  };
  addEventListener('scroll', updateScrollUI, { passive: true });
  updateScrollUI();

  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    mobileNav.classList.toggle('open', open);
  });
  mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', 'false'); mobileNav.classList.remove('open');
  }));
  topButton?.addEventListener('click', () => scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }));

  const reveals = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) reveals.forEach(el => el.classList.add('visible'));
  else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: .12, rootMargin: '0px 0px -35px' });
    reveals.forEach(el => observer.observe(el));
  }

  document.querySelectorAll('[data-slider]').forEach(slider => {
    const track = slider.querySelector('.slider-track');
    const items = [...track.children];
    const dots = slider.querySelector('.slider-dots');
    if (!dots || items.length < 2) return;
    items.forEach((item, index) => {
      const dot = document.createElement('button'); dot.type = 'button'; dot.className = `slider-dot${index === 0 ? ' active' : ''}`; dot.setAttribute('aria-label', `Show slide ${index + 1}`);
      dot.addEventListener('click', () => item.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })); dots.append(dot);
    });
    let frame;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
        const center = track.scrollLeft + track.clientWidth / 2;
        let nearest = 0, distance = Infinity;
        items.forEach((item, i) => { const d = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center); if (d < distance) { distance = d; nearest = i; } });
        dots.querySelectorAll('.slider-dot').forEach((dot, i) => dot.classList.toggle('active', i === nearest));
      });
    }, { passive: true });
  });

  const steps = [...document.querySelectorAll('.process-step')];
  const visual = document.querySelector('[data-process-visual]');
  const visualImage = visual?.querySelector('[data-visual-image]');
  const visualLabel = visual?.querySelector('[data-visual-label]');
  const progress = document.querySelector('[data-timeline-progress]');
  const activateStep = index => {
    steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
    if (progress) progress.style.height = `${index / Math.max(steps.length - 1, 1) * 100}%`;
    const step = steps[index]; if (!step || visualImage.src.endsWith(step.dataset.image)) return;
    visual.classList.add('changing');
    const preload = new Image(); preload.src = step.dataset.image;
    preload.onload = () => setTimeout(() => { visualImage.src = preload.src; visualImage.alt = `${step.dataset.label} preview`; visualLabel.textContent = step.dataset.label; visual.classList.remove('changing'); }, 140);
  };
  if ('IntersectionObserver' in window) {
    const processObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) activateStep(steps.indexOf(entry.target)); }), { rootMargin: '-35% 0px -45%', threshold: 0 });
    steps.forEach(step => processObserver.observe(step));
  }

  document.querySelectorAll('.tilt').forEach(card => {
    if (reducedMotion || !matchMedia('(hover:hover)').matches) return;
    card.addEventListener('pointermove', event => { const r = card.getBoundingClientRect(); const x = (event.clientX-r.left)/r.width-.5; const y = (event.clientY-r.top)/r.height-.5; card.style.transform = `perspective(600px) rotateX(${-y*7}deg) rotateY(${x*7}deg) translateY(-3px)`; });
    card.addEventListener('pointerleave', () => card.style.transform = '');
  });

  document.querySelectorAll('.faq-item button').forEach(button => button.addEventListener('click', () => {
    const item = button.closest('.faq-item'); const open = item.classList.contains('is-open');
    document.querySelectorAll('.faq-item').forEach(other => { other.classList.remove('is-open'); other.querySelector('button').setAttribute('aria-expanded', 'false'); });
    if (!open) { item.classList.add('is-open'); button.setAttribute('aria-expanded', 'true'); }
  }));

  document.querySelector('[data-demo-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    event.currentTarget.querySelector('.form-status').textContent = 'Form delivery will be connected when the VPS endpoint is ready.';
  });
})();
