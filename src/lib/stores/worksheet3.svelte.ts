import { dbGet } from './db';
import { schedulePersist, plainify } from './persist';
import type { ModelTier } from '$lib/data/tiers';
import { modelTiers, MODEL_NATIVE_MAX_CONTEXT, DEFAULT_NATIVE_MAX_CONTEXT } from '$lib/data/tiers';
import {
	seededShuffle as pureSeededShuffle,
	buildReplayMessages as pureBuildReplayMessages,
	computeGeneratedTurnCount,
	hasMoreTurnsToGenerate,
	computeTierMetricsPure,
	personalMinimumTierPure
} from './w3-pure';

/** Precision band that governs which OpenRouter quantizations filter is sent. */
export type PrecisionBand = 'local' | 'balanced' | 'frontier';

export interface W3Settings {
	/** Which quantization band to request from OpenRouter.
	 * 'local' → fp4/int4, 'balanced' → fp8, 'frontier' → bf16/fp16. */
	precisionBand: PrecisionBand;
	/** Max context in tokens to request. Capped at the model's native max. */
	maxContext: number;
}

export interface EvalResult {
	conversationId: string;
	modelId: string;
	responses: string[];
	cachedAt: string;
	/** Turn indices still truncated (finish_reason: length, with or without
	 * content) after auto-retry. The rating UI flags these distinctly from
	 * generic "needs re-run" cards. */
	truncatedTurns?: number[];
	/** Turn indices the operator chose to skip after a truncation or empty
	 * response. Aggregation counts these as recorded gaps, not silent
	 * absences. */
	skippedTurns?: number[];
	/** Precision band active when this result was cached (SPEC-013). */
	cachedPrecision?: PrecisionBand;
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
	/** At most one active custom conversation (SPEC-007). */
	customConversation: CustomConversation | null;
	/** SPEC-013: precision band + context length settings. */
	w3Settings: W3Settings;
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

const DEFAULT_W3_SETTINGS: W3Settings = {
	precisionBand: 'local',
	maxContext: 131072
};

const DEFAULT_STATE: W3State = {
	selectedConversations: [],
	selectedTierIds: modelTiers.filter((t) => !t.isAnchor && t.defaultSelected).map((t) => t.id),
	modelOverrides: {},
	evalResults: {},
	turnRatings: [],
	evalProgress: { ...DEFAULT_PROGRESS },
	conversationExpansions: {},
	customConversation: null,
	w3Settings: { ...DEFAULT_W3_SETTINGS }
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
		state.customConversation = saved.customConversation ?? null;
		// SPEC-013: restore precision settings, falling back to defaults for
		// sessions that predate this field.
		state.w3Settings = {
			precisionBand: saved.w3Settings?.precisionBand ?? DEFAULT_W3_SETTINGS.precisionBand,
			maxContext: saved.w3Settings?.maxContext ?? DEFAULT_W3_SETTINGS.maxContext
		};
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
				turnRatings: state.turnRatings,
				customConversation: state.customConversation,
				w3Settings: state.w3Settings
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

/** Shared default output budget when a tier has no `maxTokens` override. */
const DEFAULT_MAX_TOKENS = 8192;

/** Resolve the effective per-request max_tokens for a tier. Reasoning-capable
 * models (e.g., qwen3.5-9b on Mini) set `maxTokens` in tier config so they
 * have enough headroom to emit visible content after thinking-mode tokens. */
export function resolveMaxTokens(tier: ModelTier): number {
	return tier.maxTokens ?? DEFAULT_MAX_TOKENS;
}

/** Return native max context for a model ID, falling back to the global default. */
export function modelNativeMax(modelId: string): number {
	return MODEL_NATIVE_MAX_CONTEXT[modelId] ?? DEFAULT_NATIVE_MAX_CONTEXT;
}

/** Effective context ceiling: min of the user's chosen limit and model's native max. */
export function effectiveMaxContext(modelId: string): number {
	return Math.min(state.w3Settings.maxContext, modelNativeMax(modelId));
}

/** The quantizations array to send for the active precision band, or null if
 * the band should be skipped for this modelId (anchor tier or gpt-oss-120b). */
export function resolveQuantizations(modelId: string, isAnchor: boolean): string[] | null {
	// Anchor stays at Anthropic defaults — no quantization filter.
	if (isAnchor) return null;
	// gpt-oss-120b is MXFP4-native — pinning any band would be redundant or
	// wrong, so we let OpenRouter route naturally.
	if (modelId === 'openai/gpt-oss-120b') return null;
	const band = state.w3Settings.precisionBand;
	if (band === 'local') return ['fp4', 'int4'];
	if (band === 'balanced') return ['fp8'];
	return ['bf16', 'fp16'];
}

/** Human-readable precision label for a model ID given the current band. */
export function precisionLabel(modelId: string, isAnchor: boolean): string {
	if (isAnchor) return 'frontier (Anthropic default)';
	if (modelId === 'openai/gpt-oss-120b') return 'MXFP4 native — local and cloud match';
	const band = state.w3Settings.precisionBand;
	if (band === 'local') return 'fp4/int4 — matches local MLX 4-bit';
	if (band === 'balanced') return 'fp8';
	return 'bf16/fp16 — frontier quality';
}

/** Short summary for the "Sending as" disclosure line. */
export function sendingAsSummary(): string {
	const band = state.w3Settings.precisionBand;
	const ctx = state.w3Settings.maxContext;
	const ctxK = ctx >= 1000 ? `${Math.round(ctx / 1024)}K` : `${ctx}`;
	if (band === 'local') return `fp4/int4 · ${ctxK} context`;
	if (band === 'balanced') return `fp8 · ${ctxK} context`;
	return `bf16/fp16 · ${ctxK} context`;
}

/** Whether any cached EvalResult was generated at a different precision band. */
export function hasPrecisionMismatch(targetBand: PrecisionBand): boolean {
	for (const result of Object.values(state.evalResults)) {
		const cached = result.cachedPrecision ?? 'local';
		if (cached !== targetBand) return true;
	}
	return false;
}

/** Update w3Settings and persist. Callers should check for cache mismatch
 * (via hasPrecisionMismatch) before calling when changing precisionBand. */
export function setW3Settings(settings: Partial<W3Settings>) {
	state.w3Settings = { ...state.w3Settings, ...settings };
	saveW3();
}

/** Clear all eval results that were cached at a band other than current. */
export function clearMismatchedCache() {
	const band = state.w3Settings.precisionBand;
	const nextResults: Record<string, EvalResult> = {};
	for (const [key, val] of Object.entries(state.evalResults)) {
		const cached = val.cachedPrecision ?? 'local';
		if (cached === band) nextResults[key] = val;
	}
	// Also drop ratings for conversations whose results were cleared.
	const survivingKeys = new Set(Object.keys(nextResults));
	state.evalResults = nextResults;
	state.turnRatings = state.turnRatings.filter((tr) => {
		// Keep ratings only if at least one model's result survived.
		return Object.keys(state.evalResults).some((k) => k.startsWith(tr.conversationId + ':') && survivingKeys.has(k));
	});
	saveW3();
}

/** Mark all existing cached results with the current precision band
 * (used when keeping cache with mismatch flag). */
export function stampCachePrecision() {
	const band = state.w3Settings.precisionBand;
	for (const key of Object.keys(state.evalResults)) {
		state.evalResults[key] = { ...state.evalResults[key], cachedPrecision: band };
	}
	saveW3();
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
	state.customConversation = null;
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

/** Mark a specific (conversation, model, turn) as skipped. Records the turn
 * index in the EvalResult so the rating UI can show it as a recorded gap
 * and aggregation can treat it as intentionally-not-rated rather than
 * silently absent. */
export function skipTurnForModel(convId: string, modelId: string, turnIndex: number) {
	const key = getEvalKey(convId, modelId);
	const existing = state.evalResults[key];
	if (!existing) return;
	const skipped = new Set(existing.skippedTurns ?? []);
	skipped.add(turnIndex);
	state.evalResults[key] = {
		...existing,
		skippedTurns: Array.from(skipped).sort((a, b) => a - b)
	};
	saveW3();
}

/** Un-mark a skipped turn — the operator wants to try again. */
export function unskipTurnForModel(convId: string, modelId: string, turnIndex: number) {
	const key = getEvalKey(convId, modelId);
	const existing = state.evalResults[key];
	if (!existing?.skippedTurns) return;
	const remaining = existing.skippedTurns.filter((i) => i !== turnIndex);
	state.evalResults[key] = {
		...existing,
		skippedTurns: remaining.length > 0 ? remaining : undefined
	};
	saveW3();
}

export function isTurnSkipped(convId: string, modelId: string, turnIndex: number): boolean {
	const key = getEvalKey(convId, modelId);
	return !!state.evalResults[key]?.skippedTurns?.includes(turnIndex);
}

export function isTurnTruncated(convId: string, modelId: string, turnIndex: number): boolean {
	const key = getEvalKey(convId, modelId);
	return !!state.evalResults[key]?.truncatedTurns?.includes(turnIndex);
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

interface UsageLike {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
	reasoning_tokens?: number;
	completion_tokens_details?: { reasoning_tokens?: number };
}

/** Format the OpenRouter usage block for a truncation diagnostic. Surfaces
 * reasoning-token consumption, which is the prime suspect when a
 * reasoning-capable model returns empty content at finish_reason=length. */
function summarizeUsage(usage: UsageLike | undefined, reasoningContent: string | undefined): string {
	if (!usage && !reasoningContent) return '';
	const parts: string[] = [];
	if (usage && typeof usage.prompt_tokens === 'number') parts.push(`prompt=${usage.prompt_tokens}`);
	if (usage && typeof usage.completion_tokens === 'number') parts.push(`completion=${usage.completion_tokens}`);
	const reasoningTokens =
		usage?.reasoning_tokens ?? usage?.completion_tokens_details?.reasoning_tokens;
	if (typeof reasoningTokens === 'number' && reasoningTokens > 0) {
		parts.push(`reasoning=${reasoningTokens}`);
	}
	if (reasoningContent && reasoningContent.length > 0) {
		parts.push(`reasoning_chars=${reasoningContent.length}`);
	}
	return parts.length > 0 ? ` [${parts.join(' ')}]` : '';
}

type ReplayOutcome =
	| { kind: 'ok'; content: string }
	| { kind: 'empty'; finishReason: string; usage?: UsageLike; reasoningContent?: string }
	| { kind: 'truncated'; content: string; usage?: UsageLike; reasoningContent?: string }
	| { kind: 'zdr-unavailable'; errorMessage: string }
	/** No provider offered the requested precision band (SPEC-013 AC #9). */
	| { kind: 'no-provider'; errorMessage: string }
	| { kind: 'http-error'; status: number; body: string }
	| { kind: 'exception'; error: Error };

/** Single-turn API call. Returns a structured outcome so the caller can
 * decide how to surface the result. Never throws except via AbortError,
 * which the caller handles.
 *
 * `maxTokens` is the effective output budget — typically from
 * `resolveMaxTokens(tier)` so per-model overrides (e.g., qwen3.5-9b's 16384)
 * ride all the way to the wire.
 *
 * `quantizations` is the SPEC-013 precision filter. Pass null to omit the
 * provider block (anchor tier, gpt-oss-120b). */
async function replayOneTurn(args: {
	apiKey: string;
	modelId: string;
	messages: Array<{ role: string; content: string }>;
	maxTokens: number;
	quantizations: string[] | null;
	signal?: AbortSignal;
}): Promise<ReplayOutcome> {
	try {
		const body: Record<string, unknown> = {
			model: args.modelId,
			messages: args.messages,
			max_tokens: args.maxTokens
		};
		if (args.quantizations && args.quantizations.length > 0) {
			body.provider = { quantizations: args.quantizations };
		}
		const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': window.location.origin,
				'X-Title': 'Sovereignty Stack Decision SPA'
			},
			body: JSON.stringify(body),
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
			// SPEC-013 AC #9: OpenRouter returns 400/503 when no provider matches
			// the requested quantizations. Surface a distinct outcome so callers
			// can offer fallback-band recovery.
			const isNoProvider =
				(resp.status === 400 || resp.status === 503) &&
				(errBody.includes('No providers') ||
					errBody.includes('no provider') ||
					errBody.includes('provider_unavailable') ||
					errBody.includes('quantization') ||
					errBody.includes('No matching provider'));
			if (isNoProvider) {
				return {
					kind: 'no-provider',
					errorMessage: `No provider available for the selected precision band. Consider switching to a less restrictive band.`
				};
			}
			return { kind: 'http-error', status: resp.status, body: errBody.slice(0, 300) };
		}

		const data = await resp.json();
		const choice = data.choices?.[0];
		const content: string = choice?.message?.content ?? '';
		const finishReason: string = choice?.finish_reason ?? 'unknown';
		const usage: UsageLike | undefined = data.usage;
		const reasoningContent: string =
			choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? '';

		if (!content || content.length === 0) {
			return { kind: 'empty', finishReason, usage, reasoningContent };
		}
		if (finishReason === 'length') {
			return {
				kind: 'truncated',
				content:
					content +
					'\n\n[⚠ Response truncated at max_tokens. Re-run this pair to get a full response.]',
				usage,
				reasoningContent
			};
		}
		return { kind: 'ok', content };
	} catch (e) {
		return { kind: 'exception', error: e as Error };
	}
}

/** Wrap replayOneTurn with a single auto-retry at 2× budget when the first
 * attempt returned empty content because we hit max_tokens. Handles
 * reasoning-heavy models (Qwen 3.5 thinking mode) that burn the budget
 * before emitting visible text. */
async function replayOneTurnWithRetry(args: {
	apiKey: string;
	modelId: string;
	messages: Array<{ role: string; content: string }>;
	baseBudget: number;
	quantizations: string[] | null;
	signal?: AbortSignal;
}): Promise<{ outcome: ReplayOutcome; attempts: number }> {
	let outcome = await replayOneTurn({
		apiKey: args.apiKey,
		modelId: args.modelId,
		messages: args.messages,
		maxTokens: args.baseBudget,
		quantizations: args.quantizations,
		signal: args.signal
	});
	if (outcome.kind === 'empty' && outcome.finishReason === 'length') {
		const retry = await replayOneTurn({
			apiKey: args.apiKey,
			modelId: args.modelId,
			messages: args.messages,
			maxTokens: args.baseBudget * 2,
			quantizations: args.quantizations,
			signal: args.signal
		});
		if (retry.kind !== 'exception' || !args.signal?.aborted) {
			return { outcome: retry, attempts: 2 };
		}
	}
	return { outcome, attempts: 1 };
}

/** Persist one response into evalResults at the given turn index, creating
 * or extending the response array. Marks intermediate slots as empty when
 * writing past the existing length (defensive; sequential replay should
 * never skip indices).
 *
 * When `opts.truncated` is true, the turn index is added to
 * `truncatedTurns` so the rating UI can surface a dedicated "truncated"
 * badge and a skip control. A successful retry that replaces a previously
 * truncated turn clears that index from `truncatedTurns`. */
function writeTurnResult(
	convId: string,
	modelId: string,
	turnIndex: number,
	response: string,
	opts: { truncated?: boolean } = {}
) {
	const key = getEvalKey(convId, modelId);
	const existing = state.evalResults[key];
	const responses = existing?.responses ? [...existing.responses] : [];
	while (responses.length < turnIndex) responses.push('');
	responses[turnIndex] = response;

	const prevTruncated = new Set(existing?.truncatedTurns ?? []);
	if (opts.truncated) prevTruncated.add(turnIndex);
	else prevTruncated.delete(turnIndex);
	const truncatedTurns = prevTruncated.size > 0 ? Array.from(prevTruncated).sort((a, b) => a - b) : undefined;

	state.evalResults[key] = {
		conversationId: convId,
		modelId,
		responses,
		cachedAt: new Date().toISOString(),
		truncatedTurns,
		skippedTurns: existing?.skippedTurns,
		cachedPrecision: state.w3Settings.precisionBand
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

		const { outcome, attempts } = await replayOneTurnWithRetry({
			apiKey,
			modelId: effectiveModelId,
			messages: [...messages],
			baseBudget: resolveMaxTokens(tier),
			quantizations: resolveQuantizations(effectiveModelId, tier.isAnchor),
			signal
		});

		if (outcome.kind === 'exception' && signal?.aborted) break;

		const attemptTag = attempts > 1 ? ` after ${attempts} attempts` : '';
		const label = `[${tier.label} re-run turn ${turnIdx + 1}]`;
		if (outcome.kind === 'ok') {
			newResponses.push(outcome.content);
			messages.push({ role: 'assistant', content: outcome.content });
		} else if (outcome.kind === 'truncated') {
			newResponses.push(outcome.content);
			messages.push({ role: 'assistant', content: outcome.content });
			const usageTag = summarizeUsage(outcome.usage, outcome.reasoningContent);
			state.evalProgress.errors = [
				...state.evalProgress.errors,
				`${label} Truncated at max_tokens${usageTag}.`
			];
		} else if (outcome.kind === 'empty') {
			const usageTag = summarizeUsage(outcome.usage, outcome.reasoningContent);
			newResponses.push(
				`[No response — finish_reason: ${outcome.finishReason}${attemptTag}${usageTag}]`
			);
			messages.push({ role: 'assistant', content: '' });
			state.evalProgress.errors = [
				...state.evalProgress.errors,
				`${label} Empty response (finish_reason: ${outcome.finishReason})${attemptTag}${usageTag}.`
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
		} else if (outcome.kind === 'no-provider') {
			state.evalProgress.errors = [
				...state.evalProgress.errors,
				`${label} [no-provider] ${outcome.errorMessage}`
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
			cachedAt: new Date().toISOString(),
			cachedPrecision: state.w3Settings.precisionBand
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
	const quantizations = resolveQuantizations(effectiveModelId, tier.isAnchor);
	const { outcome, attempts } = await replayOneTurnWithRetry({
		apiKey,
		modelId: effectiveModelId,
		messages,
		baseBudget: resolveMaxTokens(tier),
		quantizations,
		signal
	});

	state.evalProgress.active = state.evalProgress.active.filter((p) => p.pairKey !== pairKey);

	if (signal?.aborted) return 'aborted';

	const label = `[${tier.label} / ${effectiveModelId} / ${conv.id.slice(0, 14)} turn ${
		turnIndex + 1
	}]`;
	const attemptTag = attempts > 1 ? ` after ${attempts} attempts` : '';

	if (outcome.kind === 'ok') {
		writeTurnResult(conv.id, effectiveModelId, turnIndex, outcome.content);
		return 'ok';
	}
	if (outcome.kind === 'truncated') {
		writeTurnResult(conv.id, effectiveModelId, turnIndex, outcome.content, { truncated: true });
		const usageTag = summarizeUsage(outcome.usage, outcome.reasoningContent);
		state.evalProgress.errors = [
			...state.evalProgress.errors,
			`${label} Truncated at max_tokens${usageTag}.`
		];
		return 'ok';
	}
	if (outcome.kind === 'empty') {
		const usageTag = summarizeUsage(outcome.usage, outcome.reasoningContent);
		writeTurnResult(
			conv.id,
			effectiveModelId,
			turnIndex,
			`[No response — finish_reason: ${outcome.finishReason}${attemptTag}${usageTag}]`,
			{ truncated: true }
		);
		state.evalProgress.errors = [
			...state.evalProgress.errors,
			`${label} Empty response (finish_reason: ${outcome.finishReason})${attemptTag}${usageTag}.`
		];
		return 'failed';
	}
	if (outcome.kind === 'zdr-unavailable') {
		state.evalProgress.errors = [...state.evalProgress.errors, `${label} ${outcome.errorMessage}`];
		return 'failed';
	}
	if (outcome.kind === 'no-provider') {
		state.evalProgress.errors = [...state.evalProgress.errors, `${label} [no-provider] ${outcome.errorMessage}`];
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
	/** Turns the operator marked skipped because the model produced no
	 * usable output (empty-response length truncation or similar).
	 * Counted across all evaluated conversations for this tier's
	 * effective model. Surfaced as a recorded gap, not a silent miss. */
	skippedTurns: number;
}

/** Below this, metrics are rendered dimmed to signal low confidence. */
export const LOW_CONFIDENCE_THRESHOLD = 3;

export function computeMetrics(): TierMetrics[] {
	const allTiers = modelTiers.filter(
		(t) => state.selectedTierIds.includes(t.id) || t.isAnchor
	);
	const tiers = allTiers.map((t) => ({
		tierId: t.id,
		tierLabel: t.label,
		modelId: resolveModelId(t)
	}));
	return computeTierMetricsPure(state.turnRatings, state.evalResults, tiers);
}

export const TIER_ORDER = ['mini', 'small', 'medium', 'large', 'anchor'];

export function personalMinimumTier(): string | null {
	return personalMinimumTierPure(computeMetrics(), TIER_ORDER);
}