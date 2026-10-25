# Seguridad de certificados y legibilidad — 25 de octubre de 2026

Actualizo jsPDF desde 2.5.1 a 4.2.1, después de contrastar los avisos vigentes de
la biblioteca y comprobar la disponibilidad del archivo oficial distribuido en
CDN. La actualización corrige las versiones afectadas por inyección de objetos
PDF, contenido de ventanas nuevas y denegación de servicio.

El certificado ajusta el nombre, el curso y los detalles al espacio disponible
sin eliminar contenido. Su presentación móvil permite saltos de línea y apila
la fecha, el QR y el código. Los errores y las horas se escapan antes de
insertarlos en HTML.

Validación local: ocho vistas a 320, 390, 768 y 1440 píxeles, con datos normales
y largos; dos descargas PDF A4 horizontal de una página. Se renderizaron y se
revisaron ambos PDF. Sin errores JavaScript, desbordamientos ni superposición
detectada. Los datos empleados son sintéticos y no crean certificados ni
inscripciones en la base real.

Se conservan las correcciones generales de navegación, contraste y legibilidad
documentadas en `legibilidad-2026-10-25.md`.

Fuentes: [avisos de jsPDF](https://github.com/parallax/jsPDF/security/advisories),
[versión distribuida](https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js).
