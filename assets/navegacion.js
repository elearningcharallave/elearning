/* Conserva las mismas rutas y ofrece el menu completo tambien en el movil. */
(() => {
  const lista = document.querySelector('nav > .nav-links');
  const menu = lista || document.querySelector('.topbar > nav.nav');
  if (!menu) return;
  const cabecera = menu.parentElement;
  cabecera.classList.add('navegacion-cabecera');
  menu.classList.add('navegacion-enlaces');
  menu.id ||= 'navegacion-principal';
  menu.setAttribute('aria-label', 'Navegación principal');
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'alternar-navegacion';
  boton.setAttribute('aria-controls', menu.id);
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-label', 'Abrir menú de navegación');
  boton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  function abrir(activo) {
    cabecera.dataset.abierta = activo ? 'si' : 'no';
    boton.setAttribute('aria-expanded', String(activo));
    boton.setAttribute('aria-label', activo ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
  }
  boton.addEventListener('click', () => abrir(boton.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', evento => { if (evento.target.closest('a')) abrir(false); });
  document.addEventListener('keydown', evento => { if (evento.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') { abrir(false); boton.focus(); } });
  document.addEventListener('click', evento => { if (!cabecera.contains(evento.target)) abrir(false); });
  matchMedia('(min-width:901px)').addEventListener('change', () => abrir(false));
  cabecera.append(boton);
})();
