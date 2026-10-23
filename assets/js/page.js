/* Geometría de página: formato de papel, orientación y márgenes */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const SIZES = {
    full: { label: 'Hoja completa', short: 'Hoja', w: 0, h: 0 },
    a4: { label: 'A4', w: 210, h: 297 },
    letter: { label: 'Carta', w: 215.9, h: 279.4 },
    legal: { label: 'Legal', w: 215.9, h: 355.6 },
    a5: { label: 'A5', w: 148, h: 210 },
  };

  const MARGINS = {
    normal: { label: 'Normales', top: 25, right: 20, bottom: 25, left: 20 },
    narrow: { label: 'Estrechos', top: 15, right: 12, bottom: 15, left: 12 },
    wide: { label: 'Amplios', top: 30, right: 25, bottom: 30, left: 25 },
    none: { label: 'Sin márgenes', top: 0, right: 0, bottom: 0, left: 0 },
  };

  const DEFAULT_PAGE = { size: 'full', orientation: 'portrait', margins: 'normal', custom: null };

  function clampMm(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.round(Math.min(80, Math.max(0, number)) * 10) / 10;
  }

  /** Devuelve siempre un objeto de página válido y completo. */
  function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const size = SIZES[source.size] ? source.size : DEFAULT_PAGE.size;
    const orientation = source.orientation === 'landscape' ? 'landscape' : 'portrait';
    let margins = MARGINS[source.margins] ? source.margins : DEFAULT_PAGE.margins;
    let custom = null;
    if (margins === 'custom' || source.margins === 'custom') {
      margins = 'custom';
      const c = source.custom && typeof source.custom === 'object' ? source.custom : {};
      custom = {
        top: clampMm(c.top, MARGINS.normal.top),
        right: clampMm(c.right, MARGINS.normal.right),
        bottom: clampMm(c.bottom, MARGINS.normal.bottom),
        left: clampMm(c.left, MARGINS.normal.left),
      };
    }
    return { size: size, orientation: orientation, margins: margins, custom: custom };
  }

  /** Ancho y alto en milímetros, ya con la orientación aplicada. */
  function dimensions(page) {
    const p = normalize(page);
    const size = SIZES[p.size];
    if (!size || !size.w) return { width: 0, height: 0 };
    const width = p.orientation === 'landscape' ? size.h : size.w;
    const height = p.orientation === 'landscape' ? size.w : size.h;
    return { width: width, height: height };
  }

  /** Márgenes en milímetros. */
  function margins(page) {
    const p = normalize(page);
    if (p.margins === 'custom') return p.custom;
    return MARGINS[p.margins] || MARGINS.normal;
  }

  function paperLabel(page) {
    const p = normalize(page);
    if (p.size === 'full') return 'Hoja completa';
    const size = SIZES[p.size];
    return size.label + (p.orientation === 'landscape' ? ' horizontal' : '');
  }

  function marginLabel(page) {
    const m = margins(page);
    if (m.left === m.right && m.top === m.bottom && m.left === m.top) {
      return m.left ? m.left + ' mm' : 'sin márgenes';
    }
    return m.top + '/' + m.right + '/' + m.bottom + '/' + m.left + ' mm';
  }

  /** Texto corto para la barra de estado, p. ej. «A4 · 20 mm». */
  function label(page) {
    const p = normalize(page);
    if (p.size === 'full') return 'Hoja completa';
    return SIZES[p.size].label + (p.orientation === 'landscape' ? ' ↔' : '') + ' · ' + marginLabel(p);
  }

  /** Márgenes como valor CSS (arriba derecha abajo izquierda). */
  function paddingCss(page) {
    const m = margins(page);
    return m.top + 'mm ' + m.right + 'mm ' + m.bottom + 'mm ' + m.left + 'mm';
  }

  /**
   * CSS que convierte un documento normal en una hoja con formato. Se aplica
   * a la vista previa, a la exportación, a la impresión y al PDF.
   */
  function css(page) {
    const p = normalize(page);
    if (p.size === 'full') return '';
    const d = dimensions(p);
    const w = Math.round(d.width * 10) / 10;
    const h = Math.round(d.height * 10) / 10;
    return [
      '@page { size: ' + w + 'mm ' + h + 'mm; margin: 0; }',
      'body {',
      '  max-width: ' + w + 'mm !important;',
      '  min-height: ' + h + 'mm;',
      '  margin: 0 auto !important;',
      '  padding: ' + paddingCss(p) + ' !important;',
      '  box-sizing: border-box;',
      '  background: #fff;',
      '}',
      '@media screen and (max-width: 720px) {',
      '  body { min-height: 0; padding: 26px 18px !important; }',
      '}',
    ].join('\n');
  }

  /** Estilos en línea para el cuerpo del iframe del editor visual. */
  function bodyStyle(page, element) {
    if (!element) return;
    const p = normalize(page);
    const style = element.style;
    if (p.size === 'full') {
      style.maxWidth = '';
      style.minHeight = '';
      style.margin = '';
      style.padding = '';
      style.boxSizing = '';
      style.width = '';
    } else {
      const d = dimensions(p);
      style.maxWidth = d.width + 'mm';
      style.width = '100%';
      style.minHeight = d.height + 'mm';
      style.margin = '0 auto';
      style.padding = paddingCss(p);
      style.boxSizing = 'border-box';
    }
  }

  App.Page = {
    SIZES: SIZES,
    MARGINS: MARGINS,
    DEFAULT: DEFAULT_PAGE,
    normalize: normalize,
    dimensions: dimensions,
    margins: margins,
    paperLabel: paperLabel,
    marginLabel: marginLabel,
    label: label,
    paddingCss: paddingCss,
    css: css,
    bodyStyle: bodyStyle,
  };
})(window);
