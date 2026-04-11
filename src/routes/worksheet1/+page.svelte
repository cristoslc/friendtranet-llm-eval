<script lang="ts">
	import { onMount } from 'svelte';
	import { threats, probabilityOptions, impactScales } from '$lib/data/threats';
	import { hardwareTiers } from '$lib/data/tiers';
	import {
		getW1State,
		loadW1,
		isW1Loaded,
		setThreatProbability,
		setThreatImpact,
		setHwMitigation,
		setRiskAversionRows,
		setRiskAversionMultiplier,
		computeThreatLoss,
		computeBaseLoss,
		computePremium,
		computeTotalLoss,
		completedRowCount
	} from '$lib/stores/worksheet1.svelte';

	let showPremium = $state(false);
	let expandedThreat = $state<number | null>(null);

	onMount(() => {
		loadW1();
	});

	function formatDollar(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}

	function handleProbChange(threatId: number, e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		if (val !== '') setThreatProbability(threatId, parseInt(val));
	}

	function handleImpactChange(threatId: number, scaleName: string, e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		if (val !== '') setThreatImpact(threatId, scaleName, parseInt(val));
	}

	function handleMitigationChange(threatId: number, e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		setHwMitigation(threatId, val);
	}

	function togglePremiumRow(threatId: number) {
		const w1 = getW1State();
		const rows = [...w1.riskAversionRows];
		const idx = rows.indexOf(threatId);
		if (idx >= 0) {
			rows.splice(idx, 1);
		} else if (rows.length < 2) {
			rows.push(threatId);
		}
		setRiskAversionRows(rows);
	}
</script>

{#if !isW1Loaded()}
	<p>Loading...</p>
{:else}
	{@const w1 = getW1State()}
	<h1>Worksheet 1: Risk Scorecard</h1>
	<p class="muted">
		Quantify expected annual loss from ZDR+DPA provider failure modes.
		{completedRowCount()} of {threats.length} threats assessed.
	</p>

	{#each threats as threat}
		{@const resp = w1.responses[threat.id]}
		{@const loss = computeThreatLoss(threat.id)}
		<div class="card">
			<div style="display: flex; justify-content: space-between; align-items: flex-start;">
				<div>
					<h3>
						{threat.id}. {threat.shortLabel}
						{#if threat.hwPrevents === 0}
							<span class="badge warn">HW: 0%</span>
						{/if}
					</h3>
					<button
						class="secondary"
						style="font-size: 0.75rem; padding: 0.25rem 0.5rem; margin-bottom: 0.5rem;"
						onclick={() =>
							(expandedThreat = expandedThreat === threat.id ? null : threat.id)}
					>
						{expandedThreat === threat.id ? 'Hide' : 'Details'}
					</button>
					{#if expandedThreat === threat.id}
						<p class="muted">{threat.description}</p>
					{/if}
				</div>
				<div style="text-align: right; min-width: 100px;">
					<div class="muted" style="font-size: 0.75rem;">Expected loss</div>
					<div style="font-size: 1.1rem; font-weight: 600;">{formatDollar(loss)}</div>
				</div>
			</div>

			<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
				<div>
					<label class="muted" style="display: block; font-size: 0.75rem; margin-bottom: 0.25rem;">
						Probability
					</label>
					<select
						value={resp?.probabilityIndex ?? ''}
						onchange={(e) => handleProbChange(threat.id, e)}
						style="width: 100%;"
					>
						<option value="">Select...</option>
						{#each probabilityOptions as opt, i}
							<option value={i}>{opt.label}</option>
						{/each}
					</select>
				</div>

				{#each impactScales as scale}
					<div>
						<label class="muted" style="display: block; font-size: 0.75rem; margin-bottom: 0.25rem;">
							{scale.name}
						</label>
						<select
							value={resp?.impactSelections[scale.name] ?? ''}
							onchange={(e) => handleImpactChange(threat.id, scale.name, e)}
							style="width: 100%;"
						>
							<option value="">Select...</option>
							{#each scale.levels as level, i}
								<option value={i}>{level.label} ({formatDollar(level.dollar)})</option>
							{/each}
						</select>
					</div>
				{/each}
			</div>

			<div style="margin-top: 0.75rem;">
				<label class="muted" style="display: block; font-size: 0.75rem; margin-bottom: 0.25rem;">
					HW mitigation: {Math.round((resp?.hwMitigation ?? threat.hwPrevents) * 100)}%
					{#if resp?.hwMitigation !== undefined && resp.hwMitigation !== threat.hwPrevents}
						<span class="badge warn">customized</span>
						<button
							class="secondary"
							style="font-size: 0.65rem; padding: 0.1rem 0.4rem;"
							onclick={() => setHwMitigation(threat.id, threat.hwPrevents)}
						>
							reset
						</button>
					{/if}
				</label>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={resp?.hwMitigation ?? threat.hwPrevents}
					oninput={(e) => handleMitigationChange(threat.id, e)}
				/>
			</div>
		</div>
	{/each}

	<div class="card" style="margin-top: 1.5rem;">
		<button
			class="secondary"
			onclick={() => (showPremium = !showPremium)}
		>
			{showPremium ? 'Hide' : 'Show'} Risk-Aversion Premium (optional)
		</button>

		{#if showPremium}
			<div style="margin-top: 1rem;">
				<p class="muted">
					If you're more worried about worst cases than averages, select up to 2 scenarios and apply a multiplier.
				</p>
				{#each threats as threat}
					{@const loss = computeThreatLoss(threat.id)}
					{#if loss > 0}
						{@const isSelected = w1.riskAversionRows.includes(threat.id)}
						<div
							style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border);"
						>
							<input
								type="checkbox"
								checked={isSelected}
								disabled={!isSelected && w1.riskAversionRows.length >= 2}
								onchange={() => togglePremiumRow(threat.id)}
							/>
							<span style="flex: 1; font-size: 0.875rem;">{threat.shortLabel} ({formatDollar(loss)})</span>
							{#if isSelected}
								<label class="muted" style="font-size: 0.75rem;">
									{w1.riskAversionMultipliers[threat.id] ?? 1}x
								</label>
								<input
									type="range"
									min="1"
									max="5"
									step="0.5"
									value={w1.riskAversionMultipliers[threat.id] ?? 1}
									oninput={(e) =>
										setRiskAversionMultiplier(threat.id, parseFloat((e.target as HTMLInputElement).value))}
									style="width: 120px;"
								/>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<div class="summary-card">
		{#if completedRowCount() === 0}
			<p class="muted">Select probability and impact for at least one threat to see your risk estimate.</p>
		{:else}
			<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
				<div>
					<div class="muted" style="font-size: 0.75rem;">Annual risk-adjusted expected loss</div>
					<div style="font-size: 1.5rem; font-weight: 700;">{formatDollar(computeTotalLoss())}/year</div>
					{#if computePremium() > 0}
						<div class="muted" style="font-size: 0.75rem;">
							Base: {formatDollar(computeBaseLoss())} + Premium: {formatDollar(computePremium())}
						</div>
					{/if}
				</div>
				<div style="flex: 1; min-width: 300px;">
					{#each hardwareTiers as tier}
						{@const pct = Math.min(100, (computeTotalLoss() / tier.annualTCO) * 100)}
						<div class="tier-bar">
							<span class="tier-bar-label">{tier.label}</span>
							<div class="tier-bar-track">
								<div
									class="tier-bar-fill"
									style="width: {pct}%; background: {pct >= 100 ? 'var(--color-go)' : 'var(--color-primary)'};"
								></div>
							</div>
							<span class="tier-bar-amount">{formatDollar(tier.annualTCO)}/yr</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="nav-buttons">
		<a href="/"><button class="secondary">← Home</button></a>
		<a href="/worksheet2"><button class="primary">Next: Principle Scorecard →</button></a>
	</div>
{/if}
