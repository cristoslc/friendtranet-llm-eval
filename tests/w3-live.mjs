#!/usr/bin/env node
/**
 * Live W3 evaluation test against OpenRouter.
 * Picks one short conversation, runs it through all 5 tiers, verifies responses.
 *
 * Usage: OPENROUTER_KEY=sk-or-... node tests/w3-live.mjs [--headed]
 */

import puppeteer from 'puppeteer';

const BASE = 'http://localhost:5173';
const HEADED = process.argv.includes('--headed');
const KEY = process.env.OPENROUTER_KEY;

if (!KEY) {
	console.error('ERROR: OPENROUTER_KEY env var required');
	process.exit(1);
}

let browser, page;
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

async function waitMs(ms) {
	await new Promise((r) => setTimeout(r, ms));
}

async function run() {
	console.log('W3 Live Evaluation Test');
	console.log('=======================\n');

	browser = await puppeteer.launch({
		headless: !HEADED,
		args: ['--no-sandbox']
	});
	page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });

	// Capture console errors
	page.on('console', (msg) => {
		if (msg.type() === 'error') console.log('  [browser error]', msg.text());
	});

	// Seed the API key in session storage before page load
	await page.goto(`${BASE}`, { waitUntil: 'networkidle0' });
	await page.evaluate((k) => {
		sessionStorage.setItem('openrouter-key', k);
	}, KEY);

	// Clear any IndexedDB state from prior tests
	await page.evaluate(async () => {
		return new Promise((resolve) => {
			const req = indexedDB.deleteDatabase('sovereignty-stack');
			req.onsuccess = () => resolve();
			req.onerror = () => resolve();
			req.onblocked = () => resolve();
		});
	});
	await waitMs(500);

	// Navigate to W3
	await page.goto(`${BASE}/worksheet3`, { waitUntil: 'networkidle0' });
	await waitMs(1000);

	console.log('\n--- API Key & Tier Verification ---');
	const keyStatus = await page.evaluate(() => sessionStorage.getItem('openrouter-key'));
	assert(!!keyStatus, 'API key set in session storage');

	// The app will show the key as verified if we also set keyVerified state
	// But since it checks session storage on mount, the key should auto-load
	// Let's verify by checking the "Change key" button exists
	const keyVerifiedUI = await page.evaluate(() =>
		document.body.textContent?.includes('Key verified')
	);
	assert(keyVerifiedUI, 'API key shows as verified in UI');

	// Pick one short conversation (MT-Bench has 2-turn prompts, cheapest)
	console.log('\n--- Select Shortest Conversation ---');
	const shortest = await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.checkbox-grid .checkbox-card')];
		// Find MT-Bench card (shortest) — look for routine complexity
		let minCard = null;
		let minTurns = Infinity;
		cards.forEach((c) => {
			const text = c.textContent ?? '';
			const match = text.match(/(\d+)\s*turns/);
			if (match) {
				const n = parseInt(match[1]);
				if (n < minTurns) {
					minTurns = n;
					minCard = c;
				}
			}
		});
		if (minCard) {
			const cb = minCard.querySelector('input[type="checkbox"]');
			if (cb) cb.click();
			return { turns: minTurns, text: minCard.textContent?.slice(0, 80) };
		}
		return null;
	});
	assert(!!shortest, `Selected shortest conversation: ${shortest?.turns} turns`);
	console.log(`    "${shortest?.text}..."`);

	await waitMs(500);

	// Keep only Mini tier + Anchor (cheapest pair) to limit spend
	console.log('\n--- Limit to Mini + Anchor Tiers ---');
	await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.checkbox-card')];
		cards.forEach((c) => {
			const text = c.textContent ?? '';
			const cb = c.querySelector('input[type="checkbox"]');
			if (!cb || cb.disabled) return;
			// Uncheck non-Mini tiers
			if (text.includes('Small') || text.includes('Medium') || text.includes('Large')) {
				if (cb.checked) cb.click();
			}
			// Ensure Mini stays checked
			if (text.includes('Mini') && !cb.checked) cb.click();
		});
	});
	await waitMs(500);

	// Verify the Start Evaluation button is now visible
	console.log('\n--- Start Evaluation ---');
	const startBtn = await page.evaluate(() => {
		const btns = [...document.querySelectorAll('button.primary')];
		const sb = btns.find((b) => b.textContent?.includes('Start Evaluation'));
		if (sb) {
			sb.click();
			return sb.textContent;
		}
		return null;
	});
	assert(!!startBtn, `Start Evaluation button clicked: ${startBtn}`);

	// Wait for evaluation to complete (or timeout)
	console.log('\n--- Running Evaluation (this takes 30-60s) ---');
	let evalDone = false;
	const maxWait = 120000; // 2 minutes
	const startTime = Date.now();

	while (Date.now() - startTime < maxWait) {
		const status = await page.evaluate(() => {
			const text = document.body.textContent ?? '';
			if (text.includes('Evaluation complete')) return 'done';
			if (text.includes('Start Rating')) return 'done';
			if (text.includes('Blind Rating') && text.match(/Response [A-E]/)) return 'done';
			const progress = text.match(/(\d+)\/(\d+)/);
			// Check if progress shows full completion (e.g. 2/2)
			if (progress && progress[1] === progress[2] && progress[1] !== '0') return 'done';
			if (progress) return `${progress[1]}/${progress[2]}`;
			return 'running';
		});

		process.stdout.write(`    Progress: ${status}\r`);

		if (status === 'done') {
			evalDone = true;
			break;
		}
		await waitMs(2000);
	}
	console.log('');
	assert(evalDone, 'Evaluation completed within timeout');

	// Check IndexedDB for cached results
	console.log('\n--- Verify Cached Results ---');
	const cachedResults = await page.evaluate(async () => {
		return new Promise((resolve) => {
			const req = indexedDB.open('sovereignty-stack', 1);
			req.onsuccess = () => {
				const db = req.result;
				const tx = db.transaction('worksheets', 'readonly');
				const get = tx.objectStore('worksheets').get('w3');
				get.onsuccess = () => {
					const data = get.result;
					if (!data?.evalResults) {
						resolve({ count: 0, keys: [] });
						return;
					}
					resolve({
						count: Object.keys(data.evalResults).length,
						keys: Object.keys(data.evalResults),
						sample: Object.values(data.evalResults)[0]
					});
				};
				get.onerror = () => resolve({ count: 0, keys: [] });
			};
			req.onerror = () => resolve({ count: 0, keys: [] });
		});
	});

	assert(cachedResults.count >= 2, `Evaluation results cached (got ${cachedResults.count} entries)`);
	console.log(`    Cached keys: ${cachedResults.keys.join(', ')}`);

	if (cachedResults.sample?.responses) {
		const firstResponse = cachedResults.sample.responses[0] ?? '';
		const hasContent = firstResponse.length > 50;
		const notError = !firstResponse.startsWith('[Error');
		assert(hasContent, `First response has content (${firstResponse.length} chars)`);
		assert(notError, `First response is not an error`);
		if (firstResponse.startsWith('[Error')) {
			console.log(`    Error response: ${firstResponse.slice(0, 200)}`);
		} else {
			console.log(`    Sample response: "${firstResponse.slice(0, 150)}..."`);
		}
	}

	// Try to proceed to rating UI
	console.log('\n--- Rating UI ---');
	await waitMs(2000);

	// Click "Start Rating" button to be sure
	const clickedStart = await page.evaluate(() => {
		const btns = [...document.querySelectorAll('button.primary')];
		const sb = btns.find((b) => b.textContent?.trim() === 'Start Rating');
		if (sb) {
			sb.click();
			return true;
		}
		return false;
	});
	console.log(`    Clicked Start Rating: ${clickedStart}`);
	await waitMs(2000);

	// Scroll to bottom to see rating UI
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await waitMs(500);

	const ratingVisible = await page.evaluate(() => {
		// Check for Response A card specifically (rating UI cards have h3 "Response A")
		const h3s = [...document.querySelectorAll('h3')];
		return h3s.some((h) => /^Response [A-E]/.test(h.textContent ?? ''));
	});
	assert(ratingVisible, 'Blind rating UI becomes visible after evaluation');

	// Verify randomized labels (A, B) appear
	const labels = await page.evaluate(() => {
		const h3s = [...document.querySelectorAll('h3')];
		return h3s.map((h) => h.textContent ?? '').filter((t) => t.includes('Response'));
	});
	assert(labels.length >= 2, `Randomized response labels present (${labels.length} found)`);

	// Verify no model identities shown in rating cards before reveal (model IDs are OK in Tier Selection section)
	const modelsHiddenInRating = await page.evaluate(() => {
		// Find Response cards (within rating UI)
		const cards = [...document.querySelectorAll('.card')];
		const responseCards = cards.filter((c) => /Response [A-E]/.test(c.querySelector('h3')?.textContent ?? ''));
		// Model identities should NOT appear in response card h3 headings before reveal
		return !responseCards.some((c) => /qwen|openai|anthropic/.test(c.querySelector('h3')?.textContent ?? ''));
	});
	assert(modelsHiddenInRating, 'Model identities hidden in response cards before reveal');

	// Rate both responses
	console.log('\n--- Rate Responses ---');
	const rated = await page.evaluate(() => {
		const ratingBtns = [...document.querySelectorAll('button')].filter(
			(b) => b.textContent?.match(/^\d\s*—\s*/)
		);
		// Click the first "4 — Fully adequate" button for each response
		let clicked = 0;
		const cards = [...document.querySelectorAll('.card')];
		for (const card of cards) {
			const h3 = card.querySelector('h3');
			if (!h3?.textContent?.includes('Response')) continue;
			const btn = [...card.querySelectorAll('button')].find((b) =>
				b.textContent?.includes('3 — Usable')
			);
			if (btn) {
				btn.click();
				clicked++;
			}
		}
		return clicked;
	});
	assert(rated >= 2, `Rated ${rated} candidate responses`);

	await waitMs(500);

	// Metrics should compute
	console.log('\n--- Metrics ---');
	const metricsShown = await page.evaluate(() => {
		const text = document.body.textContent ?? '';
		return text.includes('Adequacy Rate') && text.includes('Critical Failure Rate');
	});
	assert(metricsShown, 'Per-tier metrics table renders after rating');

	await browser.close();

	console.log('\n=======================');
	console.log(`Results: ${passed} passed, ${failed} failed`);
	if (failures.length > 0) {
		console.log('\nFailures:');
		failures.forEach((f) => console.log(`  - ${f}`));
	}

	process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
	console.error('FATAL:', e);
	process.exit(1);
});
