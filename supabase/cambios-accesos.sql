-- Cuentas reales autorizadas por Carlos para el taller; no cambia el rol del aula.
begin;
do $$ begin
  if (select count(*) from public.perfiles where lower(email) in
    ('carlos.linares.es@gmail.com','jahulin@gmail.com') and coalesce(activo,true)) <> 2 then
    raise exception 'Deben existir las dos cuentas activas antes de habilitar el taller';
  end if;
end $$;
insert into public.cambios_equipo_accesos(usuario_id,activo)
select id,true from public.perfiles
where lower(email) in ('carlos.linares.es@gmail.com','jahulin@gmail.com')
on conflict(usuario_id) do update set activo=true;
commit;
