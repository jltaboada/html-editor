/* Integración de la aplicación: estado, sincronización, paneles y acciones */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};
  const $ = App.$;
  const $$ = App.$$;

  const DRAFT_KEY = 'htmlEditor.draft.v1';
  const SETTINGS_KEY = 'htmlEditor.settings.v1';
  const CLEAN_KEY = 'htmlEditor.clean.v1';
  const MAX_DRAFT_CHARS = 4000000;
  const VIEWS = ['split', 'visual', 'source'];

  const PALETTE = [
    '#000000', '#222222', '#5f452a', '#7a5a3a', '#02874d', '#026a3d',
    '#0f5132', '#9aa3a0', '#b03a2e', '#dc2626', '#f97316', '#d97706',
    '#ca8a04', '#84cc16', '#16a34a', '#14b8a6', '#1d4ed8', '#2563eb',
    '#4f46e5', '#7c3aed', '#a21caf', '#db2777', '#d1e7dd', '#ffffff',
  ];

  const state = {
    settings: {},
    cm: null,
    wysiwyg: null,
    findReplace: null,
    initialHtml: '',
    pendingVisualHtml: null,
    lastEdited: 'source',
    suppressSource: false,
    booting: true,
    dirty: false,
    saveErrorShown: false,
    savedAt: null,
    statusTimer: null,
    baseTitle: 'sin-titulo',
    docTitle: 'sin-titulo',
    titleLocked: false,
    encoding: false,
    autoScroll: true,
    view: 'split',
    split: 50,
    theme: 'light',
    cleanIds: [],
    colors: { text: '#222222', highlight: '#fff3cd' },
    colorTarget: 'text',
    imageData: null,
    history: [],
    future: [],
    scrollLock: null,
    scrollTimer: null,
    statusHint: '',
  };

  /* ---------- Utilidades locales ---------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function nextFrame() {
    return new Promise((resolve) => setTimeout(resolve, 30));
  }

  function hasFiles(event) {
    if (!event || !event.dataTransfer) return false;
    return Array.from(event.dataTransfer.types || []).indexOf('Files') !== -1;
  }

  function loadJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function readSettings() {
    const saved = loadJson(SETTINGS_KEY);
    return saved && typeof saved === 'object' ? saved : {};
  }

  function loadCleanIds() {
    const valid = new Set(App.CLEANING_OPTIONS.map((option) => option.id));
    const stored = loadJson(CLEAN_KEY);
    if (Array.isArray(stored)) return stored.filter((id) => valid.has(id));
    if (Array.isArray(state.settings.cleanIds)) {
      return state.settings.cleanIds.filter((id) => valid.has(id));
    }
    return App.DEFAULT_CLEAN_IDS.slice();
  }

  function loadDraft() {
    const draft = loadJson(DRAFT_KEY);
    if (!draft || typeof draft.html !== 'string') return null;
    return draft;
  }

  function detectTheme() {
    if (state.settings.theme === 'dark' || state.settings.theme === 'light') {
      return state.settings.theme;
    }
    return 'light';
  }

  /* ---------- Código ---------- */

  function setupCodeMirror(initialHtml) {
    const textarea = $('#sourceEditor');
    if (!global.CodeMirror) {
      App.toast('CodeMirror no se ha cargado: revisa la carpeta vendor.', 'error', 8000);
      return;
    }
    state.cm = global.CodeMirror.fromTextArea(textarea, {
      mode: 'htmlmixed',
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      autoCloseTags: true,
      matchTags: { bothTags: true },
      styleActiveLine: true,
      viewportMargin: 30,
      extraKeys: {
        'Ctrl-S': function () { saveDraft(true); },
        'Cmd-S': function () { saveDraft(true); },
        'Shift-Ctrl-K': function () { runClean(); },
        'Shift-Cmd-K': function () { runClean(); },
        'Shift-Ctrl-F': function () { indentCode(); },
        'Shift-Cmd-F': function () { indentCode(); },
        'Alt-Ctrl-D': function () { exportAs('html'); },
        'Alt-Cmd-D': function () { exportAs('html'); },
      },
    });
    state.cm.setValue(initialHtml || '');
    state.cm.clearHistory();

    state.cm.on('change', function () {
      if (state.suppressSource) return;
      syncVisualDebounced.cancel();
      state.lastEdited = 'source';
      markDirty();
      syncSourceDebounced();
      scheduleMeta();
    });

    state.cm.on('cursorActivity', updateCursorPos);
    state.cm.on('scroll', onSourceScroll);
    state.cm.on('focus', function () { state.lastEdited = 'source'; });
  }

  function setSource(html, options) {
    if (!state.cm) return;
    const opts = options || {};
    const info = state.cm.getScrollInfo();
    const cursor = state.cm.getCursor();
    state.suppressSource = true;
    try {
      state.cm.setValue(String(html == null ? '' : html));
    } finally {
      state.suppressSource = false;
    }
    if (opts.preserveScroll !== false) state.cm.scrollTo(null, info.top);
    if (opts.preserveCursor !== false && state.cm.lineCount() > 0) {
      const line = clamp(cursor.line, 0, state.cm.lineCount() - 1);
      state.cm.setCursor({ line: line, ch: Math.min(cursor.ch, state.cm.getLine(line).length) });
    }
    if (!opts.fromVisual) state.lastEdited = 'source';
    updateCursorPos();
  }

  function flushVisualToSource() {
    syncVisualDebounced.cancel();
    if (!state.wysiwyg || !state.wysiwyg.isReady) return;
    if (!state.cm) return;
    if (state.cm.getValue() === state.wysiwyg.getHtml()) return;
    setSource(state.wysiwyg.getHtml(), { fromVisual: true });
  }

  function flushSourceToVisual() {
    syncSourceDebounced.cancel();
    if (!state.wysiwyg || !state.wysiwyg.isReady || !state.cm) return;
    state.wysiwyg.setHtml(state.cm.getValue());
  }

  /* ---------- Editor visual ---------- */

  function setupWysiwyg() {
    state.wysiwyg = App.createWysiwyg($('#visualFrame'), {
      onInput: onVisualInput,
      onSelectionChange: onVisualSelection,
      onScroll: onVisualScroll,
      onDropFiles: handleDroppedFiles,
      onShortcut: onVisualShortcut,
    });

    state.wysiwyg.ready.then(function () {
      const html = state.pendingVisualHtml != null ? state.pendingVisualHtml : (state.cm ? state.cm.getValue() : state.initialHtml);
      state.pendingVisualHtml = null;
      state.wysiwyg.setHtml(html || '');
      updateToolbarState(state.wysiwyg.getState());
      refreshMeta();
    });
  }

  function onVisualInput(html) {
    if (state.booting) return;
    syncSourceDebounced.cancel();
    state.lastEdited = 'visual';
    if (state.encoding) {
      state.encoding = false;
      updateEncodingBtn();
    }
    markDirty();
    syncVisualDebounced(html);
    scheduleMeta();
  }

  function onVisualSelection(info) {
    updateToolbarState(info);
    const note = $('#visualNote');
    if (!note) return;
    note.textContent = info && info.inBody
      ? 'Editando el documento'
      : 'Haz clic en el documento para escribir';
  }

  function onVisualScroll(info) {
    if (!state.autoScroll || !state.cm || state.scrollLock === 'visual') return;
    state.scrollLock = 'source';
    const size = state.cm.getScrollInfo();
    const max = Math.max(0, size.height - size.clientHeight);
    state.cm.scrollTo(null, Math.round(max * (info ? info.ratio : 0)));
    clearTimeout(state.scrollTimer);
    state.scrollTimer = setTimeout(function () { state.scrollLock = null; }, 140);
  }

  function onSourceScroll() {
    if (!state.autoScroll || !state.wysiwyg || !state.wysiwyg.isReady || state.scrollLock === 'source') return;
    const size = state.cm.getScrollInfo();
    const max = Math.max(0, size.height - size.clientHeight);
    const ratio = max > 0 ? size.top / max : 0;
    state.scrollLock = 'visual';
    state.wysiwyg.setScrollRatio(ratio);
    clearTimeout(state.scrollTimer);
    state.scrollTimer = setTimeout(function () { state.scrollLock = null; }, 140);
  }

  function onVisualShortcut(action) {
    if (action === 'save') saveDraft(true);
    else if (action === 'clean') runClean();
    else if (action === 'link') openLinkDialog();
    else if (action === 'indent') indentCode();
    else if (action === 'download') exportAs('html');
    else if (action === 'help') openHelp();
  }

  /* ---------- Documento actual ---------- */

  function getWorkingHtml() {
    if (state.lastEdited === 'visual' && state.wysiwyg && state.wysiwyg.isReady) {
      return state.wysiwyg.getHtml();
    }
    return state.cm ? state.cm.getValue() : '';
  }

  function applyRaw(html, options) {
    const opts = options || {};
    const value = String(html == null ? '' : html);
    setSource(value, { preserveScroll: !opts.resetScroll, preserveCursor: !opts.resetScroll });
    if (state.wysiwyg && state.wysiwyg.isReady) {
      state.wysiwyg.setHtml(value);
      if (opts.resetScroll) state.wysiwyg.setScrollRatio(0);
    } else {
      state.pendingVisualHtml = value;
    }
    state.lastEdited = 'source';
    refreshMeta();
    markDirty();
  }

  function applyTransformation(html, label, options) {
    const before = getWorkingHtml();
    if (html === before) return false;
    pushHistory(label);
    applyRaw(html, options);
    return true;
  }

  function refreshMeta() {
    const html = getWorkingHtml();
    const stats = App.stats(html);
    const words = stats.words;
    const visualCount = $('#visualCount');
    if (visualCount) visualCount.textContent = words.toLocaleString('es-ES') + (words === 1 ? ' palabra' : ' palabras');
    const statsEl = $('#stats');
    if (statsEl) statsEl.textContent = stats.chars.toLocaleString('es-ES') + ' caracteres · ' + words.toLocaleString('es-ES') + ' palabras';
    const charCount = $('#charCount');
    if (charCount) charCount.textContent = stats.chars.toLocaleString('es-ES');
    const size = $('#docSize');
    if (size) size.textContent = App.formatBytes(stats.bytes);
    updateDocTitle(html);
  }

  function updateDocTitle(html) {
    const derived = App.getDocumentTitle(html, state.baseTitle || 'sin-titulo');
    state.docTitle = state.titleLocked
      ? (state.baseTitle || derived || 'Documento')
      : (derived || state.baseTitle || 'Documento');
    const name = $('#fileName');
    if (name) name.textContent = App.slugify(state.docTitle, 'sin-titulo') + '.html';
    document.title = (state.docTitle || 'Documento') + ' · Editor HTML';
  }

  function updateCursorPos() {
    if (!state.cm) return;
    const pos = state.cm.getCursor();
    const el = $('#cursorPos');
    if (el) el.textContent = 'Ln ' + (pos.line + 1) + ', Col ' + (pos.ch + 1);
  }

  /* ---------- Guardado ---------- */

  function markDirty() {
    if (state.booting) return;
    state.dirty = true;
    const dot = $('#dirtyDot');
    if (dot) dot.hidden = false;
    setSaveStatus('dirty', 'Cambios sin guardar');
    scheduleAutoSave();
  }

  function setSaveStatus(kind, text) {
    const el = $('#saveStatus');
    if (!el) return;
    el.classList.toggle('is-saving', kind === 'dirty' || kind === 'saving');
    el.classList.toggle('is-error', kind === 'error');
    let icon = 'i-cloud-check';
    if (kind === 'dirty' || kind === 'saving') icon = 'i-clock';
    if (kind === 'error') icon = 'i-alert';
    el.innerHTML = '<svg class="icon icon--xs" aria-hidden="true"><use href="#' + icon + '"/></svg> ' + App.escapeHtml(text);
  }

  function saveDraft(manual, silent) {
    const html = getWorkingHtml();
    if (html.length > MAX_DRAFT_CHARS) {
      if (!silent) {
        setSaveStatus('error', 'Borrador demasiado grande');
        if (manual || !state.saveErrorShown) {
          App.toast('El documento es demasiado grande para guardarlo como borrador local (máx. 4 MB de código).', 'error', 7000);
          state.saveErrorShown = true;
        }
      }
      return false;
    }

    const payload = {
      html: html,
      title: state.docTitle,
      baseTitle: state.baseTitle,
      titleLocked: state.titleLocked,
      encoding: state.encoding,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      state.savedAt = payload.savedAt;
      state.dirty = false;
      state.saveErrorShown = false;
      const dot = $('#dirtyDot');
      if (dot) dot.hidden = true;
      if (silent) return true;
      if (manual) {
        setSaveStatus('saved', 'Guardado a las ' + App.formatTime(payload.savedAt));
        App.toast('Borrador guardado en este navegador.', 'success');
      } else {
        setSaveStatus('saving', 'Guardando…');
        clearTimeout(state.statusTimer);
        state.statusTimer = setTimeout(function () {
          if (!state.dirty) setSaveStatus('saved', 'Guardado a las ' + App.formatTime(payload.savedAt));
        }, 220);
      }
      return true;
    } catch (error) {
      if (!silent) {
        setSaveStatus('error', 'No se pudo guardar el borrador');
        if (manual || !state.saveErrorShown) {
          App.toast('No se pudo guardar el borrador. Puede que el almacenamiento local esté lleno o bloqueado.', 'error', 7000);
          state.saveErrorShown = true;
        }
      }
      return false;
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        theme: state.theme,
        view: state.view,
        split: state.split,
        autoScroll: state.autoScroll,
        cleanIds: state.cleanIds,
        colors: state.colors,
      }));
    } catch (error) { /* sin persistencia */ }
  }

  function persistCleanIds() {
    try {
      localStorage.setItem(CLEAN_KEY, JSON.stringify(state.cleanIds));
    } catch (error) { /* sin persistencia */ }
    persistSettings();
  }

  /* ---------- Tema, vistas y división ---------- */

  function setTheme(theme, silent) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    const use = $('#themeBtn use');
    if (use) use.setAttribute('href', state.theme === 'dark' ? '#i-sun' : '#i-moon');
    const btn = $('#themeBtn');
    if (btn) btn.title = state.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#06482e' : '#02874d');
    if (!silent) {
      saveSettingsDebounced();
      App.toast(state.theme === 'dark' ? 'Tema oscuro activado.' : 'Tema claro activado.', 'info', 1800);
    }
  }

  function setView(view, silent) {
    if (VIEWS.indexOf(view) === -1) view = 'split';
    if (!silent) {
      if (state.lastEdited === 'visual') flushVisualToSource();
      else flushSourceToVisual();
    }
    state.view = view;
    const workspace = $('#workspace');
    if (workspace) workspace.setAttribute('data-view', view);
    $$('.viewswitch-btn').forEach(function (btn) {
      const active = btn.dataset.view === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (view !== 'source' && state.cm) {
      requestAnimationFrame(function () { state.cm.refresh(); });
    }
    if (!silent) saveSettingsDebounced();
  }

  function applySplit(percent) {
    state.split = clamp(Number(percent) || 50, 20, 80);
    const workspace = $('#workspace');
    if (workspace) workspace.style.setProperty('--split', state.split + '%');
    const splitter = $('#splitter');
    if (splitter) splitter.setAttribute('aria-valuenow', String(Math.round(state.split)));
    saveSettingsDebounced();
  }

  /* ---------- Barra de herramientas ---------- */

  function updateToolbarState(info) {
    if (!info) return;
    $$('.tbtn[data-cmd]').forEach(function (btn) {
      const cmd = btn.dataset.cmd;
      if (Object.prototype.hasOwnProperty.call(info, cmd)) {
        btn.setAttribute('aria-pressed', info[cmd] ? 'true' : 'false');
      }
    });
    const block = $('#blockSelect');
    if (block) {
      const value = String(info.block || '').toLowerCase();
      const has = $$('option', block).some(function (option) { return option.value === value; });
      if (has) block.value = value;
      else if (value === 'div' || value === '') block.value = 'p';
    }
    const linkBtn = $('#linkBtn');
    if (linkBtn) linkBtn.classList.toggle('is-active', !!info.link);
  }

  function updateColors() {
    const textBar = $('#textColorBar');
    if (textBar) textBar.style.background = state.colors.text || '#222222';
    const highlightBar = $('#highlightBar');
    if (highlightBar) highlightBar.style.background = state.colors.highlight || '#fff3cd';
    const custom = $('#colorCustom');
    if (custom) custom.value = state.colors[state.colorTarget] || (state.colorTarget === 'text' ? '#222222' : '#fff3cd');
  }

  function updateEncodingBtn() {
    const btn = $('#encodingBtn');
    if (!btn) return;
    btn.classList.toggle('is-active', state.encoding);
    btn.setAttribute('aria-pressed', state.encoding ? 'true' : 'false');
    btn.title = state.encoding
      ? 'Decodificar entidades HTML y volver a caracteres'
      : 'Convertir caracteres especiales a entidades HTML';
  }

  function setAutoScroll(enabled, silent) {
    state.autoScroll = !!enabled;
    const btn = $('#autoScrollBtn');
    if (btn) {
      btn.classList.toggle('is-active', state.autoScroll);
      btn.setAttribute('aria-pressed', state.autoScroll ? 'true' : 'false');
    }
    if (!silent) {
      saveSettingsDebounced();
      App.toast(state.autoScroll ? 'Desplazamiento sincronizado activado.' : 'Desplazamiento sincronizado desactivado.', 'info', 1800);
    }
  }

  /* ---------- Historial de operaciones ---------- */

  function pushHistory(label) {
    const current = getWorkingHtml();
    const last = state.history[state.history.length - 1];
    if (last && last.html === current) return;
    state.history.push({ html: current, label: label || 'Cambio' });
    if (state.history.length > 40) state.history.shift();
    state.future.length = 0;
    updateHistoryButtons();
  }

  function undoOperation() {
    if (!state.history.length) {
      App.toast('No hay operaciones que deshacer.', 'info', 2000);
      return;
    }
    const entry = state.history.pop();
    state.future.push({ html: getWorkingHtml(), label: entry.label });
    applyRaw(entry.html);
    updateHistoryButtons();
    App.toast('Deshecho: ' + entry.label, 'info', 2200);
  }

  function redoOperation() {
    if (!state.future.length) {
      App.toast('No hay operaciones que rehacer.', 'info', 2000);
      return;
    }
    const entry = state.future.pop();
    state.history.push({ html: getWorkingHtml(), label: entry.label });
    applyRaw(entry.html);
    updateHistoryButtons();
    App.toast('Rehecho: ' + entry.label, 'info', 2200);
  }

  function updateHistoryButtons() {
    const undo = $('#undoBtn');
    if (undo) undo.disabled = state.history.length === 0;
    const redo = $('#redoBtn');
    if (redo) redo.disabled = state.future.length === 0;
  }

  /* ---------- Operaciones sobre el documento ---------- */

  function runClean() {
    setDockOpen(true);
    setDockTab('clean');
    if (!state.cleanIds.length) {
      App.toast('Marca al menos una regla de limpieza.', 'warn');
      return;
    }
    const before = getWorkingHtml();
    let after;
    try {
      after = App.cleanHtml(before, state.cleanIds);
    } catch (error) {
      App.toast('No se pudo limpiar el documento: ' + (error.message || error), 'error', 6000);
      return;
    }
    if (after === before) {
      App.toast('Las reglas marcadas no han cambiado nada.', 'info');
      return;
    }
    state.encoding = false;
    updateEncodingBtn();
    pushHistory('Limpieza');
    applyRaw(after);
    App.toast('Limpieza aplicada con ' + state.cleanIds.length + (state.cleanIds.length === 1 ? ' regla.' : ' reglas.'), 'success');
  }

  function runCleanRule(id) {
    const option = App.CLEANING_OPTIONS.find(function (item) { return item.id === id; });
    if (!option) return;
    const before = getWorkingHtml();
    let after;
    try {
      after = App.cleanOne(before, id);
    } catch (error) {
      App.toast('No se pudo aplicar la regla: ' + (error.message || error), 'error', 6000);
      return;
    }
    if (after === before) {
      App.toast('«' + option.label + '» no ha cambiado nada.', 'info');
      return;
    }
    state.encoding = false;
    updateEncodingBtn();
    pushHistory('Limpieza: ' + option.label);
    applyRaw(after);
    App.toast('Regla aplicada: ' + option.label + '.', 'success');
  }

  function indentCode() {
    const before = getWorkingHtml();
    const after = App.prettyHtml(before);
    if (!after || after === before) {
      App.toast('El código ya está indentado o no hay nada que formatear.', 'info');
      return;
    }
    pushHistory('Indentar código');
    applyRaw(after);
    App.toast('Código indentado.', 'success');
  }

  function compressCode() {
    const before = getWorkingHtml();
    const after = App.compressHtml(before);
    if (!after || after === before) {
      App.toast('El código ya está comprimido o no hay nada que comprimir.', 'info');
      return;
    }
    pushHistory('Comprimir HTML');
    applyRaw(after);
    App.toast('HTML comprimido.', 'success');
  }

  function copyCode() {
    const html = getWorkingHtml();
    if (!html.trim()) {
      App.toast('No hay código que copiar.', 'warn');
      return;
    }
    App.copyText(html).then(function (ok) {
      if (ok) App.toast('Código copiado al portapapeles.', 'success');
      else App.toast('El navegador no ha permitido copiar. Selecciona el código y pulsa Ctrl+C.', 'error', 5000);
    });
  }

  function toggleEncoding() {
    const before = getWorkingHtml();
    if (!before.trim()) {
      App.toast('Escribe algo antes de convertir entidades.', 'warn');
      return;
    }
    const nextOn = !state.encoding;
    const after = nextOn ? App.encodeEntities(before) : App.decodeEntities(before);
    if (after === before) {
      App.toast(nextOn ? 'No hay caracteres especiales que codificar.' : 'No hay entidades que decodificar.', 'info');
      return;
    }
    pushHistory(nextOn ? 'Codificar entidades' : 'Decodificar entidades');
    state.encoding = nextOn;
    applyRaw(after);
    updateEncodingBtn();
    App.toast(nextOn ? 'Caracteres convertidos a entidades HTML.' : 'Entidades HTML decodificadas.', 'success');
  }

  async function confirmReplace(title, message) {
    if (!getWorkingHtml().trim()) return true;
    return App.confirmAction({
      title: title,
      message: message,
      confirmLabel: 'Continuar',
      danger: true,
    });
  }

  async function newDocument() {
    if (!(await confirmReplace('Nueva página', 'Se sustituirá el documento actual por una página en blanco. Esta acción se puede deshacer con el botón de deshacer del código.'))) return;
    pushHistory('Nueva página');
    state.baseTitle = 'sin-titulo';
    state.titleLocked = false;
    state.encoding = false;
    applyRaw('', { resetScroll: true });
    updateEncodingBtn();
    App.toast('Página nueva en blanco.', 'success');
  }

  async function loadDemo() {
    if (!(await confirmReplace('Cargar demostración', 'Se sustituirá el documento actual por el contenido de demostración.'))) return;
    pushHistory('Cargar demostración');
    state.baseTitle = 'sin-titulo';
    state.titleLocked = false;
    state.encoding = false;
    applyRaw(App.DEMO_HTML, { resetScroll: true });
    updateEncodingBtn();
    App.toast('Demostración cargada. Prueba las reglas de limpieza.', 'success', 4500);
  }

  function addLipsum() {
    const current = getWorkingHtml();
    const extra = App.getLipsumHtml();
    const html = current.trim() ? current + extra : extra.trim();
    pushHistory('Añadir Lorem ipsum');
    applyRaw(html);
    App.toast('Se han añadido 5 párrafos de relleno.', 'success');
  }

  /* ---------- Limpieza: interfaz ---------- */

  function buildCleanGrid() {
    const grid = $('#cleanGrid');
    if (!grid) return;
    grid.innerHTML = '';
    App.CLEANING_OPTIONS.forEach(function (option) {
      const on = state.cleanIds.indexOf(option.id) !== -1;
      const chip = document.createElement('div');
      chip.className = 'clean-chip' + (on ? ' is-on' : '');
      chip.dataset.clean = option.id;
      chip.innerHTML = [
        '<input type="checkbox" id="clean-' + option.id + '"' + (on ? ' checked' : '') + '>',
        '<label for="clean-' + option.id + '">',
        '  <span class="clean-name"></span>',
        '  <span class="clean-desc"></span>',
        '</label>',
        '<button type="button" class="run-btn" data-run-clean="' + option.id + '" title="Aplicar solo esta regla" aria-label="Aplicar solo esta regla">',
        '  <svg class="icon" aria-hidden="true"><use href="#i-' + option.icon + '"/></svg>',
        '</button>',
      ].join('');
      chip.querySelector('.clean-name').textContent = option.label;
      chip.querySelector('.clean-desc').textContent = option.desc;
      chip.querySelector('input').addEventListener('change', function (event) {
        toggleCleanId(option.id, event.target.checked);
      });
      chip.querySelector('[data-run-clean]').addEventListener('click', function () {
        runCleanRule(option.id);
      });
      grid.appendChild(chip);
    });
    updateCleanBadge();
  }

  function toggleCleanId(id, on) {
    const index = state.cleanIds.indexOf(id);
    if (on && index === -1) state.cleanIds.push(id);
    if (!on && index !== -1) state.cleanIds.splice(index, 1);
    const chip = $('.clean-chip[data-clean="' + id + '"]');
    if (chip) chip.classList.toggle('is-on', on);
    updateCleanBadge();
    persistCleanIds();
  }

  function updateCleanBadge() {
    const badge = $('#cleanBadge');
    if (badge) badge.textContent = String(state.cleanIds.length);
    const all = state.cleanIds.length === App.CLEANING_OPTIONS.length;
    const toggle = $('#toggleAllClean');
    if (toggle) toggle.textContent = all ? 'Desmarcar todas' : 'Marcar todas';
  }

  function toggleAllClean() {
    const allOn = state.cleanIds.length === App.CLEANING_OPTIONS.length;
    state.cleanIds = allOn ? [] : App.CLEANING_OPTIONS.map(function (option) { return option.id; });
    $$('.clean-chip', $('#cleanGrid')).forEach(function (chip) {
      const on = state.cleanIds.indexOf(chip.dataset.clean) !== -1;
      chip.classList.toggle('is-on', on);
      const input = chip.querySelector('input');
      if (input) input.checked = on;
    });
    updateCleanBadge();
    persistCleanIds();
  }

  function setDockTab(name) {
    $$('.dock-tab').forEach(function (tab) {
      const active = tab.dataset.dock === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.dock-panel').forEach(function (panel) {
      const active = panel.dataset.dockPanel === name;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function setDockOpen(open) {
    const dock = $('#dock');
    if (!dock) return;
    dock.classList.toggle('is-collapsed', !open);
    const toggle = $('#dockToggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Contraer herramientas' : 'Expandir herramientas');
      toggle.title = open ? 'Contraer herramientas' : 'Expandir herramientas';
    }
  }

  /* ---------- Paleta de colores ---------- */

  function buildColorGrid() {
    const grid = $('#colorGrid');
    if (!grid) return;
    grid.innerHTML = '';
    PALETTE.forEach(function (color) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch';
      button.dataset.color = color;
      button.title = color;
      button.setAttribute('aria-label', 'Usar el color ' + color);
      button.style.background = color;
      if (color.toLowerCase() === '#ffffff') {
        button.style.boxShadow = 'inset 0 0 0 1px rgba(0, 0, 0, .18)';
      }
      grid.appendChild(button);
    });
  }

  function openColorPop(target, button) {
    const pop = $('#colorPop');
    if (!pop) return;
    if (!pop.hidden && state.colorTarget === target) {
      closeColorPop();
      return;
    }
    closeDownloadMenu();
    state.colorTarget = target;
    if (state.wysiwyg) state.wysiwyg.saveSelection();
    const title = $('#colorPopTitle');
    if (title) title.textContent = target === 'text' ? 'Color del texto' : 'Color de resaltado';
    pop.hidden = false;
    updateColors();
    const rect = button.getBoundingClientRect();
    const width = pop.offsetWidth || 248;
    const height = pop.offsetHeight || 220;
    pop.style.left = Math.round(clamp(rect.left, 8, global.innerWidth - width - 8)) + 'px';
    const below = rect.bottom + 8;
    pop.style.top = Math.round(below + height > global.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below) + 'px';
    button.setAttribute('aria-expanded', 'true');
    const first = pop.querySelector('.color-swatch');
    if (first) first.focus({ preventScroll: true });
  }

  function closeColorPop() {
    const pop = $('#colorPop');
    if (pop) pop.hidden = true;
    ['#textColorBtn', '#highlightBtn'].forEach(function (selector) {
      const btn = $(selector);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function applyColorChoice(color) {
    if (!state.wysiwyg) return;
    const target = state.colorTarget;
    let value = color;
    if (color === 'clear') value = target === 'text' ? 'inherit' : 'transparent';
    const command = target === 'text' ? 'foreColor' : 'hiliteColor';
    state.wysiwyg.applyColor(value, command);
    if (color === 'clear') {
      if (target === 'text') state.colors.text = '#222222';
      else state.colors.highlight = 'transparent';
    } else {
      state.colors[target] = color;
    }
    updateColors();
    saveSettingsDebounced();
    closeColorPop();
    App.toast(color === 'clear' ? 'Color eliminado.' : 'Color aplicado.', 'success', 1800);
  }

  /* ---------- Diálogos ---------- */

  function getSelectedText() {
    if (!state.wysiwyg || !state.wysiwyg.isReady) return '';
    try {
      const selection = state.wysiwyg.document.getSelection();
      if (!selection || !selection.rangeCount) return '';
      const range = selection.getRangeAt(0);
      if (!state.wysiwyg.body || !state.wysiwyg.body.contains(range.commonAncestorContainer)) {
        if (range.commonAncestorContainer !== state.wysiwyg.body) return '';
      }
      return selection.toString().replace(/\s+/g, ' ').trim();
    } catch (error) {
      return '';
    }
  }

  function safeLinkUrl(raw) {
    let url = String(raw || '').trim();
    if (!url) return '';
    if (/^\s*(javascript|vbscript|data:text\/html)/i.test(url)) return '';
    if (/^(https?:\/\/|mailto:|tel:|#|\/|\.\/|\.\.\/|\?)/i.test(url)) return url;
    if (/^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(url)) return 'https://' + url;
    return url;
  }

  function safeImageUrl(raw) {
    let url = String(raw || '').trim();
    if (!url) return '';
    if (/^data:image\//i.test(url)) return url;
    if (/^\s*(javascript|vbscript|data:text\/html)/i.test(url)) return '';
    if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(url)) return url;
    if (/^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(url)) return 'https://' + url;
    return url;
  }

  function openLinkDialog() {
    if (!state.wysiwyg) return;
    const existing = state.wysiwyg.getLinkElement();
    const selected = getSelectedText();
    state.wysiwyg.saveSelection();
    const dialog = $('#linkDialog');
    if (!dialog) return;
    $('#linkDialogTitle').textContent = existing ? 'Editar enlace' : 'Insertar enlace';
    $('#linkSubmit').textContent = existing ? 'Guardar enlace' : 'Insertar enlace';
    $('#linkText').value = existing ? existing.textContent : selected;
    $('#linkUrl').value = existing ? existing.getAttribute('href') || '' : (selected && /^https?:\/\//i.test(selected) ? selected : '');
    const target = existing ? existing.getAttribute('target') === '_blank' : true;
    $('#linkBlank').checked = target;
    const rel = existing ? existing.getAttribute('rel') || '' : '';
    $('#linkNofollow').checked = /\bnofollow\b/.test(rel);
    $('#linkRemove').hidden = !existing;
    $('#linkError').hidden = true;
    dialog.showModal();
    setTimeout(function () {
      if (existing) $('#linkUrl').focus();
      else if (selected) $('#linkUrl').focus();
      else $('#linkText').focus();
    }, 40);
  }

  function submitLink(event) {
    event.preventDefault();
    const url = safeLinkUrl($('#linkUrl').value);
    if (!url) {
      $('#linkError').hidden = false;
      $('#linkUrl').focus();
      return;
    }
    const text = $('#linkText').value.trim();
    if (state.wysiwyg) {
      state.wysiwyg.restoreSelection();
      state.wysiwyg.insertLink({
        url: url,
        text: text || url,
        target: $('#linkBlank').checked,
        nofollow: $('#linkNofollow').checked,
      });
    }
    $('#linkDialog').close();
    App.toast('Enlace guardado.', 'success');
  }

  function openImageDialog() {
    if (!state.wysiwyg) return;
    state.wysiwyg.saveSelection();
    state.imageData = null;
    $('#imageUrl').value = '';
    $('#imageAlt').value = '';
    $('#imageWidth').value = '';
    $('#imageNewTab').checked = false;
    $('#imageFile').value = '';
    $('#imageFileName').textContent = 'Elegir imagen…';
    $('#imagePreview').hidden = true;
    $('#imagePreviewImg').removeAttribute('src');
    $('#imageError').hidden = true;
    const dialog = $('#imageDialog');
    if (dialog) dialog.showModal();
    setTimeout(function () { $('#imageUrl').focus(); }, 40);
  }

  function showImagePreview(src) {
    const box = $('#imagePreview');
    const img = $('#imagePreviewImg');
    if (!box || !img) return;
    if (!src) {
      box.hidden = true;
      img.removeAttribute('src');
      return;
    }
    img.src = src;
    box.hidden = false;
  }

  function submitImage(event) {
    event.preventDefault();
    const src = state.imageData || safeImageUrl($('#imageUrl').value);
    if (!src) {
      $('#imageError').hidden = false;
      $('#imageUrl').focus();
      return;
    }
    const width = Number($('#imageWidth').value);
    if (state.wysiwyg) {
      state.wysiwyg.restoreSelection();
      state.wysiwyg.insertImage({
        src: src,
        alt: $('#imageAlt').value.trim(),
        width: width > 0 ? Math.min(4000, Math.round(width)) : null,
        link: $('#imageNewTab').checked,
      });
    }
    $('#imageDialog').close();
    App.toast(src.indexOf('data:') === 0 ? 'Imagen incrustada en el documento.' : 'Imagen insertada.', 'success');
  }

  function openTableDialog() {
    if (!state.wysiwyg) return;
    state.wysiwyg.saveSelection();
    const dialog = $('#tableDialog');
    if (dialog) dialog.showModal();
    setTimeout(function () { $('#tableRows').focus(); }, 40);
  }

  function submitTable(event) {
    event.preventDefault();
    const rows = clamp(Number($('#tableRows').value) || 1, 1, 30);
    const cols = clamp(Number($('#tableCols').value) || 1, 1, 12);
    if (state.wysiwyg) {
      state.wysiwyg.restoreSelection();
      state.wysiwyg.insertTable(rows, cols, $('#tableHeader').checked, $('#tableBorder').checked);
    }
    $('#tableDialog').close();
    App.toast('Tabla insertada.', 'success');
  }

  function openHelp() {
    const dialog = $('#helpDialog');
    if (dialog) dialog.showModal();
  }

  /* ---------- Descargas ---------- */

  function closeDownloadMenu() {
    const menu = $('#downloadMenu');
    if (!menu) return;
    menu.hidden = true;
    const btn = $('#downloadBtn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleDownloadMenu() {
    const menu = $('#downloadMenu');
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    const btn = $('#downloadBtn');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) closeColorPop();
  }

  async function exportAs(kind) {
    closeDownloadMenu();
    if (state.lastEdited === 'visual') flushVisualToSource();
    const html = getWorkingHtml();
    if (!html.trim()) {
      App.toast('El documento está vacío. Escribe algo antes de descargar.', 'warn');
      return;
    }
    App.setBusy(true, kind === 'docx' ? 'Generando el documento de Word…' : 'Preparando la descarga…');
    try {
      await nextFrame();
      if (kind === 'docx') {
        const result = await App.Files.downloadDocx(html, state.docTitle);
        App.toast('Documento de Word descargado: ' + result.filename, 'success', 5000);
      } else {
        const result = await App.Files.downloadHtml(html, { title: state.docTitle, forceZip: kind === 'zip' });
        if (result.zipped) {
          App.toast('ZIP descargado con ' + result.images + (result.images === 1 ? ' imagen.' : ' imágenes.'), 'success', 5000);
        } else {
          App.toast('HTML descargado: ' + result.filename, 'success', 5000);
        }
      }
    } catch (error) {
      App.toast(error && error.message ? error.message : 'No se pudo descargar el archivo.', 'error', 7000);
    } finally {
      App.setBusy(false);
    }
  }

  /* ---------- Archivos ---------- */

  async function handleFile(file) {
    if (!file) return;
    if (!(await confirmReplace('Abrir archivo', 'Se sustituirá el documento actual por el contenido de «' + file.name + '».'))) return;
    App.setBusy(true, 'Abriendo ' + file.name + '…');
    try {
      await nextFrame();
      const result = await App.Files.readFile(file);
      pushHistory('Abrir archivo');
      state.baseTitle = result.title || App.Files.fileTitle(file.name);
      state.titleLocked = true;
      state.encoding = false;
      applyRaw(result.html, { resetScroll: true });
      updateEncodingBtn();
      if (result.notes && result.notes.length) App.toast(result.notes[0], 'success', 5500);
      else App.toast('Archivo abierto: ' + file.name, 'success');
    } catch (error) {
      App.toast(error && error.message ? error.message : 'No se pudo abrir el archivo.', 'error', 7000);
    } finally {
      App.setBusy(false);
    }
  }

  function handleDroppedFiles(files) {
    if (!files || !files.length) return;
    handleFile(files[0]);
  }

  /* ---------- Eventos de la interfaz ---------- */

  function bindTopbar() {
    $$('.viewswitch-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setView(btn.dataset.view); });
    });

    const openBtn = $('#openBtn');
    if (openBtn) openBtn.addEventListener('click', function () { $('#fileInput').click(); });

    const fileInput = $('#fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function (event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (file) handleFile(file);
      });
    }

    const demoBtn = $('#demoBtn');
    if (demoBtn) demoBtn.addEventListener('click', loadDemo);

    const downloadBtn = $('#downloadBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleDownloadMenu();
      });
    }

    const downloadMenu = $('#downloadMenu');
    if (downloadMenu) {
      downloadMenu.addEventListener('click', function (event) {
        const item = event.target.closest('[data-export]');
        if (item) exportAs(item.dataset.export);
      });
    }

    const themeBtn = $('#themeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        setTheme(state.theme === 'dark' ? 'light' : 'dark');
      });
    }

    const helpBtn = $('#helpBtn');
    if (helpBtn) helpBtn.addEventListener('click', openHelp);
  }

  function bindSourceActions() {
    const undo = $('#undoBtn');
    if (undo) undo.addEventListener('click', undoOperation);
    const redo = $('#redoBtn');
    if (redo) redo.addEventListener('click', redoOperation);
    const newBtn = $('#newBtn');
    if (newBtn) newBtn.addEventListener('click', newDocument);
    const lipsum = $('#lipsumBtn');
    if (lipsum) lipsum.addEventListener('click', addLipsum);
    const encoding = $('#encodingBtn');
    if (encoding) encoding.addEventListener('click', toggleEncoding);
    const autoScroll = $('#autoScrollBtn');
    if (autoScroll) autoScroll.addEventListener('click', function () { setAutoScroll(!state.autoScroll); });
    const indent = $('#indentBtn');
    if (indent) indent.addEventListener('click', indentCode);
    const compress = $('#compressBtn');
    if (compress) compress.addEventListener('click', compressCode);
    const copy = $('#copyBtn');
    if (copy) copy.addEventListener('click', copyCode);
  }

  function bindToolbar() {
    const toolbar = $('#formatToolbar');
    if (toolbar) {
      toolbar.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-cmd]');
        if (!button || !state.wysiwyg) return;
        state.wysiwyg.exec(button.dataset.cmd);
        updateToolbarState(state.wysiwyg.getState());
      });
    }

    const block = $('#blockSelect');
    if (block) {
      block.addEventListener('change', function () {
        if (state.wysiwyg && block.value) state.wysiwyg.setBlock(block.value);
      });
    }

    const font = $('#fontSelect');
    if (font) {
      font.addEventListener('change', function () {
        if (state.wysiwyg && font.value) state.wysiwyg.setFontFamily(font.value);
        font.value = '';
      });
    }

    const size = $('#sizeSelect');
    if (size) {
      size.addEventListener('change', function () {
        if (state.wysiwyg && size.value) state.wysiwyg.setFontSize(size.value);
        size.value = '';
      });
    }

    const link = $('#linkBtn');
    if (link) link.addEventListener('click', openLinkDialog);
    const image = $('#imageBtn');
    if (image) image.addEventListener('click', openImageDialog);
    const table = $('#tableBtn');
    if (table) table.addEventListener('click', openTableDialog);
    const hr = $('#hrBtn');
    if (hr) {
      hr.addEventListener('click', function () {
        if (state.wysiwyg) state.wysiwyg.insertHtml('<hr><p><br></p>');
      });
    }
    const clear = $('#clearFormatBtn');
    if (clear) {
      clear.addEventListener('click', function () {
        if (state.wysiwyg) state.wysiwyg.clearFormatting();
      });
    }
    const fullscreen = $('#fullscreenBtn');
    if (fullscreen) fullscreen.addEventListener('click', function () { toggleFocusMode(); });
  }

  function bindColors() {
    const textBtn = $('#textColorBtn');
    if (textBtn) textBtn.addEventListener('click', function (event) { event.stopPropagation(); openColorPop('text', textBtn); });
    const highlightBtn = $('#highlightBtn');
    if (highlightBtn) highlightBtn.addEventListener('click', function (event) { event.stopPropagation(); openColorPop('highlight', highlightBtn); });

    const close = $('#colorPopClose');
    if (close) close.addEventListener('click', closeColorPop);

    const grid = $('#colorGrid');
    if (grid) {
      grid.addEventListener('click', function (event) {
        const swatch = event.target.closest('[data-color]');
        if (swatch) applyColorChoice(swatch.dataset.color);
      });
    }

    const custom = $('#colorCustom');
    if (custom) {
      custom.addEventListener('change', function () { applyColorChoice(custom.value); });
    }

    const clear = $('#colorClear');
    if (clear) clear.addEventListener('click', function () { applyColorChoice('clear'); });
  }

  function bindDialogs() {
    ['#linkDialog', '#imageDialog', '#tableDialog', '#helpDialog', '#confirmDialog'].forEach(function (selector) {
      App.wireDialogClose($(selector));
    });

    const linkForm = $('#linkForm');
    if (linkForm) linkForm.addEventListener('submit', submitLink);
    const linkRemove = $('#linkRemove');
    if (linkRemove) {
      linkRemove.addEventListener('click', function () {
        if (state.wysiwyg) {
          state.wysiwyg.restoreSelection();
          state.wysiwyg.removeLink();
        }
        $('#linkDialog').close();
        App.toast('Enlace eliminado.', 'success');
      });
    }

    const imageForm = $('#imageForm');
    if (imageForm) imageForm.addEventListener('submit', submitImage);

    const imageFile = $('#imageFile');
    if (imageFile) {
      imageFile.addEventListener('change', function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!/^image\//i.test(file.type)) {
          App.toast('El archivo elegido no es una imagen.', 'error');
          event.target.value = '';
          return;
        }
        if (file.size > 4 * 1024 * 1024) {
          App.toast('La imagen supera los 4 MB. Usa una imagen más ligera o una URL.', 'warn', 5000);
          event.target.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = function () {
          state.imageData = String(reader.result || '');
          $('#imageFileName').textContent = file.name;
          $('#imageUrl').value = '';
          $('#imageError').hidden = true;
          showImagePreview(state.imageData);
        };
        reader.onerror = function () {
          App.toast('No se pudo leer la imagen.', 'error');
        };
        reader.readAsDataURL(file);
      });
    }

    const imageUrl = $('#imageUrl');
    if (imageUrl) {
      imageUrl.addEventListener('input', function () {
        const value = imageUrl.value.trim();
        if (value) {
          state.imageData = null;
          showImagePreview(safeImageUrl(value));
          $('#imagePreview').hidden = !safeImageUrl(value);
        } else if (!state.imageData) {
          showImagePreview('');
        }
      });
    }

    const previewImg = $('#imagePreviewImg');
    if (previewImg) {
      previewImg.addEventListener('error', function () {
        $('#imagePreview').hidden = true;
      });
    }

    const tableForm = $('#tableForm');
    if (tableForm) tableForm.addEventListener('submit', submitTable);
  }

  function bindDock() {
    $$('.dock-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        setDockTab(tab.dataset.dock);
        setDockOpen(true);
      });
    });

    const toggle = $('#dockToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        const dock = $('#dock');
        setDockOpen(dock ? dock.classList.contains('is-collapsed') : true);
      });
    }

    const cleanBtn = $('#cleanBtn');
    if (cleanBtn) cleanBtn.addEventListener('click', runClean);
    const all = $('#toggleAllClean');
    if (all) all.addEventListener('click', toggleAllClean);
  }

  function bindSplitter() {
    const splitter = $('#splitter');
    const workspace = $('#workspace');
    if (!splitter || !workspace) return;
    let dragging = false;

    function move(event) {
      const rect = workspace.getBoundingClientRect();
      if (!rect.width) return;
      const percent = ((event.clientX - rect.left) / rect.width) * 100;
      state.split = clamp(percent, 20, 80);
      workspace.style.setProperty('--split', state.split + '%');
      splitter.setAttribute('aria-valuenow', String(Math.round(state.split)));
    }

    function end() {
      if (!dragging) return;
      dragging = false;
      splitter.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing');
      saveSettingsDebounced();
      if (state.cm) state.cm.refresh();
    }

    splitter.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      dragging = true;
      splitter.classList.add('is-dragging');
      document.body.classList.add('is-resizing');
      try { splitter.setPointerCapture(event.pointerId); } catch (error) { /* ignorar */ }
      move(event);
    });

    window.addEventListener('pointermove', function (event) {
      if (dragging) move(event);
    });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    splitter.addEventListener('dblclick', function () {
      applySplit(50);
      if (state.cm) state.cm.refresh();
    });

    splitter.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        applySplit(state.split + (event.key === 'ArrowLeft' ? -2 : 2));
        if (state.cm) state.cm.refresh();
      } else if (event.key === 'Home') {
        event.preventDefault();
        applySplit(50);
        if (state.cm) state.cm.refresh();
      }
    });
  }

  function bindDropzone() {
    const overlay = $('#dropOverlay');
    let depth = 0;

    window.addEventListener('dragenter', function (event) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      if (overlay) overlay.hidden = false;
    });

    window.addEventListener('dragover', function (event) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('dragleave', function (event) {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (!depth && overlay) overlay.hidden = true;
    });

    window.addEventListener('drop', function (event) {
      const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
      if (!files.length) return;
      event.preventDefault();
      depth = 0;
      if (overlay) overlay.hidden = true;
      handleFile(files[0]);
    });
  }

  function bindShortcuts() {
    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented) return;

      if (event.key === 'Escape') {
        const pop = $('#colorPop');
        if (pop && !pop.hidden) {
          closeColorPop();
          return;
        }
        const menu = $('#downloadMenu');
        if (menu && !menu.hidden) {
          closeDownloadMenu();
          return;
        }
        if (document.querySelector('dialog[open]')) return;
        if (document.body.classList.contains('focus-mode')) {
          toggleFocusMode(false);
          return;
        }
      }

      if (event.key === 'F1') {
        event.preventDefault();
        openHelp();
        return;
      }

      const mod = App.isMac ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      const key = String(event.key || '').toLowerCase();

      if (key === 's' && !event.shiftKey) {
        event.preventDefault();
        saveDraft(true);
      } else if (key === 'k' && event.shiftKey) {
        event.preventDefault();
        runClean();
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        indentCode();
      } else if (key === 'd' && event.altKey) {
        event.preventDefault();
        exportAs('html');
      } else if (key === 'k' && !event.altKey) {
        event.preventDefault();
        openLinkDialog();
      }
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.menu-anchor')) closeDownloadMenu();
      if (!event.target.closest('#colorPop') && !event.target.closest('#textColorBtn') && !event.target.closest('#highlightBtn')) {
        closeColorPop();
      }
    });
  }

  let previousView = null;

  function toggleFocusMode(force) {
    const on = typeof force === 'boolean' ? force : !document.body.classList.contains('focus-mode');
    if (on) {
      previousView = state.view;
      if (state.view !== 'visual') setView('visual');
      App.toast('Modo enfoque activado. Pulsa Esc para salir.', 'info', 2600);
    } else if (previousView) {
      setView(previousView);
      previousView = null;
    }
    document.body.classList.toggle('focus-mode', on);
    const btn = $('#fullscreenBtn');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (!on && state.cm) requestAnimationFrame(function () { state.cm.refresh(); });
  }

  function bindLifecycle() {
    window.addEventListener('beforeunload', function () {
      if (state.dirty) saveDraft(false, true);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && state.dirty) saveDraft(false, true);
    });

    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (state.cm) state.cm.refresh();
        closeColorPop();
      }, 180);
    });
  }

  function setupFindReplace() {
    state.findReplace = App.createFindReplace({
      rowsEl: $('#frRows'),
      addBtn: $('#frAdd'),
      applyAllBtn: $('#frApplyAll'),
      countEl: $('#frCount'),
      getHtml: getWorkingHtml,
      onApply: function (html, count, label) {
        if (html === getWorkingHtml()) return;
        setDockOpen(true);
        setDockTab('find');
        pushHistory(label || 'Buscar y reemplazar');
        applyRaw(html);
        App.toast((label || 'Buscar y reemplazar') + ': ' + count + (count === 1 ? ' cambio aplicado.' : ' cambios aplicados.'), 'success');
      },
    });
  }

  /* ---------- Arranque ---------- */

  const syncVisualDebounced = App.debounce(function (html) {
    if (!state.cm || !state.wysiwyg || !state.wysiwyg.isReady) return;
    if (state.cm.getValue() === html) return;
    setSource(html, { fromVisual: true });
  }, 320);

  const syncSourceDebounced = App.debounce(function () {
    if (!state.wysiwyg || !state.wysiwyg.isReady) return;
    state.wysiwyg.setHtml(state.cm ? state.cm.getValue() : '');
  }, 260);

  const scheduleMeta = App.debounce(refreshMeta, 260);
  const scheduleAutoSave = App.debounce(function () { saveDraft(false, false); }, 900);
  const saveSettingsDebounced = App.debounce(persistSettings, 400);

  function init() {
    state.settings = readSettings();
    state.theme = detectTheme();
    const creditYear = document.querySelector('#creditYear');
    if (creditYear) creditYear.textContent = String(new Date().getFullYear());
    state.view = VIEWS.indexOf(state.settings.view) !== -1 ? state.settings.view : 'split';
    state.split = clamp(Number(state.settings.split) || 50, 20, 80);
    state.autoScroll = state.settings.autoScroll !== false;
    state.cleanIds = loadCleanIds();
    if (state.settings.colors && typeof state.settings.colors === 'object') {
      if (typeof state.settings.colors.text === 'string') state.colors.text = state.settings.colors.text;
      if (typeof state.settings.colors.highlight === 'string') state.colors.highlight = state.settings.colors.highlight;
    }

    const draft = loadDraft();
    state.initialHtml = draft ? draft.html : App.DEMO_HTML;
    if (draft) {
      state.baseTitle = draft.baseTitle || draft.title || 'sin-titulo';
      state.titleLocked = !!draft.titleLocked;
      state.encoding = !!draft.encoding;
      state.docTitle = typeof draft.title === 'string' ? draft.title : '';
      state.savedAt = draft.savedAt || null;
    }

    setTheme(state.theme, true);
    applySplit(state.split);
    setupCodeMirror(state.initialHtml);
    setupWysiwyg();
    buildCleanGrid();
    setupFindReplace();

    bindTopbar();
    bindSourceActions();
    bindToolbar();
    bindDock();
    bindDialogs();
    bindColors();
    bindSplitter();
    bindDropzone();
    bindShortcuts();
    bindLifecycle();

    buildColorGrid();
    updateColors();
    updateEncodingBtn();
    setAutoScroll(state.autoScroll, true);
    setView(state.view, true);
    setDockOpen(true);
    setDockTab('clean');
    updateHistoryButtons();
    refreshMeta();
    updateCursorPos();
    state.booting = false;

    if (draft) {
      setSaveStatus('saved', draft.savedAt ? 'Borrador guardado a las ' + App.formatTime(draft.savedAt) : 'Borrador restaurado');
      if (draft.savedAt) App.toast('Borrador local restaurado.', 'info', 3200);
    } else {
      setSaveStatus('saved', 'Guardado local');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
