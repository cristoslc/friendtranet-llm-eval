<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	let { children } = $props();

	const steps = [
		{ path: '/', label: 'Home' },
		{ path: '/worksheet1', label: 'W1: Risk' },
		{ path: '/worksheet2', label: 'W2: Principle' },
		{ path: '/worksheet3', label: 'W3: Capability' },
		{ path: '/aggregation', label: 'Group' }
	];

	function stepClass(path: string): string {
		if (page.url.pathname === path) return 'stepper-step active';
		return 'stepper-step';
	}
</script>

<svelte:head>
	<title>Sovereignty Stack Decision</title>
</svelte:head>

<header style="background: var(--color-surface); border-bottom: 1px solid var(--color-border);">
	<div class="container">
		<nav class="stepper">
			{#each steps as step}
				<a href={step.path} class={stepClass(step.path)}>{step.label}</a>
			{/each}
		</nav>
	</div>
</header>

<main class="container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
	{@render children()}
</main>
