/* Editor visual WYSIWYG sobre un iframe aislado */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const FONT_DIR = new URL('assets/fonts/', document.baseURI).href;
  const DOCUMENT_CSS = `
    @font-face {
      font-family: "Varela Round";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("${FONT_DIR}varela-round-latin-ext.woff2") format("woff2");
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    @font-face {
      font-family: "Varela Round";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("${FONT_DIR}varela-round-latin.woff2") format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    :root { color-scheme: light; }
    :root[data-theme="dark"] { color-scheme: dark; }
    html, body { margin: 0; padding: 0; }
    body {
      box-sizing: border-box;
      min-height: 100vh;
      padding: 48px 56px 110px;
      background: #ffffff;
      color: #222222;
      font-family: "Varela Round", "Trebuchet MS", "Segoe UI", system-ui, sans-serif;
      font-size: 16px;
      line-height: 1.65;
      outline: none;
      overflow-wrap: break-word;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, h5, h6 { margin: 1.1em 0 .5em; line-height: 1.2; letter-spacing: -.015em; font-weight: 700; }
    h1:first-child, h2:first-child, h3:first-child, p:first-child { margin-top: 0; }
    h1 { font-size: 2.15em; }
    h2 { font-size: 1.6em; }
    h3 { font-size: 1.3em; }
    h4 { font-size: 1.1em; }
    h5 { font-size: 1em; }
    h6 { font-size: .9em; text-transform: uppercase; letter-spacing: .05em; color: #6f6f6f; }
    p { margin: 0 0 .9em; }
    ul, ol { margin: 0 0 .9em; padding-left: 1.5em; }
    li { margin: .18em 0; }
    a { color: #9c3b2d; text-decoration: underline; text-underline-offset: 2px; }
    a:hover { color: #7c2c21; }
    img { max-width: 100%; height: auto; }
    figure { margin: 1em 0; }
    figcaption { color: #6f6f6f; font-size: .875em; }
    table { border-collapse: collapse; max-width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #dcdcdc; padding: 7px 10px; vertical-align: top; min-width: 2em; }
    th { background: #f5f5f5; font-weight: 700; text-align: left; }
    table[border="0"] th, table[border="0"] td { border: 0; }
    blockquote { margin: 1em 0; padding: .15em 0 .15em 16px; border-left: 3px solid #9c3b2d; color: #4a4a4a; }
    pre { margin: 1em 0; padding: 14px 16px; border: 1px solid #e0e0e0; border-radius: 5px; background: #f7f7f7; overflow: auto; font-family: "Courier New", Courier, monospace; font-size: .875em; line-height: 1.55; white-space: pre-wrap; }
    code { padding: 2px 5px; border-radius: 4px; background: #f2f2f2; font-family: "Courier New", Courier, monospace; font-size: .9em; }
    pre code { padding: 0; background: none; }
    hr { border: 0; border-top: 1px solid #e0e0e0; margin: 1.8em 0; }
    .math { max-width: 100%; }
    .math--inline { display: inline-block; vertical-align: middle; }
    .math--block { display: block; margin: 1em 0; overflow-x: auto; overflow-y: hidden; text-align: center; }
    .math math { font-size: 1.08em; }
    .math--block math { margin: 0 auto; }
    .math[contenteditable="false"] { cursor: default; }
    .math:hover { outline: 1px dashed rgba(156, 59, 45, .45); outline-offset: 2px; }
    /* Listas de tareas y notas al pie */
    ul:has(> li > input[type="checkbox"]), ol:has(> li > input[type="checkbox"]) { list-style: none; padding-left: .1em; }
    li > input[type="checkbox"] { width: 1.05em; height: 1.05em; margin: 0 .5em 0 0; vertical-align: -.12em; accent-color: #9c3b2d; cursor: pointer; }
    .footnotes { margin-top: 2.2em; border-top: 1px solid #e0e0e0; padding-top: .9em; font-size: .86em; color: #555; }
    .footnotes ol { padding-left: 1.6em; }
    .footnotes li { margin: .35em 0; }
    .footnote-ref { font-size: .74em; line-height: 0; }
    .footnote-ref a { text-decoration: none; font-weight: 700; }
    .footnote-backref { text-decoration: none; margin-left: .25em; }
    mark { background: #f4e0da; padding: 0 2px; }
    small { font-size: .85em; }
    sup, sub { line-height: 0; }
    ::selection { background: rgba(156, 59, 45, .2); }
    table { table-layout: auto; }
    iframe { max-width: 100%; border: 0; }
    figure.video-embed { margin: 1.2em 0; }
    .video-frame {
      position: relative;
      height: 0;
      padding-bottom: 56.25%;
      overflow: hidden;
      border-radius: 8px;
      background: #0f172a;
    }
    .video-frame iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }
    .video-frame::after {
      content: "▶";
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      color: rgba(255, 255, 255, .82);
      font-size: 34px;
      line-height: 1;
      pointer-events: none;
    }
    .video-embed figcaption { margin-top: 6px; }
    .video-embed--file video {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      background: #0f172a;
    }
    /* Dentro del editor el vídeo no se reproduce: el clic selecciona el marco. */
    .video-frame iframe, .video-embed--file video { pointer-events: none; }
    /* Modo oscuro del documento */
    html[data-theme="dark"] body { background: #141414; color: #ededed; }
    html[data-theme="dark"] h6 { color: #b0b0b0; }
    html[data-theme="dark"] a { color: #df8c7d; }
    html[data-theme="dark"] a:hover { color: #eeb0a4; }
    html[data-theme="dark"] figcaption { color: #a0a0a0; }
    html[data-theme="dark"] th, html[data-theme="dark"] td { border-color: #3a3a3a; }
    html[data-theme="dark"] th { background: #1e1e1e; }
    html[data-theme="dark"] blockquote { border-left-color: #c25a49; color: #c7c7c7; }
    html[data-theme="dark"] pre { border-color: #333333; background: #1b1b1b; }
    html[data-theme="dark"] code { background: #222222; }
    html[data-theme="dark"] pre code { background: none; }
    html[data-theme="dark"] hr { border-top-color: #333333; }
    html[data-theme="dark"] mark { background: #4a231c; color: #ffffff; }
    html[data-theme="dark"] .math:hover { outline-color: rgba(223, 140, 125, .6); }
    html[data-theme="dark"] .footnotes { border-top-color: #333333; color: #b9b9b9; }
    html[data-theme="dark"] li > input[type="checkbox"] { accent-color: #df8c7d; }
    html[data-theme="dark"] ::selection { background: rgba(208, 105, 90, .3); }
    @media (max-width: 640px) {
      body { padding: 28px 22px 80px; }
    }
  `;

  const FONT_SIZE_MAP = { '1': 12, '2': 14, '3': 16, '4': 18, '5': 24, '6': 32, '7': 48 };

  const PASTE_DROP_TAGS = 'script,style,link,meta,title,base,object,embed,iframe,noscript,template,form,input,button,select,textarea';

  App.createWysiwyg = function (frame, options) {
    const opts = options || {};
    const state = {
      doc: null,
      body: null,
      win: null,
      ready: false,
      savedRange: null,
      emitSelection: null,
      theme: 'light',
      lang: 'es',
      page: null,
      composing: false,
      activeImage: null,
      silentScroll: false,
    };

    const readyPromise = new Promise((resolve) => {
      frame.addEventListener('load', function onLoad() {
        setup();
        resolve(api);
      });
    });

    frame.srcdoc = [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<style>' + DOCUMENT_CSS + '</style>',
      '</head>',
      '<body contenteditable="true" spellcheck="true"></body>',
      '</html>',
    ].join('');

    function setup() {
      if (state.ready) return;
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;
      state.doc = doc;
      state.win = win;
      state.body = doc.body;

      try {
        doc.execCommand('defaultParagraphSeparator', false, 'p');
        doc.execCommand('styleWithCSS', false, false);
      } catch (error) {
        /* sin soporte: seguimos */
      }

      state.body.setAttribute('contenteditable', 'true');
      state.body.setAttribute('spellcheck', 'true');
      state.doc.documentElement.setAttribute('data-theme', state.theme);
      state.body.addEventListener('change', function (event) {
        const box = event.target;
        if (!box || box.tagName !== 'INPUT' || String(box.type).toLowerCase() !== 'checkbox') return;
        emitTaskChange(box);
      });
      state.body.addEventListener('click', function (event) {
        const target = event.target;
        if (!target || target.nodeType !== 1) return;
        if (target.tagName === 'INPUT' && String(target.type).toLowerCase() === 'checkbox') {
          /* El navegador ya ha cambiado la casilla antes de este evento: no se
             toca su estado; el evento `change` guarda el resultado. */
          state.activeImage = null;
          return;
        }
        state.activeImage = target.tagName === 'IMG' ? target : null;
      });
      state.body.addEventListener('compositionstart', function () { state.composing = true; });
      state.body.addEventListener('compositionend', function () {
        state.composing = false;
        wrapLooseBlocks();
      });

      const emitSelection = App.throttle(() => {
        if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
      }, 90);
      state.emitSelection = emitSelection;

      const emitInput = () => {
        if (opts.onInput) opts.onInput(api.getHtml());
      };
      const emitScroll = App.throttle(() => {
        if (state.silentScroll) return;
        if (opts.onScroll) opts.onScroll(api.getScrollInfo());
      }, 70);

      state.body.addEventListener('input', emitInput);
      doc.addEventListener('selectionchange', () => {
        api.saveSelection();
        emitSelection();
      });
      state.body.addEventListener('keyup', emitSelection);
      state.body.addEventListener('mouseup', emitSelection);
      state.body.addEventListener('focus', emitSelection);
      win.addEventListener('scroll', emitScroll, { passive: true });

      state.body.addEventListener('paste', onPaste);
      state.body.addEventListener('drop', onDrop);
      state.body.addEventListener('dragover', (event) => {
        if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files')) {
          event.preventDefault();
        }
      });
      state.body.addEventListener('keydown', onKeyDown);
      state.body.addEventListener('click', onLinkClick);
      state.body.addEventListener('dblclick', function (event) {
        const target = event.target;
        if (target && target.tagName === 'IMG' && opts.onEditImage) {
          event.preventDefault();
          opts.onEditImage(target);
          return;
        }
        const math = target && target.closest ? target.closest('.math[data-tex]') : null;
        if (math && opts.onEditMath) {
          event.preventDefault();
          opts.onEditMath(math);
        }
      });

      state.ready = true;
      emitSelection();
    }

    /* ---------- Selección ---------- */
    function isInsideBody(node) {
      if (!node) return false;
      if (node === state.body) return true;
      return state.body.contains(node);
    }

    function saveSelection() {
      if (!state.ready) return;
      const sel = state.doc.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (isInsideBody(range.commonAncestorContainer)) {
        state.savedRange = range.cloneRange();
      }
    }

    function caretToEnd() {
      if (!state.ready) return null;
      state.body.focus();
      const sel = state.doc.getSelection();
      const range = state.doc.createRange();
      range.selectNodeContents(state.body);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      state.savedRange = range.cloneRange();
      return range;
    }

    function currentRange() {
      if (!state.ready) return null;
      if (state.savedRange && isInsideBody(state.savedRange.commonAncestorContainer)) {
        state.body.focus();
        const sel = state.doc.getSelection();
        sel.removeAllRanges();
        sel.addRange(state.savedRange);
        return state.savedRange;
      }
      const sel = state.doc.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (isInsideBody(range.commonAncestorContainer)) {
          state.savedRange = range.cloneRange();
          return range;
        }
      }
      return caretToEnd();
    }

    function restoreSelection() {
      const range = currentRange();
      if (range && opts.onSelectionChange) opts.onSelectionChange(api.getState());
      return range;
    }

    function focus() {
      if (!state.ready) return;
      state.body.focus();
      if (!state.savedRange) caretToEnd();
    }

    /* ---------- Comandos ---------- */
    const CSS_COMMANDS = new Set(['foreColor', 'hiliteColor', 'backColor', 'fontName']);

    function exec(command, value) {
      if (!state.ready) return;
      currentRange();
      try {
        state.doc.execCommand('styleWithCSS', false, CSS_COMMANDS.has(command));
      } catch (error) { /* ignorar */ }
      try {
        state.doc.execCommand(command, false, value == null ? null : value);
      } catch (error) {
        /* comando no soportado */
      }
      normalizeFonts();
      state.savedRange = null;
      saveSelection();
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function normalizeFonts() {
      if (!state.ready) return;
      Array.from(state.body.querySelectorAll('font')).forEach((font) => {
        const span = state.doc.createElement('span');
        const size = font.getAttribute('size');
        const face = font.getAttribute('face');
        const color = font.getAttribute('color');
        if (size && FONT_SIZE_MAP[size]) span.style.fontSize = FONT_SIZE_MAP[size] + 'px';
        if (face) span.style.fontFamily = face;
        if (color) span.style.color = color;
        while (font.firstChild) span.appendChild(font.firstChild);
        if (span.getAttribute('style')) font.replaceWith(span);
        else {
          const parent = font.parentNode;
          while (font.firstChild) parent.insertBefore(font.firstChild, font);
          parent.removeChild(font);
        }
      });
    }

    function setBlock(tag) {
      const clean = String(tag || 'p').replace(/[^a-z0-9]/gi, '');
      exec('formatBlock', '<' + (clean || 'p') + '>');
    }

    function setFontFamily(family) {
      if (!family) return;
      exec('fontName', family);
    }

    function setFontSize(px) {
      const size = Number(px);
      const level = Object.keys(FONT_SIZE_MAP).find((key) => FONT_SIZE_MAP[key] === size);
      if (!level) return;
      exec('fontSize', level);
    }

    function applyColor(color, command) {
      if (!state.ready) return;
      currentRange();
      const cmd = command === 'hiliteColor' ? 'hiliteColor' : 'foreColor';
      try {
        state.doc.execCommand('styleWithCSS', false, true);
      } catch (error) { /* ignorar */ }
      let applied = false;
      try {
        applied = state.doc.execCommand(cmd, false, color);
      } catch (error) { applied = false; }
      if (!applied && cmd === 'hiliteColor') {
        try { state.doc.execCommand('backColor', false, color); } catch (error) { /* ignorar */ }
      }
      normalizeFonts();
      state.savedRange = null;
      saveSelection();
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function clearFormatting() {
      if (!state.ready) return;
      currentRange();
      try { state.doc.execCommand('removeFormat', false, null); } catch (error) { /* ignorar */ }
      const block = String(api.getState().block || '').toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'].includes(block)) {
        try { state.doc.execCommand('formatBlock', false, '<p>'); } catch (error) { /* ignorar */ }
      }
      state.savedRange = null;
      saveSelection();
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    /* ---------- Estado de la barra ---------- */
    function query(command) {
      if (!state.ready) return false;
      try { return state.doc.queryCommandState(command); } catch (error) { return false; }
    }

    function queryValue(command) {
      if (!state.ready) return '';
      try { return state.doc.queryCommandValue(command); } catch (error) { return ''; }
    }

    function getLinkElement() {
      if (!state.ready) return null;
      const sel = state.doc.getSelection();
      let node = sel && sel.anchorNode ? sel.anchorNode : null;
      if (node && node.nodeType === 3) node = node.parentElement;
      if (!node || !node.closest) return null;
      const link = node.closest('a[href]');
      return link && isInsideBody(link) ? link : null;
    }

    function imageFromRange(range) {
      if (!range) return null;
      let scope = range.commonAncestorContainer;
      if (scope.nodeType === 3) scope = scope.parentNode;
      if (scope && scope.tagName === 'IMG') return scope;
      if (range.collapsed) return null;
      if (range.startContainer === range.endContainer && range.startContainer.nodeType === 1) {
        const child = range.startContainer.childNodes[range.startOffset];
        if (child && child.tagName === 'IMG') return child;
      }
      if (!scope || !scope.querySelectorAll) return null;
      const hits = Array.prototype.filter.call(scope.querySelectorAll('img'), function (img) {
        try { return range.intersectsNode(img); } catch (error) { return false; }
      });
      return hits.length === 1 ? hits[0] : null;
    }

    function getImageElement() {
      if (!state.ready) return null;
      const sel = state.doc.getSelection();
      const live = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      const range = live && !live.collapsed ? live : (state.savedRange || live);
      const fromRange = imageFromRange(range);
      if (fromRange && isInsideBody(fromRange)) return fromRange;
      // El cursor puede estar dentro de una imagen o justo después
      let node = sel && sel.anchorNode ? sel.anchorNode : (range ? range.commonAncestorContainer : null);
      if (node && node.nodeType === 3) node = node.parentNode;
      if (!node || !node.closest) return null;
      const direct = node.closest('img');
      if (direct && isInsideBody(direct)) return direct;
      if (range && !range.collapsed) return null;
      let element = node;
      while (element && element !== state.body) {
        let prev = element.previousSibling;
        while (prev && prev.nodeType !== 1) prev = prev.previousSibling;
        if (prev) {
          const img = prev.tagName === 'IMG' ? prev : (prev.querySelector ? prev.querySelector('img') : null);
          if (img && isInsideBody(img)) return img;
          break;
        }
        element = element.parentElement;
      }
      return null;
    }

    function getState() {
      const blockRaw = queryValue('formatBlock');
      const block = String(blockRaw || '').replace(/[<>]/g, '').toLowerCase();
      return {
        bold: query('bold'),
        italic: query('italic'),
        underline: query('underline'),
        strikeThrough: query('strikeThrough'),
        superscript: query('superscript'),
        subscript: query('subscript'),
        justifyLeft: query('justifyLeft'),
        justifyCenter: query('justifyCenter'),
        justifyRight: query('justifyRight'),
        justifyFull: query('justifyFull'),
        insertUnorderedList: query('insertUnorderedList'),
        insertOrderedList: query('insertOrderedList'),
        block: block || 'p',
        link: !!getLinkElement(),
        canUndo: (function () { try { return state.doc.queryCommandEnabled('undo'); } catch (error) { return false; } })(),
        canRedo: (function () { try { return state.doc.queryCommandEnabled('redo'); } catch (error) { return false; } })(),
        inBody: isInsideBody(state.doc.getSelection() && state.doc.getSelection().anchorNode),
      };
    }

    /* ---------- Lectura / escritura ---------- */

    const INLINE_TAGS = {
      A: 1, ABBR: 1, B: 1, BDI: 1, BDO: 1, BR: 1, CITE: 1, CODE: 1, DATA: 1, DEL: 1,
      DFN: 1, EM: 1, FONT: 1, I: 1, IMG: 1, INS: 1, KBD: 1, MARK: 1, Q: 1, S: 1,
      SAMP: 1, SMALL: 1, SPAN: 1, STRONG: 1, SUB: 1, SUP: 1, TIME: 1, U: 1, VAR: 1, WBR: 1,
    };

    function isLooseInline(node) {
      if (node.nodeType === 3) return true;
      return node.nodeType === 1 && !!INLINE_TAGS[node.tagName];
    }

    /**
     * Envuelve en <p> el texto o los elementos en línea que estén sueltos
     * directamente en el body. Así la primera línea de un documento que llega
     * como texto plano (por ejemplo desde el panel de código) también es un
     * párrafo y el HTML generado es siempre válido.
     */
    function wrapLooseBlocks() {
      if (!state.ready || state.composing) return false;
      const body = state.body;
      const runs = [];
      let run = null;
      Array.prototype.forEach.call(body.childNodes, function (node) {
        if (isLooseInline(node)) {
          if (!run) {
            run = [];
            runs.push(run);
          }
          run.push(node);
        } else {
          run = null;
        }
      });
      let changed = false;
      runs.forEach(function (nodes) {
        const meaningful = nodes.some(function (node) {
          return node.nodeType === 1 || String(node.nodeValue || '').trim() !== '';
        });
        if (!meaningful) return;
        if (nodes.length === 1 && nodes[0].nodeName === 'BR') return;
        const paragraph = state.doc.createElement('p');
        body.insertBefore(paragraph, nodes[0]);
        nodes.forEach(function (node) { paragraph.appendChild(node); });
        changed = true;
      });
      return changed;
    }

    /**
     * Las casillas de las listas de tareas se guardan desactivadas en el HTML
     * (como las genera Markdown), pero dentro del editor deben poder pulsarse.
     */
    function prepareTaskInputs() {
      if (!state.ready) return;
      state.body.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
        if (box.hasAttribute('disabled')) {
          box.setAttribute('data-task-disabled', '1');
          box.removeAttribute('disabled');
        }
        box.removeAttribute('contenteditable');
      });
    }

    function syncTaskInputs(root) {
      root.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
        if (box.checked) box.setAttribute('checked', 'checked');
        else box.removeAttribute('checked');
        if (box.getAttribute('data-task-disabled') === '1') {
          box.setAttribute('disabled', 'disabled');
          box.removeAttribute('data-task-disabled');
        }
        box.removeAttribute('data-task');
      });
    }

    function emitTaskChange() {
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function getHtml() {
      if (!state.ready) return '';
      wrapLooseBlocks();
      let root = state.body;
      if (state.body.querySelector('input[type="checkbox"]')) {
        root = state.body.cloneNode(true);
        syncTaskInputs(root);
      }
      const html = root.innerHTML || '';
      if (!html || html === '<br>' || html === '<p><br></p>') return '';
      return html;
    }

    /**
     * Texto visible del documento, tal y como lo pinta el navegador. Las
     * ecuaciones se ocultan al medir: su MathML no es texto del documento y
     * falsearía el recuento de caracteres y palabras.
     */
    function getText() {
      if (!state.ready) return '';
      const hidden = [];
      state.body.querySelectorAll('.math[data-tex]').forEach(function (node) {
        hidden.push([node, node.style.display]);
        node.style.display = 'none';
      });
      const text = state.body.innerText || state.body.textContent || '';
      hidden.forEach(function (pair) { pair[0].style.display = pair[1]; });
      return text;
    }

    function setTheme(theme) {
      state.theme = theme === 'dark' ? 'dark' : 'light';
      if (state.doc) state.doc.documentElement.setAttribute('data-theme', state.theme);
    }

    /** Ruta de índices desde <body> hasta un nodo, para poder recuperarlo
     *  después de sustituir el HTML (una Range apunta a nodos que ya no están). */
    function nodePath(node) {
      const path = [];
      let current = node;
      while (current && current !== state.body) {
        const parent = current.parentNode;
        if (!parent) return null;
        path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
        current = parent;
      }
      return current === state.body ? path : null;
    }

    function nodeFromPath(path) {
      let node = state.body;
      for (let i = 0; i < path.length; i += 1) {
        node = node.childNodes[path[i]];
        if (!node) return null;
      }
      return node;
    }

    function readSelection() {
      const sel = state.doc.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      if (!isInsideBody(range.commonAncestorContainer)) return null;
      const anchorPath = nodePath(range.startContainer);
      const focusPath = nodePath(range.endContainer);
      if (!anchorPath || !focusPath) return null;
      return {
        anchor: { path: anchorPath, offset: range.startOffset },
        focus: { path: focusPath, offset: range.endOffset },
      };
    }

    function restoreSelection(saved) {
      if (!saved) return false;
      const anchorNode = nodeFromPath(saved.anchor.path);
      const focusNode = nodeFromPath(saved.focus.path);
      if (!anchorNode || !focusNode) return false;
      const range = state.doc.createRange();
      try {
        range.setStart(anchorNode, Math.min(saved.anchor.offset, anchorNode.nodeType === 1 ? anchorNode.childNodes.length : (anchorNode.nodeValue || '').length));
        range.setEnd(focusNode, Math.min(saved.focus.offset, focusNode.nodeType === 1 ? focusNode.childNodes.length : (focusNode.nodeValue || '').length));
        const sel = state.doc.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        state.savedRange = range.cloneRange();
        return true;
      } catch (error) {
        return false;
      }
    }

    function setHtml(html) {
      if (!state.ready) return;
      let value = String(html == null ? '' : html);
      if (App.isFullDocument && App.isFullDocument(value)) {
        value = App.extractBody(value).html;
      }
      const win = state.win;
      const scrollY = win ? (win.scrollY || win.pageYOffset || 0) : 0;
      /* Solo se toca la selección si el documento visual tenía el foco: en
         caso contrario se pisaría la del panel en el que se está escribiendo. */
      const hadFocus = state.doc.hasFocus();
      const savedSelection = hadFocus ? readSelection() : null;
      /* El reemplazo del contenido puede disparar un scroll momentáneo: no debe
         propagarse al panel de código ni arrastrarlo. */
      state.silentScroll = true;
      try {
        state.body.innerHTML = value;
        state.activeImage = null;
        if (!value || !state.body.textContent.trim() && !state.body.querySelector('img,table,hr,ul,ol,blockquote')) {
          state.body.innerHTML = '<p><br></p>';
        } else {
          wrapLooseBlocks();
        }
        prepareTaskInputs();
      } finally {
        state.silentScroll = false;
      }
      if (win) {
        win.scrollTo(0, scrollY);
        /* Segundo ajuste tras el reflujo: el navegador recorta el scroll si el
           documento aún no ha recuperado su altura. */
        win.requestAnimationFrame(function () {
          if (!state.ready) return;
          /* Si mientras tanto alguien ha movido la vista, no se toca. */
          if (Math.abs((win.scrollY || 0) - scrollY) > 2) return;
          win.scrollTo(0, scrollY);
        });
        try { state.doc.execCommand('styleWithCSS', false, false); } catch (error) { /* ignorar */ }
      }
      restoreSelection(savedSelection);
    }

    function setScrollRatio(ratio) {
      if (!state.ready) return;
      const win = state.win;
      const doc = state.doc;
      const max = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
      win.scrollTo(0, Math.round(max * Math.max(0, Math.min(1, ratio))));
    }

    function getScrollInfo() {
      if (!state.ready) return { top: 0, max: 0, ratio: 0 };
      const win = state.win;
      const doc = state.doc;
      const max = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
      const top = win.scrollY || win.pageYOffset || doc.documentElement.scrollTop || 0;
      return { top, max, ratio: max > 0 ? top / max : 0 };
    }

    function insertHtml(html) {
      if (!state.ready) return;
      currentRange();
      try {
        state.doc.execCommand('insertHTML', false, html);
      } catch (error) {
        const range = currentRange();
        if (range) {
          const fragment = range.createContextualFragment(html);
          range.deleteContents();
          range.insertNode(fragment);
        }
      }
      state.savedRange = null;
      prepareTaskInputs();
      saveSelection();
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    /**
     * Inserta HTML conservando etiquetas que execCommand descarta (por
     * ejemplo <time>) y deja el cursor justo después del contenido.
     */
    function insertFragment(html) {
      if (!state.ready) return false;
      const range = currentRange();
      if (!range || !range.createContextualFragment) return false;
      const fragment = range.createContextualFragment(String(html || ''));
      const last = fragment.lastChild;
      range.deleteContents();
      range.insertNode(fragment);
      if (last) {
        const after = state.doc.createRange();
        after.setStartAfter(last);
        after.collapse(true);
        const sel = state.doc.getSelection();
        sel.removeAllRanges();
        sel.addRange(after);
        state.savedRange = after.cloneRange();
      }
      prepareTaskInputs();
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
      return true;
    }

    /** Sustituye un nodo del documento por el HTML indicado ('' lo elimina). */
    function replaceElement(node, html) {
      if (!state.ready || !node || !node.parentNode) return false;
      const holder = state.doc.createElement('div');
      holder.innerHTML = String(html == null ? '' : html);
      const fragment = state.doc.createDocumentFragment();
      while (holder.firstChild) fragment.appendChild(holder.firstChild);
      node.parentNode.replaceChild(fragment, node);
      state.savedRange = null;
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
      return true;
    }

    function insertNode(node, afterNode) {
      const range = currentRange();
      if (!range) return;
      const target = afterNode || node;
      range.deleteContents();
      range.insertNode(node);
      const after = state.doc.createRange();
      after.setStartAfter(target);
      after.collapse(true);
      const sel = state.doc.getSelection();
      sel.removeAllRanges();
      sel.addRange(after);
      state.savedRange = after.cloneRange();
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function insertLink(link) {
      if (!state.ready) return;
      const url = String(link.url || '').trim();
      if (!url) return;
      const text = String(link.text || '').trim();
      const existing = getLinkElement();
      const target = link.target ? '_blank' : '';
      const rel = [link.nofollow ? 'nofollow' : '', link.target ? 'noopener noreferrer' : ''].filter(Boolean).join(' ');

      if (existing) {
        existing.setAttribute('href', url);
        if (target) existing.setAttribute('target', target); else existing.removeAttribute('target');
        if (rel) existing.setAttribute('rel', rel); else existing.removeAttribute('rel');
        if (text && text !== existing.textContent.trim()) existing.textContent = text;
        state.savedRange = null;
        if (opts.onInput) opts.onInput(api.getHtml());
        if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
        return;
      }

      const anchor = state.doc.createElement('a');
      anchor.setAttribute('href', url);
      if (target) anchor.setAttribute('target', target);
      if (rel) anchor.setAttribute('rel', rel);
      anchor.textContent = text || url;
      insertNode(anchor);
      state.savedRange = null;
      saveSelection();
    }

    function removeLink() {
      const link = getLinkElement();
      if (!link) return;
      const parent = link.parentNode;
      while (link.firstChild) parent.insertBefore(link.firstChild, link);
      parent.removeChild(link);
      state.savedRange = null;
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function insertImage(image) {
      if (!state.ready) return;
      const src = String(image.src || '').trim();
      if (!src) return;

      // Construimos el fragmento en un contenedor temporal para escapar bien los datos
      const template = state.doc.createElement('div');
      const img = state.doc.createElement('img');
      img.setAttribute('src', src);
      img.setAttribute('alt', image.alt || '');
      if (image.width) img.setAttribute('width', String(image.width));

      let node = img;
      if (image.link) {
        const anchor = state.doc.createElement('a');
        anchor.setAttribute('href', src);
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
        anchor.appendChild(img);
        node = anchor;
      }
      template.appendChild(node);
      const paragraph = state.doc.createElement('p');
      paragraph.setAttribute('data-insert-caret', '1');
      paragraph.appendChild(state.doc.createElement('br'));
      template.appendChild(paragraph);

      insertHtml(template.innerHTML);

      const caretTarget = state.body.querySelector('p[data-insert-caret="1"]');
      if (caretTarget) {
        caretTarget.removeAttribute('data-insert-caret');
        const range = state.doc.createRange();
        range.setStart(caretTarget, 0);
        range.collapse(true);
        const sel = state.doc.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        state.savedRange = range.cloneRange();
      }
    }

    function updateImage(img, data) {
      if (!state.ready || !img || !img.isConnected || !isInsideBody(img)) return;
      const info = data || {};
      const src = String(info.src || img.getAttribute('src') || '').trim();
      if (src) img.setAttribute('src', src);
      img.setAttribute('alt', info.alt || '');
      if (info.width) img.setAttribute('width', String(info.width));
      else img.removeAttribute('width');

      let anchor = img.parentNode && img.parentNode.tagName === 'A' ? img.parentNode : null;
      if (info.link) {
        if (!anchor) {
          anchor = state.doc.createElement('a');
          img.parentNode.insertBefore(anchor, img);
          anchor.appendChild(img);
        }
        anchor.setAttribute('href', src);
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      } else if (anchor) {
        const parent = anchor.parentNode;
        parent.insertBefore(img, anchor);
        anchor.remove();
      }

      state.savedRange = null;
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function removeImage(img) {
      if (!state.ready || !img || !img.isConnected) return;
      const anchor = img.parentNode && img.parentNode.tagName === 'A' ? img.parentNode : null;
      (anchor || img).remove();
      state.savedRange = null;
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function setSpellcheck(on) {
      if (!state.ready) return;
      const value = on !== false ? 'true' : 'false';
      state.body.setAttribute('spellcheck', value);
      try { state.body.spellcheck = on !== false; } catch (error) { /* ignorar */ }
    }

    /** Idioma de la corrección ortográfica: «auto» deja decidir al navegador. */
    function setLanguage(lang) {
      state.lang = lang || 'es';
      if (!state.ready) return;
      const value = state.lang === 'auto' ? '' : state.lang;
      if (value) {
        state.doc.documentElement.setAttribute('lang', value);
        state.body.setAttribute('lang', value);
      } else {
        state.doc.documentElement.removeAttribute('lang');
        state.body.removeAttribute('lang');
      }
    }

    function setPage(page) {
      state.page = page || null;
      if (!state.ready) return;
      if (App.Page) App.Page.bodyStyle(state.page || App.Page.DEFAULT, state.body);
    }

    function elementFromNode(node) {
      if (!node) return null;
      return node.nodeType === 1 ? node : node.parentElement;
    }

    /** Elemento img o celda de tabla donde está el cursor o el último clic. */
    function getContext() {
      if (!state.ready) return { image: null, table: null, cell: null, row: null };
      let range = state.savedRange;
      const sel = state.doc.getSelection();
      if (sel && sel.rangeCount && isInsideBody(sel.anchorNode)) range = sel.getRangeAt(0);
      const node = range ? elementFromNode(range.startContainer) : null;
      const cell = node && node.closest ? node.closest('td,th') : null;
      const table = cell ? cell.closest('table') : (node && node.closest ? node.closest('table') : null);
      let image = state.activeImage && state.activeImage.isConnected ? state.activeImage : null;
      if (!image && node && node.closest) image = node.closest('img');
      if (image && !state.body.contains(image)) image = null;
      return { image: image, table: table, cell: cell, row: cell ? cell.parentElement : null };
    }

    function focusCell(cell) {
      if (!cell) return;
      try {
        state.win.focus();
        const range = state.doc.createRange();
        range.selectNodeContents(cell);
        range.collapse(true);
        const sel = state.doc.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        state.savedRange = range.cloneRange();
        if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
      } catch (error) { /* sin selección */ }
    }

    /**
     * Añade o quita filas y columnas de la tabla donde está el cursor.
     * Devuelve el nombre de la acción o un motivo de error ('last-row'…).
     */
    function tableAction(action) {
      if (!state.ready) return false;
      const context = getContext();
      const cell = context.cell;
      const table = context.table;
      if (!cell || !table || !cell.parentElement) return false;
      const row = cell.parentElement;
      const rows = Array.prototype.slice.call(table.rows || []);
      const cellIndex = Array.prototype.indexOf.call(row.children, cell);
      let target = null;

      if (action === 'row-above' || action === 'row-below') {
        const newRow = state.doc.createElement('tr');
        Array.prototype.forEach.call(row.children, function (source) {
          const created = state.doc.createElement(source.tagName === 'TH' ? 'th' : 'td');
          created.innerHTML = '<br>';
          newRow.appendChild(created);
        });
        if (action === 'row-above') row.parentNode.insertBefore(newRow, row);
        else row.parentNode.insertBefore(newRow, row.nextSibling);
        target = newRow.children[Math.min(cellIndex, newRow.children.length - 1)];
      } else if (action === 'col-left' || action === 'col-right') {
        rows.forEach(function (currentRow) {
          const cells = Array.prototype.slice.call(currentRow.children);
          if (!cells.length) return;
          const reference = cells[Math.min(cellIndex, cells.length - 1)];
          const created = state.doc.createElement(reference.tagName === 'TH' ? 'th' : 'td');
          created.innerHTML = '<br>';
          if (action === 'col-left') currentRow.insertBefore(created, reference);
          else currentRow.insertBefore(created, reference.nextSibling);
          if (currentRow === row) target = created;
        });
      } else if (action === 'row-remove') {
        if (rows.length <= 1) return 'last-row';
        const nextRow = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        target = nextRow ? nextRow.children[Math.min(cellIndex, nextRow.children.length - 1)] : null;
      } else if (action === 'col-remove') {
        const most = rows.reduce(function (max, currentRow) {
          return Math.max(max, currentRow.children.length);
        }, 0);
        if (most <= 1) return 'last-col';
        rows.forEach(function (currentRow) {
          if (currentRow.children.length <= 1) return;
          const remove = currentRow.children[cellIndex] || currentRow.children[currentRow.children.length - 1];
          if (remove) remove.remove();
        });
        target = row.children[Math.min(cellIndex, row.children.length - 1)] || null;
      } else {
        return false;
      }

      if (target) focusCell(target);
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
      return action;
    }

    function setImageWidth(image, width) {
      if (!image || !image.style) return;
      const value = Math.max(16, Math.min(4000, Math.round(Number(width) || 0)));
      image.style.width = value + 'px';
      image.style.height = 'auto';
    }

    /** Avisa de un cambio hecho desde fuera para sincronizar y guardar. */
    function commit() {
      if (!state.ready) return;
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
    }

    function insertTable(rows, cols, withHeader, withBorder) {
      const safeRows = Math.max(1, Math.min(30, Number(rows) || 3));
      const safeCols = Math.max(1, Math.min(12, Number(cols) || 3));
      let html = '<table' + (withBorder ? ' border="1" cellpadding="6" cellspacing="0"' : '') + '>';
      if (withHeader) {
        html += '<thead><tr>';
        for (let c = 0; c < safeCols; c++) html += '<th><br></th>';
        html += '</tr></thead>';
      }
      html += '<tbody>';
      const bodyRows = withHeader ? safeRows - 1 : safeRows;
      for (let r = 0; r < Math.max(1, bodyRows); r++) {
        html += '<tr>';
        for (let c = 0; c < safeCols; c++) html += '<td><br></td>';
        html += '</tr>';
      }
      html += '</tbody></table><p><br></p>';
      insertHtml(html);
    }

    /* ---------- Portapapeles ---------- */
    function sanitizePastedHtml(html) {
      const parsed = new DOMParser().parseFromString(
        '<!doctype html><html><body>' + String(html || '') + '</body></html>',
        'text/html'
      );
      const root = parsed.body;
      root.querySelectorAll(PASTE_DROP_TAGS).forEach((el) => el.remove());

      const walker = parsed.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
      const comments = [];
      let comment;
      while ((comment = walker.nextNode())) comments.push(comment);
      comments.forEach((node) => node.remove());

      Array.from(root.querySelectorAll('*')).forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (/:/.test(tag)) {
          const parent = el.parentNode;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          return;
        }
        Array.from(el.attributes).forEach((attr) => {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
            return;
          }
          if (name === 'class' && /(^|\s)Mso/i.test(attr.value)) el.removeAttribute('class');
          if (name === 'style') {
            const cleaned = attr.value
              .split(';')
              .filter((decl) => !/^\s*mso-[^:]+:/i.test(decl))
              .join(';')
              .trim();
            if (cleaned) el.setAttribute('style', cleaned); else el.removeAttribute('style');
          }
          if ((name === 'href' || name === 'src') && /^\s*(javascript|vbscript|data:text\/html)/i.test(attr.value)) {
            el.removeAttribute(attr.name);
          }
        });
      });

      return root.innerHTML;
    }

    function onPaste(event) {
      const data = event.clipboardData;
      if (!data) return;
      const files = Array.from(data.files || []).filter((file) => file.type.startsWith('image/'));
      if (files.length) {
        event.preventDefault();
        files.slice(0, 3).forEach((file) => {
          if (file.size > 4 * 1024 * 1024) {
            App.toast('La imagen pegada supera los 4 MB y no se ha insertado.', 'warn');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => api.insertImage({ src: reader.result, alt: file.name || 'Imagen pegada' });
          reader.readAsDataURL(file);
        });
        return;
      }
      const html = data.getData('text/html');
      if (html) {
        event.preventDefault();
        const cleaned = sanitizePastedHtml(html);
        if (cleaned && cleaned.trim()) {
          try { state.doc.execCommand('insertHTML', false, cleaned); } catch (error) { /* ignorar */ }
          state.savedRange = null;
          saveSelection();
          if (opts.onInput) opts.onInput(api.getHtml());
        }
        return;
      }
      // El texto plano se pega con el comportamiento nativo
    }

    function onDrop(event) {
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) {
        event.preventDefault();
        if (opts.onDropFiles) opts.onDropFiles(Array.from(files));
      }
    }

    function onLinkClick(event) {
      const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
      if (!anchor) return;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const href = anchor.getAttribute('href') || '';
        if (href && !href.startsWith('#') && !/^\s*javascript:/i.test(href)) {
          global.open(href, '_blank', 'noopener,noreferrer');
        }
      } else {
        event.preventDefault();
      }
    }

    function onKeyDown(event) {
      const mod = App.isMac ? event.metaKey : event.ctrlKey;
      if (!mod) {
        if (event.key === 'F1' && opts.onShortcut) {
          event.preventDefault();
          opts.onShortcut('help', event);
        } else if (event.key === 'F11' && opts.onShortcut) {
          event.preventDefault();
          opts.onShortcut('focus', event);
        }
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 's' && !event.shiftKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('save', event);
      } else if (key === 'k' && event.shiftKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('clean', event);
      } else if (key === 'l' && event.shiftKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('link', event);
      } else if (key === 'k') {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('palette', event);
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('indent', event);
      } else if (key === 'd' && event.altKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('download', event);
      } else if (key === 'p' && event.shiftKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('preview', event);
      } else if (key === 'p' && !event.shiftKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('print', event);
      }
    }

    const api = {
      ready: readyPromise,
      frame: frame,
      get document() { return state.doc; },
      get body() { return state.body; },
      get isReady() { return state.ready; },
      getHtml,
      setHtml,
      focus,
      saveSelection,
      restoreSelection,
      exec,
      setBlock,
      setFontFamily,
      setFontSize,
      applyColor,
      clearFormatting,
      insertHtml,
      insertFragment,
      replaceElement,
      insertLink,
      removeLink,
      insertImage,
      updateImage,
      removeImage,
      setSpellcheck,
      setLanguage,
      setPage,
      getContext,
      tableAction,
      setImageWidth,
      commit,
      insertTable,
      getLinkElement,
      getImageElement,
      getState,
      getText,
      setTheme,
      getScrollInfo,
      setScrollRatio,
      normalizeFonts,
    };

    return api;
  };
})(window);
