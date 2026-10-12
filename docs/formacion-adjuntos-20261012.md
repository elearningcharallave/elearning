# Sustitucion de la oferta de formacion

Solicitud: `f399c3d6-ac85-4695-b7a7-50707d3a78c4`, Areas cursos y contenidos.
Fuentes privadas del hilo: Contenidos de F.P Funce.ppt, Modulos funce.html y
PNA INCES.html. Se verificaron sus tamanos al descargarlos. El PPT se leyo como
registros binarios de texto; no se ejecutaron scripts de los HTML ni macros.

Inventario completo: 108 cursos individuales en 12 areas, 12 programas FP con
36 bloques de modulos y tres programas PNA. El directorio HTML incluye seis de
los programas FP; el PPT completa los doce y sus contenidos. Se mantienen los
codigos originales y se muestran los del directorio cuando difieren del PPT.
Ri. 007, Pp. S/N y Se. S/N tienen varias filas y no se deduplican por codigo.
La ficha de Operador de Maquinas y Herramientas repite Modulo I; se conserva y
se explica esa repeticion. Las horas practicas de PNA siguen separadas de las
teoricas. No se inventaron precios, docentes, fechas de inicio ni horas para
los programas cuya duracion solo esta expresada en anos.

Se reemplazaron catalogo, pensum, Control de Calidad y la seccion de formacion
de Inicio. Hay filtros por texto, area y tipo, y todos los programas tienen sus
modulos visibles. `assets/formacion-2026.json` conserva los textos extraidos.
`scripts/generar-formacion.mjs` regenera las paginas de forma reproducible.

La migracion `supabase/formacion-adjuntos-20261012.sql`, generada por
`scripts/generar-formacion-sql.mjs`, carga 123 ofertas y 147 fichas o temarios.
Estos son los contenidos disponibles en los adjuntos; no son clases grabadas
ni actividades adicionales. Los cursos previos Ofimatica, Excel Basico y
Electronica basica se archivan y se despublican. No se borran: se conserva la
historia academica. Las listas activas del aula los excluyen y el dashboard
distingue los cursos activos de los archivados, sin alertar por tareas del
catalogo anterior.

El ensayo transaccional con rollback paso antes de aplicar. Tras la importacion,
los identificadores y totales de matriculas, certificados, resultados e intentos
coincidieron exactamente con los anteriores. Se validaron los totales de ofertas,
modulos y fichas. Los permisos del dashboard tambien pasaron su regresion.
