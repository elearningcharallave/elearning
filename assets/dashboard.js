(function () {
  'use strict';
  const $ = (id)=>document.getElementById(id), esc=FV.esc;
  const nombres={perfiles:'Cuentas',cursos:'Cursos',modulos:'Módulos',lecciones:'Lecciones',matriculas:'Matrículas',clases:'Clases',asistencia:'Asistencia a clases',materiales:'Materiales',tareas:'Tareas',entregas:'Entregas',evaluaciones:'Evaluaciones',preguntas:'Preguntas',intentos:'Intentos de evaluación',resultados:'Resultados',certificados:'Certificados',foro_mensajes:'Foro',learning_events:'Aprendizaje',cambios_solicitudes:'Solicitudes',cambios_comentarios:'Comentarios de solicitudes',cambios_adjuntos:'Archivos de solicitudes',presencia:'Actividad en el aula'};
  const paginas={'index.html':'Inicio','profesor.html':'Panel del profesor','admin.html':'Administración académica','alumno.html':'Panel del alumno','cambios.html':'Panel administrativo','aula.html':'Clase en vivo','curso.html':'Curso','evaluacion.html':'Evaluación','tarea.html':'Tarea','foro.html':'Foro','analitica.html':'Analítica','cursos.html':'Cursos','certificado.html':'Certificado','control-calidad.html':'Control de calidad'};
  const numero=(n)=>Number(n||0).toLocaleString('es-VE');
  let sb,canal,intervalo,pendiente,cargando=false,repetir=false,enLinea=false,activo=false;
  function visible(){return activo && !document.hidden && !$('vista-dashboard').hidden && !$('contenido').classList.contains('en-edicion');}
  function conexion(texto){$('dashboard-conexion').textContent=texto;$('dashboard-conexion').dataset.conectado=String(enLinea);}
  function pintar(d){
    const a=d.academico,u=d.usuarios,c=d.cambios;
    $('dashboard-principales').innerHTML=[['Cuentas activas · 90 s',d.presencia.activas],['Alumnos registrados',u.alumnos],['Cursos publicados',a.publicados],['Entregas sin calificar',a.sin_calificar]].map(([t,n])=>`<div><dt>${t}</dt><dd>${numero(n)}</dd></div>`).join('');
    const alertas=[['Entregas pendientes de calificación',a.sin_calificar],['Solicitudes de prioridad alta',c.altas],['Solicitudes sin responsable',c.sin_responsable],['Cursos en borrador',a.borradores],['Tareas con fecha límite vencida',a.tareas_vencidas],['Cuentas inactivas',u.inactivos]].filter(([,n])=>n>0);
    $('dashboard-alertas').innerHTML=alertas.length?alertas.map(([t,n])=>`<li><span>${t}</span><strong>${numero(n)}</strong></li>`).join(''):'<li>No hay pendientes en estos indicadores.</li>';
    const grupos=[['Cuentas',[['Total de cuentas',u.total],['Alumnos',u.alumnos],['Profesores',u.profesores],['Administradores académicos',u.administradores],['Nuevas cuentas · 7 días',u.nuevos_7d]]],['Cursos y clases',[['Cursos',a.cursos],['Publicados',a.publicados],['Matrículas',a.matriculas],['Módulos',a.modulos],['Lecciones',a.lecciones],['Clases',a.clases],['Materiales',a.materiales],['Participantes activos en clases · 90 s',a.en_clases]]],['Evaluación y aprendizaje',[['Tareas',a.tareas],['Entregas',a.entregas],['Evaluaciones',a.evaluaciones],['Preguntas',a.preguntas],['Intentos',a.intentos],['Intentos enviados',a.intentos_enviados],['Resultados',a.resultados],['Certificados emitidos',a.certificados],['Mensajes del foro',a.mensajes],['Eventos de aprendizaje',a.eventos_aprendizaje]]],['Cambios de la plataforma',[['Solicitudes totales',c.total],['Por hacer',c.pendientes],['Haciendo',c.haciendo],['Hechas activas',c.hechas],['Archivos adjuntos',d.archivos_cambios.total]]]];
    $('dashboard-totales').innerHTML=grupos.map(([titulo,items])=>`<div><dt>${titulo}</dt><dd>${items.map(([t,n])=>`<span><span>${t}</span><strong>${numero(n)}</strong></span>`).join('')}</dd></div>`).join('');
    const operaciones={INSERT:'Nuevo registro',UPDATE:'Actualización',DELETE:'Registro eliminado',PRESENCIA:'Cuenta activa o cambio de página'};
    $('dashboard-actividad').innerHTML=d.actividad.length?d.actividad.slice(0,20).map(e=>`<li><div><strong>${esc(nombres[e.tabla]||'Plataforma')}</strong><span>${esc(operaciones[e.operacion]||'Cambio')}</span></div><time datetime="${esc(e.ocurrido_en)}">${new Date(e.ocurrido_en).toLocaleString('es-VE',{dateStyle:'short',timeStyle:'medium'})}</time></li>`).join(''):'<li>Los próximos cambios aparecerán aquí automáticamente.</li>';
    $('dashboard-presencia').innerHTML=d.presencia.paginas.length?d.presencia.paginas.map(p=>`<li><span>${esc(paginas[p.pagina]||p.pagina.replace('.html',''))}</span><strong>${numero(p.cuentas)} ${p.cuentas===1?'cuenta':'cuentas'}</strong></li>`).join(''):'<li>No se registraron cuentas activas en los últimos 90 segundos.</li>';
    $('dashboard-fecha').textContent='Datos actualizados: '+new Date(d.generado_en).toLocaleString('es-VE',{dateStyle:'short',timeStyle:'medium'});
  }
  async function actualizar(){
    if(!activo)return;
    if(cargando){repetir=true;return;}
    cargando=true;$('vista-dashboard').setAttribute('aria-busy','true');
    try{const r=await sb.rpc('dashboard_resumen');if(r.error)throw r.error;if(!activo)return;pintar(r.data);$('dashboard-error').hidden=true;}
    catch(e){$('dashboard-error').hidden=false;$('dashboard-error').textContent='No se pudo actualizar el dashboard. Los datos anteriores pueden estar desactualizados. Revisa la conexión y pulsa Actualizar.';}
    finally{cargando=false;$('vista-dashboard').removeAttribute('aria-busy');if(repetir&&activo){repetir=false;actualizar();}}
  }
  function programar(){if(!visible())return;clearTimeout(pendiente);pendiente=setTimeout(actualizar,500);}
  function iniciar(cliente){
    if(activo)return;sb=cliente;activo=true;
    canal=sb.channel('dashboard-funcecaind').on('postgres_changes',{event:'INSERT',schema:'public',table:'dashboard_eventos'},()=>{programar();}).subscribe((estado)=>{
      if(!activo)return;enLinea=estado==='SUBSCRIBED';
      conexion(enLinea?'En tiempo real · conexión activa':'Reconectando · respaldo cada 30 s');
      if(enLinea&&visible())actualizar();
    });
    intervalo=setInterval(()=>{if(visible())actualizar();},30000);actualizar();
  }
  function detener(){activo=false;enLinea=false;clearTimeout(pendiente);clearInterval(intervalo);if(canal)sb.removeChannel(canal);}
  document.addEventListener('visibilitychange',()=>{if(visible())actualizar();});
  window.addEventListener('online',()=>{if(visible())actualizar();});
  window.addEventListener('offline',()=>{enLinea=false;conexion('Sin conexión · datos sin actualizar');});
  window.FCDashboard={iniciar,actualizar,detener};
})();
