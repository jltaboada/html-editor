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
    html, body { margin: 0; padding: 0; }
    body {
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
    body:empty::before {
      content: attr(data-placeholder);
      color: #9aa3a0;
      pointer-events: none;
    }
    h1, h2, h3, h4, h5, h6 { margin: 1.1em 0 .5em; line-height: 1.2; letter-spacing: -.015em; font-weight: 700; }
    h1:first-child, h2:first-child, h3:first-child, p:first-child { margin-top: 0; }
    h1 { font-size: 2.15em; }
    h2 { font-size: 1.6em; }
    h3 { font-size: 1.3em; }
    h4 { font-size: 1.1em; }
    h5 { font-size: 1em; }
    h6 { font-size: .9em; text-transform: uppercase; letter-spacing: .05em; color: #5f452a; }
    p { margin: 0 0 .9em; }
    ul, ol { margin: 0 0 .9em; padding-left: 1.5em; }
    li { margin: .18em 0; }
    a { color: #02874d; text-decoration: underline; text-underline-offset: 2px; }
    a:hover { color: #026a3d; }
    img { max-width: 100%; height: auto; }
    figure { margin: 1em 0; }
    figcaption { color: #6b7280; font-size: .875em; }
    table { border-collapse: collapse; max-width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #dbdbdb; padding: 7px 10px; vertical-align: top; min-width: 2em; }
    th { background: #f2f6f5; font-weight: 700; text-align: left; }
    table[border="0"] th, table[border="0"] td { border: 0; }
    blockquote { margin: 1em 0; padding: .15em 0 .15em 16px; border-left: 3px solid #02874d; color: #4b5563; }
    pre { margin: 1em 0; padding: 14px 16px; border: 1px solid #dddddd; border-radius: 5px; background: #f5f5f5; overflow: auto; font-family: "Courier New", Courier, monospace; font-size: .875em; line-height: 1.55; white-space: pre-wrap; }
    code { padding: 2px 5px; border-radius: 4px; background: #f5f5f5; font-family: "Courier New", Courier, monospace; font-size: .9em; }
    pre code { padding: 0; background: none; }
    hr { border: 0; border-top: 1px solid #dddddd; margin: 1.8em 0; }
    mark { background: #fff3cd; padding: 0 2px; }
    small { font-size: .85em; }
    sup, sub { line-height: 0; }
    ::selection { background: rgba(2, 135, 77, .22); }
    table { table-layout: auto; }
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
      '<body contenteditable="true" spellcheck="true" data-placeholder="Empieza a escribir aquí…"></body>',
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

      const emitSelection = App.throttle(() => {
        if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
      }, 90);
      state.emitSelection = emitSelection;

      const emitInput = () => {
        if (opts.onInput) opts.onInput(api.getHtml());
      };
      const emitScroll = App.throttle(() => {
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
    function getHtml() {
      if (!state.ready) return '';
      const html = state.body.innerHTML || '';
      if (!html || html === '<br>' || html === '<p><br></p>') return '';
      return html;
    }

    function setHtml(html) {
      if (!state.ready) return;
      let value = String(html == null ? '' : html);
      if (App.isFullDocument && App.isFullDocument(value)) {
        value = App.extractBody(value).html;
      }
      const win = state.win;
      const scrollY = win ? (win.scrollY || win.pageYOffset || 0) : 0;
      const sel = state.doc.getSelection();
      let restoreRange = null;
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (isInsideBody(range.commonAncestorContainer)) restoreRange = range.cloneRange();
      }
      state.body.innerHTML = value;
      if (restoreRange && isInsideBody(restoreRange.commonAncestorContainer)) {
        try {
          sel.removeAllRanges();
          sel.addRange(restoreRange);
        } catch (error) { /* ignorar */ }
      }
      state.savedRange = restoreRange;
      if (win) {
        win.scrollTo(0, scrollY);
        try { state.doc.execCommand('styleWithCSS', false, false); } catch (error) { /* ignorar */ }
      }
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
      saveSelection();
      if (opts.onInput) opts.onInput(api.getHtml());
      if (opts.onSelectionChange) opts.onSelectionChange(api.getState());
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
      } else if (key === 'k') {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('link', event);
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('indent', event);
      } else if (key === 'd' && event.altKey) {
        event.preventDefault();
        if (opts.onShortcut) opts.onShortcut('download', event);
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
      insertLink,
      removeLink,
      insertImage,
      insertTable,
      getLinkElement,
      getState,
      getScrollInfo,
      setScrollRatio,
      normalizeFonts,
    };

    return api;
  };
})(window);
