# Alcance funcional

## Implementado

### Identidad y organización

- Registro e inicio de sesión con Better Auth.
- Organización activa y onboarding. La plataforma separa tenants, pero actualmente cada usuario pertenece a un solo estudio y no existe cambio entre organizaciones.
- Invitaciones con expiración de 48 horas, posición profesional obligatoria, aceptación y rechazo.
- Perfil propio con alias y color de avatar editable desde una paleta accesible; perfiles de miembros de solo lectura con su información en el estudio.
- Posición profesional de membresía: Socio, Senior, Junior, Asistente o Practicante. El owner la asigna y modifica; no cambia permisos.
- Zona horaria de la organización; valor inicial `America/Lima`.
- Cierre de sesión disponible también durante onboarding e invitaciones.
- Recuperación manual de contraseña sin correo: el owner genera desde Equipo un enlace privado para un miembro activo del mismo estudio. El enlace de Better Auth vence en 30 minutos, se usa una sola vez y el cambio revoca las sesiones existentes.
- El owner que no puede entrar puede solicitar el mismo enlace mediante el comando administrativo `auth:recovery-link --email`; la coincidencia del correo es exacta y el enlace solo se imprime después de generarse correctamente.

### Clientes

- Creación y edición de ficha básica.
- Búsqueda con debounce y paginación.
- Asociación con proyectos.

### Proyectos

Campos actuales: nombre, cliente, tipo, estado, fecha de inicio, fecha final, referencia interna opcional y descripción opcional.

### Casos

- Módulo independiente de Projects para procesos legales y tributarios por cliente.
- Identificación manual y cliente como datos principales. Clasificación, expediente, período, importe, materia y resolución son opcionales; el expediente solo aplica cuando existe una etapa y el demandante solo en casos judiciales, limitado al cliente del caso o SUNAT.
- Estado En trámite o Concluido; un caso concluido exige resultado Fundada, Infundada o Improcedente.
- Miembros opcionales, actividad inmutable y archivo/restauración sin eliminación.
- Cartera agrupada por cliente, búsqueda, tabs por ciclo de vida, filtros multiselección por tipo/cliente/miembro, creación, detalle y configuración responsive.
- Catálogos fijos entregados por el backend. Reglas completas en [15-casos.md](15-casos.md).

- La creación usa una página dedicada, periodo inicialmente vacío y combobox de cliente con búsqueda debounced.
- En la misma creación se puede añadir equipo opcional y designar múltiples supervisores; todo se persiste atómicamente junto con etapas, evento inicial y actividad.
- La cartera abre agrupada por cliente y cada grupo expandible contiene todos sus proyectos coincidentes.
- La paginación agrupada cuenta clientes para no partir su cartera entre páginas.
- La cartera admite `groupBy=client`, `groupBy=status` y `groupBy=none`. Los grupos de estado se consultan y paginan de forma independiente.
- Los tabs separan `En curso` (borrador y activo), `Completados` y `Archivados`. El archivo es el mecanismo para retirar un proyecto de la operación sin borrar su historial.
- `groupBy=status` está disponible en En curso y Archivados; las vistas de un único estado usan cliente o lista plana.
- `orderBy=endDate|startDate|name|archivedAt` y `order=asc|desc` ordenan proyectos dentro de cada agrupación.
- La barra compacta busca por proyecto, tarea no archivada, cliente o referencia interna y combina filtros múltiples por estado, tipo, cliente y miembros del equipo. Varios valores de una propiedad son alternativas; al seleccionar varios miembros, el proyecto debe tener a todos como participantes activos.
- Búsqueda, filtros, agrupación y orden se conservan en la URL para compartir o restaurar la misma vista.
- Cada fila muestra inicio, final y hasta cuatro integrantes activos del equipo, con total y tooltips accesibles.

- Estados: borrador, activo y completado.
- Archivo/restauración como ciclo separado del estado.
- La fecha final representa el cierre planificado del trabajo; no es una fecha legal.
- Un proyecto puede tener cero, uno o varios eventos independientes.

### Tipos y etapas iniciales

- **Escrito (Demanda/Recurso/Escrito)**.
- **Consulta (Correo/Informe)**.
- **Informe oral**.
- **Otro**, sin etapas iniciales.

Los tres primeros tipos copian etapas predefinidas al crear el proyecto. Después, cualquier miembro activo del estudio puede crear, editar, reordenar o eliminar etapas vacías. No existe un constructor de templates personalizados.

### Equipo del proyecto

- Cero, uno o varios supervisores.
- El equipo inicial puede definirse al crear el proyecto; ningún miembro se selecciona implícitamente.
- Cada asignación puede marcarse como principal.
- Participación anterior preservada cuando una asignación termina.
- Miembros no asignados conservan acceso según su membresía del estudio; las asignaciones son informativas por ahora.

### Tareas

Campos actuales: título, descripción opcional, etapa, estado, inicio planificado opcional, fecha límite opcional, posición y encargados múltiples.

- Estados: pendiente, en trabajo, suspendida y completada.
- Crear, editar, cambiar estado, asignar encargados, archivar y restaurar.
- Un encargado debe tener una asignación activa en el equipo del proyecto.
- Si una tarea pasa por primera vez a en trabajo o completada sin inicio, se asigna el día actual de la organización.
- El detalle se abre en Sheet y admite enlaces directos mediante la URL.
- Los cambios relevantes generan actividad automática.

### Eventos y actividad

- Evento jurídico independiente con nombre, fecha y descripción opcional.
- El dominio reserva tipos legal, reunión y otro; la UI actual crea eventos legales.
- Un evento debe ocurrir desde el inicio del proyecto y puede quedar después de su fecha final.
- Crear, editar o eliminar un evento genera actividad inmutable con snapshot.
- Actividad automática de proyectos, archivo, etapas, tareas, fechas, estados, asignaciones y miembros.

### Proyectos, Actividad, Mi trabajo y planificación

- **Proyectos:** cartera principal y destino inicial de la aplicación; separa ciclos de vida, permite agrupar y ordenar, y abre cada proyecto con todo su contexto.
- **Actividad:** historial paginado de todo el estudio, ordenado del movimiento más reciente al más antiguo. Incluye proyectos y casos, incluso archivados.
- **Mi trabajo:** cartera personal con tabs para tareas donde el usuario es encargado activo, proyectos donde es supervisor principal o compartido y acciones de casos que tiene encargadas. Las tareas se ordenan por la semana calendario del estudio y presentan primero cliente, proyecto y tarea, con encargados agrupados de forma compacta por posición profesional. La supervisión resume mediante una barra proporcional todas las tareas no archivadas por estado y separa la alerta de tareas sin encargado. Las acciones de casos se agrupan por cliente y caso, no usan grupos temporales y permiten completar o reabrir inline. Cada vista conserva sus filtros y paginación en la URL.
- **Timeline de proyecto:** días de ancho fijo según zoom, panel de etapas redimensionable, tareas por etapa, expandir/colapsar, fecha actual, fecha final, eventos y edición de bordes de tareas en desktop con alternativa de teclado.

### Ayuda documental

- **Preguntar a Orbit:** página autenticada disponible mediante feature flag para consultar cómo funciona el producto.
- Usa únicamente secciones seleccionadas de `docs/blueprint`; no envía al proveedor datos de organizaciones, clientes, proyectos, tareas o miembros.
- Responde en español con fuentes visibles y declara cuando la documentación no sustenta una respuesta.
- Conserva la pregunta visible y presenta la respuesta como Markdown sencillo y seguro: encabezados, listas, checklists de solo lectura, énfasis, tachado, citas, código y tablas responsive. No renderiza HTML, imágenes ni enlaces del modelo; las fuentes permanecen en un bloque separado.
- Si Groq alcanza el límite de generación, Orbit reintenta una sola vez con una respuesta más concisa. Un segundo corte conserva el contenido y lo marca explícitamente como incompleto.
- Usa Groq con `openai/gpt-oss-20b` por defecto, límites por usuario y manejo explícito de indisponibilidad.
- No conserva conversaciones, no ejecuta acciones y no brinda análisis jurídico.

## Siguiente

- Comentarios humanos y menciones vinculados a tareas y actividad.
- Notificaciones dentro de la aplicación, con agrupación y estados legibles.

## Futuro

- Envío de correo para invitaciones, verificación de cuenta y recuperación de acceso, retirando los mecanismos manuales temporales.
- Pruebas E2E para recorridos críticos, observabilidad, restauración verificada de backups y división del bundle web.
- Las expansiones jurídicas, externas o analíticas se evaluarán por separado antes de entrar al roadmap.

## Límites actuales

- Cada usuario tiene una sola membresía de estudio; no hay selector ni cambio entre varias organizaciones.
- La entrega de correo está diferida. Como excepción temporal, `AUTH_TRUST_SIGNUP_EMAIL=true` permite confiar en el correo de cuentas nuevas para que Better Auth pueda listar sus invitaciones; el opt-in es global del backend, comienza desactivado y se retirará al implementar verificación real.
- Orbit todavía no envía enlaces de recuperación por correo. El owner debe compartir el enlace manualmente por un canal confiable y verificar la identidad de la persona; esta entrega manual se reemplazará cuando exista el sistema de email.
- No hay eliminación definitiva de proyectos o tareas desde la UI.
- No hay prioridad, checklist, adjuntos, comentarios, dependencias ni evidencia en tareas.
- No hay fechas, encargados o aprobaciones propias de una etapa.
- No hay permisos derivados de las asignaciones de proyecto.
- Los eventos legales no modifican automáticamente orden, riesgo o fechas del proyecto.
