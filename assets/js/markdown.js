/* Conversión entre el HTML del documento y Markdown */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const DROP_TAGS = 'script,style,link,meta,title,base,object,embed,form,button,select,textarea,applet';
  const CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/;
  const FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/;
  const FOOTNOTE_REF = /\[\^([^\]\s]+)\]/g;
  /* Marcadores con caracteres del área de uso privado: sobreviven al HTML. */
  const FN_TOKEN = '\uE000FN';
  const FN_TOKEN_RE = /\uE000FN(\d+)\uE001/g;
  const FN_DEF_START = '@@FNDEF:';
  const FN_DEF_END = '@@ENDFN@@';
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
    // Las casillas de las listas de tareas son el único input permitido.
    Array.from(template.content.querySelectorAll('input')).forEach(function (input) {
      if ((input.getAttribute('type') || '').toLowerCase() !== 'checkbox') input.remove();
    });
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

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Separa las definiciones de notas ([^id]: texto) del resto del Markdown.
   * Respeta los bloques y el código en línea y admite líneas de continuación
   * sangradas.
   */
  function extractFootnotes(source) {
    const lines = String(source || '').split('\n');
    const defs = new Map();
    const kept = [];
    let fence = null;
    let current = null;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1].charAt(0);
        if (!fence) fence = marker;
        else if (fence === marker) fence = null;
        kept.push(line);
        current = null;
        continue;
      }
      if (fence) {
        kept.push(line);
        continue;
      }
      const def = line.match(FOOTNOTE_DEF);
      if (def) {
        const id = def[1];
        if (!defs.has(id)) defs.set(id, def[2].trim());
        current = id;
        continue;
      }
      if (current) {
        if (/^(?: {2,}|\t)\S/.test(line)) {
          const extra = line.replace(/^(?: {2,4}|\t)/, '').trim();
          defs.set(current, (defs.get(current) + '\n' + extra).trim());
          continue;
        }
        if (!line.trim()) {
          // La línea en blanco solo continúa la nota si la siguiente va sangrada.
          const next = lines[index + 1] || '';
          if (/^(?: {2,}|\t)\S/.test(next)) continue;
        }
        current = null;
      }
      kept.push(line);
    }
    return { defs: defs, source: kept.join('\n') };
  }

  /** Sustituye [^id] por marcadores internos, sin tocar el código. */
  function tokenizeFootnoteRefs(source, defs) {
    const refs = [];
    const parts = String(source || '').split(CODE_RE);
    const text = parts.map(function (part, index) {
      if (index % 2 === 1) return part;
      return part.replace(FOOTNOTE_REF, function (match, id) {
        if (!defs.has(id)) return match;
        let ref = refs.find(function (item) { return item.id === id; });
        if (!ref) {
          ref = { id: id, number: refs.length + 1, count: 0 };
          refs.push(ref);
        }
        ref.count += 1;
        return FN_TOKEN + refs.indexOf(ref) + '\uE001';
      });
    }).join('');
    return { text: text, refs: refs };
  }

  /** Markdown en línea de una definición de nota → HTML sanitizado. */
  function footnoteBody(markdown) {
    let text = String(markdown || '').trim().replace(/\n+/g, ' ');
    if (!text) return '';
    if (App.Math && App.Math.available) text = App.Math.expand(text);
    let html = '';
    try {
      html = global.marked.parseInline(text);
    } catch (error) {
      html = escapeAttr(text);
    }
    return sanitize(html);
  }

  function footnoteSection(refs, defs) {
    if (!refs.length) return '';
    const items = refs.map(function (ref) {
      const anchor = ref.number;
      const body = footnoteBody(defs.get(ref.id));
      return [
        '<li id="fn-' + anchor + '" data-footnote="' + escapeAttr(ref.id) + '">',
        '<p>' + body + ' ',
        '<a href="#fnref-' + anchor + '" class="footnote-backref" data-footnote-back="1" ',
        'aria-label="Volver a la referencia ' + anchor + '">↩</a></p></li>',
      ].join('');
    });
    return '<section class="footnotes" role="doc-endnotes" aria-label="Notas al pie">' +
      '<ol>' + items.join('') + '</ol></section>';
  }

  /** Cambia los marcadores de referencia por enlaces <sup> numerados. */
  function applyFootnoteRefs(html, refs) {
    if (!refs.length) return html;
    return String(html || '').replace(FN_TOKEN_RE, function (match, index) {
      const ref = refs[Number(index)];
      if (!ref) return '';
      const anchor = ref.number;
      return '<sup class="footnote-ref" id="fnref-' + anchor + '">' +
        '<a href="#fn-' + anchor + '" data-footnote-ref="' + escapeAttr(ref.id) + '" ' +
        'aria-label="Nota ' + anchor + '">' + anchor + '</a></sup>';
    });
  }

  /**
   * Markdown → HTML del documento.
   */
  function toHtml(markdown) {
    let source = String(markdown == null ? '' : markdown);
    if (!source.trim()) return '';
    if (!hasLibraries()) return '';
    prepareMarked();
    const notes = extractFootnotes(source);
    let refs = [];
    if (notes.defs.size) {
      const tokenized = tokenizeFootnoteRefs(notes.source, notes.defs);
      source = tokenized.text;
      refs = tokenized.refs;
    }
    if (App.Math && App.Math.available) source = App.Math.expand(source);
    let html = '';
    try {
      html = global.marked.parse(source);
    } catch (error) {
      html = '';
    }
    if (!html) return '';
    let output = sanitize(html).trim();
    if (refs.length) {
      output = applyFootnoteRefs(output, refs) + footnoteSection(refs, notes.defs);
    }
    return output;
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

    // Va la última para tener prioridad sobre las reglas anteriores: las
    // ecuaciones viajan siempre como $...$ / $$...$$, en los dos modos.
    service.addRule('mathEquation', {
      filter: function (node) {
        return !!(App.Math && App.Math.isMathNode(node));
      },
      replacement: function (content, node) {
        const tex = App.Math.texOf(node);
        if (!tex) return content;
        return App.Math.isBlockNode(node)
          ? '\n\n$$\n' + tex + '\n$$\n\n'
          : '$' + tex + '$';
      },
    });

    // Listas de tareas y notas al pie. Van al final para tener prioridad sobre
    // las reglas de listas, enlaces y «keep» anteriores.
    service.addRule('taskListItem', {
      filter: function (node) {
        return node.nodeName === 'LI' && !!node.querySelector('input[type="checkbox"]');
      },
      replacement: function (content, node) {
        const box = node.querySelector('input[type="checkbox"]');
        const checked = !!(box && (box.checked || box.hasAttribute('checked')));
        /* El plugin GFM ya convierte la casilla en «[x]»; se quita para no
           duplicar el marcador de la tarea. */
        const text = content
          .replace(/^\s*\[[ xX]\]\s*/, '')
          .replace(/^\n+|\n+$/g, '')
          .replace(/\n{2,}/g, '\n')
          .replace(/\n/g, '\n  ');
        return '- [' + (checked ? 'x' : ' ') + '] ' + text + '\n';
      },
    });

    service.addRule('footnoteRef', {
      filter: function (node) {
        return node.nodeName === 'A' && node.hasAttribute('data-footnote-ref');
      },
      replacement: function (content, node) {
        return '[^' + node.getAttribute('data-footnote-ref') + ']';
      },
    });

    service.addRule('footnoteBackref', {
      filter: function (node) {
        return node.nodeName === 'A' && node.hasAttribute('data-footnote-back');
      },
      replacement: function () { return ''; },
    });

    service.addRule('footnoteItem', {
      filter: function (node) {
        return node.nodeName === 'LI' && node.hasAttribute('data-footnote');
      },
      replacement: function (content, node) {
        const id = encodeURIComponent(node.getAttribute('data-footnote') || '');
        const text = content.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
        return '\n\n' + FN_DEF_START + id + '@@ ' + text + ' ' + FN_DEF_END + '\n\n';
      },
    });

    service.addRule('footnoteSection', {
      filter: function (node) {
        return node.nodeName === 'SECTION' && /(^|\s)footnotes(\s|$)/.test(node.className || '');
      },
      replacement: function (content) {
        return content;
      },
    });

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
      let raw = getService(opts.keepHtml !== false).turndown(value);
      raw = raw.replace(/@@FNDEF:([^@]*)@@\s*([\s\S]*?)\s*@@ENDFN@@/g, function (match, id, text) {
        let noteId = id;
        try { noteId = decodeURIComponent(id); } catch (error) { /* id tal cual */ }
        return '[^' + noteId + ']: ' + text.replace(/\s*\n\s*/g, ' ').trim();
      });
      raw = raw.replace(/\n{3,}/g, '\n\n').trim();
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
