(() => {
  if (document.querySelector('.custom-footer-menus')) return;

  if (!document.querySelector('link[href="css/footer.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'css/footer.css';
    document.head.append(stylesheet);
  }

  const links = (items) => items.map(([label, href]) => `
    <li class="custom-footer-menus__item">
      <a class="custom-footer-menus__link" href="${href}">
        <span class="custom-footer-menus__arrow" aria-hidden="true"><svg width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="M2 1.5 6.5 6 2 10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="custom-footer-menus__link-text">${label}</span>
      </a>
    </li>`).join('');

  const footer = document.createElement('section');
  footer.id = 'shopify-section-template--21367318315086__custom_footer_menus_iNzdR8';
  footer.className = 'shopify-section section-custom-footer-menus';
  footer.innerHTML = `
    <section id="CustomFooterMenus-template--21367318315086__custom_footer_menus_iNzdR8" class="custom-footer-menus" style="--launch-bg:#061318;--launch-accent:#b9f234;--cfm-heading:#a7c52a;--cfm-text:#b5bac2;--cfm-hover:#fff;--cfm-arrow:#a7c52a;--cfm-brand-text:#fff;--cfm-description-color:#b5bac2;--cfm-max-width:1300px;--cfm-column-gap:60px;--cfm-row-gap:40px;--cfm-heading-size:14px;--cfm-link-size:16px;--cfm-logo-width:180px;--cfm-padding-top:50px;--cfm-padding-bottom:50px">
      <div class="custom-footer-menus__container"><div class="custom-footer-menus__grid">
        <div class="custom-footer-menus__brand-column"><div class="custom-footer-menus__brand-wrap">
          <a href="index.html" class="custom-footer-menus__brand-link" aria-label="Nehemiah home"><img class="custom-footer-menus__logo" src="assets/images/nehemiah-logo.png" alt="" width="388" height="431" style="width:92px;height:72px;object-fit:contain"></a>
          <div class="custom-footer-menus__description">We build professional, responsive Shopify stores for businesses that want to launch faster—without compromising on design, performance, or functionality.</div>
        </div></div>
        <div class="custom-footer-menus__column"><h3 class="custom-footer-menus__heading">QUICK LINKS</h3><ul class="custom-footer-menus__list" role="list">${links([['How it works','HowItWorks.html'],['Pricing','pricing.html'],['Blog','blog.html'],['Contact','contact.html']])}</ul></div>
        <div class="custom-footer-menus__column"><h3 class="custom-footer-menus__heading">GUIDES</h3><ul class="custom-footer-menus__list" role="list">${links([['Shopify Launch Checklist','shopify-launch-checklist.html'],['Shopify Store Cost','shopify-store-cost.html'],['48 Hour Shopify Launch','48-hour-shopify-launch.html']])}</ul></div>
      </div></div>
    </section>`;

  const main = document.querySelector('main');
  if (main) main.insertAdjacentElement('afterend', footer);
  else document.body.append(footer);
})();
