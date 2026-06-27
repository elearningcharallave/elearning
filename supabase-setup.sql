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

-- ============================================================================
-- 9) LMS Fase 1: cursos -> modulos -> lecciones + matriculas + learning_events
-- ============================================================================
create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  profesor_id uuid references auth.users(id) on delete set null,
  profesor_nombre text,
  publicado boolean not null default false,
  creado_en timestamptz not null default now()
);
create table if not exists public.modulos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid references public.cursos(id) on delete cascade,
  titulo text not null,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);
create table if not exists public.lecciones (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid references public.modulos(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'texto' check (tipo in ('texto','video','clase_vivo','archivo','evaluacion')),
  contenido text,                 -- texto: cuerpo; video/archivo: URL; clase_vivo: sala; evaluacion: clave
  orden int not null default 0,
  creado_en timestamptz not null default now()
);
create table if not exists public.matriculas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid references public.cursos(id) on delete cascade,
  alumno_id uuid references auth.users(id) on delete cascade,
  alumno_nombre text,
  creado_en timestamptz not null default now(),
  unique (curso_id, alumno_id)
);
create table if not exists public.learning_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_nombre text,
  verb text not null,             -- viewed | attended | launched | completed | passed | failed | submitted
  object_type text not null,      -- leccion | evaluacion | tarea | clase_vivo | curso
  object_id uuid,
  score_scaled numeric(4,3) check (score_scaled between 0 and 1),
  success boolean, completion boolean, duration_s int,
  context jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index if not exists le_actor_obj on public.learning_events (actor_id, object_type, object_id);

alter table public.cursos          enable row level security;
alter table public.modulos         enable row level security;
alter table public.lecciones       enable row level security;
alter table public.matriculas      enable row level security;
alter table public.learning_events enable row level security;

-- helpers RLS
create or replace function public.matriculado(curso uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.matriculas where curso_id=curso and alumno_id=auth.uid());
$$;
create or replace function public.curso_de_leccion(lec uuid)
returns uuid language sql security definer stable set search_path=public as $$
  select c.id from public.lecciones l
    join public.modulos m on m.id=l.modulo_id
    join public.cursos  c on c.id=m.curso_id
  where l.id=lec;
$$;
create or replace function public.es_profesor_curso(curso uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.cursos where id=curso and profesor_id=auth.uid());
$$;

-- CURSOS: leer autenticado (catalogo); CUD profesor dueño o admin
drop policy if exists cursos_select on public.cursos;
create policy cursos_select on public.cursos for select using (auth.role()='authenticated');
drop policy if exists cursos_insert on public.cursos;
create policy cursos_insert on public.cursos for insert with check ((profesor_id=auth.uid() and public.es_staff()) or public.es_admin());
drop policy if exists cursos_update on public.cursos;
create policy cursos_update on public.cursos for update using (profesor_id=auth.uid() or public.es_admin());
drop policy if exists cursos_delete on public.cursos;
create policy cursos_delete on public.cursos for delete using (profesor_id=auth.uid() or public.es_admin());

-- MODULOS: leer autenticado; CUD profesor del curso o admin
drop policy if exists modulos_select on public.modulos;
create policy modulos_select on public.modulos for select using (auth.role()='authenticated');
drop policy if exists modulos_insert on public.modulos;
create policy modulos_insert on public.modulos for insert with check (public.es_admin() or public.es_profesor_curso(curso_id));
drop policy if exists modulos_update on public.modulos;
create policy modulos_update on public.modulos for update using (public.es_admin() or public.es_profesor_curso(curso_id));
drop policy if exists modulos_delete on public.modulos;
create policy modulos_delete on public.modulos for delete using (public.es_admin() or public.es_profesor_curso(curso_id));

-- LECCIONES: leer = matriculado o profesor del curso o admin; CUD profesor del curso o admin
drop policy if exists lecciones_select on public.lecciones;
create policy lecciones_select on public.lecciones for select using (
  public.es_staff() or public.matriculado(public.curso_de_leccion(id)) or public.es_profesor_curso(public.curso_de_leccion(id)));
drop policy if exists lecciones_insert on public.lecciones;
create policy lecciones_insert on public.lecciones for insert with check (
  public.es_admin() or public.es_profesor_curso((select curso_id from public.modulos where id=modulo_id)));
drop policy if exists lecciones_update on public.lecciones;
create policy lecciones_update on public.lecciones for update using (
  public.es_admin() or public.es_profesor_curso(public.curso_de_leccion(id)));
drop policy if exists lecciones_delete on public.lecciones;
create policy lecciones_delete on public.lecciones for delete using (
  public.es_admin() or public.es_profesor_curso(public.curso_de_leccion(id)));

-- MATRICULAS: leer propia o staff; insertar/borrar admin o profesor del curso
drop policy if exists matriculas_select on public.matriculas;
create policy matriculas_select on public.matriculas for select using (alumno_id=auth.uid() or public.es_staff());
drop policy if exists matriculas_insert on public.matriculas;
create policy matriculas_insert on public.matriculas for insert with check (public.es_admin() or public.es_profesor_curso(curso_id));
drop policy if exists matriculas_delete on public.matriculas;
create policy matriculas_delete on public.matriculas for delete using (public.es_admin() or public.es_profesor_curso(curso_id));

-- LEARNING_EVENTS: insertar lo propio SOLO con verbos no-calificadores; leer propio o staff
-- (passed/failed/completed/score se escriben server-side por Edge Function en Fase 2)
drop policy if exists le_insert on public.learning_events;
create policy le_insert on public.learning_events for insert with check (
  actor_id=auth.uid() and verb in ('viewed','attended','launched'));
drop policy if exists le_select on public.learning_events;
create policy le_select on public.learning_events for select using (actor_id=auth.uid() or public.es_staff());

-- 10) Profesores tambien pueden LISTAR perfiles (para matricular alumnos) ----
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select using (id = auth.uid() or public.es_staff());

-- ============================================================================
-- 11) LMS Fase 2: evaluaciones + preguntas + intentos (calificacion server-side)
-- ============================================================================
create table if not exists public.evaluaciones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid references public.cursos(id) on delete cascade,
  titulo text not null,
  descripcion text,
  nota_minima int not null default 60,    -- % para aprobar
  duracion_min int not null default 0,     -- 0 = sin limite
  intentos_max int not null default 0,      -- 0 = ilimitado
  aleatorizar boolean not null default true,
  profesor_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create table if not exists public.preguntas (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references public.evaluaciones(id) on delete cascade,
  enunciado text not null,
  tipo text not null default 'vf' check (tipo in ('vf','mc')),
  opciones jsonb,                  -- mc: ["a","b",...]; vf: null
  correcta int not null default 0, -- indice correcto: NUNCA se expone a los alumnos
  puntos int not null default 1,
  orden int not null default 0
);
create table if not exists public.intentos (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references public.evaluaciones(id) on delete cascade,
  alumno_id uuid references auth.users(id) on delete cascade,
  alumno_nombre text,
  iniciado_en timestamptz not null default now(),
  enviado_en timestamptz,
  puntaje int, total int, porcentaje int, aprobado boolean,
  respuestas jsonb
);
create index if not exists intentos_eval_alumno on public.intentos (evaluacion_id, alumno_id);

alter table public.evaluaciones enable row level security;
alter table public.preguntas    enable row level security;
alter table public.intentos     enable row level security;

-- evaluaciones: leer matriculado/profesor/admin; CUD profesor del curso o admin
drop policy if exists eval_select on public.evaluaciones;
create policy eval_select on public.evaluaciones for select using (public.es_staff() or public.matriculado(curso_id) or public.es_profesor_curso(curso_id));
drop policy if exists eval_insert on public.evaluaciones;
create policy eval_insert on public.evaluaciones for insert with check (public.es_admin() or public.es_profesor_curso(curso_id));
drop policy if exists eval_update on public.evaluaciones;
create policy eval_update on public.evaluaciones for update using (public.es_admin() or public.es_profesor_curso(curso_id));
drop policy if exists eval_delete on public.evaluaciones;
create policy eval_delete on public.evaluaciones for delete using (public.es_admin() or public.es_profesor_curso(curso_id));

-- preguntas: SOLO staff lee/escribe directo. Los alumnos las reciben SIN respuestas via Edge Function.
drop policy if exists preg_select on public.preguntas;
create policy preg_select on public.preguntas for select using (public.es_staff());
drop policy if exists preg_insert on public.preguntas;
create policy preg_insert on public.preguntas for insert with check (public.es_staff());
drop policy if exists preg_update on public.preguntas;
create policy preg_update on public.preguntas for update using (public.es_staff());
drop policy if exists preg_delete on public.preguntas;
create policy preg_delete on public.preguntas for delete using (public.es_staff());

-- intentos: leer propio o staff; NUNCA insert/update desde cliente (solo Edge Function)
drop policy if exists intentos_select on public.intentos;
create policy intentos_select on public.intentos for select using (alumno_id=auth.uid() or public.es_staff());

-- ============================================================================
-- 12) LMS Fase 3: certificados verificables
-- ============================================================================
create table if not exists public.certificados (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid references public.cursos(id) on delete set null,
  curso_titulo text,
  alumno_id uuid references auth.users(id) on delete cascade,
  alumno_nombre text,
  codigo text unique not null,
  emitido_en timestamptz not null default now(),
  unique (curso_id, alumno_id)
);
alter table public.certificados enable row level security;
-- el alumno lee los suyos; staff lee todos. Emision SOLO por Edge Function (service_role).
drop policy if exists cert_select on public.certificados;
create policy cert_select on public.certificados for select using (alumno_id=auth.uid() or public.es_staff());

-- verificacion PUBLICA por codigo (sin login, sin exponer toda la tabla)
create or replace function public.verificar_certificado(cod text)
returns table(alumno_nombre text, curso_titulo text, emitido_en timestamptz)
language sql security definer stable set search_path=public as $$
  select c.alumno_nombre, c.curso_titulo, c.emitido_en from public.certificados c where c.codigo = cod;
$$;
grant execute on function public.verificar_certificado(text) to anon, authenticated;

-- ============================================================================
-- 13) LMS Fase 4: tareas + entregas + deteccion de similitud (anti-plagio)
-- ============================================================================
create extension if not exists pg_trgm;

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid references public.cursos(id) on delete cascade,
  titulo text not null,
  descripcion text,
  fecha_limite date,
  profesor_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid references public.tareas(id) on delete cascade,
  alumno_id uuid references auth.users(id) on delete cascade,
  alumno_nombre text,
  texto text,
  archivo_url text,
  char_count int default 0,
  paste_events int default 0,
  pasted_ratio numeric(4,3) default 0,
  nota int, comentario text, calificado_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (tarea_id, alumno_id)
);
alter table public.tareas   enable row level security;
alter table public.entregas enable row level security;

-- el alumno NUNCA se auto-califica: al insertar/actualizar su entrega, los campos de nota se anulan
create or replace function public.entrega_sin_nota() returns trigger language plpgsql as $$
begin
  if not public.es_staff() then
    new.nota := null; new.comentario := null; new.calificado_en := null;
  end if;
  return new;
end; $$;
drop trigger if exists entrega_no_self_grade on public.entregas;
create trigger entrega_no_self_grade before insert or update on public.entregas for each row execute function public.entrega_sin_nota();

-- tareas: leer matriculado/staff; CUD profesor del curso o admin
drop policy if exists tareas_select on public.tareas;
create policy tareas_select on public.tareas for select using (public.es_staff() or public.matriculado(curso_id) or public.es_profesor_curso(curso_id));
drop policy if exists tareas_insert on public.tareas;
create policy tareas_insert on public.tareas for insert with check (public.es_admin() or public.es_profesor_curso(curso_id));
drop policy if exists tareas_update on public.tareas;
create policy tareas_update on public.tareas for update using (public.es_admin() or public.es_profesor_curso(curso_id));
drop policy if exists tareas_delete on public.tareas;
create policy tareas_delete on public.tareas for delete using (public.es_admin() or public.es_profesor_curso(curso_id));

-- entregas: leer propia o staff; insertar/editar la propia; calificar (update) lo hace staff (el trigger anula nota si no es staff)
drop policy if exists entregas_select on public.entregas;
create policy entregas_select on public.entregas for select using (alumno_id=auth.uid() or public.es_staff());
drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas for insert with check (alumno_id=auth.uid());
drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas for update using ((alumno_id=auth.uid() and calificado_en is null) or public.es_staff());
drop policy if exists entregas_delete on public.entregas;
create policy entregas_delete on public.entregas for delete using (alumno_id=auth.uid() or public.es_admin());

-- similitud entre entregas de una misma tarea (SOLO staff; pg_trgm)
create or replace function public.similitud_entregas(t uuid)
returns table(entrega_id uuid, alumno_nombre text, max_sim numeric, similar_a text)
language sql security definer stable set search_path=public as $$
  select e1.id, e1.alumno_nombre,
         round(max(similarity(e1.texto, e2.texto))::numeric, 2) as max_sim,
         (array_agg(e2.alumno_nombre order by similarity(e1.texto, e2.texto) desc))[1] as similar_a
  from public.entregas e1
  join public.entregas e2 on e2.tarea_id = e1.tarea_id and e2.id <> e1.id and e2.texto is not null
  where e1.tarea_id = t and e1.texto is not null and public.es_staff()
  group by e1.id, e1.alumno_nombre;
$$;
grant execute on function public.similitud_entregas(uuid) to authenticated;

-- ============================================================================
-- 14) LMS Fase 5: analitica (VIEWs/RPC derivadas; solo profesor del curso o admin)
-- ============================================================================
create or replace function public.resumen_curso(cid uuid)
returns table(matriculados int, total_lecciones int, total_evaluaciones int, total_tareas int, completados int)
language sql security definer stable set search_path=public as $$
  select
    (select count(*) from public.matriculas where curso_id=cid)::int,
    (select count(*) from public.lecciones l join public.modulos m on m.id=l.modulo_id where m.curso_id=cid)::int,
    (select count(*) from public.evaluaciones where curso_id=cid)::int,
    (select count(*) from public.tareas where curso_id=cid)::int,
    (select count(*) from public.certificados where curso_id=cid)::int
  where public.es_profesor_curso(cid) or public.es_admin();
$$;
grant execute on function public.resumen_curso(uuid) to authenticated;

create or replace function public.progreso_curso(cid uuid)
returns table(alumno_id uuid, alumno_nombre text, lecciones_vistas int, evals_aprobadas int, ultima_actividad timestamptz)
language sql security definer stable set search_path=public as $$
  select m.alumno_id, m.alumno_nombre,
    (select count(distinct le.object_id)::int from public.learning_events le where le.actor_id=m.alumno_id and le.verb='viewed' and le.object_type='leccion' and (le.context->>'curso_id')=cid::text),
    (select count(distinct i.evaluacion_id)::int from public.intentos i join public.evaluaciones e on e.id=i.evaluacion_id where i.alumno_id=m.alumno_id and i.aprobado and e.curso_id=cid),
    (select max(le.occurred_at) from public.learning_events le where le.actor_id=m.alumno_id and (le.context->>'curso_id')=cid::text)
  from public.matriculas m
  where m.curso_id=cid and (public.es_profesor_curso(cid) or public.es_admin())
  order by m.alumno_nombre;
$$;
grant execute on function public.progreso_curso(uuid) to authenticated;

-- ============================================================================
-- 15) LMS Fase 5 (#8): materiales en bucket PRIVADO + signed URLs
--     Quita el acceso anonimo: solo usuarios autenticados obtienen una URL firmada.
-- ============================================================================
update storage.buckets set public = false where id = 'materiales';
drop policy if exists materiales_obj_select on storage.objects;
create policy materiales_obj_select on storage.objects
  for select using (bucket_id = 'materiales' and auth.role() = 'authenticated');
