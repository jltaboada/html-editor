/* Ecuaciones matemáticas: LaTeX → MathML con KaTeX */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const TOKEN = '\u0000MATH';
  const TOKEN_RE = /\u0000MATH(\d+)\u0000/g;
  const CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/;
  const BLOCK_MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
  const INLINE_MATH = /(?<![\\$])\$(?![\s$])((?:\\.|[^$\\\n])+?)(?<![\s\\])\$(?![\d$])|\\\(([\s\S]+?)\\\)/g;

  function hasLibrary() {
    return typeof global.katex !== 'undefined' && typeof global.katex.renderToString === 'function';
  }

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Convierte LaTeX en MathML. Devuelve '' si la fórmula no es válida o si
   * KaTeX no está disponible.
   */
  function render(tex, display) {
    if (!hasLibrary()) return '';
    const source = String(tex == null ? '' : tex).trim();
    if (!source) return '';
    try {
      return global.katex.renderToString(source, {
        displayMode: !!display,
        output: 'mathml',
        throwOnError: true,
        strict: false,
        trust: false,
        maxSize: 40,
        maxExpand: 1000,
      });
    } catch (error) {
      return '';
    }
  }

  /** HTML de la ecuación con el LaTeX original guardado en data-tex. */
  function toHtml(tex, display) {
    const source = String(tex == null ? '' : tex).trim();
    if (!source) return '';
    const mathml = render(source, display);
    if (!mathml) return '';
    const tag = display ? 'div' : 'span';
    const cls = display ? 'math math--block' : 'math math--inline';
    return '<' + tag + ' class="' + cls + '" data-tex="' + escapeAttr(source) + '" contenteditable="false">' + mathml + '</' + tag + '>';
  }

  function isMathNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (!/\bmath\b/.test(node.getAttribute('class') || '')) return false;
    return node.hasAttribute('data-tex');
  }

  function isBlockNode(node) {
    return isMathNode(node) && /\bmath--block\b/.test(node.getAttribute('class') || '');
  }

  function texOf(node) {
    return isMathNode(node) ? (node.getAttribute('data-tex') || '') : '';
  }

  /**
   * Sustituye $...$, $$...$$, \(...\) y \[...\] por el HTML de la ecuación
   * antes de pasar el Markdown por marked. Respeta los bloques y el código
   * en línea.
   */
  function expand(markdown) {
    if (!hasLibrary()) return markdown;
    const source = String(markdown == null ? '' : markdown);
    if (source.indexOf('$') === -1 && source.indexOf('\\(') === -1 && source.indexOf('\\[') === -1) return source;
    const tokens = [];
    const store = (html) => {
      tokens.push(html);
      return '\n\n' + TOKEN + (tokens.length - 1) + '\u0000\n\n';
    };
    const storeInline = (html) => {
      tokens.push(html);
      return TOKEN + (tokens.length - 1) + '\u0000';
    };

    const parts = source.split(CODE_RE);
    const expanded = parts.map(function (part, index) {
      if (index % 2 === 1) return part; // bloque o código en línea: intacto
      let text = part.replace(BLOCK_MATH, function (match, dollars, brackets) {
        const html = toHtml(dollars != null ? dollars : brackets, true);
        return html ? store(html) : match;
      });
      text = text.replace(INLINE_MATH, function (match, dollars, parens) {
        const html = toHtml(dollars != null ? dollars : parens, false);
        return html ? storeInline(html) : match;
      });
      return text;
    }).join('');

    return expanded.replace(TOKEN_RE, function (match, index) {
      return tokens[Number(index)] || '';
    });
  }

  App.Math = {
    get available() { return hasLibrary(); },
    render: render,
    toHtml: toHtml,
    expand: expand,
    isMathNode: isMathNode,
    isBlockNode: isBlockNode,
    texOf: texOf,
  };
})(window);
