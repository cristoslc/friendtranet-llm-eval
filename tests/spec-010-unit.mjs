#!/usr/bin/env node
/**
 * Unit tests for SPEC-010 pure helpers (src/lib/stores/w3-pure.ts).
 * Runs in node's native TypeScript strip mode (node 22+). No browser,
 * no dev server, no OpenRouter needed.
 *
 * Usage: node tests/spec-010-unit.mjs
 */

import {
	seededShuffle,
	buildReplayMessages,
	computeGeneratedTurnCount,
	hasMoreTurnsToGenerate,
	estimateTurnTokens
} from '../src/lib/stores/w3-pure.ts';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name) {
	if (condition) {
		passed++;
		console.log(`  PASS  ${name}`);
	} else {
		failed++;
		failures.push(name);
		console.log(`  FAIL  ${name}`);
	}
}

function assertEqual(actual, expected, name) {
	const eq = JSON.stringify(actual) === JSON.stringify(expected);
	if (!eq) console.log(`    actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
	assert(eq, name);
}

console.log('SPEC-010 unit tests: w3-pure.ts');

// computeGeneratedTurnCount — core of getGeneratedTurnCount and hasMoreTurns
{
	const results = {};
	assertEqual(
		computeGeneratedTurnCount(results, 'c1', ['m1', 'm2']),
		0,
		'zero models generated → 0'
	);

	results['c1:m1'] = { responses: ['turn-0'] };
	assertEqual(
		computeGeneratedTurnCount(results, 'c1', ['m1', 'm2']),
		0,
		'one model has turn 0 but m2 has none → 0 (min)'
	);

	results['c1:m2'] = { responses: ['turn-0'] };
	assertEqual(
		computeGeneratedTurnCount(results, 'c1', ['m1', 'm2']),
		1,
		'both models have turn 0 → 1'
	);

	results['c1:m1'].responses.push('turn-1');
	assertEqual(
		computeGeneratedTurnCount(results, 'c1', ['m1', 'm2']),
		1,
		'uneven — m1 has 2, m2 has 1 → 1 (min)'
	);

	results['c1:m2'].responses.push('turn-1');
	assertEqual(
		computeGeneratedTurnCount(results, 'c1', ['m1', 'm2']),
		2,
		'both models have turn 0+1 → 2'
	);

	assertEqual(
		computeGeneratedTurnCount(results, 'c1', []),
		0,
		'empty model list → 0'
	);

	assertEqual(
		computeGeneratedTurnCount({}, 'c1', ['m1']),
		0,
		'no results at all → 0'
	);
}

// hasMoreTurnsToGenerate
{
	assert(hasMoreTurnsToGenerate(0, 5), '0/5 generated → more turns');
	assert(hasMoreTurnsToGenerate(4, 5), '4/5 generated → one more turn');
	assert(!hasMoreTurnsToGenerate(5, 5), '5/5 generated → no more turns');
	assert(!hasMoreTurnsToGenerate(0, 0), 'zero-turn conversation → nothing to do');
}

// buildReplayMessages — sequential replay history
{
	const userTurns = [
		{ role: 'user', content: 'Q1' },
		{ role: 'user', content: 'Q2' },
		{ role: 'user', content: 'Q3' }
	];

	// turn 0: no preserved, just the first user message
	assertEqual(
		buildReplayMessages(userTurns, [], 0),
		[{ role: 'user', content: 'Q1' }],
		'turn 0 replay has only the first user message'
	);

	// turn 1: preserve turn-0 pair, add Q2
	assertEqual(
		buildReplayMessages(userTurns, ['A1'], 1),
		[
			{ role: 'user', content: 'Q1' },
			{ role: 'assistant', content: 'A1' },
			{ role: 'user', content: 'Q2' }
		],
		'turn 1 replay preserves turn-0 context'
	);

	// turn 2: preserve turns 0 and 1
	assertEqual(
		buildReplayMessages(userTurns, ['A1', 'A2'], 2),
		[
			{ role: 'user', content: 'Q1' },
			{ role: 'assistant', content: 'A1' },
			{ role: 'user', content: 'Q2' },
			{ role: 'assistant', content: 'A2' },
			{ role: 'user', content: 'Q3' }
		],
		'turn 2 replay preserves turns 0 and 1'
	);

	// missing preserved slot: treated as empty assistant turn rather than crash
	assertEqual(
		buildReplayMessages(userTurns, [], 1),
		[
			{ role: 'user', content: 'Q1' },
			{ role: 'assistant', content: '' },
			{ role: 'user', content: 'Q2' }
		],
		'missing preserved response becomes empty assistant message'
	);
}

// seededShuffle — deterministic, permutation
{
	const source = ['a', 'b', 'c', 'd', 'e'];
	const s1 = seededShuffle(source, 'conv-1-turn-0');
	const s2 = seededShuffle(source, 'conv-1-turn-0');
	assertEqual(s1, s2, 'same seed → same output');

	const sorted = [...s1].sort();
	assertEqual(sorted, ['a', 'b', 'c', 'd', 'e'], 'shuffle is a permutation');

	const s3 = seededShuffle(source, 'conv-1-turn-1');
	assert(JSON.stringify(s3) !== JSON.stringify(s1), 'different seed → different order (usually)');

	assertEqual(seededShuffle([], 'any'), [], 'empty input → empty output');
	assertEqual(seededShuffle(['only'], 'seed'), ['only'], 'singleton input unchanged');
}

// estimateTurnTokens
{
	const first = 'hello world';
	const one = estimateTurnTokens(first, 1);
	const two = estimateTurnTokens(first, 2);
	assert(two === one * 2, 'tokens scale linearly with tier count');
	assert(estimateTurnTokens('', 3) >= 300, 'minimum floor enforced for short prompts (100 × 3)');
}

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.log('Failures:');
	failures.forEach((f) => console.log(`  - ${f}`));
	process.exit(1);
}
