# Editor WYSIWYG · jltaboada

Editor WYSIWYG que funciona **100% en el navegador**, sin servidor ni instalación: un panel visual
sincronizado en tiempo real con un panel de código que puede mostrarse en **HTML o Markdown**,
vista previa funcional del documento, ecuaciones en LaTeX (exportadas como MathML), limpiador de
HTML, buscar y reemplazar con expresiones regulares, emoticonos, caracteres especiales, vídeos
incrustados, impresión limpia del documento, importación de `.html` / `.md` / `.docx` / `.txt` y
exportación a HTML, Markdown, ZIP con imágenes o Word.

Es una reimplementación original inspirada en las herramientas del editor online de
[HTML-Online](https://html-online.com/html-editor/). No contiene código, textos ni recursos
copiados del original.

La interfaz usa blanco, negro y rojo oscuro `#9c3b2d`, con la tipografía Varela Round, y tiene
**modo claro y modo oscuro** (el botón de la luna/sol de la cabecera; la elección se recuerda).

**Pruébalo en vivo:** https://jltaboada.github.io/html-editor/

## Cómo usarlo

1. Abre `index.html` con doble clic en cualquier navegador moderno (Chrome, Edge, Firefox, Safari).
2. Empieza a escribir en el panel **Visual** o edita el código en el panel de la derecha. El
   conmutador **HTML | MD** cambia ese panel entre HTML y Markdown; los tres puntos de vista
   (visual, HTML y Markdown) se mantienen sincronizados.

No hace falta compilar nada ni usar `npm`. Si prefieres servirlo por HTTP (por ejemplo para otro
dispositivo de la red local), cualquier servidor estático sirve:

```sh
python -m http.server 8080
# luego abre http://localhost:8080/
```

## Funciones

- **Vistas**: Dividido, Visual y Código. El separador central se puede arrastrar (o mover con las
  flechas del teclado) y la división se recuerda. En la vista dividida, volver a pulsar **Dividido**
  intercambia los paneles (código a la izquierda, visual a la derecha) y el orden se recuerda.
- **Vista previa**: botón **Vista previa** (o `Ctrl`+`Shift`+`P`) para ver el documento como la
  página web exportada. Los enlaces se abren en una pestaña nueva, el CSS, las tablas, los vídeos y
  los formularios funcionan, y puedes alternar entre el ancho de escritorio y el de móvil. Los
  scripts no se ejecutan en la vista previa; el botón de abrir en una pestaña nueva sí los ejecuta.
- **Ecuaciones**: el botón **∑** inserta fórmulas LaTeX con vista previa en el diálogo (en línea o
  centradas). Se guardan como MathML, así que el HTML exportado se ve igual sin cargar ninguna
  librería. Doble clic sobre una ecuación para editarla o quitarla. En Markdown se escriben como
  `$...$` o `$$...$$` y se convierten en ambos sentidos.
- **Barra de formato**: deshacer/rehacer, estilos de párrafo (H1–H6, cita, preformateado),
  tipografía, tamaño, negrita, cursiva, subrayado, tachado, superíndice/subíndice, color de texto y
  de resaltado, alineación, listas, sangría, enlaces, imágenes, tablas, líneas horizontales y
  limpiar formato. Los desplegables de formato, tipografía y tamaño muestran una vista previa real
  de cada opción, y el color se puede elegir en la paleta o escribiendo un código hexadecimal.
- **Emoticonos**: el botón abre un selector con **Recientes**, **Más usados** y **Más emoticonos…**,
  que abre un diálogo con las nueve categorías (1.898 emoticonos) y buscador por nombre en español.
  Se pueden insertar varios seguidos sin cerrar el selector ni el diálogo.
- **Caracteres especiales**: botón **Ω** con recientes y siete categorías (puntuación tipográfica,
  monedas, matemáticas, flechas, letras acentuadas, alfabeto griego y formas), también con buscador.
- **Vídeo incrustado**: pega un enlace de YouTube (incluido `youtu.be`, Shorts y el minuto de
  inicio), Vimeo o Dailymotion, o la URL de un archivo `.mp4`, `.webm` u `.ogv`. El vídeo se
  inserta en un marco adaptativo 16:9 con pie de foto opcional.
- **Fecha y hora**: inserta la fecha actual en seis formatos (larga, corta, día de la semana,
  solo la hora, fecha y hora, o ISO), con vista previa y opción de envolverla en `<time>`.
- **Imágenes editables**: al pulsar el botón de imagen con una imagen seleccionada (o al hacer
  doble clic sobre ella) se abre el diálogo para cambiar la URL, el texto alternativo, el ancho
  y el enlace, o para quitarla del documento.
- **Corrector ortográfico**: el corrector del navegador está activo por defecto y se puede
  desactivar con su botón en la barra; la preferencia se guarda.
- **Imprimir**: el botón de impresión y `Ctrl`+`P` abren las opciones de papel (A4, Carta, A5 o
  Legal), orientación y márgenes. La hoja de impresión tiene `@page { margin: 0 }`, de modo que el
  navegador no añade encabezado ni pie de página y el documento se imprime como se ve.
- **Limpieza** con 11 reglas (estilos inline, clases e IDs, etiquetas vacías, etiquetas con un
  espacio, espacios repetidos, comentarios, atributos, a texto plano, Smart `&nbsp;`, caracteres
  «IA» y scripts/estilos). El botón **Limpieza** aplica todas las reglas marcadas; cada regla
  también se puede ejecutar por separado.
- **Buscar y reemplazar** con hasta 10 reglas aplicadas en orden, modo regex y opción de ignorar
  mayúsculas. Las reglas se guardan en el navegador.
- **Importar**: arrastra un archivo a la ventana o usa **Abrir** (`.html`, `.htm`, `.docx`, `.txt`).
  Los DOCX se convierten con Mammoth y sus imágenes se incrustan como `data:` URIs.
- **Exportar**: HTML listo para publicar, ZIP con carpeta `images/` cuando el documento lleva
  imágenes incrustadas, o DOCX para Word.
- **Código en vivo y siempre ordenado**: mientras escribes en el panel visual, el código se
  actualiza cada pocos milisegundos y llega ya indentado, sin esperas ni reindentados posteriores.
  Al pegar en el panel de código también se ordena solo; *Indentar* sigue disponible y *Comprimir*
  se respeta hasta que vuelvas a editar.
- **HTML o Markdown**: el conmutador del panel de código permite editar el documento como HTML o
  como Markdown. Escribir Markdown actualiza el panel visual al momento, y lo que escribes en el
  visual se refleja también en Markdown. El botón **HTML incrustado** decide si lo que Markdown no
  sabe representar (colores, tipografías, vídeos, fórmulas…) se conserva como HTML dentro del
  Markdown o se descarta para dejar un Markdown limpio. Cada modo conserva su historial y su cursor,
  y el documento se puede descargar como `.md`.
- **Nombre del archivo**: haz clic en el nombre que aparece encima del código para cambiarlo
  (solo la parte del nombre: la extensión `.html` es fija). Se usa para descargar y se recuerda.
- **Memoria de trabajo**: el borrador se guarda solo (también al cerrar o recargar el navegador) y,
  al volver, se restauran el texto, el nombre, la vista, la división de paneles, el desplazamiento
  sincronizado, los colores, el corrector, las opciones de impresión y las reglas de limpieza.
- **Barras de estado por editor**: el panel visual muestra los caracteres y palabras del texto
  visible, y el panel de código (HTML o Markdown) muestra los caracteres y palabras de ese código
  junto a la línea y la columna del cursor. El pie de página solo conserva el estado de guardado,
  el tamaño del documento y el crédito «© jltaboada».
- **Modo claro y oscuro**: se cambia con el botón de la cabecera; también se oscurece la hoja del
  editor visual y el resaltado del código. La preferencia se guarda con el resto de ajustes.
- **Extras**: codificar/decodificar entidades HTML, indentar, comprimir, copiar el código,
  desplazamiento sincronizado de los paneles, modo enfoque y Lorem ipsum.
- **Privacidad**: nada se envía a ningún servidor. El borrador y las preferencias viven en
  `localStorage`.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl` + `B` / `I` / `U` | Negrita, cursiva, subrayado |
| `Ctrl` + `K` | Insertar o editar enlace |
| `Ctrl` + `S` | Guardar borrador en el navegador |
| `Ctrl` + `Shift` + `K` | Ejecutar limpieza |
| `Ctrl` + `Shift` + `F` | Indentar el código |
| `Ctrl` + `Alt` + `D` | Descargar HTML |
| `Ctrl` + `P` | Abrir las opciones de impresión |
| `F1` | Abrir la ayuda |
| `Esc` | Cerrar paleta/menú o salir del modo enfoque |

En macOS se usa `⌘` en lugar de `Ctrl`.

## Estructura

```
index.html                 Estructura de la app y orden de carga de scripts
assets/css/app.css         Base de la interfaz
assets/css/theme-jltaboada.css  Paleta clara/oscura, tipografía y acabados
assets/fonts/              Varela Round (woff2) y licencia SIL OFL
assets/js/utils.js         Utilidades (DOM, avisos, descargas, confirmaciones…)
assets/js/math.js          Ecuaciones LaTeX → MathML (KaTeX)
assets/js/emojis.js        Datos de emoticonos y caracteres especiales (nombres en español)
assets/js/demo.js          Texto de relleno (Lorem ipsum)
assets/js/cleaner.js       Reglas de limpieza, indentado, compresión y entidades
assets/js/wysiwyg.js       Editor visual sobre un iframe aislado
assets/js/files.js         Lectura de archivos y exportación HTML/ZIP/DOCX
assets/js/findreplace.js   Panel de buscar y reemplazar
assets/js/markdown.js      Conversión HTML ⇄ Markdown (marked + Turndown)
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
- Los nombres de los emoticonos se generan a partir de [EmojiBase](https://emojibase.dev/)
  (MIT); el resultado se guarda como datos estáticos en `assets/js/emojis.js`, sin dependencias
  en tiempo de ejecución.
- La hoja de impresión se carga en un iframe con `sandbox` sin `allow-scripts`: aunque el
  documento contenga `<script>`, no se ejecuta al imprimir.
- Markdown no puede representar todo el HTML. Con **HTML incrustado** activado la conversión es
  reversible; desactivado se obtiene Markdown estándar y se pierden estilos, colores y elementos
  que no tienen equivalente (los vídeos se convierten en un enlace).
- Al importar un `.md` se convierte a HTML con marked; las imágenes incrustadas como `data:` se
  mantienen como HTML dentro de Markdown para no inflar el texto.

## Dependencias

Todas las librerías están incluidas en `vendor/` y se usan con sus licencias originales:
CodeMirror 5.65.16 (MIT, con los modos HTML y Markdown), KaTeX 0.16.11 (MIT, salida MathML),
marked 15.0.12 (MIT), Turndown 7.2.4
(MIT), turndown-plugin-gfm 1.0.2 (MIT), JSZip 3.10.1 (MIT/GPLv3), Mammoth 1.8.0 (BSD-2-Clause),
html-docx-js 0.3.1 (MIT) y js-beautify 1.15.1 (MIT). La interfaz usa la fuente
[Varela Round](https://github.com/alefalefalef/Varela-Round-Hebrew) (SIL OFL 1.1), incluida en
`assets/fonts/`. Consulta `vendor/LICENSES.md` para más detalle.
