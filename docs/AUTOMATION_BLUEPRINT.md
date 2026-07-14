# Architecture d'automatisation réaliste

## Résultat visé

L'opérateur doit pouvoir poser un vêtement, prendre les photos utiles, les envoyer depuis son téléphone et ne plus faire que trois contrôles : vérifier les faits physiques, accepter ou corriger le prix, puis confirmer la publication.

```text
Photos + contexte
       ↓
Canal d'entrée (Telegram aujourd'hui, WhatsApp ensuite)
       ↓
Contrôle qualité photo → vision/OCR → fiche structurée
       ↓
Estimation + risque + annonce + réponses acheteur
       ↓
ResaleOS / assistant navigateur / API Vinted Pro
       ↓
Validation humaine → publication → stock → vente
```

Le cœur ne dépend ni de Telegram ni d'un fournisseur IA. Les données passent par des schémas Zod stricts, ce qui permet de remplacer le modèle ou le canal sans modifier le reste du produit.

## Canaux d'entrée possibles

| Canal | Mise en route | Photos multiples | Automatisation | Usage conseillé |
|---|---:|---:|---:|---|
| Telegram Bot API | Très faible | Oui | Excellente | Premier canal, déjà implémenté |
| WhatsApp Cloud API | Moyenne à forte | Oui | Excellente | Meilleure habitude mobile, après création Meta Business |
| Application web/PWA | Faible | Oui | Excellente | Déjà disponible, utile à l'ordinateur |
| Discord | Faible | Oui | Excellente | Bon canal technique, moins naturel pour un usage personnel |
| Email entrant | Moyenne | Oui | Bonne | Universel mais plus lent et moins conversationnel |
| Dossier cloud surveillé | Moyenne | Oui | Bonne | Traitement par lots, peu adapté aux questions/réponses |

Telegram est le meilleur point de départ : API HTTP officielle, webhooks, réception de photos et aucune création de portefeuille professionnel. WhatsApp Cloud API est prévu comme second adaptateur, mais demande un portefeuille Meta Business, un compte WhatsApp Business et un numéro dédié.

## Chaîne photo

### Ce qui est automatisable sans dégrader la preuve

- vérification du nombre de vues : face, dos, étiquette de marque, taille/composition, défauts, détails distinctifs ;
- détection de flou, sous-exposition, surexposition, mauvais cadrage et doublons ;
- rotation, recadrage, redressement, exposition, balance des blancs et fond neutre ;
- OCR des étiquettes ;
- classement des photos et choix d'une image principale ;
- génération d'une liste exacte des prises manquantes.

### Ce qui ne doit pas être confié à une génération libre

- reconstruire une partie cachée du vêtement ;
- enlever une tache, un trou, des bouloches ou une usure ;
- changer la couleur, la coupe, la texture ou le logo ;
- créer une photo portée qui pourrait faire croire qu'elle représente l'article réel ;
- transformer une supposition en certification d'authenticité.

Les originaux restent la source de vérité. Les images traitées sont des dérivés et le contrat `marketplace-factual` interdit explicitement les retouches trompeuses.

## Choix du moteur IA

Le code utilise Vercel AI SDK et une sortie structurée ; `RESALE_AI_MODEL` sélectionne le modèle sans modifier le code.

| Famille | Point fort pour ce projet | Point à mesurer |
|---|---|---|
| OpenAI vision | Bon équilibre image, raisonnement et JSON structuré | Coût réel sur 6–8 photos |
| Gemini vision | Analyse multi-images et lecture visuelle détaillée | Régularité des descriptions commerciales françaises |
| Claude vision | Analyse conjointe de plusieurs images et rédaction | Prix/latence selon le modèle choisi |

Le bon choix final se fait sur un jeu de 50 à 100 articles réels, pas sur une démonstration. Les métriques utiles sont : marque exacte, taille exacte, rappel des défauts, taux de champ inventé, prix accepté sans correction, temps de réponse et coût par article.

Une stratégie réaliste à terme : modèle économique pour le tri et l'OCR, modèle plus robuste uniquement si la confiance est basse, l'article cher ou le risque d'authenticité élevé.

## Génération de l'annonce

La sortie contient :

- identification et état normalisés ;
- faits visibles, défauts, étiquettes lues et points à vérifier ;
- fourchette de prix prudente/attendue/haute ;
- probabilité de vente sous 30 jours et délai estimé ;
- titre, description, prix et colis ;
- risque, questions vendeur et plan photo.

Les prix produits par un modèle généraliste ne sont pas des comparables temps réel. La prochaine amélioration rentable consiste à alimenter le moteur avec un historique interne de ventes et, lorsqu'une source autorisée existe, des comparables récents. Le moteur financier ResaleOS calcule ensuite le prix d'achat maximal et la décision.

## Publication Vinted

### Sans Vinted Pro — disponible maintenant

1. ResaleOS génère le brouillon et le paquet d'annonce.
2. L'extension locale préremplit photos, titre, description et prix.
3. L'opérateur vérifie catégorie, marque, taille, état, défauts et clique sur **Publier**.

C'est le meilleur compromis actuel : presque toute la saisie disparaît, sans dépendre d'un bot opaque qui casserait dès qu'un sélecteur, une session ou un contrôle anti-automatisation change.

### Automatisation navigateur complète — techniquement possible, mauvais socle

Playwright ou un profil Chrome piloté peut ouvrir une session, remplir les menus et cliquer sur le dernier bouton. Cette solution est fragile face aux changements d'interface, contrôles de session, CAPTCHA, vérifications de compte et variantes régionales. Elle demande une maintenance permanente et peut bloquer un lot au milieu. Elle doit rester un module expérimental, jamais la source de vérité.

### Avec Vinted Pro — cible officielle

La documentation Vinted Pro Integrations prévoit un jeton obtenu dans le portail Pro, la création d'articles par API et des webhooks d'état, notamment publication, vente, commande et étiquette d'expédition. Dès que le compte devient éligible, un adaptateur pourra remplacer l'extension : ResaleOS enverra l'article, suivra le webhook de publication et passera automatiquement le stock à **En vente**.

## Messages acheteur

Trois niveaux sont réalistes :

1. brouillon prêt à copier, déjà disponible avec `/reply` ;
2. envoi automatique uniquement pour les réponses factuelles à haute confiance ;
3. validation obligatoire pour remise, mesure absente, engagement d'expédition, litige ou question d'authenticité.

Sans API de messagerie du compte Vinted, l'envoi automatique dépendrait encore du navigateur. Avec une intégration officielle, le même moteur de réponse peut rester inchangé et seul l'adaptateur d'envoi évolue.

## Sourcing et achat

Le système peut progressivement automatiser :

- collecte d'opportunités depuis alertes, liens partagés et sources autorisées ;
- déduplication, détection de catégorie et estimation du coût complet ;
- classement par profit, ROI, vitesse et risque ;
- génération d'une question vendeur ou d'une offre cible ;
- notification seulement si le prix demandé est inférieur au prix d'achat maximal ;
- ouverture directe de l'annonce retenue.

L'achat totalement automatique est le point le moins robuste : il implique disponibilité en temps réel, adresse, livraison, paiement, vérifications et parfois authentification renforcée. En l'absence d'API acheteur officielle, la meilleure architecture conserve une confirmation de paiement. Le reste — tri, décision, cible de négociation et alerte — peut être entièrement automatisé.

## Données et orchestration

Le premier bot utilise Upstash Redis uniquement pour les sessions de 48 heures : identifiants de photos, contexte et dernière analyse. Les données de gestion restent aujourd'hui dans IndexedDB.

La prochaine étape multi-appareils est une base Postgres :

- `items` : article et état du workflow ;
- `assets` : originaux, dérivés et contrôles photo ;
- `analyses` : modèle, version de prompt, coût, confiance et sortie JSON ;
- `listings` : brouillons, versions, publication et identifiants externes ;
- `messages` : conversation, brouillon, validation et envoi ;
- `events` : historique immuable pour rejouer ou auditer un traitement.

Un stockage objet conserve les photos ; Postgres ne garde que les URL et métadonnées. Chaque génération reçoit un identifiant pour mesurer son coût et corriger les erreurs sans perdre l'historique.

## Sécurité opérationnelle

- aucun secret dans le dépôt ou dans les variables `NEXT_PUBLIC_*` ;
- secret distinct pour l'API web et le webhook Telegram ;
- restriction du bot à `TELEGRAM_ALLOWED_CHAT_ID` ;
- sessions avec expiration ;
- validation Zod de toutes les sorties IA et réponses de fournisseurs ;
- originaux conservés ;
- pas de publication, achat, remise ou promesse irréversible sans règle explicite ;
- journalisation future des décisions et du coût par article.

## Feuille de route

### Phase 1 — immédiatement exploitable

- déployer le projet ;
- brancher AI Gateway et Redis ;
- activer Telegram ;
- connecter l'outil d'images choisi ;
- utiliser l'extension de préremplissage.

### Phase 2 — supprimer les doubles saisies

- Postgres + stockage objet ;
- boîte de réception commune web/Telegram ;
- historique de ventes pour calibrer les prix ;
- files de tâches, retries et suivi du coût IA ;
- règles de réponses automatiques à haute confiance.

### Phase 3 — augmenter le volume

- ingestion d'opportunités autorisées et scoring automatique ;
- comparables et révision de prix ;
- génération d'étiquettes et organisation des lots ;
- adaptateur WhatsApp ;
- intégration Vinted Pro officielle dès éligibilité.

### Phase 4 — optimisation

- apprentissage sur corrections humaines ;
- allocation de capital par catégorie ;
- suivi du taux de vente et du temps passé ;
- baisse automatique des prix selon âge du stock et marge plancher ;
- tableaux de bord de profit net, coût IA et rendement du capital.

## Sources techniques principales

- [Vinted Pro Integrations](https://pro-docs.svc.vinted.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WhatsApp Cloud API officielle de Meta](https://www.postman.com/meta/whatsapp-business-platform/overview)
- [Vercel AI SDK — structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [OpenAI — vision](https://developers.openai.com/api/docs/guides/images-vision)
- [Gemini — image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Claude — vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Upstash Redis REST](https://upstash.com/docs/redis/features/restapi)
