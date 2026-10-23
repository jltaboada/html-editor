/* Paleta de comandos: buscar y ejecutar cualquier acción con el teclado */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  App.createCommandPalette = function (options) {
    const opts = options || {};
    const dialog = opts.dialog;
    const input = opts.input;
    const list = opts.list;
    const empty = opts.empty;
    if (!dialog || !input || !list) return null;

    let commands = [];
    let results = [];
    let active = 0;

    function normalize(text) {
      return String(text == null ? '' : text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    }

    function terms() {
      return normalize(input.value).trim().split(/\s+/).filter(Boolean);
    }

    function filter() {
      const words = terms();
      if (!words.length) {
        return commands.filter(function (command) { return !command.hidden; });
      }
      return commands.filter(function (command) {
        const haystack = normalize([
          command.title,
          command.group,
          command.hint || '',
          command.keywords || '',
        ].join(' '));
        return words.every(function (word) { return haystack.indexOf(word) !== -1; });
      });
    }

    function setActive(index) {
      if (!results.length) {
        active = 0;
        return;
      }
      active = Math.max(0, Math.min(results.length - 1, index));
      const rows = list.querySelectorAll('.palette-item');
      Array.prototype.forEach.call(rows, function (row, position) {
        const on = position === active;
        row.classList.toggle('is-active', on);
        row.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) row.scrollIntoView({ block: 'nearest' });
      });
    }

    function rowFor(command, index) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'palette-item';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.dataset.index = String(index);

      const icon = document.createElement('span');
      icon.className = 'palette-icon';
      icon.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#' +
        (command.icon || 'i-arrow-right') + '"/></svg>';

      const text = document.createElement('span');
      text.className = 'palette-text';
      const title = document.createElement('span');
      title.className = 'palette-title';
      title.textContent = command.title;
      text.appendChild(title);
      if (command.hint) {
        const hint = document.createElement('span');
        hint.className = 'palette-hint';
        hint.textContent = command.hint;
        text.appendChild(hint);
      }

      row.appendChild(icon);
      row.appendChild(text);

      if (command.keys) {
        const keys = document.createElement('span');
        keys.className = 'palette-keys';
        String(command.keys).split(' ').forEach(function (key) {
          const kbd = document.createElement('kbd');
          kbd.textContent = key;
          keys.appendChild(kbd);
        });
        row.appendChild(keys);
      }

      row.addEventListener('mousemove', function () {
        setActive(Number(row.dataset.index));
      });
      row.addEventListener('click', function () {
        run(Number(row.dataset.index));
      });
      return row;
    }

    function render() {
      results = filter();
      list.innerHTML = '';
      if (empty) empty.hidden = results.length > 0;
      if (!results.length) {
        if (empty) {
          empty.textContent = 'No hay comandos que coincidan con «' + input.value.trim() + '».';
        }
        return;
      }
      let currentGroup = null;
      results.forEach(function (command, index) {
        if (command.group !== currentGroup) {
          currentGroup = command.group;
          const heading = document.createElement('div');
          heading.className = 'palette-group';
          heading.textContent = command.group;
          list.appendChild(heading);
        }
        list.appendChild(rowFor(command, index));
      });
      setActive(0);
    }

    function run(index) {
      const command = results[index];
      if (!command) return;
      close();
      try {
        command.run();
      } catch (error) {
        App.toast('No se pudo ejecutar el comando: ' + (error && error.message ? error.message : error), 'error', 5000);
      }
    }

    function open() {
      commands = typeof opts.getCommands === 'function' ? (opts.getCommands() || []) : commands;
      input.value = '';
      render();
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(function () { input.focus({ preventScroll: true }); });
    }

    function close() {
      if (dialog.open) dialog.close();
    }

    input.addEventListener('input', render);

    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(active + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(active - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        run(active);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActive(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActive(results.length - 1);
      } else if (event.key === 'Tab') {
        event.preventDefault();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    });

    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    });

    list.addEventListener('mousedown', function (event) {
      event.preventDefault();
    });

    return {
      open: open,
      close: close,
      isOpen: function () { return dialog.open; },
      setCommands: function (next) { commands = Array.isArray(next) ? next : []; },
      refresh: render,
    };
  };
})(window);
