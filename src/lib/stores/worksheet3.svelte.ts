import { dbGet } from './db';
import { schedulePersist, plainify } from './persist';
import type { ModelTier } from '$lib/data/tiers';
import { modelTiers } from '$lib/data/tiers';
import {
	seededShuffle as pureSeededShuffle,
	buildReplayMessages as pureBuildReplayMessages,
	computeGeneratedTurnCount,
	hasMoreTurnsToGenerate
} from './w3-pure';

export interface EvalResult {
	conversationId: string;
	modelId: string;
	responses: string[];
	cachedAt: string;
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

export interface ConversationExpansion {
	convId: string;
	turnIndex: number;
	tierProgress: Array<{
		modelId: string;
		tierLabel: string;
		status: 'pending' | 'generating' | 'done' | 'failed';
	}>;
	startedAt: string;
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
	/** Per-conversation in-flight expansion state. Keyed by convId.
	 * Absence means no expansion running for that conversation. */
	conversationExpansions: Record<string, ConversationExpansion>;
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
	conversationExpansions: {}
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
		// conversationExpansions is ephemeral — don't rehydrate in-flight state.
		// If an expansion was running when the tab closed, it's lost; cached
		// responses for any turns that saved before closure are intact.
		state.conversationExpansions = {};
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

/** Full W3 reset — clears conversations, tiers, overrides, responses, ratings. */
export function resetW3All() {
	state.selectedConversations = [];
	state.selectedTierIds = modelTiers.filter((t) => !t.isAnchor && t.defaultSelected).map((t) => t.id);
	state.modelOverrides = {};
	state.evalResults = {};
	state.turnRatings = [];
	state.evalProgress = { ...DEFAULT_PROGRESS };
	state.conversationExpansions = {};
	saveW3();
}

/** Clear LLM responses and dependent ratings. */
export function resetW3Responses() {
	state.evalResults = {};
	state.turnRatings = [];
	state.evalProgress = { ...DEFAULT_PROGRESS };
	state.conversationExpansions = {};
	saveW3();
}

/** Clear user ratings only. */
export function resetW3Ratings() {
	state.turnRatings = [];
	saveW3();
}

interface ConversationLike {
	id: string;
	turns: Array<{ role: string; content: string }>;
}

interface ConversationTurn {
	role: string;
	content: string;
}

function getEvalKey(convId: string, modelId: string): string {
	return `${convId}:${modelId}`;
}

export function isEvalCached(convId: string, modelId: string): boolean {
	return getEvalKey(convId, modelId) in state.evalResults;
}

/** How many turns have been generated so far for this conversation,
 * across every selected tier. A turn counts as "generated" only when every
 * selected tier has a non-empty response at that index. Missing tiers or
 * short response arrays drag the count down so the UI never claims a turn
 * is ready when part of the grid is empty. */
export function getGeneratedTurnCount(convId: string): number {
	const activeTiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);
	const modelIds = activeTiers.map((t) => resolveModelId(t));
	return computeGeneratedTurnCount(state.evalResults, convId, modelIds);
}

/** Whether a conversation has more turns that could be generated. */
export function hasMoreTurns(convId: string, totalUserTurns: number): boolean {
	return hasMoreTurnsToGenerate(getGeneratedTurnCount(convId), totalUserTurns);
}

/** Whether a conversation currently has an on-demand expansion in flight. */
export function isConversationExpanding(convId: string): boolean {
	return convId in state.conversationExpansions;
}

export function getConversationExpansion(convId: string): ConversationExpansion | null {
	return state.conversationExpansions[convId] ?? null;
}

const buildReplayMessages = pureBuildReplayMessages;

type ReplayOutcome =
	| { kind: 'ok'; content: string }
	| { kind: 'empty'; finishReason: string }
	| { kind: 'truncated'; content: string }
	| { kind: 'zdr-unavailable'; errorMessage: string }
	| { kind: 'http-error'; status: number; body: string }
	| { kind: 'exception'; error: Error };

/** Single-turn API call. Returns a structured outcome so the caller can
 * decide how to surface the result. Never throws except via AbortError,
 * which the caller handles. */
async function replayOneTurn(args: {
	apiKey: string;
	modelId: string;
	messages: Array<{ role: string; content: string }>;
	signal?: AbortSignal;
}): Promise<ReplayOutcome> {
	try {
		const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': window.location.origin,
				'X-Title': 'Sovereignty Stack Decision SPA'
			},
			body: JSON.stringify({
				model: args.modelId,
				messages: args.messages,
				max_tokens: 8192
			}),
			signal: args.signal
		});

		if (!resp.ok) {
			const errBody = await resp.text();
			const isZdrUnavailable =
				resp.status === 404 && errBody.includes('guardrail restrictions');
			if (isZdrUnavailable) {
				return {
					kind: 'zdr-unavailable',
					errorMessage:
						'Not available under your OpenRouter ZDR / data-policy settings. Try a different model ID or adjust settings at https://openrouter.ai/settings/privacy.'
				};
			}
			return { kind: 'http-error', status: resp.status, body: errBody.slice(0, 300) };
		}

		const data = await resp.json();
		const choice = data.choices?.[0];
		const content: string = choice?.message?.content ?? '';
		const finishReason: string = choice?.finish_reason ?? 'unknown';

		if (!content || content.length === 0) {
			return { kind: 'empty', finishReason };
		}
		if (finishReason === 'length') {
			return {
				kind: 'truncated',
				content:
					content +
					'\n\n[⚠ Response truncated at max_tokens. Re-run this pair to get a full response.]'
			};
		}
		return { kind: 'ok', content };
	} catch (e) {
		return { kind: 'exception', error: e as Error };
	}
}

/** Persist one response into evalResults at the given turn index, creating
 * or extending the response array. Marks intermediate slots as empty when
 * writing past the existing length (defensive; sequential replay should
 * never skip indices). */
function writeTurnResult(convId: string, modelId: string, turnIndex: number, response: string) {
	const key = getEvalKey(convId, modelId);
	const existing = state.evalResults[key];
	const responses = existing?.responses ? [...existing.responses] : [];
	while (responses.length < turnIndex) responses.push('');
	responses[turnIndex] = response;
	state.evalResults[key] = {
		conversationId: convId,
		modelId,
		responses,
		cachedAt: new Date().toISOString()
	};
}

/**
 * Re-run a (conversation × model) pair from a specific turn forward,
 * preserving cached responses for earlier turns and the user's ratings
 * for turns that aren't being regenerated. Used by the existing per-turn
 * "re-run" button in the rating UI.
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

	const preserved = existing?.responses.slice(0, startTurn) ?? [];

	state.turnRatings = state.turnRatings.map((r) => {
		if (r.conversationId !== conv.id) return r;
		if (r.turnIndex < startTurn) return r;
		if (!(effectiveModelId in r.ratings)) return r;
		const { [effectiveModelId]: _dropped, ...remainingRatings } = r.ratings;
		return { ...r, ratings: remainingRatings, revealed: false };
	});

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
	const messages = buildReplayMessages(userTurns, preserved, startTurn);
	// Strip the trailing user message — we add it back inside the loop so
	// each turn's messages are built incrementally.
	messages.pop();

	for (let turnIdx = startTurn; turnIdx < userTurns.length; turnIdx++) {
		if (signal?.aborted) break;
		state.evalProgress.active = state.evalProgress.active.map((p) =>
			p.pairKey === pairKey
				? { ...p, currentTurn: turnIdx + 1, status: `turn ${turnIdx + 1}/${userTurns.length}` }
				: p
		);
		messages.push({ role: 'user', content: userTurns[turnIdx].content });

		const outcome = await replayOneTurn({
			apiKey,
			modelId: effectiveModelId,
			messages: [...messages],
			signal
		});

		if (outcome.kind === 'exception' && signal?.aborted) break;

		const label = `[${tier.label} re-run turn ${turnIdx + 1}]`;
		if (outcome.kind === 'ok') {
			newResponses.push(outcome.content);
			messages.push({ role: 'assistant', content: outcome.content });
		} else if (outcome.kind === 'truncated') {
			newResponses.push(outcome.content);
			messages.push({ role: 'assistant', content: outcome.content });
			state.evalProgress.errors = [...state.evalProgress.errors, `${label} Truncated.`];
		} else if (outcome.kind === 'empty') {
			newResponses.push(`[No response — finish_reason: ${outcome.finishReason}]`);
			messages.push({ role: 'assistant', content: '' });
			state.evalProgress.errors = [
				...state.evalProgress.errors,
				`${label} Empty response (finish_reason: ${outcome.finishReason}).`
			];
		} else if (outcome.kind === 'http-error') {
			state.evalProgress.errors = [
				...state.evalProgress.errors,
				`${label} HTTP ${outcome.status}: ${outcome.body}`
			];
			newResponses.push(`[Error ${outcome.status}: ${outcome.body}]`);
			messages.push({ role: 'assistant', content: newResponses[newResponses.length - 1] });
		} else if (outcome.kind === 'zdr-unavailable') {
			state.evalProgress.errors = [
				...state.evalProgress.errors,
				`${label} ${outcome.errorMessage}`
			];
			break;
		} else if (outcome.kind === 'exception') {
			state.evalProgress.errors = [
				...state.evalProgress.errors,
				`${label} ${outcome.error.message}`
			];
			newResponses.push(`[Error: ${outcome.error.message}]`);
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

export function toggleTier(tierId: string) {
	const idx = state.selectedTierIds.indexOf(tierId);
	if (idx >= 0) {
		state.selectedTierIds = state.selectedTierIds.filter((t) => t !== tierId);
	} else {
		state.selectedTierIds = [...state.selectedTierIds, tierId];
	}
	saveW3();
}

const CONCURRENCY = 4;

/** Shared per-pair processor for a single turn index. Reads preserved
 * responses from the cache (or starts fresh at turn 0) and writes the new
 * response back. Pair-level progress is surfaced via evalProgress.active. */
async function processPairOneTurn(
	apiKey: string,
	conv: { id: string; turns: ConversationTurn[] },
	tier: ModelTier,
	turnIndex: number,
	pairKeySuffix: string,
	signal?: AbortSignal
): Promise<'ok' | 'failed' | 'aborted'> {
	const effectiveModelId = resolveModelId(tier);
	const userTurns = conv.turns.filter((t) => t.role === 'user');
	if (turnIndex < 0 || turnIndex >= userTurns.length) return 'failed';

	const key = getEvalKey(conv.id, effectiveModelId);
	const existing = state.evalResults[key];
	const preserved = existing?.responses.slice(0, turnIndex) ?? [];

	// Reject gaps: every prior turn must be generated before this one.
	if (preserved.length < turnIndex) return 'failed';

	const pairKey = `${conv.id}:${effectiveModelId}:${pairKeySuffix}`;
	state.evalProgress.active = [
		...state.evalProgress.active,
		{
			pairKey,
			convId: conv.id,
			tierLabel: tier.label,
			modelId: effectiveModelId,
			currentTurn: turnIndex + 1,
			currentTurnTotal: userTurns.length,
			status: `turn ${turnIndex + 1}/${userTurns.length} in flight`
		}
	];

	const messages = buildReplayMessages(userTurns, preserved, turnIndex);
	const outcome = await replayOneTurn({ apiKey, modelId: effectiveModelId, messages, signal });

	state.evalProgress.active = state.evalProgress.active.filter((p) => p.pairKey !== pairKey);

	if (signal?.aborted) return 'aborted';

	const label = `[${tier.label} / ${effectiveModelId} / ${conv.id.slice(0, 14)} turn ${
		turnIndex + 1
	}]`;

	if (outcome.kind === 'ok') {
		writeTurnResult(conv.id, effectiveModelId, turnIndex, outcome.content);
		return 'ok';
	}
	if (outcome.kind === 'truncated') {
		writeTurnResult(conv.id, effectiveModelId, turnIndex, outcome.content);
		state.evalProgress.errors = [...state.evalProgress.errors, `${label} Truncated at max_tokens.`];
		return 'ok';
	}
	if (outcome.kind === 'empty') {
		writeTurnResult(
			conv.id,
			effectiveModelId,
			turnIndex,
			`[No response — finish_reason: ${outcome.finishReason}]`
		);
		state.evalProgress.errors = [
			...state.evalProgress.errors,
			`${label} Empty response (finish_reason: ${outcome.finishReason}).`
		];
		return 'failed';
	}
	if (outcome.kind === 'zdr-unavailable') {
		state.evalProgress.errors = [...state.evalProgress.errors, `${label} ${outcome.errorMessage}`];
		return 'failed';
	}
	if (outcome.kind === 'http-error') {
		writeTurnResult(
			conv.id,
			effectiveModelId,
			turnIndex,
			`[Error ${outcome.status}: ${outcome.body}]`
		);
		state.evalProgress.errors = [
			...state.evalProgress.errors,
			`${label} HTTP ${outcome.status}: ${outcome.body}`
		];
		return 'failed';
	}
	// exception
	writeTurnResult(conv.id, effectiveModelId, turnIndex, `[Error: ${outcome.error.message}]`);
	state.evalProgress.errors = [...state.evalProgress.errors, `${label} ${outcome.error.message}`];
	return 'failed';
}

/**
 * Initial batch: generate turn 0 only for every (conversation × selected tier)
 * pair that isn't already cached at turn 0. Runs the existing concurrent
 * worker pool. Later turns are generated on demand via expandConversationTurn.
 */
export async function runInitialBatch(
	conversations: Array<{ id: string; turns: ConversationTurn[] }>,
	onProgress: (msg: string) => void,
	signal?: AbortSignal
): Promise<void> {
	const storedKey = sessionStorage.getItem('openrouter-key');
	if (!storedKey) throw new Error('No API key');
	const apiKey: string = storedKey;

	const allTiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);

	const pairs: Array<{ conv: { id: string; turns: ConversationTurn[] }; tier: ModelTier }> = [];
	for (const conv of conversations) {
		for (const tier of allTiers) {
			const modelId = resolveModelId(tier);
			const key = getEvalKey(conv.id, modelId);
			const existing = state.evalResults[key];
			// Turn 0 is already generated if responses has at least one entry.
			if (!existing || existing.responses.length === 0) {
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
		currentTurnTotal: 1,
		lastMessage: 'Generating turn 1 for all conversations…'
	};

	const queue = [...pairs];
	onProgress(`Running up to ${CONCURRENCY} pairs in parallel (turn 1 only)…`);

	async function worker() {
		while (queue.length > 0 && !signal?.aborted) {
			const next = queue.shift();
			if (!next) break;
			const result = await processPairOneTurn(apiKey, next.conv, next.tier, 0, 'initial', signal);
			if (result === 'ok' || result === 'failed') state.evalProgress.done++;
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, () => worker())
	);

	saveW3();
	state.evalProgress = {
		...state.evalProgress,
		running: false,
		active: [],
		current: '',
		currentTurn: 0,
		currentTurnTotal: 0,
		lastMessage: signal?.aborted
			? 'Cancelled.'
			: 'Initial batch complete. Use "Generate next turn" per conversation to go deeper.'
	};
}

/**
 * On-demand expansion: generate the next un-generated turn for one
 * conversation across every currently-selected tier. Sequential per tier is
 * not required — the worker pool handles concurrency up to CONCURRENCY.
 *
 * Each conversation tracks its own expansion state in
 * state.conversationExpansions[convId]. While one conversation is expanding,
 * other conversations remain fully interactive.
 */
export async function expandConversationTurn(
	conv: { id: string; turns: ConversationTurn[] },
	onProgress: (msg: string) => void,
	signal?: AbortSignal
): Promise<void> {
	const storedKey = sessionStorage.getItem('openrouter-key');
	if (!storedKey) throw new Error('No API key');
	const apiKey: string = storedKey;
	if (conv.id in state.conversationExpansions) return;

	const userTurns = conv.turns.filter((t) => t.role === 'user');
	const nextTurnIndex = getGeneratedTurnCount(conv.id);
	if (nextTurnIndex >= userTurns.length) return;

	const activeTiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);

	// Register the expansion so UI indicators show up and re-entry is blocked.
	state.conversationExpansions = {
		...state.conversationExpansions,
		[conv.id]: {
			convId: conv.id,
			turnIndex: nextTurnIndex,
			tierProgress: activeTiers.map((t) => ({
				modelId: resolveModelId(t),
				tierLabel: t.label,
				status: 'pending' as const
			})),
			startedAt: new Date().toISOString()
		}
	};

	onProgress(
		`Generating turn ${nextTurnIndex + 1} for ${conv.id.slice(0, 14)} across ${activeTiers.length} tiers…`
	);

	const queue = activeTiers.map((tier) => ({ tier }));

	async function worker() {
		while (queue.length > 0 && !signal?.aborted) {
			const next = queue.shift();
			if (!next) break;
			const modelId = resolveModelId(next.tier);
			const expansion = state.conversationExpansions[conv.id];
			if (expansion) {
				expansion.tierProgress = expansion.tierProgress.map((tp) =>
					tp.modelId === modelId ? { ...tp, status: 'generating' as const } : tp
				);
			}

			const result = await processPairOneTurn(
				apiKey,
				conv,
				next.tier,
				nextTurnIndex,
				`expand-${nextTurnIndex}`,
				signal
			);

			const expansion2 = state.conversationExpansions[conv.id];
			if (expansion2) {
				expansion2.tierProgress = expansion2.tierProgress.map((tp) =>
					tp.modelId === modelId
						? { ...tp, status: result === 'ok' ? ('done' as const) : ('failed' as const) }
						: tp
				);
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, activeTiers.length) }, () => worker())
	);

	saveW3();

	// Clear the expansion marker. Leave the turn in the cache either way.
	const { [conv.id]: _cleared, ...remaining } = state.conversationExpansions;
	state.conversationExpansions = remaining;
}

/**
 * Retry a single (conversation, tier, turn) triple. Used when one candidate
 * on a turn failed (empty response, HTTP error) but the others succeeded —
 * re-runs just that one without touching the others.
 */
export async function retryCandidateTurn(
	conv: { id: string; turns: ConversationTurn[] },
	tier: ModelTier,
	turnIndex: number,
	signal?: AbortSignal
): Promise<'ok' | 'failed' | 'aborted'> {
	const apiKey = sessionStorage.getItem('openrouter-key');
	if (!apiKey) throw new Error('No API key');

	const userTurns = conv.turns.filter((t) => t.role === 'user');
	if (turnIndex < 0 || turnIndex >= userTurns.length) return 'failed';

	const effectiveModelId = resolveModelId(tier);
	const key = getEvalKey(conv.id, effectiveModelId);
	const existing = state.evalResults[key];
	if (!existing || existing.responses.length < turnIndex) return 'failed';

	const result = await processPairOneTurn(
		apiKey,
		conv,
		tier,
		turnIndex,
		`retry-${turnIndex}`,
		signal
	);
	saveW3();
	return result;
}

// Blind rating helpers
const seededShuffle = pureSeededShuffle;

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

/** Pure read — safe for template expressions. Returns existing or a built
 * placeholder. Does NOT persist. */
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

// Metrics computation
export interface TierMetrics {
	tierId: string;
	tierLabel: string;
	modelId: string;
	adequacyRate: number;
	criticalFailureRate: number;
	weightedAdequacy: number;
	meetsThreshold: boolean;
}

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
				meetsThreshold: false
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
			weightedAdequacy: adequacyRate,
			meetsThreshold: adequacyRate >= 0.8 && criticalFailureRate <= 0.1
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