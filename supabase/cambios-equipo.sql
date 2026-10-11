-- Administrador de cambios de FUNCECAIND. Migracion aditiva e idempotente.
begin;

-- El equipo del taller no necesita administrar alumnos ni calificaciones.
create table if not exists public.cambios_equipo_accesos (
  usuario_id uuid primary key references public.perfiles(id),
  activo boolean not null default true,
  habilitado_en timestamptz not null default clock_timestamp()
);
alter table public.cambios_equipo_accesos enable row level security;
revoke all on public.cambios_equipo_accesos from anon, authenticated;

create or replace function public.cambios_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p
    join public.cambios_equipo_accesos e on e.usuario_id = p.id
    where p.id = auth.uid() and e.activo and coalesce(p.activo, true));
$$;
revoke all on function public.cambios_es_admin() from public;
grant execute on function public.cambios_es_admin() to authenticated;

create table if not exists public.cambios_solicitudes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  tipo text not null default 'mejora' check (tipo in ('mejora','parte_nueva')),
  detalle text not null default '' check (length(detalle) <= 12000),
  area text not null default 'general' check (area in
    ('general','web','cuentas','cursos','clases','evaluaciones','certificados','comunicacion')),
  estado text not null default 'pendiente' check (estado in ('pendiente','haciendo','hecha')),
  prioridad text not null default 'normal' check (prioridad in ('normal','alta')),
  asignada_a uuid references public.perfiles(id) on delete set null,
  archivada boolean not null default false,
  creada_por uuid references public.perfiles(id) on delete set null,
  hecha_por uuid references public.perfiles(id) on delete set null,
  creada_en timestamptz not null default clock_timestamp(),
  actualizada_en timestamptz not null default clock_timestamp(),
  hecha_en timestamptz
);
alter table public.cambios_solicitudes add column if not exists tipo text not null
  default 'mejora' check (tipo in ('mejora','parte_nueva'));
create table if not exists public.cambios_comentarios (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.cambios_solicitudes(id),
  cuerpo text not null check (length(btrim(cuerpo)) between 1 and 4000),
  autor_id uuid not null references public.perfiles(id),
  creado_en timestamptz not null default clock_timestamp()
);
create table if not exists public.cambios_eventos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.cambios_solicitudes(id),
  autor_id uuid references public.perfiles(id) on delete set null,
  tipo text not null,
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default clock_timestamp()
);
create table if not exists public.cambios_adjuntos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.cambios_solicitudes(id),
  nombre text not null check (length(nombre) between 1 and 250),
  ruta text unique not null,
  tamano bigint not null check (tamano between 1 and 15728640),
  autor_id uuid not null references public.perfiles(id),
  creado_en timestamptz not null default clock_timestamp(),
  constraint cambios_ruta_solicitud check (split_part(ruta, '/', 1) = solicitud_id::text)
);
create index if not exists cambios_solicitudes_estado on public.cambios_solicitudes(archivada, estado, area);
create index if not exists cambios_comentarios_hilo on public.cambios_comentarios(solicitud_id, creado_en);
create index if not exists cambios_eventos_hilo on public.cambios_eventos(solicitud_id, creado_en);
create index if not exists cambios_adjuntos_hilo on public.cambios_adjuntos(solicitud_id, creado_en);

-- Los sellos de autoria y tiempo nunca se aceptan del navegador.
create or replace function public.cambios_sellar_solicitud()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not public.cambios_es_admin() then raise exception 'Solo administradores activos'; end if;
  if new.asignada_a is not null and not exists (select 1 from public.cambios_equipo()
    where id = new.asignada_a) then
    raise exception 'El responsable debe ser administrador activo';
  end if;
  if tg_op = 'INSERT' then
    new.creada_por := auth.uid(); new.creada_en := clock_timestamp();
    new.estado := 'pendiente'; new.archivada := false;
    new.hecha_por := null; new.hecha_en := null;
  else
    new.id := old.id; new.creada_por := old.creada_por; new.creada_en := old.creada_en;
    if new.estado = 'hecha' and old.estado <> 'hecha' then
      new.hecha_por := auth.uid(); new.hecha_en := clock_timestamp();
    elsif new.estado <> 'hecha' then
      new.hecha_por := null; new.hecha_en := null;
    else
      new.hecha_por := old.hecha_por; new.hecha_en := old.hecha_en;
    end if;
  end if;
  new.actualizada_en := clock_timestamp();
  return new;
end;
$$;
create or replace function public.cambios_anotar_evento()
returns trigger language plpgsql security definer set search_path = public as $$
declare antes jsonb; despues jsonb;
begin
  if tg_op = 'UPDATE' then
    antes := jsonb_build_object('titulo',old.titulo,'tipo',old.tipo,'detalle',old.detalle,'area',old.area,
      'estado',old.estado,'prioridad',old.prioridad,'asignada_a',old.asignada_a,'archivada',old.archivada);
  end if;
  despues := jsonb_build_object('titulo',new.titulo,'tipo',new.tipo,'detalle',new.detalle,'area',new.area,
    'estado',new.estado,'prioridad',new.prioridad,'asignada_a',new.asignada_a,'archivada',new.archivada);
  if antes is distinct from despues then
    insert into public.cambios_eventos(solicitud_id, autor_id, tipo, antes, despues)
      values(new.id, auth.uid(), case when tg_op='INSERT' then 'creada' else 'actualizada' end, antes, despues);
  end if;
  return new;
end;
$$;
create or replace function public.cambios_sellar_aporte()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not public.cambios_es_admin() then raise exception 'Solo administradores activos'; end if;
  new.autor_id := auth.uid(); new.creado_en := clock_timestamp();
  if tg_table_name = 'cambios_adjuntos' then
    if not exists (select 1 from storage.objects
      where bucket_id = 'cambios-funcecaind' and name = new.ruta)
      then raise exception 'El archivo no existe'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.cambios_sellar_solicitud(), public.cambios_anotar_evento(), public.cambios_sellar_aporte() from public;
drop trigger if exists cambios_sello on public.cambios_solicitudes;
create trigger cambios_sello before insert or update on public.cambios_solicitudes
  for each row execute function public.cambios_sellar_solicitud();
drop trigger if exists cambios_historial on public.cambios_solicitudes;
create trigger cambios_historial after insert or update on public.cambios_solicitudes
  for each row execute function public.cambios_anotar_evento();
drop trigger if exists cambios_comentario_sello on public.cambios_comentarios;
create trigger cambios_comentario_sello before insert on public.cambios_comentarios
  for each row execute function public.cambios_sellar_aporte();
drop trigger if exists cambios_adjunto_sello on public.cambios_adjuntos;
create trigger cambios_adjunto_sello before insert on public.cambios_adjuntos
  for each row execute function public.cambios_sellar_aporte();

alter table public.cambios_solicitudes enable row level security;
alter table public.cambios_comentarios enable row level security;
alter table public.cambios_eventos enable row level security;
alter table public.cambios_adjuntos enable row level security;
revoke all on public.cambios_solicitudes, public.cambios_comentarios,
  public.cambios_eventos, public.cambios_adjuntos from anon, authenticated;
grant select, insert on public.cambios_solicitudes to authenticated;
grant update(titulo,tipo,detalle,area,estado,prioridad,asignada_a,archivada) on public.cambios_solicitudes to authenticated;
grant select, insert on public.cambios_comentarios, public.cambios_adjuntos to authenticated;
grant select on public.cambios_eventos to authenticated;
drop policy if exists cambios_solicitudes_leer on public.cambios_solicitudes;
create policy cambios_solicitudes_leer on public.cambios_solicitudes for select to authenticated using(public.cambios_es_admin());
drop policy if exists cambios_solicitudes_crear on public.cambios_solicitudes;
create policy cambios_solicitudes_crear on public.cambios_solicitudes for insert to authenticated with check(public.cambios_es_admin());
drop policy if exists cambios_solicitudes_editar on public.cambios_solicitudes;
create policy cambios_solicitudes_editar on public.cambios_solicitudes for update to authenticated using(public.cambios_es_admin()) with check(public.cambios_es_admin());
drop policy if exists cambios_comentarios_leer on public.cambios_comentarios;
create policy cambios_comentarios_leer on public.cambios_comentarios for select to authenticated using(public.cambios_es_admin());
drop policy if exists cambios_comentarios_crear on public.cambios_comentarios;
create policy cambios_comentarios_crear on public.cambios_comentarios for insert to authenticated with check(public.cambios_es_admin() and autor_id=auth.uid());
drop policy if exists cambios_eventos_leer on public.cambios_eventos;
create policy cambios_eventos_leer on public.cambios_eventos for select to authenticated using(public.cambios_es_admin());
drop policy if exists cambios_adjuntos_leer on public.cambios_adjuntos;
create policy cambios_adjuntos_leer on public.cambios_adjuntos for select to authenticated using(public.cambios_es_admin());
drop policy if exists cambios_adjuntos_crear on public.cambios_adjuntos;
create policy cambios_adjuntos_crear on public.cambios_adjuntos for insert to authenticated with check(public.cambios_es_admin() and autor_id=auth.uid());

-- Lista limitada del equipo: evita entregar las fichas personales completas.
create or replace function public.cambios_equipo()
returns table(id uuid, nombre text) language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from public.perfiles p
    join public.cambios_equipo_accesos e on e.usuario_id=p.id
    where public.cambios_es_admin() and e.activo and coalesce(p.activo,true) order by p.nombre;
$$;
revoke all on function public.cambios_equipo() from public;
grant execute on function public.cambios_equipo() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cambios-funcecaind','cambios-funcecaind',false,15728640,null)
on conflict(id) do nothing;
drop policy if exists cambios_archivos_leer on storage.objects;
create policy cambios_archivos_leer on storage.objects for select to authenticated
  using(bucket_id='cambios-funcecaind' and public.cambios_es_admin());
drop policy if exists cambios_archivos_subir on storage.objects;
create policy cambios_archivos_subir on storage.objects for insert to authenticated
  with check(bucket_id='cambios-funcecaind' and public.cambios_es_admin()
    and exists(select 1 from public.cambios_solicitudes where id::text = split_part(name,'/',1)));
-- Solo se limpia una subida fallida que no llego a registrarse como adjunto.
drop policy if exists cambios_archivos_limpiar on storage.objects;
create policy cambios_archivos_limpiar on storage.objects for delete to authenticated
  using(bucket_id='cambios-funcecaind' and public.cambios_es_admin()
    and not exists(select 1 from public.cambios_adjuntos where ruta=name));
commit;
