import albumContent from "@/catalog/panini-world-cup-2026-album.json";
import type { Sticker } from "@/types/panini";

type AlbumContentSticker = {
  id: string;
  reference: string;
  rawReference?: string;
  sectionId: string;
  sectionName: string;
  group?: string;
  countryCode?: string;
  countryNameEs?: string;
  number?: number;
  title: string;
  type: string;
  isFoil?: boolean;
  sortOrder?: number;
};

const contentStickers = albumContent.stickers as AlbumContentSticker[];

function normalizeReference(reference: string) {
  return reference
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]+)0+(\d+)$/, "$1$2")
    .replace(/^0+(\d+)$/, "$1");
}

const contentById = new Map(contentStickers.map((sticker) => [sticker.id, sticker]));
const contentByReference = new Map<string, AlbumContentSticker>();

contentStickers.forEach((sticker) => {
  contentByReference.set(normalizeReference(sticker.reference), sticker);
  if (sticker.rawReference) contentByReference.set(normalizeReference(sticker.rawReference), sticker);
});

export function getStickerContent(sticker: Sticker) {
  return contentById.get(sticker.id) ?? contentByReference.get(normalizeReference(sticker.reference));
}

export function getStickerDisplayTitle(sticker: Sticker) {
  return getStickerContent(sticker)?.title ?? sticker.title;
}

export function getStickerContentDescription(sticker: Sticker) {
  const content = getStickerContent(sticker);
  if (!content) return "Contenido pendiente en el catalogo";

  if (content.type === "player") return `Jugador: ${content.title}`;
  if (content.type === "team_logo") return `Escudo: ${content.countryNameEs ?? sticker.countryNameEs ?? "Seleccion"}`;
  if (content.type === "team_photo") return `Foto de equipo: ${content.countryNameEs ?? sticker.countryNameEs ?? "Seleccion"}`;
  return content.title;
}
