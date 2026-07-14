import { put } from "@vercel/blob";
import OpenAI, { toFile } from "openai";
import type { AutomationImage } from "./ai";
import type { GarmentAnalysis } from "./schemas";

export interface GeneratedImageBuffer {
  role: "hero" | "front" | "back";
  bytes: Uint8Array;
  mediaType: "image/jpeg";
}

const ROLE_INSTRUCTIONS: Record<GeneratedImageBuffer["role"], string> = {
  hero:
    "Vue principale verticale, vêtement entier disposé proprement à plat, cadrage vendeur premium mais réaliste.",
  front:
    "Vue de face verticale, vêtement entièrement visible à plat, symétrie naturelle sans modifier sa coupe.",
  back:
    "Vue de dos verticale, vêtement entièrement visible à plat. Si le dos n'est pas prouvé par une photo de référence, conserve la vue réelle la plus informative sans l'inventer.",
};

function openAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY est requis pour générer les images d'annonce.");
  return new OpenAI({ apiKey });
}

async function imageBytes(image: AutomationImage): Promise<Uint8Array> {
  if (typeof image.data === "string" || image.data instanceof URL) {
    const response = await fetch(String(image.data), { cache: "no-store" });
    if (!response.ok) throw new Error(`Lecture d'une photo impossible (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }
  if (image.data instanceof ArrayBuffer) return new Uint8Array(image.data);
  return image.data;
}

async function referenceFiles(images: AutomationImage[]) {
  return Promise.all(
    images.map(async (image, index) =>
      toFile(await imageBytes(image), `reference-${index + 1}.jpg`, {
        type: image.mediaType || "image/jpeg",
      }),
    ),
  );
}

function generationPrompt(
  role: GeneratedImageBuffer["role"],
  analysis: GarmentAnalysis,
): string {
  const facts = {
    identification: analysis.identification,
    visibleFacts: analysis.inspection.visibleFacts,
    visibleDefects: analysis.inspection.visibleDefects,
    labelsRead: analysis.inspection.labelsRead,
  };
  return `Prépare une photographie fidèle de l'article réel montré dans TOUTES les images de référence.

Objectif : ${ROLE_INSTRUCTIONS[role]}

Fond uni blanc cassé ou gris très clair, lumière douce naturelle, ombres légères, rendu photo de smartphone soigné. L'article doit occuper environ 80 % de l'image.

CONTRAINTE ABSOLUE : ne change pas la couleur, la forme, la coupe, les proportions, la texture, le motif, les coutures, les boutons, les fermetures, le logo, les inscriptions, les étiquettes, l'usure ou les défauts. Ne nettoie, ne répare et ne complète rien. N'ajoute aucun cintre, accessoire, mannequin, personne, texte, watermark ou emballage. Si une partie n'est pas visible dans les références, ne l'invente pas et privilégie une composition réellement prouvée.

Faits déjà relevés, uniquement pour éviter une dérive : ${JSON.stringify(facts)}`;
}

export async function createListingImages({
  references,
  analysis,
}: {
  references: AutomationImage[];
  analysis: GarmentAnalysis;
}): Promise<GeneratedImageBuffer[]> {
  if (references.length < 1 || references.length > 8) {
    throw new Error("La génération nécessite entre 1 et 8 photos de référence.");
  }
  const client = openAIClient();
  const roles: GeneratedImageBuffer["role"][] = ["hero", "front", "back"];

  return Promise.all(
    roles.map(async (role) => {
      const response = await client.images.edit({
        model: process.env.RESALE_IMAGE_MODEL?.trim() || "gpt-image-2",
        image: await referenceFiles(references),
        prompt: generationPrompt(role, analysis),
        n: 1,
        background: "opaque",
        quality: "medium",
        size: "1024x1536",
        output_format: "jpeg",
        output_compression: 90,
      });
      const encoded = response.data?.[0]?.b64_json;
      if (!encoded) throw new Error(`GPT Image n'a pas renvoyé l'image ${role}.`);
      return {
        role,
        bytes: Uint8Array.from(Buffer.from(encoded, "base64")),
        mediaType: "image/jpeg" as const,
      };
    }),
  );
}

export async function uploadListingImages(
  jobId: string,
  images: GeneratedImageBuffer[],
): Promise<Array<GeneratedImageBuffer & { url: string }>> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error(
      "Vercel Blob n'est pas configuré. Ajoute BLOB_READ_WRITE_TOKEN avant la génération.",
    );
  }
  return Promise.all(
    images.map(async (image) => {
      const blob = await put(
        `resaleos/listings/${jobId}/${image.role}.jpg`,
        Buffer.from(image.bytes),
        {
          access: "public",
          contentType: image.mediaType,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
        },
      );
      return { ...image, url: blob.url };
    }),
  );
}
