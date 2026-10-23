# Iconos de la app

Aquí están el icono de la cabecera, el favicon y los iconos de instalación. Todos salen del mismo
dibujo maestro, así que si lo cambias, cámbialo en un sitio y vuelve a generar el resto.

## Archivos

| Archivo | Tamaño | Para qué |
| --- | --- | --- |
| `icon.svg` | vectorial (512 × 512) | Maestro. Favicon moderno y referencia para todo lo demás |
| `icon-maskable.svg` | vectorial (512 × 512) | Maestro con fondo a sangre, para iconos recortables |
| `plantilla-icono.svg` | vectorial (512 × 512) | Plantilla con guías para dibujar un icono nuevo |
| `favicon.ico` | 48, 32 y 16 px | Pestaña del navegador y marcadores antiguos |
| `favicon-32.png` | 32 × 32 | Favicon PNG de reserva |
| `apple-touch-icon.png` | 180 × 180 | Icono al añadir la web a la pantalla de inicio en iOS/iPadOS |
| `icon-192.png`, `icon-512.png` | 192 y 512 px | Iconos de la app web (Web App Manifest) |
| `icon-maskable-512.png` | 512 × 512 | Al añadir a la pantalla de inicio en Android, con recorte circular o cuadrado |

El manifest que los declara es `site.webmanifest`, en la raíz del repositorio.

## Proporciones para dibujar uno nuevo

Todo se dibuja sobre un **lienzo cuadrado**. La cuadrícula de referencia es 512 × 512, pero vale
cualquier tamaño si mantienes los porcentajes.

- **Lienzo:** cuadrado, 1:1. Para el icono normal (esquinas redondeadas), el radio de la esquina es
  el **23,4 % del lado** (120 px sobre 512). Si entregas un PNG, ese redondeo ya va incluido.
- **Zona segura:** el dibujo (monitor, glifo, peana) cabe dentro del **80 % central** del lienzo, es
  decir, deja un **10 % de margen** por cada lado. Es lo que evita que Android o iOS recorten el
  dibujo al instalar la web.
- **Grosor de trazo:** el **5 % del lado** (26 px sobre 512), redondeado en los extremos y en las
  uniones.
- **Glifo `</>`:** ocupa el **45 % del ancho** del lienzo y va centrado dentro de la pantalla, con
  la barra inclinada unos 12°.
- **Peana:** 8 % de alto y 17 % de ancho, centrada bajo la pantalla.
- **Colores:** fondo `#9c3b2d` (el rojo oscuro de la marca) y dibujo blanco `#ffffff`. El modo
  oscuro cambia el rojo a `#b5483a`, pero el icono no cambia.

### Versión «maskable»

Para el icono que Android recorta, el fondo llega a los cuatro bordes (sin esquinas redondeadas) y
el dibujo se reduce al **78 %** para que quepa incluso en un recorte circular. Es
`icon-maskable.svg`.

### Plantilla

`plantilla-icono.svg` es un lienzo de 512 × 512 con las guías ya dibujadas: la forma redondeada, el
margen del 10 %, el círculo de recorte de Android y los ejes centrales. Ábrela en Figma, Illustrator
o Inkscape, dibuja encima y elimina las guías antes de exportar.

### Si me lo pasas

Lo ideal es un **SVG cuadrado de 512 × 512** con el dibujo ya centrado, o si es más cómodo, un
**PNG de 1024 × 1024** con fondo transparente fuera de la forma del icono. Con eso genero el resto
de tamaños y los dejo conectados en `index.html` y en el manifest.

## Regenerar los PNG

Los PNG se generan desde los SVG con un navegador headless; no hace falta ninguna herramienta
instalada en el proyecto. Si cambias `icon.svg`, vuelve a exportar a 512, 192, 32 y 180 px, y crea
el `.ico` con las tres medidas.
