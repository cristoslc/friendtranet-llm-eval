<script lang="ts">
	import { hardwareTiers } from '$lib/data/tiers';

	interface Props {
		value: number;
		heading?: string;
	}

	let { value, heading = 'vs. hardware cost' }: Props = $props();

	let expanded = $state<Record<string, boolean>>({});

	function fmt(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}

	function toggle(id: string) {
		expanded[id] = !expanded[id];
	}
</script>

<h3 style="margin-top: 1rem;">{heading}</h3>
{#each hardwareTiers as tier (tier.id)}
	{@const pct = Math.min(100, (value / tier.annualTCO) * 100)}
	<div class="tier-bar-row">
		<button
			class="tier-bar tier-bar-toggle"
			onclick={() => toggle(tier.id)}
			aria-expanded={expanded[tier.id] ?? false}
		>
			<span class="tier-bar-label" style="width: 80px; font-size: 0.7rem;">
				{tier.label}
				<span class="tier-expand-icon">{expanded[tier.id] ? '▾' : '▸'}</span>
			</span>
			<div class="tier-bar-track" style="height: 16px;">
				<div
					class="tier-bar-fill"
					style="width: {pct}%; background: {pct >= 100
						? 'var(--color-go)'
						: 'var(--color-primary)'};"
				></div>
			</div>
			<span class="tier-bar-amount" style="width: 80px; font-size: 0.7rem;">
				{fmt(tier.annualTCO)}
			</span>
		</button>
		{#if expanded[tier.id]}
			<div class="tier-detail">
				<span class="tier-detail-config">{tier.config}</span>
				<span class="tier-detail-cost">{fmt(tier.upfront)} upfront · {fmt(tier.annualTCO)}/yr TCO</span>
				<span class="tier-detail-ceiling">{tier.capabilityCeiling}</span>
			</div>
		{/if}
	</div>
{/each}

<style>
	.tier-bar-row {
		display: flex;
		flex-direction: column;
	}

	.tier-bar-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
		color: inherit;
		font: inherit;
	}

	.tier-bar-toggle:hover .tier-expand-icon {
		opacity: 1;
	}

	.tier-expand-icon {
		font-size: 0.6rem;
		opacity: 0.4;
		margin-left: 0.15rem;
		transition: opacity 0.15s;
	}

	.tier-detail {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		padding: 0.35rem 0 0.5rem 5.5rem;
		font-size: 0.7rem;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 0.25rem;
	}

	.tier-detail-config {
		color: var(--color-text);
		font-weight: 500;
	}

	.tier-detail-cost {
		white-space: nowrap;
	}

	.tier-detail-ceiling {
		font-style: italic;
	}
</style>