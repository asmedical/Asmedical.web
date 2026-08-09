# Parcours Maestro — application ASM

Ces parcours vérifient la STRUCTURE de l'application : les écrans attendus
existent, portent les bons libellés et mènent où il faut.

## Règle absolue : aucune écriture

L'application est branchée sur la production (`https://www.asm-sante.com`,
base Supabase réelle). Ces parcours ne créent donc **aucun compte**,
n'envoient **aucun message** et ne déposent **aucun document** : ils
s'arrêtent avant toute validation. Un test ne doit jamais laisser de trace
dans les données d'un vrai patient.

## Exécution

    maestro test mobile/tests/            # tout
    maestro test mobile/tests/demarrage.yaml

Depuis le serveur MCP Maestro, `run` avec `dir: mobile/tests` et le
`device_id` de l'émulateur.
