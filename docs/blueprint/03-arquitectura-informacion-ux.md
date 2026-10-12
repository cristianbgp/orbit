# Arquitectura de información y UX

## Navegación implementada

La aplicación usa una sidebar shadcn colapsable:

```text
Buscar                 Ctrl/⌘ K
Proyectos
Casos
Mi trabajo
Actividad
Clientes
Equipo

Perfil
Cerrar sesión
```

En móvil, la sidebar se presenta como panel superpuesto y existe una cabecera compacta. La preferencia colapsada se conserva globalmente.

### Búsqueda global

El botón Buscar y el atajo `Ctrl/⌘ K` abren un Command de shadcn. Busca dentro del estudio activo casos, proyectos, tareas, clientes y miembros; excluye casos, proyectos y tareas archivados, pero conserva los concluidos o completados. En casos cubre identificación, expediente, cliente, materia controvertida y resolución impugnada. Toda búsqueda textual ignora mayúsculas, tildes y diferencias como `ñ/n`, sin convertir `%`, `_` o `\\` en operadores. Los resultados llevan al contexto correspondiente, incluyendo el detalle de un caso y el Sheet de una tarea mediante su URL.

Sin consulta, el Command ofrece la navegación principal y tres acciones globales de creación seguras: crear caso, crear proyecto y crear cliente. Cuando `orbit_help_assistant` está habilitada, también ofrece **Preguntar a Orbit**. La creación de tareas permanece dentro de un proyecto. La consulta comienza con dos caracteres, usa debounce y mantiene el límite de acceso a cada entidad como una frontera explícita para permisos futuros.

## Páginas principales

### Actividad

Historial de movimientos de todo el estudio, separado de las vistas de trabajo. La ruta `/activity` conserva actividad de proyectos activos, completados o archivados y la presenta de más reciente a más antigua. La primera carga usa 25 entradas y **Cargar más** solicita páginas anteriores mediante cursor sin retirar las entradas ya visibles ante un error.

### Mi trabajo

Una sola página separa mediante tabs **Mis tareas** —vista predeterminada—, **Bajo mi supervisión** y **Acciones de casos**. La cabecera de la cartera reúne búsqueda, filtros compactos, total y estado de actualización. Las dos primeras vistas conservan sus filtros de tareas y proyectos; Acciones de casos usa filtros independientes por cliente, caso y tipo. La URL conserva la vista, los filtros y la paginación.

Las tareas se agrupan por su intervalo planificado, en grupos mutuamente excluyentes: completadas; vencidas si su fecha límite ya pasó; hoy si el día actual está entre su inicio y su fecha límite; esta semana si el intervalo todavía no empezó pero se cruza con la semana actual —lunes a domingo en la zona horaria del estudio—; a futuro si empieza después; y sin fecha cuando no existe un intervalo completo. Cada cabecera hace visible el alcance que aplica, por ejemplo `18 ago 2026`, `17-23 ago 2026`, `Hasta 17 ago 2026` o `Desde 24 ago 2026`; los grupos sin criterio temporal declaran su alcance en texto. Sus filas leen cliente, proyecto y tarea en ese orden, conservan estado inline, etapa y fechas, y muestran los encargados por posición profesional en grupos compactos con identidad accesible.

Los grupos múltiples de avatares siguen el orden Socio, Senior, Junior, Asistente, Practicante y Sin posición; omiten grupos vacíos, muestran hasta tres identidades por posición y abren el resto mediante un Popover propio del grupo. Tooltip y Popover incluyen alias, nombre, posición y rol contextual.

Los proyectos supervisados usan filas compactas con periodo y una barra proporcional global para tareas pendientes, en trabajo, suspendidas y completadas. **Sin encargado** es una alerta separada porque puede coincidir con cualquier estado. El resumen excluye tareas archivadas, no cambia con los filtros y precede a un disclosure que revela primero las tareas que requieren atención; desde allí puede cargarse el listado activo paginado.

Acciones de casos lista únicamente acciones encargadas al usuario cuya participación en el caso sigue activa. Se agrupan por cliente y caso, permiten completar o reabrir inline y, como no tienen fechas, no se mezclan con Hoy, Esta semana o A futuro.

### Proyectos

La cartera es exclusivamente un listado. Los tabs separan proyectos En curso, Completados y Archivados; el archivo sigue siendo un ciclo independiente del estado y reemplaza la cancelación como forma de retirar trabajo de la operación. Abre agrupada en secciones expandibles por cliente; también permite agrupar por estado cuando la vista contiene varios estados, o no agrupar. Cada página por cliente conserva grupos completos, mientras cada grupo de estado tiene consulta y paginación propias.

La toolbar sigue un patrón compacto de propiedades: búsqueda visible por proyecto, tarea no archivada, cliente o referencia interna, botón **Filtro**, chips editables y botón **Vista** para agrupación y orden. **Mis proyectos** es un atajo al filtro de miembros: al activarlo sustituye solo esa propiedad por el usuario actual, conserva búsqueda y demás filtros, y permite añadir otros miembros después. Estado, tipo, cliente y miembros aceptan selección múltiple sin exponer operadores técnicos. Dentro de una propiedad se aplica OR; entre propiedades se aplica AND; para miembros se exige que todos los seleccionados participen activamente. En desktop el editor abre en Popover y en móvil en un Sheet de alto acotado. La URL conserva `q`, filtros repetidos, `view`, `groupBy`, `orderBy` y `order`. Cada fila presenta identidad, inicio, final y equipo activo en columnas alineadas sin convertir la fecha final en un bloque dominante.

### Casos

La cartera procesal `/cases` reutiliza el marco de Proyectos, pero no su dominio de tareas. Agrupa por cliente y separa el ciclo de vida en tabs En trámite/Concluidos/Archivados. Tipo, cliente y miembro se aplican como filtros multiselección combinables y persistentes en la URL. Cada caso alinea identificación, período, expediente, etapa y equipo; el tributo permanece en el detalle y no recarga esta fila resumida. Debajo, Novedades y Acciones tienen disclosures independientes: en desktop forman una grilla con Novedades a la izquierda y Acciones a la derecha; en móvil se apilan en ese orden. Cada contenedor conserva su propia altura, incluso si el panel vecino está expandido. Ambos se cargan bajo demanda, muestran tres entradas inicialmente y pueden expandirse por separado. Cada fila permite editar desde el mismo Sheet; las acciones además cambian pendiente/completada con un selector de estado compacto que mantiene al encargado junto a la descripción. Un botón contextual por sección permite crear mediante Sheet desde la misma cartera, identificando caso y cliente; toda escritura se oculta para registros archivados. Los antecedentes no aparecen en las vistas previas: viven en el detalle, dentro de un disclosure propio cerrado por defecto bajo Novedades. Una acción global secundaria en la cabecera de Casos permite convertir, con confirmación y alcance previo, todas las novedades activas de los casos no archivados del estudio en antecedentes, sin depender de filtros ni pestaña actual. Crear usa una página dedicada; detalle muestra proceso, equipo y actividad; Configurar reúne datos generales, miembros y archivo/restauración. Los equipos de casos se agrupan siempre por posición profesional, con la misma jerarquía compacta usada por Proyectos, tanto al consultar como al gestionar miembros e historial.

`/cases/presentation` es una lectura continua para la reunión semanal, distinta del listado operativo. Consume un único agregado de cartera, abre clientes y casos por defecto y presenta Novedades, Acciones y Eventos con edición contextual en vivo. Bajo Novedades muestra como contexto los tres antecedentes más recientes y permite expandir todos inline, manteniendo el orden más reciente primero y el mismo Sheet de edición. La edición general y del equipo también ocurre dentro de un Sheet amplio, que carga el detalle bajo demanda para evitar una consulta adicional por cada fila. Sus filtros y opciones adicionales se guardan en la URL; la expansión queda local. La barra reúne Casos concluidos, Acciones completadas y Eventos pasados bajo **Contenido adicional**. La ruta siempre reemplaza visualmente el shell por un documento de viewport completo, con barra fija, acciones explícitas para volver o salir hacia Casos y pantalla completa nativa opcional.

### Detalle del proyecto

La jerarquía diaria es task-first:

1. Resumen de proyecto y periodo.
2. Eventos legales en modo consulta.
3. Cronograma de tareas agrupado por etapas.
4. Lista o board por etapas.
5. Actividad del proyecto.

Seleccionar una tarea abre un Sheet sin abandonar el contexto. La URL conserva `task=<id>` y permite enlaces directos.

### Configuración del proyecto

Pantalla separada para cambios menos frecuentes: datos generales, eventos, equipo, estructura de etapas y archivo/restauración.

### Clientes y equipo

Clientes ofrece búsqueda, paginación y formulario. Equipo ofrece directorio, invitaciones y perfiles de miembros con alias y avatar. Los perfiles ajenos son de solo lectura.

### Perfil propio

La ruta `/profile` permite modificar conjuntamente el alias y el fondo del avatar. La elección se limita a la paleta Orbit aprobada, muestra una vista previa inmediata y conserva la selección ante errores recuperables. El usuario no escribe un hexadecimal ni elige el foreground: Orbit calcula el texto de mayor contraste. Guardar invalida las superficies que presentan identidades para que sidebar, equipo, proyectos, tareas, actividad, búsqueda y Mi trabajo reciban el cambio.

### Preguntar a Orbit

Ayuda documental autenticada y experimental. La ruta `/help/ask` solo se presenta cuando la flag del estudio está habilitada. Consulta el blueprint mediante Groq, muestra las secciones usadas como fuentes y no recibe datos del estudio.

La cabecera conserva el ancho común de las páginas autenticadas y el asistente
usa una columna de lectura más estrecha. La pregunta vive en un formulario:
recibe foco al aparecer, `Enter` envía, `Shift+Enter` agrega una línea y las
preguntas sugeridas devuelven el foco al textarea sin enviarse automáticamente.
Tras responder, Orbit mantiene visible la pregunta y presenta Markdown sencillo
con jerarquía tipográfica contenida. Admite párrafos, encabezados, listas,
checklists de solo lectura, énfasis, tachado, citas, separadores, código y tablas
con scroll horizontal local. Omite HTML e imágenes y convierte cualquier enlace
generado en texto no clicable. Las fuentes del blueprint se muestran en un bloque
propio y no dependen del Markdown del proveedor. Una respuesta cortada por el
límite del proveedor se reintenta una vez de forma más concisa; si vuelve a
cortarse, la UI conserva el contenido con una advertencia explícita.

## Flujo de creación del proyecto

1. Elegir cliente.
2. Ingresar nombre y tipo.
3. Elegir estado inicial.
4. Seleccionar fecha de inicio y fecha final.
5. Agregar opcionalmente una fecha legal inicial.
6. Ingresar referencia interna o descripción si aportan contexto.
7. Crear el proyecto; Orbit copia las etapas del tipo elegido.

No existe cálculo jurídico ni generación automática de fechas relativas.

## Jerarquía de información

1. ¿Qué proyecto o tarea necesita atención?
2. ¿Cuál es su estado y fecha relevante?
3. ¿En qué etapa se encuentra?
4. ¿Quién se encarga de la tarea o supervisa el proyecto?
5. ¿Qué cambió recientemente?

## Responsive y accesibilidad

- Todas las páginas autenticadas comparten el marco exterior `AppPage`, con el
  mismo ancho máximo, gutters, ritmo vertical y alineación que Proyectos. Las
  páginas normales no redefinen el padding superior: así la cabecera permanece
  fija al cambiar entre entradas de la sidebar. Formularios y texto pueden
  conservar una medida interna legible, alineada al borde inicial en vez de
  recentrar toda la página.
- Las páginas autenticadas usan `AppPageHeader` como encabezado visual: icono,
  eyebrow contextual, título, descripción y acciones opcionales. El icono es
  obligatorio, decorativo y reutiliza el de la sidebar cuando la página tiene
  una entrada de navegación. El resumen de proyecto conserva su composición de
  dominio, pero usa el mismo tratamiento visual para `FolderKanban`.
- Desktop prioriza timeline, board y densidad de información.
- Móvil conserva tareas, estados, agenda, sheets, filtros y navegación; evita hacer scroll conjunto entre etiquetas fijas y calendario.
- Targets táctiles relevantes miden al menos 44 px en móvil.
- Todo tooltip usa el componente shadcn y también funciona por foco.
- Edición de fechas por drag tiene alternativa de teclado y formulario.
- Estado nunca se comunica únicamente mediante color.
- Loading, vacío, error recuperable, archivado y conflicto tienen presentación explícita.

## Evolución aprobada

Las notificaciones internas podrán añadir una bandeja personal solo si mantienen separada la actividad histórica y justifican ocupar la navegación principal. El resto de la evolución vigente está consolidada en [11-roadmap.md](11-roadmap.md); reportes, templates personalizados y proyectos fijados no están comprometidos.
