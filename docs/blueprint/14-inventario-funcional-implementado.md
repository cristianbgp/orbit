# Inventario funcional implementado

Última verificación: 20 de agosto de 2026

Este documento enumera las capacidades que existen hoy en el repositorio. Sirve como referencia rápida para producto, desarrollo y **Preguntar a Orbit**. Si una descripción entra en conflicto con el código, prevalecen los contratos, rutas, migraciones y pruebas del repositorio; [12-decisiones-y-pendientes.md](12-decisiones-y-pendientes.md) conserva la autoridad sobre decisiones de producto.

## Acceso, estudio e identidad

- Registro, inicio y cierre de sesión con Better Auth.
- Onboarding para crear un estudio y flujo previo para invitaciones pendientes.
- Invitaciones mediante enlace privado con expiración explícita de 48 horas y posición profesional obligatoria; aceptar o rechazar como invitado, y cancelar, regenerar o copiar como owner.
- Cierre de sesión disponible también durante onboarding, invitaciones y otros estados previos a la aplicación.
- La instalación es multi-tenant, pero actualmente cada usuario puede pertenecer a **un solo estudio**. No existe selector ni cambio entre varios estudios.
- Cada estudio tiene zona horaria; el valor inicial es `America/Lima`.
- Directorio paginado de miembros con búsqueda por nombre, correo o alias y filtro por posición; perfiles propios editables y perfiles ajenos de solo lectura.
- Identidad alias-first: alias no único de 2 a 12 caracteres, tooltip con nombre completo y avatar textual.
- Cada usuario modifica únicamente su alias y color de avatar. El color se guarda como hexadecimal de una paleta aprobada y Orbit calcula el foreground accesible.
- Posición profesional de membresía: Socio, Senior, Junior, Asistente o Practicante. El owner la asigna al invitar y puede cambiarla desde Equipo; owners fundadores y datos anteriores pueden mostrar `Sin posición`.
- La posición profesional es informativa y permanece separada del rol de acceso, la supervisión de proyectos y los encargos de tareas.
- El owner puede retirar miembros. La operación finaliza sus asignaciones activas de proyectos y tareas, cierra sus sesiones del estudio y conserva snapshots en la actividad histórica.
- Los endpoints destructivos equivalentes de Better Auth están deshabilitados para no saltarse esa transacción.
- Un owner puede generar desde Equipo un enlace privado de recuperación para un miembro activo del mismo estudio. Better Auth lo limita a un uso y 30 minutos; al definir la nueva contraseña se revocan las sesiones anteriores.
- El formulario público `/reset-password?token=...` no muestra el token, exige al menos 8 caracteres y confirmación coincidente, y presenta errores inválidos o vencidos sin detalles internos.
- Para recuperar al único owner, el operador puede ejecutar `bun run --cwd apps/api auth:recovery-link --email usuario@estudio.pe`. El comando exige un correo exacto y solo imprime enlace y expiración después del éxito.
- La generación y la finalización crean auditoría de seguridad con snapshots, sin contraseña, token ni URL. El enlace se comparte manualmente por un canal confiable hasta implementar entrega por email.

## Navegación y superficies

| Ruta                            | Superficie actual                                                           |
| ------------------------------- | --------------------------------------------------------------------------- |
| `/`                             | Redirección reemplazable a `/projects`                                      |
| `/my-work`                      | Tareas encargadas al usuario y proyectos que supervisa                      |
| `/activity`                     | Historial paginado de actividad de todo el estudio                          |
| `/projects`                     | Cartera list-only agrupada por cliente, estado o sin agrupar                |
| `/projects/new`                 | Creación dedicada de proyecto, evento legal personalizable y equipo inicial |
| `/projects/:projectId`          | Detalle, cronograma, tareas y actividad del proyecto                        |
| `/projects/:projectId/settings` | Datos generales, eventos, equipo, etapas y archivo                          |
| `/clients`                      | Directorio y edición de clientes                                            |
| `/team`                         | Directorio de miembros; invitaciones en tab y Sheet                         |
| `/team/:userId`                 | Perfil de un miembro                                                        |
| `/profile`                      | Perfil propio                                                               |
| `/help/ask`                     | Preguntar a Orbit, solo con feature flag habilitada                         |
| `/reset-password?token=...`     | Nueva contraseña mediante enlace privado de un solo uso                     |

La aplicación usa una sidebar shadcn responsive y colapsable. Su preferencia se conserva globalmente. En móvil funciona como overlay y se cierra antes de abrir la búsqueda global. Todas las páginas autenticadas comparten el marco exterior `AppPage`, con el ancho y gutters de Proyectos; formularios y texto pueden conservar columnas internas legibles alineadas al inicio. Las elecciones finitas usan el `Select` de shadcn; las búsquedas y selecciones múltiples usan `Command` dentro de comboboxes. Toda búsqueda textual, tanto remota como local, ignora mayúsculas y diacríticos —incluyendo `ñ/n`— y conserva comodines escritos por el usuario como texto literal.

## Clientes

- Cliente persona o empresa.
- Ficha con nombre, tipo y número de documento, correo, teléfono, dirección y notas internas opcionales.
- Crear, consultar y editar; no existe eliminación ni archivo de clientes.
- Búsqueda por nombre o documento con debounce y paginación.
- Un cliente puede contener varios proyectos y es la unidad de agrupación predeterminada de la cartera.

## Proyectos

- Campos: nombre, cliente, tipo, estado, fecha de inicio, fecha final, referencia interna y descripción opcionales.
- Estados: borrador, activo y completado.
- Archivo y restauración separados del estado; un proyecto archivado es de solo lectura.
- Tipos: **Escrito (Demanda/Recurso/Escrito)**, **Consulta (Correo/Informe)**, **Informe oral** y **Otro**.
- Los tres primeros copian etapas iniciales al crear el proyecto; **Otro** inicia sin etapas. La copia queda totalmente editable y no se sincroniza con cambios futuros del preset.
- Cartera agrupada por cliente de forma predeterminada. Cada página cuenta clientes completos y cada grupo expandible incluye todos sus proyectos coincidentes.
- Tabs con alcance server-side: En curso contiene Borrador y Activo; Completados muestra su estado no archivado; Archivados contiene cualquier estado con `archivedAt`.
- Agrupación alternativa por estado mediante `groupBy=status` en En curso y Archivados, con consulta, total, error y paginación propios. Las vistas de un único estado no muestran esa opción redundante.
- Lista plana alternativa mediante `groupBy=none` y paginación; la misma toolbar compacta se usa en todas las agrupaciones.
- Búsqueda debounced por proyecto, tarea no archivada, cliente o referencia interna, junto con filtros múltiples por estado, tipo, cliente y miembros activos. Los valores de una propiedad son OR, las propiedades son AND y varios miembros requieren que todos participen en el proyecto.
- **Mis proyectos** aplica el usuario actual como único filtro de miembro sin alterar búsqueda, tab, estado, tipo, cliente, agrupación ni orden. Después pueden sumarse otros miembros y, al desactivarlo, solo se retira al usuario actual.
- Los filtros activos se presentan como chips editables. El editor usa Command dentro de Popover en desktop y Sheet responsive en móvil; agrupación y orden viven en **Vista**.
- La URL usa `q` y parámetros repetidos `status`, `type`, `client` y `member`, además de `view`, `groupBy`, `orderBy` y `order`.
- Orden explícito por fecha final, fecha de inicio, nombre o fecha de archivo, ascendente o descendente. En curso usa fecha final ascendente; Completados fecha final descendente; Archivados fecha de archivo descendente.
- Omitir `view` en el API conserva todos los proyectos no archivados para selectores auxiliares; la cartera siempre envía su tab de forma explícita.
- Cada fila muestra fecha de inicio, fecha final y el equipo activo completo agrupado por posición profesional. Cada grupo muestra hasta tres avatares, `+N` abre el resto de esa posición y los tooltips incluyen identidad, posición y rol.
- Crear proyecto puede incluir hasta 25 fechas legales iniciales personalizables, almacenadas como eventos independientes dentro de la misma transacción.
- La creación vive en `/projects/new`, empieza con el periodo vacío y selecciona el cliente mediante un combobox con búsqueda debounced.
- Al crear se puede añadir opcionalmente el equipo inicial y marcar a cero, uno o varios integrantes como supervisores. Proyecto, etapas, evento, asignaciones y actividades se guardan en una sola transacción; un miembro no disponible cancela toda la operación.

## Eventos del proyecto

- Evento independiente con título, fecha, tipo y descripción opcional.
- Tipos de dominio: `legal`, `meeting` y `other`; la UI actual crea y administra eventos legales.
- Debe ocurrir desde la fecha de inicio y puede quedar después de la fecha final.
- Crear, editar o eliminar un evento registra actividad inmutable con snapshot.
- La fecha final marca el cierre principal del proyecto; los eventos son hitos secundarios y no lo recalculan.

## Etapas

- Cualquier miembro activo puede crear, renombrar, describir, reordenar y eliminar una etapa vacía.
- Una etapa con tareas no se puede eliminar.
- El estado visual no se persiste: se deriva de sus tareas activas como sin tareas, pendiente, en curso, suspendida o completada.
- No existe constructor de templates personalizados, fechas propias, aprobaciones ni encargados propios de una etapa.

## Equipo y supervisión del proyecto

- Un proyecto admite cero, uno o varios supervisores; cualquiera puede marcarse como principal.
- La asignación técnica puede ser miembro o responsable; la UI presenta al responsable como **Supervisor del proyecto**.
- Las asignaciones son informativas y no limitan permisos por ahora.
- La participación terminada permanece visible en el historial aun si el proyecto se archiva o el miembro deja el estudio.

## Tareas

- Campos: título, descripción, etapa, estado, inicio planificado, fecha límite, posición y varios encargados.
- Estados: pendiente, en trabajo, suspendida y completada.
- Crear, editar, cambiar estado o etapa, reemplazar encargados, archivar y restaurar.
- Un encargado de tarea debe pertenecer al equipo activo del proyecto; el backend valida esta frontera al crear o reemplazar encargados.
- Una fecha límite requiere inicio; el inicio no puede superarla ni ser anterior al inicio del proyecto.
- Al pasar por primera vez a **En trabajo** o **Completada** sin inicio, se usa el día actual de la organización.
- La posición conserva el orden dentro de la etapa; no representa prioridad y todavía no hay drag-and-drop de orden.
- El Sheet de tarea es la edición detallada compartida. La URL conserva la selección y permite enlaces directos desde proyecto, búsqueda, actividad y Mi trabajo.
- Las tarjetas y filas de tareas permiten cambiar estado inline mediante el Select de shadcn.
- En desktop, los bordes de una barra del timeline modifican inicio y fecha límite por drag o teclado; solo el guardado confirmado genera actividad.
- No existen prioridad, checklist, comentarios, adjuntos, revisor, evidencia, dependencias ni baseline.

## Casos

La sidebar incluye **Casos** como módulo independiente de Projects. Su cartera agrupa procesos por cliente, permite búsqueda, tabs En trámite/Concluidos/Archivados y filtros multiselección por tipo, cliente y miembro; **Mis casos** activa o retira el usuario actual como atajo de este último filtro sin borrar los demás criterios. Los tabs activos y concluidos alternan entre Lista y un Calendario mensual de eventos; la selección vive en la URL, comparte los filtros de cartera, usa grilla de lunes a domingo en desktop y agenda por día en móvil. Los eventos se distinguen por caso con colores estables, muestran su icono de tipo y **cliente · caso**, abren edición contextual y los días con más de cuatro entradas ofrecen una lista completa en Sheet. Cada fila de Lista alinea identificación, período, expediente, etapa y equipo. Debajo, Novedades y Acciones permiten desplegar por separado sus tres entradas activas más recientes y luego todas; en desktop forman dos columnas con Novedades a la izquierda y Acciones a la derecha, mientras en móvil se apilan. Sus botones `+` reutilizan los Sheets del detalle para crear inline; el encabezado contextual muestra y enlaza el caso junto con su cliente, y no se ofrece escritura en casos archivados. Cada fila de vista previa también abre su Sheet para editar; las acciones cambian pendiente/completada con un selector compacto y mantienen al encargado junto a la descripción. El contenido se solicita solamente al abrir y los contadores excluyen archivo y antecedentes. Una acción global secundaria convierte, tras mostrar el número de novedades y casos afectados, todas las novedades activas de casos no archivados del estudio en antecedentes. La creación admite identificación y cliente como registro mínimo, además de campos procesales opcionales, período estructurado, importe/moneda y miembros iniciales. El expediente solo aparece y se conserva cuando existe una etapa. En casos judiciales, el demandante es una opción fija entre el cliente del caso y SUNAT, con el cliente como valor inicial; para los demás tipos no aplica. El detalle abre con una tarjeta-resumen alineada con Project Detail, que presenta estado, tipo, identificación, cliente, etapa y entidad antes del contenido completo. Detalle y Configurar permiten consultar y editar datos, gestionar equipo y archivar/restaurar. **Eventos** administra fechas de **Informe oral**, **Entrevista** y **Otro** con título y descripción opcional en una lista compacta paginada; permite crear y editar con Sheet contextual, eliminar con confirmación y conservar el snapshot en actividad. **Acciones** gestiona en una lista activa única los próximos pasos sin fecha, con encargado opcional del equipo, selector compacto de estado pendiente/completada, recuperación de archivo, concurrencia y actividad; su selector de encargado usa identidad visual y agrupación por posición. **Novedades** registra hechos procesales manuales con fecha, descripción y clasificación Novedad/Antecedente, además de edición, archivo/restauración, paginación y control de concurrencia. Sus filas compactas conservan al creador mediante avatar y tooltip; los antecedentes permanecen colapsados por defecto. El detalle ordena Información y Equipo, Eventos a todo lo ancho, una grilla responsive con Novedades a la izquierda y Acciones a la derecha, y finalmente Actividad; en móvil mantiene Eventos, Novedades, Acciones y Actividad. Cada operación genera actividad inmutable y el renderer compartido presenta sus valores o cambios tanto dentro del caso como en `/activity`. Las actualizaciones extensas del caso se presentan campo por campo, con tres cambios visibles y el resto expandible. Creación, detalle, configuración, candidatos e historial muestran la posición de cada miembro y agrupan el equipo por la jerarquía profesional compartida. Catálogos e invariantes están consolidados en [15-casos.md](15-casos.md).

## Actividad del sistema

Los catálogos usados por formularios y filtros de Casos recorren todas las páginas de clientes y miembros. Los selectores conservan miembros elegidos durante búsquedas posteriores y los formularios presentan estados explícitos de carga, error y reintento. Los eventos admiten **Informe oral**, **Entrevista** y **Otro**; comienzan como Informe oral y permiten cambiar el tipo y mantener un título editable. En las listas, cada tipo se distingue mediante un icono con tooltip en vez de una etiqueta textual redundante. Los eventos protegen edición y eliminación mediante la versión `updatedAt` observada; un error al eliminar permanece visible dentro de la confirmación.

La acción secundaria **Ver presentación** abre `/cases/presentation`. La vista carga la cartera semanal mediante `GET /api/cases/presentation` en un número fijo de consultas de base de datos, agrupada por cliente y ordenada de forma estable. Parte de casos en trámite, novedades activas, los tres antecedentes más recientes por caso, acciones pendientes y eventos futuros. Cada bloque de antecedentes permite mostrar todo su historial inline y editar una entrada con el mismo Sheet de novedades. **Contenido adicional** agrupa Casos concluidos, Acciones completadas y Eventos pasados, con un contador de opciones activas; todos los grupos comienzan abiertos, se pueden contraer individual o globalmente y mantienen filtros y opciones en la URL. La ruta siempre ocupa el viewport y oculta el shell; conserva **Volver a casos**, **Salir de presentación** y Fullscreen nativo opcional, sin un estado intermedio de presentación. Reutiliza los Sheets y el selector de estado existentes para editar durante la reunión; además, cada caso abre un Sheet amplio con **General** y **Equipo**, cuyo detalle se carga bajo demanda y cuya escritura refresca la presentación sin navegación externa. Presenta equipos por posición. No existe tabla, snapshot ni entidad de presentación.

El proyecto conserva un registro paginado e inmutable para:

- creación, edición de datos, cambios de periodo o estado, archivo y restauración del proyecto;
- creación, edición y eliminación de eventos;
- creación, edición, cambios de fechas, estado o etapa, archivo y restauración de tareas;
- altas y bajas de encargados;
- creación, edición, reordenamiento y eliminación de etapas;
- altas, cambios y bajas de supervisión del proyecto;
- retiro de miembros del estudio.
- creación, edición, reclasificación individual o masiva, archivo y restauración de novedades y antecedentes de casos.
- creación, edición, asignación, completado, reapertura, archivo y restauración de acciones de casos.
- creación, edición y eliminación de eventos de casos, conservando snapshots aun después de eliminar el registro y rechazando escrituras sobre una versión desactualizada.

Las entradas guardan actor, sujeto y snapshots suficientes para presentar el hecho incluso cuando la relación original ya terminó. Las identidades y tareas activas pueden enlazarse a su superficie actual. Los cambios de estado de proyectos y tareas muestran origen y destino con badges semánticos; las entradas antiguas sin origen muestran el destino sin perder su color ni etiqueta. Las acciones conocidas de Casos se narran con lenguaje de dominio —por ejemplo, **convirtió la novedad en antecedente**— y los cambios extensos mantienen su comparación estructurada.

## Actividad del estudio

- Ruta propia `/activity`, accesible desde sidebar y Command global.
- Incluye actividad de cualquier proyecto del estudio, aunque esté completado o archivado.
- Orden estable por instante e identificador, del movimiento más reciente al más antiguo.
- Carga inicial de 25 entradas y paginación por cursor mediante **Cargar más**.
- Una falla al cargar una página anterior conserva el historial ya visible y ofrece reintento.
- Muestra actor, acción, proyecto, contexto de archivo o estado y fecha en la zona horaria del estudio.

## Mi trabajo

- Una cartera única usa los tabs **Mis tareas** —predeterminado—, **Bajo mi supervisión** y **Acciones de casos**; la vista se conserva en la URL.
- Búsqueda visible y botón **Filtro** con Command dentro de Popover en desktop o Sheet inferior en móvil. Proyecto, estado de tarea, rango de fecha límite e inclusión de completadas aparecen como propiedades y chips editables.
- Los filtros son compartidos por ambas vistas y conservan búsqueda debounced por tarea, proyecto, cliente o referencia interna, selección múltiple y paginación independiente. Una coincidencia general del proyecto bajo supervisión conserva sus tareas relevantes.
- Las tareas se agrupan por su intervalo planificado y sin duplicarse: completadas; vencidas cuando su fecha límite ya pasó; hoy cuando el día actual pertenece al intervalo; esta semana cuando el intervalo todavía no empezó pero se cruza con la semana vigente; a futuro cuando empieza después; y sin fecha cuando falta inicio o fecha límite. La semana del estudio siempre corre de lunes a domingo en su zona horaria y cada cabecera muestra el día, rango o alcance textual usado para clasificar sus tareas.
- Cada fila presenta cliente, proyecto y tarea en ese orden, seguida por etapa, fechas y únicamente los encargados activos. Los encargados se agrupan como Socio, Senior, Junior, Asistente, Practicante y Sin posición; los grupos vacíos se omiten, cada grupo limita a tres avatares y su `+N` abre un Popover específico. Tooltip y Popover muestran alias, nombre, posición y rol; una tarea vacía declara **Sin encargado**.
- El Sheet enlazable permite abrir y editar una tarea sin abandonar la cartera.
- Los proyectos supervisados usan filas expandibles con cliente, periodo y una barra proporcional para tareas pendientes, en trabajo, suspendidas y completadas. La leyenda mantiene los conteos visibles y cada segmento expone cantidad y porcentaje mediante Tooltip.
- El resumen usa todas las tareas no archivadas del proyecto y no cambia con los filtros. **Sin encargado** aparece aparte porque puede superponerse con cualquier estado. La expansión muestra primero las tareas que requieren atención y permite cargar todas las tareas activas con su propia paginación.
- Acciones de casos muestra únicamente acciones asignadas al usuario con participación activa, agrupadas por cliente y caso. Sus filtros son independientes y, al carecer de fecha, no usa los grupos temporales de las tareas.

## Cronograma del proyecto

- Timeline task-first agrupado por etapas, abiertas por defecto.
- Panel izquierdo redimensionable en desktop; su ancho se conserva. En móvil, las etiquetas quedan fijas y solo el calendario se desplaza.
- Zoom pequeño, medio y grande con preferencia global. Si el periodo cabe, ocupa el ancho disponible.
- Horizonte extendido por tareas o eventos fuera del periodo del proyecto.
- Día actual, fecha final, eventos y fines de semana con señales diferenciadas y tooltips.
- Fecha final como línea principal; eventos como líneas secundarias.
- Scroll local, ancla inicial útil y soporte para proyectos ya finalizados o con hoy fuera del horizonte.
- Indicadores compactos de etapas y estados; interacción accesible por hover, foco y teclado.

## Búsqueda global

- Command de shadcn desde la sidebar o `Ctrl/⌘ K`.
- Busca casos, proyectos, tareas, clientes y miembros del estudio activo desde dos caracteres y con debounce de 300 ms. Los casos se encuentran por identificación, expediente, cliente, materia controvertida o resolución impugnada; los archivados no aparecen.
- Excluye casos, proyectos y tareas archivados, pero incluye casos concluidos y proyectos o tareas completados.
- Los resultados muestran el contexto pertinente y permiten abrir directamente el detalle de un caso o el Sheet de una tarea.
- Sin consulta ofrece la navegación principal y creación segura de caso, proyecto o cliente; crear tarea permanece dentro del proyecto.
- Navegación completa por teclado, foco visible, hover visible, lista scrollable adaptada al viewport y restauración de foco.
- La caché se separa por usuario y organización; las consultas del backend están limitadas al tenant.

## Feature flags y Preguntar a Orbit

- Catálogo backend de flags con resolución: excepción por organización, valor global y default seguro.
- Flag actual: `orbit_help_assistant`.
- No existe una pantalla de administración de flags; se configuran directamente en backend/base de datos.
- Preguntar a Orbit usa un corpus generado de documentos seleccionados de este blueprint y Groq con `openai/gpt-oss-20b` por defecto.
- Responde en español, muestra fuentes y declara cuando la documentación no sustenta una respuesta.
- Conserva la pregunta visible y renderiza Markdown GFM mediante una lista cerrada de elementos: encabezados, listas, checklists deshabilitados, énfasis, tachado, citas, código y tablas con scroll horizontal local. Omite HTML e imágenes, convierte enlaces del modelo en texto no clicable y mantiene las fuentes en un bloque separado.
- Groq dispone de hasta 1200 tokens de salida. Si responde con `finish_reason=length`, Orbit solicita una única reescritura completa de máximo 550 palabras; si también se corta, muestra el segundo contenido precedido por una advertencia de respuesta incompleta.
- No recibe datos del estudio ni información jurídica, no conserva conversación, no ejecuta acciones y no brinda análisis jurídico.
- Límites actuales por usuario y proceso API: 10 preguntas por hora y 30 por día.
- Estados explícitos para flag deshabilitada, límite alcanzado y proveedor no disponible.

## Contratos, datos y desarrollo

- API modular TypeScript con Hono y contratos Zod OpenAPI.
- Swagger UI y documento OpenAPI disponibles únicamente en desarrollo local.
- Cliente web generado con Orval y consumido mediante TanStack Query.
- Límite general en memoria de 300 solicitudes por minuto, usuario autenticado y proceso API. Se aplica después de la sesión y organización activa, devuelve `429 RATE_LIMITED` con `Retry-After` y el cliente no lo reintenta automáticamente.
- Better Auth conserva su limitador para rutas de autenticación y Preguntar a Orbit mantiene adicionalmente sus límites de 10 preguntas por hora y 30 por día.
- Better Auth resuelve la IP de sus límites mediante el header único `X-Real-IP` que Railway establece en el proxy público; no confía en cadenas múltiples de `X-Forwarded-For`.
- PostgreSQL y Drizzle ORM; migraciones incrementales e inmutables. Una migración nueva nunca modifica una ya aplicada.
- Fechas calendario como `date`/`YYYY-MM-DD`; instantes técnicos como `timestamptz`.
- Better Auth conserva mediante script las extensiones de esquema propias de Orbit.
- Seed local reproducible con usuarios, clientes, los cuatro tipos de proyecto, etapas, tareas, asignaciones, eventos de proyectos, casos, novedades, acciones, eventos de casos y actividad.
- Desarrollo local con Bun y `mprocs`, PostgreSQL sin Docker y archivos `.env` por aplicación.
- Despliegue previsto: API en Railway y frontend Vite en Cloudflare Pages.

## Estados y límites actuales

- Loading, vacío, error recuperable, conflicto, archivado y modo de solo lectura tienen presentación explícita.
- Tooltips usan el componente shadcn; Sheets conservan contexto y restauran foco cuando existe un opener.
- Targets táctiles principales son de al menos 44 px y el scroll horizontal pertenece a la vista, no al documento.
- La entrega de correo está diferida. Mientras no exista ese sistema, el backend puede activar temporalmente `AUTH_TRUST_SIGNUP_EMAIL=true` para registrar las cuentas nuevas con el correo verificado y permitir que Better Auth liste sus invitaciones. El valor predeterminado es `false`, no se expone al frontend y debe retirarse al incorporar verificación real.
- La recuperación de contraseña funciona por enlace manual: el owner lo entrega por un canal confiable o un operador lo genera para el único owner. No hay envío automático, y la identidad del receptor debe confirmarse fuera de Orbit hasta incorporar email.
- No existe multi-membership ni selector de estudio, permisos granulares por proyecto, eliminación definitiva de trabajo, notificaciones, comentarios, adjuntos, dependencias, carga de equipo, portal de cliente o IA sobre datos del estudio.
