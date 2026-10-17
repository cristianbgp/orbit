# Roadmap

## Implementado — base funcional

### Plataforma

- Monorepo simple con `apps/web` y `apps/api`.
- Bun y `mprocs` para desarrollo local.
- React/Vite, Tailwind CSS y shadcn/ui.
- Hono, Zod OpenAPI, Swagger local y Orval.
- PostgreSQL y Drizzle con migraciones incrementales.
- Railway para API y Cloudflare Pages para frontend.
- Seed local reproducible.

### Acceso y organización

- Better Auth, organización activa y onboarding con una sola membresía de estudio por usuario.
- Invitaciones de 48 horas y flujo previo a crear organización.
- Sidebar responsive y cierre de sesión en estados previos a la aplicación.
- Equipo, perfiles, alias, color de avatar accesible y zona horaria.

### Operación legal

- Clientes con búsqueda y paginación.
- Proyectos con inicio, fecha final, archivo y restauración.
- Tipos Escrito, Consulta, Informe oral y Otro.
- Etapas iniciales copiadas y editables.
- Supervisores múltiples de proyecto y encargados múltiples de tareas.
- Historial de participación.
- Tareas con cuatro estados, fechas, archivo y Sheet enlazable.
- Actividad automática de sistema.
- Eventos legales independientes.

### Vistas principales

- Proyectos como entrada principal y cartera compartida del estudio.
- Mi trabajo: ejecución personal y supervisión.
- Cartera list-only separada en En curso, Completados y Archivados; agrupable, ordenable y con periodo y equipo activo.
- Lista y board por etapas.
- Timeline de tareas con zoom, panel redimensionable, expansión y edición de fechas.
- Estados inline desde cards y filas.

### Ayuda del producto

- Preguntar a Orbit detrás de `orbit_help_assistant`.
- Recuperación determinista sobre el blueprint y respuestas mediante Groq.
- Fuentes visibles, sin historial y sin acceso a datos del estudio.
- Límites de 10 preguntas por hora y 30 por día por usuario en cada proceso de API.

## Siguiente — comunicación dentro del trabajo

1. **Comentarios y menciones:** conversación humana vinculada a tareas, con autor, timestamp, edición controlada y trazabilidad suficiente.

2. **Notificaciones internas:** avisos por menciones y movimientos relevantes, agrupados para evitar ruido y enlazados al proyecto o tarea exactos. La actividad continúa siendo el historial; las notificaciones son una bandeja personal de atención.

## Futuro — acceso y fortalecimiento técnico

3. **Entrega de correo:** invitaciones, verificación de cuenta y recuperación de acceso. Al existir este flujo se retiran `AUTH_TRUST_SIGNUP_EMAIL`, la copia manual de invitaciones y los enlaces de recuperación compartidos fuera de Orbit.

4. **Confiabilidad del producto:** pruebas E2E de los recorridos críticos, observabilidad de API y frontend, backups PostgreSQL con restauración ensayada y división del bundle web. Si la API escala a varios procesos, el límite de Preguntar a Orbit debe moverse a almacenamiento compartido.

## Ideas no comprometidas

Calendarios hábiles, cálculo jurídico, capacidad del equipo, multi-membership, portal del cliente, integraciones externas, reportes avanzados e IA sobre datos del estudio requieren validación propia. No deben tratarse como la siguiente implementación por aparecer en este documento.

## Métricas útiles para observar uso real

- Proyectos activos con supervisores.
- Tareas vencidas, suspendidas o sin encargado.
- Tiempo de resolución de tareas suspendidas.
- Proyectos que llegan a su fecha final con tareas abiertas.
- Adopción semanal de Proyectos y Mi trabajo.
- Volumen y lectura de notificaciones cuando esa capacidad exista.

No convertir estas métricas en metas comerciales ni en riesgo automático antes de observar uso real.
