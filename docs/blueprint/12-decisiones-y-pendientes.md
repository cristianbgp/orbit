# Decisiones y pendientes

Este archivo es el registro de autoridad de producto. Una decisión marcada **Reemplazada** conserva trazabilidad, pero ya no guía nuevas implementaciones.

## Decisiones vigentes

| ID    | Decisión                                                                                                                                   | Estado                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| D-001 | Nombre actual: Orbit                                                                                                                       | Vigente                        |
| D-002 | Mercado inicial: estudios jurídicos de Perú                                                                                                | Vigente                        |
| D-003 | Proyecto → etapas → tareas, con eventos y actividad relacionados                                                                           | Vigente                        |
| D-004 | Los estados genéricos pertenecen a tareas; las etapas son fases jurídicas                                                                  | Vigente                        |
| D-005 | Los presets generan copias editables sin sincronización retroactiva                                                                        | Vigente                        |
| D-006 | El vencimiento legal era el ancla obligatoria del proyecto                                                                                 | **Reemplazada por D-018**      |
| D-007 | Planificación y actividad histórica tienen semánticas distintas                                                                            | Vigente                        |
| D-008 | Configuración del proyecto separada del trabajo diario                                                                                     | Vigente                        |
| D-009 | Encargado de ejecución y futuro revisor/supervisor son roles distintos                                                                     | **Reemplazada por D-034**      |
| D-010 | Instrument Sans para marca/títulos e Inter para interfaz                                                                                   | Vigente                        |
| D-011 | Identidad azul-violeta modular                                                                                                             | Vigente                        |
| D-012 | Isotipo orbital segmentado con nodos                                                                                                       | Vigente                        |
| D-013 | El nodo final de marca es circular con halo o doble borde                                                                                  | Vigente como regla de branding |
| D-014 | Interfaz compacta, sobria, responsive y orientada al trabajo                                                                               | Vigente                        |
| D-015 | Presets por tipo sin constructor de templates personalizados                                                                               | Vigente                        |
| D-016 | Zona horaria por organización; valor inicial `America/Lima`                                                                                | Vigente                        |
| D-017 | Inicio era el panorama compartido del estudio                                                                                              | **Reemplazada por D-033**      |
| D-018 | Proyecto usa inicio/fin; eventos son independientes; tareas usan inicio planificado/fecha límite                                           | Vigente                        |
| D-019 | Tipos: Escrito, Consulta, Informe oral y Otro                                                                                              | Vigente                        |
| D-020 | Mi trabajo separa encargos personales y supervisión de proyectos                                                                           | Vigente                        |
| D-038 | Acciones de casos son próximos pasos sin fecha y con encargado opcional; Mi trabajo las muestra en un tercer tab independiente             | Vigente                        |
| D-021 | El calendario de cartera era task-first y conservaba marcadores de proyecto/evento                                                         | **Reemplazada por D-031**      |
| D-022 | Proyectos y tareas se archivan en lugar de eliminarse                                                                                      | Vigente                        |
| D-023 | Cero, uno o varios supervisores pueden estar asignados a un proyecto                                                                       | Vigente                        |
| D-024 | Miembros activos pueden gestionar etapas, asignaciones, tareas y eventos; las asignaciones no conceden permisos exclusivos                   | Vigente                        |
| D-025 | Stack: Bun, React/Vite, Hono, PostgreSQL/Drizzle, Better Auth, Zod OpenAPI y Orval                                                         | Vigente                        |
| D-026 | Timestamps técnicos se almacenan con zona horaria; fechas calendario usan `YYYY-MM-DD`                                                     | Vigente                        |
| D-027 | Eventos legales usan iconografía neutral, no balanza ni martillo                                                                           | Vigente                        |
| D-028 | Funciones experimentales usan flags resueltas por backend: excepción de organización, valor global y default seguro                        | Vigente                        |
| D-029 | Preguntar a Orbit es ayuda documental aislada de datos del estudio, usa Groq, muestra fuentes y permanece detrás de `orbit_help_assistant` | Vigente                        |
| D-030 | Cada usuario elige su propio fondo de avatar desde una paleta accesible; se persiste el hexadecimal y Orbit calcula el foreground          | Vigente                        |
| D-031 | La cartera de proyectos es list-only, agrupable por cliente o estado, ordenable y muestra periodo y equipo activo                          | Vigente                        |
| D-032 | La cartera separa En curso, Completados y Archivados; archivar reemplaza cancelar y conserva el historial                                 | Vigente                        |
| D-033 | Proyectos es la entrada principal de la aplicación; no existe una pantalla Inicio separada                                                 | Vigente                        |
| D-034 | El roadmap compacto prioriza comentarios/menciones, notificaciones internas, email de acceso y fortalecimiento técnico; excluye revisor, rondas, documentos/evidencia, dependencias/baseline y permisos granulares | Vigente |
| D-035 | Preguntar a Orbit presenta Markdown GFM seguro y responsive; bloquea HTML, imágenes y enlaces, separa fuentes y señala respuestas truncadas | Vigente                        |
| D-036 | La API usa un límite básico en memoria de 300 solicitudes autenticadas por minuto, usuario y proceso; no depende de IP, proxy, base de datos ni proveedor de despliegue | Vigente |
| D-037 | Cases es independiente de Projects; usa catálogos fijos, período normalizado, equipo informativo, actividad propia y archivo sin eliminación | Vigente |

## Roadmap compacto — decisiones por validar durante implementación

1. Modelo de comentarios humanos y menciones.
2. Eventos que generan una notificación, agrupación, lectura y retención.
3. Proveedor y flujo de correo para invitación, verificación y recuperación; retiro seguro de los mecanismos manuales.
4. Alcance de E2E críticos, observabilidad, restauración de backups y división del bundle.

## Ideas no comprometidas — decisiones estratégicas

1. Cálculo de plazos por jurisdicción, autoridad y calendario.
2. Definición explicable de riesgo y umbrales.
3. Carga y capacidad del equipo.
4. Portal de cliente e integraciones externas.
5. IA que use datos del estudio o información jurídica: política de datos, procedencia y confirmación humana.
6. Validación comercial y registral de la marca Orbit.

Estas ideas requieren validación antes de ingresar al roadmap y no deben asumirse como el siguiente trabajo.

## Supuestos vigentes

- SaaS multi-tenant: existen varios estudios aislados, pero cada usuario tiene una sola membresía de estudio en el producto actual.
- Español primero; identificadores internos y código en inglés.
- Desktop prioritario para planificación, con operación esencial responsive.
- Monolito modular con `apps/web` y `apps/api`.
- Railway para API y Cloudflare Pages para frontend.
- PostgreSQL local sin Docker como flujo recomendado actual.
- Cualquier futuro cálculo jurídico requiere intervención humana.

## Restricción implementada por reevaluar

- La base de datos impone una membresía de estudio por usuario. Soportar multi-membership y cambio de estudio es una decisión futura, no una funcionalidad disponible.
