#!/usr/bin/env node
/**
 * SPEC-010 follow-up: unit tests for
 *   - pure metrics helper (computeTierMetricsPure, personalMinimumTierPure)
 *   - export.buildW3Export populating ratings + metrics
 *
 * Runs under node's native TypeScript strip mode (no browser, no dev server).
 * Usage: node tests/spec-010-followup-unit.mjs
 */

import {
	computeTierMetricsPure,
	personalMinimumTierPure
} from '../src/lib/stores/w3-pure.ts';
import { buildW3Export } from '../src/lib/stores/w3-export-builder.ts';

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, name) {
	if (cond) { passed++; console.log(`  PASS  ${name}`); }
	else { failed++; failures.push(name); console.log(`  FAIL  ${name}`); }
}

function assertEqual(actual, expected, name) {
	const eq = JSON.stringify(actual) === JSON.stringify(expected);
	if (!eq) console.log(`    actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
	assert(eq, name);
}

console.log('SPEC-010 follow-up unit tests');

// ───── computeTierMetricsPure ─────
{
	const tiers = [
		{ tierId: 'mini', tierLabel: 'Mini', modelId: 'mini-m' },
		{ tierId: 'anchor', tierLabel: 'Anchor', modelId: 'anchor-m' }
	];

	// No ratings → all zeros, not meeting threshold
	const empty = computeTierMetricsPure([], {}, tiers);
	assertEqual(empty.length, 2, 'metrics returns one entry per tier');
	assert(empty.every((m) => m.sampleSize === 0 && !m.meetsThreshold), 'empty ratings → no sample, no pass');

	// Single perfect rating for mini → passes
	const perfectMini = computeTierMetricsPure(
		[{ conversationId: 'c1', turnIndex: 0, ratings: { 'mini-m': 4 } }],
		{},
		tiers
	);
	const mini = perfectMini.find((m) => m.tierId === 'mini');
	assert(mini.sampleSize === 1, 'single rating counts in sampleSize');
	assert(mini.adequacyRate === 1 && mini.meetsThreshold, 'a single 4/4 meets threshold');

	// 8/10 adequate but 2/10 critical failures → adequacy ≥0.8 but critical >0.1 → fails
	const withCrit = computeTierMetricsPure(
		Array.from({ length: 10 }, (_, i) => ({
			conversationId: 'c1',
			turnIndex: i,
			ratings: { 'anchor-m': i < 2 ? 1 : 4 }
		})),
		{},
		tiers
	);
	const anchor = withCrit.find((m) => m.tierId === 'anchor');
	assert(
		anchor.adequacyRate === 0.8 && anchor.criticalFailureRate === 0.2 && !anchor.meetsThreshold,
		'critical failure rate > 0.1 defeats threshold even at 80% adequacy'
	);

	// skippedTurns sourced from evalResults per-model-id, not per-key
	const skippedMetrics = computeTierMetricsPure(
		[],
		{ 'c1:mini-m': { modelId: 'mini-m', skippedTurns: [2, 3] } },
		tiers
	);
	const miniSkipped = skippedMetrics.find((m) => m.tierId === 'mini');
	assert(miniSkipped.skippedTurns === 2, 'skippedTurns counts array length for matching model');
}

// ───── personalMinimumTierPure ─────
{
	const metrics = [
		{ tierId: 'mini', meetsThreshold: false },
		{ tierId: 'small', meetsThreshold: true },
		{ tierId: 'medium', meetsThreshold: true }
	];
	assert(
		personalMinimumTierPure(metrics, ['mini', 'small', 'medium', 'large']) === 'small',
		'returns lowest tier that meets threshold'
	);
	assert(
		personalMinimumTierPure([{ tierId: 'mini', meetsThreshold: false }], ['mini']) === null,
		'no tier passes → null'
	);
}

// ───── buildW3Export ─────
{
	const tiers = [
		{ tierId: 'mini', tierLabel: 'Mini', modelId: 'mini-m' },
		{ tierId: 'anchor', tierLabel: 'Anchor', modelId: 'anchor-m' }
	];

	// No state → evaluated: false, nothing else
	assertEqual(
		buildW3Export(null, tiers),
		{ evaluated: false },
		'null w3 state → evaluated:false, no other fields'
	);
	assertEqual(
		buildW3Export({ turnRatings: [] }, tiers),
		{ evaluated: false },
		'empty turnRatings → evaluated:false'
	);

	// With ratings → includes perTier metrics, personalMinimumTier, turnRatings
	const w3 = {
		evalResults: {},
		turnRatings: [
			{ conversationId: 'c1', turnIndex: 0, ratings: { 'mini-m': 4, 'anchor-m': 4 } }
		]
	};
	const exported = buildW3Export(w3, tiers);
	assert(exported.evaluated === true, 'with ratings → evaluated:true');
	assert(Array.isArray(exported.perTier) && exported.perTier.length === 2, 'perTier: one entry per supplied tier');
	assert(
		exported.perTier.find((t) => t.tierId === 'mini').sampleSize === 1,
		'perTier includes sampleSize from ratings'
	);
	assert(
		exported.personalMinimumTier === 'mini',
		'personalMinimumTier is lowest passing tier'
	);
	assert(Array.isArray(exported.turnRatings) && exported.turnRatings.length === 1, 'raw turnRatings copied');
	assert(
		exported.turnRatings[0].ratings['mini-m'] === 4,
		'raw turnRatings preserve per-model scores'
	);

	// turnRatings copy is deep — mutating the export does not affect the source
	exported.turnRatings[0].ratings['mini-m'] = 1;
	assert(
		w3.turnRatings[0].ratings['mini-m'] === 4,
		'export turnRatings is a shallow copy of ratings map (source unchanged)'
	);
}

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.log('Failures:'); failures.forEach((f) => console.log(`  - ${f}`));
	process.exit(1);
}
