"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction, type SyntheticEvent } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleMinus,
  CirclePlus,
  Copy,
  Download,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  Repeat2,
  Save,
  Search,
  Settings,
  Share2,
  Sticker,
  Upload,
  UserPlus,
  X,
  type LucideIcon
} from "lucide-react";
import { allStickers, paniniWorldCup2026Catalog } from "@/catalog/panini-world-cup-2026";
import {
  getDuplicateStickers,
  getFilteredStickers,
  getMissingStickers,
  getProgressByCountry,
  getProgressBySection,
  getQuantity,
  getStickerStatus,
  getUserProgress,
  normalizeQuantity
} from "@/lib/inventory";
import { getStickerDisplayTitle } from "@/lib/sticker-content";
import { createSupabaseClient, hasSupabaseConfig, signInWithGoogle, signOut } from "@/lib/supabase";
import type { Sticker as StickerModel, StickerFilters, StickerType, User, UserStateMap } from "@/types/panini";

type View = "dashboard" | "album" | "missing" | "duplicates" | "compare" | "settings";
type AlbumSortMode = "album" | "alphabetical";
type AssistantMarkMode = "owned" | "missing";
type TradeStatus = "requested" | "accepted" | "completed";

type TradeProcess = {
  id: string;
  requesterId: string;
  friendId: string;
  requestedStickerIds: string[];
  offeredStickerIds: string[];
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

type AssistantGroup = {
  id: string;
  label: string;
  image: string;
  stickers: StickerModel[];
};

type InventoryBackup = {
  schemaVersion: 1;
  exportedAt: string;
  album: typeof paniniWorldCup2026Catalog.album;
  user: {
    id: string;
    name: string;
    email?: string;
  };
  stickers: Array<{
    stickerId: string;
    reference: string;
    quantity: number;
  }>;
};

const typeLabels: Record<StickerType, string> = {
  intro: "Intro",
  host: "Anfitrion",
  team_logo: "Escudo",
  player: "Jugador",
  team_photo: "Equipo",
  museum: "Museum"
};

const statusLabels = {
  missing: "Faltante",
  owned: "Obtenida",
  duplicate: "Repetida"
};

const views: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "album", label: "Album", icon: Sticker },
  { id: "missing", label: "Faltantes", icon: ListChecks },
  { id: "duplicates", label: "Repetidas", icon: Repeat2 },
  { id: "compare", label: "Cambios", icon: ArrowDownUp },
  { id: "dashboard", label: "Estadísticas", icon: LayoutDashboard },
  { id: "settings", label: "Configuración", icon: Settings }
];

const countryFlagByCode: Record<string, string> = {
  MEX: "🇲🇽",
  RSA: "🇿🇦",
  KOR: "🇰🇷",
  CZE: "🇨🇿",
  CAN: "🇨🇦",
  BIH: "🇧🇦",
  QAT: "🇶🇦",
  SUI: "🇨🇭",
  BRA: "🇧🇷",
  MAR: "🇲🇦",
  HAI: "🇭🇹",
  SCO: "🏴",
  USA: "🇺🇸",
  PAR: "🇵🇾",
  AUS: "🇦🇺",
  TUR: "🇹🇷",
  GER: "🇩🇪",
  CUW: "🇨🇼",
  CIV: "🇨🇮",
  ECU: "🇪🇨",
  NED: "🇳🇱",
  JPN: "🇯🇵",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  BEL: "🇧🇪",
  EGY: "🇪🇬",
  IRN: "🇮🇷",
  NZL: "🇳🇿",
  ESP: "🇪🇸",
  CPV: "🇨🇻",
  KSA: "🇸🇦",
  URU: "🇺🇾",
  FRA: "🇫🇷",
  SEN: "🇸🇳",
  IRQ: "🇮🇶",
  NOR: "🇳🇴",
  ARG: "🇦🇷",
  ALG: "🇩🇿",
  AUT: "🇦🇹",
  JOR: "🇯🇴",
  POR: "🇵🇹",
  COD: "🇨🇩",
  UZB: "🇺🇿",
  COL: "🇨🇴",
  ENG: "🏴",
  CRO: "🇭🇷",
  GHA: "🇬🇭",
  PAN: "🇵🇦"
};

function AppLogo() {
  const clipId = useId().replace(/:/g, "");

  return (
    <svg className="brand-logo" viewBox="0 0 64 64" role="img" aria-label="Panini Mundial 2026">
      <defs>
        <clipPath id={`${clipId}-logo-ball-clip`}>
          <circle cx="32" cy="20" r="16" />
        </clipPath>
      </defs>
      <path className="brand-logo-shadow" d="M17 59h30l-4-7H21l-4 7Z" />
      <path className="brand-logo-base brand-logo-blue" d="M16 54h32l-3-7H19l-3 7Z" />
      <path className="brand-logo-stem brand-logo-red" d="M25 45h14l-4-18h-6l-4 18Z" />
      <path className="brand-logo-swoosh brand-logo-green" d="M18 18c-7 12-2 26 14 32-2-12-8-18-14-32Z" />
      <path className="brand-logo-swoosh brand-logo-red" d="M46 18c7 12 2 26-14 32 2-12 8-18 14-32Z" />
      <g clipPath={`url(#${clipId}-logo-ball-clip)`}>
        <rect className="brand-logo-white" x="14" y="2" width="36" height="36" />
        <rect className="brand-logo-blue" x="14" y="2" width="17" height="17" />
        {[6, 14, 22, 30].map((y) => (
          <rect key={y} className="brand-logo-red" x="31" y={y} width="21" height="4" />
        ))}
        {[22, 30].map((y) => (
          <rect key={y} className="brand-logo-red" x="14" y={y} width="38" height="4" />
        ))}
        {[18, 26, 34].map((x) => (
          <circle key={x} className="brand-logo-white" cx={x} cy="9" r="1.4" />
        ))}
        {[22, 30].map((x) => (
          <circle key={x} className="brand-logo-white" cx={x} cy="15" r="1.4" />
        ))}
      </g>
      <circle className="brand-logo-outline" cx="32" cy="20" r="16" />
      <text className="brand-logo-year" x="32" y="53" textAnchor="middle">2026</text>
    </svg>
  );
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function localStorageKey(userId: string) {
  return `panini-2026-state-${userId}`;
}

const tradeStorageKey = "panini-2026-trade-processes";
const visitorProfileKey = "panini-2026-visitor-profile";
const visitorsStorageKey = "panini-2026-visitors";
const activeVisitorKey = "panini-2026-active-visitor";
const filtersSessionKey = "panini-2026-session-filters";
const albumSortSessionKey = "panini-2026-session-album-sort";
const assistantSortSessionKey = "panini-2026-session-assistant-sort";

function readLocalState(userId: string) {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(localStorageKey(userId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as UserStateMap;
  } catch {
    return {};
  }
}

function writeLocalState(userId: string, state: UserStateMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localStorageKey(userId), JSON.stringify(state));
}

function readLocalTrades() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(tradeStorageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TradeProcess[];
  } catch {
    return [];
  }
}

function writeLocalTrades(trades: TradeProcess[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tradeStorageKey, JSON.stringify(trades));
}

function readAllVisitors(): User[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(visitorsStorageKey);
  if (raw) {
    try { return JSON.parse(raw) as User[]; } catch { return []; }
  }
  // migrate from old single-visitor storage
  const legacy = window.localStorage.getItem(visitorProfileKey);
  if (legacy) {
    try {
      const old = JSON.parse(legacy) as User;
      const migrated = [old];
      window.localStorage.setItem(visitorsStorageKey, JSON.stringify(migrated));
      return migrated;
    } catch { return []; }
  }
  return [];
}

function writeAllVisitors(visitors: User[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(visitorsStorageKey, JSON.stringify(visitors));
}

function readActiveVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(activeVisitorKey);
}

function writeActiveVisitorId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(activeVisitorKey, id);
}

function isAlbumSortMode(value: unknown): value is AlbumSortMode {
  return value === "album" || value === "alphabetical";
}

function readSessionSortMode(key: string) {
  if (typeof window === "undefined") return "album";
  const value = window.sessionStorage.getItem(key);
  return isAlbumSortMode(value) ? value : "album";
}

function writeSessionSortMode(key: string, value: AlbumSortMode) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, value);
}

function readSessionFilters() {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem(filtersSessionKey);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Partial<StickerFilters>;
    const filters: StickerFilters = {};
    if (typeof parsed.query === "string") filters.query = parsed.query;
    if (typeof parsed.sectionId === "string") filters.sectionId = parsed.sectionId;
    if (typeof parsed.countryCode === "string") filters.countryCode = parsed.countryCode;
    if (typeof parsed.type === "string") filters.type = parsed.type as StickerFilters["type"];
    if (typeof parsed.onlyFoil === "boolean") filters.onlyFoil = parsed.onlyFoil;
    if (typeof parsed.onlyPlayers === "boolean") filters.onlyPlayers = parsed.onlyPlayers;
    return filters;
  } catch {
    return {};
  }
}

function writeSessionFilters(filters: StickerFilters) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(filtersSessionKey, JSON.stringify(filters));
}

type SharedData = {
  userId?: string;
  name: string;
  missing: string[];
  duplicates: [string, number][];
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function encodeSharePayload(payload: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function generateInventoryText(
  mode: "missing" | "duplicates",
  user: User,
  missingStickers: StickerModel[],
  duplicateStickers: StickerModel[],
  userState: UserStateMap
): string {
  const date = new Date().toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" });
  const lines: string[] = [];

  if (mode === "missing") {
    lines.push(`PANINI MUNDIAL 2026 — FALTANTES DE ${user.name.toUpperCase()}`);
    lines.push(`${date} | ${missingStickers.length} láminas faltantes`);
    lines.push("");
    const intro = missingStickers.filter((s) => s.sectionId === "intro");
    if (intro.length > 0) { lines.push(`INTRODUCCION (${intro.length}):`); lines.push(intro.map((s) => s.reference).join(", ")); lines.push(""); }
    paniniWorldCup2026Catalog.countries.forEach((country) => {
      const stickers = missingStickers.filter((s) => s.countryCode === country.code);
      if (!stickers.length) return;
      lines.push(`${country.code} — ${country.nameEs} (${stickers.length}):`);
      lines.push(stickers.map((s) => s.reference).join(", ")); lines.push("");
    });
    const museum = missingStickers.filter((s) => s.sectionId === "museum");
    if (museum.length > 0) { lines.push(`FIFA MUSEUM (${museum.length}):`); lines.push(museum.map((s) => s.reference).join(", ")); }
  } else {
    const available = duplicateStickers.reduce((t, s) => t + Math.max(0, getQuantity(userState, s.id) - 1), 0);
    lines.push(`PANINI MUNDIAL 2026 — REPETIDAS DE ${user.name.toUpperCase()}`);
    lines.push(`${date} | ${duplicateStickers.length} únicas, ${available} disponibles para cambio`);
    lines.push("");
    const fmt = (s: StickerModel) => `${s.reference} (×${Math.max(0, getQuantity(userState, s.id) - 1)})`;
    const intro = duplicateStickers.filter((s) => s.sectionId === "intro");
    if (intro.length > 0) { lines.push(`INTRODUCCION (${intro.length}):`); lines.push(intro.map(fmt).join(", ")); lines.push(""); }
    paniniWorldCup2026Catalog.countries.forEach((country) => {
      const stickers = duplicateStickers.filter((s) => s.countryCode === country.code);
      if (!stickers.length) return;
      lines.push(`${country.code} — ${country.nameEs} (${stickers.length}):`);
      lines.push(stickers.map(fmt).join(", ")); lines.push("");
    });
    const museum = duplicateStickers.filter((s) => s.sectionId === "museum");
    if (museum.length > 0) { lines.push(`FIFA MUSEUM (${museum.length}):`); lines.push(museum.map(fmt).join(", ")); }
  }
  return lines.join("\n");
}

function generateFullInventoryShareText(user: User, missingStickers: StickerModel[], duplicateStickers: StickerModel[], userState: UserStateMap, url: string) {
  const missingText = generateInventoryText("missing", user, missingStickers, duplicateStickers, userState);
  const duplicatesText = generateInventoryText("duplicates", user, missingStickers, duplicateStickers, userState);
  return `${missingText}\n\n${duplicatesText}\n\nVer mi album para cambios:\n${url}`;
}

function generateShareUrl(user: User, userState: UserStateMap): string {
  if (typeof window === "undefined") return "";
  if (isUuid(user.id)) return `${window.location.origin}/?user=${encodeURIComponent(user.id)}`;

  const missing = allStickers.filter((s) => getQuantity(userState, s.id) === 0).map((s) => s.reference);
  const duplicates = allStickers
    .filter((s) => getQuantity(userState, s.id) > 1)
    .map((s) => [s.reference, getQuantity(userState, s.id) - 1] as [string, number]);
  const encoded = encodeSharePayload({ n: user.name, m: missing, d: duplicates });
  return `${window.location.origin}/?share=${encodeURIComponent(encoded)}`;
}

function decodeShareData(encoded: string): SharedData | null {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(encoded)))));
    return {
      userId: typeof data.u === "string" ? data.u : undefined,
      name: data.n ?? "Coleccionista",
      missing: data.m ?? [],
      duplicates: data.d ?? []
    };
  } catch {
    return null;
  }
}

function buildWhatsAppUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function readCommaRefsParam(name: string) {
  if (typeof window === "undefined") return [];
  const raw = new URLSearchParams(window.location.search).get(name);
  if (!raw) return [];
  return raw.split(",").map((ref) => ref.trim().toUpperCase()).filter(Boolean);
}

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function PaniniApp() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<View>("album");
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [assistantIndex, setAssistantIndex] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [compareUserId, setCompareUserId] = useState("");
  const [states, setStates] = useState<Record<string, UserStateMap>>({});
  const [filters, setFilters] = useState<StickerFilters>(() => readSessionFilters());
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleUserId, setGoogleUserId] = useState("");
  const [initialStartMode, setInitialStartMode] = useState<"pick" | "new" | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [shareModalMode, setShareModalMode] = useState<"missing" | "duplicates" | null>(null);
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [isPublicShareLoading, setIsPublicShareLoading] = useState(false);
  const [publicShareError, setPublicShareError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedShare = params.get("share");
    const userId = params.get("user");

    if (encodedShare) {
      const decoded = decodeShareData(encodedShare);
      if (decoded) setSharedData(decoded);
      return;
    }

    if (!userId || !isUuid(userId)) return;
    const publicUserId = userId;
    let cancelled = false;
    const supabase = createSupabaseClient();
    if (!supabase) {
      setPublicShareError("Supabase no esta configurado para cargar este enlace publico.");
      return;
    }
    const publicSupabase = supabase;

    async function loadPublicShare() {
      setIsPublicShareLoading(true);
      setPublicShareError("");
      const [{ data: userRow, error: userError }, { data: stateRows, error: stateError }] = await Promise.all([
        publicSupabase.from("users").select("id,name").eq("id", publicUserId).maybeSingle(),
        publicSupabase.from("user_sticker_states").select("sticker_id,quantity").eq("user_id", publicUserId)
      ]);
      if (cancelled) return;
      setIsPublicShareLoading(false);

      if (userError || stateError || !userRow) {
        setPublicShareError("No se pudo cargar el inventario publico. Revisa que el usuario exista y que las politicas de lectura publica esten activas en Supabase.");
        return;
      }

      const state = (stateRows ?? []).reduce<UserStateMap>((acc, row) => {
        acc[row.sticker_id] = row.quantity;
        return acc;
      }, {});
      setSharedData({
        userId: publicUserId,
        name: userRow.name ?? "Coleccionista",
        missing: allStickers.filter((sticker) => getQuantity(state, sticker.id) === 0).map((sticker) => sticker.reference),
        duplicates: allStickers
          .filter((sticker) => getQuantity(state, sticker.id) > 1)
          .map((sticker) => [sticker.reference, getQuantity(state, sticker.id) - 1] as [string, number])
      });
    }

    loadPublicShare();
    return () => {
      cancelled = true;
    };
  }, []);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const importPromptShownRef = useRef(false);

  const currentUser = users.find((user) => user.id === currentUserId);
  const compareUser = users.find((user) => user.id === compareUserId && user.id !== currentUserId) ?? users.find((user) => user.id !== currentUserId);
  const currentState = useMemo(() => states[currentUser?.id ?? ""] ?? {}, [states, currentUser?.id]);
  const compareState = useMemo(() => (compareUser ? states[compareUser.id] ?? {} : {}), [states, compareUser]);
  const filteredStickers = useMemo(() => getFilteredStickers(allStickers, filters), [filters]);
  const missingStickers = useMemo(() => getMissingStickers(allStickers, currentState, filters), [currentState, filters]);
  const duplicateStickers = useMemo(() => getDuplicateStickers(allStickers, currentState, filters), [currentState, filters]);
  const progress = useMemo(() => getUserProgress(allStickers, currentState), [currentState]);
  const progressBySection = useMemo(() => getProgressBySection(allStickers, currentState), [currentState]);
  const progressByCountry = useMemo(() => getProgressByCountry(allStickers, currentState), [currentState]);
  const localVisitors = useMemo(() => users.filter((u) => u.id.startsWith("visitor-")), [users]);

  function showPersistenceError(action: string, error: { message: string }) {
    setBackupMessage(`${action}: ${error.message}`);
  }

  useEffect(() => {
    writeSessionFilters(filters);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseClient();

    async function loadSession() {
      try {
        if (supabase) {
          const { data } = await withTimeout(
            supabase.auth.getSession(),
            8000,
            "La sesion de Supabase tardo demasiado en responder."
          );
          const authUser = data.session?.user;
          if (authUser) {
            if (!cancelled) setIsAuthenticated(true);
            await loadAuthenticatedUser(authUser, false);
            // Merge local visitors alongside Supabase users
            const localVisitors = readAllVisitors();
            if (localVisitors.length > 0 && !cancelled) {
              setUsers((prev) => {
                const supabaseIds = new Set(prev.map((u) => u.id));
                const onlyLocal = localVisitors.filter((v) => !supabaseIds.has(v.id));
                return onlyLocal.length > 0 ? [...prev, ...onlyLocal] : prev;
              });
              setStates((prev) => {
                const result = { ...prev };
                localVisitors.forEach((v) => { if (!result[v.id]) result[v.id] = readLocalState(v.id); });
                return result;
              });
            }
            if (!cancelled) setIsSessionLoaded(true);
            return;
          }
        }

        const visitors = readAllVisitors();
        if (visitors.length > 0 && !cancelled) {
          setUsers(visitors);
          setStates(visitors.reduce<Record<string, UserStateMap>>((acc, v) => {
            acc[v.id] = readLocalState(v.id);
            return acc;
          }, {}));
        }
      } catch (error) {
        if (!cancelled) {
          setBackupMessage(error instanceof Error ? error.message : "No se pudo cargar la sesion.");
        }
      } finally {
        if (!cancelled) setIsSessionLoaded(true);
      }
    }

    async function loadAuthenticatedUser(
      authUser: {
        id: string;
        email?: string;
        created_at?: string;
        user_metadata: Record<string, unknown>;
      },
      autoResume = true
    ) {
      const profile: User = {
        id: authUser.id,
        name:
          String(authUser.user_metadata.full_name ?? authUser.user_metadata.name ?? authUser.email?.split("@")[0] ?? "Coleccionista"),
        email: authUser.email,
        avatarUrl: typeof authUser.user_metadata.avatar_url === "string"
          ? authUser.user_metadata.avatar_url
          : typeof authUser.user_metadata.picture === "string"
            ? authUser.user_metadata.picture
            : undefined,
        createdAt: authUser.created_at ?? new Date().toISOString()
      };

      if (!supabase) return;
      if (!cancelled) {
        setIsAuthenticated(true);
        setGoogleUserId(profile.id);
      }

      const { error: profileError } = await withTimeout(
        supabase.from("users").upsert({
          id: profile.id,
          name: profile.name,
          email: profile.email
        }),
        8000,
        "Supabase tardo demasiado sincronizando tu perfil."
      );

      if (profileError) showPersistenceError("No se pudo sincronizar tu perfil en Supabase", profileError);

      const [{ data: userRows, error: usersError }, { data: stateRows, error: statesError }] = await withTimeout(
        Promise.all([
          supabase.from("users").select("id,name,email,created_at").order("name"),
          supabase.from("user_sticker_states").select("user_id,sticker_id,quantity,updated_at")
        ]),
        8000,
        "Supabase tardo demasiado cargando el inventario."
      );

      if (cancelled) return;
      if (usersError) showPersistenceError("No se pudieron cargar los usuarios desde Supabase", usersError);
      if (statesError) showPersistenceError("No se pudo cargar el inventario desde Supabase", statesError);

      const loadedUsers =
        userRows?.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email ?? undefined,
          avatarUrl: row.id === profile.id ? profile.avatarUrl : undefined,
          createdAt: row.created_at
        })) ?? [profile];
      const loadedStates = (stateRows ?? []).reduce<Record<string, UserStateMap>>((acc, row) => {
        acc[row.user_id] = acc[row.user_id] ?? {};
        acc[row.user_id][row.sticker_id] = row.quantity;
        return acc;
      }, {});

      setUsers(loadedUsers);
      setStates((previous) => ({ ...previous, ...loadedStates, [profile.id]: loadedStates[profile.id] ?? {} }));

      if (autoResume) {
        setCurrentUserId(profile.id);
        setCompareUserId(loadedUsers.find((user) => user.id !== profile.id)?.id ?? "");
      }
    }

    loadSession();

    const { data: listener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) return;
        setIsAuthenticated(true);
        loadAuthenticatedUser(session.user, true).then(() => {
          setIsSessionLoaded(true);
        });
      }) ?? { data: { subscription: null } };

    return () => {
      cancelled = true;
      listener.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId || isAuthenticated) return;
    const saved = readLocalState(currentUserId);
    setStates((previous) => ({ ...previous, [currentUserId]: saved }));
  }, [currentUserId, isAuthenticated]);

  function startVisitorSession(name: string) {
    const visitor = createVisitorProfile(name);
    if (!visitor) return;
    setView("album");
  }

  function createVisitorProfile(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const visitor: User = {
      id: `visitor-${Date.now()}`,
      name: trimmedName,
      createdAt: new Date().toISOString()
    };
    const existing = readAllVisitors();
    const next = [...existing, visitor];
    writeAllVisitors(next);
    writeActiveVisitorId(visitor.id);
    setUsers((prev) => {
      const supabaseUsers = googleUserId ? prev.filter((u) => u.id === googleUserId) : [];
      return [...supabaseUsers, ...next];
    });
    setCurrentUserId(visitor.id);
    setCompareUserId("");
    setStates((prev) => ({ ...prev, [visitor.id]: readLocalState(visitor.id) }));
    return visitor;
  }

  function createPublicTradeRequest({
    requester,
    ownerName,
    requestedStickerIds,
    offeredStickerIds
  }: {
    requester: User;
    ownerName: string;
    requestedStickerIds: string[];
    offeredStickerIds: string[];
  }) {
    const ownerId = sharedData?.userId ?? `shared-${ownerName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "coleccionista"}`;
    const ownerUser: User = {
      id: ownerId,
      name: ownerName,
      createdAt: new Date().toISOString()
    };
    setUsers((previous) => (previous.some((user) => user.id === ownerId) ? previous : [...previous, ownerUser]));
    const trade: TradeProcess = {
      id: `trade-${Date.now()}`,
      requesterId: requester.id,
      friendId: ownerId,
      requestedStickerIds,
      offeredStickerIds,
      status: "requested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    writeLocalTrades([trade, ...readLocalTrades()]);
    return trade;
  }

  async function handleGoogleSignIn() {
    const result = await signInWithGoogle();
    if (result?.error) setBackupMessage(result.error.message);
  }

  async function handleSignOut() {
    await signOut();
    setIsAuthenticated(false);
    setCompareUserId("");
    setView("album");
    const visitors = readAllVisitors();
    if (visitors.length > 0) {
      const activeId = readActiveVisitorId();
      const active = (activeId ? visitors.find((v) => v.id === activeId) : null) ?? visitors[0];
      setUsers(visitors);
      setCurrentUserId(active.id);
      setStates(visitors.reduce<Record<string, UserStateMap>>((acc, v) => {
        acc[v.id] = readLocalState(v.id);
        return acc;
      }, {}));
    } else {
      setUsers([]);
      setCurrentUserId("");
      setStates({});
    }
  }

  function handleDeleteVisitor(userId: string) {
    const visitors = readAllVisitors();
    const next = visitors.filter((v) => v.id !== userId);
    writeAllVisitors(next);
    window.localStorage.removeItem(localStorageKey(userId));
    if (readActiveVisitorId() === userId) writeActiveVisitorId(next[0]?.id ?? "");
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setStates((prev) => { const r = { ...prev }; delete r[userId]; return r; });
  }

  function switchToVisitor(userId: string) {
    writeActiveVisitorId(userId);
    setCurrentUserId(userId);
    setStates((prev) => ({ ...prev, [userId]: prev[userId] ?? readLocalState(userId) }));
  }

  useEffect(() => {
    if (!isAuthenticated || !isSessionLoaded || importPromptShownRef.current) return;
    if (localVisitors.length === 0 || progress.ownedUniqueCount > 0) return;
    setShowImportPrompt(true);
    importPromptShownRef.current = true;
  }, [isAuthenticated, isSessionLoaded, localVisitors.length, progress.ownedUniqueCount]);

  async function handleImportFromVisitor(visitorId: string) {
    const visitorState = states[visitorId] ?? {};
    const updates = allStickers.map((s) => ({ stickerId: s.id, quantity: getQuantity(visitorState, s.id) }));
    await updateQuantities(updates);
    handleDeleteVisitor(visitorId);
    setShowImportPrompt(false);
  }

  function handleUpdateVisitorName(name: string) {
    if (!currentUser) return;
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === currentUser.name) return;
    const visitors = readAllVisitors();
    writeAllVisitors(visitors.map((v) => v.id === currentUser.id ? { ...v, name: trimmedName } : v));
    setUsers((prev) => prev.map((u) => u.id === currentUser.id ? { ...u, name: trimmedName } : u));
  }

  function handleNewVisitorFromMenu() {
    setInitialStartMode("new");
    setCurrentUserId("");
  }

  function handleResumeSession(userId: string) {
    setCurrentUserId(userId);
    if (userId !== googleUserId) {
      writeActiveVisitorId(userId);
    } else {
      setCompareUserId(users.find((u) => u.id !== userId)?.id ?? "");
    }
  }

  async function updateQuantity(stickerId: string, quantity: number) {
    if (!currentUser) return;
    const nextQuantity = normalizeQuantity(quantity);

    setStates((previous) => {
      const nextUserState = { ...(previous[currentUser.id] ?? {}), [stickerId]: nextQuantity };
      writeLocalState(currentUser.id, nextUserState);
      return { ...previous, [currentUser.id]: nextUserState };
    });

    const supabase = createSupabaseClient();
    if (supabase && isAuthenticated) {
      const { error } = await supabase.from("user_sticker_states").upsert(
        {
          user_id: currentUser.id,
          sticker_id: stickerId,
          quantity: nextQuantity,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id,sticker_id" }
      );
      if (error) showPersistenceError("No se pudo guardar la lamina en Supabase", error);
    }
  }

  async function updateQuantities(updates: Array<{ stickerId: string; quantity: number }>) {
    if (!currentUser || updates.length === 0) return;
    const normalizedUpdates = updates.map((update) => ({
      stickerId: update.stickerId,
      quantity: normalizeQuantity(update.quantity)
    }));

    setStates((previous) => {
      const nextUserState = { ...(previous[currentUser.id] ?? {}) };
      normalizedUpdates.forEach((update) => {
        nextUserState[update.stickerId] = update.quantity;
      });
      writeLocalState(currentUser.id, nextUserState);
      return { ...previous, [currentUser.id]: nextUserState };
    });

    const supabase = createSupabaseClient();
    if (supabase && isAuthenticated) {
      const updatedAt = new Date().toISOString();
      const { error } = await supabase.from("user_sticker_states").upsert(
        normalizedUpdates.map((update) => ({
          user_id: currentUser.id,
          sticker_id: update.stickerId,
          quantity: update.quantity,
          updated_at: updatedAt
        })),
        { onConflict: "user_id,sticker_id" }
      );
      if (error) showPersistenceError("No se pudieron guardar las laminas en Supabase", error);
    }
  }

  async function updateUserQuantities(userId: string, updates: Array<{ stickerId: string; quantity: number }>) {
    if (updates.length === 0) return;
    const normalizedUpdates = updates.map((update) => ({
      stickerId: update.stickerId,
      quantity: normalizeQuantity(update.quantity)
    }));

    setStates((previous) => {
      const nextUserState = { ...(previous[userId] ?? {}) };
      normalizedUpdates.forEach((update) => {
        nextUserState[update.stickerId] = update.quantity;
      });
      writeLocalState(userId, nextUserState);
      return { ...previous, [userId]: nextUserState };
    });
  }

  function resetFilters() {
    setFilters({});
  }

  function exportInventory() {
    if (!currentUser) return;
    const backup: InventoryBackup = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      album: paniniWorldCup2026Catalog.album,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      },
      stickers: allStickers.map((sticker) => ({
        stickerId: sticker.id,
        reference: sticker.reference,
        quantity: getQuantity(currentState, sticker.id)
      }))
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `panini-2026-${currentUser.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage(`Backup exportado para ${currentUser.name}.`);
  }

  async function importInventory(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentUser) return;

    try {
      const parsed = JSON.parse(await file.text()) as Partial<InventoryBackup>;
      if (parsed.schemaVersion !== 1 || parsed.album?.id !== paniniWorldCup2026Catalog.album.id || !Array.isArray(parsed.stickers)) {
        setBackupMessage("El archivo no corresponde a un backup valido del album Panini 2026.");
        return;
      }

      const validStickerIds = new Set(allStickers.map((sticker) => sticker.id));
      const updates = parsed.stickers
        .filter((sticker) => sticker?.stickerId && validStickerIds.has(sticker.stickerId))
        .map((sticker) => ({
          stickerId: sticker.stickerId,
          quantity: normalizeQuantity(Number(sticker.quantity ?? 0))
        }));

      if (updates.length === 0) {
        setBackupMessage("El backup no contiene laminas reconocidas.");
        return;
      }

      await updateQuantities(updates);
      setBackupMessage(`Backup importado: ${updates.length} laminas restauradas para ${currentUser.name}.`);
    } catch {
      setBackupMessage("No se pudo leer el archivo. Revisa que sea un JSON de backup valido.");
    }
  }

  if (sharedData) {
    return (
      <ShareReadView
        data={sharedData}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        isSessionLoaded={isSessionLoaded}
        onCreateVisitor={createVisitorProfile}
        onCreateTradeRequest={createPublicTradeRequest}
      />
    );
  }

  if (isPublicShareLoading || publicShareError) {
    return (
      <main className="share-read-view">
        <div className="share-read-inner">
          <header className="share-read-header">
            <AppLogo />
            <div>
              <h1>Panini Mundial 2026</h1>
              <p>{isPublicShareLoading ? "Cargando inventario publico..." : "No se pudo cargar el enlace"}</p>
            </div>
          </header>
          {publicShareError ? <div className="backup-message">{publicShareError}</div> : null}
        </div>
      </main>
    );
  }

  if (!isSessionLoaded) {
    return (
      <main className="start-screen">
        <section className="start-panel">
          <div className="start-brand">
            <AppLogo />
            <div>
              <h1>Panini Mundial 2026</h1>
              <p>Cargando tu album...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <VisitorStartScreen
        users={users}
        googleUserId={googleUserId}
        initialMode={initialStartMode ?? undefined}
        onResume={(userId) => { setInitialStartMode(null); handleResumeSession(userId); }}
        onNewVisitor={(name) => { setInitialStartMode(null); startVisitorSession(name); }}
        onDeleteUser={handleDeleteVisitor}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="hamburger-button"
            onClick={() => setIsNavOpen((prev) => !prev)}
            aria-label={isNavOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={isNavOpen}
          >
            {isNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="brand">
            <AppLogo />
            <div>
              <h1>Panini Mundial 2026</h1>
              <p>{paniniWorldCup2026Catalog.album.baseStickerCount} laminas base, catalogo estatico</p>
            </div>
          </div>

          <UserMenu
            user={currentUser}
            visitors={isAuthenticated ? [] : users}
            isAuthenticated={isAuthenticated}
            onSignIn={handleGoogleSignIn}
            onSignOut={handleSignOut}
            onSwitchVisitor={switchToVisitor}
            onNewVisitor={handleNewVisitorFromMenu}
          />

          <nav className={`tabs ${isNavOpen ? "nav-open" : ""}`} aria-label="Vistas">
            {views.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`tab ${view === item.id ? "active" : ""}`}
                  onClick={() => { setView(item.id); setIsNavOpen(false); }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="user-area">
            {isAuthenticated ? (
              <span className="autosave-label">
                <Check size={14} />
                Guardado automático
              </span>
            ) : (
              <button className="button" onClick={() => setIsSaveModalOpen(true)}>
                <Save size={16} />
                Guardar
              </button>
            )}
            <button className="button primary" onClick={() => setIsAssistantOpen(true)}>
              Abrir asistente
            </button>
            <button className="button" onClick={exportInventory} aria-label="Exportar inventario">
              <Download size={17} />
              Exportar
            </button>
            <button className="button" onClick={() => importInputRef.current?.click()} aria-label="Importar inventario">
              <Upload size={17} />
              Importar
            </button>
            <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importInventory} />
          </div>
        </div>
      </header>

      <div className="page">
        {backupMessage ? <div className="backup-message">{backupMessage}</div> : null}
        {view !== "dashboard" && view !== "compare" ? (
          <Filters filters={filters} onChange={setFilters} onReset={resetFilters} />
        ) : null}

        {view === "dashboard" ? (
          <Dashboard
            progress={progress}
            progressBySection={progressBySection}
            progressByCountry={progressByCountry}
          />
        ) : null}

        {view === "album" ? (
          <AlbumView
            stickers={filteredStickers}
            userState={currentState}
            onUpdateQuantity={updateQuantity}
            onUpdateQuantities={updateQuantities}
          />
        ) : null}

        {view === "missing" ? (
          <>
            <div className="inventory-actions-bar">
              <span className="inventory-count">{missingStickers.length} láminas faltantes</span>
              <button className="button small" onClick={() => setShareModalMode("missing")}>
                <Share2 size={14} />
                Compartir lista
              </button>
            </div>
            <AlbumView
              stickers={missingStickers}
              userState={currentState}
              onUpdateQuantity={updateQuantity}
              onUpdateQuantities={updateQuantities}
            />
          </>
        ) : null}

        {view === "duplicates" ? (
          <>
            <div className="inventory-actions-bar">
              <span className="inventory-count">{duplicateStickers.length} láminas repetidas</span>
              <button className="button small" onClick={() => setShareModalMode("duplicates")}>
                <Share2 size={14} />
                Compartir lista
              </button>
            </div>
            <AlbumView
              stickers={duplicateStickers}
              userState={currentState}
              onUpdateQuantity={updateQuantity}
              onUpdateQuantities={updateQuantities}
            />
          </>
        ) : null}

        {view === "compare" && compareUser ? (
          <CompareView
            users={users}
            currentUser={currentUser}
            compareUser={compareUser}
            compareUserId={compareUser.id}
            onCompareUserChange={setCompareUserId}
            currentState={currentState}
            compareState={compareState}
            states={states}
            onUpdateUserQuantities={updateUserQuantities}
          />
        ) : null}

        {view === "compare" && !compareUser ? (
          <section className="panel">
            <div className="panel-header">
              <h2>Cambios</h2>
            </div>
            <div className="empty">No hay otros usuarios disponibles para comparar todavia.</div>
          </section>
        ) : null}

        {view === "settings" ? (
          <SettingsView
            user={currentUser}
            isAuthenticated={isAuthenticated}
            localVisitors={localVisitors}
            states={states}
            onUpdateName={handleUpdateVisitorName}
            onImportFromVisitor={handleImportFromVisitor}
          />
        ) : null}
      </div>
      {shareModalMode ? (
        <InventoryShareModal
          mode={shareModalMode}
          user={currentUser}
          missingStickers={missingStickers}
          duplicateStickers={duplicateStickers}
          currentState={currentState}
          onClose={() => setShareModalMode(null)}
        />
      ) : null}
      {showImportPrompt && localVisitors.length > 0 ? (
        <ImportVisitorModal
          localVisitors={localVisitors}
          states={states}
          hasExistingData={progress.ownedUniqueCount > 0}
          onImport={handleImportFromVisitor}
          onSkip={() => setShowImportPrompt(false)}
        />
      ) : null}
      {isSaveModalOpen ? (
        <SaveModal
          onSignIn={handleGoogleSignIn}
          onDownload={() => { exportInventory(); setIsSaveModalOpen(false); }}
          onClose={() => setIsSaveModalOpen(false)}
        />
      ) : null}
      {isAssistantOpen ? (
        <AlbumAssistantModal
          baseStickers={allStickers}
          userState={currentState}
          currentIndex={assistantIndex}
          onIndexChange={setAssistantIndex}
          onUpdateQuantity={updateQuantity}
          onUpdateQuantities={updateQuantities}
          onClose={() => setIsAssistantOpen(false)}
        />
      ) : null}
    </main>
  );
}

function VisitorStartScreen({
  users,
  googleUserId,
  initialMode,
  onResume,
  onNewVisitor,
  onDeleteUser
}: {
  users: User[];
  googleUserId: string;
  initialMode?: "pick" | "new";
  onResume: (userId: string) => void;
  onNewVisitor: (name: string) => void;
  onDeleteUser: (userId: string) => void;
}) {
  const [mode, setMode] = useState<"pick" | "new">(() =>
    initialMode ?? (users.length === 0 ? "new" : "pick")
  );
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (users.length === 0) setMode("new");
  }, [users.length]);

  async function handleGoogleStart() {
    const result = await signInWithGoogle();
    if (result?.error) setError(result.error.message);
  }

  return (
    <main className="start-screen">
      <section className="start-panel">
        <div className="start-brand">
          <AppLogo />
          <div>
            <h1>Panini Mundial 2026</h1>
            <p>{mode === "pick" ? "Selecciona tu perfil para continuar" : "Inventario local del album base"}</p>
          </div>
        </div>

        {mode === "pick" ? (
          <>
            <div className="session-list">
              {users.map((user) => {
                const isGoogle = user.id === googleUserId;
                const initials = user.name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";
                const avatarStyle = user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined;
                return (
                  <div key={user.id}>
                    {deletingUserId === user.id ? (
                      <div className="session-delete-confirm">
                        <span>¿Eliminar la sesión de <strong>{user.name}</strong>? Se perderán todos los datos guardados localmente.</span>
                        <div className="session-delete-actions">
                          <button className="button small" type="button" onClick={() => setDeletingUserId(null)}>
                            Cancelar
                          </button>
                          <button
                            className="button small session-delete-ok"
                            type="button"
                            onClick={() => { onDeleteUser(user.id); setDeletingUserId(null); }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="session-card-row">
                        <button className="session-card" type="button" onClick={() => onResume(user.id)}>
                          <span className={`user-avatar large ${user.avatarUrl ? "has-image" : ""}`} style={avatarStyle} aria-hidden="true">
                            {user.avatarUrl ? null : initials}
                          </span>
                          <div className="session-card-info">
                            <strong>{user.name}</strong>
                            <span>{isGoogle ? user.email ?? "Google" : "Visitante local"}</span>
                          </div>
                        </button>
                        {!isGoogle ? (
                          <button
                            className="session-delete-btn"
                            type="button"
                            aria-label={`Eliminar sesion de ${user.name}`}
                            onClick={() => setDeletingUserId(user.id)}
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!googleUserId ? (
              <div className="start-google-tip">
                <strong>¿Por qué iniciar sesión con Google?</strong>
                <ul>
                  <li>Tu álbum se sincroniza en la nube automáticamente</li>
                  <li>Genera un enlace público con tus faltantes y repetidas para compartir con amigos</li>
                  <li>Conecta con otros coleccionistas para coordinar intercambios</li>
                </ul>
              </div>
            ) : null}
            <div className="start-actions">
              <button className="button" type="button" onClick={() => setMode("new")}>
                <UserPlus size={16} />
                Nuevo visitante
              </button>
              {!googleUserId ? (
                <button className="button" type="button" disabled={!hasSupabaseConfig} onClick={handleGoogleStart}>
                  <LogIn size={16} />
                  Iniciar sesion con Google
                </button>
              ) : null}
              {error ? <span className="form-error">{error}</span> : null}
            </div>
          </>
        ) : (
          <form className="visitor-form" onSubmit={(event) => { event.preventDefault(); onNewVisitor(name); }}>
            <label>
              Nombre del coleccionista
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            </label>
            <button className="button primary" disabled={!name.trim()}>
              Crear album vacio
            </button>
            {users.length > 0 ? (
              <button className="button" type="button" onClick={() => setMode("pick")}>
                Volver
              </button>
            ) : (
              <>
                <div className="start-google-tip">
                  <strong>¿Por qué iniciar sesión con Google?</strong>
                  <ul>
                    <li>Tu álbum se sincroniza en la nube automáticamente</li>
                    <li>Genera un enlace público con tus faltantes y repetidas para compartir con amigos</li>
                    <li>Conecta con otros coleccionistas para coordinar intercambios</li>
                  </ul>
                </div>
                <button className="button" type="button" disabled={!hasSupabaseConfig} onClick={handleGoogleStart}>
                  <LogIn size={16} />
                  Iniciar sesion con Google
                </button>
              </>
            )}
            {error ? <span className="form-error">{error}</span> : null}
          </form>
        )}
      </section>
    </main>
  );
}

function SaveModal({
  onSignIn,
  onDownload,
  onClose
}: {
  onSignIn: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Guardar progreso">
      <div className="save-modal">
        <div className="save-modal-header">
          <div>
            <h2>No pierdas tus cambios</h2>
            <p>
              Para conservar tu inventario entre dispositivos y no perder los cambios, inicia sesión con Google.
              Si prefieres seguir como visitante, tus datos quedan en este navegador y puedes guardarlos localmente descargando el archivo de backup.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="save-modal-actions">
          <button className="button primary" disabled={!hasSupabaseConfig} onClick={onSignIn}>
            <LogIn size={16} />
            Iniciar sesión con Google
          </button>
          <div className="save-modal-divider">o</div>
          <button className="button" onClick={onDownload}>
            <Download size={16} />
            Descargar archivo local
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareReadView({
  data,
  currentUser,
  isAuthenticated,
  isSessionLoaded,
  onCreateVisitor,
  onCreateTradeRequest
}: {
  data: SharedData;
  currentUser?: User;
  isAuthenticated: boolean;
  isSessionLoaded: boolean;
  onCreateVisitor: (name: string) => User | null;
  onCreateTradeRequest: (request: {
    requester: User;
    ownerName: string;
    requestedStickerIds: string[];
    offeredStickerIds: string[];
  }) => TradeProcess;
}) {
  const [duplicateFilters, setDuplicateFilters] = useState<StickerFilters>({});
  const [selectedMissingRefs, setSelectedMissingRefs] = useState<Set<string>>(() => new Set(readCommaRefsParam("offer")));
  const [selectedDuplicateRefs, setSelectedDuplicateRefs] = useState<Set<string>>(() => new Set(readCommaRefsParam("want")));
  const missingStickerObjects = useMemo(
    () => data.missing.map((ref) => allStickers.find((s) => s.reference === ref)).filter(Boolean) as StickerModel[],
    [data.missing]
  );
  const duplicateStickerObjects = useMemo(
    () => data.duplicates
      .map(([ref, qty]) => ({
        sticker: allStickers.find((s) => s.reference === ref),
        qty: normalizeQuantity(Number(qty))
      }))
      .filter((duplicate) => duplicate.sticker && duplicate.qty > 0) as { sticker: StickerModel; qty: number }[],
    [data.duplicates]
  );
  const filteredDuplicateStickerObjects = useMemo(() => {
    const filteredIds = new Set(getFilteredStickers(duplicateStickerObjects.map(({ sticker }) => sticker), duplicateFilters).map((sticker) => sticker.id));
    return duplicateStickerObjects.filter(({ sticker }) => filteredIds.has(sticker.id));
  }, [duplicateFilters, duplicateStickerObjects]);

  function groupBySection(stickers: StickerModel[]) {
    const intro = stickers.filter((s) => s.sectionId === "intro");
    const museum = stickers.filter((s) => s.sectionId === "museum");
    const byCountry = paniniWorldCup2026Catalog.countries
      .map((country) => ({ country, stickers: stickers.filter((s) => s.countryCode === country.code) }))
      .filter((g) => g.stickers.length > 0);
    return { intro, museum, byCountry };
  }

  function groupDuplicatesBySection(duplicates: Array<{ sticker: StickerModel; qty: number }>) {
    const intro = duplicates.filter(({ sticker }) => sticker.sectionId === "intro");
    const museum = duplicates.filter(({ sticker }) => sticker.sectionId === "museum");
    const byCountry = paniniWorldCup2026Catalog.countries
      .map((country) => ({
        country,
        stickers: duplicates.filter(({ sticker }) => sticker.countryCode === country.code)
      }))
      .filter((group) => group.stickers.length > 0);
    return { intro, museum, byCountry };
  }

  function updateDuplicateFilters(nextFilters: StickerFilters) {
    setDuplicateFilters(nextFilters);
  }

  const duplicateGroups = groupDuplicatesBySection(filteredDuplicateStickerObjects);
  const duplicateAvailableCount = duplicateStickerObjects.reduce((total, duplicate) => total + duplicate.qty, 0);
  const filteredDuplicateAvailableCount = filteredDuplicateStickerObjects.reduce((total, duplicate) => total + duplicate.qty, 0);
  const missingGroups = groupBySection(missingStickerObjects);
  const selectedMissing = missingStickerObjects.filter((sticker) => selectedMissingRefs.has(sticker.reference));
  const selectedDuplicates = duplicateStickerObjects.filter(({ sticker }) => selectedDuplicateRefs.has(sticker.reference));
  const selectedCount = selectedMissing.length + selectedDuplicates.length;
  const requestedCount = selectedDuplicates.length;
  const offeredCount = selectedMissing.length;
  const baseShareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (data.userId) return `${window.location.origin}/?user=${encodeURIComponent(data.userId)}`;
    return `${window.location.origin}/?share=${encodeURIComponent(encodeSharePayload({ n: data.name, m: data.missing, d: data.duplicates }))}`;
  }, [data]);
  const missingAnchorUrl = `${baseShareUrl}#faltantes`;
  const duplicatesAnchorUrl = `${baseShareUrl}#disponibles`;
  const requestUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const parts = data.userId
      ? [`user=${encodeURIComponent(data.userId)}`]
      : [`share=${encodeURIComponent(encodeSharePayload({ n: data.name, m: data.missing, d: data.duplicates }))}`];
    const wantRefs = Array.from(selectedDuplicateRefs).sort();
    const offerRefs = Array.from(selectedMissingRefs).sort();
    if (wantRefs.length > 0) parts.push(`want=${wantRefs.join(",")}`);
    if (offerRefs.length > 0) parts.push(`offer=${offerRefs.join(",")}`);
    return `${window.location.origin}/?${parts.join("&")}`;
  }, [data, selectedDuplicateRefs, selectedMissingRefs]);
  const requestMessage = useMemo(() => {
    const lines = [`Hola ${data.name}, vi tu album Panini Mundial 2026 y quiero solicitar un intercambio.`];
    if (selectedDuplicates.length > 0) {
      lines.push(`Me interesan estas laminas disponibles: ${selectedDuplicates.map(({ sticker }) => sticker.reference).join(", ")}.`);
    }
    if (selectedMissing.length > 0) {
      lines.push(`Yo podria ayudarte con estas faltantes tuyas: ${selectedMissing.map((sticker) => sticker.reference).join(", ")}.`);
    }
    lines.push(`Solicitud: ${requestUrl}`);
    return lines.join("\n");
  }, [data.name, requestUrl, selectedDuplicates, selectedMissing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", selectedCount > 0 ? requestUrl : baseShareUrl);
  }, [baseShareUrl, requestUrl, selectedCount]);

  function toggleSelected(setter: Dispatch<SetStateAction<Set<string>>>, reference: string) {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(reference)) next.delete(reference);
      else next.add(reference);
      return next;
    });
  }

  return (
    <main className="share-read-view">
      <div className="share-read-inner">
        <header className="share-read-header">
          <AppLogo />
          <div>
            <h1>Álbum de {data.name}</h1>
            <p>Panini FIFA Mundial 2026</p>
          </div>
        </header>

        <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <Metric label="Faltantes" value={missingStickerObjects.length} />
          <Metric label="Disp. para cambio" value={duplicateAvailableCount} />
        </div>

        <nav className="share-sticky-nav" aria-label="Navegacion del enlace publico">
          <a href="#faltantes">
            Faltantes
            <span>{missingStickerObjects.length}</span>
          </a>
          <a href="#disponibles">
            Disponibles
            <span>{duplicateStickerObjects.length}</span>
          </a>
        </nav>

        <section id="faltantes" className="panel share-anchor-section">
          <div className="panel-header">
            <h2>Faltantes</h2>
            <div className="share-section-actions">
              <span className="badge">{selectedMissing.length}/{missingStickerObjects.length}</span>
              <a className="button small" href="#faltantes" onClick={() => navigator.clipboard.writeText(missingAnchorUrl).catch(() => {})}>
                <Copy size={14} />
                Link
              </a>
            </div>
          </div>
          <div className="share-group-list">
            {missingGroups.intro.length > 0 ? (
              <ShareStickerGroup
                title="Introduccion"
                icon="🏆"
                stickers={missingGroups.intro}
                selectedRefs={selectedMissingRefs}
                onToggle={(reference) => toggleSelected(setSelectedMissingRefs, reference)}
              />
            ) : null}
            {missingGroups.byCountry.map(({ country, stickers }) => (
              <ShareStickerGroup
                key={country.code}
                title={`${country.code} - ${country.nameEs}`}
                icon={countryFlagByCode[country.code] ?? "⚽"}
                stickers={stickers}
                selectedRefs={selectedMissingRefs}
                onToggle={(reference) => toggleSelected(setSelectedMissingRefs, reference)}
              />
            ))}
            {missingGroups.museum.length > 0 ? (
              <ShareStickerGroup
                title="FIFA Museum"
                icon="🏛️"
                stickers={missingGroups.museum}
                selectedRefs={selectedMissingRefs}
                onToggle={(reference) => toggleSelected(setSelectedMissingRefs, reference)}
              />
            ) : null}
            {missingStickerObjects.length === 0 && <div className="empty">¡Álbum completo!</div>}
          </div>
        </section>

        <section id="disponibles" className="panel share-anchor-section">
          <div className="panel-header">
            <h2>Disponibles para cambio</h2>
            <div className="share-section-actions">
              <span className="badge">{filteredDuplicateStickerObjects.length}/{duplicateStickerObjects.length}</span>
              <a className="button small" href="#disponibles" onClick={() => navigator.clipboard.writeText(duplicatesAnchorUrl).catch(() => {})}>
                <Copy size={14} />
                Link
              </a>
            </div>
          </div>

          <div className="share-filter-bar">
            <div className="filter-search">
              <Search size={16} className="filter-search-icon" />
              <input
                className="input"
                placeholder="Buscar referencia, pais, titulo o tipo"
                value={duplicateFilters.query ?? ""}
                onChange={(event) => updateDuplicateFilters({ ...duplicateFilters, query: event.target.value })}
              />
            </div>
            <select className="select" value={duplicateFilters.sectionId ?? "all"} onChange={(event) => updateDuplicateFilters({ ...duplicateFilters, sectionId: event.target.value })}>
              <option value="all">Todas las secciones</option>
              {paniniWorldCup2026Catalog.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
            <select className="select" value={duplicateFilters.countryCode ?? "all"} onChange={(event) => updateDuplicateFilters({ ...duplicateFilters, countryCode: event.target.value })}>
              <option value="all">Todos los paises</option>
              {paniniWorldCup2026Catalog.countries.map((country) => (
                <option key={country.code} value={country.code}>{country.code} - {country.nameEs}</option>
              ))}
            </select>
            <select className="select" value={duplicateFilters.type ?? "all"} onChange={(event) => updateDuplicateFilters({ ...duplicateFilters, type: event.target.value as StickerFilters["type"] })}>
              <option value="all">Todos los tipos</option>
              {Object.entries(typeLabels).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
            <label className="toggle">
              <input type="checkbox" checked={Boolean(duplicateFilters.onlyFoil)} onChange={(event) => updateDuplicateFilters({ ...duplicateFilters, onlyFoil: event.target.checked })} />
              Solo foil
            </label>
            <button className="button" onClick={() => setDuplicateFilters({})}>
              <X size={16} />
              Limpiar
            </button>
          </div>

          <div className="share-filter-summary">
            <strong>{filteredDuplicateAvailableCount}</strong>
            <span>disponibles en {filteredDuplicateStickerObjects.length} referencias</span>
          </div>

          <div className="share-group-list">
            {filteredDuplicateStickerObjects.length > 0 ? (
              <>
                {duplicateGroups.intro.length > 0 ? (
                  <ShareDuplicateGroup
                    title="Introduccion"
                    icon="🏆"
                    duplicates={duplicateGroups.intro}
                    selectedRefs={selectedDuplicateRefs}
                    onToggle={(reference) => toggleSelected(setSelectedDuplicateRefs, reference)}
                  />
                ) : null}
                {duplicateGroups.byCountry.map(({ country, stickers }) => (
                  <ShareDuplicateGroup
                    key={country.code}
                    title={`${country.code} - ${country.nameEs}`}
                    icon={countryFlagByCode[country.code] ?? "⚽"}
                    duplicates={stickers}
                    selectedRefs={selectedDuplicateRefs}
                    onToggle={(reference) => toggleSelected(setSelectedDuplicateRefs, reference)}
                  />
                ))}
                {duplicateGroups.museum.length > 0 ? (
                  <ShareDuplicateGroup
                    title="FIFA Museum"
                    icon="🏛️"
                    duplicates={duplicateGroups.museum}
                    selectedRefs={selectedDuplicateRefs}
                    onToggle={(reference) => toggleSelected(setSelectedDuplicateRefs, reference)}
                  />
                ) : null}
              </>
            ) : (
              <div className="empty">{duplicateStickerObjects.length > 0 ? "No hay disponibles con esos filtros." : "Sin repetidas disponibles."}</div>
            )}
          </div>
        </section>

        <div className="share-request-bar">
          <div>
            <strong>{requestedCount}</strong>
            <span>pedidas / {offeredCount} ofrecidas</span>
          </div>
          <a className={`button primary ${selectedCount === 0 ? "disabled-link" : ""}`} href="#solicitud-intercambio" aria-disabled={selectedCount === 0}>
            Solicitar Intercambio
          </a>
        </div>

        {selectedCount > 0 ? (
          <TradeRequestPanel
            ownerName={data.name}
            currentUser={currentUser}
            isAuthenticated={isAuthenticated}
            isSessionLoaded={isSessionLoaded}
            requestUrl={requestUrl}
            baseRequestMessage={requestMessage}
            selectedMissing={selectedMissing}
            selectedDuplicates={selectedDuplicates}
            onCreateVisitor={onCreateVisitor}
            onCreateTradeRequest={onCreateTradeRequest}
          />
        ) : null}

        <a href="/" className="button primary share-cta">Crear mi propio álbum →</a>
      </div>
    </main>
  );
}

function ShareStickerGroup({
  title,
  icon,
  stickers,
  selectedRefs,
  onToggle
}: {
  title: string;
  icon: string;
  stickers: StickerModel[];
  selectedRefs: Set<string>;
  onToggle: (reference: string) => void;
}) {
  return (
    <section className="share-duplicate-group">
      <div className="share-duplicate-group-header">
        <div className="share-group-title">
          <span className="share-group-icon" aria-hidden="true">{icon}</span>
          <strong>{title}</strong>
        </div>
        <span>{stickers.length} refs</span>
      </div>
      <div className="share-duplicate-grid">
        {stickers.map((sticker) => {
          const isSelected = selectedRefs.has(sticker.reference);
          return (
            <button key={sticker.id} className={`share-duplicate-card selectable ${isSelected ? "selected" : ""}`} type="button" onClick={() => onToggle(sticker.reference)}>
              <div>
                <strong>{sticker.reference}</strong>
                <span>{getStickerDisplayTitle(sticker)}</span>
              </div>
              {isSelected ? <span className="share-selection-check"><Check size={14} /></span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ShareDuplicateGroup({
  title,
  icon,
  duplicates,
  selectedRefs,
  onToggle
}: {
  title: string;
  icon: string;
  duplicates: Array<{ sticker: StickerModel; qty: number }>;
  selectedRefs: Set<string>;
  onToggle: (reference: string) => void;
}) {
  const availableCount = duplicates.reduce((total, duplicate) => total + duplicate.qty, 0);

  return (
    <section className="share-duplicate-group">
      <div className="share-duplicate-group-header">
        <div className="share-group-title">
          <span className="share-group-icon" aria-hidden="true">{icon}</span>
          <strong>{title}</strong>
        </div>
        <span>{duplicates.length} refs / {availableCount} disp.</span>
      </div>
      <div className="share-duplicate-grid">
        {duplicates.map(({ sticker, qty }) => (
          <button key={sticker.id} className={`share-duplicate-card selectable ${selectedRefs.has(sticker.reference) ? "selected" : ""}`} type="button" onClick={() => onToggle(sticker.reference)}>
            <div>
              <strong>{sticker.reference}</strong>
              <span>{getStickerDisplayTitle(sticker)}</span>
            </div>
            <span className="share-duplicate-qty">x{qty}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TradeRequestPanel({
  ownerName,
  currentUser,
  isAuthenticated,
  isSessionLoaded,
  requestUrl,
  baseRequestMessage,
  selectedMissing,
  selectedDuplicates,
  onCreateVisitor,
  onCreateTradeRequest
}: {
  ownerName: string;
  currentUser?: User;
  isAuthenticated: boolean;
  isSessionLoaded: boolean;
  requestUrl: string;
  baseRequestMessage: string;
  selectedMissing: StickerModel[];
  selectedDuplicates: Array<{ sticker: StickerModel; qty: number }>;
  onCreateVisitor: (name: string) => User | null;
  onCreateTradeRequest: (request: {
    requester: User;
    ownerName: string;
    requestedStickerIds: string[];
    offeredStickerIds: string[];
  }) => TradeProcess;
}) {
  const [visitorName, setVisitorName] = useState(currentUser?.name ?? "");
  const [requester, setRequester] = useState<User | undefined>(currentUser);
  const [createdTradeId, setCreatedTradeId] = useState("");

  useEffect(() => {
    if (currentUser) {
      setRequester(currentUser);
      setVisitorName(currentUser.name);
    }
  }, [currentUser]);

  const requestMessage = useMemo(() => {
    const requesterLine = requester?.name ? `\n\nSolicitante: ${requester.name}` : "";
    return `${baseRequestMessage}${requesterLine}`;
  }, [baseRequestMessage, requester?.name]);

  function handleCreateRequest() {
    const nextRequester = currentUser ?? requester ?? onCreateVisitor(visitorName);
    if (!nextRequester) return;
    setRequester(nextRequester);
    const trade = onCreateTradeRequest({
      requester: nextRequester,
      ownerName,
      requestedStickerIds: selectedDuplicates.map(({ sticker }) => sticker.id),
      offeredStickerIds: selectedMissing.map((sticker) => sticker.id)
    });
    setCreatedTradeId(trade.id);
  }

  const needsVisitorName = !isAuthenticated;
  const canCreateRequest = selectedDuplicates.length + selectedMissing.length > 0 && (!needsVisitorName || visitorName.trim().length > 0);

  return (
    <section id="solicitud-intercambio" className="panel share-request-panel">
      <div className="panel-header">
        <div>
          <h2>Solicitud de intercambio</h2>
          <p>{selectedDuplicates.length} pedidas / {selectedMissing.length} ofrecidas</p>
        </div>
      </div>
      <div className="share-request-content">
        <div className="share-request-summary">
          <div><strong>Quiero recibir</strong><span>{selectedDuplicates.map(({ sticker }) => sticker.reference).join(", ") || "Sin selección"}</span></div>
          <div><strong>Puedo ofrecer</strong><span>{selectedMissing.map((sticker) => sticker.reference).join(", ") || "Sin selección"}</span></div>
        </div>
        <div className="share-request-identity">
          {isAuthenticated && currentUser ? (
            <div className="share-request-user">
              <span className={`user-avatar ${currentUser.avatarUrl ? "has-image" : ""}`} style={currentUser.avatarUrl ? { backgroundImage: `url(${currentUser.avatarUrl})` } : undefined} aria-hidden="true">
                {currentUser.avatarUrl ? null : currentUser.name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U"}
              </span>
              <div>
                <strong>{currentUser.name}</strong>
                <span>La solicitud se creará con tu usuario.</span>
              </div>
            </div>
          ) : (
            <label className="settings-label">
              Tu nombre
              <input
                className="input"
                value={visitorName}
                onChange={(event) => setVisitorName(event.target.value)}
                placeholder="Nombre de quien solicita el intercambio"
              />
              <span className="share-request-help">
                Se creará un perfil visitante local para asociar esta solicitud.
              </span>
            </label>
          )}
        </div>
        <label className="share-link-desc">
          Enlace con la selección
          <input className="input" value={requestUrl} readOnly />
        </label>
        <label className="share-link-desc">
          Mensaje
          <textarea className="share-textarea compact" value={requestMessage} readOnly />
        </label>
        <div className="share-request-actions">
          <button className="button primary" disabled={!canCreateRequest || !isSessionLoaded} onClick={handleCreateRequest}>
            {createdTradeId ? "Solicitud creada" : "Crear solicitud"}
          </button>
          <a className={`button ${createdTradeId ? "" : "disabled-link"}`} href={buildWhatsAppUrl(requestMessage)} target="_blank" rel="noreferrer" aria-disabled={!createdTradeId}>
            <Share2 size={16} />
            Compartir por WhatsApp
          </a>
        </div>
        {createdTradeId ? <div className="backup-message">Solicitud creada y cargada a {requester?.name ?? "tu perfil"}.</div> : null}
      </div>
    </section>
  );
}

function InventoryShareModal({
  mode,
  user,
  missingStickers,
  duplicateStickers,
  currentState,
  onClose
}: {
  mode: "missing" | "duplicates";
  user: User;
  missingStickers: StickerModel[];
  duplicateStickers: StickerModel[];
  currentState: UserStateMap;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"text" | "link">("text");
  const [copied, setCopied] = useState(false);
  const text = useMemo(
    () => generateInventoryText(mode, user, missingStickers, duplicateStickers, currentState),
    [mode, user, missingStickers, duplicateStickers, currentState]
  );
  const url = useMemo(() => generateShareUrl(user, currentState), [user, currentState]);
  const whatsappText = useMemo(
    () => generateFullInventoryShareText(user, missingStickers, duplicateStickers, currentState, url),
    [currentState, duplicateStickers, missingStickers, url, user]
  );

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Compartir inventario">
      <div className="share-modal">
        <div className="share-modal-header">
          <div>
            <h2>{mode === "missing" ? "Lista de faltantes" : "Lista de repetidas"}</h2>
            <p>{user.name}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="share-tab-bar">
          <button className={`share-tab ${tab === "text" ? "active" : ""}`} type="button" onClick={() => { setTab("text"); setCopied(false); }}>Texto</button>
          <button className={`share-tab ${tab === "link" ? "active" : ""}`} type="button" onClick={() => { setTab("link"); setCopied(false); }}>Enlace público</button>
        </div>
        {tab === "text" ? (
          <div className="share-content">
            <textarea className="share-textarea" value={text} readOnly />
            <button className="button primary" onClick={() => handleCopy(text)}>
              <Copy size={14} />
              {copied ? "¡Copiado!" : "Copiar texto"}
            </button>
          </div>
        ) : (
          <div className="share-content">
            <p className="share-link-desc">Comparte este enlace. Tus amigos verán tus láminas faltantes y las que tienes disponibles para cambio.</p>
            <div className="share-url-row">
              <input className="input" value={url} readOnly />
              <button className="button primary" onClick={() => handleCopy(url)}>
                <Copy size={14} />
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            <a className="button" href={buildWhatsAppUrl(whatsappText)} target="_blank" rel="noreferrer">
              <Share2 size={16} />
              Compartir por WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportVisitorModal({
  localVisitors,
  states,
  hasExistingData,
  onImport,
  onSkip
}: {
  localVisitors: User[];
  states: Record<string, UserStateMap>;
  hasExistingData: boolean;
  onImport: (visitorId: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [selectedId, setSelectedId] = useState(localVisitors[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const selectedState = states[selectedId] ?? {};
  const ownedCount = allStickers.filter((s) => getQuantity(selectedState, s.id) > 0).length;

  async function handleImport() {
    setIsImporting(true);
    try { await onImport(selectedId); } finally { setIsImporting(false); }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Importar datos de visitante">
      <div className="save-modal">
        <div className="save-modal-header">
          <div>
            <h2>Importar datos de visitante</h2>
            <p>Tu album de Google está vacío. Puedes importar los datos de un visitante local para continuar donde lo dejaste.</p>
          </div>
        </div>
        <div className="import-visitor-form">
          <label className="import-visitor-label">
            Visitante a importar
            <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {localVisitors.map((v) => {
                const count = allStickers.filter((s) => getQuantity(states[v.id] ?? {}, s.id) > 0).length;
                return <option key={v.id} value={v.id}>{v.name} — {count} láminas obtenidas</option>;
              })}
            </select>
          </label>
          <div className="import-warning">
            <strong>⚠ Advertencia:</strong> {hasExistingData
              ? "Se sobrescribirán todos los datos actuales de tu cuenta Google con los del visitante seleccionado."
              : "Se importarán todos los datos del visitante a tu cuenta Google."
            } El perfil del visitante será eliminado. Esta acción no se puede deshacer.
          </div>
          <label className="toggle import-confirm-toggle">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Entiendo y quiero proceder ({ownedCount} láminas)
          </label>
        </div>
        <div className="save-modal-actions">
          <button className="button primary" disabled={!confirmed || isImporting} onClick={handleImport}>
            {isImporting ? "Importando..." : "Importar y eliminar visitante"}
          </button>
          <div className="save-modal-divider">o</div>
          <button className="button" onClick={onSkip}>Omitir por ahora</button>
        </div>
      </div>
    </div>
  );
}

function SettingsView({
  user,
  isAuthenticated,
  localVisitors,
  states,
  onUpdateName,
  onImportFromVisitor
}: {
  user: User;
  isAuthenticated: boolean;
  localVisitors: User[];
  states: Record<string, UserStateMap>;
  onUpdateName: (name: string) => void;
  onImportFromVisitor: (visitorId: string) => Promise<void>;
}) {
  const [editName, setEditName] = useState(user.name);
  const [nameSaved, setNameSaved] = useState(false);
  const [selectedVisitorId, setSelectedVisitorId] = useState(localVisitors[0]?.id ?? "");
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const hasExistingData = allStickers.some((s) => getQuantity(states[user.id] ?? {}, s.id) > 0);

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    onUpdateName(editName);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function handleImport() {
    setIsImporting(true);
    try { await onImportFromVisitor(selectedVisitorId); } finally { setIsImporting(false); }
  }

  return (
    <div className="settings-layout">
      <section className="panel">
        <div className="panel-header"><h2>Perfil</h2></div>
        <div className="settings-section">
          <div className="settings-field">
            <span className={`user-avatar large ${user.avatarUrl ? "has-image" : ""}`}
              style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
              aria-hidden="true">
              {user.avatarUrl ? null : user.name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U"}
            </span>
            <div className="settings-field-info">
              {!isAuthenticated ? (
                <form className="settings-name-form" onSubmit={handleSaveName}>
                  <label className="settings-label">
                    Nombre
                    <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </label>
                  <button className="button primary small" type="submit" disabled={!editName.trim() || editName === user.name}>
                    {nameSaved ? "Guardado" : "Guardar"}
                  </button>
                </form>
              ) : (
                <div>
                  <strong>{user.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{user.email ?? "Google"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {localVisitors.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Importar datos de visitante</h2>
          </div>
          <div className="settings-section">
            <p className="settings-description">
              Reemplaza los datos de tu cuenta con los de un visitante local. El visitante seleccionado será eliminado tras la importación.
            </p>
            <label className="settings-label">
              Visitante
              <select className="select" value={selectedVisitorId} onChange={(e) => { setSelectedVisitorId(e.target.value); setImportConfirmed(false); }}>
                {localVisitors.map((v) => {
                  const count = allStickers.filter((s) => getQuantity(states[v.id] ?? {}, s.id) > 0).length;
                  return <option key={v.id} value={v.id}>{v.name} — {count} láminas</option>;
                })}
              </select>
            </label>
            <div className="import-warning">
              <strong>⚠ Advertencia:</strong> {hasExistingData
                ? "Tu cuenta ya tiene datos. Se sobrescribirán completamente con los del visitante seleccionado."
                : "Se importarán todos los datos del visitante seleccionado."
              } El perfil del visitante será eliminado. Esta acción no se puede deshacer.
            </div>
            <label className="toggle">
              <input type="checkbox" checked={importConfirmed} onChange={(e) => setImportConfirmed(e.target.checked)} />
              Entiendo, quiero importar y eliminar este visitante
            </label>
            <button className="button primary" disabled={!importConfirmed || isImporting} onClick={handleImport} style={{ justifySelf: "start" }}>
              {isImporting ? "Importando..." : "Importar datos"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function UserMenu({
  user,
  visitors,
  isAuthenticated,
  onSignIn,
  onSignOut,
  onSwitchVisitor,
  onNewVisitor
}: {
  user: User;
  visitors: User[];
  isAuthenticated: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSwitchVisitor: (userId: string) => void;
  onNewVisitor: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  const avatarStyle = user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined;

  function closeMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function handleSwitchVisitor(userId: string) {
    onSwitchVisitor(userId);
    closeMenu();
  }

  return (
    <details ref={detailsRef} className="user-menu">
      <summary className="user-menu-trigger" aria-label="Menu de usuario">
        <span className={`user-avatar ${user.avatarUrl ? "has-image" : ""}`} style={avatarStyle} aria-hidden="true">
          {user.avatarUrl ? null : initials}
        </span>
        <span className="user-menu-name">{user.name}</span>
        <ChevronDown size={16} />
      </summary>
      <div className="user-menu-panel">
        <div className="user-menu-profile">
          <span className={`user-avatar large ${user.avatarUrl ? "has-image" : ""}`} style={avatarStyle} aria-hidden="true">
            {user.avatarUrl ? null : initials}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{isAuthenticated ? user.email ?? "Google" : "Sesion visitante"}</span>
          </div>
        </div>

        {!isAuthenticated && visitors.length > 1 ? (
          <div className="visitor-switcher">
            {visitors.map((visitor) => (
              <button
                key={visitor.id}
                className={`visitor-switcher-item ${visitor.id === user.id ? "active" : ""}`}
                type="button"
                onClick={() => handleSwitchVisitor(visitor.id)}
              >
                <span className="visitor-switcher-initials" aria-hidden="true">
                  {visitor.name[0]?.toUpperCase() ?? "V"}
                </span>
                <span className="visitor-switcher-name">{visitor.name}</span>
                {visitor.id === user.id ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        ) : null}

        {!isAuthenticated ? (
          <button className="user-menu-action" type="button" onClick={() => { closeMenu(); onNewVisitor(); }}>
            <UserPlus size={16} />
            Nuevo visitante
          </button>
        ) : null}

        {isAuthenticated ? (
          <button className="user-menu-action" type="button" onClick={onSignOut}>
            <LogOut size={16} />
            Cerrar sesion
          </button>
        ) : (
          <button className="user-menu-action" type="button" disabled={!hasSupabaseConfig} onClick={onSignIn}>
            <LogIn size={16} />
            Iniciar sesion con Google
          </button>
        )}
      </div>
    </details>
  );
}

function Filters({
  filters,
  onChange,
  onReset
}: {
  filters: StickerFilters;
  onChange: (filters: StickerFilters) => void;
  onReset: () => void;
}) {
  return (
    <div className="toolbar">
      <div className="filter-search">
        <Search size={16} className="filter-search-icon" />
        <input
          className="input"
          placeholder="Buscar por referencia, pais, titulo o tipo"
          value={filters.query ?? ""}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
      </div>
      <select className="select" value={filters.sectionId ?? "all"} onChange={(event) => onChange({ ...filters, sectionId: event.target.value })}>
        <option value="all">Todas las secciones</option>
        {paniniWorldCup2026Catalog.sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name}
          </option>
        ))}
      </select>
      <select className="select" value={filters.countryCode ?? "all"} onChange={(event) => onChange({ ...filters, countryCode: event.target.value })}>
        <option value="all">Todos los paises</option>
        {paniniWorldCup2026Catalog.countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.code} - {country.nameEs}
          </option>
        ))}
      </select>
      <select className="select" value={filters.type ?? "all"} onChange={(event) => onChange({ ...filters, type: event.target.value as StickerFilters["type"] })}>
        <option value="all">Todos los tipos</option>
        {Object.entries(typeLabels).map(([type, label]) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>
      <label className="toggle">
        <input type="checkbox" checked={Boolean(filters.onlyFoil)} onChange={(event) => onChange({ ...filters, onlyFoil: event.target.checked })} />
        Solo foil
      </label>
      <label className="toggle">
        <input type="checkbox" checked={Boolean(filters.onlyPlayers)} onChange={(event) => onChange({ ...filters, onlyPlayers: event.target.checked })} />
        Solo jugadores
      </label>
      <button className="button" onClick={onReset}>
        <X size={16} />
        Limpiar
      </button>
    </div>
  );
}

function Dashboard({
  progress,
  progressBySection,
  progressByCountry
}: {
  progress: ReturnType<typeof getUserProgress>;
  progressBySection: ReturnType<typeof getProgressBySection>;
  progressByCountry: ReturnType<typeof getProgressByCountry>;
}) {
  return (
    <>
      <div className="grid">
        <Metric label="Total base" value={progress.totalBaseStickerCount} />
        <Metric label="Unicas obtenidas" value={progress.ownedUniqueCount} />
        <Metric label="Faltantes" value={progress.missingCount} />
        <Metric label="Repetidas disponibles" value={progress.totalDuplicateCopies} />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Avance general</h2>
          <strong>{formatPercent(progress.completionPercentage)}</strong>
        </div>
        <div style={{ padding: 16 }}>
          <ProgressBar value={progress.completionPercentage} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Progreso por seccion</h2>
        </div>
        <div className="progress-list">
          {progressBySection.map((item) => (
            <ProgressItem key={item.sectionId} name={item.sectionName} owned={item.owned} total={item.total} percentage={item.percentage} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Progreso por pais</h2>
        </div>
        <div className="progress-list">
          {progressByCountry.map((item) => (
            <ProgressItem key={item.countryCode} name={`${item.countryCode} - ${item.countryNameEs}`} owned={item.owned} total={item.total} percentage={item.percentage} />
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressItem({ name, owned, total, percentage }: { name: string; owned: number; total: number; percentage: number }) {
  return (
    <div className="progress-item">
      <div className="progress-row">
        <strong>{name}</strong>
        <span>{owned}/{total}</span>
      </div>
      <ProgressBar value={percentage} />
      <div className="progress-row">
        <span>{formatPercent(percentage)}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function AlbumView({
  stickers,
  userState,
  onUpdateQuantity,
  onUpdateQuantities
}: {
  stickers: StickerModel[];
  userState: UserStateMap;
  onUpdateQuantity: (stickerId: string, quantity: number) => void;
  onUpdateQuantities: (updates: Array<{ stickerId: string; quantity: number }>) => void;
}) {
  const [sortMode, setSortMode] = useState<AlbumSortMode>(() => readSessionSortMode(albumSortSessionKey));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(paniniWorldCup2026Catalog.countries.map((country) => `country-${country.code}`))
  );
  const intro = stickers.filter((sticker) => sticker.sectionId === "intro");
  const museum = stickers.filter((sticker) => sticker.sectionId === "museum");
  const sortedCountries = useMemo(() => {
    if (sortMode === "alphabetical") {
      return [...paniniWorldCup2026Catalog.countries].sort((a, b) => a.code.localeCompare(b.code, "es"));
    }

    return paniniWorldCup2026Catalog.countries;
  }, [sortMode]);

  useEffect(() => {
    writeSessionSortMode(albumSortSessionKey, sortMode);
  }, [sortMode]);

  const byCountry = sortedCountries
    .map((country) => ({
      country,
      stickers: stickers.filter((sticker) => sticker.countryCode === country.code)
    }))
    .filter((group) => group.stickers.length > 0);
  function toggleGroup(groupId: string) {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function setGroupQuantity(groupStickers: StickerModel[], quantity: number) {
    onUpdateQuantities(groupStickers.map((sticker) => ({ stickerId: sticker.id, quantity })));
  }

  return (
    <div className="album-layout">
      {stickers.length === 0 ? <div className="empty">No hay laminas para mostrar con estos filtros.</div> : null}
      <StickerGroupAccordion
        groupId="section-intro"
        title="Introduccion"
        stickers={intro}
        userState={userState}
        isCollapsed={collapsedGroups.has("section-intro")}
        onToggle={toggleGroup}
        onSetAll={setGroupQuantity}
        onUpdateQuantity={onUpdateQuantity}
      />
      <section className="section-band">
        <div className="section-title album-section-title">
          <h2>Selecciones</h2>
          <div className="section-controls">
            <select
              className="select compact-select"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as AlbumSortMode)}
              aria-label="Orden de selecciones"
            >
              <option value="album">Orden del album</option>
              <option value="alphabetical">Orden alfabetico</option>
            </select>
            <span className="badge">{byCountry.reduce((total, group) => total + group.stickers.length, 0)} laminas</span>
          </div>
        </div>
        {byCountry.map((group) => (
          <StickerGroupAccordion
            key={group.country.code}
            groupId={`country-${group.country.code}`}
            title={`${group.country.code} - ${group.country.nameEs}`}
            stickers={group.stickers}
            userState={userState}
            isCollapsed={collapsedGroups.has(`country-${group.country.code}`)}
            onToggle={toggleGroup}
            onSetAll={setGroupQuantity}
            onUpdateQuantity={onUpdateQuantity}
          />
        ))}
      </section>
      <StickerGroupAccordion
        groupId="section-museum"
        title="FIFA Museum"
        stickers={museum}
        userState={userState}
        isCollapsed={collapsedGroups.has("section-museum")}
        onToggle={toggleGroup}
        onSetAll={setGroupQuantity}
        onUpdateQuantity={onUpdateQuantity}
      />
    </div>
  );
}

function buildAssistantGroups(baseStickers: StickerModel[], sortMode: AlbumSortMode): AssistantGroup[] {
  const intro = baseStickers.filter((sticker) => sticker.sectionId === "intro");
  const museum = baseStickers.filter((sticker) => sticker.sectionId === "museum");
  const countries =
    sortMode === "alphabetical"
      ? [...paniniWorldCup2026Catalog.countries].sort((a, b) => a.code.localeCompare(b.code, "es"))
      : paniniWorldCup2026Catalog.countries;
  const countryGroups = countries
    .map((country) => ({
      id: `country-${country.code}`,
      label: `${country.code} - ${country.nameEs}`,
      image: countryFlagByCode[country.code] ?? "⚽",
      stickers: baseStickers.filter((sticker) => sticker.countryCode === country.code)
    }))
    .filter((group) => group.stickers.length > 0);

  return [
    intro.length > 0
      ? {
          id: "section-intro",
          label: "Introduccion",
          image: "🏆",
          stickers: intro
        }
      : null,
    ...countryGroups,
    museum.length > 0
      ? {
          id: "section-museum",
          label: "FIFA Museum",
          image: "🏛️",
          stickers: museum
        }
      : null
  ].filter(Boolean) as AssistantGroup[];
}

function AlbumAssistantModal({
  baseStickers,
  userState,
  currentIndex,
  onIndexChange,
  onUpdateQuantity,
  onUpdateQuantities,
  onClose
}: {
  baseStickers: StickerModel[];
  userState: UserStateMap;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onUpdateQuantity: (stickerId: string, quantity: number) => void;
  onUpdateQuantities: (updates: Array<{ stickerId: string; quantity: number }>) => Promise<void>;
  onClose: () => void;
}) {
  const [sortMode, setSortMode] = useState<AlbumSortMode>(() => readSessionSortMode(assistantSortSessionKey));
  const [markMode, setMarkMode] = useState<AssistantMarkMode | null>(null);
  const [isConfirmingMissingMode, setIsConfirmingMissingMode] = useState(false);
  const [isPreparingMissingMode, setIsPreparingMissingMode] = useState(false);
  const groups = useMemo(() => buildAssistantGroups(baseStickers, sortMode), [baseStickers, sortMode]);
  const stickers = useMemo(() => groups.flatMap((group) => group.stickers), [groups]);
  const sticker = stickers[currentIndex];
  const quantity = sticker ? getQuantity(userState, sticker.id) : 0;
  const currentGroup =
    groups.find((group) => sticker && group.stickers.some((groupSticker) => groupSticker.id === sticker.id)) ?? groups[0];
  const currentGroupIndex = currentGroup ? groups.findIndex((group) => group.id === currentGroup.id) : 0;
  const groupStartIndex = currentGroup ? stickers.findIndex((groupSticker) => groupSticker.id === currentGroup.stickers[0]?.id) : 0;
  const currentInGroupIndex = currentGroup && groupStartIndex >= 0 ? currentIndex - groupStartIndex : 0;
  const groupProgress = currentGroup ? getGroupSummary(currentGroup.stickers, userState) : null;

  useEffect(() => {
    writeSessionSortMode(assistantSortSessionKey, sortMode);
  }, [sortMode]);

  useEffect(() => {
    onIndexChange(Math.min(currentIndex, Math.max(0, stickers.length - 1)));
  }, [currentIndex, onIndexChange, stickers.length]);

  function goTo(delta: number) {
    onIndexChange(Math.min(stickers.length - 1, Math.max(0, currentIndex + delta)));
  }

  function goToGroup(groupIndex: number) {
    const group = groups[groupIndex];
    const firstSticker = group?.stickers[0];
    if (!firstSticker) return;
    const nextIndex = stickers.findIndex((groupSticker) => groupSticker.id === firstSticker.id);
    if (nextIndex >= 0) onIndexChange(nextIndex);
  }

  function incrementCurrent() {
    if (!sticker) return;
    onUpdateQuantity(sticker.id, quantity + 1);
  }

  const applyPrimaryAction = useCallback((targetSticker: StickerModel) => {
    if (markMode === "missing") {
      onUpdateQuantity(targetSticker.id, 0);
      return;
    }
    onUpdateQuantity(targetSticker.id, getQuantity(userState, targetSticker.id) + 1);
  }, [markMode, onUpdateQuantity, userState]);

  const applyAlternativeAction = useCallback((targetSticker: StickerModel) => {
    if (markMode === "missing") {
      onUpdateQuantity(targetSticker.id, 1);
      return;
    }
    onUpdateQuantity(targetSticker.id, 0);
  }, [markMode, onUpdateQuantity]);

  function selectAndApply(targetSticker: StickerModel) {
    const nextIndex = stickers.findIndex((groupSticker) => groupSticker.id === targetSticker.id);
    if (nextIndex >= 0) onIndexChange(nextIndex);
    applyPrimaryAction(targetSticker);
  }

  async function startMissingMode() {
    setIsPreparingMissingMode(true);
    try {
      const isEmpty = !baseStickers.some((s) => getQuantity(userState, s.id) > 0);
      if (isEmpty) {
        await onUpdateQuantities(baseStickers.map((s) => ({ stickerId: s.id, quantity: 1 })));
      }
      setMarkMode("missing");
    } finally {
      setIsPreparingMissingMode(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA") return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndexChange(Math.max(0, currentIndex - 1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndexChange(Math.min(stickers.length - 1, currentIndex + 1));
      }
      if (event.key === "[") {
        event.preventDefault();
        const previousGroup = groups[currentGroupIndex - 1];
        const firstSticker = previousGroup?.stickers[0];
        const nextIndex = firstSticker ? stickers.findIndex((groupSticker) => groupSticker.id === firstSticker.id) : -1;
        if (nextIndex >= 0) onIndexChange(nextIndex);
      }
      if (event.key === "]") {
        event.preventDefault();
        const nextGroup = groups[currentGroupIndex + 1];
        const firstSticker = nextGroup?.stickers[0];
        const nextIndex = firstSticker ? stickers.findIndex((groupSticker) => groupSticker.id === firstSticker.id) : -1;
        if (nextIndex >= 0) onIndexChange(nextIndex);
      }
      if (event.key === " ") {
        event.preventDefault();
        if (sticker && markMode) applyPrimaryAction(sticker);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applyPrimaryAction, currentGroupIndex, currentIndex, groups, markMode, onClose, onIndexChange, quantity, sticker, stickers]);

  if (!sticker) return null;

  if (!markMode) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Configurar asistente de marcado">
        <div className="assistant-modal assistant-start-modal">
          <div className="assistant-header">
            <div>
              <h2>Asistente de marcado</h2>
              <p>Elige como quieres registrar tu album.</p>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="Cerrar asistente">
              <X size={18} />
            </button>
          </div>

          <div className="assistant-mode-grid">
            <button className="assistant-mode-card" type="button" onClick={() => setMarkMode("owned")}>
              <strong>Marcar las que tengo</strong>
              <span>El album empieza vacio. Cada click o espacio agrega una copia de la lamina seleccionada.</span>
            </button>
            <button className="assistant-mode-card emphasized" type="button" onClick={() => setIsConfirmingMissingMode(true)} disabled={isPreparingMissingMode}>
              <strong>{isPreparingMissingMode ? "Preparando album..." : "Marcar las que me faltan"}</strong>
              <span>Si el album está vacío, se marca todo con cantidad 1. Si ya tiene datos, se conserva el estado. Cada click o espacio deja esa lamina en faltante.</span>
            </button>
          </div>

          {isConfirmingMissingMode ? (
            <div className="assistant-confirm-box" role="alert">
              <div>
                <strong>Confirmar modo faltantes</strong>
                <span>
                  Se marcará todo el album como lleno con cantidad 1. Luego, las laminas que selecciones en el asistente se desmarcarán y quedarán como faltantes.
                </span>
              </div>
              <div className="assistant-confirm-actions">
                <button className="button" type="button" onClick={() => setIsConfirmingMissingMode(false)} disabled={isPreparingMissingMode}>
                  Cancelar
                </button>
                <button className="button primary" type="button" onClick={startMissingMode} disabled={isPreparingMissingMode}>
                  {isPreparingMissingMode ? "Preparando..." : "Confirmar"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="assistant-mode-note">
            <strong>Nota:</strong> el modo de faltantes actualiza las {baseStickers.length} laminas base a cantidad 1 antes de iniciar.
          </div>
        </div>
      </div>
    );
  }

  const primaryActionLabel = markMode === "missing" ? "Click para marcar como faltante." : "Click para agregar una copia.";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Asistente de marcado">
      <div className="assistant-modal">
        <div className="assistant-header">
          <div>
            <h2>Asistente de marcado</h2>
            <p>{currentIndex + 1} de {stickers.length}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar asistente">
            <X size={18} />
          </button>
        </div>

        <div className="assistant-group-nav">
          <button className="icon-button" onClick={() => goToGroup(currentGroupIndex - 1)} disabled={currentGroupIndex <= 0} aria-label="Grupo anterior">
            <ArrowLeft size={17} />
          </button>
          <div className="assistant-group-current">
            <div className="assistant-section-image" aria-hidden="true">{currentGroup?.image ?? "⚽"}</div>
            <div>
              <strong>{currentGroup?.label ?? "Album"}</strong>
              <span>
                {currentInGroupIndex + 1} de {currentGroup?.stickers.length ?? 0}
                {groupProgress ? ` / ${groupProgress.owned}/${groupProgress.total} obtenidas` : ""}
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={() => goToGroup(currentGroupIndex + 1)} disabled={currentGroupIndex >= groups.length - 1} aria-label="Grupo siguiente">
            <ArrowRight size={17} />
          </button>
          <select className="select assistant-order-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as AlbumSortMode)} aria-label="Orden del asistente">
            <option value="album">Orden del album</option>
            <option value="alphabetical">Orden alfabetico</option>
          </select>
          <select className="select assistant-group-select" value={currentGroup?.id ?? ""} onChange={(event) => goToGroup(groups.findIndex((group) => group.id === event.target.value))} aria-label="Ir a seccion o seleccion">
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </div>

        <div className="assistant-workspace">
          <div className="assistant-sticker-grid" aria-label={`Laminas de ${currentGroup?.label ?? "la seccion"}`}>
            {currentGroup?.stickers.map((groupSticker) => {
              const groupStickerQuantity = getQuantity(userState, groupSticker.id);
              const groupStickerStatus = getStickerStatus(groupStickerQuantity);
              const isCurrent = groupSticker.id === sticker.id;
              const altLabel = markMode === "missing" ? "Marcar como obtenida" : "Marcar como faltante";

              return (
                <div key={groupSticker.id} className="assistant-sticker-tile-wrap">
                  <button
                    className={`assistant-sticker-tile ${groupStickerStatus} ${isCurrent ? "current" : ""}`}
                    type="button"
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={`${groupSticker.reference}, ${statusLabels[groupStickerStatus]}, cantidad ${groupStickerQuantity}. ${primaryActionLabel}`}
                    onClick={() => selectAndApply(groupSticker)}
                  >
                    <span className="assistant-tile-reference">{groupSticker.reference}</span>
                    <span className="assistant-tile-title">{getStickerDisplayTitle(groupSticker)}</span>
                    <span className="assistant-tile-meta">
                      <span className={`status-dot ${groupStickerStatus}`} aria-hidden="true" />
                      {statusLabels[groupStickerStatus]} · {groupStickerQuantity}
                    </span>
                  </button>
                  <button
                    className="assistant-tile-alt"
                    type="button"
                    aria-label={`${altLabel}: ${groupSticker.reference}`}
                    onClick={(e) => { e.stopPropagation(); applyAlternativeAction(groupSticker); }}
                  >
                    {markMode === "missing" ? <Check size={11} /> : <X size={11} />}
                  </button>
                </div>
              );
            })}
          </div>

        </div>

        <div className="assistant-controls">
          <button className="button" onClick={() => goTo(-1)} disabled={currentIndex === 0}>
            <ArrowLeft size={16} />
            Anterior
          </button>
          <div className="assistant-quantity-controls">
            <button className="icon-button" title="Reducir" aria-label="Reducir cantidad" onClick={() => onUpdateQuantity(sticker.id, quantity - 1)}>
              <CircleMinus size={18} />
            </button>
            <input
              className="quantity-input"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => onUpdateQuantity(sticker.id, Number(event.target.value))}
              aria-label={`Cantidad de ${sticker.reference}`}
            />
            <button className="icon-button" title="Incrementar" aria-label="Incrementar cantidad" onClick={incrementCurrent}>
              <CirclePlus size={18} />
            </button>
          </div>
          <button className="button" onClick={() => goTo(1)} disabled={currentIndex === stickers.length - 1}>
            Siguiente
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="assistant-hints">
          <span>Flecha izquierda: anterior</span>
          <span>Flecha derecha: siguiente</span>
          <span>[ y ]: cambiar seccion</span>
          <span>{markMode === "missing" ? "Espacio: marcar faltante" : "Espacio: agregar copia"}</span>
        </div>
      </div>
    </div>
  );
}

function getGroupSummary(stickers: StickerModel[], userState: UserStateMap) {
  const owned = stickers.filter((sticker) => getQuantity(userState, sticker.id) >= 1).length;
  const duplicateUnique = stickers.filter((sticker) => getQuantity(userState, sticker.id) > 1).length;
  const duplicateCopies = stickers.reduce((total, sticker) => total + Math.max(0, getQuantity(userState, sticker.id) - 1), 0);
  const total = stickers.length;
  const missing = total - owned;

  return {
    total,
    owned,
    missing,
    duplicateUnique,
    duplicateCopies,
    percentage: total === 0 ? 0 : (owned / total) * 100
  };
}

function StickerGroupAccordion({
  groupId,
  title,
  stickers,
  userState,
  isCollapsed,
  onToggle,
  onSetAll,
  onUpdateQuantity
}: {
  groupId: string;
  title: string;
  stickers: StickerModel[];
  userState: UserStateMap;
  isCollapsed: boolean;
  onToggle: (groupId: string) => void;
  onSetAll: (stickers: StickerModel[], quantity: number) => void;
  onUpdateQuantity: (stickerId: string, quantity: number) => void;
}) {
  if (stickers.length === 0) return null;
  const summary = getGroupSummary(stickers, userState);

  return (
    <section className={`country-block accordion-block ${isCollapsed ? "collapsed" : ""}`} data-testid={`album-group-${groupId}`}>
      <div className="accordion-header">
        <button
          className="accordion-toggle"
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={`${groupId}-content`}
          onClick={() => onToggle(groupId)}
        >
          <ChevronDown size={18} className="accordion-chevron" />
          <span>{title}</span>
        </button>
        <GroupSummary summary={summary} />
        <div className="group-actions">
          <button className="button small" type="button" onClick={() => onSetAll(stickers, 1)}>
            Todas
          </button>
          <button className="button small" type="button" onClick={() => onSetAll(stickers, 0)}>
            Ninguna
          </button>
        </div>
      </div>
      {isCollapsed ? (
        <div className="collapsed-summary">
          <ProgressBar value={summary.percentage} />
        </div>
      ) : (
        <div className="sticker-grid" id={`${groupId}-content`}>
          {stickers.map((sticker) => (
            <StickerCard key={sticker.id} sticker={sticker} quantity={getQuantity(userState, sticker.id)} onUpdateQuantity={onUpdateQuantity} />
          ))}
        </div>
      )}
    </section>
  );
}

function GroupSummary({ summary }: { summary: ReturnType<typeof getGroupSummary> }) {
  return (
    <div className="group-summary" aria-label={`${summary.owned} de ${summary.total} obtenidas`}>
      <span>{summary.owned}/{summary.total}</span>
      <span>{formatPercent(summary.percentage)}</span>
      <span>Faltan {summary.missing}</span>
      <span>Rep. {summary.duplicateCopies}</span>
    </div>
  );
}

function StickerCard({
  sticker,
  quantity,
  onUpdateQuantity
}: {
  sticker: StickerModel;
  quantity: number;
  onUpdateQuantity: (stickerId: string, quantity: number) => void;
}) {
  const status = getStickerStatus(quantity);
  const incrementQuantity = () => onUpdateQuantity(sticker.id, quantity + 1);
  const stopCardToggle = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <article
      className={`sticker-card ${status}`}
      data-testid={`album-card-${sticker.reference}`}
      role="button"
      tabIndex={0}
      aria-label={`${sticker.reference}, ${statusLabels[status]}, cantidad ${quantity}. Click para agregar una copia.`}
      onClick={incrementQuantity}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          incrementQuantity();
        }
      }}
    >
      <div className="sticker-main">
        <div className="sticker-head">
          <div className="reference">{sticker.reference}</div>
          <span className={`status-dot ${status}`} aria-hidden="true" />
        </div>
        <div className="sticker-title">{sticker.countryNameEs ?? sticker.sectionName}</div>
        <div className="badges">
          <span className={`badge ${status}`}>{statusLabels[status]}</span>
          <span className="badge">{typeLabels[sticker.type]}</span>
          {sticker.isFoil ? <span className="badge">Foil</span> : null}
        </div>
      </div>
      <div className="sticker-actions" onClick={stopCardToggle}>
        <button className="icon-button" title="Reducir" aria-label="Reducir cantidad" onClick={() => onUpdateQuantity(sticker.id, quantity - 1)}>
          <CircleMinus size={18} />
        </button>
        <input
          className="quantity-input"
          inputMode="numeric"
          value={quantity}
          onClick={stopCardToggle}
          onKeyDown={stopCardToggle}
          onChange={(event) => onUpdateQuantity(sticker.id, Number(event.target.value))}
          aria-label={`Cantidad de ${sticker.reference}`}
        />
        <button className="icon-button" title="Incrementar" aria-label="Incrementar cantidad" onClick={incrementQuantity}>
          <CirclePlus size={18} />
        </button>
        <button className="icon-button" title="Marcar faltante" aria-label="Marcar faltante" onClick={() => onUpdateQuantity(sticker.id, 0)}>
          <X size={17} />
        </button>
      </div>
    </article>
  );
}

function StickerList({
  stickers,
  userState,
  emptyText,
  mode,
  onUpdateQuantity
}: {
  stickers: StickerModel[];
  userState: UserStateMap;
  emptyText: string;
  mode: "missing" | "duplicates";
  onUpdateQuantity: (stickerId: string, quantity: number) => void;
}) {
  if (stickers.length === 0) return <div className="empty">{emptyText}</div>;

  return (
    <div className="list">
      {stickers.map((sticker) => {
        const quantity = getQuantity(userState, sticker.id);
        return (
          <div className="list-row" key={sticker.id}>
            <strong>{sticker.reference}</strong>
            <span>{sticker.countryNameEs ?? sticker.sectionName} - {sticker.title}</span>
            <span className="badge">{typeLabels[sticker.type]}{sticker.isFoil ? " / Foil" : ""}</span>
            <span>{mode === "duplicates" ? `Cambio: ${quantity - 1}` : `Cantidad: ${quantity}`}</span>
            <div className="sticker-actions">
              <button className="icon-button" title="Reducir" aria-label="Reducir cantidad" onClick={() => onUpdateQuantity(sticker.id, quantity - 1)}>
                <CircleMinus size={18} />
              </button>
              <input className="quantity-input" value={quantity} onChange={(event) => onUpdateQuantity(sticker.id, Number(event.target.value))} />
              <button className="icon-button" title="Incrementar" aria-label="Incrementar cantidad" onClick={() => onUpdateQuantity(sticker.id, quantity + 1)}>
                <CirclePlus size={18} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareView({
  users,
  currentUser,
  compareUser,
  compareUserId,
  onCompareUserChange,
  currentState,
  compareState,
  states,
  onUpdateUserQuantities
}: {
  users: User[];
  currentUser?: User;
  compareUser: User;
  compareUserId: string;
  onCompareUserChange: (userId: string) => void;
  currentState: UserStateMap;
  compareState: UserStateMap;
  states: Record<string, UserStateMap>;
  onUpdateUserQuantities: (userId: string, updates: Array<{ stickerId: string; quantity: number }>) => void;
}) {
  const [trades, setTrades] = useState<TradeProcess[]>(() => readLocalTrades());
  const [requestedStickerIds, setRequestedStickerIds] = useState<string[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const friendDuplicates = useMemo(
    () => allStickers.filter((sticker) => getQuantity(compareState, sticker.id) > 1),
    [compareState]
  );
  const usefulRequesterDuplicates = useMemo(
    () => allStickers.filter((sticker) => getQuantity(currentState, sticker.id) > 1 && getQuantity(compareState, sticker.id) === 0),
    [currentState, compareState]
  );
  const activeTrades = trades.filter(
    (trade) =>
      currentUser &&
      (trade.requesterId === currentUser.id || trade.friendId === currentUser.id || trade.friendId === compareUser.id || trade.requesterId === compareUser.id)
  );
  const selectedTrade = activeTrades.find((trade) => trade.id === selectedTradeId) ?? activeTrades[0];

  function persistTrades(nextTrades: TradeProcess[]) {
    setTrades(nextTrades);
    writeLocalTrades(nextTrades);
  }

  function toggleId(ids: string[], stickerId: string) {
    return ids.includes(stickerId) ? ids.filter((id) => id !== stickerId) : [...ids, stickerId];
  }

  function createRequest() {
    if (!currentUser || requestedStickerIds.length === 0) return;
    const now = new Date().toISOString();
    const trade: TradeProcess = {
      id: `trade-${Date.now()}`,
      requesterId: currentUser.id,
      friendId: compareUser.id,
      requestedStickerIds,
      offeredStickerIds: [],
      status: "requested",
      createdAt: now,
      updatedAt: now
    };
    const nextTrades = [trade, ...trades];
    persistTrades(nextTrades);
    setSelectedTradeId(trade.id);
    setRequestedStickerIds([]);
  }

  function updateTrade(tradeId: string, updater: (trade: TradeProcess) => TradeProcess) {
    const nextTrades = trades.map((trade) => (trade.id === tradeId ? updater(trade) : trade));
    persistTrades(nextTrades);
  }

  function acceptTrade(trade: TradeProcess) {
    updateTrade(trade.id, (current) => ({
      ...current,
      offeredStickerIds: usefulRequesterDuplicates.slice(0, current.requestedStickerIds.length).map((sticker) => sticker.id),
      status: "accepted",
      updatedAt: new Date().toISOString()
    }));
  }

  function completeTrade(trade: TradeProcess) {
    const requesterState = states[trade.requesterId] ?? {};
    const friendState = states[trade.friendId] ?? {};
    const requesterUpdates = [
      ...trade.requestedStickerIds.map((stickerId) => ({
        stickerId,
        quantity: getQuantity(requesterState, stickerId) + 1
      })),
      ...trade.offeredStickerIds.map((stickerId) => ({
        stickerId,
        quantity: getQuantity(requesterState, stickerId) - 1
      }))
    ];
    const friendUpdates = [
      ...trade.requestedStickerIds.map((stickerId) => ({
        stickerId,
        quantity: getQuantity(friendState, stickerId) - 1
      })),
      ...trade.offeredStickerIds.map((stickerId) => ({
        stickerId,
        quantity: getQuantity(friendState, stickerId) + 1
      }))
    ];

    onUpdateUserQuantities(trade.requesterId, requesterUpdates);
    onUpdateUserQuantities(trade.friendId, friendUpdates);
    updateTrade(trade.id, (current) => ({
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }

  return (
    <div className="trade-layout">
      <section className="panel">
        <div className="panel-header">
          <h2>Solicitar cambio</h2>
          <select className="select" style={{ maxWidth: 280 }} value={compareUserId} onChange={(event) => onCompareUserChange(event.target.value)}>
            {users
              .filter((user) => user.id !== currentUser?.id)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </div>
        <div className="trade-content">
          <div className="trade-copy">
            <strong>{compareUser.name}</strong>
            <span>{friendDuplicates.length} repetidas disponibles. Selecciona las que quieres pedir y crea la solicitud.</span>
          </div>
          <SelectableStickerList
            stickers={friendDuplicates}
            state={compareState}
            selectedIds={requestedStickerIds}
            onToggle={(stickerId) => setRequestedStickerIds((previous) => toggleId(previous, stickerId))}
            emptyText="Este amigo no tiene repetidas disponibles."
          />
          <button className="button primary" onClick={createRequest} disabled={requestedStickerIds.length === 0}>
            Solicitar cambio ({requestedStickerIds.length})
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Procesos de intercambio</h2>
          <span className="badge">{activeTrades.length} procesos</span>
        </div>
        <div className="trade-process-grid">
          <div className="trade-process-list">
            {activeTrades.length === 0 ? (
              <div className="empty">Aun no hay solicitudes de cambio.</div>
            ) : (
              activeTrades.map((trade) => (
                <button
                  key={trade.id}
                  className={`trade-process-button ${selectedTrade?.id === trade.id ? "active" : ""}`}
                  onClick={() => setSelectedTradeId(trade.id)}
                >
                  <strong>{getUserName(users, trade.requesterId)} {"->"} {getUserName(users, trade.friendId)}</strong>
                  <span>{trade.requestedStickerIds.length} pide / {trade.offeredStickerIds.length} ofrece</span>
                  <span className={`badge ${trade.status === "completed" ? "owned" : trade.status === "accepted" ? "duplicate" : ""}`}>
                    {trade.status === "requested" ? "Solicitado" : trade.status === "accepted" ? "Aceptado" : "Completado"}
                  </span>
                </button>
              ))
            )}
          </div>
          {selectedTrade ? (
            <TradeEditor
              trade={selectedTrade}
              users={users}
              requesterState={states[selectedTrade.requesterId] ?? {}}
              friendState={states[selectedTrade.friendId] ?? {}}
              usefulRequesterDuplicates={usefulRequesterDuplicates}
              onAccept={() => acceptTrade(selectedTrade)}
              onToggleRequested={(stickerId) =>
                updateTrade(selectedTrade.id, (trade) => ({
                  ...trade,
                  requestedStickerIds: toggleId(trade.requestedStickerIds, stickerId),
                  updatedAt: new Date().toISOString()
                }))
              }
              onToggleOffered={(stickerId) =>
                updateTrade(selectedTrade.id, (trade) => ({
                  ...trade,
                  offeredStickerIds: toggleId(trade.offeredStickerIds, stickerId),
                  updatedAt: new Date().toISOString()
                }))
              }
              onComplete={() => completeTrade(selectedTrade)}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function getUserName(users: User[], userId: string) {
  return users.find((user) => user.id === userId)?.name ?? "Usuario";
}

function TradeEditor({
  trade,
  users,
  requesterState,
  friendState,
  usefulRequesterDuplicates,
  onAccept,
  onToggleRequested,
  onToggleOffered,
  onComplete
}: {
  trade: TradeProcess;
  users: User[];
  requesterState: UserStateMap;
  friendState: UserStateMap;
  usefulRequesterDuplicates: StickerModel[];
  onAccept: () => void;
  onToggleRequested: (stickerId: string) => void;
  onToggleOffered: (stickerId: string) => void;
  onComplete: () => void;
}) {
  const requestedStickers = trade.requestedStickerIds.map((id) => allStickers.find((sticker) => sticker.id === id)).filter(Boolean) as StickerModel[];
  const offeredStickers = trade.offeredStickerIds.map((id) => allStickers.find((sticker) => sticker.id === id)).filter(Boolean) as StickerModel[];
  const friendAvailableDuplicates = allStickers.filter((sticker) => getQuantity(friendState, sticker.id) > 1);
  const canComplete = trade.status === "accepted" && trade.requestedStickerIds.length > 0 && trade.offeredStickerIds.length > 0;

  return (
    <div className="trade-editor">
      <div className="trade-copy">
        <strong>{getUserName(users, trade.requesterId)} pide a {getUserName(users, trade.friendId)}</strong>
        <span>El intercambio se puede editar hasta marcarlo como completado.</span>
      </div>

      {trade.status === "requested" ? (
        <button className="button primary" onClick={onAccept}>
          Aceptar y revisar laminas utiles
        </button>
      ) : null}

      <div className="trade-columns">
        <TradeSide
          title={`${getUserName(users, trade.requesterId)} recibe`}
          stickers={requestedStickers}
          state={friendState}
          helper="Repetidas del amigo incluidas en la solicitud."
        />
        <TradeSide
          title={`${getUserName(users, trade.friendId)} recibe`}
          stickers={offeredStickers}
          state={requesterState}
          helper="Laminas repetidas del solicitante seleccionadas por el amigo."
        />
      </div>

      {trade.status !== "completed" ? (
        <div className="trade-columns">
          <EditableTradePool
            title="Editar laminas pedidas"
            stickers={friendAvailableDuplicates}
            state={friendState}
            selectedIds={trade.requestedStickerIds}
            onToggle={onToggleRequested}
          />
          <EditableTradePool
            title="Seleccion del amigo"
            stickers={usefulRequesterDuplicates}
            state={requesterState}
            selectedIds={trade.offeredStickerIds}
            onToggle={onToggleOffered}
          />
        </div>
      ) : null}

      {trade.status === "completed" ? (
        <div className="empty">Intercambio completado con la seleccion final.</div>
      ) : (
        <button className="button primary" disabled={!canComplete} onClick={onComplete}>
          Marcar intercambio final como completado
        </button>
      )}
    </div>
  );
}

function TradeSide({ title, stickers, state, helper }: { title: string; stickers: StickerModel[]; state: UserStateMap; helper: string }) {
  return (
    <div className="trade-side">
      <h3>{title}</h3>
      <p>{helper}</p>
      <div className="list">
        {stickers.length === 0 ? (
          <div className="empty">Sin laminas seleccionadas.</div>
        ) : (
          stickers.map((sticker) => (
            <div className="list-row trade-sticker-row" key={sticker.id}>
              <strong>{sticker.reference}</strong>
              <span>{sticker.title}</span>
              <span>Disp. {Math.max(0, getQuantity(state, sticker.id) - 1)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SelectableStickerList({
  stickers,
  state,
  selectedIds,
  onToggle,
  emptyText
}: {
  stickers: StickerModel[];
  state: UserStateMap;
  selectedIds: string[];
  onToggle: (stickerId: string) => void;
  emptyText: string;
}) {
  if (stickers.length === 0) return <div className="empty">{emptyText}</div>;

  return (
    <div className="trade-sticker-grid">
      {stickers.slice(0, 80).map((sticker) => (
        <button
          key={sticker.id}
          className={`trade-sticker-option ${selectedIds.includes(sticker.id) ? "selected" : ""}`}
          onClick={() => onToggle(sticker.id)}
        >
          <strong>{sticker.reference}</strong>
          <span>{sticker.countryNameEs ?? sticker.sectionName}</span>
          <small>Disponible {Math.max(0, getQuantity(state, sticker.id) - 1)}</small>
        </button>
      ))}
    </div>
  );
}

function EditableTradePool({
  title,
  stickers,
  state,
  selectedIds,
  onToggle
}: {
  title: string;
  stickers: StickerModel[];
  state: UserStateMap;
  selectedIds: string[];
  onToggle: (stickerId: string) => void;
}) {
  return (
    <div className="trade-side">
      <h3>{title}</h3>
      <SelectableStickerList
        stickers={stickers}
        state={state}
        selectedIds={selectedIds}
        onToggle={onToggle}
        emptyText="No hay laminas utiles disponibles."
      />
    </div>
  );
}
