<script lang="ts">
	import { onMount } from 'svelte';
	import { modelTiers } from '$lib/data/tiers';
	import { classifiedCategories } from '$lib/data/principles';
	import { loadW1, computeTotalLoss } from '$lib/stores/worksheet1.svelte';
	import { loadW2, computeAdjustedWtp } from '$lib/stores/worksheet2.svelte';
	import {
		getW3State,
		loadW3,
		isW3Loaded,
		toggleConversation,
		toggleTier,
		isEvalCached,
		runEvaluation,
		getOrCreateTurnRating,
		getRatedTurnCount,
		firstUnratedTurn,
		setRating,
		revealTurn,
		computeMetrics,
		LOW_CONFIDENCE_THRESHOLD,
		personalMinimumTier,
		resolveModelId,
		setModelOverride,
		resetW3All,
		resetW3Responses,
		resetW3Ratings,
		rerunPairFromTurn
	} from '$lib/stores/worksheet3.svelte';

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
		resumeRatingIfInProgress();
	});

	// SPEC-006 AC #4: on reload, re-enter the rating UI at the last rated turn
	// if prior ratings exist for the current selection.
	function resumeRatingIfInProgress() {
		const w3 = getW3State();
		if (w3.turnRatings.length === 0) return;
		const selected = bundle.conversations.filter((c) =>
			w3.selectedConversations.includes(c.id)
		);
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
		evalStatus = 'Starting evaluation...';
		try {
			await runEvaluation(selected, (msg) => (evalStatus = msg), abortController.signal);
			evalStatus = 'Evaluation complete.';
			showRating = true;
			ratingConvIndex = 0;
			ratingTurnIndex = 0;
		} catch (e) {
			evalStatus = `Error: ${(e as Error).message}`;
		}
		abortController = null;
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

			<div class="summary-card">
				<h3>Selection</h3>
				<div class="small-note">
					<strong>{w3.selectedConversations.length}</strong> conversations selected
				</div>
				<div class="small-note">
					<strong>
						{modelTiers.filter((t) => w3.selectedTierIds.includes(t.id) || t.isAnchor).length}
					</strong>
					tiers to test (including anchor)
				</div>

				{#if combined < 984}
					<h3 style="margin-top: 1rem;">Gate check</h3>
					<span class="badge skip">Below threshold</span>
					<p class="small-note" style="margin-top: 0.5rem;">
						Combined W1+W2 ({formatDollar(combined)}/yr) is below the Entry tier
						({formatDollar(984)}/yr). You can still explore, but the economics aren't there.
					</p>
				{:else}
					<h3 style="margin-top: 1rem;">Gate check</h3>
					<span class="badge go">Passed</span>
					<p class="small-note" style="margin-top: 0.5rem;">
						Combined W1+W2 {formatDollar(combined)}/yr justifies testing.
					</p>
				{/if}

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
			</div>
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
							{#if isEvalCached(conv.id, modelTiers[0].modelId)}
								<span class="badge go">cached</span>
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
		{@const uncachedPairs = selectedConvs.flatMap((c) => activeTiers.filter((t) => !isEvalCached(c.id, t.modelId)).map((t) => ({ c, t })))}
		{@const estTokens = selectedConvs.reduce((s, c) => s + c.metadata.estimatedTokens, 0) * activeTiers.length}
		<div class="card">
			<h2>Evaluation</h2>
			<p class="muted">
				{selectedConvs.length} conversations × {activeTiers.length} tiers.
				{uncachedPairs.length > 0 ? `${uncachedPairs.length} uncached pairs to evaluate.` : 'All results cached.'}
				Estimated tokens: ~{estTokens.toLocaleString()}.
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
				{#if uncachedPairs.length > 0}
					<button class="primary" onclick={startEvaluation} style="margin-top: 0.5rem;">
						Start Evaluation ({uncachedPairs.length} API calls)
					</button>
				{:else}
					<p class="muted" style="margin-top: 0.5rem;">All conversations already evaluated. Proceed to rating.</p>
					<button class="primary" onclick={() => { showRating = true; ratingConvIndex = 0; ratingTurnIndex = 0; }} style="margin-top: 0.5rem;">
						Start Rating
					</button>
				{/if}
				{#if evalStatus}
					<p class="muted" style="margin-top: 0.5rem;">{evalStatus}</p>
				{/if}
				{#if w3.evalProgress.errors.length > 0}
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
		{@const ratedConvs = bundle.conversations.filter((c) => w3.selectedConversations.includes(c.id))}
		{#if ratedConvs.length > 0}
			{@const currentConv = ratedConvs[ratingConvIndex]}
			{@const userTurns = currentConv.turns.filter((t) => t.role === 'user')}
			{#if ratingTurnIndex < userTurns.length}
				{@const turnRating = getOrCreateTurnRating(currentConv.id, ratingTurnIndex)}
				{@const activeTiers = modelTiers.filter((t) => w3.selectedTierIds.includes(t.id) || t.isAnchor)}
				<div class="card" style="margin-top: 1.5rem;">
					<h2>Blind Rating</h2>
					<p class="muted">
						Conversation {ratingConvIndex + 1} of {ratedConvs.length}, Turn {ratingTurnIndex + 1} of {userTurns.length}.
					</p>

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
						{#each currentConv.turns.slice(0, ratingTurnIndex * 2 + 1) as turn}
							<div style="margin-bottom: 0.5rem; padding: 0.5rem; border-radius: var(--radius); background: {turn.role === 'user' ? 'var(--color-primary-light)' : 'var(--color-surface)'};">
								<span class="muted" style="font-size: 0.7rem; text-transform: uppercase;">{turn.role}</span>
								<p style="font-size: 0.85rem; margin: 0;">{turn.content.slice(0, 300)}{turn.content.length > 300 ? '...' : ''}</p>
							</div>
						{/each}
					</div>

					<!-- User prompt for this turn -->
					<div style="padding: 0.75rem; background: var(--color-primary-light); border-radius: var(--radius); margin-bottom: 1rem;">
						<span class="muted" style="font-size: 0.7rem;">USER PROMPT</span>
						<p style="margin: 0; font-size: 0.9rem;">{userTurns[ratingTurnIndex].content}</p>
					</div>

					<!-- Candidate responses -->
					{#each turnRating.labelOrder as modelId, labelIdx}
						{@const evalKey = `${currentConv.id}:${modelId}`}
						{@const evalResult = w3.evalResults[evalKey]}
						{@const response =
							evalResult?.responses[ratingTurnIndex] ?? '[No response available]'}
						{@const isMissing = !evalResult}
						{@const isTruncated = response.includes('[⚠ Response truncated')}
						{@const isEmpty = response.startsWith('[No response')}
						{@const needsRerun = isMissing || isTruncated || isEmpty}
						{@const currentRating = turnRating.ratings[modelId]}
						{@const tierInfo = modelTiers.find(
							(t) => resolveModelId(t) === modelId || t.modelId === modelId
						)}
						<div
							class="card"
							style="margin-bottom: 0.75rem; border-left: 4px solid {needsRerun
								? 'var(--color-warn)'
								: 'var(--color-primary)'};"
						>
							<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
								<h3>
									Response {labels[labelIdx]}
									{#if turnRating.revealed && tierInfo}
										—
										<span style="color: var(--color-primary);">
											{tierInfo.label} ({modelId})
										</span>
									{/if}
									{#if needsRerun}
										<span class="badge warn">needs re-run</span>
									{/if}
								</h3>
								<button
									class="secondary"
									style="font-size: 0.7rem; padding: 0.3rem 0.6rem; white-space: nowrap;"
									onclick={() => rerunPair(currentConv.id, modelId)}
									disabled={w3.evalProgress.running}
									title={turnRating.revealed && tierInfo
										? `Re-run ${tierInfo.label} against this conversation`
										: 'Re-run this response (model identity will be preserved)'}
								>
									↻ re-run
								</button>
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
											setRating(currentConv.id, ratingTurnIndex, modelId, score)}
										disabled={needsRerun}
									>
										{score} — {ratingLabels[score]}
									</button>
								{/each}
							</div>
						</div>
					{/each}

					<!-- Navigation -->
					<div style="display: flex; justify-content: space-between; margin-top: 1rem;">
						<button class="secondary" disabled={ratingTurnIndex === 0 && ratingConvIndex === 0} onclick={() => {
							if (ratingTurnIndex > 0) {
								ratingTurnIndex--;
							} else if (ratingConvIndex > 0) {
								ratingConvIndex--;
								const prevConv = ratedConvs[ratingConvIndex];
								ratingTurnIndex = prevConv.turns.filter((t) => t.role === 'user').length - 1;
							}
						}}>
							← Previous
						</button>
						<div style="display: flex; gap: 0.5rem;">
							{#if !turnRating.revealed && turnRating.labelOrder.every((m) => turnRating.ratings[m] !== undefined)}
								<button class="secondary" onclick={() => revealTurn(currentConv.id, ratingTurnIndex)}>
									Reveal Models
								</button>
							{/if}
							<button class="primary" disabled={!turnRating.labelOrder.every((m) => turnRating.ratings[m] !== undefined)} onclick={() => {
								if (ratingTurnIndex < userTurns.length - 1) {
									ratingTurnIndex++;
								} else if (ratingConvIndex < ratedConvs.length - 1) {
									ratingConvIndex++;
									ratingTurnIndex = 0;
								} else {
									showRating = false;
								}
							}}>
								{ratingTurnIndex < userTurns.length - 1 ? 'Next Turn →' : ratingConvIndex < ratedConvs.length - 1 ? 'Next Conversation →' : 'Finish Rating'}
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	{/if}

	<!-- Metrics -->
	{#if hasRatings}
		{@const selectedConvs = bundle.conversations.filter((c) => w3.selectedConversations.includes(c.id))}
		{@const includedConvs = selectedConvs.filter((c) => getRatedTurnCount(c.id) > 0)}
		{@const excludedConvs = selectedConvs.filter((c) => getRatedTurnCount(c.id) === 0)}
		<div class="card" style="margin-top: 1.5rem;">
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
		prevHref="/worksheet2"
		prevLabel="Principle Scorecard"
		nextHref="/aggregation"
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
