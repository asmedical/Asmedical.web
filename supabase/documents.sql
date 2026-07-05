-- ============================================================
-- ASM — Table « document » + sécurité (RLS) pour Mes documents
-- À exécuter une fois dans Supabase → SQL Editor → New query → Run
-- Bucket privé « documents » à créer au préalable (Storage → New bucket).
-- ============================================================

-- 1. Table des métadonnées
create table if not exists public.document (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  nom        text not null,
  type       text not null,
  taille     bigint not null,
  chemin     text not null,
  cree_le    timestamptz not null default now()
);

alter table public.document enable row level security;

-- 2. Un patient ne voit / crée / supprime QUE ses propres documents
drop policy if exists doc_select_owner on public.document;
create policy doc_select_owner on public.document
  for select using (auth.uid() = patient_id);

drop policy if exists doc_insert_owner on public.document;
create policy doc_insert_owner on public.document
  for insert with check (auth.uid() = patient_id);

drop policy if exists doc_delete_owner on public.document;
create policy doc_delete_owner on public.document
  for delete using (auth.uid() = patient_id);

-- 3. Sécurité du Storage : le 1er dossier du chemin = identifiant du patient
--    (bucket privé « documents »)
drop policy if exists storage_doc_select on storage.objects;
create policy storage_doc_select on storage.objects
  for select using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_doc_insert on storage.objects;
create policy storage_doc_insert on storage.objects
  for insert with check (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_doc_delete on storage.objects;
create policy storage_doc_delete on storage.objects
  for delete using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );
