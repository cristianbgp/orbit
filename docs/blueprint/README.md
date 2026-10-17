# Orbit — blueprint vigente

Estado documental: vigente

Última consolidación: 12 de octubre de 2026

Idioma del producto: español
Mercado inicial: estudios jurídicos de Perú

## Propósito

Este directorio reúne el estado actual, las decisiones aprobadas y la dirección futura de Orbit. El repositorio define qué está implementado; [12-decisiones-y-pendientes.md](12-decisiones-y-pendientes.md) registra la autoridad de producto.

Orbit es una plataforma de gestión de proyectos legales con una jerarquía sencilla:

```text
Proyecto → etapas jurídicas → tareas
         ↘ eventos y actividad
```

Cases funciona como una cartera procesal independiente: `Cliente → caso → miembros y actividad`.

El periodo del proyecto, sus eventos y las fechas de sus tareas son conceptos distintos:

- Proyecto: **Fecha de inicio** y **Fecha final** obligatorias.
- Evento: fecha independiente; la UI actual crea eventos legales como **Fecha legal**.
- Tarea: **Inicio planificado** y **Fecha límite** opcionales.

## Cómo leer el estado

- **Implementado:** existe en el producto y su comportamiento se puede verificar en el repositorio.
- **Siguiente:** expansión priorizada, todavía no disponible.
- **Futuro:** dirección posible que necesita más validación.

### Implementado

Autenticación y estudios; onboarding e invitaciones; recuperación manual de acceso; perfiles; clientes; cartera de proyectos; cartera independiente de casos procesales con equipo, acciones, novedades, archivo y actividad; etapas editables; tareas con encargados; eventos legales; Mi trabajo con acciones personales de casos; timeline; búsqueda global; zona horaria; feature flags; ayuda documental **Preguntar a Orbit**; OpenAPI y seed local.

### Siguiente

Comentarios y menciones sobre tareas, seguidos por notificaciones internas con reglas de agrupación claras.

### Futuro

Entrega de correo para invitaciones, verificación y recuperación; además de fortalecimiento técnico mediante E2E críticos, observabilidad, restauración probada de backups y división del bundle. Otras expansiones de negocio requieren validación antes de incorporarse al roadmap.

## Orden de lectura

1. [01-contexto-y-vision.md](01-contexto-y-vision.md)
2. [02-alcance-funcional.md](02-alcance-funcional.md)
3. [03-arquitectura-informacion-ux.md](03-arquitectura-informacion-ux.md)
4. [04-modelo-dominio.md](04-modelo-dominio.md)
5. [05-calendario-timeline.md](05-calendario-timeline.md)
6. [06-ejemplo-recurso-apelacion.md](06-ejemplo-recurso-apelacion.md)
7. [07-sistema-visual.md](07-sistema-visual.md)
8. [08-branding-logo.md](08-branding-logo.md)
9. [09-componentes-estados.md](09-componentes-estados.md)
10. [10-reglas-interaccion.md](10-reglas-interaccion.md)
11. [11-roadmap.md](11-roadmap.md)
12. [12-decisiones-y-pendientes.md](12-decisiones-y-pendientes.md)
13. [13-prompt-maestro-codex.md](13-prompt-maestro-codex.md) — guía para desarrollo asistido; no forma parte del corpus de ayuda del producto
14. [14-inventario-funcional-implementado.md](14-inventario-funcional-implementado.md)
15. [15-casos.md](15-casos.md)

Para responder qué puede hacer Orbit hoy, consulta primero el inventario funcional. Los demás documentos explican intención, dominio, interacción, diseño y dirección futura.

## Principios vigentes

1. El proyecto no es un Kanban genérico renombrado.
2. Las etapas representan fases jurídicas reales; las tareas tienen estados propios.
3. El periodo del proyecto no se confunde con eventos ni fechas de tareas.
4. La cartera y el timeline priorizan trabajo concreto, periodos y responsables visibles.
5. Planificación y actividad histórica son vistas diferentes.
6. Los presets crean una copia inicial editable, sin sincronización retroactiva.
7. Archivar preserva contexto e historial; no se elimina trabajo.
8. La interfaz diaria es compacta, sobria, accesible y responsive.
9. El color comunica estructura o excepción, nunca es la única señal.
10. Una futura fecha calculada jurídicamente siempre requerirá explicación y confirmación humana.
