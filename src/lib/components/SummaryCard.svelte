<script lang="ts">
	import HardwareTierBars from '$lib/components/HardwareTierBars.svelte';

	interface BreakdownEntry {
		label: string;
		value: number;
	}

	interface Props {
		label: string;
		value: number;
		valueSuffix?: string;
		breakdown?: BreakdownEntry[];
		combinedLabel?: string | null;
		combinedValue?: number | null;
		combinedBreakdown?: BreakdownEntry[] | null;
		tierValue: number;
		tierHeading?: string;
		emptyMessage?: string | null;
		children?: import('svelte').Snippet;
	}

	let {
		label,
		value,
		valueSuffix = '/yr',
		breakdown = [],
		combinedLabel = null,
		combinedValue = null,
		combinedBreakdown = null,
		tierValue,
		tierHeading = 'vs. hardware cost',
		emptyMessage = null,
		children
	}: Props = $props();

	function fmt(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}
</script>

<div class="summary-card">
	<h3>{label}</h3>
	{#if emptyMessage}
		<p class="small-note" style="margin: 0;">{emptyMessage}</p>
	{:else}
		<div class="big-value">{fmt(value)}{valueSuffix}</div>
		{#each breakdown as entry}
			<div class="small-note">{entry.label} {fmt(entry.value)}</div>
		{/each}

		{#if combinedLabel}
			<h3 style="margin-top: 1rem;">{combinedLabel}</h3>
			<div style="font-size: 1.1rem; font-weight: 600;">{fmt(combinedValue ?? 0)}/yr</div>
			{#if combinedBreakdown}
				{#each combinedBreakdown as entry}
					<div class="small-note">{entry.label} {fmt(entry.value)}</div>
				{/each}
			{/if}
		{/if}

		<HardwareTierBars value={tierValue} heading={tierHeading} />

		{#if children}
			{@render children()}
		{/if}
	{/if}
</div>