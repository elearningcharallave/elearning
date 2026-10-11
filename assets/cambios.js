/* El taller usa la misma cuenta de FUNCECAIND; las tablas nuevas no contienen alumnos. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = FV.esc;
  const AREAS = {
    general: ['General', 'Organización y mejoras que afectan a varias áreas.', 'admin.html'],
    web: ['Web pública', 'Inicio, catálogo, información y contacto.', 'index.html'],
    cuentas: ['Cuentas y acceso', 'Ingreso, registro, perfiles y permisos.', 'admin.html'],
    cursos: ['Cursos y materiales', 'Contenidos, módulos, lecciones y matrículas.', 'cursos.html'],
    clases: ['Clases en vivo', 'Salas, horarios y asistencia.', 'profesor.html'],
    evaluaciones: ['Evaluaciones', 'Pruebas, tareas y calificaciones.', 'admin.html'],
    certificados: ['Certificados', 'Emisión y verificación de certificados.', 'verificar.html'],
    comunicacion: ['Comunicación', 'Foros y mensajes de la plataforma.', 'foro.html']
  };
  const ESTADOS = { pendiente: 'Por hacer', haciendo: 'Haciendo', hecha: 'Hecha' };
  const PROPUESTAS = { mejora:'Cambio o mejora', parte_nueva:'Parte nueva' };
  const { validarArchivo, claveArchivo, tamanoLegible, formatoArchivo } = window.FCArchivos;
  const sb = FV.sb;
  let usuario, equipo = [], solicitudes = [], eventos = [], actual = null, vista = 'dashboard';
  let cargando = false, versionHilo = 0;
  let modo = 'tablero', colaArchivos = [], subiendoArchivos = false, fotoFormulario = '';
  let operacionesActivas = 0, refrescoPendiente = false;
  const fecha = (valor) => valor ? new Date(valor).toLocaleString('es-VE', { dateStyle:'medium', timeStyle:'short' }) : '';
  const persona = (id) => equipo.find((p) => p.id === id)?.nombre || (id ? 'Administrador' : 'Sin asignar');
  function aviso(texto, error) { $('aviso').textContent = texto; $('aviso').className = 'aviso' + (error ? ' error' : ''); }
  function fallo(error) {
    console.error('Panel de cambios:', error?.code || error?.name || 'consulta');
    aviso(error?.code === '42501' ? 'Tu cuenta no tiene permiso para esta acción. Vuelve a entrar con una cuenta de administrador.'
      : 'No se pudo completar la acción. Revisa la conexión y vuelve a intentarlo; el formulario conserva lo que escribiste.', true);
  }
  async function consulta(promesa) { const r = await promesa; if (r.error) throw r.error; return r.data; }
  async function todas(tabla, orden, opciones = {}) {
    const filas = [];
    for (let desde = 0; ; desde += 500) {
      let peticion=sb.from(tabla).select('*').order(orden, { ascending:!!opciones.ascendente }).order('id');
      if(opciones.solicitud) peticion=peticion.eq('solicitud_id',opciones.solicitud);
      const parte = await consulta(peticion.range(desde, desde+499));
      filas.push(...parte); if (parte.length < 500) return filas;
    }
  }
  async function ocupada(formulario, accion) {
    ++operacionesActivas;
    const controles = [...formulario.querySelectorAll('button,input,select,textarea')].map((elemento)=>({elemento,disabled:elemento.disabled}));
    const enviar = formulario.querySelector('button[type="submit"]'), texto = enviar?.textContent;
    controles.forEach(({elemento})=>elemento.disabled=true);
    if (enviar) enviar.textContent = formulario.id === 'form-entrada' ? 'Entrando…' : formulario.id === 'form-comentario' ? 'Publicando…' : 'Guardando…';
    formulario.setAttribute('aria-busy','true');
    try { await accion(); } catch (e) { fallo(e); }
    finally { --operacionesActivas; controles.forEach(({elemento,disabled})=>elemento.disabled=disabled); if(enviar) enviar.textContent=texto; formulario.removeAttribute('aria-busy'); }
  }
  function opciones() {
    const areas = Object.entries(AREAS).map(([id,[nombre]]) => `<option value="${id}">${nombre}</option>`).join('');
    $('filtro-area').innerHTML = '<option value="">Todas las áreas</option>' + areas; $('solicitud-area').innerHTML = areas;
    const personas = equipo.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre || 'Administrador')}</option>`).join('');
    $('filtro-responsable').innerHTML = '<option value="">Todos</option><option value="sin">Sin asignar</option>' + personas;
    $('solicitud-responsable').innerHTML = '<option value="">Sin asignar</option>' + personas;
  }
  async function abrirPanel(sesion) {
    if (!sesion) return;
    const perfil = await consulta(sb.from('perfiles').select('id,nombre,rol,activo').eq('id',sesion.user.id).single());
    const permitido = await consulta(sb.rpc('cambios_es_admin'));
    if (!permitido || perfil.activo === false) {
      await sb.auth.signOut({scope:'local'}); throw new Error('no-admin');
    }
    usuario = perfil;
    $('volver-aula').href = 'https://elearningcharallave.github.io/elearning/' + FV.panelDe(perfil.rol);
    equipo = await consulta(sb.rpc('cambios_equipo'));
    opciones(); $('nombre-usuario').textContent = perfil.nombre || 'Administrador';
    $('entrada').hidden = true; $('panel').hidden = false;
    FCDashboard.iniciar(sb);
    await refrescar();
  }
  async function refrescar() {
    if (cargando) {refrescoPendiente=true;return;}
    const informar=vista!=='dashboard'||!$('editor').hidden;
    cargando = true; $('actualizar').disabled = true; if(informar)aviso('Actualizando solicitudes…');
    $('vista-trabajo').setAttribute('aria-busy','true');
    try {
      [solicitudes,eventos] = await Promise.all([todas('cambios_solicitudes','creada_en'), todas('cambios_eventos','creado_en')]);
      pintar(); if(informar)aviso('Actualizado a las ' + new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}));
    } catch (e) { fallo(e); } finally {
      cargando = false; $('actualizar').disabled = false; $('vista-trabajo').removeAttribute('aria-busy');
      if(refrescoPendiente){refrescoPendiente=false;await refrescar();}
    }
  }
  function filtradas() {
    const texto = $('buscar').value.trim().toLocaleLowerCase('es');
    const responsable = $('filtro-responsable').value;
    return solicitudes.filter((s) => s.archivada === $('archivadas').checked
      && (!$('filtro-area').value || s.area === $('filtro-area').value)
      && (!$('filtro-tipo').value || (s.tipo || 'mejora') === $('filtro-tipo').value)
      && (!$('filtro-prioridad').value || s.prioridad === $('filtro-prioridad').value)
      && (!responsable || (responsable === 'sin' ? !s.asignada_a : s.asignada_a === responsable))
      && (!texto || (s.titulo + ' ' + s.detalle).toLocaleLowerCase('es').includes(texto)));
  }
  function pintar() {
    const lista = filtradas(), abiertas = solicitudes.filter((s) => !s.archivada);
    $('resumen').innerHTML = `<span><strong>${abiertas.length}</strong> ${abiertas.length===1?'solicitud':'solicitudes'}</span>` + Object.entries(ESTADOS).map(([id,n]) => {
      const cantidad=abiertas.filter((s)=>s.estado===id).length;
      return `<span><strong>${cantidad}</strong> ${id==='hecha'?(cantidad===1?'hecha':'hechas'):n.toLowerCase()}</span>`;
    }).join('') +
      `<span><strong>${abiertas.filter((s) => s.prioridad==='alta' && s.estado!=='hecha').length}</strong> de prioridad alta</span>`;
    $('conteo-resultados').textContent = `${lista.length} ${lista.length===1?'solicitud':'solicitudes'} ${$('archivadas').checked ? (lista.length===1?'archivada':'archivadas') : (lista.length===1?'activa':'activas')}`;
    $('limpiar-filtros').hidden = !['buscar','filtro-area','filtro-tipo','filtro-prioridad','filtro-responsable'].some((id)=>$(id).value) && !$('archivadas').checked;
    $('tablero').hidden = modo!=='tablero'; $('lista-solicitudes').hidden = modo!=='lista';
    $('tablero').innerHTML = Object.entries(ESTADOS).map(([id,nombre]) => {
      const grupo = lista.filter((s) => s.estado===id).sort((a,b) => id==='hecha'
        ? String(b.hecha_en).localeCompare(String(a.hecha_en))
        : (b.prioridad==='alta')-(a.prioridad==='alta') || a.creada_en.localeCompare(b.creada_en));
      return `<section class="columna"><h2>${nombre}<span>${grupo.length}</span></h2>` + (grupo.length ? grupo.map((s) =>
        `<button class="solicitud" data-abrir="${s.id}"><div class="meta"><span>${esc(AREAS[s.area]?.[0] || s.area)}</span>${s.prioridad==='alta'?'<span class="etiqueta alta">Alta prioridad</span>':''}</div><strong>${esc(s.titulo)}</strong><p><span class="etiqueta">${PROPUESTAS[s.tipo || 'mejora']}</span></p><p>${esc(s.detalle.slice(0,170))}${s.detalle.length>170?'…':''}</p><div class="meta"><span>${esc(persona(s.asignada_a))}</span><span>${fecha(id==='hecha'?s.hecha_en:s.creada_en)}</span></div>${s.archivada?'<span class="etiqueta">Archivada</span>':''}</button>`).join('')
        : `<p class="vacio">${lista.length ? 'Sin solicitudes en este estado.' : (solicitudes.length ? 'No hay solicitudes que coincidan con estos filtros.' : 'Aún no hay solicitudes. Crea la primera con «Nueva solicitud».')}</p>`) + '</section>';
    }).join('');
    const orden = { pendiente:0, haciendo:1, hecha:2 };
    const filas = [...lista].sort((a,b)=>orden[a.estado]-orden[b.estado] || (b.prioridad==='alta')-(a.prioridad==='alta') || a.creada_en.localeCompare(b.creada_en));
    $('lista-solicitudes').innerHTML = filas.length ? `<table><caption class="oculto-visual">Solicitudes de cambios filtradas</caption><thead><tr><th scope="col">Solicitud</th><th scope="col">Estado</th><th scope="col">Responsable</th><th scope="col">Prioridad</th><th scope="col">Actualizada</th></tr></thead><tbody>${filas.map((s)=>`<tr><td><button class="abrir-fila" data-abrir="${s.id}">${esc(s.titulo)}</button><p class="nota">${esc(AREAS[s.area]?.[0] || s.area)} · ${PROPUESTAS[s.tipo||'mejora']}</p></td><td><span class="etiqueta estado-${s.estado}">${ESTADOS[s.estado]}</span></td><td>${esc(persona(s.asignada_a))}</td><td>${s.prioridad==='alta'?'<span class="etiqueta alta">Alta</span>':'Normal'}</td><td class="nota">${fecha(s.actualizada_en)}</td></tr>`).join('')}</tbody></table>` : '<p class="vacio">No hay solicitudes que coincidan con esta selección.</p>';
    $('historial-general').innerHTML = eventos.length ? eventos.map((e) => eventoHtml(e,true)).join('') : '<p class="vacio">Aquí aparecerá el historial cuando se registre la primera solicitud.</p>';
    $('mapa').innerHTML = Object.entries(AREAS).map(([id,[n,d,ruta]]) => `<article class="area-fila"><h2>${n}</h2><p>${d}<br><strong>${abiertas.filter((s)=>s.area===id&&s.estado!=='hecha').length}</strong> solicitudes sin terminar</p><a href="https://elearningcharallave.github.io/elearning/${ruta}" target="_blank" rel="noopener">Abrir en la plataforma ↗</a></article>`).join('');
  }
  function eventoHtml(e, conSolicitud) {
    const s = solicitudes.find((t)=>t.id===e.solicitud_id);
    let texto = e.tipo==='comentario' ? 'Publicó un comentario' : e.tipo==='archivo' ? 'Adjuntó ' + (e.despues?.nombre || 'un archivo') : 'Creó la solicitud';
    if (e.antes) {
      const cambios = [];
      if (e.antes.estado !== e.despues.estado) cambios.push(`${ESTADOS[e.antes.estado]} → ${ESTADOS[e.despues.estado]}`);
      if (e.antes.archivada !== e.despues.archivada) cambios.push(e.despues.archivada ? 'Archivó la solicitud' : 'Restauró la solicitud');
      if (e.antes.asignada_a !== e.despues.asignada_a) cambios.push('Responsable: ' + persona(e.despues.asignada_a));
      for (const [clave,nombre] of [['titulo','Título'],['tipo','Tipo de propuesta'],['detalle','Descripción'],['area','Área'],['prioridad','Prioridad']]) {
        if (e.antes[clave] !== e.despues[clave]) cambios.push(nombre + ' actualizado');
      }
      texto = cambios.join(' · ') || 'Actualizó la solicitud';
    }
    return `<article class="evento"><small>${esc(persona(e.autor_id))} · ${fecha(e.creado_en)}</small>${conSolicitud?`<p><button data-abrir="${e.solicitud_id}">${esc(s?.titulo || e.despues?.titulo || 'Solicitud')}</button></p>`:''}<p>${esc(texto)}</p></article>`;
  }
  async function abrir(id, interna=false) {
    if (!confirmarSalida(interna)) return;
    actual = id ? solicitudes.find((s)=>s.id===id) : null;
    if (id && !actual) { aviso('Actualiza la lista para abrir esta solicitud.',true); return; }
    ++versionHilo;
    $('editor').hidden = false; $('contenido').classList.add('en-edicion');
    $('titulo-vista').textContent = actual ? 'Seguimiento de la solicitud' : 'Nueva solicitud';
    $('subtitulo-vista').textContent = actual ? actual.titulo : 'Propón una mejora o una parte nueva para la plataforma.';
    $('titulo-editor').textContent = 'Información de la solicitud';
    $('sello-solicitud').textContent = actual ? `Creada por ${persona(actual.creada_por)} · ${fecha(actual.creada_en)}` : 'La propuesta se registrará como «Por hacer».';
    $('exportar').hidden = true;
    $('solicitud-id').value = actual?.id || ''; $('solicitud-titulo').value = actual?.titulo || '';
    $('solicitud-tipo').value = actual?.tipo || 'mejora';
    $('solicitud-detalle').value = actual?.detalle || ''; $('solicitud-area').value = actual?.area || 'general';
    $('solicitud-prioridad').value = actual?.prioridad || 'normal'; $('solicitud-responsable').value = actual?.asignada_a || '';
    $('solicitud-estado').value = actual?.estado || 'pendiente'; $('campo-estado').hidden = !actual;
    $('archivar').hidden = !actual; $('archivar').textContent = actual?.archivada ? 'Restaurar solicitud' : 'Archivar solicitud';
    $('seguimiento').hidden = false;
    $('seccion-comentarios').hidden = !actual; $('seccion-historial').hidden = !actual;
    $('ayuda-nueva-adjunto').hidden = !!actual; $('adjuntos').hidden = !actual;
    $('seguimiento').classList.toggle('solicitud-nueva', !actual);
    $('comentario').value = ''; $('archivo').value = '';
    colaArchivos=[]; pintarCola(); $('progreso-archivos').hidden=true;
    fotoFormulario = leerFormulario();
    $('editor').scrollIntoView({block:'start'}); $('solicitud-titulo').focus({preventScroll:true});
    if (actual) await hilo(actual.id);
  }
  async function hilo(id) {
    const version = ++versionHilo;
    $('comentarios').innerHTML = '<p class="nota">Cargando comentarios…</p>';
    $('adjuntos').innerHTML = '<p class="nota">Cargando archivos…</p>';
    try {
      const [comentarios,adjuntos,historia] = await Promise.all([
        todas('cambios_comentarios','creado_en',{solicitud:id,ascendente:true}),
        todas('cambios_adjuntos','creado_en',{solicitud:id,ascendente:true}),
        todas('cambios_eventos','creado_en',{solicitud:id})
      ]);
      if (version!==versionHilo || actual?.id!==id) return;
      $('comentarios').innerHTML = comentarios.length ? comentarios.map((c)=>`<article class="aporte"><small>${esc(persona(c.autor_id))} · ${fecha(c.creado_en)}</small><p>${esc(c.cuerpo)}</p></article>`).join('') : '<p class="nota">Aún no hay comentarios.</p>';
      $('adjuntos').innerHTML = adjuntos.length ? adjuntos.map((a)=>`<article class="archivo-guardado"><div class="formato-archivo">${esc(formatoArchivo(a.nombre))}</div><div class="archivo-info"><strong>${esc(a.nombre)}</strong><p class="nota">${tamanoLegible(a.tamano)} · ${esc(persona(a.autor_id))}<br>${fecha(a.creado_en)}</p></div><button data-archivo="${esc(a.ruta)}" data-nombre="${esc(a.nombre)}" aria-label="Descargar ${esc(a.nombre)}">Descargar</button></article>`).join('') : '<p class="nota vacio-adjuntos">Los archivos que subas quedarán aquí, disponibles para el equipo.</p>';
      $('comentarios').scrollTop = $('comentarios').scrollHeight;
      $('historial-solicitud').innerHTML = historia.map((e)=>eventoHtml(e,false)).join('');
    } catch(e) { fallo(e); }
  }
  $('form-entrada').addEventListener('submit',(e)=>{
    e.preventDefault(); $('entrada-error').textContent='';
    ocupada(e.currentTarget,async()=>{
      const r=await sb.auth.signInWithPassword({email:$('correo').value.trim(),password:$('clave').value});
      if(r.error) { $('entrada-error').textContent='No pudimos iniciar sesión. Revisa tu correo y contraseña.'; return; }
      $('clave').value='';
      try { await abrirPanel(r.data.session); }
      catch(error) { $('entrada-error').textContent=error.message==='no-admin' ? 'Este panel es exclusivo del equipo de cambios de FUNCECAIND.' : 'No se pudo cargar el panel. Revisa la conexión e inténtalo de nuevo.'; }
    });
  });
  $('form-solicitud').addEventListener('submit',(e)=>{
    e.preventDefault(); ocupada(e.currentTarget,async()=>{
      const titulo=$('solicitud-titulo').value.trim(); if(!titulo) { aviso('Escribe un título para la solicitud.',true); return; }
      const datos={titulo,tipo:$('solicitud-tipo').value,detalle:$('solicitud-detalle').value.trim(),area:$('solicitud-area').value,prioridad:$('solicitud-prioridad').value,asignada_a:$('solicitud-responsable').value||null};
      let guardada;
      if(actual) {
        datos.estado=$('solicitud-estado').value;
        const filas=await consulta(sb.from('cambios_solicitudes').update(datos).eq('id',actual.id).eq('actualizada_en',actual.actualizada_en).select());
        if(!filas.length) { aviso('Otra persona modificó esta solicitud. Actualiza y vuelve a abrirla antes de guardar.',true); return; }
        guardada=filas[0];
      } else guardada=await consulta(sb.from('cambios_solicitudes').insert(datos).select().single());
      const nueva = !actual;
      fotoFormulario=leerFormulario(); await refrescar();
      if(nueva) {
        const seleccionados=colaArchivos;
        // Usar el registro confirmado aunque un refresco simultaneo tenga datos anteriores.
        if(!solicitudes.some((s)=>s.id===guardada.id)) solicitudes.push(guardada);
        await abrir(guardada.id,true);
        colaArchivos=seleccionados; pintarCola();
      }
      else {actual=guardada;$('subtitulo-vista').textContent=actual.titulo;await hilo(actual.id);}
      if(nueva && colaArchivos.some((a)=>a.estado==='pendiente'||a.estado==='error')) await subirPendientes();
      else aviso(colaArchivos.some((a)=>a.estado==='no_valido') ? 'Solicitud guardada. Revisa los archivos no válidos.' : 'Solicitud guardada.');
    });
  });
  $('archivar').addEventListener('click',()=>ocupada($('form-solicitud'),async()=>{
    if(!actual) return;
    if(subiendoArchivos) {aviso('Espera a que termine la subida antes de archivar.',true);return;}
    if(fotoFormulario!==leerFormulario()) {aviso('Guarda los cambios de la solicitud antes de archivarla.',true);return;}
    const id=actual.id, filas=await consulta(sb.from('cambios_solicitudes').update({archivada:!actual.archivada}).eq('id',id).eq('actualizada_en',actual.actualizada_en).select());
    if(!filas.length) { aviso('La solicitud cambió. Actualiza y vuelve a abrirla.',true); return; }
    fotoFormulario=leerFormulario(); actual=filas[0]; await refrescar(); await hilo(id);
    $('archivar').textContent=actual.archivada?'Restaurar solicitud':'Archivar solicitud';
    aviso(filas[0].archivada?'Solicitud archivada. Puedes restaurarla desde «Ver archivadas».':'Solicitud restaurada.');
  }));
  $('form-comentario').addEventListener('submit',(e)=>{
    e.preventDefault(); ocupada(e.currentTarget,async()=>{
      if(!actual) return; const id=actual.id,cuerpo=$('comentario').value.trim(); if(!cuerpo) return;
      await consulta(sb.from('cambios_comentarios').insert({solicitud_id:id,cuerpo,autor_id:usuario.id}));
      $('comentario').value=''; await Promise.all([hilo(id),refrescar()]); aviso('Comentario publicado.');
    });
  });
  function leerFormulario() {
    return JSON.stringify(['solicitud-titulo','solicitud-tipo','solicitud-detalle','solicitud-area','solicitud-prioridad','solicitud-responsable','solicitud-estado'].map((id)=>$(id).value));
  }
  function hayCambios() {
    return !$('editor').hidden && (fotoFormulario!==leerFormulario() || $('comentario').value.trim() || colaArchivos.some((a)=>a.estado!=='subido'));
  }
  function confirmarSalida(interna=false) {
    if(subiendoArchivos) { aviso('Espera a que termine la subida de archivos antes de cambiar de solicitud.',true); return false; }
    if(operacionesActivas&&!interna) {aviso('Espera a que termine de guardarse la operación en curso.',true);return false;}
    return interna || !hayCambios() || confirm('Tienes cambios o archivos sin guardar. ¿Salir de esta solicitud y descartarlos?');
  }
  function volverVista() {
    $('contenido').classList.remove('en-edicion'); $('editor').hidden=true; actual=null; ++versionHilo;
    $('exportar').hidden=vista==='dashboard'; colaArchivos=[];
    $('titulo-vista').textContent={dashboard:'Dashboard',trabajo:'Solicitudes de cambios',historial:'Historial de cambios',mapa:'Áreas de la plataforma'}[vista];
    $('subtitulo-vista').textContent={dashboard:'Una vista general de lo que ocurre en FUNCECAIND.',trabajo:'Lo que hace falta, lo que está en marcha y lo que ya quedó listo.',historial:'Cada cambio conserva quién lo hizo y cuándo.',mapa:'Organiza las mejoras según la parte del aula a la que pertenecen.'}[vista];
  }
  function agregarArchivos(archivos) {
    if(subiendoArchivos) return;
    let duplicados=0;
    for(const archivo of archivos) {
      const clave=claveArchivo(archivo);
      if(colaArchivos.some((a)=>a.clave===clave)) { ++duplicados; continue; }
      const error=validarArchivo(archivo);
      colaArchivos.push({id:crypto.randomUUID(),clave,archivo,estado:error?'no_valido':'pendiente',error,intentos:0,guardado:false});
    }
    pintarCola(); if(duplicados) aviso('Los archivos que ya estaban seleccionados no se añadieron dos veces.');
  }
  function pintarCola() {
    const nombres={pendiente:'Preparado',no_valido:'No se puede subir',subiendo:'Subiendo…',subido:'Subido',error:'Pendiente de reintento'};
    $('cola-archivos').innerHTML=colaArchivos.map((a)=>`<article class="archivo-cola ${a.estado}"><div class="archivo-info"><strong>${esc(a.archivo.name)}</strong><p class="nota">${tamanoLegible(a.archivo.size)} · ${nombres[a.estado]}</p>${a.error?`<p class="error-archivo">${esc(a.error)}</p>`:''}</div>${a.estado==='subido'?'<span class="etiqueta">Guardado</span>':`<button type="button" data-quitar="${a.id}" ${subiendoArchivos?'disabled':''} aria-label="Quitar ${esc(a.archivo.name)}">Quitar</button>`}</article>`).join('');
    const pendientes=colaArchivos.filter((a)=>a.estado==='pendiente'||a.estado==='error'), invalidos=colaArchivos.filter((a)=>a.estado==='no_valido').length;
    const bytes=pendientes.reduce((n,a)=>n+a.archivo.size,0);
    $('resumen-archivos').textContent=colaArchivos.length ? `${pendientes.length} ${pendientes.length===1?'archivo pendiente':'archivos pendientes'} · ${tamanoLegible(bytes)}${invalidos ? ` · ${invalidos} no válidos` : ''}` : '';
    $('subir-archivos').hidden=!actual;
    $('subir-archivos').disabled=subiendoArchivos||!pendientes.length;
    $('subir-archivos').textContent=subiendoArchivos?'Subiendo archivos…':pendientes.some((a)=>a.estado==='error')?'Reintentar pendientes':`Subir ${pendientes.length||''} ${pendientes.length===1?'archivo':'archivos'}`;
    $('limpiar-cola').hidden=!colaArchivos.length; $('limpiar-cola').disabled=subiendoArchivos;
    $('seleccionar-archivos').disabled=subiendoArchivos; $('archivo').disabled=subiendoArchivos;
    $('salir').disabled=subiendoArchivos;
  }
  async function subirUno(item,id) {
    item.ruta=id+'/'+item.id; ++item.intentos;
    // Un reintento reconoce una respuesta perdida sin crear dos adjuntos iguales.
    if(item.intentos>1) {
      const registro=await sb.from('cambios_adjuntos').select('id').eq('ruta',item.ruta).maybeSingle();
      if(!registro.error && registro.data) return;
      if(!item.guardado) {
        const previo=await sb.storage.from('cambios-funcecaind').download(item.ruta);
        item.guardado=!previo.error && previo.data?.size===item.archivo.size;
      }
    }
    if(!item.guardado) {
      await consulta(sb.storage.from('cambios-funcecaind').upload(item.ruta,item.archivo,{contentType:'application/octet-stream',upsert:false}));
      item.guardado=true;
    }
    try {
      await consulta(sb.from('cambios_adjuntos').insert({id:item.id,solicitud_id:id,nombre:[...item.archivo.name].slice(0,250).join(''),ruta:item.ruta,tamano:item.archivo.size,autor_id:usuario.id}));
    } catch(error) {
      const confirmado=await sb.from('cambios_adjuntos').select('id').eq('ruta',item.ruta).maybeSingle();
      if(!confirmado.error && confirmado.data) return;
      if(!confirmado.error) {
        const limpieza=await sb.storage.from('cambios-funcecaind').remove([item.ruta]);
        if(!limpieza.error) item.guardado=false;
      }
      throw error;
    }
  }
  $('seleccionar-archivos').addEventListener('click',()=>$('archivo').click());
  $('archivo').addEventListener('change',()=>{agregarArchivos($('archivo').files);$('archivo').value='';});
  $('zona-archivos').addEventListener('keydown',(e)=>{if(e.target===$('zona-archivos') && (e.key==='Enter'||e.key===' ')){e.preventDefault();$('archivo').click();}});
  $('zona-archivos').addEventListener('dragover',(e)=>{e.preventDefault();if(!subiendoArchivos)$('zona-archivos').classList.add('arrastrando');});
  $('zona-archivos').addEventListener('dragleave',(e)=>{if(!$('zona-archivos').contains(e.relatedTarget))$('zona-archivos').classList.remove('arrastrando');});
  $('zona-archivos').addEventListener('drop',(e)=>{e.preventDefault();$('zona-archivos').classList.remove('arrastrando');agregarArchivos(e.dataTransfer.files);});
  $('limpiar-cola').addEventListener('click',()=>{if(!subiendoArchivos){colaArchivos=[];pintarCola();$('progreso-archivos').hidden=true;}});
  $('form-adjunto').addEventListener('submit',async(e)=>{
    e.preventDefault(); if(operacionesActivas)return; await subirPendientes();
  });
  async function subirPendientes() {
    if(subiendoArchivos||!actual)return;
    const id=actual.id, pendientes=colaArchivos.filter((a)=>a.estado==='pendiente'||a.estado==='error'); if(!pendientes.length)return;
    subiendoArchivos=true; $('progreso-archivos').hidden=false; $('avance-archivos').max=pendientes.length; $('avance-archivos').value=0;
    let subidos=0;
    try {
      for(let i=0;i<pendientes.length;i++) {
        const item=pendientes[i];item.estado='subiendo';item.error='';pintarCola();
        $('estado-subida').textContent=`Archivo ${i+1} de ${pendientes.length}: ${item.archivo.name}`;
        try {await subirUno(item,id);item.estado='subido';++subidos;}
        catch(error){item.estado='error';item.error='No se pudo completar la subida. Puedes reintentar sin seleccionar el archivo otra vez.';console.error('Subida incompleta:',error?.code||error?.statusCode||'conexion');}
        $('avance-archivos').value=subidos; pintarCola();
      }
      await hilo(id); await refrescar();
      const faltan=pendientes.length-subidos;
      $('estado-subida').textContent=`${subidos} de ${pendientes.length} archivos guardados${faltan ? `; ${faltan} pendientes de reintento.` : '.'}`;
      aviso(faltan?'Algunos archivos no se subieron. Reintenta los pendientes; los guardados no se duplicarán.':'Archivos guardados y disponibles para el equipo.',!!faltan);
    } finally {subiendoArchivos=false;pintarCola();}
  }
  document.addEventListener('click',async(e)=>{
    const quitar=e.target.closest('[data-quitar]');if(quitar&&!subiendoArchivos){colaArchivos=colaArchivos.filter((a)=>a.id!==quitar.dataset.quitar);pintarCola();return;}
    const abrirBoton=e.target.closest('[data-abrir]'); if(abrirBoton) { await abrir(abrirBoton.dataset.abrir); return; }
    const archivo=e.target.closest('[data-archivo]'); if(archivo) {
      const textoOriginal=archivo.textContent; archivo.disabled=true; archivo.textContent='Descargando…';
      try {
        const blob=await consulta(sb.storage.from('cambios-funcecaind').download(archivo.dataset.archivo));
        const link=document.createElement('a'),url=URL.createObjectURL(blob); link.href=url; link.download=archivo.dataset.nombre;
        link.hidden=true; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
        aviso('Descarga preparada: '+archivo.dataset.nombre);
      } catch(error){fallo(error);} finally{archivo.disabled=false;archivo.textContent=textoOriginal;}
    }
    const nav=e.target.closest('[data-vista]'); if(nav) {
      if(!confirmarSalida())return;
      vista=nav.dataset.vista; document.querySelectorAll('[data-vista]').forEach((b)=>b.setAttribute('aria-current',b===nav?'page':'false'));
      for(const v of ['dashboard','trabajo','historial','mapa']) $('vista-'+v).hidden=v!==vista;
      volverVista();
      if(vista==='dashboard'){aviso('');FCDashboard.actualizar();}
      else if(vista==='trabajo'||vista==='historial')refrescar();
    }
  });
  $('nueva').addEventListener('click',()=>abrir());
  $('cerrar-editor').addEventListener('click',()=>{if(confirmarSalida()){volverVista();$('nueva').focus();}});
  for(const id of ['modo-tablero','modo-lista']) $(id).addEventListener('click',()=>{modo=id==='modo-lista'?'lista':'tablero';$('modo-tablero').setAttribute('aria-pressed',String(modo==='tablero'));$('modo-lista').setAttribute('aria-pressed',String(modo==='lista'));pintar();});
  $('limpiar-filtros').addEventListener('click',()=>{for(const id of ['buscar','filtro-area','filtro-tipo','filtro-prioridad','filtro-responsable'])$(id).value='';$('archivadas').checked=false;pintar();});
  $('actualizar').addEventListener('click',()=>vista==='dashboard'&&$('editor').hidden?FCDashboard.actualizar():refrescar());
  for(const id of ['buscar','filtro-area','filtro-tipo','filtro-prioridad','filtro-responsable','archivadas']) $(id).addEventListener(id==='buscar'?'input':'change',pintar);
  $('salir').addEventListener('click',async()=>{if(confirmarSalida()){FCDashboard.detener();await sb.auth.signOut({scope:'local'});location.reload();}});
  window.addEventListener('beforeunload',(e)=>{if(operacionesActivas||subiendoArchivos||hayCambios()){e.preventDefault();e.returnValue='';}});
  $('exportar').addEventListener('click',()=>{
    const contenido=JSON.stringify({plataforma:'FUNCECAIND',exportado_en:new Date().toISOString(),solicitudes:filtradas(),historial:eventos.filter((e)=>filtradas().some((s)=>s.id===e.solicitud_id))},null,2);
    const url=URL.createObjectURL(new Blob([contenido],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cambios-funcecaind-'+new Date().toISOString().slice(0,10)+'.json';
    a.hidden=true;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  });
  sb?.auth.onAuthStateChange((evento)=>{if(evento==='SIGNED_OUT'&&usuario)location.reload();});
  if(!sb) $('entrada-error').textContent='No se pudo conectar el panel. Actualiza la página e inténtalo de nuevo.';
  else sb.auth.getSession().then(async(r)=>{ if(r.data.session) { try {await abrirPanel(r.data.session);} catch(e){$('entrada-error').textContent=e.message==='no-admin'?'Este panel es exclusivo del equipo de cambios de FUNCECAIND.':'No se pudo cargar el panel. Revisa la conexión e inténtalo de nuevo.';} } });
})();
