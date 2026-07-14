# ResaleOS

ResaleOS automatise le flux d'achat-revente d'un vêtement, de ses photos jusqu'au brouillon d'annonce et aux réponses acheteur. Le projet fonctionne sans compte Vinted Pro et garde une validation humaine sur l'achat, les faits observés et le dernier clic de publication.

## Flux livré

- application web de décision : coût complet, P10/P50/P90, profit, ROI, prix d'achat maximal, score et recommandation ;
- inventaire : commande, réception, SKU, QR code, emplacement, mise en vente et vente réelle ;
- analyse IA de 1 à 8 photos avec sortie structurée et validée : identification, état, défauts visibles, risques, prix, délai et annonce ;
- génération factuelle du titre, de la description, du prix et de la taille du colis ;
- bot Telegram opérationnel : `/new` → photos → contexte → `/go` → annonce ;
- brouillon de réponse acheteur via `/reply` ;
- adaptateur générique pour un outil externe de détourage ou d'amélioration photo ;
- extension Chrome/Edge qui préremplit photos, titre, description et prix dans la page Vinted ;
- sauvegarde locale IndexedDB et export/import JSON.

## Démarrage local

Prérequis : Node.js 20.9 ou plus récent.

```bash
npm install
cp .env.example .env.local
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000). Pour appeler un modèle depuis la machine locale, renseigne `AI_GATEWAY_API_KEY` dans `.env.local`.

```bash
npm run lint
npm run build
npm run start
```

## Mise en service

Le guide pas à pas est dans [`docs/SETUP.md`](docs/SETUP.md). L'analyse des canaux, des fournisseurs IA, du traitement photo et des niveaux d'automatisation Vinted est dans [`docs/AUTOMATION_BLUEPRINT.md`](docs/AUTOMATION_BLUEPRINT.md).

Les secrets sont documentés dans `.env.example` et ne doivent jamais être commités. En production, l'API d'automatisation refuse les requêtes si `RESALE_AUTOMATION_SECRET` n'est pas configuré.

## Assistant Vinted sans Pro

L'extension se trouve dans [`extensions/vinted-assistant`](extensions/vinted-assistant). Dans ResaleOS, ouvre un article, onglet **Annonce**, puis télécharge **Paquet assistant Vinted**. Charge ce fichier dans l'extension sur la page de création d'annonce.

L'extension ne clique pas sur **Publier**. Elle automatise la saisie répétitive tout en laissant le contrôle final sur les champs réellement affichés par Vinted.

## Structure

- `src/lib/automation/` : schémas, prompts, moteur IA, sessions et canaux ;
- `src/app/api/automation/` : analyse photo, réponses et traitement d'images ;
- `src/app/api/channels/telegram/` : webhook Telegram ;
- `src/lib/finance.ts` : moteur de décision ;
- `src/lib/storage.ts` : IndexedDB et compression d'images ;
- `src/components/` : application opérationnelle ;
- `extensions/vinted-assistant/` : remplissage assisté sans API Vinted ;
- `scripts/` : découverte du chat Telegram et enregistrement du webhook.

## Références officielles

- [Vinted Pro Integrations](https://pro-docs.svc.vinted.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/overview)
- [Vercel AI SDK](https://ai-sdk.dev/docs)
- [Upstash Redis REST](https://upstash.com/docs/redis/features/restapi)
