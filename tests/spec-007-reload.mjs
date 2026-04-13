#!/usr/bin/env node
/**
 * SPEC-007 AC #8 — tab-reload persistence for Custom conversations.
 *
 * We prime IndexedDB with a fake custom conversation + evalResults +
 * turnRatings directly (no OpenRouter calls), reload the page, and
 * assert everything is restored.
 *
 * Usage: node tests/spec-007-reload.mjs [--headed]
 * Requires preview server at http://localhost:4173.
 */

import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const HEADED = process.argv.includes('--headed');

let browser, page;
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

async function waitMs(ms) {
	await new Promise((r) => setTimeout(r, ms));
}

async function primeIndexedDB(customConv, evalResults, turnRatings) {
	// Writes via IndexedDB are async — wait for the store.put to resolve.
	return page.evaluate(
		async (conv, results, ratings) => {
			return new Promise((resolve, reject) => {
				const req = indexedDB.open('sovereignty-stack', 1);
				req.onupgradeneeded = () => {
					const db = req.result;
					if (!db.objectStoreNames.contains('worksheets')) {
						db.createObjectStore('worksheets');
					}
				};
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					const tx = db.transaction('worksheets', 'readwrite');
					tx.objectStore('worksheets').put(
						{
							selectedConversations: [conv.id],
							selectedTierIds: ['mini', 'small', 'medium', 'large'],
							modelOverrides: {},
							evalResults: results,
							turnRatings: ratings,
							evalProgress: {
								running: false,
								total: 0,
								done: 0,
								active: [],
								errors: [],
								current: '',
								currentTurn: 0,
								currentTurnTotal: 0,
								lastMessage: ''
							},
							customConversation: conv
						},
						'w3'
					);
					tx.oncomplete = () => resolve(true);
					tx.onerror = () => reject(tx.error);
				};
			});
		},
		customConv,
		evalResults,
		turnRatings
	);
}

async function run() {
	browser = await puppeteer.launch({
		headless: !HEADED,
		args: ['--no-sandbox']
	});
	page = await browser.newPage();

	console.log('\n═══ SPEC-007 AC #8: tab-reload persistence ═══\n');

	// Load the page once so the origin is set up for IndexedDB access.
	await page.goto(`${BASE}/worksheet3`, { waitUntil: 'networkidle0' });
	await waitMs(300);

	const OPENING = 'Describe how to build a vertical farm indoors.';
	const customConv = {
		id: 'custom-test-fixture',
		openingPrompt: OPENING,
		turns: [
			{ role: 'user', content: OPENING },
			{ role: 'user', content: 'What lighting should I use?' }
		],
		createdAt: '2026-04-13T00:00:00Z'
	};

	const evalResults = {
		'custom-test-fixture:qwen/qwen3.5-9b': {
			conversationId: 'custom-test-fixture',
			modelId: 'qwen/qwen3.5-9b',
			responses: ['Mini response turn 1.', 'Mini response turn 2.'],
			cachedAt: '2026-04-13T00:00:05Z'
		},
		'custom-test-fixture:anthropic/claude-opus-4-6': {
			conversationId: 'custom-test-fixture',
			modelId: 'anthropic/claude-opus-4-6',
			responses: ['Anchor response turn 1.', 'Anchor response turn 2.'],
			cachedAt: '2026-04-13T00:00:05Z'
		}
	};

	const turnRatings = [
		{
			conversationId: 'custom-test-fixture',
			turnIndex: 0,
			ratings: { 'qwen/qwen3.5-9b': 3, 'anthropic/claude-opus-4-6': 4 },
			tags: {},
			labelOrder: ['qwen/qwen3.5-9b', 'anthropic/claude-opus-4-6'],
			revealed: true
		},
		{
			conversationId: 'custom-test-fixture',
			turnIndex: 1,
			ratings: { 'qwen/qwen3.5-9b': 2 },
			tags: {},
			labelOrder: ['anthropic/claude-opus-4-6', 'qwen/qwen3.5-9b'],
			revealed: false
		}
	];

	await primeIndexedDB(customConv, evalResults, turnRatings);

	// Reload so the page hydrates from the persisted state.
	await page.reload({ waitUntil: 'networkidle0' });
	await waitMs(500);

	// 1. Custom card is rendered with the persisted id visible.
	const customCardText = await page.$eval(
		'[data-custom-card]',
		(el) => el.textContent ?? ''
	);
	assert(
		customCardText.includes('custom-test-fixture'),
		'custom conversation id appears on the Custom card after reload'
	);

	// 2. Textarea holds the opening prompt (read-only since customEnabled resets).
	const textareaValue = await page.$eval(
		'[data-custom-textarea]',
		(el) => /** @type {HTMLTextAreaElement} */ (el).value
	);
	assert(textareaValue === OPENING, 'textarea contains the persisted opening prompt after reload');

	// 3. Cached badge is present.
	assert(
		customCardText.includes('cached'),
		'cached badge shown on Custom card after reload (evalResults restored)'
	);

	// 4. Rating progress badge reflects the 2 rated turns (both have ≥1 rating).
	assert(
		customCardText.includes('2/2 rated'),
		'rating progress badge shows 2/2 rated after reload'
	);

	// 5. Rating UI resumed at the last rated turn (SPEC-006 AC #4 + custom).
	const inRatingUi = await page.evaluate(() =>
		(document.body.textContent ?? '').includes('Blind Rating')
	);
	assert(inRatingUi, 'Blind Rating UI auto-resumed on reload when prior ratings exist');

	console.log(`\n  ${passed} passed, ${failed} failed\n`);

	await browser.close();
	process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
	console.error(err);
	if (browser) await browser.close();
	process.exit(2);
});
