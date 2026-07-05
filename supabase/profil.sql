-- ============================================================
-- ASM — Table « profil » (comptes patients / établissements)
-- À exécuter dans Supabase → SQL Editor → Run (une seule fois).
-- Le profil est créé APRÈS la vérification du numéro par SMS, avec
-- les champs obligatoires ; son existence = compte finalisé.
-- ============================================================

create table if not exists public.profil (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'patient',   -- patient | pro
  prenom        text,
  nom           text,
  telephone     text,
  commune       text,
  etablissement text,
  type_etab     text,
  contact       text,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now()
);

alter table public.profil enable row level security;

drop policy if exists profil_select_owner on public.profil;
create policy profil_select_owner on public.profil
  for select using (auth.uid() = id);

drop policy if exists profil_insert_owner on public.profil;
create policy profil_insert_owner on public.profil
  for insert with check (auth.uid() = id);

drop policy if exists profil_update_owner on public.profil;
create policy profil_update_owner on public.profil
  for update using (auth.uid() = id);
