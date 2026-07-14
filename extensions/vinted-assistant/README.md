# Assistant Vinted ResaleOS

Cette extension Chrome/Edge charge un paquet JSON exporté depuis l'onglet **Annonce** de ResaleOS et tente de préremplir les photos, le titre, la description et le prix sur la page de création Vinted.

## Installation locale

1. Ouvre `chrome://extensions` ou `edge://extensions`.
2. Active le mode développeur.
3. Clique sur **Charger l'extension non empaquetée**.
4. Sélectionne ce dossier `extensions/vinted-assistant`.

## Utilisation

1. Dans ResaleOS, ouvre un article, onglet **Annonce**, puis télécharge **Paquet assistant Vinted**.
2. Ouvre la page de création d'annonce Vinted.
3. Clique sur l'extension ResaleOS, charge le fichier JSON, puis clique sur **Remplir la page**.
4. Vérifie manuellement chaque champ, complète les sélecteurs que Vinted n'a pas exposés comme champs texte et publie toi-même.

Vinted peut modifier son interface sans préavis. Le script cherche les champs par leurs libellés plutôt que par des classes CSS, mais un ajustement peut rester nécessaire. Il ne clique jamais sur le bouton de publication.
