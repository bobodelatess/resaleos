# Restructuration — étape 1 : mémoire centrale PostgreSQL

Cette étape prépare une mémoire centrale pour ResaleOS. Elle ne déplace encore aucune donnée réelle du navigateur ou de Redis. L'objectif est de poser une fondation propre, testable et réversible avant de connecter progressivement les fonctions existantes.

## 1. PostgreSQL, en mots simples

PostgreSQL est un logiciel qui conserve des données structurées de façon durable. On peut l'imaginer comme un ensemble de tableaux reliés entre eux : un article acheté peut être relié à l'annonce qui l'a fait découvrir, à ses photos, à son annonce de vente, à ses conversations et finalement à sa vente.

Contrairement à la mémoire du navigateur, cette base pourra plus tard être consultée par le dashboard, Telegram et l'extension. ResaleOS utilise du PostgreSQL standard : aucun hébergeur particulier n'est imposé.

## 2. Prisma, en mots simples

Prisma est la couche qui permet au code TypeScript de lire et d'écrire dans PostgreSQL sans construire manuellement chaque requête SQL. Le fichier `prisma/schema.prisma` décrit les tableaux, leurs champs, leurs liens et leurs règles d'unicité.

Le « Prisma Client » est généré à partir de ce schéma. Les repositories de `src/lib/database/repositories/` l'utilisent ensuite pour proposer des actions compréhensibles comme créer un article, retrouver un job d'annonce ou lister les offres en attente.

## 3. Pourquoi ResaleOS avait besoin d'une mémoire centrale

Avant cette étape, les données sont séparées :

- le dashboard conserve opportunités, inventaire et ventes dans IndexedDB ou localStorage, donc dans le navigateur utilisé ;
- Telegram, les jobs d'annonce et les offres utilisent Redis ou, en développement, la mémoire temporaire du serveur ;
- l'extension communique avec les routes existantes sans disposer d'un inventaire central partagé.

Cette séparation est encore conservée pour éviter une migration brutale. PostgreSQL fournit maintenant la future destination commune.

## 4. Ce qui a été ajouté

- PostgreSQL 17 pour le développement local dans `docker-compose.yml`, avec volume persistant et contrôle de santé ;
- Prisma 7 et son adaptateur PostgreSQL standard ;
- douze modèles : profils de sourcing, candidats, inventaire, jobs, photos, brouillons, annonces publiées, conversations, messages, décisions d'offre, ventes et événements d'audit ;
- une migration initiale dans `prisma/migrations/20260714120000_init/` ;
- un client Prisma unique et créé seulement au premier besoin ;
- cinq repositories pour le sourcing, l'inventaire, les jobs, les offres et l'audit ;
- des conversions explicites entre les anciens états et les nouveaux états Prisma ;
- un seed de démonstration entièrement fictif ;
- des tests rapides sans service extérieur et des tests PostgreSQL séparés ;
- deux indicateurs dans `GET /api/health` : `databaseConfigured` et `databaseReachable` ;
- une CI GitHub qui génère et valide Prisma, crée les tables dans une base de test, vérifie le seed, puis exécute lint, tests et build.

Les références Telegram d'une photo sont stockées dans `sourceReference`. Une éventuelle adresse publique est stockée séparément dans `publicUrl`. Elles ne peuvent donc pas être confondues.

## 5. Ce qui utilise réellement PostgreSQL maintenant

À la fin de cette étape, PostgreSQL est utilisé uniquement quand on lance :

- les migrations ;
- le seed de démonstration ;
- les tests d'intégration activés avec `RUN_DATABASE_TESTS=true` ;
- les nouveaux repositories depuis du futur code ;
- le contrôle de connexion de `/api/health` lorsque `DATABASE_URL` existe.

Le build reste possible sans `DATABASE_URL`. Dans ce cas, l'endpoint de santé répond explicitement :

```json
{
  "databaseConfigured": false,
  "databaseReachable": false
}
```

Il ne renvoie jamais l'adresse de connexion, l'hôte ou le mot de passe.

## 6. Ce qui utilise encore IndexedDB et Redis

Le dashboard continue de lire et d'écrire ses données dans IndexedDB, avec localStorage comme solution de secours. Telegram, les sessions, les jobs d'annonce et les décisions d'offre continuent d'utiliser Redis ou la mémoire serveur comme avant.

L'extension Chrome/Edge, les routes Vinted, les prompts IA et la génération d'images n'ont pas été branchés à PostgreSQL. Aucune donnée du navigateur n'est importée automatiquement par le seed.

## 7. Lancer PostgreSQL localement

Prérequis : Docker Desktop (ou Docker Engine avec Compose), Node.js 20.19 ou plus récent et npm.

Depuis le dossier du projet :

```bash
npm install
```

Cette commande installe les dépendances et génère automatiquement le Prisma Client.

```bash
cp .env.example .env.local
```

Cette commande crée votre fichier de réglages local, ignoré par Git. Ouvrez ensuite `.env.local` et remplacez la ligne vide `DATABASE_URL=` par l'exemple local déjà commenté dans ce fichier :

```text
DATABASE_URL=postgresql://resaleos:resaleos_dev@127.0.0.1:5432/resaleos?schema=public
```

Ces identifiants sont uniquement destinés au PostgreSQL local de développement.

```bash
docker compose up -d
```

Cette commande télécharge PostgreSQL si nécessaire et le lance en arrière-plan. Les données restent dans le volume Docker `resaleos_postgres_data` après un arrêt normal.

```bash
docker compose ps
```

Cette commande permet de vérifier que le service `postgres` devient `healthy`.

## 8. Créer et appliquer une migration

La migration initiale est déjà incluse. Pour l'appliquer à la base locale :

```bash
npm run db:migrate
```

Prisma compare la base au schéma, crée les tableaux manquants et mémorise que la migration a été appliquée.

Après une future modification de `prisma/schema.prisma`, créez une migration nommée :

```bash
npm run db:migrate -- --name nom_du_changement
```

Le nom doit décrire le changement, par exemple `ajout_couleur_inventaire`. En déploiement et dans la CI, `npm run db:migrate:deploy` applique seulement les migrations déjà validées, sans en inventer une nouvelle.

## 9. Ajouter les données fictives et ouvrir Prisma Studio

Après la migration :

```bash
npm run db:seed
```

Cette commande crée ou met à jour trois éléments clairement marqués « DÉMO » : un profil de recherche, un candidat fictif et l'article d'inventaire lié. Elle peut être relancée sans multiplier ces exemples.

```bash
npm run db:studio
```

Cette commande ouvre une interface locale dans le navigateur pour regarder et modifier les tableaux PostgreSQL. Arrêtez-la avec `Ctrl+C` dans le terminal.

## 10. Lancer les tests

```bash
npm run test
```

Sans base configurée pour les tests, cette commande vérifie les conversions, la structure du schéma et le filtre anti-secrets. Les tests qui écrivent réellement dans PostgreSQL sont alors indiqués comme ignorés, et non comme réussis.

La CI utilise une base séparée nommée `resaleos_test`, applique la migration, vérifie le seed puis active les tests réels des repositories. Ils contrôlent notamment :

- la création et la lecture d'un article ;
- l'impossibilité d'enregistrer deux fois le même candidat ;
- la création d'un job d'annonce ;
- la création d'une décision d'offre ;
- la suppression des tokens, clés et mots de passe avant écriture dans `AuditEvent`.

Pour reproduire ces tests localement sans toucher à la base de développement :

```bash
docker compose exec postgres createdb -U resaleos resaleos_test
DATABASE_URL=postgresql://resaleos:resaleos_dev@127.0.0.1:5432/resaleos_test?schema=public npm run db:migrate:deploy
RUN_DATABASE_TESTS=true DATABASE_URL=postgresql://resaleos:resaleos_dev@127.0.0.1:5432/resaleos_test?schema=public npm run test
```

La première commande n'est nécessaire qu'une fois. Les deux suivantes créent les tables de test puis lancent les tests PostgreSQL contre cette base distincte.

## 11. Arrêter proprement PostgreSQL

```bash
docker compose down
```

Cette commande arrête et retire le conteneur local. Le volume n'est pas supprimé : les données seront retrouvées au prochain `docker compose up -d`.

## 12. Supprimer uniquement les données locales de développement

```bash
docker compose down -v
```

Cette commande arrête PostgreSQL et supprime son volume local. Elle efface définitivement la base locale `resaleos` et l'éventuelle base locale `resaleos_test`, mais ne touche ni à GitHub ni à une base distante. Il faut ensuite relancer PostgreSQL, la migration et éventuellement le seed.

## Ordre complet recommandé pour une première utilisation

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:seed
npm run test
npm run lint
npm run build
```

Entre `cp .env.example .env.local` et `docker compose up -d`, renseignez la `DATABASE_URL` locale comme expliqué plus haut. Aucun secret de production ne doit être ajouté au dépôt.
