/* Limpieza, formato, compresión y entidades HTML */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  /* =========================================================
     Utilidades de HTML
     ========================================================= */

  const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);

  const BLOCK_TAGS = new Set([
    'html', 'head', 'body', 'address', 'article', 'aside', 'blockquote', 'details',
    'dialog', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer',
    'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li',
    'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'caption',
    'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'ul', 'video', 'audio',
    'canvas', 'iframe', 'noscript', 'script', 'style', 'title', 'meta', 'link',
  ]);

  const RAW_TAGS = new Set(['pre', 'textarea', 'script', 'style']);

  const KEEP_EMPTY = new Set([
    ...VOID_TAGS, 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
    'colgroup', 'col', 'ul', 'ol', 'dl', 'select', 'option', 'optgroup',
    'textarea', 'iframe', 'video', 'audio', 'source', 'track', 'canvas', 'svg',
    'math', 'object', 'embed', 'template',
  ]);

  const MEDIA_SELECTOR = 'img,svg,video,audio,iframe,canvas,object,embed,input,textarea,select,button,hr,br,table,source,track';

  function parseHtml(html) {
    const source = String(html == null ? '' : html);
    const looksLikeDocument = /<html[\s>]/i.test(source) || /<body[\s>]/i.test(source) || /<!doctype/i.test(source);
    const input = looksLikeDocument
      ? source
      : '<!doctype html><html><body>' + source + '</body></html>';
    return new DOMParser().parseFromString(input, 'text/html');
  }

  function serializeBody(doc) {
    return doc.body ? doc.body.innerHTML : '';
  }

  function unwrap(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  function isProtected(el) {
    return !!(el.closest && el.closest('svg, math, script, style, textarea, pre, code'));
  }

  function eachElement(doc, callback) {
    Array.from(doc.body.querySelectorAll('*')).forEach(callback);
  }

  function walkTextNodes(root, callback) {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(callback);
  }

  /* Tokenizador tolerante a ">" dentro de atributos */
  function tokenizeHtml(html) {
    const source = String(html || '');
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      if (source[i] === '<') {
        if (source.startsWith('<!--', i)) {
          const end = source.indexOf('-->', i + 4);
          const stop = end === -1 ? source.length : end + 3;
          tokens.push({ type: 'comment', value: source.slice(i, stop) });
          i = stop;
          continue;
        }
        if (source.startsWith('<![CDATA[', i)) {
          const end = source.indexOf(']]>', i + 9);
          const stop = end === -1 ? source.length : end + 3;
          tokens.push({ type: 'tag', value: source.slice(i, stop), name: '![cdata[', closing: false, selfClosing: false });
          i = stop;
          continue;
        }
        let j = i + 1;
        let quote = '';
        while (j < source.length) {
          const ch = source[j];
          if (quote) {
            if (ch === quote) quote = '';
          } else if (ch === '"' || ch === "'") {
            quote = ch;
          } else if (ch === '>') {
            break;
          }
          j++;
        }
        const stop = j < source.length ? j + 1 : source.length;
        const value = source.slice(i, stop);
        const nameMatch = value.match(/^<\s*\/?\s*([a-zA-Z][a-zA-Z0-9:_-]*)/);
        const name = nameMatch ? nameMatch[1].toLowerCase() : '';
        tokens.push({
          type: 'tag',
          value,
          name,
          closing: /^<\s*\//.test(value),
          selfClosing: /\/\s*>$/.test(value),
          declaration: /^<\s*[!?]/.test(value),
        });
        i = stop;
        continue;
      }
      const next = source.indexOf('<', i);
      const stop = next === -1 ? source.length : next;
      tokens.push({ type: 'text', value: source.slice(i, stop) });
      i = stop;
    }
    return tokens;
  }

  App.tokenizeHtml = tokenizeHtml;

  /* =========================================================
     Reglas de limpieza
     ========================================================= */

  const STYLE_ATTRS = [
    'style', 'align', 'valign', 'bgcolor', 'background', 'border',
    'cellpadding', 'cellspacing', 'hspace', 'vspace', 'nowrap', 'clear',
    'color', 'face', 'size',
  ];

  const ALLOWED_ATTRS = {
    a: ['href', 'title', 'target', 'rel', 'name', 'hreflang', 'type'],
    img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'title', 'loading', 'decoding', 'referrerpolicy'],
    td: ['colspan', 'rowspan', 'scope', 'headers', 'abbr'],
    th: ['colspan', 'rowspan', 'scope', 'headers', 'abbr'],
    table: ['summary'],
    ol: ['start', 'reversed', 'type'],
    ul: ['type'],
    li: ['value'],
    time: ['datetime'],
    blockquote: ['cite'],
    q: ['cite'],
    del: ['cite', 'datetime'],
    ins: ['cite', 'datetime'],
    video: ['src', 'poster', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'playsinline', 'preload'],
    audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload'],
    source: ['src', 'srcset', 'sizes', 'type', 'media'],
    track: ['src', 'kind', 'srclang', 'label', 'default'],
    iframe: ['src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'loading', 'frameborder', 'referrerpolicy'],
    details: ['open'],
    dialog: ['open'],
    input: ['type', 'checked', 'disabled', 'readonly', 'placeholder', 'value', 'name'],
    textarea: ['rows', 'cols', 'placeholder', 'name', 'readonly', 'disabled'],
    select: ['name', 'multiple', 'disabled'],
    option: ['value', 'selected', 'disabled'],
  };

  function runInlineStyles(doc) {
    ['font', 'center', 'big', 'tt'].forEach((tag) => {
      Array.from(doc.body.querySelectorAll(tag)).forEach(unwrap);
    });
    eachElement(doc, (el) => {
      if (el.closest('svg,math')) return;
      STYLE_ATTRS.forEach((attr) => el.removeAttribute(attr));
    });
  }

  function runClassesIds(doc) {
    eachElement(doc, (el) => {
      if (el.closest('svg,math')) return;
      el.removeAttribute('class');
      el.removeAttribute('id');
      Array.from(el.attributes).forEach((attr) => {
        if (/^data-(mce|cke|tiny)/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
  }

  function meaningfulMedia(el) {
    return !!el.querySelector(MEDIA_SELECTOR) || !!el.matches(MEDIA_SELECTOR);
  }

  function removeEmpties(doc, onlyWhitespace) {
    let changed = true;
    let rounds = 0;
    while (changed && rounds < 8) {
      changed = false;
      rounds++;
      const elements = Array.from(doc.body.querySelectorAll('*')).reverse();
      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        if (KEEP_EMPTY.has(tag)) continue;
        if (el.closest('svg,math,pre,code,script,style,textarea')) continue;
        if (meaningfulMedia(el)) continue;
        const text = (el.textContent || '').replace(/&nbsp;/g, '').replace(/[\s\u00a0]/g, '');
        if (onlyWhitespace) {
          if (text === '' && (el.textContent || '').length > 0) {
            el.remove();
            changed = true;
          }
        } else if (text === '' && (el.textContent || '').length === 0) {
          el.remove();
          changed = true;
        }
      }
    }
  }

  function runEmptyTags(doc) { removeEmpties(doc, false); }
  function runSingleSpaceTags(doc) { removeEmpties(doc, true); }

  function runRepeatedSpaces(doc) {
    walkTextNodes(doc.body, (node) => {
      const parent = node.parentElement;
      if (parent && parent.closest('pre,code,textarea,script,style')) return;
      node.nodeValue = node.nodeValue.replace(/[ \t\u00a0]{2,}/g, ' ');
    });
  }

  function runComments(doc) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT, null);
    const comments = [];
    let node;
    while ((node = walker.nextNode())) comments.push(node);
    comments.forEach((comment) => comment.remove());
  }

  function runAttributes(doc) {
    eachElement(doc, (el) => {
      if (el.closest('svg,math')) return;
      const tag = el.tagName.toLowerCase();
      const allowed = ALLOWED_ATTRS[tag] || [];
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          return;
        }
        if (name.startsWith('aria-') || name === 'role' || name === 'lang' || name === 'dir') return;
        if (!allowed.includes(name)) el.removeAttribute(attr.name);
      });
      if (el.getAttribute('href') && /^\s*(javascript|vbscript):/i.test(el.getAttribute('href'))) el.removeAttribute('href');
      if (el.getAttribute('src') && /^\s*(javascript|vbscript|data:text\/html)/i.test(el.getAttribute('src'))) el.removeAttribute('src');
    });
  }

  function runScriptsStyles(doc) {
    doc.body.querySelectorAll('script,style,link,meta,title,base,noscript,template,object,embed').forEach((el) => el.remove());
  }

  const AI_CHAR_MAP = [
    ['â€œ', '"'], ['â€', '"'], ['â€™', "'"], ['â€“', '-'], ['â€”', '-'], ['â€¦', '...'],
    ['Â«', '"'], ['Â»', '"'], ['Â ', ' '], ['â€ž', '"'], ['â€š', "'"],
    ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã±', 'ñ'],
    ['Ã‰', 'É'], ['Ã‘', 'Ñ'], ['Ã¼', 'ü'], ['Ãœ', 'Ü'], ['Â¿', '¿'], ['Â¡', '¡'],
    [/[\u2018\u2019\u201A\u201B\u2032\u02BC\u00B4]/g, "'"],
    [/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"'],
    [/[\u2013\u2014\u2015\u2212]/g, '-'],
    [/\u2026/g, '...'],
    [/\u00A0/g, ' '],
    [/[\u200B-\u200D\u2060\uFEFF\u00AD\uFFFD]/g, ''],
    [/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''],
  ];

  function normalizeAiText(text) {
    let out = text;
    AI_CHAR_MAP.forEach((entry) => {
      const [from, to] = entry;
      out = typeof from === 'string' ? out.split(from).join(to) : out.replace(from, to);
    });
    return out;
  }

  function runAiChars(doc) {
    walkTextNodes(doc.body, (node) => {
      const parent = node.parentElement;
      if (parent && parent.closest('pre,code,script,style,textarea')) return;
      node.nodeValue = normalizeAiText(node.nodeValue);
    });
  }

  function runSmartNbsp(doc) {
    const blocks = doc.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th');
    blocks.forEach((block) => {
      if (block.closest('svg,math,pre,code')) return;
      const plain = (block.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (!plain || plain.split(/\s+/).length < 2) return;

      const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
      let last = null;
      let node;
      while ((node = walker.nextNode())) {
        if (/\S/.test(node.nodeValue)) last = node;
      }
      if (!last) return;
      const value = last.nodeValue;
      const match = value.match(/(\S+)([ \t]+)(\S{1,6})([ \t]*)$/);
      if (!match) return;
      if (!/[\p{L}\p{N}]/u.test(match[1]) || !/[\p{L}\p{N}]/u.test(match[3])) return;
      last.nodeValue = value.slice(0, match.index) + match[1] + '\u00a0' + match[3] + match[4];
    });
  }

  function runPlainText(doc) {
    const body = doc.body;
    body.querySelectorAll('script,style,template,noscript').forEach((el) => el.remove());
    const parts = [];
    const BLOCKS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'blockquote', 'figure', 'figcaption', 'address', 'main', 'form', 'fieldset', 'ul', 'ol', 'dl', 'table', 'tr', 'li']);
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.nodeValue);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') { parts.push('\n'); return; }
      if (tag === 'img') { parts.push(node.getAttribute('alt') || ''); return; }
      if (tag === 'li') parts.push('\n• ');
      else if (tag === 'td' || tag === 'th') parts.push('\t');
      else if (BLOCKS.has(tag)) parts.push('\n');
      Array.from(node.childNodes).forEach(walk);
      if (tag === 'li' || tag === 'td' || tag === 'th' || BLOCKS.has(tag)) parts.push('\n');
    }
    Array.from(body.childNodes).forEach(walk);
    let text = parts.join('')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  App.CLEANING_OPTIONS = [
    { id: 'styles', label: 'Estilos inline', desc: 'Quita style, align, valign y atributos de maquetación', icon: 'palette', defaultOn: true, run: runInlineStyles, mode: 'dom' },
    { id: 'classes', label: 'Clases e IDs', desc: 'Elimina class e id para dejar un marcado neutro', icon: 'hash', defaultOn: true, run: runClassesIds, mode: 'dom' },
    { id: 'empty', label: 'Etiquetas vacías', desc: 'Borra elementos sin contenido, como <p></p>', icon: 'eraser', defaultOn: true, run: runEmptyTags, mode: 'dom' },
    { id: 'singleSpace', label: 'Etiquetas con 1 espacio', desc: 'Elimina <p>&nbsp;</p> y similares', icon: 'pilcrow', defaultOn: true, run: runSingleSpaceTags, mode: 'dom' },
    { id: 'spaces', label: 'Espacios repetidos', desc: 'Colapsa espacios y &nbsp; consecutivos', icon: 'compress', defaultOn: true, run: runRepeatedSpaces, mode: 'dom' },
    { id: 'comments', label: 'Comentarios', desc: 'Quita los comentarios HTML, incluidos los condicionales', icon: 'terminal', defaultOn: true, run: runComments, mode: 'dom' },
    { id: 'attributes', label: 'Atributos de etiqueta', desc: 'Conserva solo href, src, alt y atributos esenciales', icon: 'settings', defaultOn: false, run: runAttributes, mode: 'dom' },
    { id: 'plain', label: 'A texto plano', desc: 'Elimina todo el marcado y deja solo el texto', icon: 'type', defaultOn: false, run: runPlainText, mode: 'text' },
    { id: 'nbsp', label: 'Smart &nbsp;', desc: 'Une palabras cortas al final para evitar huérfanas', icon: 'link', defaultOn: false, run: runSmartNbsp, mode: 'dom' },
    { id: 'ai', label: 'Caracteres IA', desc: 'Normaliza comillas, guiones, espacios invisibles y mojibake', icon: 'sparkles', defaultOn: false, run: runAiChars, mode: 'dom' },
    { id: 'scripts', label: 'Scripts y estilos', desc: 'Elimina bloques script, style, iframes y objetos', icon: 'shield', defaultOn: false, run: runScriptsStyles, mode: 'dom' },
  ];

  const CLEAN_ORDER = ['comments', 'scripts', 'styles', 'classes', 'attributes', 'spaces', 'empty', 'singleSpace', 'ai', 'nbsp', 'plain'];

  App.DEFAULT_CLEAN_IDS = App.CLEANING_OPTIONS.filter((opt) => opt.defaultOn).map((opt) => opt.id);

  function tidyMarkup(doc) {
    // Etiquetas de Office/XML: <o:p>, <w:sdt>, <v:shape>…
    const namespaced = Array.from(doc.body.querySelectorAll('*')).filter((el) => {
      if (el.closest('svg,math')) return false;
      return /:/.test(el.tagName);
    });
    namespaced.forEach(unwrap);

    // Metadatos que no pertenecen al body
    doc.body.querySelectorAll('meta,link,base,title').forEach((el) => el.remove());

    // Atributos vacíos y URLs peligrosas
    eachElement(doc, (el) => {
      if (el.closest('svg,math')) return;
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) el.removeAttribute(attr.name);
        if (attr.value === '' && !['alt', 'title', 'value', 'content'].includes(name)) el.removeAttribute(attr.name);
      });
      ['href', 'src', 'action'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value && /^\s*(javascript|vbscript|data:text\/html)/i.test(value)) el.removeAttribute(attr);
      });
    });

    // <b>/<i> se mantienen; <font> y <center> se desenvuelven en la regla de estilos
    return doc;
  }

  /**
   * Aplica un conjunto de reglas.
   * @param {string} html
   * @param {string[]} ids
   * @returns {string}
   */
  App.cleanHtml = function (html, ids) {
    const selected = new Set(Array.isArray(ids) ? ids : []);
    const doc = parseHtml(html);
    tidyMarkup(doc);

    for (const id of CLEAN_ORDER) {
      if (!selected.has(id)) continue;
      const option = App.CLEANING_OPTIONS.find((opt) => opt.id === id);
      if (!option) continue;
      if (option.mode === 'text') return option.run(doc);
      option.run(doc);
    }
    return serializeBody(doc);
  };

  App.cleanOne = function (html, id) {
    return App.cleanHtml(html, [id]);
  };

  /* =========================================================
     Indentación y compresión
     ========================================================= */

  App.prettyHtml = function (html) {
    const source = String(html || '').trim();
    if (!source) return '';
    if (typeof global.html_beautify !== 'function') return source;
    try {
      return global.html_beautify(source, {
        indent_size: 2,
        indent_char: ' ',
        max_preserve_newlines: 1,
        preserve_newlines: false,
        wrap_line_length: 0,
        end_with_newline: false,
        indent_inner_html: false,
        indent_empty_lines: false,
        extra_liners: [],
        unformatted: ['code', 'pre', 'em', 'strong', 'span', 'a', 'b', 'i', 'u', 'small', 'sub', 'sup', 'mark', 'br', 'img'],
        content_unformatted: ['pre', 'textarea', 'script', 'style'],
        inline: ['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'kbd', 'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'del', 'ins', 'font'],
        void_elements: Array.from(VOID_TAGS),
      });
    } catch (error) {
      return source;
    }
  };

  function isBlockTag(token) {
    if (!token || token.type !== 'tag' || token.declaration) return false;
    return BLOCK_TAGS.has(token.name);
  }

  App.compressHtml = function (html) {
    const source = String(html || '');
    if (!source.trim()) return '';

    // Proteger el contenido sensible de pre, textarea, script y style
    const rawBlocks = [];
    const protectedSource = source.replace(/<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (match) => {
      rawBlocks.push(match);
      return '\u0001RAW' + (rawBlocks.length - 1) + '\u0001';
    });

    const tokens = tokenizeHtml(protectedSource);
    let output = '';

    const nextMeaningful = (index) => {
      for (let i = index + 1; i < tokens.length; i++) {
        if (tokens[i].type === 'comment') continue;
        if (tokens[i].type === 'text' && !tokens[i].value.trim()) continue;
        return tokens[i];
      }
      return null;
    };
    const prevMeaningful = (index) => {
      for (let i = index - 1; i >= 0; i--) {
        if (tokens[i].type === 'comment') continue;
        if (tokens[i].type === 'text' && !tokens[i].value.trim()) continue;
        return tokens[i];
      }
      return null;
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'comment') continue;

      if (token.type === 'tag') {
        let value = token.value;
        if (!token.declaration) {
          // Normaliza espacios entre atributos, sin tocar valores entrecomillados
          value = value.replace(/\s+/g, ' ');
        }
        output += value;
        continue;
      }

      let text = token.value.replace(/\s+/g, ' ');
      if (!text.trim()) {
        const prev = prevMeaningful(i);
        const next = nextMeaningful(i);
        const prevInline = prev && prev.type === 'text' ? true : prev && !isBlockTag(prev);
        const nextInline = next && next.type === 'text' ? true : next && !isBlockTag(next);
        if (prevInline && nextInline) output += ' ';
        continue;
      }

      const prev = prevMeaningful(i);
      const next = nextMeaningful(i);
      if (!prev || isBlockTag(prev)) text = text.replace(/^ /, '');
      if (!next || isBlockTag(next)) text = text.replace(/ $/, '');
      output += text;
    }

    output = output
      .replace(/^ /, '')
      .replace(/ $/, '')
      .replace(/\u0001RAW(\d+)\u0001/g, (match, index) => rawBlocks[Number(index)] || '');

    return output;
  };

  /* =========================================================
     Entidades
     ========================================================= */

  const NAMED_ENTITIES = {
    'á': '&aacute;', 'é': '&eacute;', 'í': '&iacute;', 'ó': '&oacute;', 'ú': '&uacute;',
    'Á': '&Aacute;', 'É': '&Eacute;', 'Í': '&Iacute;', 'Ó': '&Oacute;', 'Ú': '&Uacute;',
    'ñ': '&ntilde;', 'Ñ': '&Ntilde;', 'ü': '&uuml;', 'Ü': '&Uuml;',
    '¡': '&iexcl;', '¿': '&iquest;', 'ª': '&ordf;', 'º': '&ordm;',
    '€': '&euro;', '£': '&pound;', '¥': '&yen;', '¢': '&cent;',
    '©': '&copy;', '®': '&reg;', '™': '&trade;', '§': '&sect;', '¶': '&para;',
    '—': '&mdash;', '–': '&ndash;', '…': '&hellip;', '·': '&middot;',
    '°': '&deg;', '±': '&plusmn;', '×': '&times;', '÷': '&divide;',
    '¼': '&frac14;', '½': '&frac12;', '¾': '&frac34;',
    '“': '&ldquo;', '”': '&rdquo;', '‘': '&lsquo;', '’': '&rsquo;',
    '«': '&laquo;', '»': '&raquo;', '‹': '&lsaquo;', '›': '&rsaquo;',
    '†': '&dagger;', '‡': '&Dagger;', '•': '&bull;', '‰': '&permil;',
    'α': '&alpha;', 'β': '&beta;', 'γ': '&gamma;', 'π': '&pi;', 'Ω': '&Omega;',
    '\u00a0': '&nbsp;',
  };

  function processTextTokens(html, callback) {
    const tokens = tokenizeHtml(html);
    let rawTag = null;
    return tokens.map((token) => {
      if (token.type === 'comment') return token.value;
      if (token.type !== 'tag') {
        if (token.type === 'text' && !rawTag) return callback(token.value);
        return token.type === 'text' ? token.value : '';
      }
      if (!token.declaration) {
        if (RAW_TAGS.has(token.name) && token.name !== 'pre' && token.name !== 'textarea') {
          if (token.closing) rawTag = null;
          else if (!token.selfClosing) rawTag = token.name;
        }
      }
      return token.value;
    }).join('');
  }

  function encodeText(text) {
    let out = '';
    for (const char of text) {
      const code = char.codePointAt(0);
      if (code < 128) {
        out += char;
      } else if (NAMED_ENTITIES[char]) {
        out += NAMED_ENTITIES[char];
      } else {
        out += '&#' + code + ';';
      }
    }
    return out;
  }

  function decodeEntity(entity) {
    const area = document.createElement('textarea');
    area.innerHTML = entity;
    return area.value;
  }

  App.encodeEntities = function (html) {
    return processTextTokens(String(html || ''), encodeText);
  };

  App.decodeEntities = function (html) {
    return processTextTokens(String(html || ''), (text) => text.replace(/&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g, (entity) => {
      const decoded = decodeEntity(entity);
      if (!decoded || decoded === entity) return entity;
      return Array.from(decoded).some((char) => char.codePointAt(0) > 127) ? decoded : entity;
    }));
  };

  /* =========================================================
     Documento completo / body
     ========================================================= */

  App.isFullDocument = function (html) {
    return /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html) || /<!doctype/i.test(html);
  };

  App.getDocumentTitle = function (html, fallback) {
    const doc = parseHtml(html);
    const title = (doc.title || '').trim();
    if (title) return title;
    const heading = doc.body && doc.body.querySelector('h1');
    if (heading && heading.textContent.trim()) return heading.textContent.trim().replace(/\s+/g, ' ');
    return fallback || 'Documento';
  };

  App.extractBody = function (html) {
    const source = String(html || '');
    if (!App.isFullDocument(source)) {
      return { html: source, wasFull: false, title: '', stylesPreserved: 0 };
    }
    const doc = parseHtml(source);
    const styles = Array.from(doc.head.querySelectorAll('style')).map((style) => style.outerHTML);
    return {
      html: (styles.length ? styles.join('\n') + '\n' : '') + (doc.body ? doc.body.innerHTML : ''),
      wasFull: true,
      title: (doc.title || '').trim(),
      stylesPreserved: styles.length,
    };
  };

  App.wrapDocument = function (bodyHtml, title) {
    const safeTitle = App.escapeHtml(title || 'Documento');
    const styles = [
      '    :root { color-scheme: light; }',
      '    body { max-width: 820px; margin: 0 auto; padding: 48px 24px; color: #222222; background: #fff; font-family: "Varela Round", "Trebuchet MS", "Segoe UI", system-ui, Arial, sans-serif; font-size: 16px; line-height: 1.65; }',
      '    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.2em 0 .5em; }',
      '    h1:first-child, h2:first-child, p:first-child { margin-top: 0; }',
      '    p { margin: 0 0 .9em; }',
      '    a { color: #02874d; }',
      '    img { max-width: 100%; height: auto; }',
      '    table { border-collapse: collapse; max-width: 100%; }',
      '    th, td { padding: 6px 10px; vertical-align: top; }',
      '    th { background: #f2f6f5; }',
      '    table[border] th, table[border] td { border: 1px solid #dbdbdb; }',
      '    blockquote { margin: 1em 0; padding: .2em 0 .2em 1em; border-left: 3px solid #02874d; color: #4b5563; }',
      '    pre { overflow: auto; padding: 12px; border: 1px solid #dddddd; border-radius: 5px; background: #f5f5f5; }',
      '    code { font-family: "Courier New", Courier, monospace; }',
      '    hr { border: 0; border-top: 1px solid #dddddd; margin: 2em 0; }',
    ].join('\n');
    return [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <title>' + safeTitle + '</title>',
      '  <style>',
      styles,
      '  </style>',
      '</head>',
      '<body>',
      bodyHtml,
      '</body>',
      '</html>',
      '',
    ].join('\n');
  };

  App.hasEmbeddedImages = function (html) {
    return /<img[^>]+src\s*=\s*["']data:image\//i.test(html);
  };

  App.stats = function (html) {
    const text = App.htmlToText(html);
    return {
      chars: String(html || '').length,
      words: App.countWords(text),
      bytes: new Blob([String(html || '')]).size,
    };
  };
})(window);
