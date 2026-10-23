# Editor WYSIWYG · jltaboada

**▶ Pruébalo en vivo: <https://jltaboada.github.io/html-editor/>**

[Demo](https://jltaboada.github.io/html-editor/) · [Cómo usarlo](#cómo-usarlo) · [Publicar tu copia](#publicar-tu-propia-copia) · [Modificarlo](#cómo-modificarlo) · [Invítame a una caña](#invítame-a-una-caña)

Editor WYSIWYG que funciona **100% en el navegador**, sin servidor ni instalación: un panel visual
sincronizado en tiempo real con un panel de código que puede mostrarse en **HTML o Markdown**,
vista previa funcional del documento, ecuaciones en LaTeX (exportadas como MathML), limpiador de
HTML, buscar y reemplazar con expresiones regulares, emoticonos, caracteres especiales, vídeos
incrustados, impresión limpia del documento, importación de `.html` / `.md` / `.docx` / `.txt` y
exportación a HTML, Markdown, PDF, ZIP con imágenes o Word.

Es una reimplementación original inspirada en las herramientas del editor online de
[HTML-Online](https://html-online.com/html-editor/). No contiene código, textos ni recursos
copiados del original.

La interfaz usa blanco, negro y rojo oscuro `#9c3b2d`, con la tipografía Varela Round, y tiene
**modo claro y modo oscuro** (el botón de la luna/sol de la cabecera; la elección se recuerda).

## Cómo usarlo

### En línea, sin instalar nada

Abre **<https://jltaboada.github.io/html-editor/>** en cualquier navegador moderno. La aplicación
se descarga una vez y todo el trabajo (borrador, preferencias e historial) se queda en tu
navegador: no hay cuentas, servidores ni subida de documentos.

### En tu ordenador

No hace falta `npm`, ni compilar, ni instalar dependencias: todo el código y las librerías viajan
en el repositorio.

```sh
git clone https://github.com/jltaboada/html-editor.git
cd html-editor
```

Después tienes dos opciones:

1. **Abrir el archivo**: haz doble clic en `index.html`. Funciona en Chrome, Edge, Firefox y Safari.
2. **Servirlo por HTTP** (recomendado, y necesario si quieres abrirlo desde otro dispositivo de tu
   red local):

   ```sh
   python3 -m http.server 8080
   # o, si prefieres Node: npx serve .
   ```

   Y visita <http://localhost:8080/>. En una red local, cambia `localhost` por la IP del equipo.

También puedes descargar el ZIP del repositorio desde GitHub (*Code → Download ZIP*) y usar la
carpeta sin clonar nada.

### Publicar tu propia copia

Como es una web estática, se publica en cualquier sitio: GitHub Pages, Netlify, Vercel, Cloudflare
Pages o un servidor propio. Con GitHub Pages, por ejemplo:

1. Haz un *fork* del repositorio (o sube tu copia a un repositorio propio).
2. Entra en **Settings → Pages**.
3. En *Build and deployment*, elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`.
4. Guarda y espera unos segundos: tu editor quedará en
   `https://TU-USUARIO.github.io/TU-REPOSITORIO/`.

No hay paso de compilación: lo que hay en el repositorio es exactamente lo que se publica. El
enlace de demostración de arriba se sirve así.

### Cómo modificarlo

Todo es HTML, CSS y JavaScript sin transpilar:

- `index.html` contiene la estructura, los iconos SVG y el orden de carga de los scripts. **Ese
  orden importa**: primero `vendor/`, luego los módulos de utilidades y, al final, `app.js`.
- `assets/css/app.css` es la base (con las variables de color al principio) y
  `assets/css/theme-jltaboada.css` añade la paleta clara/oscura y los acabados.
- Cada archivo de `assets/js/` es un módulo independiente que cuelga su API de
  `window.HTMLEditor` (`App.Page`, `App.lintHtml`, `App.Markdown`, `App.createWysiwyg`…).
- Para añadir una acción a la **paleta de comandos**, añade una entrada en `buildCommands()` de
  `assets/js/app.js`; aparecerá sola al pulsar `Ctrl`+`K`.
- Para tocar el corrector de HTML, empieza por `assets/js/lint.js`; para el historial de versiones,
  por `assets/js/history.js`; para la geometría de página, por `assets/js/page.js`.
- Las librerías de terceros están en `vendor/` (nada de CDN) y se cargan tal cual.

Tras cambiar un archivo, recarga el navegador con `Ctrl`+`F5` (o `⌘`+`Shift`+`R` en macOS). Si
sirves la carpeta con `python3 -m http.server`, basta con refrescar.

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
- **Imágenes redimensionables**: al hacer clic en una imagen del panel visual aparece un marco con
  un tirador en la esquina. Arrástralo para cambiar el ancho manteniendo la proporción (o usa las
  flechas del teclado con el tirador enfocado). El tamaño se guarda en el HTML como `width`.
- **Tablas editables**: al colocar el cursor dentro de una tabla aparece una barra flotante sobre
  ella para añadir filas arriba o abajo, columnas a izquierda o derecha y quitar la fila o la
  columna actual, sin volver a abrir el diálogo de inserción.
- **Corrector ortográfico**: el corrector del navegador está activo por defecto y se puede
  desactivar con su botón en la barra; la preferencia se guarda.
- **Idioma de corrección**: el selector que acompaña al corrector fija el idioma del texto
  (español, inglés, francés, alemán, portugués, gallego, catalán, italiano o automático) mediante
  el atributo `lang` del editor visual, para que el navegador use el diccionario adecuado.
- **Formato de página**: el botón del formato en la barra inferior del panel visual permite imitar
  **A4**, **Carta**, **Legal** o **A5**, con orientación vertical u horizontal y márgenes normales,
  estrechos, amplios, sin márgenes o personalizados en milímetros. La hoja se dibuja con ese
  tamaño, y el formato se aplica también a la vista previa, al HTML descargado y al PDF. Con
  **Hoja completa** el área de escritura ocupa todo el panel.
- **Imprimir**: el botón de impresión y `Ctrl`+`P` abren las opciones de papel (A4, Carta, A5 o
  Legal), orientación y márgenes. La hoja de impresión tiene `@page { margin: 0 }`, de modo que el
  navegador no añade encabezado ni pie de página y el documento se imprime como se ve.
- **PDF real**: la opción **PDF** del menú Descargar (y la impresora de la vista previa) abre el
  diálogo del navegador con el mismo CSS de la vista previa y con el tamaño y los márgenes de la
  hoja: elige «Guardar como PDF» para obtener el archivo.
- **Limpieza** con 11 reglas (estilos inline, clases e IDs, etiquetas vacías, etiquetas con un
  espacio, espacios repetidos, comentarios, atributos, a texto plano, Smart `&nbsp;`, caracteres
  «IA» y scripts/estilos). El botón **Limpieza** aplica todas las reglas marcadas; cada regla
  también se puede ejecutar por separado.
- **Buscar y reemplazar** con hasta 10 reglas aplicadas en orden, modo regex y opción de ignorar
  mayúsculas. Las reglas se guardan en el navegador.
- **Importar**: arrastra un archivo a la ventana o usa **Abrir** (`.html`, `.htm`, `.md`,
  `.docx`, `.txt`). Los DOCX se convierten con Mammoth y sus imágenes se incrustan como
  `data:` URIs; los Markdown se convierten con marked.
- **Exportar**: HTML listo para publicar (con el formato de página elegido), ZIP con carpeta
  `images/` cuando el documento lleva imágenes incrustadas, DOCX para Word, Markdown y PDF.
- **Código en vivo y siempre ordenado**: mientras escribes en el panel visual, el código se
  actualiza cada pocos milisegundos y llega ya indentado, sin esperas ni reindentados posteriores.
  Al pegar en el panel de código también se ordena solo; *Indentar* sigue disponible y *Comprimir*
  se respeta hasta que vuelvas a editar.
- **Historial de versiones**: el editor guarda una versión del documento cada pocos minutos
  (intervalo configurable entre 1 y 30 minutos, o solo manual); el reloj de la cabecera abre la
  lista y, dentro, **Guardar ahora** crea una versión al momento. Cada versión muestra título,
  fecha, tamaño y un resumen; puedes restaurarla (con confirmación y opción de deshacer con
  `Ctrl`+`Z`) o borrarla. Se conservan hasta 30 versiones en `localStorage`, solo en ese navegador.
- **Revisión del HTML**: mientras escribes, la barra del panel de código analiza el HTML y avisa de
  etiquetas sin cerrar, cierres que no corresponden, anidamientos raros, atributos repetidos o en
  mayúsculas, `id` duplicados, imágenes sin `alt`… El aviso indica errores y avisos; al pulsarlo se
  abre la lista y cada problema lleva a su línea y columna exactas.
- **Paleta de comandos**: `Ctrl`+`K` (o la lupa de la cabecera) abre un buscador con todas las
  acciones —archivo, edición, insertar, vista, Markdown, corrección y ayuda— y sus atajos. Escribe
  «tabla», «oscuro», «PDF», «margenes»… (no importan los acentos), muévete con las flechas y pulsa
  `Enter`.
- **Modo enfoque**: `F11` (o el botón de la barra) oculta todo menos la hoja: sin cabecera, sin
  barra de herramientas, sin panel de código ni barras de estado. Se sale con `Esc`, con `F11` o con
  el botón «Salir del enfoque». La vista anterior se recupera al salir.
- **Notas al pie y listas de tareas** en Markdown: `[^1]` con su definición `[^1]: texto` crea
  notas numeradas con enlaces de ida y vuelta, y `- [x]` / `- [ ]` crea listas de tareas con
  casillas que se pueden marcar y desmarcar en el panel visual. Ambas se conservan al convertir de
  Markdown a HTML y de vuelta, y el HTML exportado las mantiene.
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
  el tamaño del documento y el crédito «© 2026 - jltaboada».
- **Modo claro y oscuro**: se cambia con el botón de la cabecera; también se oscurece la hoja del
  editor visual y el resaltado del código. La preferencia se guarda con el resto de ajustes.
- **Extras**: codificar/decodificar entidades HTML, indentar, comprimir, copiar el código,
  desplazamiento sincronizado de los paneles y Lorem ipsum.
- **Privacidad**: nada se envía a ningún servidor. El borrador y las preferencias viven en
  `localStorage`.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl` + `B` / `I` / `U` | Negrita, cursiva, subrayado |
| `Ctrl` + `K` | Abrir la paleta de comandos |
| `Ctrl` + `Shift` + `L` | Insertar o editar enlace |
| `Ctrl` + `S` | Guardar borrador en el navegador |
| `Ctrl` + `Shift` + `K` | Ejecutar limpieza |
| `Ctrl` + `Shift` + `F` | Indentar el código |
| `Ctrl` + `Alt` + `D` | Descargar HTML |
| `Ctrl` + `P` | Abrir las opciones de impresión |
| `Ctrl` + `Shift` + `P` | Abrir la vista previa |
| `F11` | Modo enfoque (solo la hoja) |
| `F1` | Abrir la ayuda |
| `Esc` | Cerrar diálogo, paleta o menú; salir del modo enfoque |

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
assets/js/page.js          Formatos de papel, orientación y márgenes (A4/Carta/Legal/A5)
assets/js/lint.js          Revisión del HTML: etiquetas, atributos e ids
assets/js/history.js       Historial de versiones en localStorage
assets/js/commands.js      Paleta de comandos (búsqueda y teclado)
assets/js/wysiwyg.js       Editor visual sobre un iframe aislado
assets/js/files.js         Lectura de archivos y exportación HTML/ZIP/DOCX
assets/js/findreplace.js   Panel de buscar y reemplazar
assets/js/markdown.js      Conversión HTML ⇄ Markdown (marked + Turndown), notas y tareas
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

## Invítame a una caña

El editor es gratuito, no tiene anuncios, cuentas ni límites de uso, y todo el código está aquí
para que lo uses o lo cambies a tu gusto. Si te resulta útil y te apetece, puedes invitarme a una
caña por PayPal:

**→ [Invitar una caña con PayPal](https://www.paypal.com/donate/?business=jltaboada%40gmail.com&currency_code=EUR&item_name=Editor%20WYSIWYG)**

También puedes enviar el importe que quieras a **jltaboada@gmail.com** desde PayPal (con cuenta o
con tarjeta, sin necesidad de registrarte). Es totalmente opcional, no desbloquea nada y no cambia
el precio del editor, que seguirá siendo libre. Y si no mandas nada, también me alegro de que lo
uses.

¡Gracias por pasarte!
