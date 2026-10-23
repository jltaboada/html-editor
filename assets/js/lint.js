/* Revisión ligera de HTML: etiquetas sin cerrar, anidamientos y atributos */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const VOID = new Set(('area base br col embed hr img input link meta param source track wbr ' +
    'command keygen menuitem').split(' '));
  const RAW = new Set(['script', 'style', 'textarea', 'title']);
  const OBSOLETE = new Set(['font', 'center', 'marquee', 'blink', 'big', 'tt', 'frame', 'frameset',
    'applet', 'acronym', 'dir', 'strike', 'basefont']);
  const OPTIONAL_END = new Set(['p', 'li', 'dt', 'dd', 'tr', 'td', 'th', 'option', 'optgroup',
    'thead', 'tbody', 'tfoot', 'colgroup', 'caption', 'html', 'head', 'body']);
  const P_CLOSERS = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
  const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite']);

  function lineStartsOf(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return starts;
  }

  function positionOf(starts, index) {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= index) low = mid;
      else high = mid - 1;
    }
    return { line: low + 1, column: index - starts[low] + 1 };
  }

  function decodeEntities(value) {
    return String(value || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  App.lintHtml = function (html) {
    const source = String(html == null ? '' : html);
    const starts = lineStartsOf(source);
    const issues = [];
    const stack = [];
    const ids = new Map();

    function add(severity, message, index, tag) {
      if (issues.length >= 100) return;
      const pos = positionOf(starts, Math.max(0, Math.min(source.length, index)));
      issues.push({
        severity: severity,
        message: message,
        line: pos.line,
        column: pos.column,
        tag: tag || '',
      });
    }

    function popOptionalAbove(depth) {
      while (stack.length > depth && OPTIONAL_END.has(stack[stack.length - 1].name)) stack.pop();
    }

    function topName() {
      return stack.length ? stack[stack.length - 1].name : '';
    }

    function autoClose(name) {
      if (P_CLOSERS.has(name)) {
        while (topName() === 'p') stack.pop();
      }
      if (name === 'li') {
        while (topName() === 'li') stack.pop();
      } else if (name === 'dt' || name === 'dd') {
        while (topName() === 'dt' || topName() === 'dd') stack.pop();
      } else if (name === 'tr') {
        while (['td', 'th', 'tr'].indexOf(topName()) !== -1 && topName() !== '') stack.pop();
      } else if (name === 'td' || name === 'th') {
        while (topName() === 'td' || topName() === 'th') stack.pop();
      } else if (name === 'option') {
        while (topName() === 'option') stack.pop();
      } else if (name === 'thead' || name === 'tbody' || name === 'tfoot') {
        while (['thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].indexOf(topName()) !== -1) stack.pop();
      }
      if (HEADINGS.has(name)) {
        while (HEADINGS.has(topName())) stack.pop();
      }
    }

    let index = 0;
    while (index < source.length) {
      const open = source.indexOf('<', index);
      if (open === -1) break;
      index = open;

      if (source.startsWith('<!--', index)) {
        const end = source.indexOf('-->', index + 4);
        if (end === -1) {
          add('error', 'Comentario sin cerrar: falta «-->».', index);
          break;
        }
        index = end + 3;
        continue;
      }
      if (source.startsWith('<![CDATA[', index)) {
        const end = source.indexOf(']]>', index + 9);
        if (end === -1) {
          add('error', 'Sección CDATA sin cerrar: falta «]]>».', index);
          break;
        }
        index = end + 3;
        continue;
      }
      if (source.startsWith('<!', index) || source.startsWith('<?', index)) {
        const end = source.indexOf('>', index + 2);
        if (end === -1) {
          add('error', 'Declaración sin cerrar: falta «>».', index);
          break;
        }
        index = end + 1;
        continue;
      }

      if (source.startsWith('</', index)) {
        const close = /^<\/\s*([a-zA-Z][^\s/>]*)\s*>/.exec(source.slice(index, index + 120));
        if (!close) {
          add('warning', 'Etiqueta de cierre mal formada.', index);
          index += 2;
          continue;
        }
        const name = close[1].toLowerCase();
        let found = -1;
        for (let depth = stack.length - 1; depth >= 0; depth--) {
          if (stack[depth].name === name) { found = depth; break; }
        }
        if (found === -1) {
          add('warning', 'La etiqueta </' + name + '> se cierra sin haberla abierto.', index, name);
        } else {
          popOptionalAbove(found + 1);
          if (stack.length > found + 1) {
            const pending = stack.slice(found + 1).map(function (item) { return '<' + item.name + '>'; });
            add('error', 'Se cierra </' + name + '> antes de cerrar ' + pending.join(', ') + '.', index, name);
            stack.length = found + 1;
          }
          stack.pop();
        }
        index += close[0].length;
        continue;
      }

      const tag = /^<([a-zA-Z][a-zA-Z0-9:_-]*)/.exec(source.slice(index, index + 96));
      if (!tag) {
        index += 1;
        continue;
      }

      let cursor = index + 1 + tag[1].length;
      let quote = null;
      while (cursor < source.length) {
        const char = source[cursor];
        if (quote) {
          if (char === quote) quote = null;
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === '>') {
          break;
        }
        cursor += 1;
      }
      if (cursor >= source.length) {
        add('error', 'La etiqueta <' + tag[1] + '> no termina con «>».', index, tag[1]);
        break;
      }

      const raw = source.slice(index, cursor + 1);
      const name = tag[1].toLowerCase();
      const selfClosing = /\/\s*>$/.test(raw);
      const attrText = raw.slice(1 + tag[1].length, raw.length - 1).replace(/\/\s*$/, '');
      const seen = new Set();
      let attrMatch;
      const attrRe = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      while ((attrMatch = attrRe.exec(attrText))) {
        const attrName = attrMatch[1];
        const lower = attrName.toLowerCase();
        if (seen.has(lower)) {
          add('warning', 'El atributo «' + attrName + '» está repetido en <' + name + '>.',
            index + 1 + tag[1].length + attrMatch.index, name);
        }
        seen.add(lower);
        if (/[A-Z]/.test(attrName)) {
          add('warning', 'El atributo «' + attrName + '» usa mayúsculas; en HTML se escribe en minúsculas.',
            index + 1 + tag[1].length + attrMatch.index, name);
        }
        const value = attrMatch[2] != null ? attrMatch[2] : (attrMatch[3] != null ? attrMatch[3] : attrMatch[4]);
        if (value != null) {
          if (!value.trim() && URL_ATTRS.has(lower)) {
            add('warning', 'El atributo «' + lower + '» de <' + name + '> está vacío.', index, name);
          }
          if (URL_ATTRS.has(lower) && /^\s*(javascript|vbscript):/i.test(value)) {
            add('warning', 'El atributo «' + lower + '» contiene código JavaScript.', index, name);
          }
          if (lower === 'id' && value) {
            const clean = value.trim();
            if (ids.has(clean)) {
              add('warning', 'El id «' + clean + '» está repetido (también en la línea ' + ids.get(clean) + ').', index, name);
            } else {
              ids.set(clean, positionOf(starts, index).line);
            }
          }
        }
      }

      if (OBSOLETE.has(name)) {
        add('warning', 'La etiqueta <' + name + '> está obsoleta en HTML5.', index, name);
      }
      if (name === 'img') {
        if (!seen.has('alt')) {
          add('warning', 'La imagen <img> no tiene texto alternativo (alt).', index, name);
        }
        if (!seen.has('src')) {
          add('error', 'La imagen <img> no tiene atributo src.', index, name);
        }
      }
      if (name === 'a' && stack.some(function (item) { return item.name === 'a'; })) {
        add('warning', 'Hay un enlace <a> dentro de otro enlace.', index, name);
      }

      if (!VOID.has(name) && !selfClosing) {
        autoClose(name);
        stack.push({
          name: name,
          index: index,
          line: positionOf(starts, index).line,
        });
      }

      index = cursor + 1;

      if (RAW.has(name) && !selfClosing) {
        const closeRe = new RegExp('</\\s*' + name + '\\s*>', 'i');
        const rest = source.slice(index);
        const found = closeRe.exec(rest);
        if (!found) {
          add('error', 'La etiqueta <' + name + '> no se cierra.', index, name);
          stack.pop();
          break;
        }
        index += found.index;
      }
    }

    stack.forEach(function (item) {
      if (OPTIONAL_END.has(item.name)) return;
      add('error', 'La etiqueta <' + item.name + '> no se cierra (abierta en la línea ' + item.line + ').', item.index, item.name);
    });

    issues.sort(function (a, b) {
      return a.line - b.line || a.column - b.column;
    });

    const errors = issues.filter(function (issue) { return issue.severity === 'error'; }).length;
    const warnings = issues.length - errors;
    return {
      issues: issues,
      errors: errors,
      warnings: warnings,
      ok: errors === 0 && warnings === 0,
      total: issues.length,
    };
  };

  /** Resumen corto para la barra de estado. */
  App.lintSummary = function (result) {
    if (!result || !result.total) return 'HTML correcto';
    if (result.errors) {
      return result.errors + (result.errors === 1 ? ' error' : ' errores') +
        (result.warnings ? ' · ' + result.warnings + (result.warnings === 1 ? ' aviso' : ' avisos') : '');
    }
    return result.warnings + (result.warnings === 1 ? ' aviso' : ' avisos');
  };
})(window);
