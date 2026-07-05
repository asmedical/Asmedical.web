# ASM — Documentation technique & production

Document de référence pour l'équipe technique. Objectif : exploiter, surveiller,
sauvegarder et dépanner le site ASM sans perte de données ni panne non détectée.

> ⚠️ Données de santé sensibles (loi algérienne n° 18-07). Ne jamais exposer
> publiquement un document, un email, un numéro ou une clé. Ne jamais mettre de
> vraie clé dans le code : tout passe par les variables d'environnement Vercel.

---

## 1. Architecture — qui fait quoi

| Service | Rôle | Où |
|---|---|---|
| **Vercel** | Héberge le site (Next.js) et le publie. Déploiement automatique à chaque push sur `main`. Fournit le HTTPS. | vercel.com |
| **Railway** | Base de données **PostgreSQL** : les demandes de rendez-vous (`Demande`) et les réglages. | railway.app |
| **Supabase** | **Comptes** (Auth SMS/email), **stockage** des documents (bucket privé `documents`), **RLS** (chaque patient ne voit que ses données). | supabase.com |
| **GitHub** | Code source + historique des versions (`asmedical/Asmedical.web`). | github.com |
| **OVH** | Nom de domaine (DNS pointant vers Vercel). | ovh.com |

Flux : navigateur → **Vercel** (site + routes `/api/*`) → **Railway/Prisma** (demandes) et **Supabase** (comptes + documents).

---

## 2. Variables d'environnement (Vercel → Settings → Environment Variables)

Voir `.env.example` pour la liste complète. Indispensables :

| Variable | Rôle | Secret ? |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL Railway | 🔴 oui |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase (`https://xxx.supabase.co`, **sans** `/rest/v1/`) | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase (navigateur) | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé admin Supabase — **jamais côté navigateur** | 🔴 oui |
| `NEXT_PUBLIC_CODE_PRO` | Code d'accès du back-office `/equipe` | semi |
| `NEXT_PUBLIC_SITE_URL` | Domaine officiel (sitemap, liens) | public |
| `STATUS_TOKEN` | Jeton pour `/api/status` | 🔴 oui |
| `MAINTENANCE_MODE` | `on` pour activer la page de maintenance | – |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` / `NOTIFY_WEBHOOK_URL` | Notifications équipe (optionnel) | 🔴 oui |
| `SMS_API_URL` / `SMS_API_KEY` / `SMS_EXPEDITEUR` | Passerelle SMS (à venir) | 🔴 oui |

**Règle** : les variables `NEXT_PUBLIC_*` sont visibles dans le navigateur → n'y mettre **aucun secret**. Tout le reste reste côté serveur uniquement.

---

## 3. Contrôle de santé — `/api/health` et `/api/status`

### `/api/health` (public, sans donnée sensible)
Contrôle : variables d'env indispensables, base PostgreSQL (Prisma), Supabase Auth.
Réponse : `{ "statut": "OK" | "WARNING" | "ERROR", "checks": {…} }`
- **OK** : tout va bien.
- **WARNING** : service non critique dégradé (ex. Supabase momentanément injoignable).
- **ERROR** : problème critique (base indisponible ou variable manquante) → **HTTP 503**.

C'est la route à surveiller avec un moniteur externe (voir §9).

### `/api/status` (privé)
État détaillé (nombre de demandes, buckets Supabase et leur caractère privé/public, variables présentes). **Protégé** : envoyer l'en-tête `x-status-token: <STATUS_TOKEN>`. Sans le bon jeton → 401. N'expose aucune clé.

Test rapide en local : `npm run sante` (ou `BASE_URL=https://… npm run sante`).

---

## 4. Déploiement

- **Branche de production : `main`.** Vercel déploie automatiquement chaque push sur `main`.
- Les nouveautés se préparent sur une branche dédiée, puis sont fusionnées dans `main`.
- Build : `prisma generate && node scripts/sync-base.js && next build`.
  `sync-base.js` met la base à jour **seulement si** `DATABASE_URL` existe (sinon le build ne casse pas).

### Checklist AVANT une modification importante
- [ ] Créer une **branche dédiée** (`git checkout -b claude/xxx`).
- [ ] `npm run test` (tests unitaires) → vert.
- [ ] `npm run build` en local → réussit.
- [ ] Vérifier qu'aucune vraie clé n'est dans le code (`git grep -iE "eyJ|service_role|password ="`).
- [ ] Sauvegarde base à jour (voir §6) si la structure change.

### Checklist APRÈS déploiement
- [ ] `https://<domaine>/api/health` → `statut: OK`.
- [ ] Ouvrir l'accueil, faire une demande test, vérifier `/equipe`.
- [ ] Tester le dépôt d'un document (Mes documents).
- [ ] Vérifier le cadenas HTTPS (pas de « site non sécurisé »).
- [ ] Vérifier FR **et** arabe (RTL).

---

## 5. Domaine OVH, Vercel et HTTPS

Le HTTPS est **automatique et gratuit** sur Vercel (certificat Let's Encrypt).

**Brancher le domaine OVH :**
1. Vercel → projet → **Settings → Domains** → ajouter `votre-domaine.com` et `www.votre-domaine.com`.
2. Vercel affiche les enregistrements DNS à créer. Chez **OVH → Zone DNS** :
   - Domaine racine (`@`) : un enregistrement **A** vers `76.76.21.21` (IP indiquée par Vercel).
   - `www` : un enregistrement **CNAME** vers `cname.vercel-dns.com`.
3. Attendre la propagation DNS (jusqu'à quelques heures). Vercel émet le certificat tout seul.
4. Dans Vercel, choisir le **domaine principal** (ex. sans `www`) : Vercel **redirige automatiquement** l'autre (`www` → racine) et l'URL `*.vercel.app`.
5. Renseigner `NEXT_PUBLIC_SITE_URL=https://votre-domaine.com` puis redéployer (met à jour le sitemap).

**« Site non sécurisé » / contenu mixte :** le site n'appelle que des ressources en HTTPS. Si le message apparaît, c'est en général que le certificat n'est pas encore émis (attendre) ou que le DNS ne pointe pas encore sur Vercel. Vérifier dans Vercel → Domains que le domaine est « Valid ».

---

## 6. Sauvegardes & restauration

### Base PostgreSQL (Railway) — la donnée critique

> ⚠️ L'onglet **Backups** de Railway est souvent **vide** : les sauvegardes ne
> sont pas activées par défaut (et sont limitées selon l'offre). Ne pas s'y fier
> tel quel.

**Solution en place — sauvegarde automatique quotidienne via GitHub Actions**
(`.github/workflows/sauvegarde-base.yml`) : exporte la base chaque nuit (03:00 UTC),
**chiffre** le fichier (AES-256) et le conserve comme artefact privé (90 jours).

Activation (une seule fois) — GitHub → dépôt → **Settings → Secrets and variables
→ Actions** → ajouter deux secrets :
- `DATABASE_URL` : l'URL PostgreSQL de Railway
- `BACKUP_PASSPHRASE` : un mot de passe secret (à **conserver précieusement** —
  sans lui, impossible de déchiffrer la sauvegarde)

Test immédiat : onglet **Actions** → « Sauvegarde base de données » → **Run workflow**.
Récupérer une sauvegarde : onglet Actions → l'exécution voulue → section **Artifacts**.

**Sauvegarde manuelle** (avant tout changement de structure) :
```bash
pg_dump "$DATABASE_URL" > asm-sauvegarde-$(date +%F).sql
```

**Restauration** :
```bash
# Depuis une sauvegarde chiffrée du workflow :
gpg --batch --passphrase "<BACKUP_PASSPHRASE>" -d asm-AAAA-MM-JJ.sql.gpg > asm.sql
psql "$DATABASE_URL" < asm.sql
# Depuis une sauvegarde manuelle (non chiffrée) :
psql "$DATABASE_URL" < asm-sauvegarde-AAAA-MM-JJ.sql
```

**Stratégie** : sauvegarde quotidienne automatique (ci-dessus) + une sauvegarde
manuelle avant chaque migration Prisma. En complément, activer aussi les backups
Railway si l'offre le permet (défense en profondeur).

### Documents (Supabase Storage)
- Bucket `documents` **privé**. Sauvegarde : Supabase → Storage permet l'export ; sinon script via `SUPABASE_SERVICE_ROLE_KEY` listant/copiant les fichiers. Les métadonnées sont dans la table `document` (incluse dans le dump Postgres Supabase, séparé de Railway).

### Comptes (Supabase Auth) + table `profil`
- Sauvegarde via Supabase → Database → Backups.

> **En cas de perte de données** : ne rien réécrire par-dessus. Restaurer la dernière sauvegarde saine dans une base neuve, vérifier, puis basculer `DATABASE_URL`. Prévenir le responsable technique avant toute manipulation.

---

## 7. En cas de panne — diagnostic rapide

1. Ouvrir `https://<domaine>/api/health`.
   - `statut: ERROR` + `base.ok:false` → **Railway/PostgreSQL** en cause (vérifier Railway, `DATABASE_URL`).
   - `env.manquantes` non vide → une variable Vercel manque → l'ajouter + redéployer.
   - `supabase.ok:false` → Supabase injoignable (comptes/documents dégradés, le reste marche).
2. Vercel → **Deployments** : le dernier déploiement est-il « Ready » ou « Error » ? Voir les **Logs**.
3. `/api/diagnostic` : vérifie la configuration Supabase (documents).
4. Rien ne s'affiche du tout → activer le **mode maintenance** (`MAINTENANCE_MODE=on`) le temps de corriger, puis le retirer.

---

## 8. Rollback (retour arrière rapide)

- **Le plus simple** : Vercel → Deployments → choisir le dernier déploiement stable → **⋯ → Promote to Production** (ou « Rollback »). Remet la version précédente en ligne en quelques secondes, sans toucher au code.
- **Par Git** : `git revert <commit>` puis push sur `main` (recrée proprement l'état antérieur). Ne pas `git push --force` sur `main`.
- Toujours noter dans le message de commit ce qui a été changé, pour savoir quoi annuler.

---

## 9. Monitoring & alertes (à brancher — service externe gratuit)

Le site expose déjà `/api/health`. Il reste à le **surveiller** avec un service externe qui alerte si le site tombe :

**Option simple — UptimeRobot (gratuit) :**
1. Créer un compte sur uptimerobot.com.
2. **Add New Monitor** → type **HTTP(s)** → URL `https://<domaine>/api/health` → intervalle 5 min.
3. Réglage « alerte si le mot-clé est absent » : mot-clé `"statut":"OK"` (alerte dès que ce n'est plus OK).
4. Ajouter un contact d'alerte (email / SMS de l'équipe).

**Option plus complète — Better Stack (Uptime + Logs) :** même principe, plus une page de statut publique et la collecte des logs.

**Erreurs applicatives — Sentry (optionnel) :** pour capturer les erreurs serveur/navigateur.
1. Créer un projet Sentry (Next.js). 2. `npx @sentry/wizard@latest -i nextjs`. 3. Ajouter `SENTRY_DSN` dans Vercel. Les erreurs (déjà journalisées sans données sensibles) y remonteront.

Ce qu'il faut surveiller : site injoignable, `/api/health` ≠ OK, Railway/Supabase down, erreurs serveur répétées (visibles dans les logs Vercel / Sentry).

---

## 10. Sécurité — ce qui est en place

- **En-têtes HTTP** : HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (voir `next.config.js`). En-tête `X-Powered-By` masqué.
- **RLS Supabase** : table `document` et bucket `documents` — chaque patient ne voit que ses fichiers (policies « propriétaire »). Bucket **privé**, accès aux fichiers par **URL signée temporaire** uniquement.
- **Uploads** : limités à PDF / JPG / PNG, taille max **10 Mo** (vérifié côté client ; renforçable par une limite au niveau du bucket Supabase).
- **Route `/api/status`** protégée par jeton ; `/api/resoudre-identifiant` utilise la clé service_role **côté serveur uniquement**.
- **Limitation anti-abus** légère sur `POST /api/demandes` (10/min/IP). Pour une protection distribuée, brancher Upstash Redis / Vercel KV.
- **Logs** : masquage automatique des données sensibles (`lib/log.js`) — téléphone, email, nom, tokens, URLs.
- **À faire plus tard** : Content-Security-Policy (d'abord en mode `report-only` pour ne rien casser), vérifier `SUPABASE_SERVICE_ROLE_KEY` jamais exposée (elle ne l'est pas : aucune variable secrète n'est en `NEXT_PUBLIC_*`).

---

## 11. Mode maintenance

Pour afficher une page de maintenance propre (sans supprimer le site) :
1. Vercel → Environment Variables → `MAINTENANCE_MODE = on`.
2. Redéployer (ou re-déclencher le dernier déploiement).
3. Tout le site affiche `/maintenance` ; `/api/health` reste joignable pour le monitoring.
4. Pour rétablir : remettre `MAINTENANCE_MODE` à vide (ou `off`) + redéployer.

---

## 12. Logs

- Erreurs serveur journalisées via `lib/log.js` en **JSON sur une ligne** (lisible par Vercel / Logtail / Better Stack), avec **masquage** des données sensibles.
- Pas de `console.log` bavard en production (info silencieuse sauf `LOG_VERBOSE=1`).
- Les erreurs critiques des routes `/api/*` sont capturées et renvoient un message générique à l'utilisateur (jamais de détail technique brut).

---

*Voir aussi : `.env.example` (variables), `scripts/verifier-sante.mjs` (test santé), `supabase/*.sql` (structure comptes/documents).*
