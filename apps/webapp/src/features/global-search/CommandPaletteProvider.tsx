"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  TicketCheck,
  UserCheck,
  Users,
  X
} from "lucide-react";
import type { GlobalSearchEntity, GlobalSearchGroup, GlobalSearchResult } from "./types";

type CommandPaletteContextValue = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const CACHE_TTL_MS = 120_000;
const CACHE_LIMIT = 30;
const RECENT_RESULTS_KEY = "csa.globalSearch.recentResults";
const RECENT_SEARCHES_KEY = "csa.globalSearch.recentSearches";

const entityLabels: Record<GlobalSearchEntity, string> = {
  customers: "Customers",
  orders: "Orders",
  products: "Products",
  tickets: "Tickets",
  carts: "Carts",
  b2b_companies: "Companies",
  b2b_employees: "Employees",
  b2b_quotes: "Quotes"
};

const entityIcons: Record<GlobalSearchEntity, typeof Users> = {
  customers: Users,
  orders: ShoppingBag,
  products: Package,
  tickets: TicketCheck,
  carts: ShoppingCart,
  b2b_companies: Building2,
  b2b_employees: UserCheck,
  b2b_quotes: FileText
};

const queryCache = new Map<string, { createdAt: number; groups: GlobalSearchGroup[] }>();

export function CommandPaletteProvider({
  children,
  isB2bMode
}: {
  children: ReactNode;
  isB2bMode: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => {
      if (!current) {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      return !current;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
        return;
      }

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        open();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, toggle]);

  const value = useMemo(() => ({ isOpen, open, close, toggle }), [close, isOpen, open, toggle]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen && <CommandPalette isB2bMode={isB2bMode} onClose={close} />}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const value = useContext(CommandPaletteContext);
  if (!value) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return value;
}

function CommandPalette({ isB2bMode, onClose }: { isB2bMode: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeEntity, setActiveEntity] = useState<GlobalSearchEntity | "all">("all");
  const [recentResults, setRecentResults] = useState<GlobalSearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const entities = useMemo<GlobalSearchEntity[]>(
    () =>
      isB2bMode
        ? ["b2b_companies", "b2b_employees", "orders", "carts", "b2b_quotes"]
        : ["customers", "orders", "tickets", "products", "carts"],
    [isB2bMode]
  );

  const placeholder = isB2bMode
    ? "Search companies, employees, orders, quotes, and more..."
    : "Search customers, orders, tickets, products, and more...";

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
    setRecentResults(readRecentResults());
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const visibleGroups = useMemo(
    () =>
      groups.filter((group) => group.status !== "forbidden" && (activeEntity === "all" || group.entity === activeEntity)),
    [activeEntity, groups]
  );

  const flatResults = useMemo(() => visibleGroups.flatMap((group) => group.results), [visibleGroups]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [query, activeEntity]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setGroups([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void runSearch(normalizedQuery, entities, setGroups, setLoading, setHasSearched, abortRef);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [entities, query]);

  const selectResult = (result: GlobalSearchResult) => {
    writeRecentResult(result);
    if (query.trim()) writeRecentSearch(query.trim());
    onClose();
    router.push(result.url);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      if (flatResults.length === 0) return;
      event.preventDefault();
      setFocusedIndex((index) => (index + 1) % flatResults.length);
    }

    if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
      if (flatResults.length === 0) return;
      event.preventDefault();
      setFocusedIndex((index) => (index - 1 + flatResults.length) % flatResults.length);
    }

    if (event.key === "Enter" && flatResults[focusedIndex]) {
      event.preventDefault();
      selectResult(flatResults[focusedIndex]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-950/40 px-4 py-10 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="mx-auto flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-m-xl border border-m-border bg-m-surface shadow-m-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-m-border px-4 py-3">
          <Search size={20} className="text-m-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-controls="global-search-results"
            aria-expanded="true"
            className="h-11 min-w-0 flex-1 bg-transparent text-base font-medium text-m-text outline-none placeholder:text-m-text-muted"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded-m-md p-2 text-m-text-muted transition-colors hover:bg-m-surface-2 hover:text-m-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-m-border px-4 py-3">
          <EntityTab label="All" active={activeEntity === "all"} onClick={() => setActiveEntity("all")} />
          {entities.map((entity) => (
            <EntityTab
              key={entity}
              label={entityLabels[entity]}
              active={activeEntity === entity}
              onClick={() => setActiveEntity(entity)}
            />
          ))}
        </div>

        <div id="global-search-results" className="min-h-80 overflow-y-auto p-3">
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <IdleState
              recentResults={recentResults}
              recentSearches={recentSearches}
              onSearch={setQuery}
              onSelect={selectResult}
              isB2bMode={isB2bMode}
            />
          ) : loading ? (
            <LoadingState />
          ) : visibleGroups.length > 0 && flatResults.length > 0 ? (
            <SearchResults groups={visibleGroups} focusedIndex={focusedIndex} onSelect={selectResult} />
          ) : hasSearched ? (
            <EmptyState query={query} />
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-m-border px-4 py-2 text-[11px] font-medium text-m-text-muted">
          <span>Use arrows to move</span>
          <span>Enter to open · Esc to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EntityTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-m-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-m-primary text-white" : "bg-m-surface-2 text-m-text-muted hover:text-m-text"
      }`}
    >
      {label}
    </button>
  );
}

function SearchResults({
  groups,
  focusedIndex,
  onSelect
}: {
  groups: GlobalSearchGroup[];
  focusedIndex: number;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  let index = 0;

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        if (group.results.length === 0) return null;
        return (
          <section key={group.entity}>
            <div className="mb-2 flex items-center justify-between px-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-m-text-muted">
                {entityLabels[group.entity]}
              </h3>
              {typeof group.total === "number" && (
                <span className="text-[11px] font-semibold text-m-text-muted">{group.total}</span>
              )}
            </div>
            <div className="space-y-1">
              {group.results.map((result) => {
                const currentIndex = index++;
                return (
                  <ResultButton
                    key={`${result.entity}:${result.id}`}
                    result={result}
                    active={currentIndex === focusedIndex}
                    onClick={() => onSelect(result)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ResultButton({
  result,
  active,
  onClick
}: {
  result: GlobalSearchResult;
  active: boolean;
  onClick: () => void;
}) {
  const EntityIcon = entityIcons[result.entity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-m-lg px-3 py-3 text-left transition-colors ${
        active ? "bg-m-primary/10 ring-1 ring-m-primary/30" : "hover:bg-m-surface-2"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-m-md bg-m-surface-2 text-m-text-muted">
        {result.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.imageUrl} alt="" className="h-full w-full rounded-m-md object-cover" />
        ) : result.initials ? (
          <span className="text-xs font-bold">{result.initials}</span>
        ) : (
          <EntityIcon size={18} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-m-text">{result.title}</div>
        <div className="truncate text-xs text-m-text-muted">{result.subtitle}</div>
      </div>
      {result.badge && (
        <span className="shrink-0 rounded-full border border-m-border bg-m-surface px-2 py-0.5 text-[11px] font-semibold text-m-text-muted">
          {result.badge}
        </span>
      )}
    </button>
  );
}

function IdleState({
  recentResults,
  recentSearches,
  onSearch,
  onSelect,
  isB2bMode
}: {
  recentResults: GlobalSearchResult[];
  recentSearches: string[];
  onSearch: (query: string) => void;
  onSelect: (result: GlobalSearchResult) => void;
  isB2bMode: boolean;
}) {
  const quickSearches = isB2bMode ? ["active companies", "quotes", "open orders"] : ["open tickets", "recent orders", "products"];

  return (
    <div className="space-y-5 px-1 py-2">
      {recentResults.length > 0 && (
        <section>
          <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-m-text-muted">Recent Items</h3>
          <div className="space-y-1">
            {recentResults.map((result) => (
              <ResultButton key={`${result.entity}:${result.id}`} result={result} active={false} onClick={() => onSelect(result)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-m-text-muted">Quick Searches</h3>
        <div className="flex flex-wrap gap-2 px-2">
          {[...recentSearches, ...quickSearches].slice(0, 8).map((search) => (
            <button
              type="button"
              key={search}
              onClick={() => onSearch(search)}
              className="rounded-full border border-m-border bg-m-surface px-3 py-1.5 text-xs font-semibold text-m-text-muted transition-colors hover:border-m-primary hover:text-m-primary"
            >
              {search}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 p-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-3 rounded-m-lg px-3 py-3">
          <div className="h-9 w-9 rounded-m-md bg-m-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-m-surface-2" />
            <div className="h-3 w-1/2 rounded bg-m-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center text-center">
      <Search size={28} className="mb-3 text-m-text-muted" />
      <h3 className="text-sm font-bold text-m-text">No results found</h3>
      <p className="mt-1 max-w-sm text-sm text-m-text-muted">No records matched “{query.trim()}”.</p>
    </div>
  );
}

async function runSearch(
  query: string,
  entities: GlobalSearchEntity[],
  setGroups: (groups: GlobalSearchGroup[]) => void,
  setLoading: (loading: boolean) => void,
  setHasSearched: (searched: boolean) => void,
  abortRef: MutableRefObject<AbortController | null>
) {
  const cacheKey = `${query.toLowerCase()}::${[...entities].sort().join(",")}`;
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    setGroups(cached.groups);
    setHasSearched(true);
    return;
  }

  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  setLoading(true);

  try {
    const response = await fetch("/api/global-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, entities }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Search failed with ${response.status}`);
    const data = (await response.json()) as { groups?: GlobalSearchGroup[] };
    const nextGroups = data.groups ?? [];
    queryCache.set(cacheKey, { createdAt: Date.now(), groups: nextGroups });
    if (queryCache.size > CACHE_LIMIT) {
      const oldestKey = queryCache.keys().next().value;
      if (oldestKey) queryCache.delete(oldestKey);
    }
    setGroups(nextGroups);
    setHasSearched(true);
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      setGroups([]);
      setHasSearched(true);
    }
  } finally {
    if (abortRef.current === controller) setLoading(false);
  }
}

function readRecentResults() {
  if (typeof window === "undefined") return [];
  return readJson<GlobalSearchResult[]>(RECENT_RESULTS_KEY, []);
}

function readRecentSearches() {
  if (typeof window === "undefined") return [];
  return readJson<string[]>(RECENT_SEARCHES_KEY, []);
}

function writeRecentResult(result: GlobalSearchResult) {
  const next = [result, ...readRecentResults().filter((item) => item.url !== result.url)].slice(0, 5);
  window.localStorage.setItem(RECENT_RESULTS_KEY, JSON.stringify(next));
}

function writeRecentSearch(query: string) {
  const next = [query, ...readRecentSearches().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 5);
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
