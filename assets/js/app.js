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
    compressed: false,
    autoScroll: true,
    view: 'split',
    split: 50,
    cleanIds: [],
    colors: { text: '#222222', highlight: '#fff3cd' },
    colorTarget: 'text',
    print: { size: 'a4', orientation: 'portrait', margins: 'normal' },
    spellcheck: true,
    codeLang: 'html',
    mdKeepHtml: true,
    mdEditor: null,
    initialMd: null,
    mdValue: '',
    mdStale: true,
    suppressMd: false,
    applyingMarkdown: false,
    imageData: null,
    imageEditing: null,
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

  function normalizeHex(value) {
    let raw = String(value == null ? '' : value).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(raw)) {
      raw = raw.split('').map(function (char) { return char + char; }).join('');
    }
    if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
    return '#' + raw.toLowerCase();
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
      state.compressed = false;
      cancelVisualSync();
      state.lastEdited = 'source';
      markDirty();
      syncSourceDebounced();
      markMarkdownStale();
      scheduleMeta();
    });

    state.cm.on('cursorActivity', updateCursorPos);
    state.cm.on('scroll', onSourceScroll);
    state.cm.on('focus', function () { state.lastEdited = 'source'; });
    state.cm.on('paste', function () {
      setTimeout(autoFormatSource, 60);
    });
    state.cm.on('blur', function () {
      autoFormatSource();
    });
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
    updateCharPill();
  }

  const FORMAT_MAX_CHARS = 400000;

  function formatHtml(html) {
    const value = String(html == null ? '' : html);
    if (!value.trim() || value.length > FORMAT_MAX_CHARS) return value;
    const pretty = App.prettyHtml(value);
    return pretty || value;
  }

  function autoFormatSource() {
    if (!state.cm || state.compressed) return false;
    const current = state.cm.getValue();
    if (!current.trim() || current.length > FORMAT_MAX_CHARS) return false;
    const pretty = App.prettyHtml(current);
    if (!pretty || pretty === current) return false;
    setSource(pretty, { fromVisual: state.lastEdited === 'visual' });
    return true;
  }

  function flushVisualToSource() {
    cancelVisualSync();
    if (!state.wysiwyg || !state.wysiwyg.isReady) return;
    if (!state.cm) return;
    const value = formatHtml(state.wysiwyg.getHtml());
    if (state.cm.getValue() === value) return;
    if (state.compressed) state.compressed = false;
    setSource(value, { fromVisual: true });
    markMarkdownStale();
    visualSyncLast = Date.now();
  }

  function flushSourceToVisual() {
    syncSourceDebounced.cancel();
    if (!state.wysiwyg || !state.wysiwyg.isReady || !state.cm) return;
    state.wysiwyg.setHtml(state.cm.getValue());
  }

  /* ---------- Panel de código Markdown ---------- */

  function markdownReady() {
    return !!(state.mdEditor && App.Markdown && App.Markdown.available);
  }

  function markdownActive() {
    return state.codeLang === 'md';
  }

  function updateCharPill() {
    const pill = $('#charCount');
    if (!pill) return;
    if (markdownActive() && state.mdEditor) {
      pill.textContent = state.mdEditor.getValue().length.toLocaleString('es-ES');
      pill.title = 'Caracteres en el Markdown';
    } else if (state.cm) {
      pill.textContent = state.cm.getValue().length.toLocaleString('es-ES');
      pill.title = 'Caracteres en el código';
    }
  }

  function markMarkdownStale() {
    if (!markdownReady()) return;
    state.mdStale = true;
    if (markdownActive()) scheduleMarkdownRefresh();
  }

  function refreshMarkdown(force) {
    if (!markdownReady()) return;
    if (!force && !state.mdStale) return;
    if (state.applyingMarkdown) return;
    const html = state.cm ? state.cm.getValue() : '';
    const markdown = App.Markdown.toMarkdown(html, { keepHtml: state.mdKeepHtml });
    state.mdValue = markdown;
    state.mdStale = false;
    const info = state.mdEditor.getScrollInfo();
    state.suppressMd = true;
    try { state.mdEditor.setValue(markdown); } finally { state.suppressMd = false; }
    state.mdEditor.scrollTo(null, info.top);
  }

  function applyMarkdown(markdown) {
    if (!state.wysiwyg || !state.wysiwyg.isReady) return;
    const html = App.Markdown.toHtml(markdown);
    const value = formatHtml(html || '');
    state.applyingMarkdown = true;
    try {
      state.mdValue = markdown;
      state.mdStale = false;
      if (state.compressed) state.compressed = false;
      state.lastEdited = 'source';
      state.suppressSource = true;
      try {
        if (state.cm && state.cm.getValue() !== value) state.cm.setValue(value);
      } finally {
        state.suppressSource = false;
      }
      cancelVisualSync();
      state.wysiwyg.setHtml(value);
      updateCursorPos();
      updateCharPill();
    } finally {
      state.applyingMarkdown = false;
    }
    markDirty();
    refreshMeta();
    scheduleMeta();
  }

  const applyMarkdownDebounced = App.debounce(function () {
    if (!markdownActive() || !state.mdEditor) return;
    const markdown = state.mdEditor.getValue();
    if (markdown === state.mdValue) return;
    applyMarkdown(markdown);
  }, 180);

  const scheduleMarkdownRefresh = App.debounce(function () {
    if (markdownActive()) refreshMarkdown(true);
  }, 220);

  function setCodeLang(lang, silent) {
    applyMarkdownDebounced.flush();
    const next = lang === 'md' && markdownReady() ? 'md' : 'html';
    if (next === state.codeLang && !silent) {
      if (next === 'md' && state.mdStale) refreshMarkdown(true);
      return;
    }
    state.codeLang = next;
    if (next === 'md') {
      applyMarkdownDebounced.flush();
      refreshMarkdown(state.mdStale);
    }
    const pane = $('#sourcePane');
    if (pane) pane.classList.toggle('is-md', next === 'md');
    const cmWrap = $('#cmWrap');
    const mdWrap = $('#mdWrap');
    if (cmWrap) cmWrap.hidden = next === 'md';
    if (mdWrap) mdWrap.hidden = next !== 'md';
    $$('.langswitch-btn').forEach(function (button) {
      const active = button.dataset.lang === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const keep = $('#mdKeepBtn');
    if (keep) {
      keep.hidden = next !== 'md';
      keep.classList.toggle('is-active', state.mdKeepHtml);
      keep.setAttribute('aria-pressed', state.mdKeepHtml ? 'true' : 'false');
    }
    const ext = document.querySelector('.file-ext');
    if (ext) ext.textContent = next === 'md' ? '.md' : '.html';
    updateCharPill();
    updateHistoryButtons();
    const editor = next === 'md' ? state.mdEditor : state.cm;
    if (editor) {
      requestAnimationFrame(function () {
        editor.refresh();
        if (!silent) editor.focus();
      });
    }
    updateCursorPos();
    if (!silent) {
      saveSettingsDebounced();
      scheduleAutoSave();
    }
  }

  function setMdKeep(on, silent) {
    state.mdKeepHtml = on !== false;
    const button = $('#mdKeepBtn');
    if (button) {
      button.classList.toggle('is-active', state.mdKeepHtml);
      button.setAttribute('aria-pressed', state.mdKeepHtml ? 'true' : 'false');
      button.title = state.mdKeepHtml
        ? 'HTML incrustado activado: lo que Markdown no representa se conserva tal cual'
        : 'HTML incrustado desactivado: el Markdown queda limpio y sin estilos';
    }
    if (!silent) {
      applyMarkdownDebounced.flush();
      refreshMarkdown(true);
      persistSettings();
      App.toast(state.mdKeepHtml
        ? 'Markdown con HTML incrustado: no se pierde ningún estilo.'
        : 'Markdown limpio: los estilos que Markdown no admite se descartan.', 'info', 3200);
    }
  }

  function setupMarkdownEditor(initialMarkdown) {
    if (!App.Markdown || !App.Markdown.available || !global.CodeMirror) return;
    const textarea = $('#mdEditor');
    if (!textarea) return;
    state.mdEditor = global.CodeMirror.fromTextArea(textarea, {
      mode: 'markdown',
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      styleActiveLine: true,
      viewportMargin: 30,
      extraKeys: {
        'Ctrl-S': function () { saveDraft(true); },
        'Cmd-S': function () { saveDraft(true); },
        'Shift-Ctrl-F': function () { exportAs('html'); },
        'Shift-Cmd-F': function () { exportAs('html'); },
      },
    });
    state.mdEditor.setValue(initialMarkdown || '');
    state.mdEditor.clearHistory();
    state.mdEditor.on('change', function () {
      if (state.suppressMd) return;
      state.lastEdited = 'source';
      markDirty();
      updateCharPill();
      applyMarkdownDebounced();
    });
    state.mdEditor.on('focus', function () { state.lastEdited = 'source'; });
    state.mdEditor.on('cursorActivity', updateCursorPos);
    state.mdEditor.on('scroll', onSourceScroll);
    state.mdStale = false;
  }

  function bindMarkdownSwitch() {
    $$('.langswitch-btn').forEach(function (button) {
      button.addEventListener('click', function () { setCodeLang(button.dataset.lang); });
    });
    const keep = $('#mdKeepBtn');
    if (keep) keep.addEventListener('click', function () { setMdKeep(!state.mdKeepHtml); });
  }

  /* ---------- Editor visual ---------- */

  function setupWysiwyg() {
    state.wysiwyg = App.createWysiwyg($('#visualFrame'), {
      onInput: onVisualInput,
      onSelectionChange: onVisualSelection,
      onScroll: onVisualScroll,
      onDropFiles: handleDroppedFiles,
      onShortcut: onVisualShortcut,
      onEditImage: function (img) { openImageDialog(img); },
    });

    state.wysiwyg.ready.then(function () {
      const html = state.pendingVisualHtml != null ? state.pendingVisualHtml : (state.cm ? state.cm.getValue() : state.initialHtml);
      state.pendingVisualHtml = null;
      state.wysiwyg.setHtml(html || '');
      state.wysiwyg.setSpellcheck(state.spellcheck);
      updateToolbarState(state.wysiwyg.getState());
      refreshMeta();
      if (state.wysiwyg.document) {
        state.wysiwyg.document.addEventListener('pointerdown', closeAllSelectMenus);
      }
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
    scheduleVisualSync(html);
    scheduleMeta();
  }

  function onVisualSelection(info) {
    updateToolbarState(info);
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
    const editor = activeSourceEditor();
    if (!state.autoScroll || !state.wysiwyg || !state.wysiwyg.isReady || state.scrollLock === 'source' || !editor) return;
    const size = editor.getScrollInfo();
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
    else if (action === 'print') openPrintDialog();
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
    let value = String(html == null ? '' : html);
    if (opts.format !== false) value = formatHtml(value);
    setSource(value, { preserveScroll: !opts.resetScroll, preserveCursor: !opts.resetScroll });
    if (state.wysiwyg && state.wysiwyg.isReady) {
      state.wysiwyg.setHtml(value);
      if (opts.resetScroll) state.wysiwyg.setScrollRatio(0);
    } else {
      state.pendingVisualHtml = value;
    }
    state.lastEdited = 'source';
    markMarkdownStale();
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
    const statsEl = $('#stats');
    if (statsEl) statsEl.textContent = stats.chars.toLocaleString('es-ES') + ' caracteres · ' + words.toLocaleString('es-ES') + ' palabras';
    const charCount = $('#charCount');
    if (charCount) charCount.textContent = stats.chars.toLocaleString('es-ES');
    const size = $('#docSize');
    if (size) size.textContent = App.formatBytes(stats.bytes);
    updateDocTitle(html);
  }

  function sizeFileNameInput(input) {
    if (!input) return;
    const length = String(input.value || '').length;
    // El ancho real de un carácter puede superar 1ch según la fuente monoespaciada
    input.style.width = Math.max(8, Math.min(44, length + 1.5)) + 'ch';
  }

  function updateDocTitle(html) {
    const derived = App.getDocumentTitle(html, state.baseTitle || 'sin-titulo');
    state.docTitle = state.titleLocked
      ? (state.baseTitle || derived || 'Documento')
      : (derived || state.baseTitle || 'Documento');
    const name = $('#fileName');
    if (name && document.activeElement !== name) {
      name.value = state.titleLocked ? state.docTitle : App.slugify(state.docTitle, 'sin-titulo');
      sizeFileNameInput(name);
    }
    const ext = document.querySelector('.file-ext');
    if (ext) ext.textContent = state.codeLang === 'md' ? '.md' : '.html';
    document.title = (state.docTitle || 'Documento') + ' · Editor WYSIWYG';
  }

  function activeSourceEditor() {
    return state.codeLang === 'md' && state.mdEditor ? state.mdEditor : state.cm;
  }

  function updateCursorPos() {
    const editor = activeSourceEditor();
    if (!editor) return;
    const pos = editor.getCursor();
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
      compressed: state.compressed,
      md: state.mdValue,
      mdStale: state.mdStale,
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
        view: state.view,
        split: state.split,
        autoScroll: state.autoScroll,
        cleanIds: state.cleanIds,
        colors: state.colors,
        spellcheck: state.spellcheck,
        print: state.print,
        codeLang: state.codeLang,
        mdKeepHtml: state.mdKeepHtml,
      }));
    } catch (error) { /* sin persistencia */ }
  }

  function persistCleanIds() {
    try {
      localStorage.setItem(CLEAN_KEY, JSON.stringify(state.cleanIds));
    } catch (error) { /* sin persistencia */ }
    persistSettings();
  }

  /* ---------- Vistas y división ---------- */

  function setView(view, silent) {
    if (VIEWS.indexOf(view) === -1) view = 'split';
    closeAllSelectMenus();
    closeEmojiPop();
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

  /* ---------- Desplegables con vista previa ---------- */

  const BLOCK_PREVIEW = {
    p: { size: 16, weight: 400, meta: 'P' },
    h1: { size: 34, weight: 700, meta: 'H1' },
    h2: { size: 26, weight: 700, meta: 'H2' },
    h3: { size: 21, weight: 700, meta: 'H3' },
    h4: { size: 18, weight: 700, meta: 'H4' },
    h5: { size: 16, weight: 700, meta: 'H5' },
    h6: { size: 14, weight: 700, meta: 'H6', uppercase: true },
    blockquote: { size: 16, weight: 400, meta: 'Cita', className: 'tb-option--quote' },
    pre: { size: 13, weight: 400, meta: 'Pre', className: 'tb-option--pre' },
  };

  const selectApis = new Map();
  let openSelectApi = null;

  function getOptionPreview(kind, option) {
    const value = option.value;
    const style = {};
    let className = '';
    let meta = '';

    if (!value) {
      style.fontSize = '13px';
      style.fontWeight = '600';
      return { style: style, className: className, meta: meta };
    }

    if (kind === 'block') {
      const preview = BLOCK_PREVIEW[value] || BLOCK_PREVIEW.p;
      style.fontSize = preview.size + 'px';
      style.fontWeight = String(preview.weight);
      style.lineHeight = '1.15';
      if (preview.uppercase) {
        style.textTransform = 'uppercase';
        style.letterSpacing = '.04em';
      }
      className = preview.className || '';
      meta = preview.meta;
    } else if (kind === 'font') {
      style.fontFamily = value;
      style.fontSize = '16px';
      style.lineHeight = '1.4';
    } else if (kind === 'size') {
      const px = Number(value);
      style.fontSize = (Number.isFinite(px) ? px : 16) + 'px';
      style.lineHeight = '1.15';
    }

    return { style: style, className: className, meta: meta };
  }

  function syncSelectTrigger(select) {
    const api = selectApis.get(select);
    if (!api) return;
    const option = select.options[select.selectedIndex];
    const value = option ? option.textContent.trim() : '';
    api.label.textContent = value;
    api.trigger.setAttribute('aria-label', api.name + ': ' + value);
    api.trigger.title = api.select.title || api.name;
    api.rows.forEach(function (row) {
      const selected = row.dataset.value === select.value;
      row.classList.toggle('is-selected', selected);
      row.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function closeSelectMenu(api) {
    if (!api) return;
    api.menu.hidden = true;
    api.trigger.setAttribute('aria-expanded', 'false');
    if (openSelectApi === api) openSelectApi = null;
  }

  function closeAllSelectMenus() {
    selectApis.forEach(function (api) { closeSelectMenu(api); });
  }

  function openSelectMenu(api, focusTarget) {
    if (!api) return;
    if (!api.menu.hidden) {
      closeSelectMenu(api);
      return;
    }
    closeAllSelectMenus();
    closeDownloadMenu();
    closeColorPop();
    if (state.wysiwyg) state.wysiwyg.saveSelection();
    syncSelectTrigger(api.select);

    api.menu.hidden = false;
    api.trigger.setAttribute('aria-expanded', 'true');
    openSelectApi = api;

    const rect = api.trigger.getBoundingClientRect();
    const width = api.menu.offsetWidth;
    const height = api.menu.offsetHeight;
    const left = clamp(rect.left, 8, Math.max(8, global.innerWidth - width - 8));
    let top = rect.bottom + 6;
    if (top + height > global.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 6);
    }
    api.menu.style.left = Math.round(left) + 'px';
    api.menu.style.top = Math.round(top) + 'px';

    let target = null;
    if (focusTarget === 'last') {
      target = api.rows[api.rows.length - 1];
    } else {
      target = api.rows.find(function (row) { return row.classList.contains('is-selected'); }) || api.rows[0];
    }
    if (target) target.focus({ preventScroll: true });
  }

  function chooseSelectOption(api, row) {
    const select = api.select;
    closeSelectMenu(api);
    select.value = row.dataset.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    syncSelectTrigger(select);
    api.trigger.focus({ preventScroll: true });
  }

  function enhanceSelect(select) {
    const wrap = select.closest('.tb-select');
    if (!wrap || selectApis.has(select)) return;
    const kind = select.id === 'blockSelect' ? 'block' : select.id === 'fontSelect' ? 'font' : 'size';
    const name = wrap.dataset.label || select.title || 'Seleccionar';

    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tb-trigger';
    trigger.id = select.id + 'Trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', select.id + 'Menu');
    trigger.innerHTML = '<span class="tb-trigger-label"></span><svg class="icon tb-chevron" aria-hidden="true"><use href="#i-chevron-down"/></svg>';

    const menu = document.createElement('div');
    menu.className = 'tb-menu tb-menu--' + kind;
    menu.id = select.id + 'Menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-labelledby', trigger.id);

    const rows = Array.from(select.options).map(function (option) {
      const row = document.createElement('div');
      row.className = 'tb-option';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.tabIndex = -1;
      row.dataset.value = option.value;

      const preview = getOptionPreview(kind, option);
      if (preview.className) row.classList.add(preview.className);

      const sample = document.createElement('span');
      sample.className = 'tb-option-sample';
      sample.textContent = option.textContent.trim();
      Object.keys(preview.style).forEach(function (key) {
        sample.style[key] = preview.style[key];
      });
      row.appendChild(sample);

      if (preview.meta) {
        const meta = document.createElement('span');
        meta.className = 'tb-option-meta';
        meta.textContent = preview.meta;
        row.appendChild(meta);
      }

      menu.appendChild(row);
      return row;
    });

    const api = {
      select: select,
      wrap: wrap,
      trigger: trigger,
      menu: menu,
      rows: rows,
      label: trigger.querySelector('.tb-trigger-label'),
      name: name,
    };
    selectApis.set(select, api);
    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      if (menu.hidden) openSelectMenu(api);
      else closeSelectMenu(api);
    });

    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openSelectMenu(api);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openSelectMenu(api, 'last');
      }
    });

    menu.addEventListener('keydown', function (event) {
      const index = rows.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        (rows[Math.min(rows.length - 1, index + 1)] || rows[0]).focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        (rows[Math.max(0, index - 1)] || rows[rows.length - 1]).focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        if (rows[0]) rows[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        if (rows[rows.length - 1]) rows[rows.length - 1].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeSelectMenu(api);
        trigger.focus();
      } else if (event.key === 'Tab') {
        closeSelectMenu(api);
      }
    });

    rows.forEach(function (row) {
      row.addEventListener('click', function () { chooseSelectOption(api, row); });
      row.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chooseSelectOption(api, row);
        }
      });
    });

    syncSelectTrigger(select);
  }

  function enhanceSelects() {
    ['#blockSelect', '#fontSelect', '#sizeSelect'].forEach(function (selector) {
      const select = $(selector);
      if (select) enhanceSelect(select);
    });
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
      syncSelectTrigger(block);
    }
    const linkBtn = $('#linkBtn');
    if (linkBtn) linkBtn.classList.toggle('is-active', !!info.link);
  }

  function updateColors() {
    const textBar = $('#textColorBar');
    if (textBar) textBar.style.background = state.colors.text || '#222222';
    const highlightBar = $('#highlightBar');
    if (highlightBar) highlightBar.style.background = state.colors.highlight || '#fff3cd';
    const current = normalizeHex(state.colors[state.colorTarget]) || (state.colorTarget === 'text' ? '#222222' : '#fff3cd');
    const custom = $('#colorCustom');
    if (custom) custom.value = current;
    const hex = $('#colorHex');
    if (hex && document.activeElement !== hex) hex.value = current.replace('#', '').toUpperCase();
    const hexWrap = hex ? hex.closest('.color-hex') : null;
    if (hexWrap) hexWrap.classList.remove('is-invalid');
    $$('.color-swatch[data-color]').forEach(function (swatch) {
      swatch.classList.toggle('is-selected', swatch.dataset.color.toLowerCase() === current.toLowerCase());
    });
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
    if (markdownActive() && state.mdEditor) {
      state.mdEditor.undo();
      return;
    }
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
    if (markdownActive() && state.mdEditor) {
      state.mdEditor.redo();
      return;
    }
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
    const md = markdownActive() && !!state.mdEditor;
    const undo = $('#undoBtn');
    if (undo) {
      undo.disabled = md ? false : state.history.length === 0;
      undo.title = md ? 'Deshacer en el Markdown' : 'Deshacer última operación';
    }
    const redo = $('#redoBtn');
    if (redo) {
      redo.disabled = md ? false : state.future.length === 0;
      redo.title = md ? 'Rehacer en el Markdown' : 'Rehacer operación';
    }
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
    state.compressed = true;
    applyRaw(after, { format: false });
    App.toast('HTML comprimido.', 'success');
  }

  function copyCode() {
    let text;
    if (state.codeLang === 'md' && state.mdEditor) {
      if (state.mdStale) refreshMarkdown(true);
      text = state.mdEditor.getValue();
    } else {
      text = getWorkingHtml();
    }
    if (!text.trim()) {
      App.toast('No hay código que copiar.', 'warn');
      return;
    }
    App.copyText(text).then(function (ok) {
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
    applyRaw(after, { format: false });
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
    state.compressed = false;
    applyRaw('', { resetScroll: true });
    updateEncodingBtn();
    App.toast('Página nueva en blanco.', 'success');
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

  function applyHexColor() {
    const input = $('#colorHex');
    if (!input) return;
    const wrap = input.closest('.color-hex');
    const hex = normalizeHex(input.value);
    if (!hex) {
      if (wrap) wrap.classList.add('is-invalid');
      App.toast('Código hexadecimal no válido. Prueba con 02874d o 0a0.', 'warn', 3400);
      input.focus({ preventScroll: true });
      input.select();
      return;
    }
    if (wrap) wrap.classList.remove('is-invalid');
    input.value = hex.replace('#', '').toUpperCase();
    applyColorChoice(hex);
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

  /* ---------- Emoticonos y caracteres especiales ---------- */

  const RECENT_KEY = 'htmlEditor.recent.v1';
  const RECENT_MAX = 18;

  const glyphState = {
    emojiSet: 'common',
    emojiDialogSet: 'caras',
    emojiDialogQuery: '',
    charSet: 'puntuacion',
    charQuery: '',
  };

  let emojiListCache = null;
  let emojiMapCache = null;
  let emojiCategoryCache = null;
  let charMapCache = null;
  let recentStore = null;

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function getEmojiList() {
    if (emojiListCache) return emojiListCache;
    const list = [];
    (Array.isArray(App.EMOJI_GROUPS) ? App.EMOJI_GROUPS : []).forEach(function (group) {
      (group.emojis || []).forEach(function (raw) {
        const parts = String(raw).split('|');
        const char = parts[0];
        if (!char) return;
        const label = parts[1] || '';
        list.push({ char: char, label: label, group: group.id, search: normalizeText(label + ' ' + group.label) });
      });
    });
    emojiListCache = list;
    return list;
  }

  function getEmojiMap() {
    if (emojiMapCache) return emojiMapCache;
    const map = new Map();
    getEmojiList().forEach(function (item) { if (!map.has(item.char)) map.set(item.char, item); });
    emojiMapCache = map;
    return map;
  }

  function getEmojiCategories() {
    if (emojiCategoryCache) return emojiCategoryCache;
    const list = (Array.isArray(App.EMOJI_GROUPS) ? App.EMOJI_GROUPS : []).map(function (group) {
      return {
        id: group.id,
        label: group.label,
        items: (group.emojis || []).map(function (raw) {
          const parts = String(raw).split('|');
          return { char: parts[0], label: parts[1] || '' };
        }).filter(function (item) { return !!item.char; }),
      };
    });
    emojiCategoryCache = list;
    return list;
  }

  function getCommonEmojiItems() {
    const map = getEmojiMap();
    return (Array.isArray(App.EMOJI_COMMON) ? App.EMOJI_COMMON : []).map(function (char) {
      const found = map.get(char);
      return { char: char, label: found ? found.label : 'Emoticono' };
    }).filter(function (item) { return !!item.char; });
  }

  function getCharCategories() {
    return (Array.isArray(App.SPECIAL_CHARS) ? App.SPECIAL_CHARS : []).map(function (group) {
      return {
        id: group.id,
        label: group.label,
        items: (group.chars || []).map(function (pair) {
          return { char: pair[0], label: pair[1] || '' };
        }),
      };
    });
  }

  function getCharMap() {
    if (charMapCache) return charMapCache;
    const map = new Map();
    getCharCategories().forEach(function (category) {
      category.items.forEach(function (item) { if (!map.has(item.char)) map.set(item.char, item); });
    });
    charMapCache = map;
    return map;
  }

  /* --- recientes --- */

  function getRecent() {
    if (recentStore) return recentStore;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null'); } catch (error) { data = null; }
    recentStore = {
      emojis: data && Array.isArray(data.emojis) ? data.emojis.filter(function (item) { return typeof item === 'string'; }).slice(0, RECENT_MAX) : [],
      chars: data && Array.isArray(data.chars) ? data.chars.filter(function (item) { return typeof item === 'string'; }).slice(0, RECENT_MAX) : [],
    };
    return recentStore;
  }

  function rememberGlyph(kind, char) {
    if (!char) return;
    const store = getRecent();
    const key = kind === 'emoji' ? 'emojis' : 'chars';
    const list = store[key];
    const index = list.indexOf(char);
    if (index !== -1) list.splice(index, 1);
    list.unshift(char);
    if (list.length > RECENT_MAX) list.length = RECENT_MAX;
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(store)); } catch (error) { /* sin persistencia */ }
    syncRecentLabels();
  }

  function recentEmojiItems() {
    const map = getEmojiMap();
    return getRecent().emojis.map(function (char) {
      const found = map.get(char);
      return { char: char, label: found ? found.label : 'Emoticono' };
    });
  }

  function recentCharItems() {
    const map = getCharMap();
    return getRecent().chars.map(function (char) {
      const found = map.get(char);
      return { char: char, label: found ? found.label : 'Carácter especial' };
    });
  }

  function syncRecentLabels() {
    const emojiOption = document.querySelector('#emojiSet option[value="recent"]');
    if (emojiOption) {
      const count = getRecent().emojis.length;
      emojiOption.textContent = count ? 'Recientes (' + count + ')' : 'Recientes';
    }
    const charOption = document.querySelector('#charSet option[value="recent"]');
    if (charOption) {
      const count = getRecent().chars.length;
      charOption.textContent = count ? 'Recientes (' + count + ')' : 'Recientes';
    }
  }

  /* --- pintado --- */

  function buildCharSetOptions() {
    const select = $('#charSet');
    if (!select) return;
    const options = [{ id: 'recent', label: 'Recientes' }].concat(getCharCategories());
    const current = select.value || glyphState.charSet;
    select.innerHTML = '';
    options.forEach(function (option) {
      const item = document.createElement('option');
      item.value = option.id;
      item.textContent = option.label;
      select.appendChild(item);
    });
    select.value = options.some(function (option) { return option.id === current; }) ? current : (options[1] ? options[1].id : 'recent');
    syncRecentLabels();
  }

  function buildEmojiDialogSetOptions() {
    const select = $('#emojiDialogSet');
    if (!select) return;
    const categories = getEmojiCategories();
    const current = select.value || glyphState.emojiDialogSet;
    select.innerHTML = '';
    categories.forEach(function (category) {
      const item = document.createElement('option');
      item.value = category.id;
      item.textContent = category.label;
      select.appendChild(item);
    });
    select.value = categories.some(function (category) { return category.id === current; }) ? current : (categories[0] ? categories[0].id : '');
  }

  function renderGlyphGrid(grid, items, emptyEl, emptyText) {
    if (!grid) return;
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    items.forEach(function (item) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'glyph-btn';
      button.dataset.char = item.char;
      button.title = item.label || item.char;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-label', 'Insertar ' + (item.label || item.char));
      button.textContent = item.char;
      fragment.appendChild(button);
    });
    grid.appendChild(fragment);
    if (emptyEl) {
      if (emptyText) emptyEl.textContent = emptyText;
      emptyEl.hidden = items.length > 0;
    }
    grid.scrollTop = 0;
  }

  function renderEmojiPopover() {
    const grid = $('#emojiGrid');
    if (!grid) return;
    const set = glyphState.emojiSet === 'recent' ? 'recent' : 'common';
    const items = set === 'recent' ? recentEmojiItems() : getCommonEmojiItems();
    const select = $('#emojiSet');
    if (select && select.value !== set) select.value = set;
    renderGlyphGrid(grid, items, $('#emojiEmpty'), set === 'recent'
      ? 'Todavía no has usado ningún emoticono. Elige uno de «Más usados» o abre «Más emoticonos…».'
      : 'No se han podido cargar los emoticonos. Recarga la página.');
    const count = $('#emojiCount');
    if (count) count.textContent = items.length + (items.length === 1 ? ' emoticono' : ' emoticonos');
  }

  function openEmojiPop(button) {
    const pop = $('#emojiPop');
    if (!pop) return;
    if (!pop.hidden) {
      closeEmojiPop();
      return;
    }
    closeColorPop();
    closeDownloadMenu();
    closeAllSelectMenus();
    if (state.wysiwyg) state.wysiwyg.saveSelection();
    glyphState.emojiSet = getRecent().emojis.length ? 'recent' : 'common';
    syncRecentLabels();
    renderEmojiPopover();
    pop.hidden = false;
    placeGlyphPopover(pop, button);
    if (button) button.setAttribute('aria-expanded', 'true');
    const first = pop.querySelector('.glyph-btn');
    if (first) first.focus({ preventScroll: true });
  }

  function closeEmojiPop() {
    const pop = $('#emojiPop');
    if (pop) pop.hidden = true;
    const button = $('#emojiBtn');
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function placeGlyphPopover(pop, anchor) {
    if (!pop || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = pop.offsetWidth || 416;
    const height = pop.offsetHeight || 360;
    pop.style.left = Math.round(clamp(rect.left, 8, Math.max(8, global.innerWidth - width - 8))) + 'px';
    const below = rect.bottom + 8;
    const top = below + height > global.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below;
    pop.style.top = Math.round(clamp(top, 8, Math.max(8, global.innerHeight - height - 8))) + 'px';
  }

  function openEmojiDialog() {
    const dialog = $('#emojiDialog');
    if (!dialog) return;
    if (state.wysiwyg) state.wysiwyg.saveSelection();
    closeEmojiPop();
    glyphState.emojiDialogQuery = '';
    const search = $('#emojiDialogSearch');
    if (search) search.value = '';
    renderEmojiDialog();
    dialog.showModal();
    if (search) setTimeout(function () { search.focus({ preventScroll: true }); }, 50);
  }

  function renderEmojiDialog() {
    const grid = $('#emojiDialogGrid');
    if (!grid) return;
    const categories = getEmojiCategories();
    if (!categories.length) {
      renderGlyphGrid(grid, [], $('#emojiDialogEmpty'), 'No se han podido cargar los emoticonos. Recarga la página.');
      return;
    }
    const query = normalizeText(glyphState.emojiDialogQuery).trim();
    let items;
    let emptyText;
    if (query) {
      items = getEmojiList().filter(function (item) { return item.search.indexOf(query) !== -1; }).slice(0, 500);
      emptyText = 'No hay emoticonos para «' + glyphState.emojiDialogQuery.trim() + '».';
    } else {
      const active = categories.filter(function (category) { return category.id === glyphState.emojiDialogSet; })[0] || categories[0];
      glyphState.emojiDialogSet = active.id;
      items = active.items;
      emptyText = 'Esta categoría está vacía.';
    }
    const select = $('#emojiDialogSet');
    if (select && select.value !== glyphState.emojiDialogSet) select.value = glyphState.emojiDialogSet;
    renderGlyphGrid(grid, items, $('#emojiDialogEmpty'), emptyText);
    const count = $('#emojiDialogCount');
    if (count) {
      count.textContent = query
        ? items.length + (items.length === 1 ? ' resultado' : ' resultados') + ' de 1.898 emoticonos.'
        : items.length + ' emoticonos en esta categoría · 1.898 en total. Puedes insertar varios seguidos.';
    }
  }

  function openCharDialog() {
    if (!state.wysiwyg) return;
    state.wysiwyg.saveSelection();
    glyphState.charQuery = '';
    glyphState.charSet = getRecent().chars.length ? 'recent' : 'puntuacion';
    const search = $('#charSearch');
    if (search) search.value = '';
    renderCharPalette();
    const dialog = $('#charDialog');
    if (dialog) dialog.showModal();
    if (search) setTimeout(function () { search.focus({ preventScroll: true }); }, 60);
  }

  function renderCharPalette() {
    const grid = $('#charGrid');
    if (!grid) return;
    const categories = getCharCategories();
    if (!categories.length) {
      renderGlyphGrid(grid, [], $('#charEmpty'), 'No se han podido cargar los caracteres.');
      return;
    }
    const query = normalizeText(glyphState.charQuery).trim();
    let items;
    let emptyText;
    if (query) {
      items = [];
      categories.forEach(function (category) {
        category.items.forEach(function (item) {
          if (normalizeText(item.label).indexOf(query) !== -1) items.push(item);
        });
      });
      items = items.slice(0, 400);
      emptyText = 'No hay caracteres para «' + glyphState.charQuery.trim() + '».';
    } else if (glyphState.charSet === 'recent') {
      items = recentCharItems();
      emptyText = 'Todavía no has usado ningún carácter. Elige una categoría o usa el buscador.';
    } else {
      const active = categories.filter(function (category) { return category.id === glyphState.charSet; })[0] || categories[0];
      glyphState.charSet = active.id;
      items = active.items;
      emptyText = 'Esta categoría está vacía.';
    }
    const select = $('#charSet');
    if (select && !query && select.value !== glyphState.charSet) select.value = glyphState.charSet;
    renderGlyphGrid(grid, items, $('#charEmpty'), emptyText);
  }

  function insertGlyph(kind, char) {
    if (!char || !state.wysiwyg || !state.wysiwyg.isReady) return;
    state.wysiwyg.restoreSelection();
    state.wysiwyg.insertHtml(App.escapeHtml(char));
    rememberGlyph(kind, char);
  }

  function bindGlyphPalettes() {
    buildCharSetOptions();
    buildEmojiDialogSetOptions();

    const emojiButton = $('#emojiBtn');
    if (emojiButton) emojiButton.addEventListener('click', function (event) { event.stopPropagation(); openEmojiPop(emojiButton); });
    const emojiClose = $('#emojiPopClose');
    if (emojiClose) emojiClose.addEventListener('click', closeEmojiPop);
    const emojiSet = $('#emojiSet');
    if (emojiSet) {
      emojiSet.addEventListener('change', function () {
        if (emojiSet.value === 'all') {
          emojiSet.value = glyphState.emojiSet;
          openEmojiDialog();
          return;
        }
        glyphState.emojiSet = emojiSet.value === 'recent' ? 'recent' : 'common';
        renderEmojiPopover();
      });
    }
    const emojiGrid = $('#emojiGrid');
    if (emojiGrid) {
      emojiGrid.addEventListener('click', function (event) {
        const button = event.target.closest('.glyph-btn');
        if (!button) return;
        insertGlyph('emoji', button.dataset.char);
        button.focus({ preventScroll: true });
      });
      emojiGrid.addEventListener('keydown', onGlyphGridKeydown);
    }
    const emojiPop = $('#emojiPop');
    if (emojiPop) {
      emojiPop.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeEmojiPop();
          if (emojiButton) emojiButton.focus();
        }
      });
    }

    const emojiDialogSearch = $('#emojiDialogSearch');
    if (emojiDialogSearch) {
      emojiDialogSearch.addEventListener('input', function () {
        glyphState.emojiDialogQuery = emojiDialogSearch.value;
        renderEmojiDialog();
      });
    }
    const emojiDialogSet = $('#emojiDialogSet');
    if (emojiDialogSet) {
      emojiDialogSet.addEventListener('change', function () {
        glyphState.emojiDialogSet = emojiDialogSet.value;
        glyphState.emojiDialogQuery = '';
        if (emojiDialogSearch) emojiDialogSearch.value = '';
        renderEmojiDialog();
      });
    }
    const emojiDialogGrid = $('#emojiDialogGrid');
    if (emojiDialogGrid) {
      emojiDialogGrid.addEventListener('click', function (event) {
        const button = event.target.closest('.glyph-btn');
        if (!button) return;
        insertGlyph('emoji', button.dataset.char);
        button.focus({ preventScroll: true });
      });
      emojiDialogGrid.addEventListener('keydown', onGlyphGridKeydown);
    }

    const charButton = $('#charBtn');
    if (charButton) charButton.addEventListener('click', openCharDialog);
    const charSet = $('#charSet');
    if (charSet) {
      charSet.addEventListener('change', function () {
        glyphState.charSet = charSet.value;
        glyphState.charQuery = '';
        const search = $('#charSearch');
        if (search) search.value = '';
        renderCharPalette();
      });
    }
    const charSearch = $('#charSearch');
    if (charSearch) {
      charSearch.addEventListener('input', function () {
        glyphState.charQuery = charSearch.value;
        renderCharPalette();
      });
    }
    const charGrid = $('#charGrid');
    if (charGrid) {
      charGrid.addEventListener('click', function (event) {
        const button = event.target.closest('.glyph-btn');
        if (!button) return;
        insertGlyph('char', button.dataset.char);
        button.classList.add('is-just-inserted');
        button.focus({ preventScroll: true });
        setTimeout(function () { button.classList.remove('is-just-inserted'); }, 260);
      });
      charGrid.addEventListener('keydown', onGlyphGridKeydown);
    }
  }

  function onGlyphGridKeydown(event) {
    const grid = event.currentTarget;
    const buttons = Array.prototype.slice.call(grid.querySelectorAll('.glyph-btn'));
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 9;
    let next = -1;
    if (event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'ArrowDown') next = index + columns;
    else if (event.key === 'ArrowUp') next = index - columns;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    if (next < 0 || next >= buttons.length || next === index) return;
    event.preventDefault();
    buttons[next].focus();
  }

  /* ---------- Vídeo incrustado ---------- */

  function parseVideoUrl(input) {
    let raw = String(input == null ? '' : input).trim();
    if (!raw) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith('//')) raw = 'https://' + raw;
    if (raw.startsWith('//')) raw = 'https:' + raw;
    let url;
    try { url = new URL(raw); } catch (error) { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const start = (function () {
      const value = url.searchParams.get('start') || url.searchParams.get('t') || (url.hash.match(/t=(\d+)/) || [])[1];
      const seconds = parseInt(value, 10);
      return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : 0;
    })();

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      if (/^[\w-]{6,}$/.test(id)) return { type: 'youtube', label: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0' + (start ? '&start=' + start : '') };
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      let id = '';
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else {
        const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
        if (match) id = match[1];
      }
      if (/^[\w-]{6,}$/.test(id)) return { type: 'youtube', label: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0' + (start ? '&start=' + start : '') };
      return null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const match = url.pathname.match(/(\d{6,})/);
      if (match) return { type: 'vimeo', label: 'Vimeo', src: 'https://player.vimeo.com/video/' + match[1] };
      return null;
    }
    if (host === 'dailymotion.com' || host === 'dai.ly') {
      let id = '';
      if (host === 'dai.ly') id = url.pathname.slice(1).split('/')[0];
      else {
        const match = url.pathname.match(/\/video\/([\w]+)/);
        if (match) id = match[1];
      }
      if (/^[a-zA-Z0-9]{5,}$/.test(id)) return { type: 'dailymotion', label: 'Dailymotion', src: 'https://www.dailymotion.com/embed/video/' + id };
      return null;
    }
    if (/\.(mp4|webm|ogv|ogg|m4v|mov)(?:$|[?#])/i.test(url.href)) {
      return { type: 'file', label: 'Archivo de vídeo', src: url.href };
    }
    return null;
  }

  function describeVideo(info) {
    if (!info) return '';
    if (info.type === 'file') return 'Archivo de vídeo · se insertará con controles nativos.';
    return info.label + ' · el vídeo se reproducirá dentro del documento.';
  }

  function buildVideoHtml(info, caption) {
    const figcaption = caption ? '<figcaption>' + App.escapeHtml(caption) + '</figcaption>' : '';
    if (info.type === 'file') {
      return '<figure class="video-embed video-embed--file">' +
        '<video controls preload="metadata" src="' + App.escapeHtml(info.src) + '"></video>' +
        figcaption +
        '</figure>';
    }
    return '<figure class="video-embed">' +
      '<div class="video-frame">' +
      '<iframe src="' + App.escapeHtml(info.src) + '" title="' + App.escapeHtml(caption || 'Vídeo') + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>' +
      '</div>' +
      figcaption +
      '</figure>';
  }

  function openVideoDialog() {
    if (!state.wysiwyg) return;
    state.wysiwyg.saveSelection();
    const dialog = $('#videoDialog');
    if (!dialog) return;
    $('#videoUrl').value = '';
    $('#videoCaption').value = '';
    $('#videoError').hidden = true;
    const note = $('#videoNote');
    if (note) { note.hidden = true; note.classList.remove('is-bad'); note.textContent = ''; }
    dialog.showModal();
    setTimeout(function () { $('#videoUrl').focus(); }, 40);
  }

  function updateVideoNote() {
    const input = $('#videoUrl');
    const note = $('#videoNote');
    const error = $('#videoError');
    if (!input || !note) return;
    const raw = input.value.trim();
    if (error) error.hidden = true;
    if (!raw) {
      note.hidden = true;
      note.classList.remove('is-bad');
      return;
    }
    const info = parseVideoUrl(raw);
    note.hidden = false;
    note.classList.toggle('is-bad', !info);
    note.textContent = info ? describeVideo(info) : 'Todavía no se reconoce un vídeo en esta dirección.';
  }

  function submitVideo(event) {
    event.preventDefault();
    const info = parseVideoUrl($('#videoUrl').value);
    const error = $('#videoError');
    if (!info) {
      if (error) error.hidden = false;
      $('#videoUrl').focus();
      return;
    }
    if (state.wysiwyg) {
      state.wysiwyg.restoreSelection();
      state.wysiwyg.insertHtml(buildVideoHtml(info, $('#videoCaption').value.trim()));
    }
    $('#videoDialog').close();
    App.toast('Vídeo insertado.', 'success');
  }

  /* ---------- Impresión ---------- */

  const PRINT_SIZES = {
    a4: { css: 'A4' },
    letter: { css: 'Letter' },
    a5: { css: 'A5' },
    legal: { css: 'Legal' },
  };

  const PRINT_MARGINS = {
    none: '0',
    narrow: '10mm',
    normal: '18mm 16mm',
    wide: '25mm 20mm',
  };

  function currentPrintOptions() {
    return {
      size: PRINT_SIZES[state.print.size] ? state.print.size : 'a4',
      orientation: state.print.orientation === 'landscape' ? 'landscape' : 'portrait',
      margins: PRINT_MARGINS[state.print.margins] ? state.print.margins : 'normal',
    };
  }

  function buildPrintCss(options) {
    const opts = options || currentPrintOptions();
    const paper = PRINT_SIZES[opts.size] || PRINT_SIZES.a4;
    const padding = PRINT_MARGINS[opts.margins] || PRINT_MARGINS.normal;
    return [
      '<style>',
      /* margin: 0 quita el encabezado y el pie que el navegador añade al imprimir */
      '  @page { size: ' + paper.css + ' ' + opts.orientation + '; margin: 0; }',
      '  html, body { margin: 0 !important; padding: 0 !important; background: #fff; }',
      '  body {',
      '    max-width: none !important;',
      '    padding: ' + padding + ' !important;',
      '    -webkit-print-color-adjust: exact;',
      '    print-color-adjust: exact;',
      '  }',
      '  a { color: inherit; text-decoration: underline; }',
      '  .video-embed { break-inside: avoid; }',
      '  .video-frame { position: relative; height: 0; padding-bottom: 56.25%; overflow: hidden; }',
      '  .video-frame iframe, .video-frame video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }',
      '  .video-embed--file video { max-width: 100%; height: auto; }',
      '  img, table, pre, blockquote, figure { break-inside: avoid; }',
      '</style>',
    ].join('\n');
  }

  function openPrintDialog() {
    const dialog = $('#printDialog');
    if (!dialog) {
      printDocument();
      return;
    }
    if (dialog.open) return;
    const opts = currentPrintOptions();
    const size = $('#printSize');
    const orientation = $('#printOrientation');
    const margins = $('#printMargins');
    if (size) size.value = opts.size;
    if (orientation) orientation.value = opts.orientation;
    if (margins) margins.value = opts.margins;
    dialog.showModal();
    if (size) setTimeout(function () { size.focus({ preventScroll: true }); }, 40);
  }

  function bindPrintDialog() {
    const form = $('#printForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const size = $('#printSize');
      const orientation = $('#printOrientation');
      const margins = $('#printMargins');
      if (size && PRINT_SIZES[size.value]) state.print.size = size.value;
      if (orientation) state.print.orientation = orientation.value === 'landscape' ? 'landscape' : 'portrait';
      if (margins && PRINT_MARGINS[margins.value]) state.print.margins = margins.value;
      saveSettingsDebounced();
      const dialog = $('#printDialog');
      if (dialog) dialog.close();
      printDocument();
    });
  }

  function printDocument() {
    if (state.lastEdited === 'visual') flushVisualToSource();
    const html = getWorkingHtml();
    if (!html.trim()) {
      App.toast('El documento está vacío. Escribe algo antes de imprimir.', 'warn');
      return;
    }
    const body = App.extractBody(html).html;
    const title = state.docTitle || 'Documento';
    const documentHtml = App.wrapDocument(body, title).replace('</head>', buildPrintCss() + '\n</head>');
    const previous = $('#printFrame');
    if (previous) previous.remove();
    const frame = document.createElement('iframe');
    frame.id = 'printFrame';
    frame.title = 'Documento listo para imprimir';
    frame.setAttribute('aria-hidden', 'true');
    // Sin allow-scripts: un <script> del documento no se ejecuta al imprimir.
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    // Fuera de la vista pero con tamaño real: algunas versiones de Chrome
    // imprimen en blanco los iframes de 0 × 0.
    frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1024px;height:768px;border:0;';
    frame.srcdoc = documentHtml;
    frame.addEventListener('load', function () {
      setTimeout(function () {
        try {
          const win = frame.contentWindow;
          if (!win) throw new Error('sin ventana');
          win.focus();
          win.print();
        } catch (error) {
          App.toast('El navegador no ha permitido abrir el diálogo de impresión. Descarga el HTML y ábrelo para imprimir.', 'error', 6500);
          frame.remove();
          return;
        }
        setTimeout(function () { if (frame.parentNode) frame.remove(); }, 60000);
      }, 180);
    });
    document.body.appendChild(frame);
    App.toast('Preparando la vista de impresión…', 'info', 2200);
  }

  /* ---------- Fecha y hora ---------- */

  const DATE_FORMATS = {
    larga: function (date) {
      return capitalize(date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
    },
    corta: function (date) {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    semana: function (date) {
      return capitalize(date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    },
    hora: function (date) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    },
    fechahora: function (date) {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    },
    iso: function (date) {
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    },
  };

  function capitalize(value) {
    const text = String(value == null ? '' : value);
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function currentDateFormat() {
    const select = $('#dateFormat');
    return select && DATE_FORMATS[select.value] ? select.value : 'larga';
  }

  function updateDatePreview() {
    const preview = $('#datePreview');
    if (!preview) return;
    const make = DATE_FORMATS[currentDateFormat()] || DATE_FORMATS.larga;
    preview.textContent = make(new Date());
  }

  function openDateDialog() {
    if (!state.wysiwyg) return;
    state.wysiwyg.saveSelection();
    updateDatePreview();
    const dialog = $('#dateDialog');
    if (dialog) dialog.showModal();
    const format = $('#dateFormat');
    if (format) setTimeout(function () { format.focus({ preventScroll: true }); }, 40);
  }

  function insertDate(event) {
    if (event) event.preventDefault();
    if (!state.wysiwyg) return;
    const date = new Date();
    const make = DATE_FORMATS[currentDateFormat()] || DATE_FORMATS.larga;
    const text = make(date);
    const wrapTime = $('#dateTimeTag') && $('#dateTimeTag').checked;
    const html = wrapTime
      ? '<time datetime="' + date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) +
        'T' + pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + '">' + App.escapeHtml(text) + '</time>'
      : App.escapeHtml(text);
    state.wysiwyg.restoreSelection();
    if (wrapTime && state.wysiwyg.insertFragment) state.wysiwyg.insertFragment(html);
    else state.wysiwyg.insertHtml(html);
    const dialog = $('#dateDialog');
    if (dialog) dialog.close();
    App.toast('Fecha insertada.', 'success', 1800);
  }

  function bindDateDialog() {
    const button = $('#dateBtn');
    if (button) button.addEventListener('click', openDateDialog);
    const select = $('#dateFormat');
    if (select) select.addEventListener('change', updateDatePreview);
    const form = $('#dateForm');
    if (form) form.addEventListener('submit', insertDate);
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

  function openImageDialog(target) {
    if (!state.wysiwyg) return;
    const direct = target && target.tagName === 'IMG' ? target : null;
    const existing = direct || (state.wysiwyg.getImageElement ? state.wysiwyg.getImageElement() : null);
    state.wysiwyg.saveSelection();
    state.imageEditing = existing || null;
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
    const title = $('#imageDialogTitle');
    const submit = $('#imageSubmit');
    const remove = $('#imageRemove');
    const note = $('#imageEditNote');
    if (existing) {
      const anchor = existing.parentNode && existing.parentNode.tagName === 'A' ? existing.parentNode : null;
      $('#imageUrl').value = existing.getAttribute('src') || '';
      $('#imageAlt').value = existing.getAttribute('alt') || '';
      $('#imageWidth').value = existing.getAttribute('width') || '';
      $('#imageNewTab').checked = !!anchor;
      showImagePreview(existing.getAttribute('src') || '');
      if (title) title.textContent = 'Editar imagen';
      if (submit) submit.textContent = 'Guardar cambios';
      if (remove) remove.hidden = false;
      if (note) note.hidden = false;
    } else {
      if (title) title.textContent = 'Insertar imagen';
      if (submit) submit.textContent = 'Insertar imagen';
      if (remove) remove.hidden = true;
      if (note) note.hidden = true;
    }
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

  function removePendingImage() {
    if (state.imageEditing && state.wysiwyg && state.wysiwyg.removeImage) {
      state.wysiwyg.removeImage(state.imageEditing);
      App.toast('Imagen eliminada.', 'success', 2000);
    }
    state.imageEditing = null;
    const dialog = $('#imageDialog');
    if (dialog) dialog.close();
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
    const data = {
      src: src,
      alt: $('#imageAlt').value.trim(),
      width: width > 0 ? Math.min(4000, Math.round(width)) : null,
      link: $('#imageNewTab').checked,
    };
    if (state.imageEditing && state.wysiwyg && state.wysiwyg.updateImage) {
      state.wysiwyg.updateImage(state.imageEditing, data);
      state.imageEditing = null;
      $('#imageDialog').close();
      App.toast('Imagen actualizada.', 'success');
      return;
    }
    if (state.wysiwyg) {
      state.wysiwyg.restoreSelection();
      state.wysiwyg.insertImage(data);
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
      if (kind === 'md') {
        if (!App.Markdown || !App.Markdown.available) throw new Error('La conversión a Markdown no está disponible.');
        const markdown = App.Markdown.toMarkdown(html, { keepHtml: state.mdKeepHtml });
        if (!markdown.trim()) throw new Error('No se ha podido generar el Markdown de este documento.');
        const filename = App.safeFileName(state.docTitle, 'documento') + '.md';
        App.downloadBlob(new Blob([markdown + '\n'], { type: 'text/markdown;charset=utf-8' }), filename);
        App.toast('Markdown descargado: ' + filename, 'success', 5000);
      } else if (kind === 'docx') {
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
        syncSelectTrigger(font);
      });
    }

    const size = $('#sizeSelect');
    if (size) {
      size.addEventListener('change', function () {
        if (state.wysiwyg && size.value) state.wysiwyg.setFontSize(size.value);
        size.value = '';
        syncSelectTrigger(size);
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
    const video = $('#videoBtn');
    if (video) video.addEventListener('click', openVideoDialog);
    const print = $('#printBtn');
    if (print) print.addEventListener('click', openPrintDialog);
    const spellcheck = $('#spellcheckBtn');
    if (spellcheck) spellcheck.addEventListener('click', function () { setSpellcheck(!state.spellcheck); });
    const clear = $('#clearFormatBtn');
    if (clear) {
      clear.addEventListener('click', function () {
        if (state.wysiwyg) state.wysiwyg.clearFormatting();
      });
    }
    const fullscreen = $('#fullscreenBtn');
    if (fullscreen) fullscreen.addEventListener('click', function () { toggleFocusMode(); });
  }

  function setSpellcheck(on, silent) {
    state.spellcheck = on !== false;
    if (state.wysiwyg && state.wysiwyg.setSpellcheck) state.wysiwyg.setSpellcheck(state.spellcheck);
    const button = $('#spellcheckBtn');
    if (button) {
      button.classList.toggle('is-active', state.spellcheck);
      button.setAttribute('aria-pressed', state.spellcheck ? 'true' : 'false');
      button.title = state.spellcheck
        ? 'Corrector ortográfico activado (clic para desactivarlo)'
        : 'Corrector ortográfico desactivado (clic para activarlo)';
    }
    if (!silent) {
      persistSettings();
      App.toast(state.spellcheck ? 'Corrector ortográfico activado.' : 'Corrector ortográfico desactivado.', 'info', 1900);
    }
  }

  function bindFileName() {
    const input = $('#fileName');
    if (!input) return;
    input.addEventListener('focus', function () { input.select(); });
    input.addEventListener('input', function () {
      const clean = input.value.replace(/[\\/:*?"<>|]/g, '').replace(/\s{2,}/g, ' ');
      if (clean !== input.value) input.value = clean;
      sizeFileNameInput(input);
      state.baseTitle = input.value.trim() || 'sin-titulo';
      state.titleLocked = true;
      state.docTitle = state.baseTitle;
      document.title = state.docTitle + ' · Editor WYSIWYG';
      markDirty();
      scheduleAutoSave();
    });
    input.addEventListener('blur', function () {
      if (!input.value.trim()) input.value = 'sin-titulo';
      input.value = input.value.trim();
      sizeFileNameInput(input);
      state.baseTitle = input.value;
      state.titleLocked = true;
      state.docTitle = input.value;
      markDirty();
      saveDraft(false, false);
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        input.value = state.titleLocked ? state.baseTitle : App.slugify(state.docTitle, 'sin-titulo');
        sizeFileNameInput(input);
        input.blur();
      }
    });
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

    const hex = $('#colorHex');
    if (hex) {
      hex.addEventListener('focus', function () { hex.select(); });
      hex.addEventListener('input', function () {
        const clean = hex.value.replace(/[^0-9a-f]/gi, '').replace(/^#/, '').slice(0, 7);
        if (clean !== hex.value) hex.value = clean;
        const wrap = hex.closest('.color-hex');
        if (wrap) wrap.classList.remove('is-invalid');
      });
      hex.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyHexColor();
        }
      });
    }

    const hexApply = $('#colorHexApply');
    if (hexApply) hexApply.addEventListener('click', applyHexColor);

    const clear = $('#colorClear');
    if (clear) clear.addEventListener('click', function () { applyColorChoice('clear'); });
  }

  function bindDialogs() {
    ['#linkDialog', '#imageDialog', '#tableDialog', '#emojiDialog', '#charDialog', '#videoDialog', '#dateDialog', '#printDialog', '#helpDialog', '#confirmDialog'].forEach(function (selector) {
      App.wireDialogClose($(selector));
    });

    const imageDialog = $('#imageDialog');
    if (imageDialog) {
      imageDialog.addEventListener('close', function () { state.imageEditing = null; });
    }
    const imageRemove = $('#imageRemove');
    if (imageRemove) imageRemove.addEventListener('click', removePendingImage);

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
          // Solo se pide la vista previa cuando la dirección ya es completa:
          // así no se descargan URL relativas al escribir letra a letra.
          const complete = value.length > 8 && /^(https?:\/\/|data:image\/|\/|\.\.?\/)/i.test(value);
          const preview = complete ? safeImageUrl(value) : '';
          showImagePreview(preview);
          $('#imagePreview').hidden = !preview;
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

    const videoForm = $('#videoForm');
    if (videoForm) videoForm.addEventListener('submit', submitVideo);
    const videoUrl = $('#videoUrl');
    if (videoUrl) videoUrl.addEventListener('input', updateVideoNote);
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
        if (openSelectApi) {
          const api = openSelectApi;
          closeSelectMenu(api);
          api.trigger.focus({ preventScroll: true });
          return;
        }
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
      } else if (key === 'p' && !event.shiftKey) {
        event.preventDefault();
        openPrintDialog();
      }
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.menu-anchor')) closeDownloadMenu();
      if (!event.target.closest('.tb-select')) closeAllSelectMenus();
      if (!event.target.closest('#colorPop') && !event.target.closest('#textColorBtn') && !event.target.closest('#highlightBtn')) {
        closeColorPop();
      }
      if (!event.target.closest('#emojiPop') && !event.target.closest('#emojiBtn')) closeEmojiPop();
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

    window.addEventListener('pagehide', function () {
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
        closeEmojiPop();
        closeAllSelectMenus();
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

  /* ---------- Sincronización en vivo visual → código ---------- */

  const LIVE_SYNC_MIN_MS = 60;
  const LIVE_FORMAT_MAX = 120000;
  let visualSyncTimer = null;
  let visualSyncLast = 0;
  let visualSyncHtml = '';

  function cancelVisualSync() {
    if (visualSyncTimer) {
      clearTimeout(visualSyncTimer);
      visualSyncTimer = null;
    }
  }

  function liveFormat(html) {
    if (html.length > LIVE_FORMAT_MAX) return html;
    return formatHtml(html);
  }

  function writeVisualToSource(html) {
    visualSyncTimer = null;
    if (!state.cm || !state.wysiwyg || !state.wysiwyg.isReady) return;
    const value = liveFormat(html);
    visualSyncLast = Date.now();
    if (state.cm.getValue() === value) return;
    if (state.compressed) state.compressed = false;
    setSource(value, { fromVisual: true });
    markMarkdownStale();
  }

  /**
   * Vuelca el HTML del panel visual al código como máximo cada 60 ms.
   * El temporizador no se reprograma: así el panel de código se actualiza
   * mientras se escribe (no solo al hacer una pausa) y el formateo viaja
   * en el mismo volcado, sin un segundo paso tardío.
   */
  function visualSyncDelay(length) {
    if (length > 600000) return 500;
    if (length > 300000) return 220;
    if (length > LIVE_FORMAT_MAX) return 120;
    return LIVE_SYNC_MIN_MS;
  }

  function scheduleVisualSync(html) {
    visualSyncHtml = html;
    if (visualSyncTimer) return;
    const minMs = visualSyncDelay(html.length);
    const wait = Math.max(0, minMs - (Date.now() - visualSyncLast));
    visualSyncTimer = setTimeout(function () {
      writeVisualToSource(visualSyncHtml);
    }, wait);
  }

  const syncSourceDebounced = App.debounce(function () {
    if (!state.wysiwyg || !state.wysiwyg.isReady) return;
    state.wysiwyg.setHtml(state.cm ? state.cm.getValue() : '');
  }, 260);

  const scheduleMeta = App.debounce(refreshMeta, 260);
  const scheduleAutoSave = App.debounce(function () { saveDraft(false, false); }, 650);
  const saveSettingsDebounced = App.debounce(persistSettings, 400);

  function init() {
    state.settings = readSettings();
    const creditYear = document.querySelector('#creditYear');
    if (creditYear) creditYear.textContent = String(new Date().getFullYear());
    state.view = VIEWS.indexOf(state.settings.view) !== -1 ? state.settings.view : 'split';
    state.split = clamp(Number(state.settings.split) || 50, 20, 80);
    state.autoScroll = state.settings.autoScroll !== false;
    state.spellcheck = state.settings.spellcheck !== false;
    state.codeLang = state.settings.codeLang === 'md' ? 'md' : 'html';
    state.mdKeepHtml = state.settings.mdKeepHtml !== false;
    if (state.settings.print && typeof state.settings.print === 'object') {
      const savedPrint = state.settings.print;
      if (PRINT_SIZES[savedPrint.size]) state.print.size = savedPrint.size;
      if (savedPrint.orientation === 'landscape' || savedPrint.orientation === 'portrait') state.print.orientation = savedPrint.orientation;
      if (PRINT_MARGINS[savedPrint.margins]) state.print.margins = savedPrint.margins;
    }
    state.cleanIds = loadCleanIds();
    if (state.settings.colors && typeof state.settings.colors === 'object') {
      if (typeof state.settings.colors.text === 'string') state.colors.text = state.settings.colors.text;
      if (typeof state.settings.colors.highlight === 'string') state.colors.highlight = state.settings.colors.highlight;
    }

    const draft = loadDraft();
    state.compressed = draft ? !!draft.compressed : false;
    state.initialHtml = draft ? (state.compressed ? draft.html : formatHtml(draft.html)) : '';
    const draftMd = draft && typeof draft.md === 'string' ? draft.md : null;
    state.initialMd = draftMd;
    state.mdStale = !(draftMd != null && draft && draft.mdStale === false);
    if (draft) {
      state.baseTitle = draft.baseTitle || draft.title || 'sin-titulo';
      state.titleLocked = !!draft.titleLocked;
      state.encoding = !!draft.encoding;
      state.docTitle = typeof draft.title === 'string' ? draft.title : '';
      state.savedAt = draft.savedAt || null;
    }

    applySplit(state.split);
    setupCodeMirror(state.initialHtml);
    const initialMd = state.initialMd != null
      ? state.initialMd
      : (App.Markdown && App.Markdown.available ? App.Markdown.toMarkdown(state.initialHtml, { keepHtml: state.mdKeepHtml }) : '');
    setupMarkdownEditor(initialMd);
    setupWysiwyg();
    buildCleanGrid();
    setupFindReplace();
    enhanceSelects();

    bindTopbar();
    bindSourceActions();
    bindToolbar();
    bindDock();
    bindDialogs();
    bindColors();
    bindGlyphPalettes();
    bindMarkdownSwitch();
    bindFileName();
    bindPrintDialog();
    bindDateDialog();
    bindSplitter();
    bindDropzone();
    bindShortcuts();
    bindLifecycle();

    buildColorGrid();
    updateColors();
    updateEncodingBtn();
    setSpellcheck(state.spellcheck, true);
    setAutoScroll(state.autoScroll, true);
    setView(state.view, true);
    setCodeLang(state.codeLang, true);
    setMdKeep(state.mdKeepHtml, true);
    updateCharPill();
    setDockOpen(false);
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
