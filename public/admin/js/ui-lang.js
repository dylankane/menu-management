// public/admin/js/ui-lang.js
// Handles admin UI language switching via the lang selector component.
// Submits a POST to /admin/set-ui-lang which sets a cookie and redirects back.

(function () {
  function setUiLang(lang) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/admin/set-ui-lang';

    const input = document.createElement('input');
    input.type  = 'hidden';
    input.name  = 'lang';
    input.value = lang;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.lang-selector__btn');
    if (!btn) return;

    const lang = btn.dataset.lang;
    if (!lang) return;

    // Already active — nothing to do
    if (btn.classList.contains('lang-selector__btn--active')) return;

    setUiLang(lang);
  });
})();
