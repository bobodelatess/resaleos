import { z } from "zod";

const processorResponseSchema = z.object({
  images: z.array(z.string().url()).min(1).max(8),
});

export async function prepareMarketplaceImages(images: string[]): Promise<string[]> {
  const url = process.env.RESALE_IMAGE_PROCESSOR_URL?.trim();
  if (!url) throw new Error("Aucun processeur d'images externe n'est configuré.");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.RESALE_IMAGE_PROCESSOR_SECRET
        ? { Authorization: `Bearer ${process.env.RESALE_IMAGE_PROCESSOR_SECRET}` }
        : {}),
    },
    body: JSON.stringify({
      images,
      preset: "marketplace-factual",
      instructions: {
        allowed: ["crop", "straighten", "exposure", "white-balance", "neutral-background"],
        forbidden: ["hide-defect", "change-color", "change-shape", "add-detail", "remove-label"],
        keepOriginals: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Le processeur d'images a répondu ${response.status}.`);
  }
  return processorResponseSchema.parse(await response.json()).images;
}
