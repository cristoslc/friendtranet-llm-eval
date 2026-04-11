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
		setRating,
		revealTurn,
		computeMetrics,
		personalMinimumTier
	} from '$lib/stores/worksheet3.svelte';
	import bundleData from '$lib/data/curated-conversations.json';

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

	let filteredConversations = $derived(
		categoryFilter === 'all'
			? bundle.conversations
			: bundle.conversations.filter((c) => c.category === categoryFilter)
	);

	onMount(async () => {
		await Promise.all([loadW1(), loadW2(), loadW3()]);
		const saved = sessionStorage.getItem('openrouter-key');
		if (saved) {
			apiKey = saved;
			keyVerified = true;
		}
	});

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

	function cancelEvaluation() {
		abortController?.abort();
		evalStatus = 'Cancelled.';
	}
</script>

{#if !isW3Loaded()}
	<p>Loading...</p>
{:else}
	{@const w3 = getW3State()}

	<h1>Worksheet 3: Capability Evaluation</h1>
	<p class="muted">
		Blind-test local models against a frontier baseline to find your personal minimum adequate tier.
	</p>

	{#if combined < 984}
		<div class="card" style="margin-top: 1rem;">
			<div class="decision-card skip">
				<h2>Gate check: no tier economically justified</h2>
				<p>
					Your combined W1+W2 value is {formatDollar(combined)}/year, below the Entry tier threshold of {formatDollar(984)}/year.
				</p>
				<p class="muted">You can still explore capability evaluation, but the economic case isn't there.</p>
			</div>
		</div>
	{/if}

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
		<p class="muted">Select which tiers to include. Anchor tier is always included for baseline comparison.</p>
		{#each modelTiers as tier}
			<label class="checkbox-card" class:selected={tier.isAnchor || w3.selectedTierIds.includes(tier.id)} style="margin-bottom: 0.5rem;">
				<input type="checkbox" checked={tier.isAnchor || w3.selectedTierIds.includes(tier.id)} disabled={tier.isAnchor} onchange={() => toggleTier(tier.id)} />
				<div>
					<div style="font-weight: 500;">{tier.label}{tier.isAnchor ? ' (baseline)' : ''}</div>
					<div class="muted" style="font-size: 0.8rem;">{tier.modelId}</div>
				</div>
			</label>
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
				<option value="all">All categories</option>
				{#each [...new Set(bundle.conversations.map((c) => c.category))] as cat}
					<option value={cat}>{categoryLabel(cat)}</option>
				{/each}
			</select>
		</div>

		<div class="checkbox-grid">
			{#each filteredConversations as conv}
				{@const selected = w3.selectedConversations.includes(conv.id)}
				<label class="checkbox-card" class:selected>
					<input type="checkbox" checked={selected} onchange={() => toggleConversation(conv.id)} />
					<div style="font-size: 0.8rem;">
						<div style="font-weight: 500;">{conv.summary.slice(0, 80)}{conv.summary.length > 80 ? '...' : ''}</div>
						<div class="muted">
							<span class="badge {conv.complexity === 'hard' ? 'warn' : conv.complexity === 'routine' ? 'go' : 'skip'}">{conv.complexity}</span>
							{conv.metadata.turnCount} turns · {categoryLabel(conv.category)}
							{#if isEvalCached(conv.id, modelTiers[0].modelId)}
								<span class="badge go">cached</span>
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
					<div style="height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden;">
						<div style="height: 100%; width: {w3.evalProgress.total > 0 ? (w3.evalProgress.done / w3.evalProgress.total) * 100 : 0}%; background: var(--color-primary); transition: width 0.3s;"></div>
					</div>
					<p class="muted" style="margin-top: 0.5rem;">{w3.evalProgress.done}/{w3.evalProgress.total}: {evalStatus}</p>
				</div>
				<button class="secondary" onclick={cancelEvaluation}>Cancel</button>
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
						{@const response = evalResult?.responses[ratingTurnIndex] ?? '[No response available]'}
						{@const currentRating = turnRating.ratings[modelId]}
						{@const tierInfo = modelTiers.find((t) => t.modelId === modelId)}
						<div class="card" style="margin-bottom: 0.75rem; border-left: 4px solid var(--color-primary);">
							<div style="display: flex; justify-content: space-between; align-items: flex-start;">
								<h3>
									Response {labels[labelIdx]}
									{#if turnRating.revealed && tierInfo}
										— <span style="color: var(--color-primary);">{tierInfo.label} ({tierInfo.modelId})</span>
									{/if}
								</h3>
							</div>
							<div style="font-size: 0.85rem; max-height: 200px; overflow-y: auto; margin: 0.5rem 0; white-space: pre-wrap;">
								{response}
							</div>
							<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
								{#each [4, 3, 2, 1] as score}
									<button
										class:active={currentRating === score}
										class="{currentRating === score ? 'primary' : 'secondary'}"
										style="font-size: 0.75rem; padding: 0.4rem 0.75rem;"
										onclick={() => setRating(currentConv.id, ratingTurnIndex, modelId, score)}
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
	{@const metrics = computeMetrics()}
	{@const hasRatings = metrics.some((m) => m.adequacyRate > 0)}
	{#if hasRatings}
		<div class="card" style="margin-top: 1.5rem;">
			<h2>Results</h2>
			<table>
				<thead>
					<tr>
						<th>Tier</th>
						<th>Adequacy Rate</th>
						<th>Critical Failure Rate</th>
						<th>Meets Threshold</th>
					</tr>
				</thead>
				<tbody>
					{#each metrics as m}
						{@const isMinimum = personalMinimumTier() === m.tierId}
						<tr style="{isMinimum ? 'background: var(--color-go-light);' : ''}">
							<td style="font-weight: 500;">
								{m.tierLabel}
								{#if isMinimum}
									<span class="badge go">minimum adequate</span>
								{/if}
							</td>
							<td>{(m.adequacyRate * 100).toFixed(0)}%</td>
							<td>{(m.criticalFailureRate * 100).toFixed(0)}%</td>
							<td>
								{#if m.meetsThreshold}
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

	<div class="nav-buttons">
		<a href="/worksheet2"><button class="secondary">← Principle Scorecard</button></a>
		<div style="display: flex; gap: 0.5rem;">
			<button class="primary" onclick={() => {
				import('$lib/stores/export').then(async ({ generateExport, downloadExport }) => {
					const name = prompt('Enter your display name for the export:') ?? 'Anonymous';
					const data = await generateExport(name);
					downloadExport(data);
				});
			}}>
				Export My Results
			</button>
			<a href="/aggregation"><button class="secondary">Group Aggregation →</button></a>
		</div>
	</div>
{/if}
