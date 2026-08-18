# ASM — Assistance Sociale Médicale

Plateforme médicale algérienne (wilaya d'Alger) : transport sanitaire, aide à
domicile, livraison de médicaments.

---

## À FAIRE EN PREMIER, À CHAQUE SESSION

**Vérifier les connecteurs et rendre compte, sans qu'on te le demande.**

Le client en a assez de tout reconfigurer. Il veut savoir en une fois ce qui
répond et ce qui ne répond pas. Un appel par connecteur, puis un tableau :

| Connecteur | Appel de contrôle |
|---|---|
| Maestro ASM | `list_devices` — un appareil `connected: true` est attendu |
| Metro ASM | `get_connection_status` |
| Playwright ASM | `browser_navigate` vers `https://www.asm-sante.com` |
| Supabase | `list_projects` |
| Vercel ASM | `list_projects` |

Charge-les avec `ToolSearch`. **Ne pas confondre avec les connecteurs du
projet Ba3na**, qui portent des noms voisins : ceux d'ASM finissent par
`asm`.

Un connecteur qui ne répond pas se reconnecte dans Réglages → Connecteurs.
Un connecteur qui répond mais dont la machine est tombée, c'est autre chose —
voir « Le VPS » plus bas.

---

## Comment parler au client

Phrases courtes, pas de jargon, l'essentiel. Quand il demande quelque chose,
le faire — ne pas proposer d'alternative sans l'avoir dit d'abord. Ne pas
inventer d'étapes intermédiaires.

Il travaille depuis son téléphone, en SSH. Chaque commande qu'on lui demande
de taper lui coûte. En regrouper le plus possible, et n'en demander que si
c'est indispensable.

---

## Le projet

- Site : Next.js 14, **JavaScript** (pas TypeScript), déployé sur Vercel à
  chaque push sur `main`
- Application : Expo / React Native dans `mobile/`
- Comptes et documents : Supabase (`pdlczjqncsbpdrzmngkk`)
- Demandes, patients, créneaux : PostgreSQL chez Railway, via Prisma
- Français et arabe, avec sens de lecture inversé en arabe

Le site et l'application sont **une seule et même chose**. Toute
fonctionnalité doit exister des deux côtés, avec la même logique.

**Aucun renvoi de l'application vers le site**, sauf pour supprimer un
compte. Règle posée par le client.

Tests : `npx vitest run`. Ils doivent rester verts avant tout push.

---

## Les pièges qui ont déjà coûté cher

**`eas` empaquette les fichiers du disque, pas un commit.** Un OTA a été
publié depuis un dépôt en retard d'un commit, et seule la ligne « Commit » du
compte rendu le disait. Toujours `git pull` avant, toujours vérifier cette
ligne après.

**Ne jamais créer un compte par `INSERT` direct dans `auth.users`.** Quatre
colonnes de jetons restent à `NULL`, le service d'authentification les lit
comme du texte, et la connexion échoue **avant** de comparer le mot de passe.
C'est ce qui a fait refuser l'application par Apple. Passer par l'API
d'administration Supabase.

**L'identifiant Android `com.asm_sante.twa` ne doit pas être changé.** C'est
un souvenir de l'époque où l'appli habillait le site ; elle est aujourd'hui
native. Le changer créerait une nouvelle fiche Play, ferait repartir les 14
jours de test et perdrait les testeurs.

**Les libellés du parcours servent de clés.** Fenêtres de livraison, besoins
(`b_…`), types de prestation : leurs textes comptent les places restantes.
Ne pas y toucher sans lire `lib/parcours.js` — des créneaux inexistants
s'ouvriraient.

**Ne jamais deviner une option de ligne de commande.** Vérifier dans le
paquet (`npm pack` puis lire le code ou le README) avant de la donner au
client. Deux commandes fausses lui ont déjà fait perdre une soirée.

---

## Le VPS ASM

`51.75.79.165`, 4 cœurs, 7,6 Go. Dépôt cloné dans `~/asm/Asmedical.web`.
**Une session Claude Code ne l'atteint pas en SSH** : tout ce qui touche à la
machine passe par le client.

| Service | Rôle | Port |
|---|---|---|
| `emulateur-asm` | émulateur Android (AVD « asm ») | |
| `surveillance-emulateur` | le relance s'il tombe | |
| `metro-asm` | serveur Expo | 8081 |
| `mcp-maestro` | Maestro | 8765 |
| `mcp-oauth` | passerelle d'authentification | 8766 |
| `mcp-metro` | Metro MCP | 8767 |
| `mcp-playwright` | Playwright MCP | 8769 |
| `caddy` | adresse publique et certificat | |

**L'apk installé sur l'émulateur n'est pas le code du dépôt.** Il embarque
celui du jour de sa compilation, et affichait encore l'ancien formulaire de
réservation supprimé depuis. Pour tester le code à jour :

```bash
bash ~/asm/Asmedical.web/scripts/vps/lancer-app.sh
```

L'application se charge alors depuis Metro. C'est aussi ce qui rend le
connecteur Metro ASM capable de l'inspecter — sans ça il annonce « aucune
application attachée ».

**Une seule commande dit tout** — mémoire, services, émulateur, ports MCP,
adresse publique, processus abandonnés :

```bash
bash ~/asm/Asmedical.web/scripts/vps/verifier-asm.sh
sudo bash ~/asm/Asmedical.web/scripts/vps/verifier-asm.sh --reparer
```

Sans `--reparer`, elle ne touche à rien. Ne pas demander au client cinq
commandes séparées : lui demander celle-là.

La passerelle tient un journal d'une ligne par requête avec le motif des
refus : `journalctl -u mcp-oauth -n 30 --no-pager`. C'est le premier endroit
à regarder quand un connecteur ne s'établit pas.

Ajouter un serveur MCP : `scripts/vps/ajouter-cible.sh <nom> <port>`, puis
redémarrer `mcp-oauth`. **Ne jamais écrire la ligne `CIBLES` à la main** —
elle porte toutes les routes.

**Mémoire.** L'émulateur est déjà tombé trois fois, tué faute de place.
`scripts/vps/sante-vps.sh` pose le fichier d'échange et la surveillance ; il
est rejouable.

---

## Publication

**Android** — rien à télécharger, Expo remet le fichier à Google :

```bash
bash ~/asm/Asmedical.web/scripts/vps/publier-android.sh            # test fermé
bash ~/asm/Asmedical.web/scripts/vps/publier-android.sh production
```

Deux réglages Google conditionnent l'envoi, à faire une fois : le compte de
service `envoi-asm-play@envoi-505717.iam.gserviceaccount.com` doit être
invité dans Play Console comme **Administrateur de versions**, et l'**API
Google Play Android Developer** doit être activée dans le projet Cloud
`envoi-505717`. Sans elle, la compilation réussit et seul l'envoi échoue sur
`PERMISSION_DENIED`.

La piste de test fermé s'appelle **`Asm test`** — avec l'espace et la
majuscule, c'est l'identifiant que renvoie l'API, pas un slug. Une piste
`alpha` existe aussi mais elle est vide : y envoyer échoue sur « Release in
track targeting no countries ». En cas de doute, demander la liste à Google
plutôt que de deviner (`edits.tracks.list`, avec la clé du compte de
service).

**Si l'envoi échoue après une compilation réussie, ne pas recompiler** — les
crédits de compilation sont limités et le fichier existe déjà :

```bash
cd mobile && eas submit --platform android --profile ferme --id <identifiant du build>
```

**Application (OTA)** — `cd mobile && eas update --branch production`.
Ne touche que les appareils en 1.3.0.

**Apple** — voir `mobile/APPLE-VALIDATION.md` : la cause du refus, la requête
de contrôle à rejouer avant chaque envoi, et le texte des notes d'examen.

---

## Où en est la vérification du parcours

**Application — vérifié jusqu'au bouton final, le 18 août 2026.** Déroulé au
complet sur l'émulateur, sur le code de `main` chargé depuis Metro :

| Étape | Résultat |
|---|---|
| 1 · prestation | les sept choix s'affichent, lien urgence présent |
| 2 · lieux | adresses, commune, besoin « fauteuil roulant » retenus |
| 3 · date | jours passés grisés, créneaux 07:00–18:00 chargés depuis la base |
| 4 · récapitulatif | reprend tout sans rien perdre |

**Le bouton « Confirmer la réservation » n'a pas été pressé** : il crée une
vraie demande en production, et sur une plateforme de transport médical cela
peut déclencher une intervention. Décision du client. Ce qui reste donc non
vérifié : `construireDemande()` côté serveur et ce qui arrive réellement en
base.

**Site — jamais vérifié.** Chaque commande Playwright expire à 60 s. Le
journal du service ne montre rien : l'échec est dans l'appel, pas au
démarrage. Deux causes identifiées — bibliothèques système de Chromium
absentes, et navigateur installé pour une autre version de Playwright que
celle qu'embarque `@playwright/mcp`. Correctif :

```bash
sudo bash ~/asm/Asmedical.web/scripts/vps/reparer-playwright.sh
```

**Jamais vérifié non plus** : un soin à domicile avec les actes du
back-office, et une livraison avec ordonnance photographiée — le point le
plus fragile.
