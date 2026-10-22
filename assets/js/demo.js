/* Contenido de demostración y texto de relleno */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  App.DEMO_HTML = [
    '<!-- #############################################',
    '     DEMO DEL EDITOR · pulsa "Clean" para ver',
    '     cómo actúan las reglas de limpieza.',
    '     ############################################# -->',
    '<h1 class="tituloPrincipal" style="color: #02874d; text-align: center;">Editor HTML <span style="color: #5f452a;">online</span></h1>',
    '<p class="entradilla" style="font-size: 18px; line-height: 1.6; text-align: center;">',
    '  Escribe a la izquierda, edita el código a la derecha y observa cómo ambos paneles se actualizan <strong style="color: #02874d;">en tiempo real</strong>.',
    '</p>',
    '<p style="text-align: center;">',
    '  <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgNDIwIDEyMCI+PHJlY3Qgd2lkdGg9IjQyMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxMCIgZmlsbD0iI2YyZjZmNSIvPjxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iMTAiIGZpbGw9IiMwMjg3NGQiLz48cGF0aCBkPSJNNDggNDZsLTEwIDE0IDEwIDE0TTcyIDQ2bDEwIDE0LTEwIDE0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHRleHQgeD0iMTE4IiB5PSI2MiIgZm9udC1mYW1pbHk9IlZhcmVsYSBSb3VuZCxBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMjIyMjIyIj5FZGl0b3IgSFRNTDwvdGV4dD48dGV4dCB4PSIxMTgiIHk9Ijg4IiBmb250LWZhbWlseT0iVmFyZWxhIFJvdW5kLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTUiIGZpbGw9IiM1ZjQ1MmEiPkRlbW8gwrcgc2luIGNvbmV4acOzbjwvdGV4dD48L3N2Zz4=" alt="Tarjeta de demostración del editor" width="420" class="demoImagen">',
    '</p>',
    '<h2 style="color: #02874d; border-bottom: 2px solid #dddddd; padding-bottom: 6px;">Qué puedes hacer</h2>',
    '<ul class="listaDemo" style="line-height: 1.9;">',
    '  <li><strong>Formatear</strong> texto con la barra superior: títulos, negritas, colores, listas y tablas.</li>',
    '  <li><strong>Limpiar</strong> código pegado desde Word, webs o herramientas de IA.</li>',
    '  <li><strong>Buscar y reemplazar</strong> con expresiones regulares.</li>',
    '  <li><strong>Importar</strong> un .docx o .html y <strong>exportar</strong> a HTML, ZIP o Word.</li>',
    '</ul>',
    '<p>&nbsp;</p>',
    '<p></p>',
    '<h2 style="color: #02874d;">Antes y después de la limpieza</h2>',
    '<table class="tablaDemo" border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">',
    '  <thead>',
    '    <tr style="background: #f2f6f5;">',
    '      <th align="left" style="padding: 8px;">Regla</th>',
    '      <th align="left" style="padding: 8px;">Ejemplo</th>',
    '    </tr>',
    '  </thead>',
    '  <tbody>',
    '    <tr>',
    '      <td>Estilos inline</td>',
    '      <td><span style="color: green; font-size: 13px;">Este texto tiene estilo incrustado</span></td>',
    '    </tr>',
    '    <tr>',
    '      <td>Clases e IDs</td>',
    '      <td><span id="demoId" class="demoClass">Este texto tiene clase e identificador</span></td>',
    '    </tr>',
    '    <tr>',
    '      <td>Espacios repetidos</td>',
    '      <td>Hola&nbsp;&nbsp;&nbsp;&nbsp;mundo&nbsp;&nbsp;cruel</td>',
    '    </tr>',
    '    <tr>',
    '      <td>Comentarios</td>',
    '      <td><!-- Este comentario desaparecerá con Clean -->Visible para las personas</td>',
    '    </tr>',
    '    <tr>',
    '      <td>Caracteres “IA”</td>',
    '      <td>Comillas “tipográficas”, guiones —largos—, puntos suspensivos… y un carácter invisible\u200b.</td>',
    '    </tr>',
    '  </tbody>',
    '</table>',
    '<p>&nbsp;</p>',
    '<blockquote style="border-left: 4px solid #02874d; margin: 18px 0; padding: 4px 0 4px 16px; color: #555;">',
    '  <em>“El mejor código es el que no necesitas limpiar… pero si lo necesitas, este botón <strong>Clean</strong> ayuda.”</em>',
    '</blockquote>',
    '<h3 style="color: #444;">Un enlace de ejemplo</h3>',
    '<p>Visita <a href="https://developer.mozilla.org/es/docs/Web/HTML" target="_blank" rel="noopener" class="enlaceDemo" style="color: #02874d;">la documentación de HTML en MDN</a> para seguir aprendiendo.</p>',
    '<p style="font-size: 12px; color: #999; text-align: center;">Demo creada para probar la limpieza · borra este texto y empieza a escribir</p>',
  ].join('\n');

  App.LIPSUM = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Cras mattis consectetur purus sit amet fermentum. Donec ullamcorper nulla non metus auctor fringilla.',
    'Maecenas faucibus mollis interdum. Vestibulum id ligula porta felis euismod semper. Aenean lacinia bibendum nulla sed consectetur. Nullam quis risus eget urna mollis ornare vel eu leo.',
    'Curabitur blandit tempus porttitor. Etiam porta sem malesuada magna mollis euismod. Donec sed odio dui. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.',
    'Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus. Nulla vitae elit libero, a pharetra augue. Sed posuere consectetur est at lobortis.',
    'Morbi leo risus, porta ac consectetur ac, vestibulum at eros. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum.',
  ];

  App.getLipsumHtml = function () {
    return '\n' + App.LIPSUM.map((paragraph) => '<p>' + paragraph + '</p>').join('\n') + '\n';
  };

  App.EMPTY_DOC = '<p><br></p>';
})(window);
