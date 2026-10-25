# Revisión del frontend y legibilidad — 25 de octubre de 2026

Se incorporó una base de legibilidad en las 24 pantallas del sitio, aula,
administración y pruebas de acceso/ofimática. Conserva los datos, los permisos,
el catálogo y la identidad de FUNCECAIND. Los certificados de impresión mantienen
su composición independiente.

Los títulos usan interlineado suficiente; los textos largos y columnas pueden
adaptarse sin invadir sus vecinos. Los formularios tienen campos de 16 px en
móvil, controles táctiles de al menos 44 px y foco de teclado visible. Se mejoró
el contraste de botones y textos secundarios. El menú público completo ahora
está disponible en móvil, se cierra con Escape y conserva las mismas rutas.
La tarjeta informativa de la portada también se muestra en móvil.

Verificación local: 44 vistas públicas de FUNCECAIND a 320, 390, 768 y 1440 px,
sin errores de JavaScript, desbordes de página ni superposiciones de texto
visible. Se revisaron otras 18 vistas con sesiones de administrador, profesor
y alumno, a 390/1440 px, bloqueando escrituras de datos de negocio.

También se comprobó el menú, la búsqueda y el estado vacío del catálogo,
las fichas del pensum abiertas y el texto ampliado al 200 %. Las sesiones de
diagnóstico se generaron internamente y se cerraron al terminar: no se enviaron
enlaces de acceso ni se cambiaron contraseñas.

Evidencias locales: `C:/Users/carlo/Documents/qa-frontends-20261025/`.
La validación de publicación se registra al cerrar el despliegue.
