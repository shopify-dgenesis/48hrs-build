
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


(function(){
  const root = document.getElementById('Build48Intake-template--21367318216782__intake_48h_CXCth3');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const form = root.querySelector('[data-intake-form]');
  const panels = [...root.querySelectorAll('.b48-form-panel')];
  const indicators = [...root.querySelectorAll('[data-step-indicator]')];
  const nextBtn = root.querySelector('[data-next-btn]');
  const backBtn = root.querySelector('[data-back-btn]');
  const buttonRow = root.querySelector('.b48-button-row');
  const progressFill = root.querySelector('[data-progress-fill]');
  const stepNumber = root.querySelector('[data-step-number]');
  const saveLink = root.querySelector('[data-save-link]');
  let current = Math.min(5, Math.max(1, Number(localStorage.getItem('nehemiah-48hr-intake-step')) || 1));

  const labels = [
    'Continue to Store & Scope →',
    'Continue to Brand & Design →',
    'Continue to Products & Content →',
    'Continue to Launch Setup →',
    'Submit Client Preparation Form'
  ];

  function getCurrentPanel(){
    return panels.find(panel => Number(panel.dataset.step) === current);
  }

  function getValidationMessage(panel){
    let message = panel.querySelector('.b48-validation-message');

    if (!message) {
      message = document.createElement('div');
      message.className = 'b48-validation-message';
      message.setAttribute('role', 'alert');
      message.setAttribute('aria-live', 'polite');
      message.textContent = 'Please complete every field in this step before continuing.';

      const grid = panel.querySelector('.b48-grid');
      if (grid) grid.prepend(message);
    }

    return message;
  }

  function clearFieldError(control){
    if (!control) return;

    const field = control.closest('.b48-field');
    const detailField = control.closest('.b48-form-detail-field');
    const upload = control.closest('.b48-upload');
    const row = control.closest('.b48-check-row');
    const choices = control.closest('.b48-choice-grid');

    if (field) field.classList.remove('b48-error');
    if (detailField) detailField.classList.remove('b48-error');
    if (upload) upload.classList.remove('b48-error');
    if (row) row.classList.remove('b48-error');
    if (choices) choices.classList.remove('b48-error');

    control.removeAttribute('aria-invalid');
  }

  function markFieldError(control){
    if (!control) return;

    const field = control.closest('.b48-field');
    const detailField = control.closest('.b48-form-detail-field');
    const upload = control.closest('.b48-upload');
    const row = control.closest('.b48-check-row');
    const choices = control.closest('.b48-choice-grid');

    if (field) field.classList.add('b48-error');
    if (detailField) detailField.classList.add('b48-error');
    if (upload) upload.classList.add('b48-error');
    if (row) row.classList.add('b48-error');
    if (choices) choices.classList.add('b48-error');

    control.setAttribute('aria-invalid', 'true');
  }

  function isComplete(control, panel){
    if (!control || control.disabled) return true;

    const type = (control.type || '').toLowerCase();

    if (type === 'radio') {
      return !!panel.querySelector('input[type="radio"][name="' + control.name + '"]:checked');
    }

    if (type === 'checkbox') {
      return control.checked;
    }

    if (type === 'file') {
      return !!(control.files && control.files.length);
    }

    const value = (control.value || '').trim();
    if (!value) return false;

    if (typeof control.checkValidity === 'function' && !control.checkValidity()) {
      return false;
    }

    return true;
  }

  function validateCurrentStep(){
    const panel = getCurrentPanel();
    if (!panel) return true;

    const message = getValidationMessage(panel);
    const optionalFields = new Set([
      'intake_field_7', 'intake_field_10', 'intake_field_11',
      'intake_field_12', 'intake_field_13', 'intake_field_14',
      'intake_field_15', 'intake_field_16', 'intake_field_17',
      'intake_field_19', 'intake_field_20', 'intake_field_21',
      'intake_field_22', 'intake_field_23', 'intake_field_24',
      'intake_field_25', 'intake_field_26', 'intake_field_29',
      'intake_field_33', 'intake_field_34', 'intake_field_35',
      'intake_field_41', 'navigation_notes', 'domain_notes'
    ]);
    const controls = [...panel.querySelectorAll('input, select, textarea')]
      .filter(control => (control.type || '').toLowerCase() !== 'hidden')
      .filter(control => !optionalFields.has(control.name));

    let valid = true;
    let firstInvalid = null;
    const radioGroups = new Set();

    controls.forEach(control => {
      clearFieldError(control);

      const type = (control.type || '').toLowerCase();

      if (type === 'radio') {
        if (radioGroups.has(control.name)) return;
        radioGroups.add(control.name);

        const group = [...panel.querySelectorAll('input[type="radio"][name="' + control.name + '"]')];
        const checked = group.some(item => item.checked);

        if (!checked) {
          valid = false;
          group.forEach(markFieldError);
          if (!firstInvalid) firstInvalid = control;
        }

        return;
      }

      if (!isComplete(control, panel)) {
        valid = false;
        markFieldError(control);
        if (!firstInvalid) firstInvalid = control;
      }
    });

    message.classList.toggle('b48-show', !valid);

    if (!valid && firstInvalid) {
      const target =
        firstInvalid.closest('.b48-upload') ||
        firstInvalid.closest('.b48-check-row') ||
        firstInvalid.closest('.b48-form-detail-field') ||
        firstInvalid.closest('.b48-field') ||
        firstInvalid.closest('.b48-choice-grid') ||
        firstInvalid;

      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior:'smooth', block:'center' });
      }

      if ((firstInvalid.type || '').toLowerCase() !== 'file' && firstInvalid.focus) {
        setTimeout(() => firstInvalid.focus({ preventScroll:true }), 250);
      }
    }

    return valid;
  }

  function render(shouldScroll){
    try { localStorage.setItem('nehemiah-48hr-intake-step', String(current)); } catch (error) {}
    panels.forEach(panel => {
      panel.classList.toggle('b48-active', Number(panel.dataset.step) === current);
    });

    indicators.forEach(item => {
      const step = Number(item.dataset.stepIndicator);
      item.classList.toggle('b48-active', step === current);
      item.classList.toggle('b48-complete', step < current);

      const num = item.querySelector('.b48-step-num');
      if (num) num.textContent = step < current ? '✓' : step;
    });

    progressFill.style.width = `${current * 20}%`;
    stepNumber.textContent = current;
    nextBtn.textContent = labels[current - 1];
    backBtn.style.display = 'inline-block';

    if (buttonRow) buttonRow.classList.remove('b48-no-back');

    if (shouldScroll) {
      const mobile = window.matchMedia('(max-width: 720px)').matches;
      const target = mobile ? root.querySelector('.b48-form-card') : root;
      if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  function updateUploadLabel(input){
    const tile = input.closest('.b48-upload');
    const copy = tile && tile.querySelector('.b48-upload-copy');

    if (!copy || !input.files || !input.files.length) return;

    const names = [...input.files].map(file => file.name);
    copy.dataset.originalText = copy.dataset.originalText || copy.textContent;
    copy.textContent = names.length === 1 ? names[0] : `${names.length} files selected`;
  }

  root.querySelectorAll('.b48-upload input[type="file"]').forEach(input => {
    input.addEventListener('change', () => {
      updateUploadLabel(input);
      clearFieldError(input);
    });
  });

  root.querySelectorAll('input, select, textarea').forEach(control => {
    const eventName =
      control.tagName === 'SELECT' ||
      control.type === 'checkbox' ||
      control.type === 'radio' ||
      control.type === 'file'
        ? 'change'
        : 'input';

    control.addEventListener(eventName, () => {
      clearFieldError(control);
      const panel = control.closest('.b48-form-panel');
      const message = panel && panel.querySelector('.b48-validation-message');
      if (message) message.classList.remove('b48-show');
    });
  });

  if (form) {
    form.addEventListener('submit', event => event.preventDefault());
  }

  nextBtn.addEventListener('click', () => {
    if (!validateCurrentStep()) return;

    if (current < 5) {
      current++;
      render(true);
    } else {
      submitIntake();
    }
  });

  /* ============================================================
     SUBMISSION
     Sends every step's answers plus the uploads to /api/intake.
     ============================================================ */

  const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

  let status = root.querySelector('[data-intake-status]');
  if (!status) {
    status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.dataset.intakeStatus = 'true';
    status.hidden = true;
    const actions = root.querySelector('.b48-actions');
    if (actions) actions.append(status);
    else form.append(status);
  }

  const showStatus = (tone, text) => {
    status.className = 'form-status form-status--' + tone;
    status.textContent = text;
    status.hidden = false;
  };

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // strip the "data:<mime>;base64," prefix
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read ' + file.name));
    reader.readAsDataURL(file);
  });

  function collectFields() {
    const fields = {};
    [...form.elements].forEach(el => {
      if (!el.name || el.type === 'button' || el.type === 'submit' || el.type === 'file') return;

      if (el.type === 'radio') {
        if (!el.checked) return;
        // These radios carry no value attribute; the visible title is the answer.
        const title = el.parentElement && el.parentElement.querySelector('.b48-choice-title');
        fields[el.name] = title ? title.textContent.replace(/\s+/g, ' ').trim() : 'Selected';
        return;
      }
      if (el.type === 'checkbox') { fields[el.name] = el.checked; return; }
      fields[el.name] = el.value;
    });
    return fields;
  }

  async function collectFiles() {
    const files = [];
    let total = 0;
    const inputs = [...form.querySelectorAll('input[type="file"]')];

    for (const input of inputs) {
      if (!input.name || !input.files || !input.files.length) continue;
      for (const file of input.files) {
        total += file.size;
        if (total > MAX_UPLOAD_BYTES) {
          throw new Error(
            'Your uploads add up to more than 20 MB. Please remove the largest files and share them '
            + 'using the folder-link fields instead.'
          );
        }
        files.push({ field: input.name, filename: file.name, content: await readFile(file) });
      }
    }
    return files;
  }

  async function submitIntake() {
    if (nextBtn.dataset.sending === 'true') return;
    nextBtn.dataset.sending = 'true';
    nextBtn.disabled = true;
    status.hidden = true;

    try {
      const fields = collectFields();
      nextBtn.textContent = 'Preparing files…';
      const files = await collectFiles();

      nextBtn.textContent = 'Submitting…';
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fields,
          files,
          website: '',
          page: location.pathname
        })
      });

      let result = {};
      try { result = await response.json(); } catch (_) { /* non-JSON error page */ }

      if (response.ok && result.ok) {
        nextBtn.textContent = 'Submitted ✓';
        nextBtn.setAttribute('aria-disabled', 'true');
        showStatus('success',
          'Intake received. We’ll review it, flag any blockers, and confirm your Hour 0 start time by email.');
        try {
          localStorage.removeItem('nehemiah-48hr-intake-fields-v2');
          localStorage.removeItem('nehemiah-48hr-intake-step');
        } catch (_) {}
        status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      showStatus('error', result.error || 'Something went wrong. Please try again.');
      nextBtn.textContent = labels[4];
      nextBtn.disabled = false;
    } catch (error) {
      showStatus('error', error.message || 'Network error — please check your connection and try again.');
      nextBtn.textContent = labels[4];
      nextBtn.disabled = false;
    } finally {
      nextBtn.dataset.sending = 'false';
    }
  }

  backBtn.addEventListener('click', () => {
    if (current > 1) {
      current--;
      render(true);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    }
  });

  if (saveLink) {
    saveLink.addEventListener('click', event => event.preventDefault());
  }

  render(false);
})();
;(() => {
  const form=document.querySelector('[data-intake-form]');
  if(!form)return;
  const key='nehemiah-48hr-intake-fields-v2';
  const saveState=()=>{const values={};[...form.elements].forEach(el=>{if(!el.name||el.type==='file'||el.type==='button'||el.type==='submit')return;if(el.type==='radio'){if(el.checked)values[el.name]=el.value||'checked'}else if(el.type==='checkbox')values[el.name]=el.checked;else values[el.name]=el.value});try{localStorage.setItem(key,JSON.stringify(values))}catch(error){}};
  const restore=()=>{try{const values=JSON.parse(localStorage.getItem(key)||'{}');Object.entries(values).forEach(([name,value])=>{const controls=[...form.elements].filter(el=>el.name===name);controls.forEach(el=>{if(el.type==='radio')el.checked=(el.value||'checked')===value;else if(el.type==='checkbox')el.checked=!!value;else el.value=value})})}catch(error){localStorage.removeItem(key)}};
  restore();
  let timer;form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(saveState,250)});form.addEventListener('change',saveState);
  const save=document.querySelector('[data-save-link]');if(save)save.addEventListener('click',()=>{saveState();save.textContent='Saved on this device ?';setTimeout(()=>save.textContent='Save and finish later',1600)});
  const b=document.querySelector('.mockup-back-to-top');if(b){const update=()=>b.classList.toggle('is-visible',scrollY>300);b.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));addEventListener('scroll',update,{passive:true});update()}
})();
