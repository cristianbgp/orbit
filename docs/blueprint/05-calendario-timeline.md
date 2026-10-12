# Calendario y timeline

## Principio rector

El periodo del proyecto, los eventos y las fechas de tareas son datos diferentes. Las vistas pueden presentarlos juntos, pero nunca convertirlos en una única fecha ni una única barra.

## Calendario de cartera — no expuesto

`/projects` ya no ofrece una vista calendario. El repositorio conserva componentes y un endpoint task-first como base técnica aislada, pero no forman parte de la navegación ni del inventario funcional vigente. Un futuro calendario de eventos se diseñará desde el dominio de eventos y no se asumirá como un simple cambio de nombre de estos componentes.

## Timeline del proyecto — implementado

- Filas agrupadas por etapas y tareas.
- Etapas abiertas por defecto; al abrirse, la etapa usa una línea de contexto y las barras principales son las tareas.
- Panel izquierdo de etapas redimensionable en desktop y fijo en móvil.
- Etiquetas móviles permanecen fijas mientras el calendario se desplaza.
- Columnas diarias con ancho derivado del zoom global.
- Zoom pequeño, medio y grande; si el periodo cabe, usa el ancho disponible sin mover los controles.
- Scroll inicial intenta situar el día actual con contexto; si hoy queda fuera del periodo, usa un ancla útil del proyecto.
- La fecha final es la línea principal de cierre del proyecto.
- Los eventos son líneas secundarias independientes y pueden extender el horizonte.
- Las tareas pueden extender el horizonte antes o después del periodo.
- Etapas y tareas se expanden o colapsan.
- El estado de tarea puede cambiarse inline.
- Sábados y domingos forman bandas continuas neutrales. El día actual, las tareas y los marcadores conservan mayor jerarquía visual.

## Convención compartida de fines de semana

Todos los calendarios usan la misma regla para sábado y domingo. Los selectores de fecha aplican un fondo más sutil que las vistas de planificación; selección, rango y día actual siempre dominan ese fondo. `Sáb`, `Dom`, nombres accesibles completos y la leyenda del calendario evitan depender solo del color. Esta convención no modifica disponibilidad, cálculos ni validaciones.

### Edición de fechas de tareas

En desktop, los bordes izquierdo y derecho ajustan inicio y fecha límite. El cálculo respeta el ancho del día del zoom actual y el scroll. El borde activo conserva focus visible durante drag, teclado y guardado. Las flechas ajustan un día, `Shift` acelera el cambio, `Enter` guarda y `Escape` cancela. El formulario sigue siendo la alternativa completa.

## Marcadores

- Inicio del proyecto: bandera y texto.
- Fecha final: línea destacada, fecha y tooltip.
- Evento: línea regular con título, fecha y tooltip; las vistas que requieren icono usan calendario o hito neutral.
- Día actual: columna y línea diferenciadas.

El color nunca es la única señal. La dirección vigente evita balanza, martillo e iconografía jurídica literal.

## Actividad histórica

La planificación muestra lo previsto. La actividad registra lo ocurrido: cambios de estado, fechas, encargados, supervisores, estructura, archivo y eventos. No se dibuja como si fuera una barra planificada.

## Siguiente

- Comentarios y menciones accesibles desde la tarea sin ocultar su planificación.
- Notificaciones internas derivadas de menciones o cambios relevantes, sin convertir la actividad histórica en un inbox.

## Fuera del roadmap actual

Arrastrar la barra completa, días hábiles, feriados, calendarios por autoridad, carga por persona y cálculo jurídico no están planificados. Requieren una decisión de producto nueva antes de modificar este contrato.

## Casos límite obligatorios

- Evento o tarea después de la fecha final.
- Día actual fuera del horizonte.
- Proyecto ya completado o archivado.
- Varias tareas en un mismo día.
- Varias tareas y eventos superpuestos.
- Tarea sin fecha o con un solo día.
- Fechas mostradas según la zona de la organización.
