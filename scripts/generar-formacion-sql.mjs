import {readFile,writeFile} from 'node:fs/promises';
const raiz=new URL('../',import.meta.url);
const datos=JSON.parse(await readFile(new URL('assets/formacion-2026.json',raiz),'utf8'));
if(datos.cursos.length!==108||datos.programas.length!==12||datos.pna.length!==3)throw new Error('El inventario no coincide con los adjuntos');
const ofertas=[...datos.cursos,...datos.programas,...datos.pna].map((o,i)=>({...o,clave:'adjuntos-20261012-'+String(i+1).padStart(3,'0')}));
const json=JSON.stringify(ofertas);if(json.includes('$ofertas20261012$'))throw new Error('Delimitador inesperado');
const sql=`-- Sustitucion de la solicitud f399c3d6-ac85-4695-b7a7-50707d3a78c4.
-- Los tres cursos anteriores se archivan, conservando toda la historia academica.
begin;
select set_config('request.jwt.claim.sub','79c05548-73ca-42cb-bdd1-4819d036d162',true);
alter table public.cursos add column if not exists archivado boolean not null default false;
alter table public.cursos add column if not exists clave_oferta text;
alter table public.cursos add column if not exists codigo_formacion text;
alter table public.cursos add column if not exists tipo_formacion text;
alter table public.cursos add column if not exists duracion_texto text;
alter table public.cursos add column if not exists modalidad_formacion text;
create unique index if not exists cursos_clave_oferta on public.cursos(clave_oferta);
create temporary table ofertas_importar on commit drop as select value o from jsonb_array_elements($ofertas20261012$${json}$ofertas20261012$::jsonb);
update public.cursos set publicado=false,archivado=true where id in ('3449c26e-3a9c-4e58-8845-d63f1b5fcec6','d5259b77-5aba-49ed-bf10-35ad19798ca3','cdf1445e-c10e-4ee2-bf1a-3cc2facb2314');
insert into public.cursos(titulo,descripcion,publicado,especializacion,horas,clave_oferta,codigo_formacion,tipo_formacion,duracion_texto,modalidad_formacion)
select o->>'nombre',concat('Código: ',o->>'codigo',E'\\nÁrea: ',o->>'area',E'\\nDuración: ',o->>'duracion',case when o ? 'practica' then concat(E'\\nPráctica: ',o->>'practica') else '' end,case when o->>'modalidad' is not null then concat(E'\\nModalidad: ',o->>'modalidad') else '' end,E'\\nFuente: ',o->>'fuente'),true,o->>'area',case when o->>'duracion' ~* 'HORAS' then (regexp_match(o->>'duracion','[0-9]+'))[1]::int else 0 end,o->>'clave',o->>'codigo',o->>'tipo',o->>'duracion',o->>'modalidad'
from ofertas_importar on conflict(clave_oferta) do nothing;
-- En PNA, las horas totales del curso son teoria mas practica; la ficha conserva ambas.
update public.cursos c set horas=(regexp_match(i.o->>'duracion','[0-9]+'))[1]::int+(regexp_match(i.o->>'practica','[0-9]+'))[1]::int
from ofertas_importar i where i.o->>'tipo'='pna' and c.clave_oferta=i.o->>'clave' and c.codigo_formacion=i.o->>'codigo';
-- Claves deterministas para que reejecutar no duplique modulos ni fichas.
do $$ declare x record; m jsonb; orden int; id_modulo uuid; ficha text; begin
  for x in select c.id,o from ofertas_importar i join public.cursos c on c.clave_oferta=i.o->>'clave' loop
    if x.o->>'tipo'='fp' then
      orden:=0;
      for m in select value from jsonb_array_elements(x.o->'modulos') loop
        orden:=orden+1;
        id_modulo:=md5(x.o->>'clave'||':modulo:'||orden::text)::uuid;
        insert into public.modulos(id,curso_id,titulo,orden) values(id_modulo,x.id,m->>'titulo',orden) on conflict(id) do nothing;
        select string_agg(value,E'\\n' order by ordinalidad) into ficha from jsonb_array_elements_text(m->'temas') with ordinality as temas(value,ordinalidad);
        insert into public.lecciones(id,modulo_id,titulo,tipo,contenido,orden)
        values(md5(x.o->>'clave'||':temario:'||orden::text)::uuid,id_modulo,'Temario de '||(m->>'titulo'),'texto','Temas del plan de formación original:'||E'\\n\\n'||ficha,1) on conflict(id) do nothing;
      end loop;
    else
      id_modulo:=md5(x.o->>'clave'||':ficha')::uuid;
      insert into public.modulos(id,curso_id,titulo,orden) values(id_modulo,x.id,'Ficha de formación',1) on conflict(id) do nothing;
      insert into public.lecciones(id,modulo_id,titulo,tipo,contenido,orden)
      values(md5(x.o->>'clave'||':informacion')::uuid,id_modulo,'Información del programa','texto',concat(x.o->>'nombre',E'\\nCódigo: ',x.o->>'codigo',E'\\nÁrea: ',x.o->>'area',E'\\nDuración: ',x.o->>'duracion',case when x.o ? 'practica' then concat(E'\\nPráctica: ',x.o->>'practica') else '' end,E'\\nFuente: ',x.o->>'fuente'),1) on conflict(id) do nothing;
    end if;
  end loop;
end $$;
do $$ begin
  if (select count(*) from public.cursos where clave_oferta like 'adjuntos-20261012-%')<>123
    or (select count(*) from public.modulos m join public.cursos c on c.id=m.curso_id where c.clave_oferta like 'adjuntos-20261012-%')<>147
    or (select count(*) from public.lecciones l join public.modulos m on m.id=l.modulo_id join public.cursos c on c.id=m.curso_id where c.clave_oferta like 'adjuntos-20261012-%')<>147 then raise exception 'Inventario importado incompleto'; end if;
end $$;
commit;
`;
await writeFile(new URL('supabase/formacion-adjuntos-20261012.sql',raiz),sql);
console.log('Migracion preparada: 123 ofertas, 147 fichas/temarios, 3 cursos archivados; no se borran matriculas, resultados ni certificados.');
