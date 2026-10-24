(function () {
  'use strict';
  function enlaceSeguro(valor) { try { var u=new URL(valor);return /^https?:$/.test(u.protocol)?u.href:''; } catch (_) { return ''; } }
  function texto(tag, contenido) { var e=document.createElement(tag);e.textContent=contenido||'';return e; }
  async function cargar() {
    if(!window.FV || !FV.configOk()) return;
    var equipo=document.getElementById('equipo-publico'),cursos=document.getElementById('cursos-publicos');
    if(equipo) {
      var r=await FV.sb.from('equipo_publico').select('*').order('orden_equipo').order('nombre');
      equipo.replaceChildren();
      if(r.error) equipo.append(texto('p','No se pudo cargar el equipo. Intenta de nuevo más tarde.'));
      else if(!r.data.length) equipo.append(texto('p','Próximamente conocerás a nuestro equipo.'));
      else r.data.forEach(function(p){var a=document.createElement('article');a.className='perfil-publico';var url=enlaceSeguro(p.foto_url);if(url){var img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';a.append(img);}a.append(texto('h3',p.nombre),texto('p',p.cargo||(p.rol==='admin'?'Administración':'Docente')),texto('p',p.bio));equipo.append(a);});
    }
    if(cursos) {
      var campo=cursos.dataset.ubicacion==='inicio'?'mostrar_inicio':'mostrar_catalogo';
      var q=await FV.sb.from('cursos_publicos').select('*').eq(campo,true).order('titulo');
      cursos.replaceChildren();
      if(q.error) cursos.append(texto('p','No se pudieron cargar los cursos disponibles. Intenta de nuevo más tarde.'));
      else if(!q.data.length) cursos.append(texto('p','Actualmente no hay cursos publicados en este apartado. Consulta la oferta de formación o solicita información.'));
      else q.data.forEach(function(c){var a=document.createElement('article');a.className='curso-publico';a.append(texto('h3',c.titulo),texto('p',c.descripcion),texto('p',[c.codigo_formacion,c.duracion_texto||(c.horas?c.horas+' horas':''),c.modalidad_formacion].filter(Boolean).join(' · ')));var link=texto('a','Entrar al aula');link.href='curso.html?id='+encodeURIComponent(c.id);link.className='btn';a.append(link);cursos.append(a);});
    }
  }
  cargar().catch(function(){document.querySelectorAll('[data-publicacion]').forEach(function(e){e.textContent='No se pudo cargar la información. Intenta de nuevo más tarde.';});});
})();
