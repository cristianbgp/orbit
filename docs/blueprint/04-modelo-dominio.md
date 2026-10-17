# Modelo de dominio

## Relaciones actuales

```text
Organization
├─ Users / Memberships / Invitations
├─ AccountRecoveryActivity
├─ Clients
├─ Cases
│  ├─ CaseAssignments
│  ├─ CaseUpdates
│  ├─ CaseActions
│  ├─ CaseEvents
│  └─ CaseActivities
└─ Projects
   ├─ ProjectAssignments
   ├─ Stages
   │  └─ Tasks
   │     └─ TaskAssignments
   ├─ ProjectEvents
   └─ ActivityEntries
```

## Entidades implementadas

### Organization

Tenant principal. Conserva nombre, membresías, organización activa y zona horaria. El día actual de la interfaz se calcula en esa zona.

### User y Membership

El usuario tiene identidad global, nombre, correo, alias no único, color hexadecimal de avatar y estado de verificación.

```text
alias: string
avatarColor: #rrggbb
membership.position: partner | senior | junior | assistant | intern | null
```

Cada persona solo modifica su propio alias y color mediante `/api/me`. `avatarColor` es obligatorio en almacenamiento, se normaliza a minúsculas y la API solo acepta valores de la paleta aprobada. Los usuarios nuevos reciben un color determinista; la migración conserva para usuarios existentes el color que producía la paleta anterior. La interfaz calcula automáticamente un foreground con contraste AA. La membresía vincula al usuario a una organización y puede guardar una posición profesional: Socio, Senior, Junior, Asistente o Practicante. El owner la elige al invitar y puede modificarla; es informativa y no concede permisos. Owners fundadores y membresías anteriores pueden conservar `null`. Actualmente existe una restricción única por usuario: una persona pertenece a un solo estudio y no hay cambio entre múltiples organizaciones. El retiro de un miembro finaliza asignaciones activas y conserva snapshots históricos; una identidad histórica sin usuario activo puede presentar el color como nulo y usar el fallback visual.

### AccountRecoveryActivity

Auditoría de seguridad inmutable para la generación manual de un enlace y la finalización de un cambio de contraseña. Conserva organización, actor opcional, sujeto, snapshots de identidad, tipo e instante. Nunca almacena contraseña, token, URL ni otro secreto. Better Auth mantiene la autoridad sobre el token de un solo uso, su expiración de 30 minutos y la revocación de sesiones.

### Client

Persona u organización para la que se ejecuta trabajo. Pertenece a una organización y puede tener varios proyectos.

### Project

Unidad principal de trabajo jurídico.

```text
type: written_submission | consultation | oral_argument | other
status: draft | active | completed
startDate: YYYY-MM-DD
endDate: YYYY-MM-DD
archivedAt: timestamptz | null
```

`startDate` y `endDate` forman el periodo obligatorio del proyecto. El archivo es un ciclo independiente del estado y conserva el historial del proyecto.

### Case

Proceso legal o tributario independiente de Projects. Pertenece a un cliente, conserva clasificación procesal opcional, período normalizado, importe exacto, equipo y seguimiento históricos, novedades, acciones, eventos y actividad propia. `CaseAssignment.responsibility` distingue `member` de `follower`; una persona puede ocupar ambos lugares a la vez. Su estado jurídico es independiente del archivo. Consulta [15-casos.md](15-casos.md).

### ProjectAssignment

Vincula un miembro con el proyecto. Una asignación puede ser `member` o `responsible`; la UI presenta `responsible` como **Supervisor del proyecto** y puede haber cero, uno o varios supervisores. Las asignaciones iniciales pueden crearse dentro de la misma transacción del proyecto, sus etapas y su evento inicial. El historial conserva actor, snapshots y motivo de finalización.

### Stage

Fase del proyecto con nombre, descripción opcional y posición. Se genera inicialmente desde el tipo de proyecto o se crea manualmente. No tiene estado persistido: la UI deriva su presentación de las tareas activas.

### Task

Acción concreta dentro de una etapa.

```text
status: pending | in_progress | blocked | completed
plannedStartDate: YYYY-MM-DD | null
internalDueDate: YYYY-MM-DD | null
archivedAt: timestamptz | null
```

La UI presenta `in_progress` como **En trabajo**, `blocked` como **Suspendida** e `internalDueDate` como **Fecha límite**. La posición ordena tareas dentro de la etapa y prepara reordenamiento futuro; no representa prioridad.

### TaskAssignment

Asignación activa o histórica de una persona como encargada de una tarea. Admite varios encargados y conserva snapshots cuando el usuario deja el estudio o se retira la asignación. El contrato técnico conserva la propiedad `responsibles`.

### ProjectEvent

Fecha relevante independiente del periodo:

```text
type: legal | meeting | other
date: YYYY-MM-DD
```

Actualmente las mutaciones públicas permiten crear eventos `legal`. La fecha nunca puede ser anterior al inicio del proyecto y sí puede superar su fecha final.

### CaseEvent

Fecha procesal independiente que pertenece a un caso:

```text
type: oral_argument | interview | other
date: YYYY-MM-DD
```

Permite administrar **Informe oral**, **Entrevista** y **Otro**. Conserva título, fecha y descripción opcional, no impone límites respecto del período del caso y registra actividad inmutable al crear, editar o eliminar. La lectura organizacional de calendario cruza cada evento con su caso y cliente, excluye casos archivados y acepta rangos inclusivos de hasta 42 días.

### ActivityEntry

Registro inmutable generado por el sistema. Conserva actor, acción, objeto, timestamp y datos suficientes para reconstruir cambios aun cuando una relación o evento desaparezca.

## Invariantes actuales

1. Toda consulta y mutación se limita a la organización activa.
2. `Project.startDate <= Project.endDate`.
3. `ProjectEvent.date >= Project.startDate`.
4. Una tarea pertenece a exactamente una etapa del mismo proyecto.
5. Una fecha límite de tarea requiere un inicio planificado; el inicio no puede superarla.
6. Un proyecto archivado es de solo lectura hasta restaurarse.
7. Los presets no cambian proyectos existentes.
8. La actividad del sistema no se edita ni elimina.
9. Las fechas calendario se almacenan como `YYYY-MM-DD`.
10. Instantes técnicos se almacenan como `timestamptz` y se presentan en la zona de la organización o del usuario según contexto.
11. Solo el propio usuario modifica su alias y color; el color persistido es hexadecimal normalizado y pertenece a la paleta aprobada por la API.
12. Solo el owner modifica posiciones profesionales; estas no cambian roles de acceso, supervisión de proyectos ni encargos de tareas.
13. Cada usuario tiene como máximo una membresía de estudio en el modelo actual.
14. Solo un owner activo genera enlaces para miembros activos de su propio estudio; la vía administrativa exige un correo exacto.
15. Ninguna auditoría de recuperación almacena contraseña, token o URL.
16. Un caso archivado permite leer sus eventos, pero no crearlos, editarlos ni eliminarlos.
17. Todo `CaseEvent` se consulta y modifica con el par `organizationId` y `caseId`.

## Extensiones previstas

```text
Task
└─ Comments
   └─ Mentions

Organization / User
└─ Notifications
```

Estas relaciones no deben asumirse como existentes hasta que se diseñen su auditoría, visibilidad y ciclo de vida. El roadmap actual no incluye revisor de tarea, rondas de aprobación, documentos/evidencia, dependencias ni baseline.

## Arquitectura técnica vigente

Monolito modular en TypeScript:

- `apps/web`: React, Vite, Tailwind CSS, shadcn/ui, TanStack Query y cliente Orval.
- `apps/api`: Hono, Zod OpenAPI, Better Auth y Drizzle ORM.
- PostgreSQL como persistencia.
- Railway para API y Cloudflare Pages para frontend.
- Bun para scripts, instalación y ejecución; `mprocs` para desarrollo local.
