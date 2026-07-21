# ASM — Revue de sécurité (préparation lancement)

**Date : 25/07/2026 · Phase 8 du Prompt Ultime.**
Périmètre : site web (Next.js/Vercel), API, base Railway/Prisma, Supabase
(auth + stockage), application Expo. Les contrôles marqués 🤖 sont rejoués
automatiquement à chaque exécution de `scripts/tests/test-lancement.mjs`.

---

## 1. Résultats des contrôles

| # | Contrôle | Résultat |
|---|---|---|
| 1 | 🤖 Toutes les routes `/api/admin/*` exigent `verifierAdmin` (rôle vérifié serveur) | ✅ 24/24 routes |
| 2 | 🤖 Aucun secret en dur dans le code (clés API, jetons, clés privées) | ✅ rien trouvé |
| 3 | 🤖 Aucun fichier `.env` réel commité (seul `.env.example`, sans valeurs) | ✅ |
| 4 | Routes publiques d'écriture : authentification (jeton) ou rate-limit | ✅ demandes, attente, retour-pret, messages, otp-test, devis, promo… |
| 5 | Webhook Chargily : signature HMAC vérifiée, redirection navigateur JAMAIS une preuve de paiement | ✅ (inchangé) |
| 6 | Stockage : bucket `documents` privé (URLs signées, durée limitée) ; `photos` public par choix (photos de profil, aucune donnée médicale) | ✅ |
| 7 | En-têtes de sécurité globaux (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) | ✅ `next.config.js` |
| 8 | Pas de `dangerouslySetInnerHTML` dans l'application | ✅ |
| 9 | Mots de passe : jamais stockés ni visibles (même superadmin) — Supabase Auth uniquement | ✅ |
| 10 | Actions sensibles journalisées (`Journal`) : rôles, exports, finances, suppression, fils | ✅ |
| 11 | 🤖 Mode test OTP « tout numéro » : **SUPPRIMÉ** — remplacé par le compte de démonstration whitelisté (un seul numéro, code fixe, rate-limité) | ✅ Phase 8 |
| 12 | Fils de discussion : accès revérifié à CHAQUE lecture/écriture (patient, rattachement accepté non expiré, réservataire, staff) | ✅ testé |
| 13 | Périmètres pro (groupes multi-sites) recalculés serveur, jamais fournis par le client | ✅ testé |
| 14 | Position GPS chauffeur : uniquement pendant « en route », effacée à la clôture ; l'ETA du patient est calculée sur SON appareil | ✅ |
| 15 | `npm audit` production | ⚠️ voir § 2 |

## 2. Risque résiduel connu : version de Next.js

`next@14.2.35` : les avis publiés en 2026 (DoS, cache-poisoning, smuggling)
ne sont corrigés qu'en **Next 16** — migration majeure (breaking changes).
Atténuation actuelle : hébergement **Vercel géré** (pas de proxy auto-hébergé,
optimisation d'images et cache gérés par la plateforme), en-têtes stricts,
aucune route à contenu non fiable interprété.
**Décision** : ne PAS migrer à chaud pendant le test fermé Google Play.
➜ Tâche planifiée post-lancement : migration Next 16 + re-tests complets.

## 3. Compte de démonstration (examens Google / Apple)

- Un SEUL numéro whitelisté côté serveur (`DEMO_TEL`, défaut +213 550 000 000)
  avec un code fixe (`DEMO_CODE`). Tout autre numéro ⇒ vrai SMS obligatoire.
- Transition douce : tant que `DEMO_TEL/DEMO_CODE` ne sont pas posés dans
  Vercel, l'ancienne variable `OTP_TEST_CODE` ne sert plus QUE ce numéro-là.
  **À faire (utilisateur)** : poser `DEMO_TEL` + `DEMO_CODE`, puis supprimer
  `OTP_TEST_CODE` — bandeau de rappel dans Admin → Réglages.

## 4. Rappels de lancement (checklist)

- [ ] Poser `CRON_SECRET` (rappels de RDV) — valeur transmise en discussion.
- [ ] Poser `DEMO_TEL` + `DEMO_CODE`, puis SUPPRIMER `OTP_TEST_CODE`.
- [ ] Vérifier le crédit Elite SMS avant l'ouverture (réglages admin).
- [ ] Après validation Meta : modèles WhatsApp + variables associées.
- [ ] Saisir la vraie grille tarifaire (les tarifs par défaut sont indicatifs).
- [ ] Chargily : passer en clés LIVE le jour du lancement (`CHARGILY_MODE`).
- [ ] Planifier la migration Next 16 (post-lancement).
