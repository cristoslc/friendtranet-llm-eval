<script lang="ts">
	import { hardwareTiers } from '$lib/data/tiers';

	interface Props {
		value: number;
		heading?: string;
	}

	let { value, heading = 'vs. hardware cost' }: Props = $props();

	function fmt(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}
</script>

<h3 style="margin-top: 1rem;">{heading}</h3>
{#each hardwareTiers as tier}
	{@const pct = Math.min(100, (value / tier.annualTCO) * 100)}
	<div class="tier-bar">
		<span class="tier-bar-label" style="width: 80px; font-size: 0.7rem;">
			{tier.label}
			<span
				class="tier-info-icon"
				title="{tier.config} — {fmt(tier.upfront)} upfront / {fmt(tier.annualTCO)}/yr TCO"
			>ℹ</span>
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
	</div>
{/each}

<style>
	.tier-info-icon {
		cursor: help;
		font-size: 0.65rem;
		opacity: 0.5;
		margin-left: 0.15rem;
		vertical-align: super;
		transition: opacity 0.15s;
	}

	.tier-info-icon:hover {
		opacity: 1;
	}
</style>