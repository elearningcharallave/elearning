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
  const TIPOS = { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', txt:'text/plain',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const sb = FV.sb;
  let usuario, equipo = [], solicitudes = [], eventos = [], actual = null, vista = 'trabajo';
  let cargando = false, versionHilo = 0;
  const fecha = (valor) => valor ? new Date(valor).toLocaleString('es-VE', { dateStyle:'medium', timeStyle:'short' }) : '';
  const persona = (id) => equipo.find((p) => p.id === id)?.nombre || (id ? 'Administrador' : 'Sin asignar');
  function aviso(texto, error) { $('aviso').textContent = texto; $('aviso').className = 'aviso' + (error ? ' error' : ''); }
  function fallo(error) {
    console.error('Panel de cambios:', error?.code || error?.name || 'consulta');
    aviso(error?.code === '42501' ? 'Tu cuenta no tiene permiso para esta acción. Vuelve a entrar con una cuenta de administrador.'
      : 'No se pudo completar la acción. Revisa la conexión y vuelve a intentarlo; el formulario conserva lo que escribiste.', true);
  }
  async function consulta(promesa) { const r = await promesa; if (r.error) throw r.error; return r.data; }
  async function todas(tabla, orden) {
    const filas = [];
    for (let desde = 0; ; desde += 500) {
      const parte = await consulta(sb.from(tabla).select('*').order(orden, { ascending:false }).order('id').range(desde, desde+499));
      filas.push(...parte); if (parte.length < 500) return filas;
    }
  }
  async function ocupada(formulario, accion) {
    const botones = [...formulario.querySelectorAll('button')]; botones.forEach((b) => b.disabled = true);
    try { await accion(); } catch (e) { fallo(e); }
    finally { botones.forEach((b) => b.disabled = false); }
  }
  function opciones() {
    const areas = Object.entries(AREAS).map(([id,[nombre]]) => `<option value="${id}">${nombre}</option>`).join('');
    $('filtro-area').insertAdjacentHTML('beforeend', areas); $('solicitud-area').innerHTML = areas;
    const personas = equipo.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre || 'Administrador')}</option>`).join('');
    $('filtro-responsable').insertAdjacentHTML('beforeend',personas);
    $('solicitud-responsable').insertAdjacentHTML('beforeend',personas);
  }
  async function abrirPanel(sesion) {
    if (!sesion) return;
    const perfil = await consulta(sb.from('perfiles').select('id,nombre,rol,activo').eq('id',sesion.user.id).single());
    if (perfil.rol !== 'admin' || perfil.activo === false) {
      await sb.auth.signOut(); throw new Error('no-admin');
    }
    usuario = perfil;
    equipo = await consulta(sb.rpc('cambios_equipo'));
    opciones(); $('nombre-usuario').textContent = perfil.nombre || 'Administrador';
    $('entrada').hidden = true; $('panel').hidden = false;
    await refrescar();
  }
  async function refrescar() {
    if (cargando) return;
    cargando = true; $('actualizar').disabled = true; aviso('Actualizando solicitudes…');
    try {
      [solicitudes,eventos] = await Promise.all([todas('cambios_solicitudes','creada_en'), todas('cambios_eventos','creado_en')]);
      pintar(); aviso('Actualizado a las ' + new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}));
    } catch (e) { fallo(e); } finally { cargando = false; $('actualizar').disabled = false; }
  }
  function filtradas() {
    const texto = $('buscar').value.trim().toLocaleLowerCase('es');
    const responsable = $('filtro-responsable').value;
    return solicitudes.filter((s) => s.archivada === $('archivadas').checked
      && (!$('filtro-area').value || s.area === $('filtro-area').value)
      && (!$('filtro-prioridad').value || s.prioridad === $('filtro-prioridad').value)
      && (!responsable || (responsable === 'sin' ? !s.asignada_a : s.asignada_a === responsable))
      && (!texto || (s.titulo + ' ' + s.detalle).toLocaleLowerCase('es').includes(texto)));
  }
  function pintar() {
    const lista = filtradas(), abiertas = solicitudes.filter((s) => !s.archivada);
    $('resumen').innerHTML = `<span><strong>${abiertas.length}</strong> solicitudes</span>` + Object.entries(ESTADOS).map(([id,n]) =>
      `<span><strong>${abiertas.filter((s) => s.estado===id).length}</strong> ${n.toLowerCase()}</span>`).join('') +
      `<span><strong>${abiertas.filter((s) => s.prioridad==='alta' && s.estado!=='hecha').length}</strong> de prioridad alta</span>`;
    $('tablero').innerHTML = Object.entries(ESTADOS).map(([id,nombre]) => {
      const grupo = lista.filter((s) => s.estado===id).sort((a,b) => id==='hecha'
        ? String(b.hecha_en).localeCompare(String(a.hecha_en))
        : (b.prioridad==='alta')-(a.prioridad==='alta') || a.creada_en.localeCompare(b.creada_en));
      return `<section class="columna"><h2>${nombre}<span>${grupo.length}</span></h2>` + (grupo.length ? grupo.map((s) =>
        `<button class="solicitud" data-abrir="${s.id}"><div class="meta"><span>${esc(AREAS[s.area]?.[0] || s.area)}</span>${s.prioridad==='alta'?'<span class="etiqueta alta">Alta prioridad</span>':''}</div><strong>${esc(s.titulo)}</strong><p>${esc(s.detalle.slice(0,170))}${s.detalle.length>170?'…':''}</p><div class="meta"><span>${esc(persona(s.asignada_a))}</span><span>${fecha(id==='hecha'?s.hecha_en:s.creada_en)}</span></div>${s.archivada?'<span class="etiqueta">Archivada</span>':''}</button>`).join('')
        : `<p class="vacio">${lista.length ? 'Sin solicitudes en este estado.' : (solicitudes.length ? 'No hay solicitudes que coincidan con estos filtros.' : 'Aún no hay solicitudes. Crea la primera con «Nueva solicitud».')}</p>`) + '</section>';
    }).join('');
    $('historial-general').innerHTML = eventos.length ? eventos.map((e) => eventoHtml(e,true)).join('') : '<p class="vacio">Aquí aparecerá el historial cuando se registre la primera solicitud.</p>';
    $('mapa').innerHTML = Object.entries(AREAS).map(([id,[n,d,ruta]]) => `<article class="area-fila"><h2>${n}</h2><p>${d}<br><strong>${abiertas.filter((s)=>s.area===id&&s.estado!=='hecha').length}</strong> solicitudes sin terminar</p><a href="https://elearningcharallave.github.io/elearning/${ruta}" target="_blank" rel="noopener">Abrir en la plataforma ↗</a></article>`).join('');
  }
  function eventoHtml(e, conSolicitud) {
    const s = solicitudes.find((t)=>t.id===e.solicitud_id);
    let texto = 'Creó la solicitud';
    if (e.antes) {
      const cambios = [];
      if (e.antes.estado !== e.despues.estado) cambios.push(`${ESTADOS[e.antes.estado]} → ${ESTADOS[e.despues.estado]}`);
      if (e.antes.archivada !== e.despues.archivada) cambios.push(e.despues.archivada ? 'Archivó la solicitud' : 'Restauró la solicitud');
      if (e.antes.asignada_a !== e.despues.asignada_a) cambios.push('Responsable: ' + persona(e.despues.asignada_a));
      for (const [clave,nombre] of [['titulo','Título'],['detalle','Descripción'],['area','Área'],['prioridad','Prioridad']]) {
        if (e.antes[clave] !== e.despues[clave]) cambios.push(nombre + ' actualizado');
      }
      texto = cambios.join(' · ') || 'Actualizó la solicitud';
    }
    return `<article class="evento"><small>${esc(persona(e.autor_id))} · ${fecha(e.creado_en)}</small>${conSolicitud?`<p><button data-abrir="${e.solicitud_id}">${esc(s?.titulo || e.despues?.titulo || 'Solicitud')}</button></p>`:''}<p>${esc(texto)}</p></article>`;
  }
  async function abrir(id) {
    actual = id ? solicitudes.find((s)=>s.id===id) : null;
    if (id && !actual) { aviso('Actualiza la lista para abrir esta solicitud.',true); return; }
    ++versionHilo;
    $('editor').hidden = false; $('titulo-editor').textContent = actual ? 'Seguimiento de la solicitud' : 'Nueva solicitud';
    $('solicitud-id').value = actual?.id || ''; $('solicitud-titulo').value = actual?.titulo || '';
    $('solicitud-detalle').value = actual?.detalle || ''; $('solicitud-area').value = actual?.area || 'general';
    $('solicitud-prioridad').value = actual?.prioridad || 'normal'; $('solicitud-responsable').value = actual?.asignada_a || '';
    $('solicitud-estado').value = actual?.estado || 'pendiente'; $('campo-estado').hidden = !actual;
    $('archivar').hidden = !actual; $('archivar').textContent = actual?.archivada ? 'Restaurar solicitud' : 'Archivar solicitud';
    $('seguimiento').hidden = !actual; $('comentario').value = ''; $('archivo').value = '';
    $('editor').scrollIntoView({block:'start'}); $('solicitud-titulo').focus({preventScroll:true});
    if (actual) await hilo(actual.id);
  }
  async function hilo(id) {
    const version = ++versionHilo;
    $('comentarios').innerHTML = '<p class="nota">Cargando comentarios…</p>';
    $('adjuntos').innerHTML = '<p class="nota">Cargando archivos…</p>';
    try {
      const [comentarios,adjuntos,historia] = await Promise.all([
        consulta(sb.from('cambios_comentarios').select('*').eq('solicitud_id',id).order('creado_en')),
        consulta(sb.from('cambios_adjuntos').select('*').eq('solicitud_id',id).order('creado_en')),
        consulta(sb.from('cambios_eventos').select('*').eq('solicitud_id',id).order('creado_en',{ascending:false}))
      ]);
      if (version!==versionHilo || actual?.id!==id) return;
      $('comentarios').innerHTML = comentarios.length ? comentarios.map((c)=>`<article class="aporte"><small>${esc(persona(c.autor_id))} · ${fecha(c.creado_en)}</small><p>${esc(c.cuerpo)}</p></article>`).join('') : '<p class="nota">Aún no hay comentarios.</p>';
      $('adjuntos').innerHTML = adjuntos.length ? adjuntos.map((a)=>`<article class="aporte"><button data-archivo="${esc(a.ruta)}">${esc(a.nombre)}</button><p class="nota">${Math.max(1,Math.ceil(a.tamano/1024)).toLocaleString('es-VE')} KB · ${esc(persona(a.autor_id))}</p></article>`).join('') : '<p class="nota">No hay archivos adjuntos.</p>';
      $('historial-solicitud').innerHTML = historia.map((e)=>eventoHtml(e,false)).join('');
    } catch(e) { fallo(e); }
  }
  $('form-entrada').addEventListener('submit',(e)=>{
    e.preventDefault(); $('entrada-error').textContent='';
    ocupada(e.currentTarget,async()=>{
      const r=await sb.auth.signInWithPassword({email:$('correo').value.trim(),password:$('clave').value});
      if(r.error) { $('entrada-error').textContent='No pudimos iniciar sesión. Revisa tu correo y contraseña.'; return; }
      try { await abrirPanel(r.data.session); $('clave').value=''; }
      catch(error) { $('entrada-error').textContent='Este panel es exclusivo de los administradores activos de FUNCECAIND.'; }
    });
  });
  $('form-solicitud').addEventListener('submit',(e)=>{
    e.preventDefault(); ocupada(e.currentTarget,async()=>{
      const titulo=$('solicitud-titulo').value.trim(); if(!titulo) { aviso('Escribe un título para la solicitud.',true); return; }
      const datos={titulo,detalle:$('solicitud-detalle').value.trim(),area:$('solicitud-area').value,prioridad:$('solicitud-prioridad').value,asignada_a:$('solicitud-responsable').value||null};
      let guardada;
      if(actual) {
        datos.estado=$('solicitud-estado').value;
        const filas=await consulta(sb.from('cambios_solicitudes').update(datos).eq('id',actual.id).eq('actualizada_en',actual.actualizada_en).select());
        if(!filas.length) { aviso('Otra persona modificó esta solicitud. Actualiza y vuelve a abrirla antes de guardar.',true); return; }
        guardada=filas[0];
      } else guardada=await consulta(sb.from('cambios_solicitudes').insert(datos).select().single());
      await refrescar(); await abrir(guardada.id); aviso('Solicitud guardada.');
    });
  });
  $('archivar').addEventListener('click',()=>ocupada($('form-solicitud'),async()=>{
    if(!actual) return;
    const id=actual.id, filas=await consulta(sb.from('cambios_solicitudes').update({archivada:!actual.archivada}).eq('id',id).eq('actualizada_en',actual.actualizada_en).select());
    if(!filas.length) { aviso('La solicitud cambió. Actualiza y vuelve a abrirla.',true); return; }
    await refrescar(); await abrir(id); aviso(filas[0].archivada?'Solicitud archivada. Puedes restaurarla desde «Ver archivadas».':'Solicitud restaurada.');
  }));
  $('form-comentario').addEventListener('submit',(e)=>{
    e.preventDefault(); ocupada(e.currentTarget,async()=>{
      if(!actual) return; const id=actual.id,cuerpo=$('comentario').value.trim(); if(!cuerpo) return;
      await consulta(sb.from('cambios_comentarios').insert({solicitud_id:id,cuerpo,autor_id:usuario.id}));
      $('comentario').value=''; await hilo(id); aviso('Comentario publicado.');
    });
  });
  $('form-adjunto').addEventListener('submit',(e)=>{
    e.preventDefault(); ocupada(e.currentTarget,async()=>{
      if(!actual) return; const id=actual.id,file=$('archivo').files[0]; if(!file) return;
      const extension=file.name.split('.').pop().toLowerCase(),tipo=TIPOS[extension];
      if(!tipo||!file.size||file.size>15728640) { aviso('Elige un archivo permitido de hasta 15 MB.',true); return; }
      const ruta=id+'/'+crypto.randomUUID()+'.'+extension;
      await consulta(sb.storage.from('cambios-funcecaind').upload(ruta,file,{contentType:tipo,upsert:false}));
      try { await consulta(sb.from('cambios_adjuntos').insert({solicitud_id:id,nombre:file.name.slice(0,250),ruta,tamano:file.size,autor_id:usuario.id})); }
      catch(error) { await sb.storage.from('cambios-funcecaind').remove([ruta]); throw error; }
      $('archivo').value=''; await hilo(id); aviso('Archivo adjuntado. Solo el equipo administrador puede abrirlo.');
    });
  });
  document.addEventListener('click',async(e)=>{
    const abrirBoton=e.target.closest('[data-abrir]'); if(abrirBoton) { await abrir(abrirBoton.dataset.abrir); return; }
    const archivo=e.target.closest('[data-archivo]'); if(archivo) {
      archivo.disabled=true;
      try {
        const blob=await consulta(sb.storage.from('cambios-funcecaind').download(archivo.dataset.archivo));
        const link=document.createElement('a'),url=URL.createObjectURL(blob); link.href=url; link.download=archivo.textContent;
        link.hidden=true; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      } catch(error){fallo(error);} finally{archivo.disabled=false;}
    }
    const nav=e.target.closest('[data-vista]'); if(nav) {
      vista=nav.dataset.vista; document.querySelectorAll('[data-vista]').forEach((b)=>b.setAttribute('aria-current',b===nav?'page':'false'));
      for(const v of ['trabajo','historial','mapa']) $('vista-'+v).hidden=v!==vista;
      $('editor').hidden=true; actual=null; ++versionHilo;
      $('titulo-vista').textContent={trabajo:'Solicitudes de cambios',historial:'Historial de cambios',mapa:'Áreas de la plataforma'}[vista];
      $('subtitulo-vista').textContent={trabajo:'Lo que hace falta, lo que está en marcha y lo que ya quedó listo.',historial:'Cada cambio conserva quién lo hizo y cuándo.',mapa:'Organiza las mejoras según la parte del aula a la que pertenecen.'}[vista];
    }
  });
  $('nueva').addEventListener('click',()=>abrir());
  $('cerrar-editor').addEventListener('click',()=>{ $('editor').hidden=true; actual=null; ++versionHilo; $('nueva').focus(); });
  $('actualizar').addEventListener('click',refrescar);
  for(const id of ['buscar','filtro-area','filtro-prioridad','filtro-responsable','archivadas']) $(id).addEventListener(id==='buscar'?'input':'change',pintar);
  $('salir').addEventListener('click',async()=>{ await sb.auth.signOut(); location.reload(); });
  $('exportar').addEventListener('click',()=>{
    const contenido=JSON.stringify({plataforma:'FUNCECAIND',exportado_en:new Date().toISOString(),solicitudes:filtradas(),historial:eventos.filter((e)=>filtradas().some((s)=>s.id===e.solicitud_id))},null,2);
    const url=URL.createObjectURL(new Blob([contenido],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cambios-funcecaind-'+new Date().toISOString().slice(0,10)+'.json';
    a.hidden=true;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  });
  sb?.auth.onAuthStateChange((evento)=>{if(evento==='SIGNED_OUT'&&usuario)location.reload();});
  if(!sb) $('entrada-error').textContent='No se pudo conectar el panel. Actualiza la página e inténtalo de nuevo.';
  else sb.auth.getSession().then(async(r)=>{ if(r.data.session) { try {await abrirPanel(r.data.session);} catch(e){$('entrada-error').textContent='Este panel es exclusivo de los administradores activos de FUNCECAIND.';} } });
})();
