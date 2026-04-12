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

export interface TurnRating {
	conversationId: string;
	turnIndex: number;
	ratings: Record<string, number>; // modelId -> 1-4
	tags: Record<string, string[]>; // modelId -> dimension tags
	labelOrder: string[]; // randomized model IDs for this turn
	revealed: boolean;
}

export interface W3State {
	selectedConversations: string[];
	selectedTierIds: string[];
	evalResults: Record<string, EvalResult>; // key: `${convId}:${modelId}`
	turnRatings: TurnRating[];
	evalProgress: { running: boolean; current: string; total: number; done: number };
}

const DEFAULT_STATE: W3State = {
	selectedConversations: [],
	selectedTierIds: modelTiers.filter((t) => !t.isAnchor).map((t) => t.id),
	evalResults: {},
	turnRatings: [],
	evalProgress: { running: false, current: '', total: 0, done: 0 }
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
				evalResults: state.evalResults,
				turnRatings: state.turnRatings
			})
		);
	} catch {
		// Silent — don't let persistence errors cascade through HMR forwarder.
	}
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

	state.evalProgress = { running: true, current: '', total: pairs.length, done: 0 };

	for (const { conv, tier } of pairs) {
		if (signal?.aborted) break;

		state.evalProgress.current = `${conv.id} × ${tier.label}`;
		onProgress(state.evalProgress.current);

		const userTurns = conv.turns.filter((t) => t.role === 'user');
		const responses: string[] = [];
		const messages: Array<{ role: string; content: string }> = [];

		for (const userTurn of userTurns) {
			if (signal?.aborted) break;

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
						model: tier.modelId,
						messages: [...messages],
						max_tokens: 2048
					}),
					signal
				});

				if (!resp.ok) {
					const err = await resp.text();
					responses.push(`[Error ${resp.status}: ${err.slice(0, 200)}]`);
					messages.push({ role: 'assistant', content: responses[responses.length - 1] });
					continue;
				}

				const data = await resp.json();
				const content = data.choices?.[0]?.message?.content ?? '[No response]';
				responses.push(content);
				messages.push({ role: 'assistant', content });
			} catch (e) {
				if (signal?.aborted) break;
				responses.push(`[Error: ${(e as Error).message}]`);
				messages.push({ role: 'assistant', content: responses[responses.length - 1] });
			}
		}

		if (!signal?.aborted) {
			const key = getEvalKey(conv.id, tier.modelId);
			state.evalResults[key] = {
				conversationId: conv.id,
				modelId: tier.modelId,
				responses,
				cachedAt: new Date().toISOString()
			};
			state.evalProgress.done++;
			saveW3();
		}
	}

	state.evalProgress = { running: false, current: '', total: 0, done: 0 };
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
	const modelIds = allTiers.map((t) => t.modelId);
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
			weightedAdequacy: adequacyRate, // simplified: no frequency weights yet
			meetsThreshold:
				adequacyRate >= 0.8 && criticalFailureRate <= 0.1
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
