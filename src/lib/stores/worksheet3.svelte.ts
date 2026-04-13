import { dbGet } from './db';
import { schedulePersist, plainify } from './persist';
import type { ModelTier } from '$lib/data/tiers';
import { modelTiers } from '$lib/data/tiers';

export interface EvalResult {
	conversationId: string;
	modelId: string;
	responses: string[];
	cachedAt: string;
}

/**
 * User-authored conversation driven through the same rating pipeline
 * as curated conversations. One active custom conversation at a time
 * (per SPEC-007 out-of-scope). `turns` grows as the rater submits
 * further messages, up to the 5-turn cap enforced in the UI.
 */
export interface CustomConversation {
	/** Stable id derived from openingPrompt — see customIdFromPrompt. */
	id: string;
	openingPrompt: string;
	turns: Array<{ role: string; content: string }>;
	createdAt: string;
}

export interface TurnRating {
	conversationId: string;
	turnIndex: number;
	ratings: Record<string, number>; // modelId -> 1-4
	tags: Record<string, string[]>; // modelId -> dimension tags
	labelOrder: string[]; // randomized model IDs for this turn
	revealed: boolean;
}

export interface ActivePair {
	pairKey: string;
	convId: string;
	tierLabel: string;
	modelId: string;
	currentTurn: number;
	currentTurnTotal: number;
	status: string;
}

export interface EvalProgress {
	running: boolean;
	total: number;
	done: number;
	active: ActivePair[];
	errors: string[];
	/** Legacy fields retained for export schema compatibility. */
	current: string;
	currentTurn: number;
	currentTurnTotal: number;
	lastMessage: string;
}

export interface W3State {
	selectedConversations: string[];
	selectedTierIds: string[];
	/** Per-tier model ID overrides. If a tier id is absent, the default
	 * model ID from modelTiers[] is used. Lets the user swap
	 * ZDR-unavailable models without touching code. */
	modelOverrides: Record<string, string>;
	evalResults: Record<string, EvalResult>; // key: `${convId}:${modelId}`
	turnRatings: TurnRating[];
	evalProgress: EvalProgress;
	/** At most one active custom conversation (SPEC-007). */
	customConversation: CustomConversation | null;
}

const DEFAULT_PROGRESS: EvalProgress = {
	running: false,
	total: 0,
	done: 0,
	active: [],
	errors: [],
	current: '',
	currentTurn: 0,
	currentTurnTotal: 0,
	lastMessage: ''
};

const DEFAULT_STATE: W3State = {
	selectedConversations: [],
	selectedTierIds: modelTiers.filter((t) => !t.isAnchor && t.defaultSelected).map((t) => t.id),
	modelOverrides: {},
	evalResults: {},
	turnRatings: [],
	evalProgress: { ...DEFAULT_PROGRESS },
	customConversation: null
};

let state = $state<W3State>({ ...DEFAULT_STATE });
let loaded = $state(false);

export function getW3State() {
	return state;
}

export function isW3Loaded() {
	return loaded;
}

export async function loadW3() {
	const saved = await dbGet<W3State>('worksheets', 'w3');
	if (saved) {
		state.selectedConversations = saved.selectedConversations ?? [];
		state.selectedTierIds = saved.selectedTierIds ?? DEFAULT_STATE.selectedTierIds;
		state.evalResults = saved.evalResults ?? {};
		state.turnRatings = saved.turnRatings ?? [];
		state.customConversation = saved.customConversation ?? null;
	}
	loaded = true;
}

function saveW3() {
	try {
		schedulePersist(
			'worksheets',
			'w3',
			plainify({
				selectedConversations: state.selectedConversations,
				selectedTierIds: state.selectedTierIds,
				modelOverrides: state.modelOverrides,
				evalResults: state.evalResults,
				turnRatings: state.turnRatings
			})
		);
	} catch {
		// Silent — don't let persistence errors cascade through HMR forwarder.
	}
}

/** Resolve the effective model ID for a tier, applying user overrides. */
export function resolveModelId(tier: ModelTier): string {
	return state.modelOverrides[tier.id] ?? tier.modelId;
}

export function setModelOverride(tierId: string, modelId: string | null) {
	if (modelId && modelId.trim().length > 0) {
		state.modelOverrides[tierId] = modelId.trim();
	} else {
		delete state.modelOverrides[tierId];
	}
	saveW3();
}

/** Full W3 reset — clears conversations, tiers, overrides, responses, ratings.
 * Leaves only the default shape. */
export function resetW3All() {
	state.selectedConversations = [];
	state.selectedTierIds = modelTiers.filter((t) => !t.isAnchor && t.defaultSelected).map((t) => t.id);
	state.modelOverrides = {};
	state.evalResults = {};
	state.turnRatings = [];
	state.evalProgress = { ...DEFAULT_PROGRESS };
	state.customConversation = null;
	saveW3();
}

/** Clear LLM responses and dependent ratings. Keeps conversation selection,
 * tier selection, and model overrides so the user can re-run evaluation
 * with the same config. Ratings are cleared because they reference
 * now-missing response labels. */
export function resetW3Responses() {
	state.evalResults = {};
	state.turnRatings = [];
	state.evalProgress = { ...DEFAULT_PROGRESS };
	saveW3();
}

/** Clear user ratings only. Keeps LLM responses cached so re-rating is
 * free (no OpenRouter calls). Use this to re-rate with a clean mind. */
export function resetW3Ratings() {
	state.turnRatings = [];
	saveW3();
}

interface ConversationLike {
	id: string;
	turns: Array<{ role: string; content: string }>;
}

/**
 * Re-run a (conversation × model) pair from a specific turn forward,
 * preserving cached responses for earlier turns and the user's ratings
 * for turns that aren't being regenerated.
 *
 * startTurn = 0 means a full re-run.
 * startTurn = N replays turns [N..end] using the stored turn-[0..N-1]
 * responses as context for the model, so the regenerated answers stay
 * coherent with what the user already read and rated.
 *
 * Only ratings for turns >= startTurn on this specific modelId are
 * dropped — prior ratings survive.
 */
export async function rerunPairFromTurn(
	conv: ConversationLike,
	tier: ModelTier,
	startTurn: number,
	signal?: AbortSignal
): Promise<void> {
	const apiKey = sessionStorage.getItem('openrouter-key');
	if (!apiKey) throw new Error('No API key');
	if (state.evalProgress.running) return;

	const effectiveModelId = resolveModelId(tier);
	const key = getEvalKey(conv.id, effectiveModelId);
	const existing = state.evalResults[key];
	const userTurns = conv.turns.filter((t) => t.role === 'user');

	if (startTurn < 0 || startTurn >= userTurns.length) return;

	// Preserve responses for turns before startTurn.
	const preserved = existing?.responses.slice(0, startTurn) ?? [];

	// Clear ratings for this (conversation, modelId) at turns >= startTurn.
	state.turnRatings = state.turnRatings.map((r) => {
		if (r.conversationId !== conv.id) return r;
		if (r.turnIndex < startTurn) return r;
		if (!(effectiveModelId in r.ratings)) return r;
		const { [effectiveModelId]: _dropped, ...remainingRatings } = r.ratings;
		return { ...r, ratings: remainingRatings, revealed: false };
	});

	// Rebuild message history from preserved context.
	const messages: Array<{ role: string; content: string }> = [];
	for (let i = 0; i < startTurn; i++) {
		messages.push({ role: 'user', content: userTurns[i].content });
		messages.push({ role: 'assistant', content: preserved[i] ?? '' });
	}

	// Initialize progress for this single-pair partial run.
	const pairKey = `${conv.id}:${effectiveModelId}:rerun-from-${startTurn}`;
	state.evalProgress = {
		running: true,
		total: 1,
		done: 0,
		active: [
			{
				pairKey,
				convId: conv.id,
				tierLabel: tier.label,
				modelId: effectiveModelId,
				currentTurn: startTurn,
				currentTurnTotal: userTurns.length,
				status: `Re-running from turn ${startTurn + 1}/${userTurns.length}`
			}
		],
		errors: [],
		current: '',
		currentTurn: startTurn,
		currentTurnTotal: userTurns.length,
		lastMessage: `Re-running ${tier.label} from turn ${startTurn + 1}…`
	};

	const newResponses: string[] = [];

	for (let turnIdx = startTurn; turnIdx < userTurns.length; turnIdx++) {
		if (signal?.aborted) break;
		const userTurn = userTurns[turnIdx];
		state.evalProgress.active = state.evalProgress.active.map((p) =>
			p.pairKey === pairKey
				? { ...p, currentTurn: turnIdx + 1, status: `turn ${turnIdx + 1}/${userTurns.length}` }
				: p
		);
		messages.push({ role: 'user', content: userTurn.content });

		try {
			const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': window.location.origin,
					'X-Title': 'Sovereignty Stack Decision SPA'
				},
				body: JSON.stringify({
					model: effectiveModelId,
					messages: [...messages],
					max_tokens: 8192
				}),
				signal
			});

			if (!resp.ok) {
				const errBody = await resp.text();
				const errMsg = `[${tier.label} re-run turn ${turnIdx + 1}] HTTP ${resp.status}: ${errBody.slice(0, 300)}`;
				state.evalProgress.errors = [...state.evalProgress.errors, errMsg];
				newResponses.push(`[Error ${resp.status}: ${errBody.slice(0, 200)}]`);
				messages.push({ role: 'assistant', content: newResponses[newResponses.length - 1] });
				continue;
			}

			const data = await resp.json();
			const choice = data.choices?.[0];
			const content = choice?.message?.content ?? '';
			const finishReason = choice?.finish_reason ?? 'unknown';

			if (!content) {
				newResponses.push(`[No response — finish_reason: ${finishReason}]`);
				messages.push({ role: 'assistant', content: '' });
			} else {
				const suffix =
					finishReason === 'length'
						? '\n\n[⚠ Response truncated at max_tokens. Re-run this pair to get a full response.]'
						: '';
				newResponses.push(content + suffix);
				messages.push({ role: 'assistant', content });
			}
		} catch (e) {
			if (signal?.aborted) break;
			const errMsg = `[${tier.label} re-run turn ${turnIdx + 1}] ${(e as Error).message}`;
			state.evalProgress.errors = [...state.evalProgress.errors, errMsg];
			newResponses.push(`[Error: ${(e as Error).message}]`);
			messages.push({ role: 'assistant', content: newResponses[newResponses.length - 1] });
		}
	}

	if (!signal?.aborted) {
		state.evalResults[key] = {
			conversationId: conv.id,
			modelId: effectiveModelId,
			responses: [...preserved, ...newResponses],
			cachedAt: new Date().toISOString()
		};
		state.evalProgress.done = 1;
		saveW3();
	}

	state.evalProgress = {
		...state.evalProgress,
		running: false,
		active: [],
		lastMessage: signal?.aborted
			? 'Cancelled.'
			: `Re-run complete (turns ${startTurn + 1}–${userTurns.length}).`
	};
}

export function toggleConversation(id: string) {
	const idx = state.selectedConversations.indexOf(id);
	if (idx >= 0) {
		state.selectedConversations = state.selectedConversations.filter((c) => c !== id);
	} else {
		state.selectedConversations = [...state.selectedConversations, id];
	}
	saveW3();
}

// ─── Custom conversation helpers (SPEC-007) ────────────────────────────────

/** Stable id for a custom conversation, derived from its opening prompt. */
export function customIdFromPrompt(openingPrompt: string): string {
	let hash = 0;
	for (let i = 0; i < openingPrompt.length; i++) {
		hash = ((hash << 5) - hash + openingPrompt.charCodeAt(i)) | 0;
	}
	return `custom-${Math.abs(hash).toString(36)}`;
}

/** True when the current custom conversation has any cached responses or ratings. */
export function customHasCachedResults(): boolean {
	const c = state.customConversation;
	if (!c) return false;
	for (const key of Object.keys(state.evalResults)) {
		if (key.startsWith(`${c.id}:`)) return true;
	}
	for (const tr of state.turnRatings) {
		if (tr.conversationId === c.id) return true;
	}
	return false;
}

/**
 * Drop evalResults + turnRatings tied to a custom conversation id.
 * Called when the rater confirms the "edit will wipe cached results" warning.
 */
export function clearCustomCache(convId: string): void {
	const nextResults: Record<string, EvalResult> = {};
	for (const [key, val] of Object.entries(state.evalResults)) {
		if (!key.startsWith(`${convId}:`)) nextResults[key] = val;
	}
	state.evalResults = nextResults;
	state.turnRatings = state.turnRatings.filter((tr) => tr.conversationId !== convId);
	saveW3();
}

/**
 * Replace the active custom conversation's opening prompt. Recomputes id,
 * resets turns to a single user turn holding the new prompt, and preserves
 * createdAt. Does NOT clear cache — callers should invoke clearCustomCache
 * for the OLD id first when cached results exist.
 */
export function setCustomOpeningPrompt(openingPrompt: string): void {
	const trimmed = openingPrompt;
	const id = customIdFromPrompt(trimmed);
	const prev = state.customConversation;
	state.customConversation = {
		id,
		openingPrompt: trimmed,
		turns: [{ role: 'user', content: trimmed }],
		createdAt: prev?.createdAt ?? new Date().toISOString()
	};
	const selected = state.selectedConversations.filter((x) => !x.startsWith('custom-'));
	state.selectedConversations = [...selected, id];
	saveW3();
}

/** Append a turn (role 'user' or 'assistant') to the active custom conversation. */
export function appendCustomTurn(role: 'user' | 'assistant', content: string): void {
	if (!state.customConversation) return;
	state.customConversation.turns = [
		...state.customConversation.turns,
		{ role, content }
	];
	saveW3();
}

/** Remove the active custom conversation and all its cached results + ratings. */
export function deleteCustomConversation(): void {
	const c = state.customConversation;
	if (!c) return;
	clearCustomCache(c.id);
	state.customConversation = null;
	state.selectedConversations = state.selectedConversations.filter((x) => x !== c.id);
	saveW3();
}

/** Five rater turns max for custom conversations (SPEC-007 AC #7). */
export const CUSTOM_TURN_CAP = 5;

/**
 * Fan out one custom-conversation turn across every active tier,
 * in series. Wraps rerunPairFromTurn so message history is rebuilt
 * from preserved responses. Call with turnIndex = users length - 1
 * after appending the latest user turn.
 */
export async function runCustomTurn(
	turnIndex: number,
	onProgress: (msg: string) => void,
	signal?: AbortSignal
): Promise<void> {
	const custom = state.customConversation;
	if (!custom) throw new Error('No custom conversation to evaluate');
	const tiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);
	if (tiers.length === 0) throw new Error('No tiers selected');

	for (const tier of tiers) {
		if (signal?.aborted) break;
		onProgress(`Generating ${tier.label} (${tiers.indexOf(tier) + 1}/${tiers.length})`);
		await rerunPairFromTurn(custom, tier, turnIndex, signal);
	}
	onProgress(signal?.aborted ? 'Cancelled.' : `Turn ${turnIndex + 1} complete.`);
}

export function toggleTier(tierId: string) {
	const idx = state.selectedTierIds.indexOf(tierId);
	if (idx >= 0) {
		state.selectedTierIds = state.selectedTierIds.filter((t) => t !== tierId);
	} else {
		state.selectedTierIds = [...state.selectedTierIds, tierId];
	}
	saveW3();
}

function getEvalKey(convId: string, modelId: string): string {
	return `${convId}:${modelId}`;
}

export function isEvalCached(convId: string, modelId: string): boolean {
	return getEvalKey(convId, modelId) in state.evalResults;
}

interface ConversationTurn {
	role: string;
	content: string;
}

export async function runEvaluation(
	conversations: Array<{ id: string; turns: ConversationTurn[] }>,
	onProgress: (msg: string) => void,
	signal?: AbortSignal
): Promise<void> {
	const apiKey = sessionStorage.getItem('openrouter-key');
	if (!apiKey) throw new Error('No API key');

	const allTiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);

	const pairs: Array<{ conv: typeof conversations[0]; tier: ModelTier }> = [];
	for (const conv of conversations) {
		for (const tier of allTiers) {
			if (!isEvalCached(conv.id, tier.modelId)) {
				pairs.push({ conv, tier });
			}
		}
	}

	state.evalProgress = {
		running: true,
		total: pairs.length,
		done: 0,
		active: [],
		errors: [],
		current: '',
		currentTurn: 0,
		currentTurnTotal: 0,
		lastMessage: 'Starting…'
	};

	const CONCURRENCY = 4;

	function addActive(pair: ActivePair) {
		state.evalProgress.active = [...state.evalProgress.active, pair];
	}

	function updateActive(pairKey: string, patch: Partial<ActivePair>) {
		state.evalProgress.active = state.evalProgress.active.map((p) =>
			p.pairKey === pairKey ? { ...p, ...patch } : p
		);
	}

	function removeActive(pairKey: string) {
		state.evalProgress.active = state.evalProgress.active.filter((p) => p.pairKey !== pairKey);
	}

	/** Process one (conversation × tier) pair — all turns run sequentially within. */
	async function processPair(conv: typeof conversations[0], tier: ModelTier) {
		const effectiveModelId = resolveModelId(tier);
		const pairKey = `${conv.id}:${effectiveModelId}`;

		const userTurns = conv.turns.filter((t) => t.role === 'user');
		addActive({
			pairKey,
			convId: conv.id,
			tierLabel: tier.label,
			modelId: effectiveModelId,
			currentTurn: 0,
			currentTurnTotal: userTurns.length,
			status: 'starting…'
		});

		const responses: string[] = [];
		const messages: Array<{ role: string; content: string }> = [];
		let pairAborted = false;

		for (let turnIdx = 0; turnIdx < userTurns.length; turnIdx++) {
			if (signal?.aborted) break;
			const userTurn = userTurns[turnIdx];
			updateActive(pairKey, {
				currentTurn: turnIdx + 1,
				status: `turn ${turnIdx + 1}/${userTurns.length} in flight`
			});

			messages.push({ role: 'user', content: userTurn.content });

			try {
				const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
						'HTTP-Referer': window.location.origin,
						'X-Title': 'Sovereignty Stack Decision SPA'
					},
					body: JSON.stringify({
						model: effectiveModelId,
						messages: [...messages],
						max_tokens: 8192
					}),
					signal
				});

				if (!resp.ok) {
					const errBody = await resp.text();
					// Detect OpenRouter's "no ZDR endpoint available" 404 so we can
					// skip remaining turns and give a single clear error per tier
					// instead of N copies of the same message.
					const isZdrUnavailable =
						resp.status === 404 && errBody.includes('guardrail restrictions');
					const prefix = `[${tier.label} / ${effectiveModelId}`;
					const errMsg = isZdrUnavailable
						? `${prefix}] Not available under your OpenRouter ZDR / data-policy settings. Try a different model ID or adjust settings at https://openrouter.ai/settings/privacy.`
						: `${prefix} / ${conv.id.slice(0, 14)} turn ${turnIdx + 1}] HTTP ${resp.status}: ${errBody.slice(0, 300)}`;
					state.evalProgress.errors = [...state.evalProgress.errors, errMsg];
					updateActive(pairKey, {
						status: isZdrUnavailable ? 'ZDR unavailable — skipping' : `HTTP ${resp.status}`
					});
					if (isZdrUnavailable) {
						// Abandon this entire pair — retrying other turns will just
						// hit the same error.
						pairAborted = true;
						break;
					}
					responses.push(`[Error ${resp.status}: ${errBody.slice(0, 200)}]`);
					messages.push({ role: 'assistant', content: responses[responses.length - 1] });
					continue;
				}

				const data = await resp.json();
				const choice = data.choices?.[0];
				const content = choice?.message?.content ?? '';
				const finishReason = choice?.finish_reason ?? 'unknown';

				if (!content || content.length === 0) {
					const errMsg = `[${tier.label} / ${effectiveModelId} / ${conv.id.slice(
						0,
						14
					)} turn ${turnIdx + 1}] Empty response (finish_reason: ${finishReason}).`;
					state.evalProgress.errors = [...state.evalProgress.errors, errMsg];
					responses.push(`[No response — finish_reason: ${finishReason}]`);
					messages.push({ role: 'assistant', content: '' });
				} else {
					// Flag truncation visibly in the stored content so the rater can see it
					// was cut short (finish_reason === 'length' means max_tokens hit).
					const suffix =
						finishReason === 'length'
							? '\n\n[⚠ Response truncated at max_tokens. Re-run this pair to get a full response.]'
							: '';
					responses.push(content + suffix);
					messages.push({ role: 'assistant', content });
					if (finishReason === 'length') {
						state.evalProgress.errors = [
							...state.evalProgress.errors,
							`[${tier.label} / ${conv.id.slice(0, 14)} turn ${turnIdx + 1}] Truncated at max_tokens.`
						];
					}
				}
			} catch (e) {
				if (signal?.aborted) break;
				const errMsg = `[${tier.label} / ${conv.id.slice(0, 14)} turn ${turnIdx + 1}] ${
					(e as Error).message
				}`;
				state.evalProgress.errors = [...state.evalProgress.errors, errMsg];
				responses.push(`[Error: ${(e as Error).message}]`);
				messages.push({ role: 'assistant', content: responses[responses.length - 1] });
			}
		}

		if (!signal?.aborted && !pairAborted) {
			const key = getEvalKey(conv.id, effectiveModelId);
			state.evalResults[key] = {
				conversationId: conv.id,
				modelId: effectiveModelId,
				responses,
				cachedAt: new Date().toISOString()
			};
			state.evalProgress.done++;
			saveW3();
		} else if (pairAborted) {
			// Still count it toward "done" so the progress bar doesn't stall.
			state.evalProgress.done++;
		}

		removeActive(pairKey);
	}

	// Worker pool: CONCURRENCY workers pulling pairs off a shared queue.
	const queue = [...pairs];
	onProgress(`Running up to ${CONCURRENCY} pairs in parallel…`);

	async function worker() {
		while (queue.length > 0 && !signal?.aborted) {
			const next = queue.shift();
			if (!next) break;
			await processPair(next.conv, next.tier);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, () => worker())
	);

	state.evalProgress = {
		...state.evalProgress,
		running: false,
		active: [],
		current: '',
		currentTurn: 0,
		currentTurnTotal: 0,
		lastMessage: signal?.aborted ? 'Cancelled.' : 'Evaluation complete.'
	};
}

// Blind rating helpers
function seededShuffle(arr: string[], seed: string): string[] {
	const copy = [...arr];
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
	}
	for (let i = copy.length - 1; i > 0; i--) {
		hash = ((hash << 5) - hash + i) | 0;
		const j = Math.abs(hash) % (i + 1);
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export function getTurnRating(convId: string, turnIndex: number): TurnRating | null {
	return (
		state.turnRatings.find(
			(r) => r.conversationId === convId && r.turnIndex === turnIndex
		) ?? null
	);
}

function buildTurnRating(convId: string, turnIndex: number): TurnRating {
	const allTiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);
	// Use effective (possibly overridden) model IDs so the lookup key
	// matches what was stored in evalResults during runEvaluation.
	const modelIds = allTiers.map((t) => resolveModelId(t));
	const seed = `${convId}-${turnIndex}`;
	return {
		conversationId: convId,
		turnIndex,
		ratings: {},
		tags: {},
		labelOrder: seededShuffle(modelIds, seed),
		revealed: false
	};
}

export function ensureTurnRating(convId: string, turnIndex: number): TurnRating {
	let existing = getTurnRating(convId, turnIndex);
	if (!existing) {
		existing = buildTurnRating(convId, turnIndex);
		state.turnRatings = [...state.turnRatings, existing];
		saveW3();
	}
	return existing;
}

/** Pure read — safe for template expressions. Returns existing or a built placeholder. Does NOT persist. */
export function getOrCreateTurnRating(convId: string, turnIndex: number): TurnRating {
	return getTurnRating(convId, turnIndex) ?? buildTurnRating(convId, turnIndex);
}

export function setRating(convId: string, turnIndex: number, modelId: string, score: number) {
	const rating = ensureTurnRating(convId, turnIndex);
	rating.ratings[modelId] = score;
	saveW3();
}

export function revealTurn(convId: string, turnIndex: number) {
	const rating = ensureTurnRating(convId, turnIndex);
	rating.revealed = true;
	saveW3();
}

/** Number of turns in `convId` that have at least one candidate rating. */
export function getRatedTurnCount(convId: string): number {
	const rated = new Set<number>();
	for (const tr of state.turnRatings) {
		if (tr.conversationId === convId && Object.keys(tr.ratings).length > 0) {
			rated.add(tr.turnIndex);
		}
	}
	return rated.size;
}

/**
 * First turn index in `convId` with no ratings. Returns `totalTurns - 1`
 * when every turn has at least one rating (so callers can land on the
 * last turn for review). Returns 0 when totalTurns is 0 or 1.
 */
export function firstUnratedTurn(convId: string, totalTurns: number): number {
	if (totalTurns <= 0) return 0;
	for (let i = 0; i < totalTurns; i++) {
		const tr = state.turnRatings.find(
			(t) => t.conversationId === convId && t.turnIndex === i
		);
		if (!tr || Object.keys(tr.ratings).length === 0) return i;
	}
	return totalTurns - 1;
}

// Metrics computation
export interface TierMetrics {
	tierId: string;
	tierLabel: string;
	modelId: string;
	adequacyRate: number;
	criticalFailureRate: number;
	weightedAdequacy: number;
	meetsThreshold: boolean;
	sampleSize: number;
}

/** Below this, metrics are rendered dimmed to signal low confidence. */
export const LOW_CONFIDENCE_THRESHOLD = 3;

export function computeMetrics(): TierMetrics[] {
	const allTiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);

	return allTiers.map((tier) => {
		const ratings: number[] = [];
		for (const tr of state.turnRatings) {
			if (tr.ratings[tier.modelId] !== undefined) {
				ratings.push(tr.ratings[tier.modelId]);
			}
		}

		if (ratings.length === 0) {
			return {
				tierId: tier.id,
				tierLabel: tier.label,
				modelId: tier.modelId,
				adequacyRate: 0,
				criticalFailureRate: 0,
				weightedAdequacy: 0,
				meetsThreshold: false,
				sampleSize: 0
			};
		}

		const adequate = ratings.filter((r) => r >= 3).length;
		const critical = ratings.filter((r) => r === 1).length;
		const adequacyRate = adequate / ratings.length;
		const criticalFailureRate = critical / ratings.length;

		return {
			tierId: tier.id,
			tierLabel: tier.label,
			modelId: tier.modelId,
			adequacyRate,
			criticalFailureRate,
			weightedAdequacy: adequacyRate, // simplified: no frequency weights yet
			meetsThreshold:
				adequacyRate >= 0.8 && criticalFailureRate <= 0.1,
			sampleSize: ratings.length
		};
	});
}

export function personalMinimumTier(): string | null {
	const metrics = computeMetrics();
	const tierOrder = ['mini', 'small', 'medium', 'large', 'anchor'];
	for (const tierId of tierOrder) {
		const m = metrics.find((x) => x.tierId === tierId);
		if (m && m.meetsThreshold) return tierId;
	}
	return null;
}
