-- ============================================================================
-- FUNCECAIND — Configuración de la base de datos (Supabase / Postgres)
-- Crea las tablas, el trigger de alta de perfil y las políticas RLS.
-- Se ejecuta una sola vez (lo corre Claude con el token, o tú en
-- Dashboard → SQL Editor → New query → pegar → Run).
-- ============================================================================

-- 1) PERFILES (1 a 1 con auth.users) ----------------------------------------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text,
  email     text,
  rol       text not null default 'alumno' check (rol in ('admin','profesor','alumno')),
  creado_en timestamptz not null default now()
);

-- 2) CLASES ------------------------------------------------------------------
create table if not exists public.clases (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descripcion     text,
  horario         text,
  sala            text not null,
  profesor_id     uuid references auth.users(id) on delete set null,
  profesor_nombre text,
  creado_en       timestamptz not null default now()
);

-- 3) TRIGGER: al registrarse un usuario, crear su perfil --------------------
--    El correo admin recibe rol 'admin'; el resto, 'alumno'.
--    👇 CAMBIA el correo por el mismo de ADMIN_EMAIL en supabase-config.js
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    case when lower(new.email) = lower('elearningcharallave@yahoo.com')
         then 'admin' else 'alumno' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) RLS ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.clases   enable row level security;

-- helper: ¿quien llama es admin?  (security definer evita recursión de RLS)
create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- perfiles: leer el propio o (admin) todos; solo admin inserta/edita/borra
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select using (id = auth.uid() or public.es_admin());

drop policy if exists perfiles_insert on public.perfiles;
create policy perfiles_insert on public.perfiles
  for insert with check (public.es_admin());

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update using (public.es_admin()) with check (public.es_admin());

drop policy if exists perfiles_delete on public.perfiles;
create policy perfiles_delete on public.perfiles
  for delete using (public.es_admin());

-- clases: cualquier autenticado las ve; un profesor crea las suyas;
--         el dueño o un admin las edita/borra
drop policy if exists clases_select on public.clases;
create policy clases_select on public.clases
  for select using (auth.role() = 'authenticated');

drop policy if exists clases_insert on public.clases;
create policy clases_insert on public.clases
  for insert with check (
    profesor_id = auth.uid()
    and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('profesor','admin'))
  );

drop policy if exists clases_update on public.clases;
create policy clases_update on public.clases
  for update using (profesor_id = auth.uid() or public.es_admin());

drop policy if exists clases_delete on public.clases;
create policy clases_delete on public.clases
  for delete using (profesor_id = auth.uid() or public.es_admin());

-- 5) RESULTADOS de pruebas / tests ------------------------------------------
create table if not exists public.resultados (
  id            uuid primary key default gen_random_uuid(),
  alumno_id     uuid references auth.users(id) on delete cascade,
  alumno_nombre text,
  prueba        text not null,          -- 'word' | 'excel' | ...
  puntaje       int  not null,
  total         int  not null,
  porcentaje    int  not null,
  creado_en     timestamptz not null default now()
);
alter table public.resultados enable row level security;

-- staff = admin o profesor (pueden ver los resultados de todos)
create or replace function public.es_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('admin','profesor'));
$$;

drop policy if exists resultados_insert on public.resultados;
create policy resultados_insert on public.resultados
  for insert with check (alumno_id = auth.uid());

drop policy if exists resultados_select on public.resultados;
create policy resultados_select on public.resultados
  for select using (alumno_id = auth.uid() or public.es_staff());

drop policy if exists resultados_delete on public.resultados;
create policy resultados_delete on public.resultados
  for delete using (public.es_admin());

-- 6) ASISTENCIA a clases en vivo (registro automático desde el aula) ---------
create table if not exists public.asistencia (
  id            uuid primary key default gen_random_uuid(),
  sala          text not null,            -- código de sala Jitsi (clases.sala)
  alumno_id     uuid references auth.users(id) on delete set null,
  alumno_nombre text,
  rol           text,                     -- 'teacher' | 'student'
  entro_at      timestamptz not null default now(),
  visto_at      timestamptz not null default now(),  -- latido (último visto)
  salio_at      timestamptz
);
alter table public.asistencia enable row level security;

drop policy if exists asistencia_insert on public.asistencia;
create policy asistencia_insert on public.asistencia
  for insert with check (alumno_id = auth.uid());

drop policy if exists asistencia_update on public.asistencia;
create policy asistencia_update on public.asistencia
  for update using (alumno_id = auth.uid() or public.es_staff());

drop policy if exists asistencia_select on public.asistencia;
create policy asistencia_select on public.asistencia
  for select using (alumno_id = auth.uid() or public.es_staff());

-- 7) MATERIALES de clase (archivos en Supabase Storage) ---------------------
insert into storage.buckets (id, name, public)
  values ('materiales', 'materiales', true)
  on conflict (id) do nothing;

drop policy if exists materiales_obj_insert on storage.objects;
create policy materiales_obj_insert on storage.objects
  for insert with check (bucket_id = 'materiales' and public.es_staff());
drop policy if exists materiales_obj_delete on storage.objects;
create policy materiales_obj_delete on storage.objects
  for delete using (bucket_id = 'materiales' and public.es_staff());

create table if not exists public.materiales (
  id           uuid primary key default gen_random_uuid(),
  clase_id     uuid references public.clases(id) on delete cascade,
  titulo       text,
  archivo_path text,
  url          text,
  profesor_id  uuid references auth.users(id) on delete set null,
  creado_en    timestamptz not null default now()
);
alter table public.materiales enable row level security;

drop policy if exists materiales_select on public.materiales;
create policy materiales_select on public.materiales
  for select using (auth.role() = 'authenticated');
drop policy if exists materiales_insert on public.materiales;
create policy materiales_insert on public.materiales
  for insert with check (profesor_id = auth.uid() and public.es_staff());
drop policy if exists materiales_delete on public.materiales;
create policy materiales_delete on public.materiales
  for delete using (profesor_id = auth.uid() or public.es_admin());

-- 8) FORO (clase_id NULL = foro general; o foro por clase) -------------------
create table if not exists public.foro_mensajes (
  id           uuid primary key default gen_random_uuid(),
  clase_id     uuid references public.clases(id) on delete cascade,  -- null = general
  autor_id     uuid references auth.users(id) on delete set null,
  autor_nombre text,
  autor_rol    text,
  mensaje      text not null,
  creado_en    timestamptz not null default now()
);
alter table public.foro_mensajes enable row level security;

drop policy if exists foro_select on public.foro_mensajes;
create policy foro_select on public.foro_mensajes
  for select using (auth.role() = 'authenticated');

drop policy if exists foro_insert on public.foro_mensajes;
create policy foro_insert on public.foro_mensajes
  for insert with check (autor_id = auth.uid());

drop policy if exists foro_delete on public.foro_mensajes;
create policy foro_delete on public.foro_mensajes
  for delete using (autor_id = auth.uid() or public.es_admin());
