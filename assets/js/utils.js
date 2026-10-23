/* Utilidades compartidas. Script clásico: funciona también con file:// */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  App.$ = (selector, root) => (root || document).querySelector(selector);
  App.$$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  App.debounce = function (fn, wait) {
    let timer = null;
    function debounced() {
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), wait);
    }
    debounced.cancel = () => clearTimeout(timer);
    debounced.flush = function () {
      clearTimeout(timer);
      fn.apply(this, arguments);
    };
    return debounced;
  };

  App.throttle = function (fn, wait) {
    let last = 0;
    let timer = null;
    return function () {
      const now = Date.now();
      const remaining = wait - (now - last);
      const ctx = this;
      const args = arguments;
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        last = now;
        fn.apply(ctx, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(ctx, args);
        }, remaining);
      }
    };
  };

  App.escapeHtml = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  App.escapeRegExp = function (value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  App.slugify = function (value, fallback) {
    const base = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&[a-z]+;/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return base || fallback || 'documento';
  };

  /**
   * Nombre de archivo legible y seguro: conserva espacios y acentos,
   * elimina solo lo que el sistema de archivos no admite.
   */
  App.safeFileName = function (value, fallback) {
    const base = String(value == null ? '' : value)
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, 80);
    return base || fallback || 'documento';
  };

  App.formatBytes = function (bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  App.formatTime = function (date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  App.htmlToText = function (html) {
    const doc = new DOMParser().parseFromString(
      '<!doctype html><html><body>' + String(html || '') + '</body></html>',
      'text/html'
    );
    doc.body.querySelectorAll('script,style,template').forEach((el) => el.remove());
    doc.body.querySelectorAll('br').forEach((br) => br.replaceWith(doc.createTextNode('\n')));
    doc.body.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,section,article').forEach((el) => {
      el.appendChild(doc.createTextNode('\n'));
    });
    return (doc.body.textContent || '').replace(/\u00a0/g, ' ');
  };

  App.countWords = function (text) {
    const clean = String(text || '').trim();
    if (!clean) return 0;
    return clean.split(/\s+/).length;
  };

  App.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  App.copyText = async function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* fallback abajo */
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      area.style.top = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (error) {
      return false;
    }
  };

  /* ---------- Toasts ---------- */
  const TOAST_ICONS = {
    success: 'i-check',
    error: 'i-alert',
    info: 'i-help',
    warn: 'i-alert',
  };

  App.toast = function (message, type, duration) {
    const container = App.$('#toasts');
    if (!container) return;
    const kind = type || 'info';
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toast.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#' + (TOAST_ICONS[kind] || TOAST_ICONS.info) + '"/></svg>' +
      '<span></span>';
    toast.querySelector('span').textContent = message;
    container.appendChild(toast);
    while (container.children.length > 4) container.firstElementChild.remove();

    const timeout = typeof duration === 'number' ? duration : kind === 'error' ? 6000 : 3600;
    const remove = () => {
      if (!toast.isConnected) return;
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 200);
    };
    const timer = setTimeout(remove, timeout);
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      remove();
    });
  };

  /* ---------- Overlay de proceso ---------- */
  App.setBusy = function (active, text) {
    const busy = App.$('#busy');
    if (!busy) return;
    if (text) App.$('#busyText').textContent = text;
    busy.hidden = !active;
  };

  /* ---------- Confirmación ---------- */
  App.confirmAction = function (options) {
    const opts = options || {};
    const dialog = App.$('#confirmDialog');
    if (!dialog) return Promise.resolve(window.confirm(opts.message || '¿Continuar?'));

    App.$('#confirmTitle').textContent = opts.title || 'Confirmar';
    App.$('#confirmMessage').textContent = opts.message || '';
    const accept = App.$('#confirmAccept');
    accept.textContent = opts.confirmLabel || 'Aceptar';
    accept.className = 'btn ' + (opts.danger === false ? 'btn--primary' : 'btn--danger');

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        dialog.close();
        resolve(value);
      };
      const onClick = () => finish(true);
      const onClose = () => {
        accept.removeEventListener('click', onClick);
        dialog.removeEventListener('close', onClose);
        if (!settled) {
          settled = true;
          resolve(false);
        }
      };
      accept.addEventListener('click', onClick);
      dialog.addEventListener('close', onClose);
      dialog.showModal();
    });
  };

  /* ---------- Diálogos: cierre genérico ---------- */
  App.wireDialogClose = function (dialog) {
    if (!dialog) return;
    App.$$('[data-close-dialog]', dialog).forEach((btn) => {
      btn.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  };

  App.isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  App.modKey = App.isMac ? '⌘' : 'Ctrl';
})(window);
