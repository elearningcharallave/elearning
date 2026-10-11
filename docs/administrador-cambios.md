# Administrador de cambios de FUNCECAIND

## Dashboard operacional

El panel abre en Dashboard y conserva Solicitudes, Historial y Areas. Aplicar
`supabase/dashboard.sql` antes de publicar los recursos. El resumen incluye
conteos globales de todas las tablas del aula: cuentas, cursos, modulos, lecciones,
matriculas, clases, asistencia, materiales, tareas, entregas, evaluaciones,
preguntas, intentos, resultados, certificados, foro y eventos de aprendizaje,
ademas de las solicitudes y sus archivos. Las alertas muestran entregas sin nota,
solicitudes prioritarias o sin responsable, cursos en borrador, tareas con fecha
limite pasada y cuentas inactivas. Tarea vencida no significa entrega faltante.

`dashboard_resumen()` exige pertenencia activa al equipo. Devuelve agregados y
eventos sin nombres, correos, cedulas, respuestas ni notas individuales. No cambia
los permisos academicos de las cuentas. Solo `dashboard_eventos` se incorpora a
la publicacion realtime; los triggers guardan tabla, operacion y fecha, sin copiar
filas originales. Los latidos de asistencia no generan eventos repetitivos.
El historial nuevo empieza en la activacion del monitor; los totales incluyen
tambien los registros anteriores.

`dashboard_latido()` registra la ultima pagina visible de cada cuenta autenticada
activa, cada 30 segundos. No guarda querystrings ni visitantes anonimos. La
presencia cuenta cuentas unicas en los ultimos 90 segundos, no conexiones o
pestanas. La informacion individual de presencia no tiene acceso REST directo.
Los archivos HTML versionan app.js para cargar este seguimiento al volver al aula.

La suscripcion a INSERT saneados invalida el resumen con debounce de 500 ms.
Hay recuperacion al reconectar o volver a la pestana y sondeo de respaldo cada
30 segundos mientras se muestra el dashboard. La pantalla distingue conexion
en vivo, reconexion y datos desactualizados por error. No monitoriza infraestructura,
errores del navegador, visitas anonimas ni servicios externos al aula.
Pruebas de datos, triggers y permisos: `scripts/verificar-dashboard.sql` (rollback).

Validacion en produccion: totales comparados contra la base, permisos anonimos y
fuera del equipo rechazados, notificacion WebSocket confirmada y cambio de estado
visible sin recargar. Presencia de cuenta autenticada comprobada. Diseno de 390 px
sin desbordamiento horizontal. Desconexion simulada mostro aviso de datos antiguos
y se recupero al restaurar la red. Se retiro solo la solicitud temporal del monitor;
las solicitudes y adjuntos de uso real se conservaron.

`cambios.html` es el taller del equipo: solicitudes por area y prioridad, responsables,
tres estados (Por hacer, Haciendo, Hecha), comentarios, archivos privados, historial,
propuestas de secciones, paginas y funciones nuevas con filtro por tipo,
archivado reversible y exportacion JSON. Se abre desde **Cambios y mejoras** en
`admin.html` o en el menu de `profesor.html` de las cuentas habilitadas.
Usa las cuentas de FUNCECAIND habilitadas en `cambios_equipo_accesos`. El permiso del
taller es independiente del rol academico: un profesor puede administrar cambios
sin obtener permisos sobre alumnos, cuentas o calificaciones de otras personas.

Panel publicado: https://admin-funcecaind.carlos-linares-es.workers.dev/

## Datos y permisos

Aplicar `supabase/cambios-equipo.sql` en el proyecto FUNCECAIND. Crea cuatro tablas
`cambios_*`, funciones y un bucket privado `cambios-funcecaind`. Solo administradores
activos pueden leer/escribir; autoria y fechas se sellan en servidor. El historial
no se puede editar desde el navegador. El estado Hecha conserva quien y cuando;
reabrirlo limpia ese sello y deja un evento. Las fichas de alumnos y los cursos
existentes no se modifican. El taller comienza sin solicitudes.

Se admite cualquier tipo de archivo no vacio de hasta 15 MB, incluidos ZIP, RAR,
audios, videos y formatos especializados. La ampliacion del bucket existente
se aplica con `supabase/cambios-archivos-todos.sql`.
Se descargan con la sesion administrativa y no tienen enlaces publicos.
No adjuntar credenciales ni datos personales innecesarios.

## Publicar

El sitio GitHub Pages sirve `cambios.html` sin compilacion, igual que los demas HTML.
El panel separado usa Static Assets de Cloudflare Workers:

```powershell
node scripts/preparar-cambios.mjs
node C:/Users/carlo/Documents/admin-alcaldia/node_modules/wrangler/bin/wrangler.js deploy --config wrangler.cambios.jsonc
```

El script prepara una lista cerrada de recursos en `dist-cambios/`. Nunca configurar
Cloudflare para subir toda la raiz del repositorio.

## Verificacion del 11 de octubre de 2026

- SQL aplicado al proyecto FUNCECAIND y probado con `node scripts/verificar-cambios.mjs`.
- Pruebas transaccionales: estados, autoria sellada, cierre y reapertura, historial
  inmutable, archivo reversible, concurrencia y aislamiento de alumnos/visitantes.
- Chrome en produccion: ingreso con cuenta de prueba existente, crear solicitud,
  comentar, pasar por los tres estados, subir archivo, archivar y restaurar.
- Descarga autenticada HTTP 200 con contenido binario identico; URL publica rechazada.
- Revision visual en escritorio y telefono de 390 px, sin desbordamiento horizontal.
- Registros y archivo temporales retirados; solicitudes, comentarios, eventos y
  adjuntos quedan vacios. No se modificaron cuentas ni permisos existentes.

## Equipo habilitado el 12 de octubre de 2026

Carlos autorizo `carlos.linares.es@gmail.com` y `jahulin@gmail.com`.
Se reutilizan ambas cuentas, conservando su rol profesor y habilitando unicamente
el taller de cambios. Aplicar primero `supabase/cambios-equipo.sql` y luego
`supabase/cambios-accesos.sql`. Las claves no se guardan en el repositorio.

## Mejoras operativas del panel

Tablero y lista con filtros y limpieza de seleccion; vista propia para el detalle
de cada solicitud, con proteccion de formularios sin guardar. Los archivos se pueden
seleccionar en grupo o arrastrar. La cola valida el tamaño antes de enviar, evita
duplicados de seleccion y muestra el estado de cada subida. Los errores conservan
los archivos para reintentar, sin repetir los ya guardados. El progreso cuenta archivos
terminados; no inventa porcentajes de transferencia. Cada descarga conserva el nombre
original y ofrece un indicador de carga.

Aplicar tambien `supabase/cambios-historial-aportes.sql` para que los comentarios y
archivos tengan eventos de autoria en el historial. El texto de los comentarios
no se duplica en esa tabla. Pruebas de archivos: `node --test scripts/archivos-cambios.test.mjs`.

Verificacion del panel profesional en produccion (12 de octubre de 2026):
El selector de archivos tambien aparece en Nueva solicitud. La seleccion se
conserva al crearla y los archivos validos se suben automaticamente despues de
confirmar el registro; si una subida falla, queda disponible para reintentar.
seleccion multiple de ZIP y formato desconocido, rechazo previo de un archivo de
16 MiB y prevencion de duplicados. Una desconexion simulada conservo ambos archivos;
el reintento guardo exactamente dos adjuntos. Las descargas autenticadas coincidieron
byte a byte con los originales y el acceso publico fue rechazado. Se comprobo un
comentario y cinco eventos de historial. Escritorio y movil de 390 px revisados,
sin desbordamiento horizontal. Se retiraron solamente la solicitud temporal y sus
archivos, comentarios y eventos; la sesion del navegador se conservo.
