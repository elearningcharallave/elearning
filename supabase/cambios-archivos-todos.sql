-- Todos los formatos siguen privados y limitados a 15 MB por archivo.
begin;
update storage.buckets set allowed_mime_types=null
where id='cambios-funcecaind';
commit;
