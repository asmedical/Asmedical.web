# ASM — Assistance Santé Médical · Site web

Site de prise de rendez-vous : espace patient (réservation en 3 étapes)
et espace pro (tableau de bord des demandes en temps réel).

**Stack :** Next.js 14 · Prisma · PostgreSQL (Railway) · Vercel

---

## Déploiement pas à pas (30 minutes)

### Étape 1 — GitHub (héberger le code)
1. Allez sur github.com → bouton **New repository**
2. Nom : `asm-site` · Private · **Create repository**
3. Cliquez **uploading an existing file** et glissez TOUS les fichiers
   de ce dossier (y compris les dossiers app, lib, prisma)
4. **Commit changes**

### Étape 2 — Railway (la base de données)
1. Allez sur railway.app → **New Project** → **Deploy PostgreSQL**
2. Cliquez sur la base créée → onglet **Variables**
3. Copiez la valeur de `DATABASE_URL` (celle qui commence par
   `postgresql://` — prenez la version **publique** : onglet Settings
   → Networking → si besoin, activez "Public Networking",
   puis utilisez `DATABASE_PUBLIC_URL`)

### Étape 3 — Vercel (mettre le site en ligne)
1. Allez sur vercel.com → **Add New → Project**
2. **Import** votre dépôt GitHub `asm-site`
3. Avant de déployer, ouvrez **Environment Variables** et ajoutez :
   - `DATABASE_URL` = l'URL copiée depuis Railway
   - `NEXT_PUBLIC_CODE_PRO` = le code d'accès de votre choix
     pour l'espace pro (ex : un mot de passe simple pour l'instant)
4. Cliquez **Deploy**
5. À la fin, Vercel vous donne l'adresse du site :
   `https://asm-site-xxx.vercel.app`

Le déploiement crée automatiquement la table `Demande` dans la base
(grâce à `prisma db push` dans le script de build).

### Étape 4 — Tester
1. Ouvrez le site → **Espace Patient** → faites une demande test
2. Retournez à l'accueil → **Espace Professionnel** → entrez votre code
3. Votre demande test apparaît dans le tableau de bord 🎉

---

## Ce qui viendra ensuite (phase 2)
- Notification WhatsApp/SMS à l'équipe quand une demande arrive
- Vraie authentification pour l'espace pro (comptes utilisateurs)
- Photos réelles de l'équipe via Cloudinary
- Version arabe (le site est prêt à l'accueillir)
- Nom de domaine personnalisé (ex : asm-dz.com) à brancher sur Vercel

## Structure du projet (maquette ASM V10)
- `app/page.js` — démarrage : choix Espace Patient / Espace Professionnel (fond vert)
- `app/accueil/page.js` — choix du service (transport / aide à domicile / médicaments)
- `app/connexion` · `app/role` · `app/inscription/patient` · `app/inscription/pro` — comptes (simulés pour le MVP, OTP à venir)
- `app/rdv/page.js` — prise de rendez-vous (type de trajet, adresses, récurrence dialyse, notes) → enregistrée en base
- `app/tableau/page.js` — tableau de bord patient
- `app/suivi/page.js` — suivi en direct (démo animée, en attendant le GPS de l'app chauffeur)
- `app/pro/page.js` — espace établissement
- `app/messagerie` · `app/documentation` · `app/connaitre` — messagerie, documents CNAS, présentation
- `app/equipe/page.js` — back-office équipe : dispatch des demandes (code d'accès `NEXT_PUBLIC_CODE_PRO`)
- `app/components/` — bandeau d'appel, header, barre de navigation, assistant, icônes
- `app/providers.js` — état global : langue FR/AR (bascule RTL), espace, connexion
- `lib/i18n.js` — dictionnaire de traduction FR / العربية (une clé, deux valeurs)
- `app/api/demandes/route.js` — API (créer / lire / mettre à jour)
- `prisma/schema.prisma` — le modèle de la base de données
