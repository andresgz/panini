"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleMinus,
  CirclePlus,
  Download,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Repeat2,
  Search,
  Sticker,
  Upload,
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
import { getStickerContent, getStickerContentDescription, getStickerDisplayTitle } from "@/lib/sticker-content";
import { createSupabaseClient, hasSupabaseConfig, signInWithGoogle, signOut } from "@/lib/supabase";
import type { Sticker as StickerModel, StickerFilters, StickerType, User, UserStateMap } from "@/types/panini";

type View = "dashboard" | "album" | "missing" | "duplicates" | "compare";
type AlbumSortMode = "album" | "alphabetical";
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
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "album", label: "Album", icon: Sticker },
  { id: "missing", label: "Faltantes", icon: ListChecks },
  { id: "duplicates", label: "Repetidas", icon: Repeat2 },
  { id: "compare", label: "Cambios", icon: ArrowDownUp }
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

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function localStorageKey(userId: string) {
  return `panini-2026-state-${userId}`;
}

const tradeStorageKey = "panini-2026-trade-processes";
const visitorProfileKey = "panini-2026-visitor-profile";
const localVisitorUserId = "visitor-local";

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

function readVisitorProfile() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(visitorProfileKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeVisitorProfile(user: User) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(visitorProfileKey, JSON.stringify(user));
}

export function PaniniApp() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantIndex, setAssistantIndex] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [compareUserId, setCompareUserId] = useState("");
  const [states, setStates] = useState<Record<string, UserStateMap>>({});
  const [filters, setFilters] = useState<StickerFilters>({});
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseClient();

    async function loadSession() {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const authUser = data.session?.user;
        if (authUser) {
          await loadAuthenticatedUser(authUser);
          if (!cancelled) {
            setIsAuthenticated(true);
            setIsSessionLoaded(true);
          }
          return;
        }
      }

      const visitor = readVisitorProfile();
      if (visitor && !cancelled) {
        setUsers([visitor]);
        setCurrentUserId(visitor.id);
        setStates({ [visitor.id]: readLocalState(visitor.id) });
      }
      if (!cancelled) setIsSessionLoaded(true);
    }

    async function loadAuthenticatedUser(authUser: {
      id: string;
      email?: string;
      created_at?: string;
      user_metadata: Record<string, unknown>;
    }) {
      const profile: User = {
        id: authUser.id,
        name:
          String(authUser.user_metadata.full_name ?? authUser.user_metadata.name ?? authUser.email?.split("@")[0] ?? "Coleccionista"),
        email: authUser.email,
        createdAt: authUser.created_at ?? new Date().toISOString()
      };

      if (!supabase) return;
      await supabase.from("users").upsert({
        id: profile.id,
        name: profile.name,
        email: profile.email
      });

      const [{ data: userRows }, { data: stateRows }] = await Promise.all([
        supabase.from("users").select("id,name,email,created_at").order("name"),
        supabase.from("user_sticker_states").select("user_id,sticker_id,quantity,updated_at")
      ]);

      if (cancelled) return;

      const loadedUsers =
        userRows?.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email ?? undefined,
          createdAt: row.created_at
        })) ?? [profile];
      const loadedStates = (stateRows ?? []).reduce<Record<string, UserStateMap>>((acc, row) => {
        acc[row.user_id] = acc[row.user_id] ?? {};
        acc[row.user_id][row.sticker_id] = row.quantity;
        return acc;
      }, {});

      setUsers(loadedUsers);
      setCurrentUserId(profile.id);
      setCompareUserId(loadedUsers.find((user) => user.id !== profile.id)?.id ?? "");
      setStates((previous) => ({ ...previous, ...loadedStates, [profile.id]: loadedStates[profile.id] ?? {} }));
    }

    loadSession();

    const { data: listener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) return;
        loadAuthenticatedUser(session.user).then(() => {
          setIsAuthenticated(true);
          setIsSessionLoaded(true);
        });
      }) ?? { data: { subscription: null } };

    return () => {
      cancelled = true;
      listener.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const saved = readLocalState(currentUserId);
    setStates((previous) => ({ ...previous, [currentUserId]: saved }));
  }, [currentUserId]);

  function startVisitorSession(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const visitor: User = {
      id: localVisitorUserId,
      name: trimmedName,
      createdAt: new Date().toISOString()
    };
    writeVisitorProfile(visitor);
    setUsers([visitor]);
    setCurrentUserId(visitor.id);
    setCompareUserId("");
    setStates({ [visitor.id]: readLocalState(visitor.id) });
    setView("dashboard");
  }

  async function handleGoogleSignIn() {
    const result = await signInWithGoogle();
    if (result?.error) setBackupMessage(result.error.message);
  }

  async function handleSignOut() {
    await signOut();
    setIsAuthenticated(false);
    setUsers([]);
    setCurrentUserId("");
    setCompareUserId("");
    setStates({});
    setView("dashboard");
    const visitor = readVisitorProfile();
    if (visitor) {
      setUsers([visitor]);
      setCurrentUserId(visitor.id);
      setStates({ [visitor.id]: readLocalState(visitor.id) });
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
      await supabase.from("user_sticker_states").upsert({
        user_id: currentUser.id,
        sticker_id: stickerId,
        quantity: nextQuantity,
        updated_at: new Date().toISOString()
      });
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
      await supabase.from("user_sticker_states").upsert(
        normalizedUpdates.map((update) => ({
          user_id: currentUser.id,
          sticker_id: update.stickerId,
          quantity: update.quantity,
          updated_at: updatedAt
        }))
      );
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

  if (!isSessionLoaded) {
    return null;
  }

  if (!currentUser) {
    return <VisitorStartScreen onStart={startVisitorSession} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">26</div>
            <div>
              <h1>Panini Mundial 2026</h1>
              <p>{paniniWorldCup2026Catalog.album.baseStickerCount} laminas base, catalogo estatico</p>
            </div>
          </div>

          <nav className="tabs" aria-label="Vistas">
            {views.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={`tab ${view === item.id ? "active" : ""}`} onClick={() => setView(item.id)}>
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="user-area">
            <span className="badge">{isAuthenticated ? "Google" : "Visitante"}: {currentUser.name}</span>
            {isAuthenticated ? (
              <button className="button" onClick={handleSignOut}>
                <LogOut size={16} />
                Salir
              </button>
            ) : (
              <button className="button" disabled={!hasSupabaseConfig} onClick={handleGoogleSignIn}>
                <LogIn size={16} />
                Google
              </button>
            )}
            <button className="button primary" onClick={() => setIsAssistantOpen(true)}>
              Abrir asistente
            </button>
            <button className="icon-button" onClick={exportInventory} aria-label="Exportar inventario" title="Exportar inventario">
              <Download size={17} />
            </button>
            <button className="icon-button" onClick={() => importInputRef.current?.click()} aria-label="Importar inventario" title="Importar inventario">
              <Upload size={17} />
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
          <AlbumView
            stickers={missingStickers}
            userState={currentState}
            onUpdateQuantity={updateQuantity}
            onUpdateQuantities={updateQuantities}
          />
        ) : null}

        {view === "duplicates" ? (
          <AlbumView
            stickers={duplicateStickers}
            userState={currentState}
            onUpdateQuantity={updateQuantity}
            onUpdateQuantities={updateQuantities}
          />
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
      </div>
      {isAssistantOpen ? (
        <AlbumAssistantModal
          baseStickers={allStickers}
          userState={currentState}
          currentIndex={assistantIndex}
          onIndexChange={setAssistantIndex}
          onUpdateQuantity={updateQuantity}
          onClose={() => setIsAssistantOpen(false)}
        />
      ) : null}
    </main>
  );
}

function VisitorStartScreen({ onStart }: { onStart: (name: string) => void }) {
  const [mode, setMode] = useState<"start" | "visitor">("start");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleGoogleStart() {
    const result = await signInWithGoogle();
    if (result?.error) setError(result.error.message);
  }

  return (
    <main className="start-screen">
      <section className="start-panel">
        <div className="brand start-brand">
          <div className="brand-mark">26</div>
          <div>
            <h1>Panini Mundial 2026</h1>
            <p>Inventario local del album base</p>
          </div>
        </div>

        {mode === "start" ? (
          <div className="start-actions">
            <button className="button primary" onClick={() => setMode("visitor")}>
              Iniciar como visitante
            </button>
            <button className="button" disabled={!hasSupabaseConfig} onClick={handleGoogleStart}>
              <LogIn size={16} />
              Iniciar sesion con Google
            </button>
            {error ? <span className="form-error">{error}</span> : null}
          </div>
        ) : (
          <form
            className="visitor-form"
            onSubmit={(event) => {
              event.preventDefault();
              onStart(name);
            }}
          >
            <label>
              Nombre del coleccionista
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            </label>
            <button className="button primary" disabled={!name.trim()}>
              Crear album vacio
            </button>
          </form>
        )}
      </section>
    </main>
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
      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 11, top: 11, color: "var(--muted)" }} />
        <input
          className="input"
          style={{ paddingLeft: 34 }}
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
  const [sortMode, setSortMode] = useState<AlbumSortMode>("album");
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
  onClose
}: {
  baseStickers: StickerModel[];
  userState: UserStateMap;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onUpdateQuantity: (stickerId: string, quantity: number) => void;
  onClose: () => void;
}) {
  const [sortMode, setSortMode] = useState<AlbumSortMode>("album");
  const groups = useMemo(() => buildAssistantGroups(baseStickers, sortMode), [baseStickers, sortMode]);
  const stickers = useMemo(() => groups.flatMap((group) => group.stickers), [groups]);
  const sticker = stickers[currentIndex];
  const quantity = sticker ? getQuantity(userState, sticker.id) : 0;
  const status = getStickerStatus(quantity);
  const content = sticker ? getStickerContent(sticker) : undefined;
  const displayTitle = sticker ? getStickerDisplayTitle(sticker) : "";
  const contentDescription = sticker ? getStickerContentDescription(sticker) : "";
  const currentGroup =
    groups.find((group) => sticker && group.stickers.some((groupSticker) => groupSticker.id === sticker.id)) ?? groups[0];
  const currentGroupIndex = currentGroup ? groups.findIndex((group) => group.id === currentGroup.id) : 0;
  const groupStartIndex = currentGroup ? stickers.findIndex((groupSticker) => groupSticker.id === currentGroup.stickers[0]?.id) : 0;
  const currentInGroupIndex = currentGroup && groupStartIndex >= 0 ? currentIndex - groupStartIndex : 0;
  const groupProgress = currentGroup ? getGroupSummary(currentGroup.stickers, userState) : null;

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

  function toggleCurrent() {
    if (!sticker) return;
    onUpdateQuantity(sticker.id, quantity > 0 ? 0 : 1);
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
        if (sticker) onUpdateQuantity(sticker.id, quantity > 0 ? 0 : 1);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentGroupIndex, currentIndex, groups, onClose, onIndexChange, onUpdateQuantity, quantity, sticker, stickers]);

  if (!sticker) return null;

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

        <div className={`assistant-card ${status}`}>
          <span className={`badge ${status}`}>{statusLabels[status]}</span>
          <strong>{sticker.reference}</strong>
          <p>{displayTitle}</p>
          <div className="assistant-sticker-details">
            <span>Contenido: {contentDescription}</span>
            <span>Ubicacion: {currentGroup?.label ?? sticker.sectionName}</span>
            {content?.group ? <span>Grupo: {content.group}</span> : null}
            {sticker.number ? <span>Numero interno: {String(sticker.number).padStart(3, "0")}</span> : null}
          </div>
          <div className="badges">
            <span className="badge">{typeLabels[sticker.type]}</span>
            {sticker.isFoil ? <span className="badge">Foil</span> : null}
            <span className="badge">Cantidad {quantity}</span>
          </div>
        </div>

        <div className="assistant-controls">
          <button className="button" onClick={() => goTo(-1)} disabled={currentIndex === 0}>
            <ArrowLeft size={16} />
            Anterior
          </button>
          <button className="button primary" onClick={toggleCurrent}>
            <Check size={16} />
            {quantity > 0 ? "Desmarcar" : "Marcar"}
          </button>
          <button className="button" onClick={() => goTo(1)} disabled={currentIndex === stickers.length - 1}>
            Siguiente
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="assistant-hints">
          <span>Flecha izquierda: anterior</span>
          <span>Flecha derecha: siguiente</span>
          <span>[ y ]: cambiar seccion</span>
          <span>Espacio: marcar/desmarcar</span>
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
  const toggleQuantity = () => onUpdateQuantity(sticker.id, quantity > 0 ? 0 : 1);
  const stopCardToggle = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <article
      className={`sticker-card ${status}`}
      data-testid={`album-card-${sticker.reference}`}
      role="button"
      tabIndex={0}
      aria-label={`${sticker.reference}, ${statusLabels[status]}, cantidad ${quantity}`}
      onClick={toggleQuantity}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleQuantity();
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
        <button className="icon-button" title="Incrementar" aria-label="Incrementar cantidad" onClick={() => onUpdateQuantity(sticker.id, quantity + 1)}>
          <CirclePlus size={18} />
        </button>
        <button className="icon-button" title={quantity > 0 ? "Marcar faltante" : "Marcar obtenida"} aria-label={quantity > 0 ? "Marcar faltante" : "Marcar obtenida"} onClick={toggleQuantity}>
          {quantity > 0 ? <X size={17} /> : <Check size={17} />}
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
