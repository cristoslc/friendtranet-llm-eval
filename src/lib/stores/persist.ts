import { dbSet } from './db';

/**
 * Queued + debounced persistence helper.
 *
 * Firefox's IndexedDB doesn't coalesce back-to-back transactions the way
 * Chromium does — dragging a slider at 60Hz will queue 60 write transactions
 * per second, each holding a copy of the state object. Memory balloons, UI
 * freezes.
 *
 * This helper enforces "latest-wins" semantics: while a write is pending,
 * further schedulePersist() calls only update the pending payload. A single
 * transaction fires per debounce window. Uses $state.snapshot() (via the
 * plainify() helper) to avoid proxy-traversal cost in JSON.stringify.
 */

type Snapshot = unknown;

interface PersistState {
	pending: Snapshot | null;
	timer: ReturnType<typeof setTimeout> | null;
	writing: boolean;
}

const stateByKey = new Map<string, PersistState>();

const DEBOUNCE_MS = 250;

function getState(key: string): PersistState {
	let s = stateByKey.get(key);
	if (!s) {
		s = { pending: null, timer: null, writing: false };
		stateByKey.set(key, s);
	}
	return s;
}

async function flush(store: string, key: string) {
	const s = getState(`${store}:${key}`);
	if (s.writing || s.pending === null) return;

	const payload = s.pending;
	s.pending = null;
	s.writing = true;
	try {
		await dbSet(store, key, payload);
	} finally {
		s.writing = false;
		// If another snapshot arrived while we were writing, flush again.
		if (s.pending !== null) {
			scheduleFlush(store, key);
		}
	}
}

function scheduleFlush(store: string, key: string) {
	const s = getState(`${store}:${key}`);
	if (s.timer) clearTimeout(s.timer);
	s.timer = setTimeout(() => {
		s.timer = null;
		flush(store, key);
	}, DEBOUNCE_MS);
}

/**
 * Queue a snapshot for persistence to IndexedDB. Replaces any pending
 * write for the same (store, key). Returns immediately — writes happen
 * asynchronously after DEBOUNCE_MS of quiet, or immediately after the
 * current write completes if one is in flight.
 */
export function schedulePersist(store: string, key: string, snapshot: Snapshot) {
	const s = getState(`${store}:${key}`);
	s.pending = snapshot;
	if (!s.writing) {
		scheduleFlush(store, key);
	}
}

/**
 * Convert a Svelte 5 $state proxy to a plain object structuredClone-safe
 * for IndexedDB. Callers in .svelte.ts files should use $state.snapshot()
 * on proxy values before passing here when possible — it's faster than
 * JSON round-trip. This is the safe fallback.
 */
export function plainify<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch {
		return JSON.parse(JSON.stringify(value));
	}
}
