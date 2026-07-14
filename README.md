# ResaleOS

ResaleOS est un poste de pilotage local pour l’achat-revente, utilisable sans compte Vinted Pro. Il transforme une annonce repérée en décision chiffrée, puis suit l’article jusqu’à la vente.

## Ce qui fonctionne déjà

- analyse d’une opportunité avec coût complet : article, protection acheteur, port entrant et préparation ;
- scénarios de revente P10, P50 et P90 ;
- calcul automatique du profit, du ROI, du prix d’achat maximal, de la cible de négociation et d’un score sur 100 ;
- recommandation `Acheter`, `Négocier` ou `Ignorer` selon tes propres seuils ;
- pipeline `À étudier → Commandé → Reçu → En vente → Vendu` ;
- réception avec génération d’un SKU, emplacement de stockage et QR code ;
- stockage et compression locale des photos ;
- brouillon d’annonce factuel, modifiable et copiable ;
- suivi du prix réellement encaissé et du profit réalisé ;
- tableau de bord, inventaire, ventes et paramètres ;
- sauvegarde automatique dans le navigateur, export et import JSON ;
- interface responsive et installable comme application web.

Toutes les données restent dans le navigateur. Aucun compte Vinted, serveur ou abonnement IA n’est nécessaire pour cette version.

## Lancer l’application

Prérequis : Node.js 20.9 ou plus récent.

```bash
npm install
npm run dev
```

Ouvre ensuite [http://localhost:3000](http://localhost:3000).

Pour tester exactement la version de production :

```bash
npm run build
npm run start
```

## Utilisation recommandée

1. Ouvre une annonce qui semble intéressante.
2. Dans ResaleOS, clique sur **Nouvelle analyse** et reporte les informations visibles.
3. Ajuste les trois hypothèses de revente puis laisse le système appliquer tes seuils.
4. Ne passe l’article à **Commandé** qu’après le paiement réel.
5. À la livraison, clique sur **Réceptionner l’article** : le SKU et le QR code sont créés.
6. Ajoute tes vraies photos, génère le brouillon puis publie-le sur Vinted.
7. À la vente, saisis le montant réellement encaissé.

La démonstration initiale contient plusieurs articles fictifs. Tu peux la recharger ou repartir de zéro depuis **Paramètres**.

## Limites actuelles

Sans connecteur de compte autorisé, la détection des nouvelles annonces, l’achat, la messagerie et la publication finale restent manuels. ResaleOS n’effectue ni scraping, ni action automatique sur un compte Vinted. Il automatise aujourd’hui la décision, les calculs, le stock, les textes et la mesure des résultats.

La prochaine couche prévue peut ajouter :

- un adaptateur vers ton outil d’IA pour lire les photos et préremplir les champs ;
- une capture rapide depuis le navigateur ou le presse-papiers ;
- des alertes de sourcing ;
- un connecteur Vinted Pro ou une autre intégration officiellement disponible ;
- une synchronisation chiffrée entre plusieurs appareils.

## Scripts

```bash
npm run dev      # développement
npm run lint     # qualité du code
npm run build    # export statique dans out/
npm run start    # sert localement le dossier out/
```

## Structure

- `src/lib/finance.ts` : moteur de décision et formules financières ;
- `src/lib/storage.ts` : persistance IndexedDB et sauvegardes ;
- `src/lib/listing.ts` : génération factuelle des annonces ;
- `src/components/` : dashboard et parcours opérationnels ;
- `public/sw.js` : fonctionnement de type PWA après compilation.

