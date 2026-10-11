-- Amplia la trazabilidad sin duplicar el cuerpo de los comentarios.
begin;
create or replace function public.cambios_anotar_aporte()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.cambios_eventos(solicitud_id,autor_id,tipo,despues)
  values(new.solicitud_id,new.autor_id,
    case when tg_table_name='cambios_adjuntos' then 'archivo' else 'comentario' end,
    case when tg_table_name='cambios_adjuntos'
      then jsonb_build_object('aporte_id',new.id,'nombre',to_jsonb(new)->>'nombre','tamano',to_jsonb(new)->'tamano')
      else jsonb_build_object('aporte_id',new.id) end);
  return new;
end;
$$;
revoke all on function public.cambios_anotar_aporte() from public;
drop trigger if exists cambios_comentario_historial on public.cambios_comentarios;
create trigger cambios_comentario_historial after insert on public.cambios_comentarios
  for each row execute function public.cambios_anotar_aporte();
drop trigger if exists cambios_archivo_historial on public.cambios_adjuntos;
create trigger cambios_archivo_historial after insert on public.cambios_adjuntos
  for each row execute function public.cambios_anotar_aporte();
commit;
