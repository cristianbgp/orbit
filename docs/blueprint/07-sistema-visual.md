# Sistema visual

## Personalidad

Profesional, precisa, sobria, tecnológica y humana. Orbit se percibe como una herramienta de trabajo premium, no como software jurídico tradicional ni una interfaz espacial decorativa.

## Tipografía

- **Marca y titulares:** Instrument Sans.
- **Interfaz, tablas, fechas y datos:** Inter.
- **Lectura jurídica extensa — futuro:** Source Serif 4 opcional.

| Uso | Tamaño/altura | Peso |
|---|---:|---:|
| Display | 32/38 | 600 |
| Título de proyecto | 28/34 | 600 |
| H1 | 24/30 | 600 |
| H2 | 18/24 | 600 |
| H3 | 16/22 | 600 |
| Body | 14/20 | 400 |
| Compacto | 13/18 | 400–500 |
| Metadata | 12/16 | 500 |

## Tokens principales implementados

| Token CSS | Valor | Uso |
|---|---|---|
| `--background` | `#F7F8FB` | fondo de aplicación |
| `--foreground` | `#11182B` | texto principal |
| `--card` | `#FFFFFF` | paneles |
| `--muted-foreground` | `#5B6B82` | metadata |
| `--border` | `#E2E7EF` | bordes |
| `--primary` | `#5B6EF5` | primario |
| `--primary-strong` | `#4657D9` | primario fuerte |
| `--violet` | `#7C5CFC` | acento de marca |
| `--sidebar` | `#07162F` | fondo de sidebar |

El gradiente azul-violeta se reserva para marca y momentos seleccionados; no se aplica a todos los botones.

## Semánticos

| Estado | Fuerte | Suave |
|---|---|---|
| Éxito | `#1F9D72` | `#EAF8F2` |
| Advertencia | `#8A5A00` | `#FFF4D6` |
| Peligro | `#B42318` | `#FDECEC` |
| Información | `#3B82F6` | `#EAF2FF` |

Los estados de tarea cuentan además con icono y texto. El color nunca es su única señal.

## Forma y espacio

- Grid base de 4 px; ritmo 8/12/16/24/32.
- Cards: radio 12 px.
- Inputs y botones: radio 10 px.
- Badges y avatares: cápsula o círculo.
- Bordes finos y sombras mínimas.
- Contenedores de página con ancho consistente; una vista no debe cambiar el frame global al ajustar zoom.

## Componentes visuales implementados

- Sidebar shadcn colapsable y navegación móvil.
- Sheets para detalles y formularios contextuales.
- Tooltips shadcn por hover y foco.
- Calendario shadcn para fecha y rango.
- Select de estado, incluidas variantes compactas e icon-only.
- Skeletons y pantallas de preparación responsive.
- Avatares por alias con una paleta Orbit de diez colores y contraste AA automático.
- Timeline con zoom, scroll local y panel redimensionable.

## Iconografía

Lucide es la familia vigente. Iconos lineales, geométricos, de 16/18/20/24 px y trazo consistente.

Evitar clichés jurídicos o espaciales: balanza, martillo, columna, planeta y estrella. Un evento legal usa calendario, hito o marcador neutral; su etiqueta aporta la semántica.

## Avatares

El avatar muestra hasta tres caracteres del alias. Los usuarios nuevos reciben un color determinista y cada persona puede sustituirlo desde su perfil por uno de los diez fondos aprobados. Se guarda el hexadecimal normalizado; no existe selector libre ni edición del color del texto. Orbit elige automáticamente entre blanco y grafito según el mayor contraste WCAG. Las identidades históricas sin usuario activo conservan su snapshot y pueden omitir el color personalizado.

Cuando una superficie presenta varias personas, agrupa sus avatares por posición profesional en el orden Socio, Senior, Junior, Asistente, Practicante y Sin posición. Cada rótulo usa texto compacto en mayúsculas, los grupos se separan con una línea vertical sutil y solo se muestran posiciones presentes. Se ven hasta tres avatares superpuestos por grupo; `+N` abre un Popover scrollable con las identidades restantes de esa posición. Los tooltips declaran alias, nombre, posición y rol contextual.

Paleta vigente:

```text
#4657d9  #4057ed  #07162f  #11182b  #0f766e
#047857  #7e3a8a  #9f3151  #a43f27  #8a5a00
```

El selector usa radios nativos con nombre accesible, indicador de selección, focus visible y targets de 44 px. El check y el nombre accesible impiden que el color sea la única señal. Todo nuevo fondo debe demostrar contraste mínimo 4.5:1 con al menos uno de los foregrounds permitidos: blanco `#ffffff` o grafito `#11182b`.

## Movimiento

150–220 ms para hover, tooltip y Sheet; 220–320 ms para expansión y zoom. Sin rebote llamativo y respetando `prefers-reduced-motion`.

## Accesibilidad

- Contraste WCAG AA.
- Focus visible.
- Targets táctiles de 44 px en móvil para controles principales.
- Estados con texto o nombre accesible.
- Scroll horizontal contenido en el componente propietario.
- Animaciones no esenciales reducibles.
