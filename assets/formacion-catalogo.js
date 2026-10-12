(function(){
  'use strict';
  const buscar=document.getElementById('buscar-formacion'),tipo=document.getElementById('tipo-formacion'),area=document.getElementById('area-formacion');
  const normalizar=(s)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es');
  function filtrar(){let n=0;const texto=normalizar(buscar.value.trim());
    document.querySelectorAll('[data-oferta]').forEach(e=>{e.hidden=!( (!tipo.value||e.dataset.tipo===tipo.value)&&(!area.value||e.dataset.area===area.value)&&(!texto||normalizar(e.textContent+' '+e.dataset.area).includes(texto)));if(!e.hidden)++n;});
    document.querySelectorAll('[data-grupo]').forEach(e=>{e.hidden=![...e.querySelectorAll('[data-oferta]')].some(o=>!o.hidden);});
    document.getElementById('resultado-formacion').textContent=n?`${n} ${n===1?'oferta de formación':'ofertas de formación'}`:'No hay ofertas con estos filtros.';
  }
  buscar.addEventListener('input',filtrar);tipo.addEventListener('change',filtrar);area.addEventListener('change',filtrar);
})();
