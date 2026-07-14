# Architecture d'automatisation réaliste

## Résultat visé

L'opérateur doit pouvoir recevoir une sélection d'achats, envoyer les photos réelles depuis son téléphone et ne garder que trois décisions : acheter, approuver l'annonce et choisir une offre rentable.

```text
Photos + contexte
       ↓
Canal d'entrée (Telegram aujourd'hui, WhatsApp ensuite)
       ↓
Contrôle qualité photo → vision/OCR → fiche structurée
       ↓
GPT Image 2 → audit de fidélité original/dérivé
       ↓
Annonce + extension Vinted + moteur de négociation
       ↓
Telegram pour les seules décisions intéressantes
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

Telegram est le meilleur point de départ et il est implémenté : API HTTP officielle, photos, boutons inline et webhooks. WhatsApp Cloud API reste un second adaptateur réaliste, mais demande un portefeuille Meta Business, un compte WhatsApp Business et un numéro dédié.

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

Les originaux restent la source de vérité. Le flux principal crée désormais trois dérivés avec GPT Image 2 puis demande à GPT‑5.6 de comparer chaque dérivé à toutes les références. Une seule image refusée bloque le paquet complet. L'adaptateur `marketplace-factual` reste disponible pour un autre fournisseur.

## Choix du moteur IA

Le code utilise Vercel AI SDK et une sortie structurée ; `RESALE_AI_MODEL` sélectionne le modèle texte/vision sans modifier le code. La valeur livrée est `openai/gpt-5.6`. `gpt-image-2` est appelé directement avec plusieurs références pour les visuels.

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

1. Telegram approuve un job dont toutes les images ont passé l'audit.
2. L'extension récupère ce job côté serveur et remplit photos, titre, description, prix, puis tente catégorie, marque, taille, état et colis.
3. Si l'option est activée et qu'aucun champ requis ne manque, elle clique sur **Publier** et accuse réception au serveur.

Le DOM reste fragile : si un sélecteur n'est plus reconnu, la publication est bloquée mais les champs trouvés restent remplis.

### Automatisation navigateur complète — techniquement possible, mauvais socle

Playwright ou un profil Chrome piloté peut ouvrir une session, remplir les menus et cliquer sur le dernier bouton. Cette solution est fragile face aux changements d'interface, contrôles de session, CAPTCHA, vérifications de compte et variantes régionales. Elle demande une maintenance permanente et peut bloquer un lot au milieu. Elle doit rester un module expérimental, jamais la source de vérité.

### Avec Vinted Pro — cible officielle

La documentation Vinted Pro Integrations prévoit un jeton obtenu dans le portail Pro, la création d'articles par API et des webhooks d'état, notamment publication, vente, commande et étiquette d'expédition. Dès que le compte devient éligible, un adaptateur pourra remplacer l'extension : ResaleOS enverra l'article, suivra le webhook de publication et passera automatiquement le stock à **En vente**.

## Messages acheteur

Trois niveaux sont implémentés :

1. `/reply` pour un brouillon manuel ;
2. envoi automatique par l'extension pour les réponses factuelles à haute confiance et les contre‑offres sous le plancher ;
3. décision Telegram pour une offre rentable, une mesure absente ou un fait à vérifier.

Sans API de messagerie du compte Vinted, l'envoi dépend de la conversation ouverte dans le navigateur. Une intégration officielle remplacerait seulement cet adaptateur.

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

Le bot utilise Upstash Redis pour les sessions photo de 48 heures et pour les jobs/actions de 14 jours. Les données de gestion restent aujourd'hui dans IndexedDB.

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

### Phase 1 — livrée, à configurer

- GPT‑5.6 et GPT Image 2 ;
- Redis + Blob ;
- Telegram avec boutons ;
- sourcing sur page visible ;
- génération/audit des images ;
- extension de publication et de négociation.

### Phase 2 — consolider les données

- Postgres + stockage objet ;
- boîte de réception commune web/Telegram ;
- historique de ventes pour calibrer les prix ;
- files de tâches, retries et suivi du coût IA ;
- historique des réponses automatiques et taux de correction.

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
