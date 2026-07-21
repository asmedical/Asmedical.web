# ASM — Dossier technique complet & PROMPT ULTIME

> Usage : envoyer à Claude le message « **Lis docs/PROMPT-ULTIME.md puis exécute la
> prochaine phase non réalisée du Prompt Ultime** ». Ce fichier contient tout le
> contexte nécessaire, même pour une session neuve sans mémoire.

---

## PARTIE 1 — Carte d'identité technique du projet

### Plateforme
- **Produit** : ASM — Assistance Sociale Médicale (asm-sante.com). Transport
  sanitaire, aide à domicile (« auxiliaires de santé » à l'affichage), livraison
  de médicaments — Alger, bilingue **FR/AR (RTL)**.
- **Site + API** : Next.js **14.2.35** (App Router, JavaScript, pas de TypeScript),
  dossier `app/` (pages) et `app/api/` (routes serveur). Déploiement **Vercel**
  automatique sur push `main`.
- **Base de données** : PostgreSQL **Railway**, accès via **Prisma**
  (`prisma/schema.prisma`). Le build exécute `scripts/sync-base.js`
  (`prisma db push`) : **pas de fichiers de migration**, le schéma fait foi.
- **Auth & profils** : **Supabase** (OTP SMS via nos passerelles, OTP email,
  OAuth Google/Facebook/Apple, mot de passe). Les profils sont dans la table
  Supabase `profil` (id = uuid user). Stockage fichiers : Supabase Storage,
  bucket privé + URLs signées.
- **Application mobile native** : **Expo SDK 57 / React Native 0.86** dans
  `mobile/` (V1 espace patient). iOS `com.asmsante.app`, Android natif futur =
  mise à jour de l'app Play Store existante (`com.asm_sante.twa`, TWA du site
  actuellement en test fermé). `mobile/eas.json` prêt (profils apercu/production).
  Verrouillage biométrique déjà codé (`mobile/src/verrou.js`).

### Boucle de travail OBLIGATOIRE
1. Développer sur la branche `claude/new-session-e8uwgi` ;
2. `npx next build` (racine) doit passer ; tests reproductibles si le domaine
   touché en a (`scripts/tests/*.mjs`, base locale
   `postgresql://asm:asm@localhost:5432/asmdb`, démarrer avec
   `sudo service postgresql start`) ;
3. Commit (message en français, PAS d'identifiant de modèle IA dedans) ;
4. `git push -u origin claude/new-session-e8uwgi` puis
   `git checkout main && git merge --ff-only claude/new-session-e8uwgi && git push origin main`
   (Vercel déploie) ; revenir sur la branche.

### Conventions du code
- **Tout en français** : noms, commentaires, messages, commits.
- **i18n** : `lib/i18n.js` (web, ~305 clés par langue) et `mobile/src/i18n.js`
  (~112). **Parité FR/AR obligatoire** — vérifier avec le script node d'usage
  (compter les clés des blocs fr/ar, zéro doublon). Les apostrophes françaises
  cassent les heredocs bash : **éditer via script python3**.
- **Argent** : DINARS ENTIERS (DZD), jamais de centimes. Numérotation par
  `SequenceFinance` (upsert increment). Tarifs versionnés non rétroactifs
  (montants copiés dans les factures).
- **Téléphones** : comparaison INSENSIBLE au format via `lib/telephones.js`
  (chiffres uniquement, clé = 8 derniers chiffres).
- **Sécurité (règles absolues)** : aucune clé/secret dans le code ou GitHub
  (variables d'environnement Vercel uniquement) ; jamais stocker de données
  bancaires ; une redirection navigateur n'est JAMAIS une confirmation de
  paiement (webhooks signés) ; mots de passe jamais en clair ni visibles ;
  toutes les permissions revérifiées CÔTÉ SERVEUR ; actions sensibles
  journalisées (`prisma.journal`) ; anti-abus via `lib/ratelimit` (`autorise`).
- **Rôles** : internes `superadmin | admin | moderateur | standardiste`
  (`lib/adminAuth.js` : `verifierAdmin`, `refus`, `journaliser`,
  ROLES_GESTION_EQUIPE = superadmin seul, ROLES_GESTION_INTERVENANTS =
  +admin+modérateur) ; employés `aide_soignant (affiché « auxiliaire de
  santé ») | infirmier | chauffeur | transporteur | coordinateur |
  employe_interne` ; clients `patient` et `pro` (établissement). Ne JAMAIS
  renommer les codes internes des rôles.
- **Contact officiel** : +213 5 64 49 33 48 (constantes `TEL_AFFICHE`,
  `TEL_LIEN`, `WHATSAPP_LIEN` = wa.me/213564493348) — ne jamais coder en dur
  ailleurs que dans ces constantes.

### Modèles Prisma existants (ne pas dupliquer !)
`Demande` (réservations : service, typeTrajet, date texte AAAA-MM-JJTHH:MM,
statuts A_RAPPELER→TERMINEE/ANNULEE, prioritaire, parEtablissement/parEtabUserId,
soignantId/transporteurId, finLe…), `Soignant`, `Transporteur` (véhicule,
couleur, immatriculation), `Abonnement` (récurrences de transport), `TypeActe`,
`Message` (messagerie), `Notification`, `Rattachement` (**procurations
établissement/proche↔patient, avec code de validation — base du « réserver pour
un proche »**), `PushAbonnement` (web-push), `Avis` (**évaluations existantes**),
`DocumentEmploye`, `DemandeSuppression` (validation superadmin), `NoteInterne`,
`Journal` (**journal d'activité existant**), `Reglage` (capacités, horaires,
`affectationAuto` — **affectation automatique existante**, `facturationAuto`),
`OtpCanal`, et le module financier complet : `SequenceFinance, CompteFinancier
(modeFacturation prestation|mensuel), Tarif, Facture, LigneFacture (demandeId),
Paiement (idempotence), TicketEspeces (QR usage unique), Remboursement,
RemiseClient, PointPaiement, EvenementPaiement, PlanAbonnement, Souscription,
RelancePaiement`.

### Modules serveur clés
- `lib/finances.js` : cœur financier (factures, remises plafonnées par rôle
  — admin max 20 %/2000 DZD, remboursement admin max 5000 DZD —, facturation
  auto à la clôture `facturerDemande`, mensuelle groupée `facturerMensuel`,
  relevés `releveCompte`, estimation `estimerPrestation`).
- `lib/paiements/index.js` : moyens selon env (espèces toujours ; Chargily
  CIB/EDAHABIA si `CHARGILY_SECRET_KEY` ; virement si `VIREMENT_ACTIF=1`).
  Webhook `app/api/webhooks/chargily` signé HMAC, idempotent.
- `lib/sms/` : routage n° algérien → Elite SMS (API v2.1.0,
  `application/x-www-form-urlencoded`, `function=sms_send`, succès
  `{status:"success",result:"<id>"}`) ; sinon Twilio (non configuré) ; WhatsApp
  Cloud API préparé (`asm_code`) ; `mock` sinon. Diagnostic + test superadmin :
  `/api/admin/sms-test` et Admin→Réglages.
- `lib/disponibilites.js` : **moteur de créneaux multi-ressources existant**
  (plannings soignants/transporteurs, capacités de repli, tampon, fenêtres).
- `lib/pushEnvoi.js` : notifications push web (VAPID).
- Exports CSV : `/api/admin/exports` (demandes, clients, établissements, paie,
  encaissements, impayés, journal espèces).

### Variables d'environnement (noms seulement, valeurs dans Vercel)
`DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
NEXT_PUBLIC_SITE_URL, ELITESMS_API_KEY, ELITESMS_USER_KEY, [ELITESMS_BASE_URL],
[SMS_PROVIDER], [TWILIO_*], [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_LANGUE], OTP_TEST_CODE (mode test, à
retirer au lancement), [CHARGILY_SECRET_KEY, CHARGILY_MODE],
[VIREMENT_ACTIF/BANQUE/TITULAIRE/RIB], NEXT_PUBLIC_VAPID_PUBLIC_KEY,
VAPID_PRIVATE_KEY, ANDROID_PACKAGE_NAME, ANDROID_ASSETLINKS_SHA256,
[CRON_SECRET] (protège /api/rappels, envoyé par le cron Vercel),
[WHATSAPP_TEMPLATE_RAPPEL] (modèle utilitaire Meta approuvé — active le
canal WhatsApp des rappels de rendez-vous), [MAPS_PROVIDER] (réservé)`.

### État au 25/07/2026
Play Store : test fermé actif (12 testeurs, fin ~31/07). Apple : adhésion en
cours. Meta/WhatsApp : vérification d'identité en attente. Encore en démo :
code OTP 123456, grille tarifaire par défaut, Chargily/virement non branchés,
points de paiement vides.

---

## PARTIE 2 — LE PROMPT ULTIME (exécution par phases)

**Mission** : faire d'ASM la plateforme de référence du secteur en développant
les fonctionnalités ci-dessous — réelles, branchées à la base, sans régression.

### Règles d'exécution
1. **Analyser avant d'écrire** : lire ce fichier, `prisma/schema.prisma`, les
   libs concernées et les pages touchées. Pour CHAQUE fonctionnalité demandée,
   d'abord établir : EXISTE DÉJÀ / PARTIEL (étendre) / NOUVEAU. Interdiction de
   dupliquer un modèle ou un module existant.
2. **Une phase = un lot cohérent** livré complet : schéma (`prisma db push`),
   API (permissions serveur + journal + ratelimit), UI web (desktop + mobile,
   FR/AR, parité i18n vérifiée), app Expo si pertinent, tests reproductibles
   dans `scripts/tests/`, build, déploiement (boucle Partie 1), puis un
   rapport en français : fichiers modifiés, changements de schéma, nouvelles
   variables d'environnement, tests exécutés et résultats, actions manuelles
   restantes pour le propriétaire.
3. **Aucune régression** : les 3 suites financières existantes doivent rester
   vertes (`test-finances.mjs`, `test-facturation-auto.mjs`,
   `test-finances-etab.mjs`).
4. Prendre les meilleures initiatives techniques SANS changer l'architecture
   (pas de nouveau framework, pas de TypeScript, pas de refonte).
5. À la fin de chaque phase, mettre à jour la section « Suivi » ci-dessous
   (cocher, dater) et committer ce fichier avec le reste.

### Phases

**PHASE 1 — Cercle familial** ✅ *base existante : `Rattachement`*
Réserver pour un proche en 2 touches (sélecteur de proches sur /rdv), comptes
familiaux (liste « Mes proches » dans /compte : rattachements type proche,
invitation par téléphone + code existant), tableau de bord Famille (rendez-vous
et suivis des proches autorisés), compte-rendu de fin d'intervention notifié
aux proches autorisés (notification interne + push + email si dispo).

**PHASE 2 — Personnalisation du soin**
Choix homme/femme de l'auxiliaire à la réservation (champ `genre` sur Soignant
+ préférence sur la demande, respectée par l'affectation auto), intervenant
favori (préférence patient, priorité à l'affectation), notes & préférences
patient (champ structuré sur profil : allergies, étage, code porte, consignes —
visibles intervenant affecté uniquement), évaluation des intervenants
(*existant : `Avis` — étendre à une note par intervenant + moyenne sur fiche
admin*), signalement d'un problème (bouton sur suivi → NoteInterne + alerte
admin).

**PHASE 3 — Documents & ordonnances**
Coffre-fort documentaire patient (bucket privé existant : page « Mes
documents », catégories ordonnance/compte-rendu/facture), scan et classement
des ordonnances (upload → rattachée à la demande de livraison), renouvellement
en 1 bouton de la dernière commande de médicaments, signature électronique
simple (signature tactile enregistrée en fin d'intervention par l'employé,
image liée à la demande — valeur de preuve interne).

**PHASE 4 — Offre commerciale**
Packs de prestations nommés avec prix (table `Pack` reliée aux tarifs,
affichage public + réservation), demande de devis (formulaire → file admin →
devis PDF via le moteur de documents existant), abonnements mensuels
(*existant : PlanAbonnement/Souscription — créer les offres « Sérénité » et
brancher l'UI publique*), fidélité/parrainage/codes promo (table `CodePromo` +
crédit parrain/filleul en RemiseClient, plafonds serveur).

**PHASE 5 — Trajet temps réel**
GPS chauffeur + heure d'arrivée estimée (position envoyée par l'app employé
pendant la mission — page employé existante —, affichée sur le suivi patient ;
sans clé Google : distance/temps à vol d'oiseau + vitesse moyenne, prévoir
`MAPS_PROVIDER` en option), déclenchement du trajet retour par le patient
(bouton « Je suis prêt » sur le suivi d'un aller-retour → notification
chauffeur + admin), liste d'attente intelligente (créneau complet → inscription
en attente, notification auto si libération), disponibilités temps réel et
affectation auto : *existants — vérifier et renforcer seulement*.

**PHASE 6 — Espace pro & pilotage**
Tableau de bord Établissement enrichi (statistiques transports/patients/mois,
factures mensuelles, relevés — bases existantes), gestion multi-établissements
(un groupe → plusieurs sites, `groupeId` sur profil pro), statistiques avancées
admin (graphiques activité/finances sur `/admin/stats` existant), exports
Excel/PDF (*CSV existants — ajouter XLSX via génération simple et PDF via les
documents HTML imprimables*), journal d'activité (*existant `Journal` — écran
admin de consultation filtrable*), optimisation des tournées chauffeurs
(regroupement géographique des missions du jour par commune + ordre suggéré).

**PHASE 7 — Communication & assistance**
Chat famille/patient/établissement (*existant : `Message` — étendre aux fils
par demande avec participants autorisés*), rappels de rendez-vous automatiques
(la veille + 2 h avant : notification interne, push, SMS Elite si crédit,
WhatsApp quand configuré), notifications WhatsApp transactionnelles (modèles
utilitaires Meta après validation du compte), assistant IA patient (*existant :
`app/components/assistant.js` règles simples — améliorer les scénarios guidés
FR/AR sans dépendance externe*).

**PHASE 8 — Préparation lancement**
Compte de démonstration permanent pour examens Google/Apple (numéro dédié
whitelisté serveur), retrait `OTP_TEST_CODE`, intégration future
assurances/mutuelles (champ « pris en charge par » sur Demande + convention
sur CompteFinancier + part assureur sur Facture — préparer le modèle, pas
d'intégration technique externe), revue de sécurité complète, mise à jour du
dossier banque.

### Suivi
- [x] Phase 1 — Cercle familial (25/07/2026 — 20 tests dédiés, suites 23+15+23 vertes)
- [x] Phase 2 — Personnalisation du soin (25/07/2026 — 13 tests dédiés, 81 tests antérieurs verts)
- [x] Phase 3 — Documents & ordonnances (25/07/2026 — 18 tests dédiés, 94 tests antérieurs verts)
- [x] Phase 4 — Offre commerciale (25/07/2026 — 23 tests dédiés, 112 tests antérieurs verts)
- [x] Phase 5 — Trajet temps réel (25/07/2026 — 32 tests dédiés, 135 tests antérieurs verts)
- [x] Phase 6 — Espace pro & pilotage (25/07/2026 — 31 tests dédiés, 167 tests antérieurs verts)
- [x] Phase 7 — Communication & assistance (25/07/2026 — 29 tests dédiés, 198 tests antérieurs verts)
- [ ] Phase 8 — Préparation lancement
