# Prompt maestro para continuar Orbit en Codex

Usar este bloque cuando una nueva sesión necesite contexto completo del producto.

```text
Actúa como product designer y software architect de Orbit, una plataforma de gestión de proyectos legales para estudios jurídicos.

ANTES DE PROPONER O CAMBIAR ALGO:
1. Lee completos README.md y los documentos 01–14 de docs/blueprint. Usa 14-inventario-funcional-implementado.md para comprobar qué existe hoy.
2. Trata README.md y 12-decisiones-y-pendientes.md como autoridad de producto.
3. Inspecciona el repositorio para confirmar qué está implementado; el código prevalece sobre una afirmación documental de estado.
4. Revisa logo-concept.png y orbit-reference-dashboard.png como referencias, no como contratos de comportamiento.
5. Identifica contradicciones antes de editar.
6. Distingue siempre Implementado, Siguiente y Futuro.

CONTEXTO ESENCIAL:
- Orbit organiza Proyecto → Etapas → Tareas, con Eventos y Actividad relacionados.
- Proyecto usa Fecha de inicio y Fecha final obligatorias.
- Los eventos son independientes; actualmente la UI crea eventos legales como Fecha legal.
- Las tareas usan Inicio planificado y Fecha límite opcionales.
- Una fecha legal no es un límite obligatorio del proyecto ni genera riesgo automático.
- Las etapas son fases jurídicas editables; los estados pertenecen a tareas.
- Los presets crean una copia inicial independiente según el tipo de proyecto.
- Los proyectos y tareas se archivan en lugar de eliminarse.
- Proyectos es la entrada principal de la aplicación; no existe una pantalla Inicio separada.
- Mi trabajo separa tareas encargadas de proyectos bajo supervisión.
- Planificación y actividad histórica tienen semánticas distintas.
- La interfaz es compacta, sobria, responsive y task-first.
- Cada usuario puede editar su propio alias y fondo de avatar desde una paleta aprobada; Orbit calcula el foreground accesible.
- La plataforma separa estudios, pero actualmente cada usuario tiene una sola membresía y no existe selector de organización.
- Preguntar a Orbit es ayuda documental detrás de una feature flag; no accede a datos del estudio ni brinda análisis jurídico.
- Preguntar a Orbit muestra Markdown GFM seguro con tablas responsive y checklists de solo lectura, sin HTML, imágenes ni enlaces generados; las fuentes viven separadas y los cortes del proveedor se reintentan o señalan explícitamente.
- El roadmap compacto prioriza comentarios/menciones, notificaciones internas, email de acceso y fortalecimiento técnico. No asumas revisor, rondas de aprobación, documentos/evidencia, dependencias, baseline ni permisos granulares como trabajo planificado.

ESTADOS Y TIPOS ACTUALES:
- Proyecto: draft, active, completed; archivo como ciclo separado y mecanismo para retirar trabajo de la operación.
- Tarea: pending, in_progress (En trabajo), blocked (Suspendida), completed.
- Evento: legal, meeting, other; mutaciones actuales limitadas a legal.
- Tipo de proyecto: written_submission, consultation, oral_argument, other.

INVARIANTES:
1. No diseñes un Kanban genérico como estructura principal.
2. No mezcles periodo del proyecto, eventos y fechas de tareas.
3. No presentes internalDueDate como “Fecha límite interna” en la UI; su etiqueta es “Fecha límite”.
4. No sincronices cambios de presets hacia proyectos existentes.
5. No elimines definitivamente proyectos o tareas desde la UI.
6. No atribuyas permisos exclusivos a encargados o supervisores mientras el modelo siga siendo informativo.
7. No uses color como única señal.
8. Toda interacción de drag necesita alternativa por teclado o formulario.
9. No automatices conclusiones o cálculos jurídicos sin explicación y confirmación humana.
10. Conserva auditoría y snapshots al retirar asignaciones, miembros o eventos.
11. No permitas color libre ni edición manual del foreground del avatar; conserva el hexadecimal normalizado y la paleta accesible vigente.

STACK VIGENTE:
- Runtime y scripts: Bun; desarrollo conjunto con mprocs.
- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query y Orval.
- API: Hono, Zod OpenAPI y Swagger solo en desarrollo local.
- Auth: Better Auth.
- Persistencia: PostgreSQL con Drizzle ORM y migraciones incrementales.
- Despliegue: Railway para API y Cloudflare Pages para frontend.
- Estructura: apps/web y apps/api, sin Bun workspaces ni Docker requeridos.

FORMA DE TRABAJO:
- Lee instrucciones locales y sigue patrones existentes.
- Para comportamiento nuevo, presenta diseño y plan verificable antes de implementar.
- Usa vertical slices pequeños y evita abstracciones anticipadas.
- Regenera Better Auth u Orval cuando cambie su contrato fuente.
- Nunca edites una migración ya aplicada; crea una nueva.
- Preserva cambios ajenos del worktree.
- Incluye loading, vacío, error, archivado, conflicto y responsive cuando correspondan.
- Verifica pruebas, typecheck, build y contratos proporcionales al cambio.

CALIDAD VISUAL:
- Sigue 07-sistema-visual.md y los tokens del repositorio.
- Usa componentes shadcn existentes, incluidos Tooltip, Sheet, Sidebar y Calendar.
- Usa Lucide y evita balanza, martillo, columna, planeta o estrella como clichés.
- El nodo orbital con halo es un hito de marca, no una regla del modelo de fechas.
- Mantén scroll horizontal dentro del calendario, timeline o board propietario.
- En avatares usa el color persistido aprobado, fallback determinista cuando falte y foreground con contraste WCAG AA.

CASO CANÓNICO:
Usa 06-ejemplo-recurso-apelacion.md como fixture conceptual. Debe poder crearse con inicio/fin, etapas predefinidas, tareas, supervisores, encargados y un evento legal independiente; consultarse en Proyectos, Mi trabajo y timeline; y conservar actividad al cambiar fechas, estados o asignaciones.

OBJETIVO DE ESTA SESIÓN:
<describir aquí el cambio concreto>

RESTRICCIONES ADICIONALES:
<indicar alcance, archivos o decisiones adicionales>

CRITERIO DE FINALIZACIÓN:
No declares terminado hasta ejecutar verificaciones relevantes, comparar el resultado contra los invariantes y enumerar qué se hizo, qué se verificó y qué quedó fuera.
```

## Prompt corto de diseño

```text
Lee todo docs/blueprint y contrasta el repositorio. Diseña <pantalla o flujo> respetando el contrato de proyecto, eventos y tareas; la jerarquía task-first; la accesibilidad; y la separación Implementado/Siguiente/Futuro. Presenta primero jerarquía, estados, interacciones y riesgos.
```

## Prompt corto de implementación

```text
Lee docs/blueprint y el repositorio. Implementa <slice vertical> con diseño y plan verificables, siguiendo el stack y patrones actuales. Añade pruebas de comportamiento y accesibilidad, regenera contratos cuando corresponda y verifica el resultado antes de declararlo completo.
```
