-- Monitor operacional: conteos globales, sin datos personales ni respuestas academicas.
begin;
alter table public.cursos add column if not exists archivado boolean not null default false;
create table if not exists public.dashboard_eventos (
  id bigint generated always as identity primary key,
  tabla text not null,
  operacion text not null check(operacion in ('INSERT','UPDATE','DELETE','PRESENCIA')),
  ocurrido_en timestamptz not null default now()
);
create index if not exists dashboard_eventos_fecha on public.dashboard_eventos(ocurrido_en desc);
alter table public.dashboard_eventos enable row level security;
revoke all on public.dashboard_eventos from anon,authenticated;
grant select on public.dashboard_eventos to authenticated;
drop policy if exists dashboard_equipo on public.dashboard_eventos;
create policy dashboard_equipo on public.dashboard_eventos for select to authenticated using(public.cambios_es_admin());

create table if not exists public.dashboard_presencia (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  pagina text not null,
  visto_en timestamptz not null default now()
);
alter table public.dashboard_presencia enable row level security;
revoke all on public.dashboard_presencia from anon,authenticated;

create or replace function public.dashboard_anotar()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' then
    if new is not distinct from old then return new; end if;
    -- Los latidos de asistencia no saturan el registro de actividad.
    if tg_table_name='asistencia' and (to_jsonb(new)->'salio_at') is not distinct from (to_jsonb(old)->'salio_at') then return new; end if;
  end if;
  insert into public.dashboard_eventos(tabla,operacion) values(tg_table_name,tg_op);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.dashboard_anotar() from public;
do $$ declare t text; begin
  foreach t in array array['perfiles','cursos','modulos','lecciones','matriculas','clases','asistencia','materiales','tareas','entregas','evaluaciones','preguntas','intentos','resultados','certificados','foro_mensajes','learning_events','cambios_solicitudes','cambios_comentarios','cambios_adjuntos'] loop
    execute format('drop trigger if exists dashboard_actividad on public.%I',t);
    execute format('create trigger dashboard_actividad after insert or update or delete on public.%I for each row execute function public.dashboard_anotar()',t);
  end loop;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dashboard_eventos') then
    alter publication supabase_realtime add table public.dashboard_eventos;
  end if;
end $$;

create or replace function public.dashboard_latido(p_pagina text)
returns void language plpgsql security definer set search_path=public as $$
declare anterior public.dashboard_presencia;
begin
  if auth.uid() is null or not exists(select 1 from public.perfiles where id=auth.uid() and activo) then raise exception 'No autorizado' using errcode='42501'; end if;
  if p_pagina not in ('admin.html','alumno.html','analitica.html','aula.html','cambios.html','catalogo-2026.html','certificado.html','control-calidad.html','curso.html','cursos.html','evaluacion.html','foro.html','index.html','login.html','pensum-fp-emp.html','privacidad.html','profesor.html','resena-historica.html','reset.html','tarea.html','verificar.html') then raise exception 'Pagina no valida' using errcode='22023'; end if;
  select * into anterior from public.dashboard_presencia where usuario_id=auth.uid();
  if anterior.pagina=p_pagina and anterior.visto_en>now()-interval '20 seconds' then return; end if;
  insert into public.dashboard_presencia(usuario_id,pagina,visto_en) values(auth.uid(),p_pagina,now())
    on conflict(usuario_id) do update set pagina=excluded.pagina,visto_en=excluded.visto_en;
  if anterior.usuario_id is null or anterior.pagina is distinct from p_pagina or anterior.visto_en < now()-interval '90 seconds' then
    insert into public.dashboard_eventos(tabla,operacion) values('presencia','PRESENCIA');
  end if;
end $$;
revoke all on function public.dashboard_latido(text) from public,anon;
grant execute on function public.dashboard_latido(text) to authenticated;

create or replace function public.dashboard_resumen()
returns jsonb language plpgsql security definer set search_path=public as $$
declare salida jsonb;
begin
  if not public.cambios_es_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
  select jsonb_build_object(
    'generado_en',now(),
    'usuarios',(select jsonb_build_object('total',count(*),'alumnos',count(*) filter(where rol='alumno'),'profesores',count(*) filter(where rol='profesor'),'administradores',count(*) filter(where rol='admin'),'inactivos',count(*) filter(where not activo),'nuevos_7d',count(*) filter(where creado_en>=now()-interval '7 days')) from perfiles),
    'academico',jsonb_build_object(
      'cursos',(select count(*) from cursos where not archivado),'archivados',(select count(*) from cursos where archivado),'publicados',(select count(*) from cursos where publicado and not archivado),'borradores',(select count(*) from cursos where not publicado and not archivado),
      'matriculas',(select count(*) from matriculas),'modulos',(select count(*) from modulos),'lecciones',(select count(*) from lecciones),
      'clases',(select count(*) from clases),'materiales',(select count(*) from materiales),'tareas',(select count(*) from tareas),
      'entregas',(select count(*) from entregas),'sin_calificar',(select count(*) from entregas e join tareas t on t.id=e.tarea_id join cursos c on c.id=t.curso_id where e.nota is null and not c.archivado),
      'tareas_vencidas',(select count(*) from tareas t join cursos c on c.id=t.curso_id where not c.archivado and t.fecha_limite < (now() at time zone 'America/Caracas')::date),
      'evaluaciones',(select count(*) from evaluaciones),'preguntas',(select count(*) from preguntas),'intentos',(select count(*) from intentos),
      'intentos_enviados',(select count(*) from intentos where enviado_en is not null),'resultados',(select count(*) from resultados),
      'certificados',(select count(*) from certificados),'mensajes',(select count(*) from foro_mensajes),'eventos_aprendizaje',(select count(*) from learning_events),
      'en_clases',(select count(distinct alumno_id) from asistencia where salio_at is null and visto_at>now()-interval '90 seconds')),
    'cambios',(select jsonb_build_object('total',count(*),'pendientes',count(*) filter(where estado='pendiente' and not archivada),'haciendo',count(*) filter(where estado='haciendo' and not archivada),'hechas',count(*) filter(where estado='hecha' and not archivada),'altas',count(*) filter(where prioridad='alta' and estado<>'hecha' and not archivada),'sin_responsable',count(*) filter(where asignada_a is null and estado<>'hecha' and not archivada)) from cambios_solicitudes),
    'archivos_cambios',(select jsonb_build_object('total',count(*),'bytes',coalesce(sum(tamano),0)) from cambios_adjuntos),
    'presencia',jsonb_build_object('activas',(select count(*) from dashboard_presencia d join perfiles p on p.id=d.usuario_id where p.activo and d.visto_en>now()-interval '90 seconds'),
      'paginas',coalesce((select jsonb_agg(x) from(select d.pagina,count(*) cuentas from dashboard_presencia d join perfiles p on p.id=d.usuario_id where p.activo and d.visto_en>now()-interval '90 seconds' group by d.pagina order by count(*) desc,d.pagina)x),'[]'::jsonb)),
    'actividad',coalesce((select jsonb_agg(x) from (select id,tabla,operacion,ocurrido_en from dashboard_eventos order by id desc limit 40)x),'[]'::jsonb)
  ) into salida;
  return salida;
end $$;
revoke all on function public.dashboard_resumen() from public,anon;
grant execute on function public.dashboard_resumen() to authenticated;
commit;
