import { allStickers, paniniWorldCup2026Catalog } from "@/catalog/panini-world-cup-2026";
import type { Sticker, StickerFilters, StickerStatus, UserStateMap } from "@/types/panini";

export function getStickerStatus(quantity: number | null | undefined): StickerStatus {
  if (!quantity || quantity <= 0) return "missing";
  if (quantity === 1) return "owned";
  return "duplicate";
}

export function normalizeQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.floor(quantity));
}

export function getQuantity(userState: UserStateMap, stickerId: string) {
  return normalizeQuantity(userState[stickerId] ?? 0);
}

function matchesFilters(sticker: Sticker, filters: StickerFilters = {}) {
  const query = filters.query?.trim().toLowerCase();

  if (filters.sectionId && filters.sectionId !== "all" && sticker.sectionId !== filters.sectionId) return false;
  if (filters.countryCode && filters.countryCode !== "all" && sticker.countryCode !== filters.countryCode) return false;
  if (filters.type && filters.type !== "all" && sticker.type !== filters.type) return false;
  if (filters.onlyFoil && !sticker.isFoil) return false;
  if (filters.onlyPlayers && sticker.type !== "player") return false;
  if (query) {
    const haystack = [
      sticker.reference,
      sticker.title,
      sticker.sectionName,
      sticker.countryCode,
      sticker.countryNameEs,
      sticker.type
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function getMissingStickers(stickers: Sticker[], userState: UserStateMap, filters?: StickerFilters) {
  return stickers.filter((sticker) => getQuantity(userState, sticker.id) === 0 && matchesFilters(sticker, filters));
}

export function getDuplicateStickers(stickers: Sticker[], userState: UserStateMap, filters?: StickerFilters) {
  return stickers.filter((sticker) => getQuantity(userState, sticker.id) > 1 && matchesFilters(sticker, filters));
}

export function getFilteredStickers(stickers: Sticker[], filters?: StickerFilters) {
  return stickers.filter((sticker) => matchesFilters(sticker, filters));
}

export function getUserProgress(stickers: Sticker[], userState: UserStateMap) {
  const totalBaseStickerCount = paniniWorldCup2026Catalog.album.baseStickerCount;
  const ownedUniqueCount = stickers.filter((sticker) => getQuantity(userState, sticker.id) >= 1).length;
  const duplicateUniqueCount = stickers.filter((sticker) => getQuantity(userState, sticker.id) > 1).length;
  const totalDuplicateCopies = stickers.reduce((total, sticker) => Math.max(0, getQuantity(userState, sticker.id) - 1) + total, 0);
  const missingCount = totalBaseStickerCount - ownedUniqueCount;

  return {
    totalBaseStickerCount,
    ownedUniqueCount,
    missingCount,
    duplicateUniqueCount,
    totalDuplicateCopies,
    completionPercentage: (ownedUniqueCount / totalBaseStickerCount) * 100
  };
}

export function getProgressBySection(stickers: Sticker[], userState: UserStateMap) {
  return paniniWorldCup2026Catalog.sections.map((section) => {
    const sectionStickers = stickers.filter((sticker) => sticker.sectionId === section.id);
    const owned = sectionStickers.filter((sticker) => getQuantity(userState, sticker.id) >= 1).length;

    return {
      sectionId: section.id,
      sectionName: section.name,
      total: sectionStickers.length,
      owned,
      missing: sectionStickers.length - owned,
      percentage: sectionStickers.length === 0 ? 0 : (owned / sectionStickers.length) * 100
    };
  });
}

export function getProgressByCountry(stickers: Sticker[], userState: UserStateMap) {
  return paniniWorldCup2026Catalog.countries.map((country) => {
    const countryStickers = stickers.filter((sticker) => sticker.countryCode === country.code);
    const owned = countryStickers.filter((sticker) => getQuantity(userState, sticker.id) >= 1).length;

    return {
      countryCode: country.code,
      countryNameEs: country.nameEs,
      total: countryStickers.length,
      owned,
      missing: countryStickers.length - owned,
      percentage: countryStickers.length === 0 ? 0 : (owned / countryStickers.length) * 100
    };
  });
}

export function compareUsersForTrades(userAState: UserStateMap, userBState: UserStateMap, stickers: Sticker[] = allStickers) {
  const aCanOffer = stickers.filter((sticker) => getQuantity(userAState, sticker.id) > 1 && getQuantity(userBState, sticker.id) === 0);
  const bCanOffer = stickers.filter((sticker) => getQuantity(userBState, sticker.id) > 1 && getQuantity(userAState, sticker.id) === 0);
  const suggestedTrades = aCanOffer.slice(0, Math.min(aCanOffer.length, bCanOffer.length)).map((fromA, index) => ({
    fromA,
    fromB: bCanOffer[index]
  }));

  return {
    aCanOffer,
    bCanOffer,
    suggestedTrades
  };
}

export function stateRowsToMap(rows: Array<{ sticker_id?: string; stickerId?: string; quantity: number }>): UserStateMap {
  return rows.reduce<UserStateMap>((state, row) => {
    const stickerId = row.stickerId ?? row.sticker_id;
    if (stickerId) state[stickerId] = normalizeQuantity(row.quantity);
    return state;
  }, {});
}
