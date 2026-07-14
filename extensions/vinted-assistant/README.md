# Agent Vinted ResaleOS

L'extension Chrome/Edge est l'adaptateur navigateur de ResaleOS lorsqu'aucune API Vinted Pro n'est disponible. Elle ne lit jamais le mot de passe et réutilise uniquement la session Vinted déjà ouverte dans le navigateur.

## Fonctions

- extrait jusqu'à 30 cartes d'une page de recherche et les fait classer par GPT‑5.6 ;
- récupère le dernier paquet approuvé dans Telegram ;
- remplit photos, titre, description, prix et tente les sélecteurs catégorie, marque, taille, état et colis ;
- peut cliquer sur le bouton de publication uniquement si aucun champ obligatoire n'est signalé manquant et si l'option est activée ;
- observe la conversation ouverte, envoie les questions et offres au moteur de négociation et publie les réponses factuelles/contre‑offres autorisées ;
- récupère chaque minute les décisions **Accepter / Contre‑proposer / Refuser** prises dans Telegram et les exécute dans la conversation correspondante.

## Installation

1. Ouvre `chrome://extensions` ou `edge://extensions`.
2. Active le mode développeur.
3. Clique **Charger l'extension non empaquetée**.
4. Sélectionne ce dossier `extensions/vinted-assistant`.
5. Ouvre l'extension et renseigne l'URL HTTPS de ResaleOS ainsi que `RESALE_AUTOMATION_SECRET`.
6. Chrome demande l'autorisation d'accéder à ce domaine précis ; accepte-la. Aucun autre site hors Vinted n'est autorisé en permanence.

Le secret est conservé dans le stockage local de l'extension. Les images sont téléchargées par son service worker, puis injectées comme fichiers dans le formulaire.

## Modes

- **Classer cette page** : analyse immédiate et résultats détaillés dans Telegram.
- **Analyse automatique** : relance le classement quand les cartes visibles changent.
- **Récupérer et remplir** : prend uniquement le dernier job approuvé par ton bouton Telegram.
- **Publication automatique** : désactivée par défaut ; le clic est bloqué si un champ n'a pas pu être renseigné.
- **Messages automatiques** : désactivés par défaut ; les offres rentables restent toujours soumises à Telegram.

## Limites connues

L'interface Vinted peut modifier ses libellés ou composants. Le script cherche les éléments par rôle et texte plutôt que par classes CSS, mais un sélecteur peut devoir être ajusté. Garde la conversation concernée ouverte pour exécuter une décision d'offre. Un CAPTCHA, une confirmation de paiement ou une nouvelle authentification ne sont jamais contournés.
