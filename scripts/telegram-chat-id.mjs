import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Ajoute TELEGRAM_BOT_TOKEN dans .env.local.");
  process.exitCode = 1;
} else {
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const body = await response.json();
  if (!body.ok) {
    console.error(body.description || "Telegram a refusé la requête.");
    process.exitCode = 1;
  } else {
    const chats = new Map();
    for (const update of body.result || []) {
      const message = update.message || update.edited_message || update.channel_post;
      if (message?.chat?.id) chats.set(String(message.chat.id), message.chat);
    }
    if (!chats.size) {
      console.log("Aucun message trouvé. Envoie /start au bot puis relance cette commande avant d'enregistrer le webhook.");
    } else {
      for (const [id, chat] of chats) {
        console.log(`${id} — ${chat.username || chat.title || chat.first_name || "conversation"}`);
      }
    }
  }
}
