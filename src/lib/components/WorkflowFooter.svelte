<script lang="ts">
	interface Props {
		prevHref?: string;
		prevLabel?: string;
		nextHref?: string;
		nextLabel?: string;
		progressLabel?: string;
		progressPct?: number; // 0-100
		children?: import('svelte').Snippet;
	}

	let {
		prevHref,
		prevLabel,
		nextHref,
		nextLabel,
		progressLabel,
		progressPct,
		children
	}: Props = $props();
</script>

<footer class="workflow-footer">
	<div class="workflow-footer-inner">
		<div class="workflow-footer-prev">
			{#if prevHref}
				<a href={prevHref}>
					<button class="secondary">← {prevLabel ?? 'Back'}</button>
				</a>
			{/if}
		</div>

		<div class="workflow-footer-progress">
			{#if progressLabel}
				<span class="workflow-footer-progress-label">{progressLabel}</span>
			{/if}
			{#if progressPct !== undefined}
				<div class="workflow-footer-progress-bar">
					<div
						class="workflow-footer-progress-fill"
						style="width: {Math.max(0, Math.min(100, progressPct))}%;"
					></div>
				</div>
			{/if}
			{#if children}{@render children()}{/if}
		</div>

		<div class="workflow-footer-next">
			{#if nextHref}
				<a href={nextHref}>
					<button class="primary">{nextLabel ?? 'Next'} →</button>
				</a>
			{/if}
		</div>
	</div>
</footer>
