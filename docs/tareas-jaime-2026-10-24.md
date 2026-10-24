# Tareas de Jaime: publicación, equipo y acceso

24 de octubre de 2026. Revisión de las diez solicitudes y todos sus comentarios
y adjuntos en el panel administrativo.

Se implementaron edición de usuarios y equipo público voluntario, publicación
real de cursos con selección Inicio/Catálogo y mostrar/ocultar contraseña.
El modelo de certificado por curso queda como propuesta sin validez; se espera
el prototipo que Jaime anunció por WhatsApp y la aprobación académica definitiva.

La migración aditiva `supabase/publicacion-equipo-20261024.sql` añade campos y
vistas con columnas limitadas; mantiene privadas las tablas de perfiles y cursos.
Solo aparecen administradores/docentes activos expresamente publicados; no se
publicó ninguna persona. Los borradores y cursos archivados no se muestran como
disponibles. Se conserva el catálogo de 123 ofertas, distinto del aula publicada.

Pruebas locales y productivas: escritorio/móvil a 1440/390 px, publicación real
de IA Esencial, búsqueda del catálogo, control de contraseña, formulario de
edición y modelo por curso. El guardado de formulario se interceptó, sin cambiar
perfiles reales. La edición/publicación, exclusión de inactivos, ubicación de
cursos y acceso anónimo restringido se comprobaron en SQL con transacción revertida.
Sin errores de sintaxis en los scripts modificados. Se mantienen 8 perfiles,
127 cursos, 7 matrículas, 5 intentos y un certificado.

Quedan pendientes de datos del responsable: cláusulas vigentes de privacidad,
buzón/proveedor/remitente, cuentas/medios/monedas de cobro y aprobación del
certificado. Se responde cada solicitud sin marcar estas dependencias como hechas.
No se enviaron correos ni se activaron cargos o cobros. La autenticación de
verificación se generó internamente, sin enviar enlaces ni cambiar contraseñas.

Evidencias y logs locales: `.cache/auditoria-20261024/`, excluidos de Git.
Detalle transversal y publicación en el taller de MovilAula:
https://admin.movilaula.com/mejoras#auditoria-2026-10-24
