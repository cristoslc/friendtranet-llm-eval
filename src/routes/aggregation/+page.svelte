<script lang="ts">
	import { hardwareTiers } from '$lib/data/tiers';
	import { validateImport, type ExportData } from '$lib/stores/export';
	import WorkflowFooter from '$lib/components/WorkflowFooter.svelte';

	let members = $state<ExportData[]>([]);
	let anonymize = $state(false);
	let socialConfirmed = $state(false);
	let dragover = $state(false);
	let importError = $state('');

	function memberName(member: ExportData, index: number): string {
		return anonymize ? `Member ${String.fromCharCode(65 + index)}` : member.displayName;
	}

	function formatDollar(n: number): string {
		return '$' + Math.round(n).toLocaleString();
	}

	async function handleFiles(files: FileList | null) {
		if (!files) return;
		importError = '';
		for (const file of files) {
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				if (validateImport(data)) {
					members = [...members, data];
				} else {
					importError = `Invalid file: ${file.name} — schema mismatch.`;
				}
			} catch {
				importError = `Failed to parse: ${file.name}`;
			}
		}
	}

	function removeMember(index: number) {
		members = members.filter((_, i) => i !== index);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	// Aggregation computations
	function groupRiskTotal(): number {
		return members.reduce((s, m) => s + m.combined.riskValue, 0);
	}

	function groupPrincipleTotal(): number {
		return members.reduce((s, m) => s + m.combined.principleValue, 0);
	}

	function groupCombinedTotal(): number {
		return members.reduce((s, m) => s + m.combined.totalValue, 0);
	}

	function capabilityFloor(): string | null {
		let highest: string | null = null;
		const tierOrder = ['mini', 'small', 'medium', 'large'];
		let highestIdx = -1;
		for (const m of members) {
			if (m.w3.personalMinimumTier) {
				const idx = tierOrder.indexOf(m.w3.personalMinimumTier);
				if (idx > highestIdx) {
					highestIdx = idx;
					highest = m.w3.personalMinimumTier;
				}
			}
		}
		return highest;
	}

	type Decision = 'go' | 'smaller' | 'defer' | 'skip';

	function computeDecision(): { decision: Decision; tier: string | null; explanation: string } {
		const total = groupCombinedTotal();
		const floor = capabilityFloor();
		const justified = hardwareTiers.filter((t) => total >= t.annualTCO);

		if (justified.length === 0) {
			return { decision: 'skip', tier: null, explanation: `Combined value (${formatDollar(total)}/year) doesn't reach any tier's annual cost. Stay on API + Team Premium stack.` };
		}

		const bestJustified = justified[justified.length - 1];

		if (!floor || !socialConfirmed) {
			if (!floor && !socialConfirmed) {
				return { decision: 'defer', tier: bestJustified.id, explanation: `Economic case passes at ${bestJustified.label}, but capability floor is unknown and social dimension not confirmed. Complete W3 evaluations and confirm social readiness.` };
			}
			if (!floor) {
				return { decision: 'defer', tier: bestJustified.id, explanation: `Economic case passes at ${bestJustified.label}, but no member completed capability evaluation. Run W3 to confirm.` };
			}
			return { decision: 'defer', tier: bestJustified.id, explanation: `Economic and capability checks pass, but social dimension not confirmed. Resolve hosting, capital structure, and values alignment.` };
		}

		const tierOrder = hardwareTiers.map((t) => t.id);
		const floorIdx = tierOrder.indexOf(floor);
		const justifiedIdx = tierOrder.indexOf(bestJustified.id);

		if (justifiedIdx >= floorIdx) {
			return { decision: 'go', tier: bestJustified.id, explanation: `All three dimensions pass at ${bestJustified.label}. Proceed to capital structure conversation.` };
		}

		return { decision: 'smaller', tier: bestJustified.id, explanation: `Economic case passes at ${bestJustified.label}, but capability floor requires a higher tier. Consider whether partial coverage is acceptable.` };
	}

	function getRedFlags(): string[] {
		const flags: string[] = [];
		const total = groupCombinedTotal();

		for (let i = 0; i < members.length; i++) {
			const pct = total > 0 ? (members[i].combined.totalValue / total) * 100 : 0;
			if (pct > 70) {
				flags.push(`${memberName(members[i], i)}'s scores account for ${Math.round(pct)}% of the group total.`);
			}
		}

		const riskDominant = members.filter((m) => m.combined.riskValue > m.combined.principleValue * 3);
		if (riskDominant.length > members.length / 2) {
			flags.push('Risk values exceed principle values by >3x for most members. This decision is primarily risk-driven.');
		}

		const principleDominant = members.filter((m) => m.combined.principleValue > m.combined.riskValue * 3);
		if (principleDominant.length > members.length / 2) {
			flags.push('Principle values exceed risk values by >3x for most members. This decision is primarily values-driven.');
		}

		const anyCleared = members.some((m) => m.w3.personalMinimumTier);
		if (members.length > 0 && !anyCleared && members.some((m) => m.w3.evaluated)) {
			flags.push('No member cleared even the mini tier. The group may not have sovereignty-gated workloads that benefit from local hardware.');
		}

		return flags;
	}

	function exportReport() {
		const total = groupCombinedTotal();
		const { decision, explanation } = computeDecision();
		const flags = getRedFlags();

		let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sovereignty Stack Group Report</title>
<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}
table{width:100%;border-collapse:collapse}th,td{padding:0.5rem;text-align:left;border-bottom:1px solid #ddd}
th{background:#f5f5f5}.flag{padding:0.75rem;border-left:4px solid #d97706;background:#fef3c7;margin:0.5rem 0;border-radius:0 6px 6px 0}</style></head>
<body><h1>Sovereignty Stack Group Report</h1>
<p>Generated: ${new Date().toLocaleString()}</p>
<h2>Member Summaries</h2><table><tr><th>Member</th><th>Risk</th><th>Principle</th><th>Combined</th><th>Min Tier</th></tr>`;

		members.forEach((m, i) => {
			html += `<tr><td>${memberName(m, i)}</td><td>${formatDollar(m.combined.riskValue)}</td><td>${formatDollar(m.combined.principleValue)}</td><td>${formatDollar(m.combined.totalValue)}</td><td>${m.w3.personalMinimumTier ?? 'N/A'}</td></tr>`;
		});

		html += `</table><h2>Group Totals</h2><p><strong>Combined:</strong> ${formatDollar(total)}/year (Risk: ${formatDollar(groupRiskTotal())} + Principle: ${formatDollar(groupPrincipleTotal())})</p>`;
		html += `<h2>Decision: ${decision.toUpperCase()}</h2><p>${explanation}</p>`;

		if (flags.length > 0) {
			html += `<h2>Red Flags</h2>`;
			flags.forEach((f) => { html += `<div class="flag">${f}</div>`; });
		}

		html += `</body></html>`;

		const blob = new Blob([html], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'sovereignty-group-report.html';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="container-with-margin">
	<aside class="title-panel">
		<h1>Group Aggregation</h1>
		<p>Import exported worksheets from group members and compute the group decision.</p>

		<div class="summary-card">
			<h3>Imported</h3>
			<div class="big-value">{members.length}</div>
			<div class="small-note">member{members.length === 1 ? '' : 's'}</div>

			{#if members.length > 0}
				<h3 style="margin-top: 1rem;">Group total</h3>
				<div style="font-size: 1.1rem; font-weight: 600;">
					{formatDollar(groupCombinedTotal())}/yr
				</div>
				<div class="small-note">
					Risk {formatDollar(groupRiskTotal())} + principle {formatDollar(
						groupPrincipleTotal()
					)}
				</div>

				{#if capabilityFloor()}
					<h3 style="margin-top: 1rem;">Capability floor</h3>
					<div class="small-note">{capabilityFloor()}</div>
				{/if}
			{/if}
		</div>
	</aside>

	<main>

<!-- Import -->
<div class="card" style="margin-top: 1rem;">
	<h2>Import Member Results</h2>
	<div
		class="drop-zone"
		class:dragover
		role="button"
		tabindex="0"
		ondragover={(e) => { e.preventDefault(); dragover = true; }}
		ondragleave={() => (dragover = false)}
		ondrop={handleDrop}
		onclick={() => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = '.json';
			input.multiple = true;
			input.onchange = () => handleFiles(input.files);
			input.click();
		}}
		onkeydown={(e) => { if (e.key === 'Enter') { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.multiple = true; input.onchange = () => handleFiles(input.files); input.click(); } }}
	>
		<p>Drop JSON export files here, or click to browse</p>
		<p class="muted">Accepts multiple files</p>
	</div>
	{#if importError}
		<p style="color: var(--color-danger); margin-top: 0.5rem; font-size: 0.875rem;">{importError}</p>
	{/if}
</div>

{#if members.length > 0}
	<!-- Controls -->
	<div class="card">
		<div style="display: flex; justify-content: space-between; align-items: center;">
			<label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
				<input type="checkbox" bind:checked={anonymize} />
				Anonymize member names
			</label>
			<span class="muted">{members.length} member{members.length > 1 ? 's' : ''} imported</span>
		</div>
	</div>

	<!-- Member cards -->
	{#each members as member, i}
		<div class="card">
			<div style="display: flex; justify-content: space-between; align-items: flex-start;">
				<h3>{memberName(member, i)}</h3>
				<div style="display: flex; gap: 0.5rem; align-items: center;">
					{#if member.w3.evaluated}
						<span class="badge go">Complete</span>
					{:else}
						<span class="badge warn">Partial (W1+W2 only)</span>
					{/if}
					<button class="secondary" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;" onclick={() => removeMember(i)}>Remove</button>
				</div>
			</div>
			<table>
				<tbody>
					<tr>
						<td>Risk value</td>
						<td style="text-align: right;">{formatDollar(member.combined.riskValue)}/yr</td>
					</tr>
					<tr>
						<td>Principle WTP</td>
						<td style="text-align: right;">{formatDollar(member.combined.principleValue)}/yr</td>
					</tr>
					<tr>
						<td><strong>Combined</strong></td>
						<td style="text-align: right; font-weight: 600;">{formatDollar(member.combined.totalValue)}/yr</td>
					</tr>
					<tr>
						<td>Minimum adequate tier</td>
						<td style="text-align: right;">{member.w3.personalMinimumTier ?? 'Not evaluated'}</td>
					</tr>
				</tbody>
			</table>
			<div style="margin-top: 0.5rem;">
				<div style="height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden;">
					<div style="height: 100%; width: {groupCombinedTotal() > 0 ? (member.combined.totalValue / groupCombinedTotal()) * 100 : 0}%; background: var(--color-primary); border-radius: 3px;"></div>
				</div>
				<span class="muted" style="font-size: 0.7rem;">{Math.round(groupCombinedTotal() > 0 ? (member.combined.totalValue / groupCombinedTotal()) * 100 : 0)}% of group total</span>
			</div>
		</div>
	{/each}

	<!-- Group totals -->
	<div class="card" style="margin-top: 1.5rem;">
		<h2>Group Totals</h2>
		<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; text-align: center; margin-bottom: 1rem;">
			<div>
				<div class="muted" style="font-size: 0.75rem;">Risk</div>
				<div style="font-size: 1.25rem; font-weight: 600;">{formatDollar(groupRiskTotal())}/yr</div>
			</div>
			<div>
				<div class="muted" style="font-size: 0.75rem;">Principle</div>
				<div style="font-size: 1.25rem; font-weight: 600;">{formatDollar(groupPrincipleTotal())}/yr</div>
			</div>
			<div>
				<div class="muted" style="font-size: 0.75rem;">Combined</div>
				<div style="font-size: 1.5rem; font-weight: 700;">{formatDollar(groupCombinedTotal())}/yr</div>
			</div>
		</div>

		<h3>Tier Comparison</h3>
		<table>
			<thead>
				<tr>
					<th>Tier</th>
					<th>Config</th>
					<th>Annual TCO</th>
					<th>Justified?</th>
					<th>Capability</th>
				</tr>
			</thead>
			<tbody>
				{#each hardwareTiers as tier}
					{@const justified = groupCombinedTotal() >= tier.annualTCO}
					<tr>
						<td style="font-weight: 500;">{tier.label}</td>
						<td class="muted">{tier.config}</td>
						<td>{formatDollar(tier.annualTCO)}</td>
						<td>
							{#if justified}
								<span class="badge go">Yes</span>
							{:else}
								<span class="badge skip">No</span>
							{/if}
						</td>
						<td class="muted">{tier.capabilityCeiling}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Three-dimensional check -->
	<div class="card">
		<h2>Three-Dimensional Check</h2>
		<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
			<div class="card" style="text-align: center;">
				<h3>Economic</h3>
				{#if hardwareTiers.some((t) => groupCombinedTotal() >= t.annualTCO)}
					<span class="badge go">Pass</span>
					<p class="muted" style="margin-top: 0.5rem;">
						{formatDollar(groupCombinedTotal())} >= {formatDollar(hardwareTiers.filter((t) => groupCombinedTotal() >= t.annualTCO).at(-1)?.annualTCO ?? 0)}
					</p>
				{:else}
					<span class="badge skip">Fail</span>
					<p class="muted" style="margin-top: 0.5rem;">Below all tier thresholds.</p>
				{/if}
			</div>
			<div class="card" style="text-align: center;">
				<h3>Capability</h3>
				{#if capabilityFloor()}
					<span class="badge go">Evaluated</span>
					<p class="muted" style="margin-top: 0.5rem;">Floor: {capabilityFloor()}</p>
				{:else}
					<span class="badge warn">Unknown</span>
					<p class="muted" style="margin-top: 0.5rem;">No W3 evaluations completed.</p>
				{/if}
			</div>
			<div class="card" style="text-align: center;">
				<h3>Social</h3>
				<label style="display: flex; align-items: center; gap: 0.5rem; justify-content: center; margin-top: 0.5rem;">
					<input type="checkbox" bind:checked={socialConfirmed} />
					<span style="font-size: 0.8rem;">Confirmed</span>
				</label>
				<p class="muted" style="margin-top: 0.5rem; font-size: 0.75rem;">
					Hosting, capital structure, values alignment resolved?
				</p>
			</div>
		</div>
	</div>

	<!-- Decision -->
	{@const { decision, explanation } = computeDecision()}
	<div class="card">
		<h2>Decision</h2>
		<div class="decision-card {decision === 'go' ? 'go' : decision === 'skip' ? 'skip' : 'warn'}">
			<h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">
				{decision === 'go' ? 'GO' : decision === 'smaller' ? 'SMALLER TIER' : decision === 'defer' ? 'DEFER' : 'SKIP'}
			</h2>
			<p>{explanation}</p>
		</div>
	</div>

	<!-- Red flags -->
	{@const flags = getRedFlags()}
	{#if flags.length > 0}
		<div class="card">
			<h2>Red Flags</h2>
			{#each flags as flag}
				<div class="flag-card">{flag}</div>
			{/each}
		</div>
	{/if}

	<!-- Export -->
	<div class="card" style="text-align: center;">
		<button class="primary" onclick={exportReport}>Export Group Report</button>
		<p class="muted" style="margin-top: 0.5rem;">
			Downloads a printable HTML report with all results.
		</p>
	</div>
{/if}

	</main>

	<aside class="margin-panel">
		<h4>The three-dimensional check</h4>
		<p class="legend-detail">
			A purchase is justified only when <strong>economic</strong>, <strong>capability</strong>,
			and <strong>social</strong> dimensions all pass.
		</p>
		<p class="legend-detail" style="margin-top: 0.75rem;">
			The social dimension is a manual checkbox — the SPA can't evaluate whether hosting,
			capital structure, and values alignment are resolved.
		</p>
		<p class="legend-detail" style="margin-top: 0.75rem;">
			<strong>SKIP</strong> is rendered neutral, not red. Staying on cloud APIs is a valid
			outcome — the SPA is a decision tool, not a persuasion tool.
		</p>
		<p class="legend-detail" style="margin-top: 0.75rem;">
			<strong>Red flags:</strong> surfaced when a single member dominates, when risk dwarfs
			principle (or vice versa), or when nobody cleared the mini tier. Meant to prompt group
			discussion, not block the decision.
		</p>
	</aside>
</div>

<WorkflowFooter
	prevHref="/worksheet3"
	prevLabel="Capability Evaluation"
	nextHref="/"
	nextLabel="Home"
	progressLabel={members.length === 0
		? 'Import JSONs to begin'
		: `${members.length} member${members.length === 1 ? '' : 's'} imported`}
	progressPct={members.length > 0 ? 100 : 0}
/>
