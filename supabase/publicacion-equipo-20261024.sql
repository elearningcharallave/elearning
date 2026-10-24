begin;
alter table public.perfiles add column if not exists cargo text not null default '';
alter table public.perfiles add column if not exists bio text not null default '';
alter table public.perfiles add column if not exists en_equipo_web boolean not null default false;
alter table public.perfiles add column if not exists orden_equipo integer not null default 0;
alter table public.cursos add column if not exists mostrar_inicio boolean not null default true;
alter table public.cursos add column if not exists mostrar_catalogo boolean not null default true;

-- Las vistas exponen solo columnas publicables; no abrir perfiles ni cursos completos.
create or replace view public.equipo_publico with (security_barrier=true) as
select id,nombre,rol,cargo,bio,foto_url,orden_equipo from public.perfiles
where activo and en_equipo_web and rol in ('admin','profesor');
create or replace view public.cursos_publicos with (security_barrier=true) as
select id,titulo,descripcion,profesor_nombre,horas,fecha_inicio,fecha_fin,
especializacion,codigo_formacion,duracion_texto,modalidad_formacion,mostrar_inicio,mostrar_catalogo
from public.cursos where publicado and not archivado;
revoke all on public.equipo_publico,public.cursos_publicos from public,anon,authenticated;
grant select on public.equipo_publico,public.cursos_publicos to anon,authenticated;
commit;
