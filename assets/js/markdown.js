/* Conversión entre el HTML del documento y Markdown */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const DROP_TAGS = 'script,style,link,meta,title,base,object,embed,form,input,button,select,textarea,applet';
  const KEEP_TAGS = ['iframe', 'video', 'audio', 'figure', 'time', 'sup', 'sub', 'mark', 'picture', 'source', 'canvas', 'details', 'summary'];

  let keepService = null;
  let cleanService = null;
  let markedReady = false;

  function hasLibraries() {
    return typeof global.marked !== 'undefined' && typeof global.TurndownService === 'function';
  }

  function prepareMarked() {
    if (markedReady || typeof global.marked === 'undefined') return;
    try {
      global.marked.use({ gfm: true, breaks: false, pedantic: false, async: false });
    } catch (error) {
      try { global.marked.setOptions({ gfm: true, breaks: false, async: false }); } catch (ignored) { /* sin opciones */ }
    }
    markedReady = true;
  }

  function sanitize(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll(DROP_TAGS).forEach(function (node) { node.remove(); });
    Array.from(template.content.querySelectorAll('*')).forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          return;
        }
        if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*(javascript|vbscript|data:text\/html)/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
  }

  /**
   * Markdown → HTML del documento.
   */
  function toHtml(markdown) {
    const source = String(markdown == null ? '' : markdown);
    if (!source.trim()) return '';
    if (!hasLibraries()) return '';
    prepareMarked();
    let html = '';
    try {
      html = global.marked.parse(source);
    } catch (error) {
      html = '';
    }
    if (!html) return '';
    return sanitize(html).trim();
  }

  function buildService(keepHtml) {
    const service = new global.TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      br: '  ',
    });

    if (typeof global.turndownPluginGfm !== 'undefined') {
      service.use(global.turndownPluginGfm.gfm);
    }

    service.remove(['script', 'style', 'link', 'meta', 'base', 'object', 'embed']);

    if (keepHtml) {
      // Lo que Markdown no sabe representar viaja como HTML dentro del propio Markdown
      service.keep(KEEP_TAGS.slice());
      service.addRule('keepStyledInline', {
        filter: function (node) {
          if (!node.nodeName || node.nodeName.toLowerCase() !== 'span') return false;
          const style = node.getAttribute('style') || '';
          return !!(style || node.getAttribute('class'));
        },
        replacement: function (content, node) {
          return node.outerHTML;
        },
      });
      service.addRule('keepDataImage', {
        filter: function (node) {
          return node.nodeName === 'IMG' && /^data:/i.test(node.getAttribute('src') || '');
        },
        replacement: function (content, node) {
          return node.outerHTML;
        },
      });
    } else {
      // Modo limpio: los vídeos se convierten en un enlace para no perder el destino
      service.addRule('videoAsLink', {
        filter: ['iframe', 'video'],
        replacement: function (content, node) {
          const src = node.getAttribute('src') || '';
          const label = node.getAttribute('title') || (node.nodeName === 'VIDEO' ? 'Vídeo' : 'Vídeo incrustado');
          return src ? '\n\n[' + label + '](' + src + ')\n\n' : '';
        },
      });
      service.addRule('figureVideoAsLink', {
        filter: function (node) {
          return node.nodeName === 'FIGURE' && /video-embed/.test(node.getAttribute('class') || '');
        },
        replacement: function (content, node) {
          const media = node.querySelector('iframe[src], video[src]');
          const src = media ? media.getAttribute('src') : '';
          const caption = node.querySelector('figcaption');
          const label = caption && caption.textContent.trim() ? caption.textContent.trim() : 'Vídeo';
          return src ? '\n\n[' + label + '](' + src + ')\n\n' : '';
        },
      });
    }

    return service;
  }

  /** Normaliza los marcadores de lista fuera de los bloques de código. */
  function tidy(markdown) {
    let fence = null;
    return String(markdown || '').split('\n').map(function (line) {
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1].charAt(0);
        if (!fence) fence = marker;
        else if (marker === fence) fence = null;
        return line;
      }
      if (fence) return line;
      return line
        .replace(/^(\s*)([-*+])\s{2,}/, '$1$2 ')
        .replace(/^(\s*)(\d+)[.)]\s{2,}/, '$1$2. ');
    }).join('\n');
  }

  function getService(keepHtml) {
    if (keepHtml) {
      if (!keepService) keepService = buildService(true);
      return keepService;
    }
    if (!cleanService) cleanService = buildService(false);
    return cleanService;
  }

  /**
   * HTML del documento → Markdown.
   */
  function toMarkdown(html, options) {
    const opts = options || {};
    let value = String(html == null ? '' : html);
    if (!value.trim()) return '';
    if (!hasLibraries()) return '';
    if (App.isFullDocument && App.isFullDocument(value)) value = App.extractBody(value).html;
    try {
      const raw = getService(opts.keepHtml !== false).turndown(value).replace(/\n{3,}/g, '\n\n').trim();
      return tidy(raw);
    } catch (error) {
      return '';
    }
  }

  App.Markdown = {
    get available() { return hasLibraries(); },
    toHtml: toHtml,
    toMarkdown: toMarkdown,
  };
})(window);
