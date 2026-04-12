<script lang="ts">
	import { onMount } from 'svelte';
	import {
		threats,
		probabilityOptions,
		impactScales,
		mitigationAnchors
	} from '$lib/data/threats';
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

	type LegendKey =
		| { kind: 'probability' }
		| { kind: 'impact'; scaleName: string }
		| { kind: 'mitigation'; threatId: number }
		| null;

	let focusedLegend = $state<LegendKey>(null);

	onMount(() => {
		loadW1();
	});

	function formatDollar(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}

	// Slider → probability index: range 0-5 maps to 6 anchors
	function handleProbSlider(threatId: number, e: Event) {
		const idx = parseInt((e.target as HTMLInputElement).value);
		setThreatProbability(threatId, idx);
	}

	function handleImpactSlider(threatId: number, scaleName: string, e: Event) {
		const raw = parseInt((e.target as HTMLInputElement).value);
		// -1 means "no selection"; clamp to valid index or unset
		setThreatImpact(threatId, scaleName, raw < 0 ? -1 : raw);
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
	<div class="container"><p>Loading...</p></div>
{:else}
	{@const w1 = getW1State()}

	<div class="container-with-margin">
		<main>
			<h1>Worksheet 1: Risk Scorecard</h1>
			<p class="muted">
				For each threat, rate how likely it is and how bad it would be if it happened. The
				hardware mitigation slider shows how much local hardware protects you from this
				threat — adjust if you disagree with the default.
				{completedRowCount()} of {threats.length} threats assessed.
			</p>

			{#each threats as threat (threat.id)}
				{@const resp = w1.responses[threat.id]}
				{@const loss = computeThreatLoss(threat.id)}
				{@const probIdx = resp?.probabilityIndex ?? -1}
				{@const mitigation =
					resp?.hwMitigation !== undefined ? resp.hwMitigation : threat.hwPrevents}
				<div class="card">
					<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
						<div style="flex: 1;">
							<h3 style="margin-bottom: 0.25rem;">
								{threat.id}. {threat.shortLabel}
								{#if threat.hwPrevents === 0}
									<span class="badge warn" title="Hardware cannot prevent this threat">
										HW: 0%
									</span>
								{/if}
							</h3>
							<p class="muted" style="margin-bottom: 0;">{threat.description}</p>
						</div>
						<div style="text-align: right; min-width: 110px;">
							<div class="muted" style="font-size: 0.7rem;">Expected loss</div>
							<div style="font-size: 1.1rem; font-weight: 600;">{formatDollar(loss)}</div>
						</div>
					</div>

					<!-- Probability slider -->
					<div class="tick-slider" style="margin-top: 1rem;">
						<div class="current-label">
							<span>
								<strong>Probability:</strong>
								{#if probIdx >= 0}
									{probabilityOptions[probIdx].label}
								{:else}
									<span class="muted">— not selected —</span>
								{/if}
							</span>
							{#if probIdx >= 0}
								<span class="current-desc">"{probabilityOptions[probIdx].description}"</span>
							{/if}
						</div>
						<input
							type="range"
							min="-1"
							max="5"
							step="1"
							value={probIdx}
							oninput={(e) => {
								const v = parseInt((e.target as HTMLInputElement).value);
								if (v >= 0) setThreatProbability(threat.id, v);
							}}
							onfocus={() => (focusedLegend = { kind: 'probability' })}
							aria-label="Probability for {threat.shortLabel}"
						/>
						<div class="tick-labels">
							<span>—</span>
							<span>Never</span>
							<span>V.rare</span>
							<span>Rare</span>
							<span>Occasional</span>
							<span>Common</span>
							<span>Frequent</span>
						</div>
					</div>

					<!-- Impact sliders -->
					{#each impactScales as scale}
						{@const impIdx = resp?.impactSelections[scale.name] ?? -1}
						{@const level = impIdx >= 0 ? scale.levels[impIdx] : null}
						<div class="tick-slider" style="margin-top: 0.75rem;">
							<div class="current-label">
								<span>
									<strong>{scale.name}:</strong>
									{#if level}
										{level.label}
										<span class="muted" style="font-size: 0.8rem;">
											({formatDollar(level.dollar)})
										</span>
									{:else}
										<span class="muted">— not selected —</span>
									{/if}
								</span>
							</div>
							{#if level}
								<span class="current-desc">"{level.example}"</span>
							{/if}
							<input
								type="range"
								min="-1"
								max={scale.levels.length - 1}
								step="1"
								value={impIdx}
								oninput={(e) => handleImpactSlider(threat.id, scale.name, e)}
								onfocus={() =>
									(focusedLegend = { kind: 'impact', scaleName: scale.name })}
								aria-label="{scale.name} impact for {threat.shortLabel}"
							/>
							<div class="tick-labels">
								<span>—</span>
								{#each scale.levels as lvl}
									<span>{lvl.label.split(' ')[0]}</span>
								{/each}
							</div>
						</div>
					{/each}

					<!-- HW mitigation slider -->
					<div class="tick-slider" style="margin-top: 0.75rem;">
						<div class="current-label">
							<span>
								<strong>HW mitigation:</strong>
								{Math.round(mitigation * 100)}%
								{#if resp?.hwMitigation !== undefined && resp.hwMitigation !== threat.hwPrevents}
									<span class="badge warn" style="margin-left: 0.35rem;">customized</span>
								{/if}
							</span>
							{#if resp?.hwMitigation !== undefined && resp.hwMitigation !== threat.hwPrevents}
								<button
									class="secondary"
									style="font-size: 0.65rem; padding: 0.15rem 0.5rem;"
									onclick={() => setHwMitigation(threat.id, threat.hwPrevents)}
								>
									reset to {Math.round(threat.hwPrevents * 100)}%
								</button>
							{/if}
						</div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={mitigation}
							oninput={(e) => handleMitigationChange(threat.id, e)}
							onfocus={() => (focusedLegend = { kind: 'mitigation', threatId: threat.id })}
							aria-label="Hardware mitigation for {threat.shortLabel}"
						/>
						<div class="tick-labels">
							<span>0%</span>
							<span>25%</span>
							<span>50%</span>
							<span>75%</span>
							<span>100%</span>
						</div>
					</div>
				</div>
			{/each}

			<div class="card" style="margin-top: 1.5rem;">
				<button class="secondary" onclick={() => (showPremium = !showPremium)}>
					{showPremium ? 'Hide' : 'Show'} Risk-Aversion Premium (optional)
				</button>

				{#if showPremium}
					<div style="margin-top: 1rem;">
						<p class="muted">
							If you're more worried about worst cases than averages, select up to 2 scenarios
							and apply a multiplier.
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
									<span style="flex: 1; font-size: 0.875rem;">
										{threat.shortLabel} ({formatDollar(loss)})
									</span>
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
												setRiskAversionMultiplier(
													threat.id,
													parseFloat((e.target as HTMLInputElement).value)
												)}
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
					<p class="muted">
						Set probability and impact for at least one threat to see your risk estimate.
					</p>
				{:else}
					<div
						style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;"
					>
						<div>
							<div class="muted" style="font-size: 0.75rem;">
								Annual risk-adjusted expected loss
							</div>
							<div style="font-size: 1.5rem; font-weight: 700;">
								{formatDollar(computeTotalLoss())}/year
							</div>
							{#if computePremium() > 0}
								<div class="muted" style="font-size: 0.75rem;">
									Base: {formatDollar(computeBaseLoss())} + Premium: {formatDollar(
										computePremium()
									)}
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
											style="width: {pct}%; background: {pct >= 100
												? 'var(--color-go)'
												: 'var(--color-primary)'};"
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
				<a href="/worksheet2"
					><button class="primary">Next: Principle Scorecard →</button></a
				>
			</div>
		</main>

		<!-- Margin legend panel -->
		<aside class="margin-panel">
			{#if focusedLegend === null}
				<h4>Legend</h4>
				<p class="empty">Focus any slider to see its reference scale here.</p>
			{:else if focusedLegend.kind === 'probability'}
				<h4>How likely is this?</h4>
				<p class="legend-detail" style="margin-bottom: 0.5rem;">
					Pick the phrase that matches your gut sense of how often this happens to someone like
					you.
				</p>
				<ul>
					{#each probabilityOptions as opt}
						<li>
							<span class="legend-label">{opt.label}</span>
							<span class="muted" style="font-size: 0.7rem; margin-left: 0.35rem;">
								(~{(opt.midpoint * 100).toFixed(opt.midpoint < 0.01 ? 2 : 1)}%/yr)
							</span>
							<span class="legend-detail">"{opt.description}"</span>
						</li>
					{/each}
				</ul>
			{:else if focusedLegend.kind === 'impact'}
				{@const fl = focusedLegend as { kind: 'impact'; scaleName: string }}
				{@const s = impactScales.find((x) => x.name === fl.scaleName)}
				<h4>{fl.scaleName}</h4>
				{#if s}
					<p class="legend-detail" style="margin-bottom: 0.5rem;">{s.description}</p>
				{/if}
				<ul>
					{#if s}
						{#each s.levels as lvl}
							<li>
								<span class="legend-label">{lvl.label}</span>
								<span class="muted" style="font-size: 0.7rem; margin-left: 0.35rem;">
									({formatDollar(lvl.dollar)})
								</span>
								<span class="legend-detail">{lvl.example}</span>
							</li>
						{/each}
					{/if}
				</ul>
				<p class="legend-detail" style="margin-top: 0.75rem; font-size: 0.75rem; opacity: 0.85;">
					Across all three impact scales, the SPA uses whichever one you rate <em>highest</em>
					— severity takes priority over averaging.
				</p>
			{:else if focusedLegend.kind === 'mitigation'}
				{@const fl = focusedLegend as { kind: 'mitigation'; threatId: number }}
				{@const t = threats.find((x) => x.id === fl.threatId)}
				<h4>What fraction does local hardware prevent?</h4>
				<p class="legend-detail" style="margin-bottom: 0.5rem;">
					For <em>{t?.shortLabel}</em>, default is
					<strong>{Math.round((t?.hwPrevents ?? 0) * 100)}%</strong>.
					{#if t?.hwPrevents === 0}
						Hardware doesn't help — this threat affects cloud and local equally.
					{:else if (t?.hwPrevents ?? 0) >= 1}
						Hardware fully closes this threat because content never leaves your perimeter.
					{:else}
						Hardware prevents most but not all of this vector. Adjust if you have a different
						view.
					{/if}
				</p>
				<ul>
					{#each mitigationAnchors as anchor}
						<li>
							<span class="legend-label">{anchor.label}</span>
							<span class="legend-detail">{anchor.example}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>
{/if}
