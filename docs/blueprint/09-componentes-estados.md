# Componentes y estados

## Shell implementado

- `AppShell` con sidebar colapsable.
- Cabecera móvil.
- `AppPage` como frame consistente.
- `AppPageHeader` para las cabeceras de página autenticadas, con icono Lucide
  obligatorio, eyebrow, título, descripción y acciones opcionales. Las páginas
  enlazadas desde la sidebar reutilizan exactamente su mismo icono.
- Sheet contextual derecho.
- Perfil y cierre de sesión en navegación.

## Patrones de dominio presentes en la UI

### ProjectEndMarker

Línea principal de cierre planificado con fecha, texto, tooltip y tratamiento según estado del proyecto. No representa un evento legal.

### ProjectEventMarker

Línea secundaria con título, tipo y fecha. Admite eventos fuera del periodo y usa iconografía neutral de calendario o hito sin depender solo del color.

### TaskDateRange

Barra desde inicio planificado hasta fecha límite. Sus bordes editables tienen focus visible, tooltip y alternativa por teclado/formulario.

### ProjectStageStatusIndicator

Deriva estado de la etapa desde tareas activas. Variantes con texto o icon-only para timeline. Estados visibles: sin tareas, pendiente, en curso, suspendida y completada.

### ProjectTaskStatusSelect

Select shadcn con texto, variante compacta o icon-only. Permite cambiar estado desde las vistas principales sin abrir el Sheet.

### TaskCard / TaskRow

Muestra título, contexto necesario, rango o fecha, encargados y estado. El detalle completo vive en Sheet.

### ProjectTaskCalendar

Base técnica aislada y no expuesta actualmente en `/projects`. Conserva una presentación task-first para un futuro calendario de tareas o eventos, pero no forma parte del inventario funcional vigente ni condiciona su próximo diseño.

### ActivityEntry

Actor, acción, objeto, timestamp, valores relevantes y enlaces a miembro o tarea cuando siguen disponibles. Los cambios de estado muestran el estado anterior y el nuevo mediante los badges semánticos compartidos; las entradas históricas sin estado anterior conservan al menos el badge de destino. Los snapshots preservan historia de elementos retirados.

### AliasAvatar / MemberIdentity

Alias primero, nombre completo en tooltip o contexto secundario y enlace solo cuando la membresía activa permite navegar al perfil. `AliasAvatar` usa el hexadecimal persistido cuando pertenece a la paleta vigente, calcula automáticamente un foreground AA y conserva como fallback el color determinista de la paleta original. `MemberIdentity` propaga el color actual por sidebar, equipo, proyectos, tareas, actividad, búsqueda y vistas de trabajo.

### AvatarColorSelector

Grupo de diez radios nativos disponible solo en el perfil propio. Muestra la opción actual mediante check y anillo, permite navegación por teclado y actualiza la vista previa antes de guardar. No admite color libre, reset automático ni edición manual del foreground.

## Estados de interfaz obligatorios

- Loading estable con skeleton o pantalla de preparación.
- Vacío inicial con acción útil.
- Vacío por filtros con opción de limpiar.
- Error recuperable con retry.
- Error de actualización con datos retenidos claramente señalado.
- Conflicto con recuperación de versión autoritativa.
- Archivado y solo lectura.
- Acción en progreso sin duplicación de solicitudes.

## Estados de fecha actuales

- Sin fecha.
- Inicio únicamente.
- Rango planificado.
- Fecha límite vencida para tarea no completada.
- Fecha final próxima o excedida para proyecto activo.
- Proyecto completado o archivado sin advertencias de fechas activas.

## Siguiente

- CommentThread y menciones.
- NotificationItem y NotificationCenter compactos, con estado leído/no leído y agrupación comprensible.

## Fuera del roadmap actual

Riesgo calculado, fechas jurídicas calculadas y modo offline necesitan una decisión de producto nueva; no deben incorporarse por extensión incidental de estos componentes.
