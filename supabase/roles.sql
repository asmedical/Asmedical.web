-- ============================================================
-- ASM — Rôles internes (espace admin)
-- À exécuter dans Supabase → SQL Editor.
--
-- Les rôles internes sont stockés dans profil.role :
--   superadmin | admin | moderateur | standardiste
-- (les clients gardent : patient | pro)
--
-- 1) Promouvoir TON compte en super admin :
--    remplace le numéro par le téléphone de ton compte, puis Run.
-- ============================================================

update public.profil
set role = 'superadmin'
where telephone like '%746792462%';

-- Vérification : doit afficher ta ligne avec role = superadmin
select id, role, prenom, nom, telephone, email from public.profil
where role in ('superadmin','admin','moderateur','standardiste');
