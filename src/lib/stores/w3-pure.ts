/**
 * Pure helpers for Worksheet 3. No Svelte runtime, no IndexedDB, no network.
 * Everything here is deterministic and unit-testable in plain node.
 */

export interface ConversationTurnLike {
	role: string;
	content: string;
}

export interface EvalResultLike {
	responses: string[];
}

/** FNV-ish hash-based shuffle. Stable for a given seed, so revisiting the
 * same (conversation, turn) shows the same A/B/C/D ordering. */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
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

/** Build the message history for replaying turn `turnIndex` of a conversation
 * against a model, given previously-cached assistant responses for turns
 * 0..turnIndex-1. Pushes the user turn at `turnIndex` as the trailing
 * message so the model continues the conversation. */
export function buildReplayMessages(
	userTurns: ConversationTurnLike[],
	preserved: string[],
	turnIndex: number
): Array<{ role: string; content: string }> {
	const messages: Array<{ role: string; content: string }> = [];
	for (let i = 0; i < turnIndex; i++) {
		messages.push({ role: 'user', content: userTurns[i].content });
		messages.push({ role: 'assistant', content: preserved[i] ?? '' });
	}
	messages.push({ role: 'user', content: userTurns[turnIndex].content });
	return messages;
}

/** How many turns are generated for a conversation, across every model the
 * UI cares about. A turn counts as generated only when every model has an
 * entry at that turn index — missing models or short arrays drag the count
 * down. Returns 0 if no models are supplied. */
export function computeGeneratedTurnCount(
	evalResults: Record<string, EvalResultLike>,
	convId: string,
	selectedModelIds: string[]
): number {
	if (selectedModelIds.length === 0) return 0;
	let minCount = Number.POSITIVE_INFINITY;
	for (const modelId of selectedModelIds) {
		const key = `${convId}:${modelId}`;
		const result = evalResults[key];
		const count = result ? result.responses.length : 0;
		if (count < minCount) minCount = count;
	}
	return minCount === Number.POSITIVE_INFINITY ? 0 : minCount;
}

/** Whether the conversation has at least one turn that hasn't been generated
 * yet. totalUserTurns is the conversation's declared user-turn count. */
export function hasMoreTurnsToGenerate(
	generatedTurnCount: number,
	totalUserTurns: number
): boolean {
	return generatedTurnCount < totalUserTurns;
}

/** Estimate tokens for a single turn across N tiers. Rough: token ≈ char/4,
 * plus a buffer for the response. This matches the pre-existing cost-preview
 * approximation so UI numbers stay consistent. */
export function estimateTurnTokens(userTurnContent: string, tierCount: number): number {
	return Math.max(100, Math.round(userTurnContent.length / 4) + 500) * tierCount;
}
