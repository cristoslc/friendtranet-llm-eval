<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	let { children } = $props();

	const steps = [
		{ path: '/', label: 'Home' },
		{ path: '/worksheet1', label: 'W1: Risk' },
		{ path: '/worksheet2', label: 'W2: Principle' },
		{ path: '/worksheet3', label: 'W3: Capability' },
		{ path: '/aggregation', label: 'Group' }
	];

	type Theme = 'system' | 'light' | 'dark';
	let theme = $state<Theme>('system');

	onMount(() => {
		const saved = localStorage.getItem('theme') as Theme | null;
		if (saved === 'light' || saved === 'dark' || saved === 'system') {
			theme = saved;
			applyTheme(theme);
		}
	});

	function applyTheme(t: Theme) {
		const html = document.documentElement;
		if (t === 'system') {
			html.removeAttribute('data-theme');
		} else {
			html.setAttribute('data-theme', t);
		}
	}

	function cycleTheme() {
		theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
		localStorage.setItem('theme', theme);
		applyTheme(theme);
	}

	function themeLabel(t: Theme): string {
		return t === 'system' ? '◐ auto' : t === 'light' ? '☀ light' : '☾ dark';
	}

	function stepClass(path: string): string {
		if (page.url.pathname === path) return 'stepper-step active';
		return 'stepper-step';
	}
</script>

<svelte:head>
	<title>Sovereignty Stack Decision</title>
</svelte:head>

<header
	style="position: sticky; top: 0; z-index: 20; background: var(--color-surface); border-bottom: 1px solid var(--color-border); box-shadow: var(--shadow);"
>
	<div class="container" style="display: flex; align-items: center; gap: 1rem;">
		<nav class="stepper" style="flex: 1;">
			{#each steps as step}
				<a href={step.path} class={stepClass(step.path)}>{step.label}</a>
			{/each}
		</nav>
		<button class="theme-toggle" onclick={cycleTheme} aria-label="Toggle theme">
			{themeLabel(theme)}
		</button>
	</div>
</header>

<main style="padding-top: 1.5rem; padding-bottom: 4rem;">
	{@render children()}
</main>
