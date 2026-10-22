/* Panel de buscar y reemplazar con reglas persistentes */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const STORAGE_KEY = 'htmlEditor.findReplace.v1';
  const MAX_RULES = 10;

  const icon = (name) => '<svg class="icon" aria-hidden="true"><use href="#' + name + '"/></svg>';

  function loadRules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return null;
      return parsed.slice(0, MAX_RULES).map((rule) => ({
        find: typeof rule.find === 'string' ? rule.find : '',
        repl: typeof rule.repl === 'string' ? rule.repl : '',
        regex: !!rule.regex,
        ignoreCase: !!rule.ignoreCase,
      }));
    } catch (error) {
      return null;
    }
  }

  function saveRules(rules) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (error) {
      /* sin persistencia */
    }
  }

  App.createFindReplace = function (config) {
    const cfg = config || {};
    const rowsEl = cfg.rowsEl;
    const addBtn = cfg.addBtn;
    const applyAllBtn = cfg.applyAllBtn;
    const countEl = cfg.countEl;
    if (!rowsEl) return null;

    let lastError = '';

    function buildRow(rule) {
      const row = document.createElement('div');
      row.className = 'fr-row';
      row.innerHTML = [
        '<input type="text" class="fr-find" placeholder="Buscar" aria-label="Texto a buscar" autocomplete="off" spellcheck="false">',
        '<input type="text" class="fr-repl" placeholder="Reemplazar por (vacío = eliminar)" aria-label="Texto de reemplazo" autocomplete="off" spellcheck="false">',
        '<label class="mini-check" title="Tratar la búsqueda como expresión regular"><input type="checkbox" class="fr-regex"> Regex</label>',
        '<label class="mini-check" title="Ignorar mayúsculas y minúsculas"><input type="checkbox" class="fr-ic"> Aa</label>',
        '<div class="fr-row-actions">',
        '  <button type="button" class="fr-btn fr-btn--apply" title="Aplicar esta regla" aria-label="Aplicar esta regla">' + icon('i-arrow-right') + '</button>',
        '  <button type="button" class="fr-btn fr-btn--remove" title="Eliminar regla" aria-label="Eliminar regla">' + icon('i-x') + '</button>',
        '</div>',
      ].join('');
      row.querySelector('.fr-find').value = rule && rule.find ? rule.find : '';
      row.querySelector('.fr-repl').value = rule && rule.repl ? rule.repl : '';
      row.querySelector('.fr-regex').checked = !!(rule && rule.regex);
      row.querySelector('.fr-ic').checked = !!(rule && rule.ignoreCase);
      return row;
    }

    function readRow(row) {
      return {
        find: row.querySelector('.fr-find').value,
        repl: row.querySelector('.fr-repl').value,
        regex: row.querySelector('.fr-regex').checked,
        ignoreCase: row.querySelector('.fr-ic').checked,
      };
    }

    function readAll() {
      return App.$$('.fr-row', rowsEl).map(readRow);
    }

    function updateControls() {
      const rows = App.$$('.fr-row', rowsEl);
      rows.forEach((row) => {
        const remove = row.querySelector('.fr-btn--remove');
        if (remove) remove.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
      });
      if (addBtn) addBtn.disabled = rows.length >= MAX_RULES;
    }

    function persist() {
      saveRules(readAll());
    }

    const persistDebounced = App.debounce(persist, 300);

    function setCount(message, isError) {
      if (!countEl) return;
      countEl.textContent = message || '';
      countEl.classList.toggle('is-error', !!isError);
    }

    function ruleToRegExp(rule) {
      if (!rule.find) return null;
      const flags = rule.ignoreCase ? 'gi' : 'g';
      if (rule.regex) return new RegExp(rule.find, flags);
      return new RegExp(App.escapeRegExp(rule.find), flags);
    }

    function validate(rule) {
      if (!rule.find) return null;
      if (!rule.regex) return null;
      try {
        new RegExp(rule.find, rule.ignoreCase ? 'gi' : 'g');
        return null;
      } catch (error) {
        return 'Regex inválida: ' + (error.message || 'revisa el patrón');
      }
    }

    function applyRuleToText(text, rule) {
      const regex = ruleToRegExp(rule);
      if (!regex) return { text, count: 0 };
      const matches = text.match(regex);
      const count = matches ? matches.length : 0;
      if (!count) return { text, count: 0 };
      let next;
      if (rule.regex) {
        next = text.replace(regex, rule.repl);
      } else {
        next = text.replace(regex, () => rule.repl);
      }
      return { text: next, count };
    }

    function applyAll() {
      const rules = readAll();
      const active = rules.filter((rule) => rule.find !== '');
      if (!active.length) {
        setCount('Escribe algo en «Buscar».', true);
        return;
      }
      for (const rule of active) {
        const error = validate(rule);
        if (error) {
          setCount(error, true);
          return;
        }
      }

      let working = String(cfg.getHtml ? cfg.getHtml() : '');
      let total = 0;
      active.forEach((rule) => {
        const result = applyRuleToText(working, rule);
        working = result.text;
        total += result.count;
      });

      if (!total) {
        setCount('Sin coincidencias.', false);
        return;
      }
      if (cfg.onApply) cfg.onApply(working, total, 'Buscar y reemplazar');
      setCount(total + (total === 1 ? ' reemplazo' : ' reemplazos'), false);
    }

    function applyOne(row) {
      const rule = readRow(row);
      if (!rule.find) {
        setCount('Escribe algo en «Buscar».', true);
        return;
      }
      const error = validate(rule);
      if (error) {
        setCount(error, true);
        return;
      }
      const source = String(cfg.getHtml ? cfg.getHtml() : '');
      const result = applyRuleToText(source, rule);
      if (!result.count) {
        setCount('Sin coincidencias.', false);
        return;
      }
      if (cfg.onApply) cfg.onApply(result.text, result.count, 'Buscar y reemplazar');
      setCount(result.count + (result.count === 1 ? ' reemplazo' : ' reemplazos'), false);
    }

    function addRow(rule) {
      const rows = App.$$('.fr-row', rowsEl);
      if (rows.length >= MAX_RULES) return;
      rowsEl.appendChild(buildRow(rule || {}));
      updateControls();
      persist();
      const last = App.$('.fr-row:last-child .fr-find', rowsEl);
      if (last) last.focus();
    }

    function removeRow(row) {
      const rows = App.$$('.fr-row', rowsEl);
      if (rows.length <= 1) return;
      row.remove();
      updateControls();
      persist();
    }

    /* ---------- Eventos ---------- */
    rowsEl.addEventListener('click', (event) => {
      const apply = event.target.closest('.fr-btn--apply');
      if (apply) {
        applyOne(apply.closest('.fr-row'));
        return;
      }
      const remove = event.target.closest('.fr-btn--remove');
      if (remove) removeRow(remove.closest('.fr-row'));
    });

    rowsEl.addEventListener('input', () => {
      setCount('', false);
      persistDebounced();
    });
    rowsEl.addEventListener('change', () => {
      setCount('', false);
      persist();
    });

    if (addBtn) addBtn.addEventListener('click', () => addRow());
    if (applyAllBtn) applyAllBtn.addEventListener('click', applyAll);

    /* ---------- Inicialización ---------- */
    const saved = loadRules();
    if (saved && saved.length) saved.forEach((rule) => rowsEl.appendChild(buildRow(rule)));
    else rowsEl.appendChild(buildRow());

    updateControls();

    return {
      applyAll,
      applyOne,
      addRow,
      clearCount: () => setCount('', false),
      getRules: readAll,
      setCount,
    };
  };
})(window);
