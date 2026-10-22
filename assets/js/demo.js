/* Contenido de demostración y texto de relleno */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  App.DEMO_HTML = [
    '<!-- #############################################',
    '     DEMO DEL EDITOR · pulsa "Clean" para ver',
    '     cómo actúan las reglas de limpieza.',
    '     ############################################# -->',
    '<h1 class="tituloPrincipal" style="color: #b84516; text-align: center;">Editor HTML <span style="color: #0e658f;">online</span></h1>',
    '<p class="entradilla" style="font-size: 18px; line-height: 1.6; text-align: center;">',
    '  Escribe a la izquierda, edita el código a la derecha y observa cómo ambos paneles se actualizan <strong style="color: #b84516;">en tiempo real</strong>.',
    '</p>',
    '<p style="text-align: center;">',
    '  <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgNDIwIDEyMCI+PHJlY3Qgd2lkdGg9IjQyMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxNiIgZmlsbD0iI2ZiZThkYyIvPjxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iMTgiIGZpbGw9IiNiODQ1MTYiLz48cGF0aCBkPSJNNDggNDZsLTEwIDE0IDEwIDE0TTcyIDQ2bDEwIDE0LTEwIDE0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHRleHQgeD0iMTE4IiB5PSI2MiIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMzYTI0MTciPkVkaXRvciBIVE1MPC90ZXh0Pjx0ZXh0IHg9IjExOCIgeT0iODgiIGZvbnQtZmFtaWx5PSJTZWdvZSBVSSxBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE1IiBmaWxsPSIjOGE2YTU0Ij5EZW1vIC0gc2luIGNvbmV4aW9uPC90ZXh0Pjwvc3ZnPg==" alt="Tarjeta de demostración del editor" width="420" class="demoImagen">',
    '</p>',
    '<h2 style="color: #2e6c80; border-bottom: 2px solid #eee; padding-bottom: 6px;">Qué puedes hacer</h2>',
    '<ul class="listaDemo" style="line-height: 1.9;">',
    '  <li><strong>Formatear</strong> texto con la barra superior: títulos, negritas, colores, listas y tablas.</li>',
    '  <li><strong>Limpiar</strong> código pegado desde Word, webs o herramientas de IA.</li>',
    '  <li><strong>Buscar y reemplazar</strong> con expresiones regulares.</li>',
    '  <li><strong>Importar</strong> un .docx o .html y <strong>exportar</strong> a HTML, ZIP o Word.</li>',
    '</ul>',
    '<p>&nbsp;</p>',
    '<p></p>',
    '<h2 style="color: #2e6c80;">Antes y después de la limpieza</h2>',
    '<table class="tablaDemo" border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">',
    '  <thead>',
    '    <tr style="background: #f6f1e8;">',
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
    '<blockquote style="border-left: 4px solid #b84516; margin: 18px 0; padding: 4px 0 4px 16px; color: #555;">',
    '  <em>“El mejor código es el que no necesitas limpiar… pero si lo necesitas, este botón <strong>Clean</strong> ayuda.”</em>',
    '</blockquote>',
    '<h3 style="color: #444;">Un enlace de ejemplo</h3>',
    '<p>Visita <a href="https://developer.mozilla.org/es/docs/Web/HTML" target="_blank" rel="noopener" class="enlaceDemo" style="color: #b84516;">la documentación de HTML en MDN</a> para seguir aprendiendo.</p>',
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
