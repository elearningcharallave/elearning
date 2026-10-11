-- Pruebas de integridad y permisos. Todo se revierte al finalizar.
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.perfiles
  where rol='admin' and coalesce(activo,true) order by creado_en limit 1), true);
set local role authenticated;
do $$
declare solicitud uuid; autor uuid := auth.uid(); sello timestamptz; contador int;
begin
  insert into public.cambios_solicitudes(titulo,estado,creada_por,creada_en)
    values('VERIFICACION TRANSACCIONAL','hecha',gen_random_uuid(),'2000-01-01') returning id into solicitud;
  if not exists(select 1 from public.cambios_solicitudes where id=solicitud
    and estado='pendiente' and creada_por=autor and creada_en>'2026-01-01') then
    raise exception 'Fallo: sellos o estado inicial falsificables';
  end if;
  update public.cambios_solicitudes set estado='haciendo' where id=solicitud;
  update public.cambios_solicitudes set estado='hecha' where id=solicitud;
  if not exists(select 1 from public.cambios_solicitudes where id=solicitud
    and hecha_por=autor and hecha_en is not null) then raise exception 'Fallo: cierre sin sello'; end if;
  update public.cambios_solicitudes set estado='pendiente' where id=solicitud;
  if not exists(select 1 from public.cambios_solicitudes where id=solicitud
    and hecha_por is null and hecha_en is null) then raise exception 'Fallo: reapertura'; end if;
  insert into public.cambios_comentarios(solicitud_id,cuerpo,autor_id,creado_en)
    values(solicitud,'Comentario de prueba',gen_random_uuid(),'2000-01-01');
  if not exists(select 1 from public.cambios_comentarios where solicitud_id=solicitud
    and autor_id=autor and creado_en>'2026-01-01') then raise exception 'Fallo: autor del comentario'; end if;
  select count(*) into contador from public.cambios_eventos where solicitud_id=solicitud;
  if contador<>4 then raise exception 'Fallo: historial, eventos=%', contador; end if;
  begin
    insert into public.cambios_eventos(solicitud_id,tipo) values(solicitud,'falso');
    raise exception 'Fallo: historial escribible';
  exception when insufficient_privilege then null; end;
  begin
    update public.cambios_solicitudes set creada_por=gen_random_uuid() where id=solicitud;
    raise exception 'Fallo: autoria editable';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.cambios_solicitudes where id=solicitud;
    raise exception 'Fallo: borrado irreversible permitido';
  exception when insufficient_privilege then null; end;
  update public.cambios_solicitudes set archivada=true where id=solicitud;
  update public.cambios_solicitudes set archivada=false where id=solicitud;
  select actualizada_en into sello from public.cambios_solicitudes where id=solicitud;
  update public.cambios_solicitudes set titulo='Primera edicion' where id=solicitud and actualizada_en=sello;
  update public.cambios_solicitudes set titulo='Edicion obsoleta' where id=solicitud and actualizada_en=sello;
  if found then raise exception 'Fallo: edicion obsoleta aceptada'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',coalesce((select id::text from public.perfiles
  where rol='alumno' limit 1),gen_random_uuid()::text),true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.cambios_solicitudes) then raise exception 'Fallo: alumno lee solicitudes'; end if;
  if exists(select 1 from public.cambios_comentarios) then raise exception 'Fallo: alumno lee comentarios'; end if;
  if exists(select 1 from public.cambios_eventos) then raise exception 'Fallo: alumno lee historial'; end if;
  if exists(select 1 from public.cambios_adjuntos) then raise exception 'Fallo: alumno lee adjuntos'; end if;
  if exists(select 1 from public.cambios_equipo()) then raise exception 'Fallo: alumno lee equipo'; end if;
  begin
    insert into public.cambios_solicitudes(titulo) values('Prohibida');
    raise exception 'Fallo: alumno crea solicitud';
  exception when insufficient_privilege then null; when raise_exception then
    if sqlerrm <> 'Solo administradores activos' then raise; end if;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.cambios_solicitudes;
    raise exception 'Fallo: acceso anonimo';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'OK: estados, autoria, historial, reapertura, archivo reversible, concurrencia y aislamiento de alumnos/anonimos' as resultado;
rollback;
