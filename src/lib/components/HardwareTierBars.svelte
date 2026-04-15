<script lang="ts">
	import { hardwareTiers } from '$lib/data/tiers';

	interface Props {
		/** The cumulative annual value ($/yr) to compare against each tier's TCO. */
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
		<span class="tier-bar-label" style="width: 50px; font-size: 0.7rem;">
			{tier.label}
		</span>
		<div class="tier-bar-track" style="height: 16px;">
			<div
				class="tier-bar-fill"
				style="width: {pct}%; background: {pct >= 100
					? 'var(--color-go)'
					: 'var(--color-primary)'};"
			></div>
		</div>
		<span class="tier-bar-amount" style="width: 60px; font-size: 0.7rem;">
			{fmt(tier.annualTCO)}
		</span>
	</div>
{/each}
