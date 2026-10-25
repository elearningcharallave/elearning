# Regreso a la página principal

Se enlazan los logotipos y se ofrece Inicio o Volver al inicio en las páginas operativas de FUNCECAIND: sitio público, acceso, recuperación, alumno, docente, administración, cursos, tareas, evaluaciones, foro, certificados, pruebas y panel de cambios. Los enlaces estáticos funcionan sin JavaScript y tienen un nombre accesible para teclado y lectores de pantalla.

En el panel alojado en Workers, tanto el logo como Inicio apuntan al sitio público de FUNCECAIND, evitando volver al propio panel. Las rutas dentro de `pruebas/` conservan el nivel correcto. El menú móvil mantiene su opción Inicio y el logo permanece enlazado.

La clase en vivo dispone de una barra de regreso visible durante la llamada, con espacio reservado por encima del video. Se conserva el tratamiento existente de salida de la clase. No se inicia ninguna llamada real en las pruebas.

Durante la revisión móvil se corrigió el contenedor de las dos fechas de creación de curso: se apilan en pantallas estrechas para conservar el acceso a la navegación sin desplazamiento horizontal. No se modificaron datos académicos, usuarios, permisos o resultados.

Comprobación: 26 páginas, tamaños de 320, 390, 768 y 1440 píxeles y navegación efectiva desde el logo. Las páginas privadas se verifican con perfiles ficticios y consultas interceptadas, sin escrituras académicas. Se comprueba también el destino desde el panel de Workers y la barra de clase con Jitsi simulado. Las evidencias quedan en `tmp/inicio-*.json` y `tmp/inicio-*.png`.
