-- Ámbar PWA: bucket público de imágenes. Solo una sesión admin válida (header x-admin-token) puede escribir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/webp','image/jpeg','image/png','image/gif','video/mp4'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media admin insert" on storage.objects;
drop policy if exists "media admin update" on storage.objects;
drop policy if exists "media admin delete" on storage.objects;
drop policy if exists "media admin select" on storage.objects;

create policy "media admin insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'media' and public.admin_session_valid(current_setting('request.headers', true)::json->>'x-admin-token'));
create policy "media admin update" on storage.objects for update to anon, authenticated
  using (bucket_id = 'media' and public.admin_session_valid(current_setting('request.headers', true)::json->>'x-admin-token'));
create policy "media admin delete" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'media' and public.admin_session_valid(current_setting('request.headers', true)::json->>'x-admin-token'));
-- Necesaria para upsert/returning; los archivos son públicos de todas formas.
create policy "media admin select" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media' and public.admin_session_valid(current_setting('request.headers', true)::json->>'x-admin-token'));
