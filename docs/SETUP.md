# Mise en service de ResaleOS

Le chemin recommandé est **GitHub → Vercel → AI Gateway + Upstash → Telegram**. Il donne un bot photo utilisable depuis le téléphone avec peu de configuration et laisse WhatsApp pour une seconde étape.

## 1. Déployer l'application

1. Dans Vercel, importe le dépôt GitHub `bobodelatess/resaleos`.
2. Garde le framework détecté **Next.js** et les commandes par défaut.
3. Active AI Gateway pour le projet. Un déploiement Vercel peut utiliser l'authentification OIDC ; pour un autre hébergeur, crée une clé et renseigne `AI_GATEWAY_API_KEY`.
4. Ajoute une base **Upstash Redis** depuis le Marketplace Vercel et lie-la au projet. Les variables `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` doivent apparaître dans le projet.

## 2. Créer les secrets

Génère deux valeurs distinctes :

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Dans les variables Vercel, configure :

```text
RESALE_AI_MODEL=openai/gpt-5.4
RESALE_AUTOMATION_SECRET=<première valeur>
TELEGRAM_WEBHOOK_SECRET=<seconde valeur>
```

Ne mets jamais ces valeurs dans GitHub. Le secret d'automatisation est demandé une seule fois par l'interface web et reste dans le stockage local du navigateur.

## 3. Créer le bot Telegram

1. Dans Telegram, ouvre `@BotFather`.
2. Envoie `/newbot`, choisis un nom et récupère le jeton.
3. Ajoute temporairement ce jeton dans `.env.local` sur ta machine :

```text
TELEGRAM_BOT_TOKEN=123456:jeton-fourni-par-botfather
```

4. Envoie `/start` à ton nouveau bot.
5. Avant d'enregistrer le webhook, lance :

```bash
npm run telegram:chat-id
```

6. Copie l'identifiant obtenu dans `TELEGRAM_ALLOWED_CHAT_ID`, localement et dans Vercel. Cette restriction empêche d'autres comptes d'utiliser ton budget IA.
7. Ajoute aussi `TELEGRAM_BOT_TOKEN` dans les variables Vercel, puis redéploie.

## 4. Enregistrer le webhook

Dans `.env.local`, renseigne le même `TELEGRAM_WEBHOOK_SECRET` que sur Vercel, puis lance :

```bash
npm run telegram:webhook -- https://ton-projet.vercel.app
```

Teste ensuite dans Telegram :

```text
/new
<envoie 1 à 8 photos>
Prix d'achat 18 €, taille M, petite trace montrée sur la photo 4
/go
```

Pour préparer une réponse à un acheteur après l'analyse :

```text
/reply Bonjour, vous pouvez faire 30 € et envoyer demain ?
```

Le bot demande une validation humaine dès que la réponse implique une remise, une mesure ou un engagement non présent dans la fiche.

## 5. Activer ton outil d'images

ResaleOS expose un contrat fournisseur neutre. Configure :

```text
RESALE_IMAGE_PROCESSOR_URL=https://ton-outil.example/webhook
RESALE_IMAGE_PROCESSOR_SECRET=<secret du webhook>
```

Le webhook reçoit :

```json
{
  "images": ["data:image/jpeg;base64,..."],
  "preset": "marketplace-factual",
  "instructions": {
    "allowed": ["crop", "straighten", "exposure", "white-balance", "neutral-background"],
    "forbidden": ["hide-defect", "change-color", "change-shape", "add-detail", "remove-label"],
    "keepOriginals": true
  }
}
```

Il doit répondre :

```json
{ "images": ["https://url-publique/image-1.jpg"] }
```

Indique le nom de ton outil d'images avant de finaliser cet adaptateur : son schéma d'API sera branché directement derrière cette interface.

## 6. Installer l'assistant Vinted

1. Clone ou télécharge le dépôt.
2. Ouvre `chrome://extensions` ou `edge://extensions`.
3. Active le mode développeur.
4. Charge le dossier `extensions/vinted-assistant` comme extension non empaquetée.
5. Depuis l'onglet **Annonce** de ResaleOS, télécharge le paquet JSON, ouvre la page de création Vinted et charge ce paquet dans l'extension.

L'interface de Vinted évolue : si un champ n'est plus reconnu, le reste continue d'être rempli et l'extension indique ce qu'elle a trouvé.

## Diagnostic

`GET /api/health` indique uniquement si chaque intégration est configurée, sans exposer de secret.

- `aiConfigured` : modèle choisi ;
- `telegramConfigured` : jeton présent ;
- `durableSessionsConfigured` : Redis prêt ;
- `imageProcessorConfigured` : webhook d'images présent.

En production, Redis est nécessaire pour conserver les photos Telegram entre plusieurs appels serveur. Le stockage mémoire n'est destiné qu'au développement local.
