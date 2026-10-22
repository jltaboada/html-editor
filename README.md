# Editor HTML · WYSIWYG + código en vivo

Editor HTML que funciona **100% en el navegador**, sin servidor ni instalación: un panel visual
(WYSIWYG) y un panel de código sincronizados, limpiador de HTML, buscar y reemplazar con
expresiones regulares, importación de `.html` / `.docx` / `.txt` y exportación a HTML, ZIP con
imágenes o Word.

Es una reimplementación original inspirada en las herramientas del editor online de
[HTML-Online](https://html-online.com/html-editor/). No contiene código, textos ni recursos
copiados del original.

El tema visual sigue la paleta y la tipografía de [BeayPePeTools](https://beaypepetools.com/):
verde `#02874d`, marrón `#5f452a` y la fuente Varela Round. El logo de BeayPePeTools se incluye
como identificación visual del proyecto.

**Demo en vivo:** https://jltaboada.github.io/html-editor/

## Cómo usarlo

1. Abre `index.html` con doble clic en cualquier navegador moderno (Chrome, Edge, Firefox, Safari).
2. Empieza a escribir en el panel **Visual** o edita el HTML en el panel **Código**: ambos se
   mantienen sincronizados.

No hace falta compilar nada ni usar `npm`. Si prefieres servirlo por HTTP (por ejemplo para otro
dispositivo de la red local), cualquier servidor estático sirve:

```sh
python -m http.server 8080
# luego abre http://localhost:8080/
```

## Funciones

- **Vistas**: Dividido, Visual y Código. El separador central se puede arrastrar (o mover con las
  flechas del teclado) y la división se recuerda.
- **Barra de formato**: deshacer/rehacer, estilos de párrafo (H1–H6, cita, preformateado),
  tipografía, tamaño, negrita, cursiva, subrayado, tachado, superíndice/subíndice, color de texto y
  de resaltado, alineación, listas, sangría, enlaces, imágenes, tablas, líneas horizontales y
  limpiar formato.
- **Limpieza** con 11 reglas (estilos inline, clases e IDs, etiquetas vacías, etiquetas con un
  espacio, espacios repetidos, comentarios, atributos, a texto plano, Smart `&nbsp;`, caracteres
  «IA» y scripts/estilos). El botón **Clean** aplica todas las reglas marcadas; cada regla también
  se puede ejecutar por separado.
- **Buscar y reemplazar** con hasta 10 reglas aplicadas en orden, modo regex y opción de ignorar
  mayúsculas. Las reglas se guardan en el navegador.
- **Importar**: arrastra un archivo a la ventana o usa **Abrir** (`.html`, `.htm`, `.docx`, `.txt`).
  Los DOCX se convierten con Mammoth y sus imágenes se incrustan como `data:` URIs.
- **Exportar**: HTML listo para publicar, ZIP con carpeta `images/` cuando el documento lleva
  imágenes incrustadas, o DOCX para Word.
- **Extras**: borrador local automático, codificar/decodificar entidades HTML, indentar, comprimir,
  copiar el código, desplazamiento sincronizado de los paneles, contador de caracteres/palabras,
  tema claro/oscuro, modo enfoque, contenido de demostración y Lorem ipsum.
- **Privacidad**: nada se envía a ningún servidor. El borrador y las preferencias viven en
  `localStorage`.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl` + `B` / `I` / `U` | Negrita, cursiva, subrayado |
| `Ctrl` + `K` | Insertar o editar enlace |
| `Ctrl` + `S` | Guardar borrador en el navegador |
| `Ctrl` + `Shift` + `K` | Ejecutar limpieza (Clean) |
| `Ctrl` + `Shift` + `F` | Indentar el código |
| `Ctrl` + `Alt` + `D` | Descargar HTML |
| `F1` | Abrir la ayuda |
| `Esc` | Cerrar paleta/menú o salir del modo enfoque |

En macOS se usa `⌘` en lugar de `Ctrl`.

## Estructura

```
index.html                 Estructura de la app y orden de carga de scripts
assets/css/app.css         Base de la interfaz y tema claro/oscuro
assets/css/theme-beaypepe.css  Paleta, tipografía y acabados BeayPePeTools
assets/fonts/              Varela Round (woff2) y licencia SIL OFL
assets/img/                Logo de BeayPePeTools
assets/js/utils.js         Utilidades (DOM, avisos, descargas, confirmaciones…)
assets/js/demo.js          Contenido de demostración y Lorem ipsum
assets/js/cleaner.js       Reglas de limpieza, indentado, compresión y entidades
assets/js/wysiwyg.js       Editor visual sobre un iframe aislado
assets/js/files.js         Lectura de archivos y exportación HTML/ZIP/DOCX
assets/js/findreplace.js   Panel de buscar y reemplazar
assets/js/app.js           Integración general, estado, sincronización y eventos
vendor/                    Librerías de terceros (ver vendor/LICENSES.md)
```

## Notas y limitaciones

- El editor visual se carga en un `<iframe sandbox>` sin `allow-scripts`, de modo que los scripts
  que contenga el HTML pegado **no se ejecutan** ni afectan a la aplicación.
- Al importar un `.html` completo se toma el contenido de `<body>` y se conservan sus `<style>`.
- El formato `.doc` antiguo no se puede convertir en el navegador: guarda el archivo como `.docx`.
- La exportación a Word conserva texto y formato básico, pero las imágenes incrustadas pueden no
  viajar en el `.docx`; para documentos con imágenes usa la exportación ZIP.
- El borrador local se guarda si el código no supera los 4 MB.

## Dependencias

Todas las librerías están incluidas en `vendor/` y se usan con sus licencias originales:
CodeMirror 5.65.16 (MIT), JSZip 3.10.1 (MIT/GPLv3), Mammoth 1.8.0 (BSD-2-Clause),
html-docx-js 0.3.1 (MIT) y js-beautify 1.15.1 (MIT). La interfaz usa la fuente
[Varela Round](https://github.com/alefalefalef/Varela-Round-Hebrew) (SIL OFL 1.1), incluida en
`assets/fonts/`. Consulta `vendor/LICENSES.md` para más detalle.
