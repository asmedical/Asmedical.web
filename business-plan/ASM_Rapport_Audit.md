# ASM — Rapport d'audit du dossier fonctionnel

**Date : juillet 2026 · Version 1.0**

## Méthode
- Audit du dépôt complet (routes, rôles, pages, API) avant les captures.
- Environnement de **démonstration 100 % local**, séparé de la production : base de données locale,
  comptes et données **fictifs** (Mahmoud Benali, Centre de dialyse Alger, Sabrina Laziri,
  Karim Mansouri, Amine Haddad…). Aucune donnée réelle, aucun secret à l'écran.
- Captures automatisées avec Playwright (`scripts/business-plan-screenshots/`) :
  22 captures, desktop 1440×1000 et mobile 390×844. Chaque image porte une mention centrale
  indiquant que les données sont fictives.

## Opérationnel (vérifié par tests)
- Réservation temps réel des 3 prestations (moteur de disponibilités testé : zones, horaires,
  congés, durées, tampons, trajets, capacité des fenêtres, anti-double réservation).
- Affectation manuelle avec refus motivé en cas de conflit + option d'affectation automatique.
- Espace employé (missions, progression horodatée, documents) ; espace chauffeur avec véhicule.
- Suivi patient en direct + véhicule (modèle, couleur, plaque) + notifications + push + avis.
- Messagerie, diffusion, notifications, documents (liens signés).
- Procurations patient-établissement (4 méthodes, contrôle serveur à chaque réservation, révocation).
- Centre de gestion desktop : tableau de bord, planning, demandes, fiches patient/établissement,
  fiches employés RH, équipe & privilèges, journal d'audit, exports CSV (dont paie super admin).
- Gouvernance : hiérarchie des rôles, suppressions soumises à validation du super admin,
  création de comptes clients avec mot de passe à la première connexion.
- E-mails transactionnels (Brevo) : récupération de compte, invitations.

## Développé et intégré — activation externe en cours
- **SMS de connexion** : routage automatique Elite SMS (numéros algériens) / Twilio (international).
  Le code est prêt et testé ; l'envoi réel dépend de l'activation du compte opérateur.
- **Code par WhatsApp** : intégration WhatsApp Cloud API avec repli SMS automatique ;
  nécessite le compte WhatsApp Business (Meta) et un modèle d'authentification approuvé.
- **Connexions rapides Google / Facebook / Apple** : intégrées (boutons pilotés par configuration) ;
  nécessite le paramétrage de chaque fournisseur (Apple : compte développeur payant).

## Prévu, non développé
- Application mobile native, géolocalisation GPS/OBD des véhicules, statistiques avancées.

## Reproduire les captures
```
node scripts/business-plan-screenshots/seed-demo.js   # données fictives locales
npx next dev -p 3100                                  # site local
node scripts/business-plan-screenshots/capture.mjs    # 22 captures
node scripts/business-plan-screenshots/pdf.mjs        # PDF final
```
