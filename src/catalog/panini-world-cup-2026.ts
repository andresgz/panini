import type { AlbumCatalog, Sticker, StickerType } from "@/types/panini";

export const paniniWorldCup2026Catalog: AlbumCatalog = {
  album: {
    id: "panini-fifa-world-cup-2026",
    name: "Panini FIFA World Cup 2026 Sticker Album",
    year: 2026,
    baseStickerCount: 980
  },
  sections: [
    {
      id: "intro",
      name: "Introduccion",
      stickerRefs: ["000", "FWC001", "FWC002", "FWC003", "FWC004", "FWC005", "FWC006", "FWC007", "FWC008"]
    },
    { id: "teams", name: "Selecciones" },
    {
      id: "museum",
      name: "FIFA Museum",
      stickerRefs: ["FWC009", "FWC010", "FWC011", "FWC012", "FWC013", "FWC014", "FWC015", "FWC016", "FWC017", "FWC018", "FWC019"]
    }
  ],
  countries: [
    { code: "MEX", id: "mexico", nameEs: "Mexico" },
    { code: "RSA", id: "sudafrica", nameEs: "Sudafrica" },
    { code: "KOR", id: "corea-del-sur", nameEs: "Corea del Sur" },
    { code: "CZE", id: "chequia", nameEs: "Chequia" },
    { code: "CAN", id: "canada", nameEs: "Canada" },
    { code: "BIH", id: "bosnia-y-herzegovina", nameEs: "Bosnia y Herzegovina" },
    { code: "QAT", id: "catar", nameEs: "Catar" },
    { code: "SUI", id: "suiza", nameEs: "Suiza" },
    { code: "BRA", id: "brasil", nameEs: "Brasil" },
    { code: "MAR", id: "marruecos", nameEs: "Marruecos" },
    { code: "HAI", id: "haiti", nameEs: "Haiti" },
    { code: "SCO", id: "escocia", nameEs: "Escocia" },
    { code: "USA", id: "estados-unidos", nameEs: "Estados Unidos" },
    { code: "PAR", id: "paraguay", nameEs: "Paraguay" },
    { code: "AUS", id: "australia", nameEs: "Australia" },
    { code: "TUR", id: "turquia", nameEs: "Turquia" },
    { code: "GER", id: "alemania", nameEs: "Alemania" },
    { code: "CUW", id: "curazao", nameEs: "Curazao" },
    { code: "CIV", id: "costa-de-marfil", nameEs: "Costa de Marfil" },
    { code: "ECU", id: "ecuador", nameEs: "Ecuador" },
    { code: "NED", id: "paises-bajos", nameEs: "Paises Bajos" },
    { code: "JPN", id: "japon", nameEs: "Japon" },
    { code: "SWE", id: "suecia", nameEs: "Suecia" },
    { code: "TUN", id: "tunez", nameEs: "Tunez" },
    { code: "BEL", id: "belgica", nameEs: "Belgica" },
    { code: "EGY", id: "egipto", nameEs: "Egipto" },
    { code: "IRN", id: "iran", nameEs: "Iran" },
    { code: "NZL", id: "nueva-zelanda", nameEs: "Nueva Zelanda" },
    { code: "ESP", id: "espana", nameEs: "Espana" },
    { code: "CPV", id: "cabo-verde", nameEs: "Cabo Verde" },
    { code: "KSA", id: "arabia-saudita", nameEs: "Arabia Saudita" },
    { code: "URU", id: "uruguay", nameEs: "Uruguay" },
    { code: "FRA", id: "francia", nameEs: "Francia" },
    { code: "SEN", id: "senegal", nameEs: "Senegal" },
    { code: "IRQ", id: "irak", nameEs: "Irak" },
    { code: "NOR", id: "noruega", nameEs: "Noruega" },
    { code: "ARG", id: "argentina", nameEs: "Argentina" },
    { code: "ALG", id: "argelia", nameEs: "Argelia" },
    { code: "AUT", id: "austria", nameEs: "Austria" },
    { code: "JOR", id: "jordania", nameEs: "Jordania" },
    { code: "POR", id: "portugal", nameEs: "Portugal" },
    { code: "COD", id: "republica-democratica-del-congo", nameEs: "Republica Democratica del Congo" },
    { code: "UZB", id: "uzbekistan", nameEs: "Uzbekistan" },
    { code: "COL", id: "colombia", nameEs: "Colombia" },
    { code: "ENG", id: "inglaterra", nameEs: "Inglaterra" },
    { code: "CRO", id: "croacia", nameEs: "Croacia" },
    { code: "GHA", id: "ghana", nameEs: "Ghana" },
    { code: "PAN", id: "panama", nameEs: "Panama" }
  ]
};

const sectionNameById = new Map(paniniWorldCup2026Catalog.sections.map((section) => [section.id, section.name]));

function getTeamStickerType(number: number): StickerType {
  if (number === 1) return "team_logo";
  if (number === 13) return "team_photo";
  return "player";
}

function getTeamStickerTitle(countryName: string, number: number, type: StickerType) {
  if (type === "team_logo") return `${countryName} - Escudo ${String(number).padStart(3, "0")}`;
  if (type === "team_photo") return `${countryName} - Foto de equipo ${String(number).padStart(3, "0")}`;
  return `${countryName} - Jugador ${String(number).padStart(3, "0")}`;
}

export function expandAlbumCatalog(catalog: AlbumCatalog = paniniWorldCup2026Catalog): Sticker[] {
  const introStickers =
    catalog.sections
      .find((section) => section.id === "intro")
      ?.stickerRefs?.map((reference, index) => ({
        id: reference === "000" ? "intro-000" : `intro-${reference.toLowerCase()}`,
        reference,
        sectionId: "intro",
        sectionName: sectionNameById.get("intro") ?? "Introduccion",
        number: index,
        title: reference === "000" ? "Lamina inicial del album" : `Introduccion - ${reference}`,
        type: reference === "000" ? ("host" as const) : ("intro" as const),
        isFoil: reference === "000"
      })) ?? [];

  const teamStickers = catalog.countries.flatMap((country) =>
    Array.from({ length: 20 }, (_, index) => {
      const number = index + 1;
      const reference = `${country.code}${String(number).padStart(3, "0")}`;
      const type = getTeamStickerType(number);

      return {
        id: `team-${country.code.toLowerCase()}-${String(number).padStart(3, "0")}`,
        reference,
        sectionId: "teams",
        sectionName: sectionNameById.get("teams") ?? "Selecciones",
        countryId: country.id,
        countryCode: country.code,
        countryNameEs: country.nameEs,
        number,
        title: getTeamStickerTitle(country.nameEs, number, type),
        type,
        isFoil: number === 1
      };
    })
  );

  const museumStickers =
    catalog.sections
      .find((section) => section.id === "museum")
      ?.stickerRefs?.map((reference, index) => ({
        id: `museum-${reference.toLowerCase()}`,
        reference,
        sectionId: "museum",
        sectionName: sectionNameById.get("museum") ?? "FIFA Museum",
        number: index + 9,
        title: `FIFA Museum - ${reference}`,
        type: "museum" as const,
        isFoil: false
      })) ?? [];

  return [...introStickers, ...teamStickers, ...museumStickers];
}

export const allStickers = expandAlbumCatalog();

export function getAllStickers() {
  return allStickers;
}

export function getStickerById(id: string) {
  return allStickers.find((sticker) => sticker.id === id);
}

export function getStickerByReference(reference: string) {
  const normalized = reference.trim().toUpperCase();
  return allStickers.find((sticker) => sticker.reference === normalized);
}
