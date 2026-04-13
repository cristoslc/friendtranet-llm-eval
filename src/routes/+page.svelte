<script lang="ts">
	import { base } from '$app/paths';
</script>

<div class="container" style="max-width: 720px;">
	<h1>Sovereignty Stack Decision</h1>
	<p class="muted">Should your friend group buy local LLM inference hardware?</p>

	<div class="card" style="margin-top: 1.5rem;">
		<h2>The sovereignty question</h2>
		<p>
			Commercial AI providers process your prompts on their infrastructure. Even with Zero Data
			Retention (ZDR) commitments and Data Processing Agreements (DPAs), some users prefer that
			certain content never traverse third-party systems. Local hardware running open-weight models
			is the alternative — at the cost of capital expenditure, operational burden, and usually lower
			capability ceiling.
		</p>
		<details style="margin-top: 0.75rem;">
			<summary style="cursor: pointer; color: var(--color-primary); font-weight: 500;">
				ZDR vs. DPA — what's the difference?
			</summary>
			<div style="padding: 0.75rem 0 0 1rem;">
				<p>
					<strong>ZDR (Zero Data Retention)</strong> is a technical commitment: the provider does not
					persistently store your prompts or completions past the immediate request.
				</p>
				<p>
					<strong>DPA (Data Processing Agreement)</strong> is a legal contract establishing roles,
					purpose limitation, security obligations, and breach notification.
				</p>
				<p>
					<strong>Together:</strong> ZDR minimizes surface area, DPA provides recourse.
				</p>
			</div>
		</details>

		<h3 style="margin-top: 1.5rem;">Three dimensions, one decision</h3>
		<p style="margin-top: 0;">Hardware vs. API is not binary — it's a three-dimensional problem:</p>
		<ol style="padding-left: 1.5rem; margin-bottom: 0.75rem;">
			<li style="margin-bottom: 0.5rem;">
				<strong>Economic:</strong> Does the group's combined value exceed the hardware tier's annual cost?
			</li>
			<li style="margin-bottom: 0.5rem;">
				<strong>Capability:</strong> Does the tier run models good enough for each member's work?
			</li>
			<li style="margin-bottom: 0.5rem;">
				<strong>Social:</strong> Is hosting resolved? Is the purchase genuinely shared?
			</li>
		</ol>
		<p class="muted" style="margin-top: 0;">
			A purchase is justified only when all three hold. Any single dimension failing is a veto.
		</p>

		<h3 style="margin-top: 1.5rem;">How it works</h3>
		<ol style="padding-left: 1.5rem; margin-bottom: 0.75rem;">
			<li style="margin-bottom: 0.5rem;">
				<strong>Risk Scorecard</strong> — quantify expected annual loss from provider failure modes. No API key needed.
			</li>
			<li style="margin-bottom: 0.5rem;">
				<strong>Principle Scorecard</strong> — capture values-based willingness-to-pay. No API key needed.
			</li>
			<li style="margin-bottom: 0.5rem;">
				<strong>Capability Evaluation</strong> — blind-test local models vs. frontier baseline. Requires OpenRouter API key.
			</li>
		</ol>
		<p style="margin-top: 0;">Then one person aggregates everyone's results into a group decision.</p>
	</div>

	<div class="card" style="text-align: center; padding: 2rem;">
		<p class="muted" style="margin-bottom: 1rem;">
			Everything stays in your browser. No backend, no analytics, no telemetry.
		</p>
		<a href="{base}/worksheet1">
			<button class="primary" style="font-size: 1rem; padding: 0.75rem 2rem;">
				Begin Assessment
			</button>
		</a>
		<p style="margin-top: 1rem;">
			<a href="{base}/aggregation" style="color: var(--color-primary); font-size: 0.875rem;">
				Or go to Group Aggregation →
			</a>
		</p>
	</div>
</div>
