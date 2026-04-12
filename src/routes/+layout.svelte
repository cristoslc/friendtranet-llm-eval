<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { unsupportedReason } from '$lib/browser-guard';
	import { resetAllData } from '$lib/stores/reset';
	let { children } = $props();

	let settingsOpen = $state(false);
	let resetting = $state(false);

	async function handleReset() {
		const msg =
			'This will delete all your worksheet answers, W3 evaluation results, ratings, and any imported group data. Your OpenRouter API key and theme preference will stay. Continue?';
		if (!confirm(msg)) return;
		resetting = true;
		await resetAllData();
		resetting = false;
		settingsOpen = false;
		// Full reload so all stores re-initialize from empty.
		window.location.href = '/';
	}

	const steps = [
		{ path: '/', label: 'Home' },
		{ path: '/worksheet1', label: 'W1: Risk' },
		{ path: '/worksheet2', label: 'W2: Principle' },
		{ path: '/worksheet3', label: 'W3: Capability' },
		{ path: '/aggregation', label: 'Group' }
	];

	type Theme = 'system' | 'light' | 'dark';
	let theme = $state<Theme>('system');
	let browserBlock = $state<string | null>(null);

	onMount(() => {
		browserBlock = unsupportedReason();
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
	<div class="container" style="display: flex; align-items: center; gap: 0.5rem;">
		<nav class="stepper" style="flex: 1;">
			{#each steps as step}
				<a href={step.path} class={stepClass(step.path)}>{step.label}</a>
			{/each}
		</nav>
		<button class="theme-toggle" onclick={cycleTheme} aria-label="Toggle theme">
			{themeLabel(theme)}
		</button>
		<div style="position: relative;">
			<button
				class="theme-toggle"
				onclick={() => (settingsOpen = !settingsOpen)}
				aria-label="Settings"
				aria-expanded={settingsOpen}
			>
				⚙
			</button>
			{#if settingsOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					style="position: fixed; inset: 0; z-index: 30;"
					onclick={() => (settingsOpen = false)}
				></div>
				<div
					role="menu"
					style="position: absolute; top: calc(100% + 0.5rem); right: 0; z-index: 31; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-strong); min-width: 240px; padding: 0.5rem;"
				>
					<button
						class="secondary"
						style="width: 100%; justify-content: flex-start; text-align: left; color: var(--color-danger); border-color: var(--color-danger);"
						disabled={resetting}
						onclick={handleReset}
					>
						{resetting ? 'Resetting…' : 'Reset & Clear Data'}
					</button>
					<p
						class="muted"
						style="font-size: 0.7rem; margin-top: 0.5rem; padding: 0 0.35rem; margin-bottom: 0;"
					>
						Wipes worksheet answers, W3 eval results, ratings, and group imports.
						Theme + API key stay.
					</p>
				</div>
			{/if}
		</div>
	</div>
</header>

<main style="padding-top: 1.5rem; padding-bottom: 4rem;">
	{#if browserBlock}
		<div class="container" style="max-width: 600px; margin-top: 4rem;">
			<div class="card" style="text-align: center; padding: 2.5rem;">
				<h1 style="margin-bottom: 1rem;">Browser not supported</h1>
				<p style="margin-bottom: 1rem;">{browserBlock}</p>
				<p class="muted" style="font-size: 0.85rem;">
					This is a temporary restriction while we resolve compatibility issues in other
					engines.
				</p>
			</div>
		</div>
	{:else}
		{@render children()}
	{/if}
</main>
