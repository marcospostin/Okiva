-- Okiva - etapa 4: Storage (buckets privados + políticas por pasta do usuário)
-- Caminho obrigatório dos arquivos: <auth.uid()>/<nome-do-arquivo>
--   avatars : foto de perfil (até 5 MB; jpeg/png/webp/heic)
--   invoices: PDF ou foto da fatura (até 20 MB; pdf/jpeg/png/heic)
-- Leitura pelo front: createSignedUrl (buckets privados, sem URL pública).
-- Rollback: drop policy ... on storage.objects; delete from storage.buckets where id in ('avatars','invoices')
--           (só funciona com os buckets vazios; esvazie pela API/dashboard antes).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',  'avatars',  false, 5242880,  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('invoices', 'invoices', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy okiva_files_select_own on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'invoices') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy okiva_files_insert_own on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'invoices') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy okiva_files_update_own on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'invoices') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars', 'invoices') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy okiva_files_delete_own on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'invoices') and (storage.foldername(name))[1] = (select auth.uid())::text);
