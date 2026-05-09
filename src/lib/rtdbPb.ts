import { apiFetch } from "@/lib/apiClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
export const RTDB_DB_MARKER: Database = {};

export type QueryConstraint =
  | { kind: "orderByKey" }
  | { kind: "limitToLast"; n: number }
  | { kind: "endBefore"; key: string | null }
  | { kind: "startAfter"; key: string | null };

export class PathRef {
  constructor(public readonly path: string) {}
  child(seg: string): PathRef {
    const p = this.path.replace(/\/+$/, "");
    return new PathRef(`${p}/${seg}`);
  }
}

export class QueryRef {
  constructor(public readonly base: PathRef, public readonly constraints: QueryConstraint[]) {}
}

export function ref(_db: Database, path: string): PathRef {
  return new PathRef(path.replace(/^\/+|\/+$/g, ""));
}

export function query(base: PathRef, ...constraints: QueryConstraint[]): QueryRef {
  return new QueryRef(base, constraints);
}

export function orderByKey(): QueryConstraint {
  return { kind: "orderByKey" };
}

export function limitToLast(n: number): QueryConstraint {
  return { kind: "limitToLast", n };
}

export function endBefore(key: string | null): QueryConstraint {
  return { kind: "endBefore", key };
}

export function startAfter(key: string | null): QueryConstraint {
  return { kind: "startAfter", key };
}

export class DataSnapshot {
  constructor(private readonly valueRoot: unknown) {}
  exists(): boolean {
    const v = this.val();
    if (v === null || v === undefined) return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) return false;
    return true;
  }
  val(): unknown {
    return this.valueRoot ?? null;
  }
  child(name: string): DataSnapshot {
    const cur = this.valueRoot;
    if (!cur || typeof cur !== "object") return new DataSnapshot(null);
    return new DataSnapshot((cur as Record<string, unknown>)[name] ?? null);
  }
}

export async function get(target: PathRef | QueryRef): Promise<DataSnapshot> {
  if (target instanceof QueryRef) {
    const json = await apiFetch<{ ok: boolean; value: unknown }>("/api/rtdb/query", {
      method: "POST",
      body: { path: target.base.path, constraints: target.constraints },
    });
    return new DataSnapshot(json.value ?? null);
  }
  const json = await apiFetch<{ ok?: boolean; value?: unknown }>(
    `/api/rtdb?path=${encodeURIComponent(target.path)}`,
  );
  return new DataSnapshot(json.value ?? null);
}

type Listener = (snap: DataSnapshot) => void;
type RegEntry = { fn: Listener; query?: QueryRef; timer: number };
const registry = new Map<string, Set<RegEntry>>();

function keyFor(target: PathRef | QueryRef): string {
  if (target instanceof QueryRef) return `q:${target.base.path}:${JSON.stringify(target.constraints)}`;
  return target.path;
}

async function runOne(entry: RegEntry, target: PathRef | QueryRef) {
  try {
    const snap = await get(target);
    entry.fn(snap);
  } catch {
    entry.fn(new DataSnapshot(null));
  }
}

export function onValue(target: PathRef | QueryRef, cb: Listener, options?: { onlyOnce?: boolean }): () => void {
  const key = keyFor(target);
  const set = registry.get(key) ?? new Set<RegEntry>();
  const entry: RegEntry = {
    fn: cb,
    query: target instanceof QueryRef ? target : undefined,
    timer: window.setInterval(() => {
      void runOne(entry, target);
    }, 2000),
  };
  set.add(entry);
  registry.set(key, set);
  void runOne(entry, target);
  if (options?.onlyOnce) {
    window.setTimeout(() => {
      clearInterval(entry.timer);
      set.delete(entry);
    }, 0);
  }
  return () => {
    clearInterval(entry.timer);
    set.delete(entry);
  };
}

export async function set(target: PathRef, value: unknown): Promise<void> {
  await apiFetch("/api/rtdb/set", { method: "POST", body: { path: target.path, value } });
}

export async function update(target: PathRef, values: Record<string, unknown>): Promise<void> {
  await apiFetch("/api/rtdb/update", { method: "POST", body: { path: target.path, values } });
}

export async function remove(target: PathRef): Promise<void> {
  await apiFetch("/api/rtdb/remove", { method: "POST", body: { path: target.path } });
}

export function push(target: PathRef, value?: unknown) {
  const promise = (async () => {
    const json = await apiFetch<{ ok: boolean; key: string }>("/api/rtdb/push", {
      method: "POST",
      body: { path: target.path, value: value ?? null },
    });
    return json.key;
  })();

  const refLike = Object.assign(target.child("pending"), {
    key: "",
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      promise
        .then((key) => {
          (refLike as { key: string }).key = key;
          return key;
        })
        .then(onF, onR),
    catch: (onR: (e: unknown) => unknown) => promise.catch(onR),
  });
  return refLike as PathRef & { key: string; then: typeof promise.then };
}
