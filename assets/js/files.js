/* Importación y exportación: HTML, ZIP con imágenes y DOCX */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/avif': 'avif',
  };

  function extensionOf(name) {
    const index = String(name || '').lastIndexOf('.');
    return index >= 0 ? String(name).slice(index + 1).toLowerCase() : '';
  }

  function fileTitle(name) {
    return String(name || 'documento').replace(/\.[^.]+$/, '') || 'documento';
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function textToHtml(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    return lines.map((line) => {
      const trimmed = line.trim();
      return trimmed ? '<p>' + App.escapeHtml(trimmed) + '</p>' : '<p><br></p>';
    }).join('\n');
  }

  async function convertDocx(file) {
    if (!global.mammoth || typeof global.mammoth.convertToHtml !== 'function') {
      throw new Error('La librería de conversión DOCX no está disponible.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const options = {
      convertImage: global.mammoth.images.inline(function (element) {
        return element.read('base64').then(function (data) {
          return { src: 'data:' + element.contentType + ';base64,' + data };
        });
      }),
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Quote'] => blockquote",
      ],
    };
    const result = await global.mammoth.convertToHtml({ arrayBuffer }, options);
    return {
      html: result.value || '',
      messages: (result.messages || []).map((message) => message.message).filter(Boolean),
    };
  }

  /**
   * Lee un archivo y devuelve HTML listo para el editor.
   * @returns {Promise<{html:string,title:string,kind:string,notes:string[]}>}
   */
  async function readFile(file) {
    if (!file) throw new Error('No se ha seleccionado ningún archivo.');
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('El archivo supera los 25 MB. Prueba con un documento más pequeño.');
    }
    const ext = extensionOf(file.name);
    const title = fileTitle(file.name);

    if (ext === 'html' || ext === 'htm') {
      const text = await file.text();
      const extracted = App.extractBody(text);
      const notes = [];
      if (extracted.wasFull) {
        notes.push('Se importó el contenido de <body>' + (extracted.stylesPreserved ? ' y se conservaron sus estilos' : '') + '.');
      }
      return { html: extracted.html, title: extracted.title || title, kind: 'html', notes };
    }

    if (ext === 'docx') {
      const result = await convertDocx(file);
      const notes = ['Documento Word convertido a HTML con Mammoth.'];
      if (result.messages.length) {
        notes.push(result.messages.length + ' aviso(s) de conversión; revisa el resultado.');
      }
      return { html: result.html, title, kind: 'docx', notes };
    }

    if (ext === 'md' || ext === 'markdown') {
      const text = await file.text();
      const html = App.Markdown && App.Markdown.available ? App.Markdown.toHtml(text) : '';
      return {
        html: html || textToHtml(text),
        title,
        kind: 'markdown',
        notes: [html ? 'Markdown convertido a HTML.' : 'Markdown importado como texto plano.'],
      };
    }

    if (ext === 'txt' || ext === 'text') {
      const text = await file.text();
      return {
        html: textToHtml(text),
        title,
        kind: 'text',
        notes: ['Texto importado como párrafos HTML.'],
      };
    }

    if (ext === 'doc') {
      throw new Error('El formato .doc antiguo no se puede convertir en el navegador. Guarda el documento como .docx e inténtalo de nuevo.');
    }

    throw new Error('Formato no compatible. Usa .html, .htm, .md, .docx o .txt.');
  }

  function buildImageRegex() {
    return /(<img\b[^>]*\bsrc\s*=\s*["'])(data:image\/([a-z0-9.+-]+);base64,([^"']+))(["'][^>]*>)/gi;
  }

  async function buildZip(documentHtml) {
    if (!global.JSZip) throw new Error('JSZip no está disponible para crear el ZIP.');
    const zip = new global.JSZip();
    const imagesFolder = zip.folder('images');
    const used = new Set();
    let index = 0;

    const updated = documentHtml.replace(buildImageRegex(), (match, before, fullData, subtype, base64, after) => {
      try {
        const mime = 'image/' + subtype.toLowerCase();
        const ext = MIME_EXT[mime] || 'png';
        let filename;
        do {
          index++;
          filename = 'image-' + index + '.' + ext;
        } while (used.has(filename));
        used.add(filename);
        imagesFolder.file(filename, base64ToBytes(base64));
        return before + 'images/' + filename + after;
      } catch (error) {
        return match;
      }
    });

    zip.file('index.html', updated);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { blob, images: index };
  }

  function prepareDocument(html, title) {
    const extracted = App.extractBody(html);
    const safeTitle = title || App.getDocumentTitle(html, 'Documento');
    return {
      body: extracted.html,
      title: safeTitle,
      document: App.wrapDocument(extracted.html, safeTitle),
    };
  }

  function downloadHtml(html, options) {
    const opts = options || {};
    const prepared = prepareDocument(html, opts.title);
    const slug = App.safeFileName(prepared.title, 'documento');
    const hasImages = App.hasEmbeddedImages(html);

    if (opts.forceZip || hasImages) {
      return buildZip(prepared.document).then((result) => {
        App.downloadBlob(result.blob, slug + '.zip');
        return { filename: slug + '.zip', zipped: true, images: result.images };
      });
    }

    const blob = new Blob([prepared.document], { type: 'text/html;charset=utf-8' });
    App.downloadBlob(blob, slug + '.html');
    return Promise.resolve({ filename: slug + '.html', zipped: false });
  }

  function downloadDocx(html, title) {
    if (!global.htmlDocx || typeof global.htmlDocx.asBlob !== 'function') {
      return Promise.reject(new Error('La librería de exportación DOCX no está disponible.'));
    }
    const prepared = prepareDocument(html, title);
    const slug = App.safeFileName(prepared.title, 'documento');

    try {
      const blob = global.htmlDocx.asBlob(prepared.document, {
        orientation: 'portrait',
        margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
      });
      App.downloadBlob(blob, slug + '.docx');
      return Promise.resolve({ filename: slug + '.docx' });
    } catch (error) {
      return Promise.reject(new Error('No se pudo generar el documento de Word: ' + (error && error.message ? error.message : error)));
    }
  }

  App.Files = {
    MAX_FILE_BYTES,
    readFile,
    downloadHtml,
    downloadDocx,
    extensionOf,
    fileTitle,
  };
})(window);
