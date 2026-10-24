(function(){
  'use strict';
  document.querySelectorAll('input[type="password"]').forEach(function(input){
    var cont=document.createElement('div');cont.className='clave-control';
    input.parentNode.insertBefore(cont,input);cont.append(input);
    var boton=document.createElement('button');boton.type='button';boton.className='btn btn-ghost btn-sm';boton.textContent='Mostrar';boton.setAttribute('aria-controls',input.id);boton.setAttribute('aria-label','Mostrar contraseña');boton.setAttribute('aria-pressed','false');
    boton.addEventListener('click',function(){var visible=input.type==='password';input.type=visible?'text':'password';boton.textContent=visible?'Ocultar':'Mostrar';boton.setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');boton.setAttribute('aria-pressed',String(visible));});
    cont.append(boton);
  });
})();
