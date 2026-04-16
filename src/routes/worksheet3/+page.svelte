<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { modelTiers, hardwareTiers } from '$lib/data/tiers';
	import { classifiedCategories } from '$lib/data/principles';
	import { loadW1, computeTotalLoss } from '$lib/stores/worksheet1.svelte';
	import { loadW2, computeAdjustedWtp } from '$lib/stores/worksheet2.svelte';
	import {
		getW3State,
		loadW3,
		isW3Loaded,
		toggleConversation,
		toggleTier,
		runInitialBatch,
		expandConversationTurn,
		retryCandidateTurn,
		getGeneratedTurnCount,
		hasMoreTurns,
		isConversationExpanding,
		getConversationExpansion,
		getOrCreateTurnRating,
		getRatedTurnCount,
		firstUnratedTurn,
		setRating,
		revealTurn,
		computeMetrics,
		deleteCustomConversation,
		setCustomOpeningPrompt,
		appendCustomTurn,
		runCustomTurn,
		CUSTOM_TURN_CAP,
		LOW_CONFIDENCE_THRESHOLD,
		personalMinimumTier,
		resolveModelId,
		setModelOverride,
		resetW3All,
		resetW3Responses,
		resetW3Ratings,
		rerunPairFromTurn,
		skipTurnForModel,
		unskipTurnForModel,
		isTurnSkipped,
		isTurnTruncated,
		setW3Settings,
		hasPrecisionMismatch,
		clearMismatchedCache,
		stampCachePrecision,
		precisionLabel,
		sendingAsSummary,
		resolveQuantizations,
		effectiveMaxContext
	} from '$lib/stores/worksheet3.svelte';
	import type { PrecisionBand } from '$lib/stores/worksheet3.svelte';

	function confirmReset(scope: 'all' | 'responses' | 'ratings') {
		const messages = {
			all: 'Clear ALL of Worksheet 3 — conversations, tiers, model overrides, LLM responses, and your ratings. Continue?',
			responses:
				'Clear all LLM responses (and your ratings, since they reference the responses). Conversation and tier selections stay. You will need to re-run the evaluation. Continue?',
			ratings:
				'Clear all your ratings but keep the cached LLM responses. You can re-rate without paying for API calls again. Continue?'
		};
		if (!confirm(messages[scope])) return;
		if (scope === 'all') resetW3All();
		else if (scope === 'responses') resetW3Responses();
		else resetW3Ratings();
		showRating = false;
		ratingConvIndex = 0;
		ratingTurnIndex = 0;
	}
	import bundleData from '$lib/data/curated-conversations.json';
	import WorkflowFooter from '$lib/components/WorkflowFooter.svelte';
	import SummaryCard from '$lib/components/SummaryCard.svelte';

	const bundle = bundleData as {
		version: number;
		conversations: Array<{
			id: string;
			source: { dataset: string; license: string };
			category: string;
			complexity: string;
			summary: string;
			turns: Array<{ role: string; content: string }>;
			metadata: { turnCount: number; estimatedTokens: number; tags: string[] };
		}>;
	};

	let apiKey = $state('');
	let keyVerified = $state(false);
	let keyError = $state('');
	let verifying = $state(false);
	let categoryFilter = $state('all');
	let evalStatus = $state('');
	let abortController: AbortController | null = null;

	// Rating UI state
	let ratingConvIndex = $state(0);
	let ratingTurnIndex = $state(0);
	let showRating = $state(false);

	// SPEC-013: precision band cache-invalidation modal state
	let precisionModalOpen = $state(false);
	let pendingPrecisionBand = $state<PrecisionBand | null>(null);

	// SPEC-013: no-provider error recovery modal state
	let noProviderModalOpen = $state(false);

	// SPEC-013: handle precision band change with cache invalidation check
	function handlePrecisionBandChange(band: PrecisionBand) {
		if (hasPrecisionMismatch(band)) {
			pendingPrecisionBand = band;
			precisionModalOpen = true;
		} else {
			setW3Settings({ precisionBand: band });
		}
	}

	function confirmClearCache() {
		if (!pendingPrecisionBand) return;
		setW3Settings({ precisionBand: pendingPrecisionBand });
		clearMismatchedCache();
		pendingPrecisionBand = null;
		precisionModalOpen = false;
	}

	function confirmKeepCacheMismatch() {
		if (!pendingPrecisionBand) return;
		setW3Settings({ precisionBand: pendingPrecisionBand });
		stampCachePrecision();
		pendingPrecisionBand = null;
		precisionModalOpen = false;
	}

	function cancelPrecisionModal() {
		pendingPrecisionBand = null;
		precisionModalOpen = false;
	}

	// SPEC-013: Custom conversation draft UI state
	let customEnabled = $state(false);
	let customDraft = $state('');
	let customPriorDraft = $state('');
	let customWarningAck = $state(false); // reset per session (component mount)
	let customWarningOpen = $state(false);
	let customPendingDraft = $state('');

	/** Fallback band for the no-provider recovery modal (one step up from current). */
	function fallbackBand(current: PrecisionBand): PrecisionBand | null {
		if (current === 'local') return 'balanced';
		if (current === 'balanced') return 'frontier';
		return null; // already at frontier, no fallback
	}

	function confirmNoProviderFallback() {
		const w3 = getW3State();
		const next = fallbackBand(w3.w3Settings.precisionBand);
		if (next) setW3Settings({ precisionBand: next });
		noProviderModalOpen = false;
	}

	function dismissNoProviderModal() {
		noProviderModalOpen = false;
	}

	// SPEC-007: derivations referenced by the Custom card (keeps DOM scope clean)
	let customConv = $derived(getW3State().customConversation);
	let customSelected = $derived(
		!!customConv && getW3State().selectedConversations.includes(customConv.id)
	);
	let customCached = $derived(
		!!customConv &&
			(Object.keys(getW3State().evalResults).some((k) => k.startsWith(customConv!.id + ':')) ||
				getW3State().turnRatings.some((tr) => tr.conversationId === customConv!.id))
	);

	/**
	 * SPEC-007 AC #3/#4: intercept textarea edits. If cached results exist
	 * for the active custom conversation and the rater hasn't yet acknowledged
	 * the warning this session, open the modal instead of accepting the edit.
	 * The modal's confirm/cancel path finalizes the state change.
	 */
	function handleCustomDraftInput(e: Event) {
		const next = (e.target as HTMLTextAreaElement).value;
		if (customCached && !customWarningAck) {
			customPendingDraft = next;
			customDraft = customPriorDraft; // revert in the DOM until confirmed
			customWarningOpen = true;
			return;
		}
		customDraft = next;
		customPriorDraft = next;
	}

	function confirmCustomWarning() {
		if (customConv) {
			deleteCustomConversation();
		}
		customDraft = customPendingDraft;
		customPriorDraft = customPendingDraft;
		customWarningAck = true;
		customWarningOpen = false;
		customPendingDraft = '';
	}

	function cancelCustomWarning() {
		customDraft = customPriorDraft;
		customWarningOpen = false;
		customPendingDraft = '';
	}

	// SPEC-007: Custom conversation next-turn input state
	let customNextTurnInput = $state('');

	/**
	 * Cost-preview gate for a custom turn. Returns true when the rater
	 * approves, false when they cancel. Mirrors the confirm-before-action
	 * pattern already used for resets.
	 */
	function approveCustomTurnCost(newUserText: string, turnIndex: number): boolean {
		const tiers = modelTiers.filter(
			(t) => getW3State().selectedTierIds.includes(t.id) || t.isAnchor
		);
		const custom = getW3State().customConversation;
		// Rough transcript tokens: 4 chars ≈ 1 token.
		const priorUserChars = (custom?.turns ?? []).reduce(
			(sum, t) => sum + (t.content?.length ?? 0),
			0
		);
		const estTokensPerTier = Math.ceil((priorUserChars + newUserText.length) / 4);
		const totalEstTokens = estTokensPerTier * tiers.length;
		const msg = `Turn ${turnIndex + 1}: ~${estTokensPerTier.toLocaleString()} tokens × ${tiers.length} tier${tiers.length === 1 ? '' : 's'} ≈ ${totalEstTokens.toLocaleString()} tokens to OpenRouter. Continue?`;
		return confirm(msg);
	}

	/**
	 * Launch the Custom conversation — commits draft as the opening prompt
	 * and fans out to every active tier. Opens the rating UI on turn 1.
	 */
	async function startCustomEvaluation() {
		if (!customDraft.trim()) return;
		if (!approveCustomTurnCost(customDraft.trim(), 0)) return;
		// If a prior custom conv exists with cached results, deleteCustomConversation
		// has already run (via the warning modal). For the fresh-path or post-confirm
		// case, just commit the current draft.
		setCustomOpeningPrompt(customDraft.trim());
		const customId = getW3State().customConversation!.id;
		abortController = new AbortController();
		evalStatus = 'Starting custom evaluation…';
		try {
			await runCustomTurn(0, (msg) => (evalStatus = msg), abortController.signal);
			evalStatus = 'Custom turn 1 complete.';
			// Land the rater on turn 1 of the new custom conv.
			const w3 = getW3State();
			const selected = bundle.conversations.filter((c) => w3.selectedConversations.includes(c.id));
			// Custom conv isn't in bundle, so find by id scanning selectedConversations.
			const customIdxInSelected = w3.selectedConversations.indexOf(customId);
			ratingConvIndex = customIdxInSelected >= 0 ? selected.length : 0;
			ratingTurnIndex = 0;
			showRating = true;
		} catch (e) {
			evalStatus = `Error: ${(e as Error).message}`;
		}
		abortController = null;
	}

	/**
	 * Submit the next user message for the active custom conversation.
	 * Appends the user turn and fans out to each tier for that turn.
	 */
	async function submitCustomNextTurn() {
		const text = customNextTurnInput.trim();
		if (!text) return;
		const custom = getW3State().customConversation;
		if (!custom) return;
		const currentUserTurns = custom.turns.filter((t) => t.role === 'user').length;
		if (currentUserTurns >= CUSTOM_TURN_CAP) return;
		if (!approveCustomTurnCost(text, currentUserTurns)) return;
		appendCustomTurn('user', text);
		customNextTurnInput = '';
		const newTurnIdx = currentUserTurns; // 0-based index of the newly added turn
		abortController = new AbortController();
		try {
			await runCustomTurn(newTurnIdx, (msg) => (evalStatus = msg), abortController.signal);
			evalStatus = `Custom turn ${newTurnIdx + 1} complete.`;
			ratingTurnIndex = newTurnIdx;
		} catch (e) {
			evalStatus = `Error: ${(e as Error).message}`;
		}
		abortController = null;
	}

	let w1Total = $derived(computeTotalLoss());
	let w2Total = $derived(computeAdjustedWtp());
	let combined = $derived(w1Total + w2Total);
	let metrics = $derived(computeMetrics());
	let hasRatings = $derived(metrics.some((m) => m.adequacyRate > 0));

	let filteredConversations = $derived(
		categoryFilter === 'all'
			? bundle.conversations
			: bundle.conversations.filter((c) => c.complexity === categoryFilter)
	);

	onMount(async () => {
		await Promise.all([loadW1(), loadW2(), loadW3()]);
		const saved = sessionStorage.getItem('openrouter-key');
		if (saved) {
			apiKey = saved;
			keyVerified = true;
		}
		// SPEC-007: restore the Custom card's draft from any persisted conv
		const persistedCustom = getW3State().customConversation;
		if (persistedCustom) {
			customDraft = persistedCustom.openingPrompt;
			customPriorDraft = persistedCustom.openingPrompt;
		}
		resumeRatingIfInProgress();
	});

	// SPEC-006 AC #4 + SPEC-007: on reload, re-enter the rating UI at the
	// last rated turn across the selection — curated AND custom.
	function resumeRatingIfInProgress() {
		const w3 = getW3State();
		if (w3.turnRatings.length === 0) return;
		const selected: Array<{ id: string; turns: Array<{ role: string; content: string }> }> = [
			...bundle.conversations.filter((c) => w3.selectedConversations.includes(c.id)),
			...(w3.customConversation && w3.selectedConversations.includes(w3.customConversation.id)
				? [w3.customConversation]
				: [])
		];
		if (selected.length === 0) return;

		let targetIdx = selected.length - 1;
		for (let i = 0; i < selected.length; i++) {
			const conv = selected[i];
			const total = conv.turns.filter((t) => t.role === 'user').length;
			if (getRatedTurnCount(conv.id) < total) {
				targetIdx = i;
				break;
			}
		}
		const targetConv = selected[targetIdx];
		const total = targetConv.turns.filter((t) => t.role === 'user').length;
		ratingConvIndex = targetIdx;
		ratingTurnIndex = firstUnratedTurn(targetConv.id, total);
		showRating = true;
	}

	async function verifyKey() {
		verifying = true;
		keyError = '';
		try {
			const resp = await fetch('https://openrouter.ai/api/v1/models', {
				headers: { Authorization: `Bearer ${apiKey}` }
			});
			if (resp.ok) {
				keyVerified = true;
				sessionStorage.setItem('openrouter-key', apiKey);
			} else {
				keyError = `Verification failed (${resp.status}). Check your key.`;
			}
		} catch {
			keyError = 'Network error. Check your connection.';
		}
		verifying = false;
	}

	function formatDollar(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}

	function categoryLabel(id: string): string {
		return classifiedCategories.find((c) => c.id === id)?.label ?? id;
	}

	const labels = ['A', 'B', 'C', 'D', 'E'];
	const ratingLabels: Record<number, string> = {
		4: 'Fully adequate',
		3: 'Usable with minor cleanup',
		2: 'Insufficient but directional',
		1: 'Unusable'
	};

	async function startEvaluation() {
		const w3 = getW3State();
		const selected = bundle.conversations.filter((c) =>
			w3.selectedConversations.includes(c.id)
		);
		if (selected.length === 0) return;

		abortController = new AbortController();
		evalStatus = 'Starting initial batch (turn 1 only)…';
		try {
			await runInitialBatch(selected, (msg: string) => (evalStatus = msg), abortController.signal);
			evalStatus =
				'Initial batch complete. Open a conversation and click "Generate next turn" to go deeper.';
			showRating = true;
			ratingConvIndex = 0;
			ratingTurnIndex = 0;
		} catch (e) {
			evalStatus = `Error: ${(e as Error).message}`;
		}
		abortController = null;
	}

	/** Expansion preview + launch. Runs in the background — rater stays on
	 * the current conversation or can switch away. */
	let expansionStatus = $state('');

	async function requestExpansion(convId: string) {
		const w3 = getW3State();
		const conv = bundle.conversations.find((c) => c.id === convId);
		if (!conv) return;
		if (isConversationExpanding(convId)) return;

		const userTurns = conv.turns.filter((t) => t.role === 'user');
		const nextTurnIdx = getGeneratedTurnCount(convId);
		if (nextTurnIdx >= userTurns.length) return;

		const activeTiers = modelTiers.filter(
			(t) => w3.selectedTierIds.includes(t.id) || t.isAnchor
		);
		const turnText = userTurns[nextTurnIdx].content ?? '';
		const estTokens = Math.max(100, Math.round(turnText.length / 4) + 500) * activeTiers.length;
		const ok = confirm(
			`Generate turn ${nextTurnIdx + 1} of ${userTurns.length} for this conversation across ${
				activeTiers.length
			} tier${activeTiers.length === 1 ? '' : 's'}.\n\n` +
				`Estimated tokens: ~${estTokens.toLocaleString()}\n` +
				`Estimated time: ~${Math.max(5, activeTiers.length * 5)} seconds\n\n` +
				`This will hit the OpenRouter API. Continue?`
		);
		if (!ok) return;

		const expansionAbort = new AbortController();
		expansionStatus = `Generating turn ${nextTurnIdx + 1} for ${conv.id.slice(0, 14)}…`;
		try {
			await expandConversationTurn(
				conv,
				(msg: string) => (expansionStatus = msg),
				expansionAbort.signal
			);
			expansionStatus = `Turn ${nextTurnIdx + 1} generated.`;
		} catch (e) {
			expansionStatus = `Error: ${(e as Error).message}`;
		}
	}

	async function retryCandidate(convId: string, modelId: string, turnIndex: number) {
		const conv = bundle.conversations.find((c) => c.id === convId);
		if (!conv) return;
		const tier = modelTiers.find((t) => resolveModelId(t) === modelId || t.modelId === modelId);
		if (!tier) return;
		const ctrl = new AbortController();
		try {
			const result = await retryCandidateTurn(conv, tier, turnIndex, ctrl.signal);
			if (result === 'ok') {
				evalStatus = `Retry succeeded for ${tier.label} turn ${turnIndex + 1}.`;
			} else if (result === 'failed') {
				evalStatus = `Retry failed for ${tier.label} turn ${turnIndex + 1}. See errors list.`;
			}
		} catch (e) {
			evalStatus = `Error: ${(e as Error).message}`;
		}
	}

	/**
	 * Re-run a (conversation × model) pair starting from the turn the user
	 * is currently rating. Turns before the current index keep their cached
	 * responses and ratings; the model sees those preserved turns as
	 * context when regenerating from the current turn forward. Only ratings
	 * for the same model at turns >= current are dropped.
	 */
	async function rerunPair(convId: string, modelId: string) {
		if (getW3State().evalProgress.running) return;
		const conv = bundle.conversations.find((c) => c.id === convId);
		if (!conv) return;
		const tier = modelTiers.find((t) => resolveModelId(t) === modelId || t.modelId === modelId);
		if (!tier) return;

		abortController = new AbortController();
		try {
			await rerunPairFromTurn(conv, tier, ratingTurnIndex, abortController.signal);
			evalStatus = `Re-run complete from turn ${ratingTurnIndex + 1}.`;
		} catch (e) {
			evalStatus = `Error: ${(e as Error).message}`;
		}
		abortController = null;
	}

	function cancelEvaluation() {
		abortController?.abort();
		evalStatus = 'Cancelled.';
	}
</script>

{#if !isW3Loaded()}
	<div class="container"><p>Loading...</p></div>
{:else}
	{@const w3 = getW3State()}

	<div class="container-with-margin">
		<aside class="title-panel">
			<h1>Worksheet 3: Capability Evaluation</h1>
			<p>
				Blind-test local models against a frontier baseline to find your personal minimum
				adequate tier.
			</p>

			<SummaryCard
				label="Selection"
				value={w3.selectedConversations.length}
				valueSuffix=" conversations"
				breakdown={[{ label: 'Tiers to test (incl. anchor)', value: modelTiers.filter((t) => w3.selectedTierIds.includes(t.id) || t.isAnchor).length }]}
				tierValue={combined}
			>
				<h3 style="margin-top: 1rem;">Reset W3</h3>
				<div style="display: flex; flex-direction: column; gap: 0.35rem;">
					<button
						class="secondary"
						style="font-size: 0.7rem; padding: 0.35rem 0.5rem; text-align: left; color: var(--color-text-muted);"
						onclick={() => confirmReset('ratings')}
						disabled={w3.turnRatings.length === 0}
					>
						Clear ratings only
					</button>
					<button
						class="secondary"
						style="font-size: 0.7rem; padding: 0.35rem 0.5rem; text-align: left; color: var(--color-text-muted);"
						onclick={() => confirmReset('responses')}
						disabled={Object.keys(w3.evalResults).length === 0}
					>
						Clear LLM responses
					</button>
					<button
						class="secondary"
						style="font-size: 0.7rem; padding: 0.35rem 0.5rem; text-align: left; color: var(--color-danger); border-color: var(--color-danger);"
						onclick={() => confirmReset('all')}
					>
						Clear ALL W3 data
					</button>
				</div>
				<p class="small-note" style="margin-top: 0.5rem; font-size: 0.65rem;">
					Each scope resets your results. Ratings-only keeps cached responses so
					re-rating is free.
				</p>
			</SummaryCard>
		</aside>

		<main>

	<!-- API Key -->
	<div class="card" style="margin-top: 1rem;">
		<h2>OpenRouter API Key</h2>
		<p class="muted">
			Worksheet 3 sends conversations to OpenRouter for evaluation. You need an API key with ZDR enabled.
		</p>
		{#if keyVerified}
			<span class="badge go" style="font-size: 0.875rem;">Key verified</span>
			<button class="secondary" style="margin-left: 0.5rem; font-size: 0.75rem;" onclick={() => { keyVerified = false; apiKey = ''; sessionStorage.removeItem('openrouter-key'); }}>
				Change key
			</button>
		{:else}
			<div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
				<input type="password" placeholder="sk-or-..." bind:value={apiKey} style="flex: 1;" />
				<button class="primary" onclick={verifyKey} disabled={verifying || !apiKey}>
					{verifying ? 'Verifying...' : 'Verify'}
				</button>
			</div>
			{#if keyError}
				<p style="color: var(--color-danger); font-size: 0.875rem; margin-top: 0.5rem;">{keyError}</p>
			{/if}
			<p class="muted" style="margin-top: 0.5rem; font-size: 0.75rem;">
				Your key is stored in this browser tab only and cleared when you close it.
			</p>
		{/if}
	</div>

	<!-- Tier Selection -->
	<div class="card">
		<h2>Model Tiers to Test</h2>
		<p class="muted">
			Select which tiers to include. Anchor tier is always included for baseline comparison.
			You can override any model ID — useful when a tier's default isn't ZDR-compliant under
			your OpenRouter settings.
		</p>
		<!-- Hardware legend table -->
		<div style="overflow-x: auto; margin-bottom: 1rem;">
			<table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
				<thead>
					<tr style="border-bottom: 1px solid var(--border, #e5e7eb);">
						<th style="text-align: left; padding: 0.35rem 0.5rem; font-weight: 600;">Tier</th>
						<th style="text-align: left; padding: 0.35rem 0.5rem; font-weight: 600;">Model</th>
						<th style="text-align: right; padding: 0.35rem 0.5rem; font-weight: 600;">Peak RAM</th>
						<th style="text-align: left; padding: 0.35rem 0.5rem; font-weight: 600;">Min hw</th>
						<th style="text-align: left; padding: 0.35rem 0.5rem; font-weight: 600;">Comfortable hw</th>
						<th style="text-align: center; padding: 0.35rem 0.5rem; font-weight: 600;">Cloud-only?</th>
					</tr>
				</thead>
				<tbody>
					{#each modelTiers as tier}
						{@const minHw = hardwareTiers.find((h) => h.id === tier.minHardwareTierId)}
						{@const comfHw = tier.comfortableHardwareTierId
							? hardwareTiers.find((h) => h.id === tier.comfortableHardwareTierId)
							: null}
						{@const isCloud = tier.minHardwareTierId === 'cloud'}
						<tr style="border-bottom: 1px solid var(--border-subtle, #f3f4f6);">
							<td style="padding: 0.3rem 0.5rem; font-weight: 500;">{tier.label}</td>
							<td style="padding: 0.3rem 0.5rem; font-family: monospace; font-size: 0.72rem; color: var(--muted, #6b7280);">{tier.modelId}</td>
							<td style="padding: 0.3rem 0.5rem; text-align: right;">
								{#if isCloud}
									<span class="muted">—</span>
								{:else}
									{tier.peakRamGB} GB
								{/if}
							</td>
							<td style="padding: 0.3rem 0.5rem;">
								{#if isCloud}
									<span class="muted">Cloud only</span>
								{:else}
									{minHw?.label ?? tier.minHardwareTierId}
								{/if}
							</td>
							<td style="padding: 0.3rem 0.5rem;">
								{#if isCloud}
									<span class="muted">Cloud only</span>
								{:else if comfHw}
									{comfHw.label}
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td style="padding: 0.3rem 0.5rem; text-align: center;">
								{#if isCloud}✓{:else}—{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<details style="margin-bottom: 1rem; font-size: 0.8rem;">
			<summary style="cursor: pointer; font-weight: 500; color: var(--muted, #6b7280); user-select: none;">Methodology</summary>
			<div style="margin-top: 0.5rem; padding: 0.75rem; background: var(--surface-subtle, #f9fafb); border-radius: 6px; line-height: 1.5;">
				<p style="margin: 0 0 0.5rem;">RAM figures assume <strong>5 concurrent users</strong>, each with a <strong>128K-token context window</strong>, running 4-bit MLX quantization on Apple Silicon.</p>
				<p style="margin: 0 0 0.5rem;">Formula: <code>peak RAM = weights (4-bit) + KV cache × 5 users + OS overhead</code>. KV cache per session is computed from the model's full-attention layer count, KV heads, and head dimension.</p>
				<p style="margin: 0;">Source: trove <code>apple-silicon-model-tier-ram@d681e07</code>. Figures marked with "est." carry a ±30% uncertainty band; see trove for details.</p>
			</div>
		</details>

		{#each modelTiers as tier}
			{@const checked = tier.isAnchor || w3.selectedTierIds.includes(tier.id)}
			{@const currentId = resolveModelId(tier)}
			{@const isOverridden = currentId !== tier.modelId}
			<div
				class="checkbox-card"
				class:selected={checked}
				style="margin-bottom: 0.5rem; flex-direction: column; align-items: stretch;"
			>
				<label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer;">
					<input
						type="checkbox"
						{checked}
						disabled={tier.isAnchor}
						onchange={() => toggleTier(tier.id)}
					/>
					<div style="flex: 1; min-width: 0;">
						<div style="font-weight: 500;">
							{tier.label}{tier.isAnchor ? ' (baseline)' : ''}
							{#if isOverridden}
								<span class="badge warn">overridden</span>
							{/if}
						</div>
						{#if tier.note}
							<div class="muted" style="font-size: 0.75rem; margin-top: 0.25rem;">
								{tier.note}
							</div>
						{/if}
					</div>
				</label>
				<div
					style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; margin-left: 1.75rem;"
				>
					<label class="muted" style="font-size: 0.7rem; white-space: nowrap;" for="model-{tier.id}">
						Model ID:
					</label>
					<input
						id="model-{tier.id}"
						type="text"
						value={currentId}
						onchange={(e) => {
							const v = (e.target as HTMLInputElement).value;
							setModelOverride(tier.id, v === tier.modelId ? null : v);
						}}
						style="font-family: monospace; font-size: 0.75rem; flex: 1;"
					/>
					{#if isOverridden}
						<button
							class="secondary"
							style="font-size: 0.7rem; padding: 0.2rem 0.5rem;"
							onclick={() => setModelOverride(tier.id, null)}
						>
							reset
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- SPEC-013: Precision and Context Settings -->
	<div class="card">
		<h2>Evaluation Settings</h2>
		<p class="muted">
			These settings control how W3 calls OpenRouter. Match local MLX 4-bit + 128K context
			are the defaults for a fair local-vs-cloud comparison.
		</p>

		<div style="display: flex; flex-wrap: wrap; gap: 2rem; margin-top: 0.75rem;">
			<!-- Precision band -->
			<fieldset style="border: none; padding: 0; margin: 0; min-width: 200px;">
				<legend style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem;">Precision band</legend>
				{#each [
					{ value: 'local', label: 'Match local MLX 4-bit', desc: 'fp4/int4' },
					{ value: 'balanced', label: 'Balanced', desc: 'fp8' },
					{ value: 'frontier', label: 'Frontier quality', desc: 'bf16/fp16' }
				] as opt}
					<label style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem; cursor: pointer; font-size: 0.85rem;">
						<input
							type="radio"
							name="precision-band"
							value={opt.value}
							checked={w3.w3Settings.precisionBand === opt.value}
							onchange={() => handlePrecisionBandChange(opt.value as PrecisionBand)}
							style="margin-top: 0.15rem;"
						/>
						<span>
							{opt.label}
							<span class="muted" style="font-size: 0.75rem;">({opt.desc})</span>
						</span>
					</label>
				{/each}
			</fieldset>

			<!-- Max context -->
			<fieldset style="border: none; padding: 0; margin: 0; min-width: 200px;">
				<legend style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem;">Max context</legend>
				{#each [
					{ value: 8192, label: 'Conservative 8K' },
					{ value: 32768, label: 'Long 32K' },
					{ value: 131072, label: 'Target 128K' }
				] as opt}
					<label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; cursor: pointer; font-size: 0.85rem;">
						<input
							type="radio"
							name="max-context"
							value={opt.value}
							checked={w3.w3Settings.maxContext === opt.value}
							onchange={() => setW3Settings({ maxContext: opt.value })}
						/>
						{opt.label}
					</label>
				{/each}
			</fieldset>
		</div>

		<div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: var(--color-bg); border-radius: var(--radius); font-size: 0.8rem; color: var(--color-text-muted);">
			Active: <strong>{sendingAsSummary()}</strong> — applies to all candidate tiers. Anchor stays at Anthropic default. gpt-oss-120b is MXFP4 native; glm-4.6 and llama-4-maverick serve fp8 only — all three ignore the band selection.
		</div>
	</div>

	<!-- Conversation Selection: Path 1 -->
	<div class="card">
		<h2>Select Conversations</h2>
		<p class="muted">
			{bundle.conversations.length} curated conversations from WildBench and MT-Bench (CC-BY-4.0).
			{w3.selectedConversations.length} selected.
		</p>

		<div style="margin: 0.75rem 0;">
			<select bind:value={categoryFilter}>
				<option value="all">All conversations</option>
				<option value="routine">Routine complexity only</option>
				<option value="moderate">Moderate complexity only</option>
				<option value="hard">Hard complexity only</option>
			</select>
			<span class="muted" style="font-size: 0.75rem; margin-left: 0.5rem;">
				Conversations are from WildBench and MT-Bench. Scan the content to pick ones close to
				your real use cases.
			</span>
		</div>

		<div class="checkbox-grid">
			<!-- SPEC-007: Custom conversation card (always first) -->
			<div
				class="checkbox-card conversation-card"
				class:selected={customSelected}
				data-custom-card
				style="display: flex; gap: 0.5rem; align-items: flex-start;"
			>
				<input
					type="checkbox"
					checked={customSelected}
					disabled={!customConv}
					onchange={() => customConv && toggleConversation(customConv.id)}
					title={customConv ? 'Include this custom conversation in evaluation' : 'Write and save an opening prompt first'}
					aria-label="Include custom conversation in evaluation"
				/>
				<div style="font-size: 0.8rem; min-width: 0; flex: 1;">
					<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
						<strong>Custom</strong>
						<span class="badge">BYO prompt</span>
						{#if customCached}
							<span class="badge go">cached</span>
						{/if}
						{#if customConv}
							{@const customUserTurns = customConv.turns.filter((t) => t.role === 'user').length}
							{@const customRated = getRatedTurnCount(customConv.id)}
							{#if customRated > 0}
								<span
									class="badge {customRated === customUserTurns ? 'go' : ''}"
									data-rating-progress-conv={customConv.id}
									title="Turns rated / total user turns"
								>
									{customRated}/{customUserTurns} rated
								</span>
							{/if}
						{/if}
					</div>
					<label
						for="custom-enable-checkbox"
						style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; margin-bottom: 0.35rem; cursor: pointer;"
					>
						<input
							id="custom-enable-checkbox"
							type="checkbox"
							bind:checked={customEnabled}
							data-custom-enable-checkbox
						/>
						Enable editing
					</label>
					<textarea
						rows="4"
						placeholder="Write your opening prompt. Each selected tier will respond to this, then you can continue the chat up to five rater turns."
						value={customDraft}
						oninput={handleCustomDraftInput}
						readonly={!customEnabled}
						data-custom-textarea
						aria-label="Custom conversation opening prompt"
						style="width: 100%; font-size: 0.78rem; padding: 0.5rem; border-radius: var(--radius); border: 1px solid var(--color-border); background: {customEnabled ? 'var(--color-surface)' : 'var(--color-bg)'}; color: inherit; resize: vertical; font-family: inherit;"
					></textarea>
					<div
						class="muted"
						style="margin-top: 0.4rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; font-size: 0.7rem;"
					>
						<span>~{Math.max(1, Math.ceil(customDraft.length / 4)).toLocaleString()} tokens (draft)</span>
						<span>up to {CUSTOM_TURN_CAP} rater turns</span>
						{#if customConv}
							<span title={customConv.id}>id: {customConv.id}</span>
						{/if}
					</div>
					{#if keyVerified}
						<div style="margin-top: 0.5rem; display: flex; gap: 0.4rem; flex-wrap: wrap;">
							<button
								type="button"
								class="primary"
								style="font-size: 0.72rem; padding: 0.35rem 0.7rem;"
								data-custom-start
								disabled={!customDraft.trim() || w3.evalProgress.running}
								onclick={startCustomEvaluation}
								title="Sending as {sendingAsSummary()}"
							>
								{customConv ? 'Re-run turn 1' : 'Start custom evaluation'}
							</button>
							{#if customConv}
								<button
									type="button"
									class="secondary"
									style="font-size: 0.72rem; padding: 0.35rem 0.7rem; color: var(--color-danger); border-color: var(--color-danger);"
									onclick={() => {
										if (confirm('Delete the custom conversation along with its responses and ratings?')) {
											deleteCustomConversation();
											customDraft = '';
											customPriorDraft = '';
											customEnabled = false;
										}
									}}
								>
									Delete custom
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
			{#each filteredConversations as conv}
				{@const selected = w3.selectedConversations.includes(conv.id)}
				{@const firstUserTurn = conv.turns.find((t) => t.role === 'user')?.content ?? ''}
				{@const convUserTurns = conv.turns.filter((t) => t.role === 'user').length}
				{@const convRated = getRatedTurnCount(conv.id)}
				<label class="checkbox-card conversation-card" class:selected>
					<input
						type="checkbox"
						checked={selected}
						onchange={() => toggleConversation(conv.id)}
					/>
					<div style="font-size: 0.8rem; min-width: 0; flex: 1;">
						<div class="conversation-preview">{firstUserTurn}</div>
						<div
							class="muted"
							style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;"
						>
							<span class="badge {conv.complexity === 'hard' ? 'warn' : conv.complexity === 'routine' ? 'go' : 'skip'}">
								{conv.complexity}
							</span>
							<span>{conv.metadata.turnCount} turns</span>
							<span>~{conv.metadata.estimatedTokens.toLocaleString()} tokens</span>
							{#if getGeneratedTurnCount(conv.id) > 0}
								<span class="badge go">
									{getGeneratedTurnCount(conv.id)}/{conv.turns.filter((t) => t.role === 'user').length} turns generated
								</span>
							{/if}
							{#if convRated > 0}
								<span
									class="badge {convRated === convUserTurns ? 'go' : ''}"
									data-rating-progress-conv={conv.id}
									title="Turns rated / total user turns"
								>
									{convRated}/{convUserTurns} rated
								</span>
							{/if}
						</div>
					</div>
				</label>
			{/each}
		</div>
	</div>

	<!-- Evaluation Runner -->
	{#if w3.selectedConversations.length > 0 && keyVerified}
		{@const selectedConvs = bundle.conversations.filter((c) => w3.selectedConversations.includes(c.id))}
		{@const activeTiers = modelTiers.filter((t) => w3.selectedTierIds.includes(t.id) || t.isAnchor)}
		{@const pairsNeedingTurn1 = selectedConvs.flatMap((c) =>
			activeTiers
				.filter((t) => {
					const key = `${c.id}:${resolveModelId(t)}`;
					const existing = w3.evalResults[key];
					return !existing || existing.responses.length === 0;
				})
				.map((t) => ({ c, t }))
		)}
		{@const turn1Tokens = selectedConvs.reduce((s, c) => {
			const first = c.turns.find((t) => t.role === 'user')?.content ?? '';
			return s + Math.max(100, Math.round(first.length / 4) + 500);
		}, 0) * activeTiers.length}
		<div class="card">
			<h2>Evaluation</h2>
			<p class="muted">
				{selectedConvs.length} conversations × {activeTiers.length} tiers.
				{pairsNeedingTurn1.length > 0
					? `${pairsNeedingTurn1.length} pairs need turn 1.`
					: 'Turn 1 already generated for all pairs.'}
				Generating turn 1 only — later turns are generated on demand per conversation.
				Estimated tokens: ~{turn1Tokens.toLocaleString()}.
			</p>
			{#if w3.evalProgress.running}
				<div style="margin: 0.75rem 0;">
					<div
						style="height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden;"
					>
						<div
							style="height: 100%; width: {w3.evalProgress.total > 0
								? (w3.evalProgress.done / w3.evalProgress.total) * 100
								: 0}%; background: var(--color-primary); transition: width 0.3s;"
						></div>
					</div>
					<p class="muted" style="margin-top: 0.5rem; font-size: 0.85rem;">
						<strong>{w3.evalProgress.done}/{w3.evalProgress.total}</strong>
						pairs complete &middot;
						<strong>{w3.evalProgress.active.length}</strong> in flight
					</p>
				</div>

				<!-- Live per-worker view — one row per concurrent (conv × tier) pair.
				Same tier label can appear multiple times if different conversations are in flight. -->
				<div style="display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem;">
					{#each w3.evalProgress.active as pair (pair.pairKey)}
						{@const pct =
							pair.currentTurnTotal > 0
								? (pair.currentTurn / pair.currentTurnTotal) * 100
								: 0}
						<div
							style="display: grid; grid-template-columns: 200px 1fr 70px; gap: 0.5rem; align-items: center; font-size: 0.75rem;"
						>
							<span
								style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
								title="{pair.tierLabel} × {pair.convId}"
							>
								<strong>{pair.tierLabel}</strong>
								<span class="muted">×</span>
								<span style="font-family: monospace; font-size: 0.7rem;">{pair.convId.slice(0, 12)}</span>
							</span>
							<div
								style="height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden;"
							>
								<div
									style="height: 100%; width: {pct}%; background: var(--color-primary); transition: width 0.2s;"
								></div>
							</div>
							<span class="muted" style="font-size: 0.7rem; white-space: nowrap; text-align: right;">
								{pair.currentTurn}/{pair.currentTurnTotal}
							</span>
						</div>
					{/each}
					{#if w3.evalProgress.active.length === 0}
						<p class="muted" style="font-style: italic; font-size: 0.75rem;">
							Spinning up workers…
						</p>
					{/if}
				</div>

				<button class="secondary" onclick={cancelEvaluation}>Cancel</button>
				{#if w3.evalProgress.errors.length > 0}
					<div
						class="flag-card"
						style="margin-top: 0.75rem; max-height: 180px; overflow-y: auto;"
					>
						<strong>{w3.evalProgress.errors.length} error{w3.evalProgress.errors.length === 1 ? '' : 's'} so far:</strong>
						{#each w3.evalProgress.errors.slice(-5) as err}
							<div style="font-size: 0.75rem; margin-top: 0.25rem; font-family: monospace;">
								{err}
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<!-- SPEC-013 AC #10: "Sending as" summary line -->
				<p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-text-muted);">
					Sending as <strong>{sendingAsSummary()}</strong>
				</p>
				{#if pairsNeedingTurn1.length > 0}
					<button class="primary" data-testid="start-evaluation" onclick={startEvaluation} style="margin-top: 0.5rem;">
						Start Evaluation ({pairsNeedingTurn1.length} turn-1 API calls)
					</button>
				{:else}
					<p class="muted" style="margin-top: 0.5rem;">Turn 1 is ready for every selected conversation. Proceed to rating — request additional turns per conversation as needed.</p>
					<button class="primary" onclick={() => { showRating = true; ratingConvIndex = 0; ratingTurnIndex = 0; }} style="margin-top: 0.5rem;">
						Start Rating
					</button>
				{/if}
				{#if evalStatus}
					<p class="muted" style="margin-top: 0.5rem;">{evalStatus}</p>
				{/if}
				{#if w3.evalProgress.errors.length > 0}
					{@const hasNoProvider = w3.evalProgress.errors.some((e) => e.includes('[no-provider]'))}
					{#if hasNoProvider && !noProviderModalOpen}
						<div class="flag-card" style="margin-top: 0.75rem; border-color: var(--color-warn);">
							<strong>No provider available for the selected precision band.</strong>
							<p style="font-size: 0.8rem; margin: 0.4rem 0 0 0;">
								OpenRouter could not find a provider matching your precision band.
								You can fall back to the next-higher band and re-run.
							</p>
							<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
								<button class="primary" style="font-size: 0.78rem; padding: 0.35rem 0.7rem;" onclick={() => { noProviderModalOpen = true; }}>
									Fall back and re-run
								</button>
								<button class="secondary" style="font-size: 0.78rem; padding: 0.35rem 0.7rem;" onclick={() => noProviderModalOpen = false}>
									Dismiss
								</button>
							</div>
						</div>
					{/if}
					<div class="flag-card" style="margin-top: 0.75rem;">
						<strong>
							{w3.evalProgress.errors.length} error{w3.evalProgress.errors.length === 1
								? ''
								: 's'} occurred during evaluation:
						</strong>
						<div style="max-height: 200px; overflow-y: auto; margin-top: 0.5rem;">
							{#each w3.evalProgress.errors as err}
								<div style="font-size: 0.75rem; margin-top: 0.25rem; font-family: monospace;">
									{err}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Blind Rating UI -->
	{#if showRating}
		{@const ratedConvs = [
			...bundle.conversations.filter((c) => w3.selectedConversations.includes(c.id)),
			...(w3.customConversation && w3.selectedConversations.includes(w3.customConversation.id)
				? [w3.customConversation]
				: [])
		]}
		{#if ratedConvs.length > 0}
			{@const currentConv = ratedConvs[ratingConvIndex]}
			{@const userTurns = currentConv.turns.filter((t) => t.role === 'user')}
			{@const generatedForConv = getGeneratedTurnCount(currentConv.id)}
			{@const safeTurnIndex = Math.min(ratingTurnIndex, Math.max(0, generatedForConv - 1))}
			{@const convExpanding = isConversationExpanding(currentConv.id)}
			{@const convExpansion = getConversationExpansion(currentConv.id)}
			<!-- Conversation switcher with per-conv turn-generation progress.
			Raters can jump between conversations while one is expanding. -->
			<div class="card" style="margin-top: 1.5rem;" data-testid="conversation-switcher">
				<h2>Conversations</h2>
				<p class="muted">
					Jump between conversations to rate across the pool. Turn generation is on demand per conversation.
				</p>
				<div style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem;">
					{#each ratedConvs as rc, idx}
						{@const rcTurns = rc.turns.filter((t) => t.role === 'user').length}
						{@const rcGenerated = getGeneratedTurnCount(rc.id)}
						{@const rcExpanding = isConversationExpanding(rc.id)}
						{@const isCurrent = idx === ratingConvIndex}
						{@const rcLabel = 'summary' in rc ? rc.summary : 'openingPrompt' in rc ? rc.openingPrompt.slice(0, 80) : ''}
						<button
							class={isCurrent ? 'primary' : 'secondary'}
							data-testid="switcher-row"
							data-conv-id={rc.id}
							style="font-size: 0.75rem; padding: 0.4rem 0.6rem; text-align: left; display: flex; gap: 0.5rem; align-items: center;"
							onclick={() => { ratingConvIndex = idx; ratingTurnIndex = 0; }}
						>
							<span style="font-family: monospace; font-size: 0.7rem; flex: 0 0 auto;">{rc.id.slice(0, 14)}</span>
							<span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
								{rcLabel || rc.id}
							</span>
							<span class="badge {rcGenerated > 0 ? 'go' : 'skip'}" data-testid="generated-count">
								{rcGenerated}/{rcTurns} generated
							</span>
							{#if rcExpanding}
								<span class="badge warn" data-testid="expanding-indicator">
									generating turn {(getConversationExpansion(rc.id)?.turnIndex ?? 0) + 1}…
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if generatedForConv === 0}
				<div class="card" style="margin-top: 1.5rem;">
					<h2>Blind Rating</h2>
					<p class="muted">
						Turn 1 hasn't been generated for this conversation yet. Start the initial batch from the Evaluation section above, or pick a different conversation from the switcher.
					</p>
				</div>
			{:else}
			{@const turnRating = getOrCreateTurnRating(currentConv.id, safeTurnIndex)}
			{@const activeTiers = modelTiers.filter((t) => w3.selectedTierIds.includes(t.id) || t.isAnchor)}
			{@const atLastGeneratedTurn = safeTurnIndex >= generatedForConv - 1}
			{@const canExpand = hasMoreTurns(currentConv.id, userTurns.length)}
				<div class="card" style="margin-top: 1.5rem;">
					<h2>Blind Rating</h2>
					<p class="muted">
						Conversation {ratingConvIndex + 1} of {ratedConvs.length}, Turn {safeTurnIndex + 1}
						of {userTurns.length} — {generatedForConv} of {userTurns.length} turns generated.
					</p>
					{#if convExpanding && convExpansion}
						<div class="flag-card" data-testid="inflight-banner" style="margin-top: 0.5rem;">
							<strong>Generating turn {convExpansion.turnIndex + 1}…</strong>
							<div style="font-size: 0.75rem; margin-top: 0.3rem;">
								{#each convExpansion.tierProgress as tp}
									<span style="margin-right: 0.5rem;">
										{tp.tierLabel}: <em>{tp.status}</em>
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Conversation switcher (SPEC-006 AC #1, #5) -->
					{#if ratedConvs.length > 1}
						<div
							class="conv-switcher"
							aria-label="Switch conversation"
							style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0 1rem 0; padding: 0.5rem; background: var(--color-bg); border-radius: var(--radius);"
						>
							<span class="muted" style="font-size: 0.7rem; align-self: center; margin-right: 0.25rem;">
								Switch to:
							</span>
							{#each ratedConvs as conv, idx}
								{@const convUserTurns = conv.turns.filter((t) => t.role === 'user').length}
								{@const convRated = getRatedTurnCount(conv.id)}
								{@const isCurrent = idx === ratingConvIndex}
								<button
									type="button"
									class={isCurrent ? 'primary' : 'secondary'}
									style="font-size: 0.7rem; padding: 0.25rem 0.5rem;"
									title={conv.id}
									data-conv-id={conv.id}
									data-conv-rated={convRated}
									data-conv-total={convUserTurns}
									onclick={() => {
										ratingConvIndex = idx;
										ratingTurnIndex = firstUnratedTurn(conv.id, convUserTurns);
									}}
								>
									{conv.id.length > 24 ? conv.id.slice(0, 24) + '…' : conv.id}
									<span class="muted" style="margin-left: 0.35rem;">({convRated}/{convUserTurns})</span>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Context -->
					<div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius); margin: 0.75rem 0; max-height: 200px; overflow-y: auto;">
						<div class="muted" style="font-size: 0.75rem; margin-bottom: 0.5rem;">Conversation context:</div>
						{#each currentConv.turns.slice(0, safeTurnIndex * 2 + 1) as turn}
							<div style="margin-bottom: 0.5rem; padding: 0.5rem; border-radius: var(--radius); background: {turn.role === 'user' ? 'var(--color-primary-light)' : 'var(--color-surface)'};">
								<span class="muted" style="font-size: 0.7rem; text-transform: uppercase;">{turn.role}</span>
								<p style="font-size: 0.85rem; margin: 0;">{turn.content.slice(0, 300)}{turn.content.length > 300 ? '...' : ''}</p>
							</div>
						{/each}
					</div>

					<!-- User prompt for this turn -->
					<div style="padding: 0.75rem; background: var(--color-primary-light); border-radius: var(--radius); margin-bottom: 1rem;">
						<span class="muted" style="font-size: 0.7rem;">USER PROMPT</span>
						<p style="margin: 0; font-size: 0.9rem;">{userTurns[safeTurnIndex].content}</p>
					</div>

					<!-- Candidate responses -->
					{#each turnRating.labelOrder as modelId, labelIdx}
						{@const evalKey = `${currentConv.id}:${modelId}`}
						{@const evalResult = w3.evalResults[evalKey]}
						{@const response =
							evalResult?.responses[safeTurnIndex] ?? '[No response available]'}
						{@const isMissing = !evalResult}
						{@const isTruncated =
							isTurnTruncated(currentConv.id, modelId, safeTurnIndex) ||
							response.includes('[⚠ Response truncated')}
						{@const isEmpty = response.startsWith('[No response')}
						{@const isSkipped = isTurnSkipped(currentConv.id, modelId, safeTurnIndex)}
						{@const needsRerun = !isSkipped && (isMissing || isTruncated || isEmpty)}
						{@const currentRating = turnRating.ratings[modelId]}
						{@const tierInfo = modelTiers.find(
							(t) => resolveModelId(t) === modelId || t.modelId === modelId
						)}
						{@const candidatePrecLabel = tierInfo ? precisionLabel(modelId, tierInfo.isAnchor) : null}
						{@const cachedBand = w3.evalResults[`${currentConv.id}:${modelId}`]?.cachedPrecision ?? null}
						{@const hasBandMismatch = cachedBand !== null && cachedBand !== w3.w3Settings.precisionBand && !tierInfo?.isAnchor && !tierInfo?.cloudQuantization}
						<div
							class="card"
							style="margin-bottom: 0.75rem; border-left: 4px solid {isSkipped
								? 'var(--color-muted, #888)'
								: needsRerun
								? 'var(--color-warn)'
								: 'var(--color-primary)'};"
						>
							<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
								<div>
								<h3 style="margin: 0 0 0.2rem 0;">
									Response {labels[labelIdx]}
									{#if turnRating.revealed && tierInfo}
										—
										<span style="color: var(--color-primary);">
											{tierInfo.label} ({modelId})
										</span>
									{/if}
									{#if isSkipped}
										<span class="badge" style="background: #888; color: white;">skipped (truncation)</span>
									{:else if needsRerun}
										<span class="badge warn">
											{isTruncated ? 'truncated' : 'needs re-run'}
										</span>
									{/if}
								</h3>
								<!-- SPEC-013 AC #5/#8: Precision badge -->
								{#if candidatePrecLabel}
									<div style="font-size: 0.7rem; color: var(--color-text-muted); margin-bottom: 0.25rem;">
										tested at {candidatePrecLabel}
										{#if hasBandMismatch}
											<span class="badge warn" style="font-size: 0.65rem; margin-left: 0.25rem;">cached at {cachedBand}</span>
										{/if}
									</div>
								{/if}
								</div>
								<div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
									{#if isSkipped}
										<button
											class="secondary"
											style="font-size: 0.7rem; padding: 0.3rem 0.6rem; white-space: nowrap;"
											onclick={() =>
												unskipTurnForModel(currentConv.id, modelId, safeTurnIndex)}
											title="Un-skip this turn so you can retry it"
										>
											↶ un-skip
										</button>
									{/if}
									{#if needsRerun && tierInfo}
										<button
											class="secondary"
											data-testid="retry-candidate"
											style="font-size: 0.7rem; padding: 0.3rem 0.6rem; white-space: nowrap;"
											onclick={() => retryCandidate(currentConv.id, modelId, safeTurnIndex)}
											disabled={w3.evalProgress.running}
											title="Retry just this candidate — other candidates keep their responses"
										>
											↻ retry this candidate
										</button>
									{/if}
									<button
										class="secondary"
										style="font-size: 0.7rem; padding: 0.3rem 0.6rem; white-space: nowrap;"
										onclick={() => rerunPair(currentConv.id, modelId)}
										disabled={w3.evalProgress.running}
										title={turnRating.revealed && tierInfo
											? `Re-run ${tierInfo.label} against this conversation`
											: 'Re-run this response (model identity will be preserved)'}
									>
										↻ re-run from here
									</button>
									{#if needsRerun}
										<button
											class="secondary"
											style="font-size: 0.7rem; padding: 0.3rem 0.6rem; white-space: nowrap;"
											onclick={() =>
												skipTurnForModel(currentConv.id, modelId, safeTurnIndex)}
											disabled={w3.evalProgress.running}
											title="Mark this turn skipped. Aggregation records it as a gap with cause, not as a rated turn."
										>
											⊘ skip
										</button>
									{/if}
								</div>
							</div>
							<div
								style="font-size: 0.85rem; max-height: 240px; overflow-y: auto; margin: 0.5rem 0; white-space: pre-wrap;"
							>
								{response}
							</div>
							<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
								{#each [4, 3, 2, 1] as score}
									<button
										class:active={currentRating === score}
										class={currentRating === score ? 'primary' : 'secondary'}
										style="font-size: 0.75rem; padding: 0.4rem 0.75rem;"
										onclick={() =>
											setRating(currentConv.id, safeTurnIndex, modelId, score)}
										disabled={needsRerun || isSkipped}
									>
										{score} — {ratingLabels[score]}
									</button>
								{/each}
							</div>
						</div>
					{/each}

					<!-- SPEC-007: Custom next-turn chat input -->
					{#if w3.customConversation && currentConv.id === w3.customConversation.id}
						{@const customTurns = w3.customConversation.turns.filter((t) => t.role === 'user').length}
						{@const atLastTurn = ratingTurnIndex === customTurns - 1}
						{@const underCap = customTurns < CUSTOM_TURN_CAP}
						{@const allRated = turnRating.labelOrder.every((m) => turnRating.ratings[m] !== undefined)}
						{#if atLastTurn}
							<div
								class="card"
								data-custom-next-turn
								style="margin-top: 1rem; background: var(--color-bg);"
							>
								{#if underCap}
									<h3 style="margin-top: 0;">Continue the conversation</h3>
									<p class="muted" style="font-size: 0.75rem;">
										Write your next message. Rate the current turn first; then each selected tier will respond.
										{customTurns}/{CUSTOM_TURN_CAP} rater turns used.
									</p>
									<textarea
										rows="3"
										bind:value={customNextTurnInput}
										placeholder="Your next message to the models…"
										data-custom-next-turn-input
										aria-label="Next user message"
										disabled={!allRated || w3.evalProgress.running}
										style="width: 100%; font-size: 0.8rem; padding: 0.5rem; border-radius: var(--radius); border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; resize: vertical; font-family: inherit;"
									></textarea>
									<button
										type="button"
										class="primary"
										style="margin-top: 0.5rem; font-size: 0.8rem;"
										data-custom-next-turn-submit
										disabled={!customNextTurnInput.trim() || !allRated || w3.evalProgress.running}
										onclick={submitCustomNextTurn}
									>
										Send turn {customTurns + 1}
									</button>
								{:else}
									<p class="muted" style="font-size: 0.8rem; margin: 0;" data-custom-cap-reached>
										Five-turn cap reached. Rate the remaining responses to finish.
									</p>
								{/if}
							</div>
						{/if}
					{/if}

					<!-- Navigation -->
					<div style="display: flex; justify-content: space-between; margin-top: 1rem;">
						<button class="secondary" disabled={safeTurnIndex === 0 && ratingConvIndex === 0} onclick={() => {
							if (ratingTurnIndex > 0) {
								ratingTurnIndex = Math.max(0, safeTurnIndex - 1);
							} else if (ratingConvIndex > 0) {
								ratingConvIndex--;
								const prevConv = ratedConvs[ratingConvIndex];
								const prevGen = getGeneratedTurnCount(prevConv.id);
								ratingTurnIndex = Math.max(0, prevGen - 1);
							}
						}}>
							← Previous
						</button>
						<div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
							{#if atLastGeneratedTurn && canExpand}
								<button
									class="secondary"
									data-testid="generate-next-turn"
									disabled={convExpanding}
									onclick={() => requestExpansion(currentConv.id)}
									title={convExpanding
										? 'A next-turn generation is already in flight for this conversation.'
										: 'Generate the next turn for this conversation. Shows a preview before any API calls.'}
								>
									{convExpanding ? 'Generating…' : 'Generate next turn'}
								</button>
							{/if}
							{#if !turnRating.revealed && turnRating.labelOrder.every((m) => turnRating.ratings[m] !== undefined)}
								<button class="secondary" onclick={() => revealTurn(currentConv.id, safeTurnIndex)}>
									Reveal Models
								</button>
							{/if}
							<button class="secondary" data-testid="advance-next" disabled={!turnRating.labelOrder.every((m) => turnRating.ratings[m] !== undefined)} onclick={() => {
								if (safeTurnIndex < generatedForConv - 1 && safeTurnIndex < userTurns.length - 1) {
									ratingTurnIndex = safeTurnIndex + 1;
								} else if (ratingConvIndex < ratedConvs.length - 1) {
									ratingConvIndex++;
									ratingTurnIndex = 0;
								}
							}}>
								{safeTurnIndex < generatedForConv - 1 && safeTurnIndex < userTurns.length - 1
									? 'Next Turn →'
									: ratingConvIndex < ratedConvs.length - 1
										? 'Next Conversation →'
										: 'End of sequence'}
							</button>
							<button
								class="primary"
								data-testid="finish-rating"
								title="Close the rating panel and jump to the results section. Your ratings so far are already saved."
								onclick={() => {
									showRating = false;
									queueMicrotask(() => {
										document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
									});
								}}
							>
								Done — view results
							</button>
						</div>
					</div>
					{#if expansionStatus}
						<p class="muted" data-testid="expansion-status" style="margin-top: 0.5rem; font-size: 0.8rem;">{expansionStatus}</p>
					{/if}
				</div>
			{/if}
		{/if}
	{/if}

	<!-- Metrics -->
	{#if hasRatings}
		{@const selectedConvs = [
			...bundle.conversations.filter((c) => w3.selectedConversations.includes(c.id)),
			...(w3.customConversation && w3.selectedConversations.includes(w3.customConversation.id)
				? [w3.customConversation]
				: [])
		]}
		{@const includedConvs = selectedConvs.filter((c) => getRatedTurnCount(c.id) > 0)}
		{@const excludedConvs = selectedConvs.filter((c) => getRatedTurnCount(c.id) === 0)}
		<div class="card" id="results" style="margin-top: 1.5rem;">
			<h2>Results</h2>
			<p class="muted" style="font-size: 0.8rem;" data-coverage-summary>
				Coverage: {includedConvs.length} of {selectedConvs.length} selected conversations contribute ratings.
				{#if excludedConvs.length > 0}
					{excludedConvs.length} with zero ratings are excluded from metrics.
				{/if}
			</p>
			<table>
				<thead>
					<tr>
						<th>Tier</th>
						<th>Sample</th>
						<th>Adequacy Rate</th>
						<th>Critical Failure Rate</th>
						<th title="Turns the operator skipped because the model produced no usable output.">Skipped</th>
						<th>Meets Threshold</th>
					</tr>
				</thead>
				<tbody>
					{#each metrics as m}
						{@const isMinimum = personalMinimumTier() === m.tierId}
						{@const lowConfidence = m.sampleSize > 0 && m.sampleSize < LOW_CONFIDENCE_THRESHOLD}
						<tr
							style="{isMinimum ? 'background: var(--color-go-light);' : ''}{lowConfidence ? ' opacity: 0.55;' : ''}"
							data-sample-size={m.sampleSize}
						>
							<td style="font-weight: 500;">
								{m.tierLabel}
								{#if isMinimum}
									<span class="badge go">minimum adequate</span>
								{/if}
							</td>
							<td>
								<span class="badge" title="Number of turn ratings for this tier" data-sample-badge={m.tierId}>
									n={m.sampleSize}
								</span>
								{#if lowConfidence}
									<span class="muted" style="font-size: 0.7rem;" title="Fewer than {LOW_CONFIDENCE_THRESHOLD} ratings">
										low confidence
									</span>
								{/if}
							</td>
							<td>{m.sampleSize === 0 ? '—' : (m.adequacyRate * 100).toFixed(0) + '%'}</td>
							<td>{m.sampleSize === 0 ? '—' : (m.criticalFailureRate * 100).toFixed(0) + '%'}</td>
							<td>
								{#if m.skippedTurns > 0}
									<span
										class="badge warn"
										title="Turns skipped due to truncation or empty output. These are recorded gaps, not silent misses."
									>
										{m.skippedTurns}
									</span>
								{:else}
									<span class="muted">0</span>
								{/if}
							</td>
							<td>
								{#if m.sampleSize === 0}
									<span class="muted">—</span>
								{:else if m.meetsThreshold}
									<span class="badge go">Yes</span>
								{:else}
									<span class="badge skip">No</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if !personalMinimumTier()}
				<div class="decision-card warn" style="margin-top: 1rem;">
					<h2>No tier meets threshold</h2>
					<p>None of the tested tiers meet your adequacy threshold for sovereignty-gated work.</p>
					<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-top: 1rem; text-align: left;">
						<div class="card">
							<h3>Accept degradation</h3>
							<p class="muted" style="font-size: 0.8rem;">Use the closest tier with an explicit quality tradeoff.</p>
						</div>
						<div class="card">
							<h3>Cloud escape valve</h3>
							<p class="muted" style="font-size: 0.8rem;">Route hard tasks through ZDR API. Compute annual cost.</p>
						</div>
						<div class="card">
							<h3>Narrow the subset</h3>
							<p class="muted" style="font-size: 0.8rem;">Reduce which content categories route to local hardware.</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- SPEC-013 AC #6: Precision band cache-invalidation modal -->
	{#if precisionModalOpen}
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="precision-modal-title"
			data-precision-modal
			style="position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999;"
		>
			<div class="card" style="max-width: 500px; margin: 1rem; padding: 1.25rem;">
				<h2 id="precision-modal-title" style="margin-top: 0;">Precision band mismatch</h2>
				<p>
					You have cached responses generated at a different precision band. Changing bands
					means those results no longer match the new comparison frame.
				</p>
				<p>Choose how to handle the existing cache:</p>
				<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
					<button
						type="button"
						class="primary"
						onclick={confirmClearCache}
					>
						Clear cache and re-run
					</button>
					<button
						type="button"
						class="secondary"
						onclick={confirmKeepCacheMismatch}
					>
						Keep cache and flag mismatch in rating UI
					</button>
					<button
						type="button"
						class="secondary"
						onclick={cancelPrecisionModal}
					>
						Cancel (keep current band)
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- SPEC-013 AC #9: No-provider error recovery modal -->
	{#if noProviderModalOpen}
		{@const w3snap = getW3State()}
		{@const nextBand = fallbackBand(w3snap.w3Settings.precisionBand)}
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="no-provider-modal-title"
			data-no-provider-modal
			style="position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999;"
		>
			<div class="card" style="max-width: 500px; margin: 1rem; padding: 1.25rem;">
				<h2 id="no-provider-modal-title" style="margin-top: 0;">No provider available</h2>
				<p>
					OpenRouter could not find a provider that serves this model at the selected
					precision band. You can fall back to a less restrictive band and re-run.
				</p>
				{#if nextBand}
					<p>
						Fallback: switch from <strong>{w3snap.w3Settings.precisionBand}</strong> to
						<strong>{nextBand}</strong>.
					</p>
				{:else}
					<p>You are already at the highest precision band (frontier). No further fallback is available. Try a different model ID.</p>
				{/if}
				<div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; flex-wrap: wrap;">
					<button
						type="button"
						class="secondary"
						onclick={dismissNoProviderModal}
					>
						Abort
					</button>
					{#if nextBand}
						<button
							type="button"
							class="primary"
							onclick={confirmNoProviderFallback}
						>
							Switch to {nextBand} band
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- SPEC-007 AC #4: Custom edit-with-cache warning modal -->
	{#if customWarningOpen}
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="custom-warning-title"
			data-custom-warning-modal
			style="position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999;"
		>
			<div class="card" style="max-width: 480px; margin: 1rem; padding: 1.25rem;">
				<h2 id="custom-warning-title" style="margin-top: 0;">Saving will wipe cached results</h2>
				<p>
					You've cached responses (and possibly ratings) for this custom conversation.
					Editing the opening prompt invalidates them. Continue?
				</p>
				<div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
					<button
						type="button"
						class="secondary"
						data-custom-warning-cancel
						onclick={cancelCustomWarning}
					>
						Cancel
					</button>
					<button
						type="button"
						class="primary"
						data-custom-warning-confirm
						onclick={confirmCustomWarning}
					>
						Discard cache &amp; edit
					</button>
				</div>
			</div>
		</div>
	{/if}

		</main>

		<aside class="margin-panel">
			<h4>About the evaluation</h4>
			<p class="legend-detail">
				The SPA replays each conversation's user turns through every tier you select. Only
				user turns are sent — original assistant responses are discarded.
			</p>
			<p class="legend-detail" style="margin-top: 0.75rem;">
				<strong>Blind rating:</strong> responses appear with randomized labels (A, B, C, D). You
				rate each on a 4-point scale before model identities are revealed.
			</p>
			<p class="legend-detail" style="margin-top: 0.75rem;">
				<strong>Minimum adequate tier:</strong> lowest tier with ≥80% adequacy rate, ≤10%
				critical failure rate, and no critical failures in high-frequency tasks.
			</p>
			<p class="legend-detail" style="margin-top: 0.75rem;">
				Your OpenRouter key stays in this browser tab only — cleared on close. Every API call
				is cached by (conversation, model) pair so re-runs are free.
			</p>
		</aside>
	</div>

	<WorkflowFooter
		prevHref="{base}/worksheet2"
		prevLabel="Principle Scorecard"
		nextHref="{base}/aggregation"
		nextLabel="Group Aggregation"
		progressLabel="Worksheet 3 of 3 — Capability Evaluation"
		progressPct={100}
	>
		<button
			class="primary"
			style="margin-top: 0.35rem; font-size: 0.75rem; padding: 0.35rem 0.75rem;"
			onclick={() => {
				import('$lib/stores/export').then(async ({ generateExport, downloadExport }) => {
					const name = prompt('Enter your display name for the export:') ?? 'Anonymous';
					const data = await generateExport(name);
					downloadExport(data);
				});
			}}
		>
			Export my results
		</button>
	</WorkflowFooter>
{/if}
