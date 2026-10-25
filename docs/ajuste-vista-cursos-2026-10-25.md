# Ajuste del listado de cursos del profesor

Solicitud de Jaime «ajustar la vista», revisada con su captura adjunta el 25 de octubre de 2026.

La fila compartía el ancho entre el icono, la identidad y todas las acciones. Al crecer la barra de botones, el nombre del curso y del profesor quedaban comprimidos. Se separaron en una cuadrícula: identidad arriba y acciones debajo. En móvil las acciones usan dos columnas; el enlace del modelo de certificado ocupa la fila completa. Inicio y Catálogo conservan una etiqueta alineada y los controles tienen al menos 44 px. El botón de eliminar tiene nombre accesible.

Archivos: `cursos.html` y `assets/legibilidad.css`. El enlace de estilos cambia de versión para evitar la caché anterior. Publicación funcional: commit `2af6f12` en la rama `main` del repositorio que publica GitHub Pages.

Se verificó que los dos archivos servidos por producción coinciden con los archivos locales, mediante SHA-256 y normalización de saltos de línea. El JavaScript en línea pasa la comprobación de sintaxis.

La plantilla real se comprobó localmente con dos cursos ficticios, incluido un título y un nombre de docente largos, a 1440, 1024, 390 y 320 px. Ningún caso desborda horizontalmente ni solapa controles; las acciones quedan debajo de la identidad y todos los controles de la barra miden al menos 44 px. La prueba no conecta con la base del aula. La cuenta real de Carlos se abrió conservando su rol profesor y su autorización previa del taller; no se crearon cursos para probar la presentación.

La solicitud recibió una respuesta detallada y dos capturas identificadas como prueba local. Se marcó Hecha mediante el panel, con autor y fecha de servidor, y se revalidó por lectura de la base. Se conservó la captura original de Jaime. No se modificaron cursos, matrículas, notas ni publicaciones.

El panel conserva pendientes Protección de datos, Gestión de correos y Pasarela de pagos: necesitan las cláusulas y los datos definitivos del responsable, ya solicitados anteriormente. No se marcaron como hechos.

Evidencia local excluida de Git: `.cache/vista-publicada-20261025.json`, `.cache/vista-cursos-pruebas-20261025.json`, `.cache/cierre-vista-20261025.json` y las capturas correspondientes.
