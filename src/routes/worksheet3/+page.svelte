<script lang="ts">
	import { onMount } from 'svelte';
	import { modelTiers } from '$lib/data/tiers';
	import { loadW1, computeTotalLoss } from '$lib/stores/worksheet1.svelte';
	import { loadW2, computeAdjustedWtp } from '$lib/stores/worksheet2.svelte';

	let apiKey = $state('');
	let keyVerified = $state(false);
	let keyError = $state('');
	let verifying = $state(false);
	let selectedTiers = $state<string[]>(modelTiers.filter((t) => !t.isAnchor).map((t) => t.id));
	let w1Total = $derived(computeTotalLoss());
	let w2Total = $derived(computeAdjustedWtp());
	let combined = $derived(w1Total + w2Total);

	onMount(async () => {
		await Promise.all([loadW1(), loadW2()]);
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

	function toggleTier(tierId: string) {
		const idx = selectedTiers.indexOf(tierId);
		if (idx >= 0) {
			selectedTiers = selectedTiers.filter((t) => t !== tierId);
		} else {
			selectedTiers = [...selectedTiers, tierId];
		}
	}

	function formatDollar(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}
</script>

<h1>Worksheet 3: Capability Evaluation</h1>
<p class="muted">
	Blind-test local models against a frontier baseline to find your personal minimum adequate tier.
</p>

{#if combined < 984}
	<div class="card" style="margin-top: 1rem;">
		<div class="decision-card skip">
			<h2>Gate check: no tier economically justified</h2>
			<p>
				Your combined W1+W2 value is {formatDollar(combined)}/year, below the Entry tier threshold
				of {formatDollar(984)}/year.
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
		<div class="badge go" style="font-size: 0.875rem;">Key verified</div>
		<button class="secondary" style="margin-left: 0.5rem; font-size: 0.75rem;" onclick={() => { keyVerified = false; apiKey = ''; sessionStorage.removeItem('openrouter-key'); }}>
			Change key
		</button>
	{:else}
		<div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
			<input
				type="password"
				placeholder="sk-or-..."
				bind:value={apiKey}
				style="flex: 1;"
			/>
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
	<p class="muted">Select which tiers to include in the blind evaluation. Anchor tier is always included.</p>
	{#each modelTiers as tier}
		{@const selected = tier.isAnchor || selectedTiers.includes(tier.id)}
		<label class="checkbox-card" class:selected style="margin-bottom: 0.5rem;">
			<input
				type="checkbox"
				checked={selected}
				disabled={tier.isAnchor}
				onchange={() => toggleTier(tier.id)}
			/>
			<div>
				<div style="font-weight: 500;">{tier.label}{tier.isAnchor ? ' (baseline)' : ''}</div>
				<div class="muted" style="font-size: 0.8rem;">{tier.modelId}</div>
			</div>
		</label>
	{/each}
</div>

<!-- Conversation Selection -->
<div class="card">
	<h2>Conversation Selection</h2>
	<p class="muted">
		Choose conversations to evaluate. Three paths available:
	</p>

	<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
		<div class="card" style="text-align: center;">
			<h3>Path 1</h3>
			<p style="font-size: 0.875rem;">Curated Samples</p>
			<p class="muted" style="font-size: 0.75rem;">Free — pre-selected conversations from public datasets.</p>
			<p class="muted" style="font-size: 0.75rem; font-style: italic;">Coming soon — sample conversations will be bundled in the next release.</p>
		</div>
		<div class="card" style="text-align: center;">
			<h3>Path 2</h3>
			<p style="font-size: 0.875rem;">Paste Your Own</p>
			<p class="muted" style="font-size: 0.75rem;">Paste multi-turn conversation text or upload Claude Code JSONL.</p>
			<p class="muted" style="font-size: 0.75rem; font-style: italic;">Coming soon.</p>
		</div>
		<div class="card" style="text-align: center;">
			<h3>Path 3</h3>
			<p style="font-size: 0.875rem;">Generate Synthetic</p>
			<p class="muted" style="font-size: 0.75rem;">Describe a task category and generate test conversations via OpenRouter.</p>
			<p class="muted" style="font-size: 0.75rem; font-style: italic;">Coming soon.</p>
		</div>
	</div>
</div>

<!-- Blind Rating UI placeholder -->
<div class="card">
	<h2>Blind Rating</h2>
	<p class="muted">
		After conversations are evaluated, you'll rate each model's responses without knowing which model
		produced them. Ratings use a 4-point scale: Fully adequate (4), Usable with minor cleanup (3),
		Insufficient but directional (2), Unusable (1).
	</p>
	<p class="muted">
		This section activates after you select conversations and run the evaluation.
	</p>
</div>

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
