export type StickerType =
  | "intro"
  | "host"
  | "team_logo"
  | "player"
  | "team_photo"
  | "museum";

export type StickerStatus = "missing" | "owned" | "duplicate";

export type Sticker = {
  id: string;
  reference: string;
  sectionId: string;
  sectionName: string;
  countryId?: string;
  countryCode?: string;
  countryNameEs?: string;
  number?: number;
  title: string;
  type: StickerType;
  isFoil?: boolean;
};

export type User = {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
};

export type UserStickerState = {
  userId: string;
  stickerId: string;
  quantity: number;
  updatedAt: string;
};

export type UserStateMap = Record<string, number>;

export type AlbumSection = {
  id: string;
  name: string;
  stickerRefs?: string[];
};

export type CountryDefinition = {
  id: string;
  code: string;
  nameEs: string;
};

export type AlbumCatalog = {
  album: {
    id: "panini-fifa-world-cup-2026";
    name: string;
    year: 2026;
    baseStickerCount: 980;
  };
  sections: AlbumSection[];
  countries: CountryDefinition[];
};

export type StickerFilters = {
  sectionId?: string;
  countryCode?: string;
  type?: StickerType | "all";
  query?: string;
  onlyFoil?: boolean;
  onlyPlayers?: boolean;
};
