#!/usr/bin/env node
// SPEC-006 unit tests — pure-logic checks that do not need a browser.
// Run: node tests/spec-006-unit.mjs

// Mirror of seededShuffle in src/lib/stores/worksheet3.svelte.ts.
// Kept in sync manually — update here if the store version changes.
function seededShuffle(arr, seed) {
	const copy = [...arr];
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
	}
	for (let i = copy.length - 1; i > 0; i--) {
		hash = ((hash << 5) - hash + i) | 0;
		const j = Math.abs(hash) % (i + 1);
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

let passed = 0;
let failed = 0;
function assert(cond, name) {
	if (cond) {
		passed++;
		console.log(`  PASS  ${name}`);
	} else {
		failed++;
		console.log(`  FAIL  ${name}`);
	}
}

console.log('\n═══ SPEC-006: seededShuffle determinism + per-turn variance ═══');

const models = ['mini', 'small', 'medium', 'large', 'anchor'];

// Determinism: same seed → same output across calls.
const a = seededShuffle(models, 'conv1-0');
const b = seededShuffle(models, 'conv1-0');
assert(JSON.stringify(a) === JSON.stringify(b), 'seededShuffle is deterministic for the same seed');

// Different turn seeds produce different orderings for the same conversation.
const turn0 = seededShuffle(models, 'conv1-0');
const turn1 = seededShuffle(models, 'conv1-1');
const turn2 = seededShuffle(models, 'conv1-2');
assert(
	JSON.stringify(turn0) !== JSON.stringify(turn1),
	'turn 0 and turn 1 of same conv produce different label orders'
);
assert(
	JSON.stringify(turn1) !== JSON.stringify(turn2),
	'turn 1 and turn 2 of same conv produce different label orders'
);

// Different conversations at the same turn index differ.
const convAOrder = seededShuffle(models, 'conv-a-0');
const convBOrder = seededShuffle(models, 'conv-b-0');
assert(
	JSON.stringify(convAOrder) !== JSON.stringify(convBOrder),
	'different conversations produce different label orders at turn 0'
);

// The shuffled array is a permutation (same set of members).
const sorted = [...models].sort();
const shuffledSorted = [...turn0].sort();
assert(
	JSON.stringify(sorted) === JSON.stringify(shuffledSorted),
	'shuffle output contains the same elements (permutation only)'
);

// Broad variance check across 20 turn indices — at least half should produce
// unique orderings (guarding against a degenerate seed collapse).
const orderings = new Set();
for (let i = 0; i < 20; i++) {
	orderings.add(JSON.stringify(seededShuffle(models, `conv-x-${i}`)));
}
assert(orderings.size >= 10, `at least 10 distinct orderings across 20 turns (got ${orderings.size})`);

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
