# ResaleOS

ResaleOS est un agent d'achat‑revente de vêtements piloté depuis Telegram et une extension Chrome/Edge. GPT‑5.6 classe les achats, analyse les photos réelles, génère l'annonce et orchestre les messages ; GPT Image 2 prépare les visuels, qui sont audités contre les originaux avant toute publication.

## Flux livré

- **Sourcing réel** : l'extension extrait jusqu'à 30 annonces visibles dans une page Vinted ; GPT‑5.6 les classe par marge, ROI, rotation et risque puis envoie les meilleures dans Telegram.
- **Réception mobile** : `/new` → photos de contrôle → contexte/coût → `/go`.
- **Annonce** : identification, défauts, fourchette de prix, titre, description, colis et vues manquantes dans une sortie Zod stricte.
- **Photos** : trois vues créées avec `gpt-image-2`, puis audit GPT‑5.6 original ↔ dérivé. Une divergence bloque le workflow.
- **Approbation** : photos et annonce arrivent dans Telegram avec **Approuver / Régénérer / Reprendre**.
- **Publication sans Vinted Pro** : l'extension récupère uniquement le paquet approuvé, remplit le formulaire et peut publier si tous les champs requis sont reconnus.
- **Négociation** : réponses factuelles et contre‑offres sous le plancher automatiques ; offres rentables envoyées dans Telegram avec **Accepter / Contre‑proposer / Refuser**.
- **Gestion** : application web locale pour opportunités, stock, ventes, finance, QR/SKU et export/import.

Le flux exact et ses limites sont décrits dans [docs/AUTONOMOUS_AGENT.md](docs/AUTONOMOUS_AGENT.md). L'étude des canaux et des options d'intégration est dans [docs/AUTOMATION_BLUEPRINT.md](docs/AUTOMATION_BLUEPRINT.md).

## Démarrage local

Prérequis : Node.js 20.9 ou plus récent.

```bash
npm install
cp .env.example .env.local
npm run dev
```

```bash
npm run lint
npm run build
npm run start
```

En local, `AI_GATEWAY_API_KEY` active GPT‑5.6. La génération photo demande aussi `OPENAI_API_KEY` et un store Vercel Blob. En production, Redis est obligatoire pour les jobs et les décisions durables.

## Mise en service

Suis [docs/SETUP.md](docs/SETUP.md). Les secrets restent côté serveur et ne doivent jamais être commités. L'extension conserve uniquement l'URL du déploiement et `RESALE_AUTOMATION_SECRET` dans son stockage local.

## Structure

- `src/lib/automation/` : IA, génération/audit image, règles de négociation, jobs et Telegram ;
- `src/app/api/automation/` : sourcing, analyse, négociation, actions et paquets approuvés ;
- `src/app/api/channels/telegram/` : webhook messages + boutons ;
- `extensions/vinted-assistant/` : sourcing, formulaire, publication et messagerie ;
- `src/lib/finance.ts` : calculs de décision ;
- `src/components/` : application de gestion ;
- `scripts/` : découverte du chat et enregistrement du webhook.

## APIs principales

Toutes les routes d'automatisation exigent `Authorization: Bearer <RESALE_AUTOMATION_SECRET>`.

- `POST /api/automation/sourcing/rank`
- `POST /api/automation/analyze`
- `POST /api/automation/negotiation/evaluate`
- `GET /api/automation/package/latest`
- `POST /api/automation/package/published`
- `GET|POST /api/automation/actions/pending`
- `POST /api/channels/telegram`
- `GET /api/health`

## Références officielles

- [OpenAI — latest model](https://developers.openai.com/api/docs/guides/latest-model)
- [OpenAI — image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [Vinted Pro Integrations](https://pro-docs.svc.vinted.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Vercel AI SDK](https://ai-sdk.dev/docs)
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- [Upstash Redis REST](https://upstash.com/docs/redis/features/restapi)
