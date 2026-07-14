# Agent autonome : flux exact

## Vue d'ensemble

```text
Page de recherche Vinted
  → extension : cartes visibles
  → GPT‑5.6 : classement profit / ROI / vitesse / risque
  → Telegram : meilleurs achats avec liens
  → achat confirmé manuellement

Photos réelles reçues sur Telegram
  → GPT‑5.6 Vision : faits, défauts, prix, annonce, vues manquantes
  → GPT Image 2 : hero + face + dos à partir de toutes les références
  → GPT‑5.6 Vision : audit original ↔ dérivés
  → Telegram : photos + description + bouton Approuver
  → extension : formulaire Vinted + publication conditionnelle

Conversation Vinted ouverte
  → extension : nouveau message
  → GPT‑5.6 : intention + réponse factuelle
  → moteur déterministe : plancher de vente
      offre sous le plancher → contre‑offre/refus automatique
      offre au-dessus       → Telegram Accepter/Contre/Refuser
  → extension : exécution de la décision
```

## 1. Sourcing

L'extension travaille sur les annonces réellement visibles dans la session du navigateur ; le modèle ne prétend pas disposer d'un inventaire Vinted ou de ventes comparables cachées. Chaque carte contient au minimum un lien, un titre et le prix affiché. GPT‑5.6 renvoie un classement structuré `buy | watch | skip`, une revente prudente/attendue/haute, le prix d'achat maximal, la marge, le ROI, la probabilité à 30 jours, les risques et les vérifications avant achat.

Le coût de port et la protection acheteur ne sont fiables que s'ils apparaissent dans la carte extraite. Le système pénalise donc les données manquantes ; l'historique de ventes interne sera la source de calibration la plus utile après les premières transactions.

Endpoint : `POST /api/automation/sourcing/rank`.

## 2. Réception et preuve photo

Une session Telegram conserve au maximum huit identifiants de fichiers pendant 48 heures. Le message conseillé est :

```text
/new
<face, dos, étiquette marque, taille/composition, défauts>
achat 24 €, frais 2 €, profit 18 €, ROI 45, taille M
/go
```

GPT‑5.6 produit une fiche Zod stricte. `readyForGeneration=false` bloque la suite s'il manque une preuve nécessaire. Les originaux Telegram restent la source de vérité ; leurs identifiants ne sont jamais envoyés à l'extension.

## 3. Images d'annonce

GPT Image 2 reçoit toutes les références à chaque édition et produit trois JPEG verticaux. Le prompt interdit explicitement de changer coupe, couleur, texture, logo, étiquette, motif, usure ou défaut. Une deuxième passe GPT‑5.6 compare chaque dérivé à l'ensemble des originaux.

Une image est libérée seulement si :

- chaque rôle a été audité ;
- `garmentChanged=false` ;
- `defectsPreserved=true` ;
- le rapport de chaque image a `passed=true` ;
- l'audit global a `overallPassed=true`.

En cas d'échec, aucune URL n'est placée dans le paquet Vinted. Deux régénérations peuvent être demandées, puis les photos réelles doivent être reprises. Les images validées sont déposées dans Vercel Blob et expirent du workflow Redis après quatorze jours ; le fichier Blob reste disponible selon la politique du store.

## 4. Approbation et publication

Le bouton Telegram **Approuver et publier** fait passer le job de `awaiting_listing_approval` à `approved_for_publish`. L'endpoint `GET /api/automation/package/latest` ne retourne que ce statut. L'extension transforme les URL en fichiers locaux et remplit le formulaire.

La publication automatique est un réglage local, désactivé par défaut. Même activée, elle n'est tentée que si titre, description, prix, photos, catégorie, état et colis ont été trouvés. Une interface modifiée ou un champ non reconnu laisse la page remplie mais non publiée.

## 5. Négociation

Le prix plancher n'est pas décidé par le modèle :

```text
coût total = achat + frais additionnels
plancher profit = coût total + profit minimum
plancher ROI = coût total × (1 + ROI minimum / 100)
plancher final = max(plancher profit, plancher ROI)
```

GPT‑5.6 détecte l'intention et prépare le texte. Le moteur applique ensuite :

- question factuelle, confiance ≥ 82 %, aucune vérification physique : réponse automatique ;
- offre sous 65 % du plancher : refus poli avec meilleur prix ;
- offre sous le plancher : contre‑offre comprise entre plancher et prix affiché ;
- offre au moins égale au plancher : création d'une action durable et notification Telegram ;
- mesure, défaut absent, délai ou ambiguïté : notification, aucune invention.

Une offre approuvée dans Telegram reste `ready_for_extension` jusqu'à ce que la conversation exacte soit ouverte. L'extension compare origine + chemin de l'URL avant toute action, puis accuse réception au serveur.

Endpoints : `POST /api/automation/negotiation/evaluate`, `GET/POST /api/automation/actions/pending`.

## 6. États durables

Les jobs et décisions sont conservés quatorze jours dans Upstash Redis :

```text
analyzing
  → needs_more_photos
  → generating_images
  → auditing_images
  → needs_image_review
  → awaiting_listing_approval
  → approved_for_publish
  → published
```

Chaque sortie externe exige `RESALE_AUTOMATION_SECRET`; Telegram exige son secret de webhook et, si configuré, ignore tout autre `chat_id`.

## 7. Ce qui demande encore une action humaine

- cliquer réellement sur **Acheter** et confirmer paiement/livraison ;
- fournir les photos et le coût d'achat réel ;
- approuver une annonce après visualisation ;
- choisir les offres rentables remontées ;
- résoudre CAPTCHA, authentification ou nouveau champ Vinted.

Sans Vinted Pro, le DOM du navigateur est le seul adaptateur réaliste pour publier et répondre dans une session personnelle. Avec Vinted Pro, un adaptateur API pourra remplacer publication et synchronisation de stock sans changer les schémas, règles de prix, prompts ou Telegram.
