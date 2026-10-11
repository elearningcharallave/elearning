-- Comprobaciones de datos y aislamiento. No persiste registros de prueba.
begin;
select set_config('request.jwt.claim.sub','79c05548-73ca-42cb-bdd1-4819d036d162',true);
do $$ declare d jsonb; begin
  d:=public.dashboard_resumen();
  if (d#>>'{usuarios,total}')::bigint<>(select count(*) from public.perfiles)
    or (d#>>'{academico,matriculas}')::bigint<>(select count(*) from public.matriculas)
    or (d#>>'{academico,sin_calificar}')::bigint<>(select count(*) from public.entregas where nota is null)
    or (d#>>'{academico,certificados}')::bigint<>(select count(*) from public.certificados)
    or (d#>>'{cambios,total}')::bigint<>(select count(*) from public.cambios_solicitudes)
    then raise exception 'Totales incorrectos'; end if;
  if d::text ~ '"(email|nombre|cedula|telefono|respuestas|alumno_id|usuario_id)"' then raise exception 'Datos personales expuestos'; end if;
end $$;
set local role authenticated;
do $$ declare id_prueba uuid; antes bigint; d jsonb; begin
  select count(*) into antes from public.dashboard_eventos;
  insert into public.cambios_solicitudes(titulo) values('DASHBOARD TRANSACCIONAL') returning id into id_prueba;
  if (select count(*) from public.dashboard_eventos)<>antes+1 then raise exception 'Actividad no registrada'; end if;
  d:=public.dashboard_resumen();
  if d#>>'{actividad,0,tabla}'<>'cambios_solicitudes' then raise exception 'Actividad no incluida en resumen'; end if;
  perform public.dashboard_latido('cambios.html');
  if (public.dashboard_resumen()#>>'{presencia,activas}')::int<1 then raise exception 'Presencia ausente'; end if;
  begin
    perform public.dashboard_latido('curso.html?email=privado'); raise exception 'Ruta privada aceptada';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.dashboard_eventos(tabla,operacion) values('falso','INSERT'); raise exception 'Evento falsificable';
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into antes from public.dashboard_presencia; raise exception 'Presencia individual expuesta';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select p.id::text from public.perfiles p where p.activo and not exists(select 1 from public.cambios_equipo_accesos e where e.usuario_id=p.id and e.activo) limit 1),true);
set local role authenticated;
do $$ declare n bigint; begin
  begin perform public.dashboard_resumen(); raise exception 'Resumen accesible fuera del equipo'; exception when insufficient_privilege then null; end;
  select count(*) into n from public.dashboard_eventos;
  if n<>0 then raise exception 'Eventos accesibles fuera del equipo'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  begin perform public.dashboard_resumen(); raise exception 'Resumen anonimo'; exception when insufficient_privilege then null; end;
  begin perform public.dashboard_latido('index.html'); raise exception 'Presencia anonima'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
