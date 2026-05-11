// public/admin/js/menu-translations.js
// Handles inline-editing of static translation cells in the menu-translations table.

(function () {
  var saveTimers = {};

  function saveCell(key, lang, value, cell) {
    clearTimeout(saveTimers[key + '::' + lang]);
    saveTimers[key + '::' + lang] = setTimeout(function () {
      api('PUT', '/api/static-translations/' + encodeURIComponent(key) + '/' + encodeURIComponent(lang), { value: value })
        .then(function () {
          flashSaved(cell);
          updateMissingCount(cell.closest('tr'), lang);
        })
        .catch(function (err) {
          showToast(err.message || tr('generic_error'), 'error');
        });
    }, 400);
  }

  function flashSaved(cell) {
    cell.classList.remove('trans-cell--empty');
    cell.classList.add('trans-cell--saved');
    setTimeout(function () { cell.classList.remove('trans-cell--saved'); }, 1800);
  }

  function updateMissingCount(row, lang) {
    var cells = row.querySelectorAll('.trans-cell[data-lang]');
    var missing = 0;
    cells.forEach(function (c) {
      if (!c.querySelector('textarea').value.trim()) missing++;
    });
    var badge = row.querySelector('.trans-missing');
    if (badge) {
      badge.textContent = missing || '';
      badge.classList.toggle('hidden', missing === 0);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.trans-cell textarea').forEach(function (ta) {
      ta.addEventListener('input', function () {
        var cell = ta.closest('.trans-cell');
        var key  = cell.dataset.key;
        var lang = cell.dataset.lang;
        saveCell(key, lang, ta.value, cell);
      });

      ta.addEventListener('blur', function () {
        var cell = ta.closest('.trans-cell');
        var key  = cell.dataset.key;
        var lang = cell.dataset.lang;
        clearTimeout(saveTimers[key + '::' + lang]);
        api('PUT', '/api/static-translations/' + encodeURIComponent(key) + '/' + encodeURIComponent(lang), { value: ta.value })
          .then(function () { flashSaved(cell); })
          .catch(function (err) { showToast(err.message || tr('generic_error'), 'error'); });
      });
    });
  });
}());
