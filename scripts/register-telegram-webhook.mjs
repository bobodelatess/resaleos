import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const deploymentUrl = process.argv[2]?.replace(/\/$/, "");

if (!token || !secret || !deploymentUrl) {
  console.error(
    "Usage : configure TELEGRAM_BOT_TOKEN et TELEGRAM_WEBHOOK_SECRET dans .env.local, puis npm run telegram:webhook -- https://ton-domaine.fr",
  );
  process.exitCode = 1;
} else if (!deploymentUrl.startsWith("https://")) {
  console.error("Telegram exige une URL publique HTTPS.");
  process.exitCode = 1;
} else {
  const webhookUrl = `${deploymentUrl}/api/channels/telegram`;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const body = await response.json();
  if (!body.ok) {
    console.error(body.description || "Telegram a refusé le webhook.");
    process.exitCode = 1;
  } else {
    console.log(`Webhook enregistré : ${webhookUrl}`);
  }
}
