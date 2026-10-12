# Reglas de interacción

## Seguridad actual

1. El trabajo diario no expone controles de estructura de forma prominente.
2. Datos generales, eventos, equipo, etapas y archivo viven en Configurar proyecto.
3. Un proyecto archivado es de solo lectura hasta restaurarse.
4. Proyectos y tareas se archivan; la UI no ofrece eliminación definitiva.
5. Acciones relevantes generan actividad inmutable.
6. Cambios optimistas o inline deben recuperarse ante conflicto y mostrar datos autoritativos.
7. Las transiciones de estado en actividad deben expresar el cambio con texto y badges semánticos; el color nunca es la única señal.
8. La API de Orbit admite hasta 300 solicitudes autenticadas por usuario y proceso en una ventana fija de 60 segundos. El límite se consume después de validar sesión y, cuando corresponde, organización activa; un `429` nunca se reintenta inmediatamente desde el cliente.

Better Auth conserva su protección propia para `/api/auth/*` y Preguntar a Orbit mantiene además su cuota específica de proveedor. El límite general es una defensa básica en memoria contra loops y abuso simple: se reinicia con el proceso y no pretende ser una cuota distribuida entre réplicas.

En producción, Better Auth obtiene la IP del cliente únicamente desde `X-Real-IP`, establecido por el proxy confiable de Railway. No interpreta cadenas reenviadas de origen incierto ni usa un header enviado directamente por el frontend.

## Permisos actuales

Todo miembro activo del estudio puede:

- Crear y editar proyectos y tareas.
- Cambiar estados de tareas.
- Gestionar etapas.
- Asignar o retirar supervisores de proyecto y encargados de tareas.
- Crear, editar o eliminar eventos legales.

Las asignaciones de proyecto expresan supervisión informativa; todavía no otorgan permisos exclusivos. Retirar un miembro del estudio finaliza sus asignaciones activas dentro de una transacción y conserva actividad.

Cada usuario puede editar únicamente su propio alias y color de avatar. Los perfiles de otros miembros son de solo lectura. La UI solo ofrece fondos de la paleta aprobada y calcula el foreground accesible; nunca acepta un color libre desde el cliente.

## Fechas

- Proyecto: **Fecha de inicio** y **Fecha final**.
- Evento legal: **Fecha legal**, con nombre editable y descripción opcional. La creación del proyecto admite cero, una o varias fechas legales iniciales.
- Tarea: **Inicio planificado** y **Fecha límite**.
- Una fecha límite de tarea requiere inicio y no puede ser anterior a él.
- Una tarea no puede comenzar antes del proyecto.
- Un evento no puede ser anterior al proyecto, pero sí posterior a su fecha final.
- Fechas calendario usan la zona de la organización; timestamps técnicos conservan zona horaria.

## Tareas

- Estado editable desde card, lista, timeline, Mi trabajo o Sheet cuando el contexto lo permite.
- El Sheet es la fuente de edición detallada y conserva contexto de proyecto y etapa.
- La URL es la fuente de selección de tarea en vistas con deep link.
- Archivar preserva encargados y actividad; restaurar devuelve la tarea al trabajo activo.
- Solo integrantes con asignación activa en el proyecto pueden seleccionarse como encargados de sus tareas.
- La edición por bordes del timeline solo cambia fechas y crea actividad al confirmar, no durante cada movimiento.
- En escritorio, los bordes editables permanecen visibles con una línea sutil sobre el límite exacto de la tarea y un área interactiva más amplia hacia fuera de la barra.
- El borde toma control exclusivo del puntero, foco y tooltip mientras se usa: no abre la tarea accidentalmente y muestra la fecha provisional durante el ajuste.
- El centro de la barra conserva su acción de abrir la tarea; en móvil no se muestran controles de redimensionamiento.
- En la creación inline del listado, Enter desde el título ejecuta la acción principal. Los campos multilínea y controles de selección conservan su comportamiento de teclado y no disparan un guardado accidental.

## Etapas

- Crear, renombrar, describir y reordenar desde configuración.
- Eliminar solo una etapa vacía; si contiene tareas, la operación se rechaza.
- El estado visual se deriva de tareas activas: sin tareas, pendiente, en curso, suspendida o completada.

## Formularios y concurrencia

- Validación inline con mensajes accionables.
- Deshabilitar envíos duplicados.
- Mantener valores ante error recuperable.
- Un `409` obliga a recuperar la versión autoritativa antes de afirmar que se muestran datos recientes.
- Un fallo de refetch con datos retenidos no debe presentarlos como actualización exitosa.

## Búsqueda textual

- Todas las búsquedas libres son insensibles a mayúsculas y diacríticos españoles: `apelacion` encuentra **Apelación** y `senor` encuentra **Señor**.
- La misma normalización aplica en consultas del API y filtros locales de `Command`.
- `%`, `_` y `\\` se interpretan como texto literal, no como comodines ingresados por el usuario.
- La normalización no modifica el texto presentado ni relaja límites por estudio, archivo, permisos, filtros o paginación.

## Responsive y accesibilidad

- Controles táctiles principales de 44 px en móvil.
- Focus visible persistente durante interacciones por teclado.
- Tooltips shadcn accesibles por hover y foco.
- Sheets restauran foco al control que los abrió cuando existe.
- Scroll horizontal pertenece al calendario, timeline o board; nunca al documento completo.
- En la cartera, periodo, estado y equipo se expresan con texto, iconos y tooltips; el color nunca sustituye esas etiquetas.
- Los filtros de cartera usan propiedades legibles, selección múltiple y chips removibles; no muestran operadores técnicos.
- Valores de una misma propiedad se combinan con OR y propiedades distintas con AND. Varios miembros significan que todos deben participar activamente en el proyecto.
- Los filtros deben poder operarse por teclado, permanecer en la URL y abrir como Popover en desktop o Sheet acotado y desplazable en móvil.

## Siguiente

- Comentarios, menciones y notificaciones.
- Las notificaciones internas deben agrupar eventos repetitivos y enlazar al contexto exacto sin duplicar la actividad histórica.

## Fuera del roadmap actual

Cálculos jurídicos, undo con sistemas externos, edición simultánea avanzada y modo offline requieren una decisión explícita antes de cambiar estas reglas.
