<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		classifiedCategories,
		stanceOptions,
		compromiseOptions,
		calibrationAnchors
	} from '$lib/data/principles';
	import SummaryCard from '$lib/components/SummaryCard.svelte';
	import {
		getW2State,
		loadW2,
		isW2Loaded,
		toggleCategory,
		setOtherText,
		setStance,
		setCombinationText,
		setWtpAmount,
		setCompromiseIndex,
		confirmSanity,
		computeAdjustedWtp,
		computeMonthlyWtp
	} from '$lib/stores/worksheet2.svelte';
	import { computeTotalLoss } from '$lib/stores/worksheet1.svelte';
	import { loadW1 } from '$lib/stores/worksheet1.svelte';
	import WorkflowFooter from '$lib/components/WorkflowFooter.svelte';

	onMount(async () => {
		await Promise.all([loadW1(), loadW2()]);
	});

	function formatDollar(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}
</script>

{#if !isW2Loaded()}
	<div class="container"><p>Loading...</p></div>
{:else}
	{@const w2 = getW2State()}
	{@const adjustedWtp = computeAdjustedWtp()}
	{@const w1Total = computeTotalLoss()}
	{@const combinedTotal = w1Total + adjustedWtp}

	<div class="container-with-margin">
		<aside class="title-panel">
			<h1>Worksheet 2: Principle Scorecard</h1>
			<p>Even if the risk is low, what would you pay for local control?</p>

			<SummaryCard
				label="Your WTP"
				value={adjustedWtp}
				breakdown={[{ label: 'Raw', value: w2.wtpAmount }, { label: '— monthly ~', value: computeMonthlyWtp() }]}
				combinedLabel="Combined (W1 + W2)"
				combinedValue={combinedTotal}
				combinedBreakdown={[{ label: 'Risk', value: w1Total }, { label: '+ principle', value: adjustedWtp }]}
				tierValue={combinedTotal}
				emptyMessage={w2.wtpAmount === 0 && w2.stance !== 'none'
					? 'Set your willingness-to-pay to see your estimate.'
					: null}
			/>
		</aside>

		<main>
	<!-- Step 1: Categories -->
	<div class="card" style="margin-top: 1rem;">
		<h2>Step 1: What content would you route locally?</h2>
		<p class="muted">{w2.selectedCategories.length} categories selected.</p>
		<div class="checkbox-grid">
			{#each classifiedCategories as cat}
				{@const selected = w2.selectedCategories.includes(cat.id)}
				<label class="checkbox-card" class:selected>
					<input type="checkbox" checked={selected} onchange={() => toggleCategory(cat.id)} />
					<span style="font-size: 0.875rem;">{cat.label}</span>
				</label>
			{/each}
		</div>
		{#if w2.selectedCategories.includes('other')}
			<input
				type="text"
				placeholder="Describe your other category..."
				value={w2.otherText}
				oninput={(e) => setOtherText((e.target as HTMLInputElement).value)}
				style="margin-top: 0.75rem;"
			/>
		{/if}
	</div>

	<!-- Step 2: Stance -->
	<div class="card">
		<h2>Step 2: Why do you want sovereignty?</h2>
		<div class="radio-group">
			{#each stanceOptions as opt}
				{@const selected = w2.stance === opt.id}
				<label class="radio-option" class:selected>
					<input type="radio" name="stance" checked={selected} onchange={() => setStance(opt.id)} />
					<div>
						<div style="font-weight: 500; font-size: 0.875rem;">{opt.label}</div>
						<div class="muted">{opt.description}</div>
					</div>
				</label>
			{/each}
		</div>
		{#if w2.stance === 'combination'}
			<textarea
				placeholder="Describe your combination of stances..."
				value={w2.combinationText}
				oninput={(e) => setCombinationText((e.target as HTMLTextAreaElement).value)}
				style="margin-top: 0.75rem;"
				rows="3"
			></textarea>
		{/if}
		{#if w2.stance === 'none'}
			<div class="card" style="background: var(--color-skip-light); margin-top: 0.75rem;">
				<p class="muted">
					Your sovereignty value comes entirely from Worksheet 1 (risk). That's a valid position.
				</p>
			</div>
		{/if}
	</div>

	<!-- Step 3: WTP -->
	{#if w2.stance !== 'none'}
		<div class="card">
			<h2>Step 3: Annual willingness-to-pay</h2>
			<p class="muted" style="font-style: italic;">
				Don't anchor to what you think the hardware costs. Answer what sovereignty is worth to you.
			</p>
			<div style="text-align: center; margin: 1rem 0;">
				<div style="font-size: 2rem; font-weight: 700;">{formatDollar(w2.wtpAmount)}/year</div>
			</div>
			<input
				type="range"
				min="0"
				max="3000"
				step="50"
				value={w2.wtpAmount}
				oninput={(e) => setWtpAmount(parseInt((e.target as HTMLInputElement).value))}
			/>
			<div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-muted);">
				<span>$0</span>
				<span>$3,000</span>
			</div>
			<div style="margin-top: 1rem; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
				{#each calibrationAnchors as anchor}
					<div class="muted" style="font-size: 0.8rem; padding: 0.5rem; background: var(--color-bg); border-radius: var(--radius);">
						{anchor.label}: ~{formatDollar(anchor.amount)}/yr
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Step 4: Compromise -->
	{#if w2.stance !== 'none'}
		<div class="card">
			<h2>Step 4: Compromise tolerance</h2>
			<p class="muted">
				Local hardware can't cover everything. How much does incomplete coverage reduce the value for you?
			</p>
			<div class="segmented" style="margin-top: 0.75rem;">
				{#each compromiseOptions as opt, i}
					<button
						class:active={w2.compromiseIndex === i}
						onclick={() => setCompromiseIndex(i)}
					>
						<div style="font-weight: 500;">{opt.label}</div>
						<div style="font-size: 0.65rem; opacity: 0.8;">-{opt.reduction * 100}%</div>
					</button>
				{/each}
			</div>
			{#if w2.compromiseIndex !== null}
				<p style="margin-top: 0.75rem; text-align: center;">
					{formatDollar(w2.wtpAmount)}/yr × (100% - {compromiseOptions[w2.compromiseIndex].reduction * 100}%) = <strong>{formatDollar(adjustedWtp)}/yr adjusted</strong>
				</p>
				<p class="muted" style="text-align: center;">{compromiseOptions[w2.compromiseIndex].description}</p>
			{/if}
		</div>
	{/if}

	<!-- Step 5: Sanity -->
	{#if (w2.stance === 'none' || (w2.compromiseIndex !== null && w2.wtpAmount > 0)) || w2.stance === 'none'}
		<div class="card" style="text-align: center;">
			<h2>Step 5: Sanity check</h2>
			<p>
				Your final value / 12 = <strong>{formatDollar(computeMonthlyWtp())}/month</strong>.
			</p>
			<p>Would you actually subscribe to a sovereignty service at that price?</p>
			<div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
				<button class="go" onclick={() => confirmSanity(true)}>Yes, that feels right</button>
				<button class="secondary" onclick={() => { confirmSanity(false); if (w2.stance !== 'none') { const el = document.querySelector('input[type=range]'); el?.scrollIntoView({ behavior: 'smooth' }); } }}>No, that's too high</button>
			</div>
		</div>
	{/if}

		</main>

		<aside class="margin-panel">
			<h4>Guidance</h4>
			<p class="legend-detail">
				This worksheet is about <em>values</em>, not <em>risk</em> — what would you pay for
				local control independent of probability of harm?
			</p>
			<p class="legend-detail" style="margin-top: 0.75rem;">
				The <strong>compromise tolerance</strong> step captures whether partial coverage is
				enough for you. Local hardware can protect some content categories but not others; the
				reduction encodes that.
			</p>
			<p class="legend-detail" style="margin-top: 0.75rem;">
				<strong>Sanity check:</strong> divide your adjusted WTP by 12 and ask whether you'd pay
				that monthly for a sovereignty service. If not, revise down — that's a real data point.
			</p>
		</aside>
	</div>

	<WorkflowFooter
		prevHref="{base}/worksheet1"
		prevLabel="Risk Scorecard"
		nextHref="{base}/worksheet3"
		nextLabel="Capability Evaluation"
		progressLabel="Worksheet 2 of 3 — Principle Scorecard"
		progressPct={66}
	/>
{/if}
