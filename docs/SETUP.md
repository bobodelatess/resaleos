# Mise en service de ResaleOS

Le chemin recommandé est **GitHub → Vercel → AI Gateway + Blob + Upstash → Telegram → extension**. Un abonnement ChatGPT ne fournit pas une clé API : GPT‑5.6/GPT Image 2 sont facturés via les intégrations serveur configurées ici.

## 1. Déployer

1. Dans Vercel, importe `bobodelatess/resaleos`.
2. Garde Next.js et les commandes détectées.
3. Active **AI Gateway** pour le projet.
4. Dans Vercel Marketplace, ajoute **Upstash Redis** et lie-le au projet.
5. Ajoute un store **Vercel Blob** public. Vercel injecte normalement `BLOB_READ_WRITE_TOKEN`.

Upstash conserve les états et décisions pendant quatorze jours. Blob rend les trois images validées accessibles à Telegram et à l'extension.

## 2. Configurer les modèles

Dans Vercel, ajoute :

```text
RESALE_AI_MODEL=openai/gpt-5.6
RESALE_IMAGE_MODEL=gpt-image-2
OPENAI_API_KEY=<clé API OpenAI côté serveur>
RESALE_DEFAULT_MIN_PROFIT=15
RESALE_DEFAULT_MIN_ROI=40
```

AI Gateway peut utiliser l'OIDC du projet ; hors Vercel, configure `AI_GATEWAY_API_KEY`. L'API Images utilise actuellement `OPENAI_API_KEY` directement afin d'envoyer plusieurs fichiers de référence à `images.edit`. Selon le compte, OpenAI peut demander la vérification de l'organisation avant l'utilisation des modèles d'image.

## 3. Créer les secrets

Génère deux valeurs différentes :

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Ajoute-les dans Vercel :

```text
RESALE_AUTOMATION_SECRET=<première valeur>
TELEGRAM_WEBHOOK_SECRET=<seconde valeur>
```

Ne les place ni dans GitHub ni dans une variable `NEXT_PUBLIC_*`.

## 4. Créer Telegram

1. Ouvre `@BotFather`, envoie `/newbot` et récupère le jeton.
2. Ajoute `TELEGRAM_BOT_TOKEN` dans Vercel et temporairement dans `.env.local`.
3. Envoie `/start` à ton bot.
4. Lance localement `npm run telegram:chat-id`.
5. Copie l'identifiant dans `TELEGRAM_ALLOWED_CHAT_ID` sur Vercel.
6. Redéploie le projet.
7. Avec le même secret local que dans Vercel, enregistre le webhook :

```bash
npm run telegram:webhook -- https://ton-projet.vercel.app
```

Le script inscrit les mises à jour `message` et `callback_query`, indispensables aux boutons de décision.

## 5. Vérifier le serveur

Ouvre :

```text
https://ton-projet.vercel.app/api/health
```

Le flux complet demande :

```json
{
  "imageGenerationConfigured": true,
  "telegramConfigured": true,
  "durableSessionsConfigured": true,
  "autonomousWorkflowReady": true
}
```

Les booléens n'exposent aucune valeur secrète.

## 6. Installer l'extension

1. Télécharge ou clone le dépôt.
2. Ouvre `chrome://extensions` ou `edge://extensions`.
3. Active le mode développeur.
4. Charge `extensions/vinted-assistant` comme extension non empaquetée.
5. Dans son panneau, saisis :
   - l'URL `https://ton-projet.vercel.app` ;
   - la valeur de `RESALE_AUTOMATION_SECRET`.
6. Laisse d'abord **publication automatique** et **messages automatiques** désactivés pour le test initial.

## 7. Test de bout en bout

Dans Telegram :

```text
/new
<envoie face, dos, étiquette, taille/composition, défauts>
achat 18 €, frais 2 €, profit 15 €, ROI 40, taille M
/go
```

Résultat attendu :

1. analyse de l'article ;
2. trois photos générées ;
3. audit de fidélité ;
4. photos et annonce dans Telegram ;
5. bouton **Approuver et publier**.

Après approbation, ouvre la page de création d'annonce Vinted, puis clique **Récupérer et remplir Vinted** dans l'extension. Vérifie les champs reconnus. Active ensuite les automatismes voulus.

## 8. Tester le sourcing

Ouvre une page de résultats Vinted avec plusieurs cartes. Dans l'extension, fixe budget, profit et ROI puis clique **Classer cette page**. Le classement détaillé et les liens doivent arriver dans Telegram. L'analyse automatique peut ensuite être activée.

## 9. Tester les messages

1. Garde l'annonce approuvée comme dernier paquet de l'extension.
2. Active **Réponses et contre‑offres automatiques**.
3. Ouvre la conversation Vinted concernée.
4. Une question factuelle peut recevoir une réponse automatique.
5. Une offre sous le plancher reçoit une contre‑offre ; une offre rentable arrive dans Telegram.
6. Après ton bouton, laisse la bonne conversation ouverte ou clique **Exécuter mes décisions Telegram**.

## Diagnostic

- `401 Accès refusé` : le secret de l'extension et celui de Vercel diffèrent.
- aucune réponse Telegram : vérifie `TELEGRAM_ALLOWED_CHAT_ID`, le webhook et les logs Vercel.
- génération image refusée : vérifie `OPENAI_API_KEY`, la vérification de l'organisation et Vercel Blob.
- job perdu entre deux requêtes : vérifie les deux variables Upstash REST.
- champs Vinted manquants : recharge l'extension et l'onglet ; si l'interface a changé, ajuste les termes dans `content.js`.
- décision offre non exécutée : ouvre exactement l'URL de conversation enregistrée puis relance la synchronisation.

L'ancien endpoint `/api/automation/images` reste disponible comme adaptateur vers `RESALE_IMAGE_PROCESSOR_URL`, mais le workflow Telegram principal utilise GPT Image 2 + audit de fidélité.
