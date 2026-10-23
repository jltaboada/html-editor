/* Historial de versiones del documento en localStorage */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  const DEFAULT_INTERVAL = 5;
  const MAX_ITEMS = 30;
  const MAX_CHARS = 1500000;

  App.createVersionHistory = function (options) {
    const opts = options || {};
    const key = opts.key || 'htmlEditor.versions.v1';
    const maxItems = opts.maxItems || MAX_ITEMS;
    const maxChars = opts.maxChars || MAX_CHARS;

    function read() {
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(key) || 'null');
      } catch (error) {
        stored = null;
      }
      const value = stored && typeof stored === 'object' ? stored : {};
      const items = Array.isArray(value.items) ? value.items.filter(function (item) {
        return item && typeof item.html === 'string' && typeof item.at === 'number';
      }) : [];
      let interval = Number(value.interval);
      if (!Number.isFinite(interval) || interval < 0) interval = DEFAULT_INTERVAL;
      return { interval: interval, items: items };
    }

    function write(value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    }

    function trim(items) {
      let list = items.slice();
      while (list.length > maxItems) list.pop();
      let total = list.reduce(function (sum, item) { return sum + item.html.length; }, 0);
      while (list.length > 1 && total > maxChars) {
        total -= list[list.length - 1].html.length;
        list.pop();
      }
      return list;
    }

    function list() {
      return read().items.slice().sort(function (a, b) { return b.at - a.at; });
    }

    function latest() {
      const items = list();
      return items.length ? items[0] : null;
    }

    function snapshot(entry) {
      const source = entry || {};
      const html = String(source.html == null ? '' : source.html);
      if (!html.trim()) return null;
      const data = read();
      const last = data.items.length ? data.items[0] : null;
      /* Al guardar a mano se permite repetir contenido: el usuario quiere
         marcar ese punto aunque coincida con la última versión automática. */
      if (source.force !== true && last && last.html === html) return null;
      const item = {
        id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        at: Date.now(),
        kind: source.kind === 'manual' ? 'manual' : (source.kind === 'restore' ? 'restore' : 'auto'),
        title: String(source.title || 'sin-titulo').slice(0, 120),
        html: html,
        md: typeof source.md === 'string' ? source.md : '',
        chars: html.length,
      };
      const items = trim([item].concat(data.items));
      if (!write({ interval: data.interval, items: items })) return null;
      return item;
    }

    function remove(id) {
      const data = read();
      const items = data.items.filter(function (item) { return item.id !== id; });
      write({ interval: data.interval, items: items });
      return items.length !== data.items.length;
    }

    function clear() {
      const data = read();
      return write({ interval: data.interval, items: [] });
    }

    function getInterval() {
      return read().interval;
    }

    function setIntervalMinutes(minutes) {
      const value = Math.max(0, Math.min(120, Number(minutes) || 0));
      const data = read();
      return write({ interval: value, items: data.items }) ? value : null;
    }

    function totalChars() {
      return read().items.reduce(function (sum, item) { return sum + item.html.length; }, 0);
    }

    return {
      key: key,
      list: list,
      latest: latest,
      snapshot: snapshot,
      remove: remove,
      clear: clear,
      getInterval: getInterval,
      setInterval: setIntervalMinutes,
      totalChars: totalChars,
    };
  };

  /** «hace 5 min», «hace 2 h», «el 23/10 a las 09:50»… */
  App.formatAgo = function (timestamp, now) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const current = now || Date.now();
    const seconds = Math.max(0, Math.round((current - timestamp) / 1000));
    if (seconds < 45) return 'hace unos segundos';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return 'hace ' + minutes + ' min';
    const hours = Math.round(minutes / 60);
    if (hours < 24) return 'hace ' + hours + ' h';
    const days = Math.round(hours / 24);
    if (days === 1) return 'ayer';
    if (days < 7) return 'hace ' + days + ' días';
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };
})(window);
