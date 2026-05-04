import { allStickers } from "@/catalog/panini-world-cup-2026";
import type { User, UserStateMap } from "@/types/panini";

export const demoUsers: User[] = [
  {
    id: "demo-andres",
    name: "Andres",
    email: "andres@example.com",
    createdAt: new Date("2026-05-01T12:00:00.000Z").toISOString()
  },
  {
    id: "demo-valentina",
    name: "Valentina",
    email: "valentina@example.com",
    createdAt: new Date("2026-05-01T12:00:00.000Z").toISOString()
  }
];

export function buildDemoState(seed: number): UserStateMap {
  return allStickers.reduce<UserStateMap>((state, sticker, index) => {
    if ((index + seed) % 7 === 0) state[sticker.id] = 2;
    else if ((index + seed) % 3 === 0) state[sticker.id] = 1;
    return state;
  }, {});
}

export const demoStates: Record<string, UserStateMap> = {
  "demo-andres": buildDemoState(1),
  "demo-valentina": buildDemoState(5)
};
