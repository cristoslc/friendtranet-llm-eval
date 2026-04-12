#!/usr/bin/env node
/**
 * BDD tests for SPEC-010: On-demand next-turn generation in W3.
 *
 * Requires a dev server running on localhost:5173. Mocks OpenRouter via
 * Puppeteer request interception so no real API calls fire.
 *
 * Usage: node tests/spec-010.mjs [--headed]
 */

import puppeteer from 'puppeteer';

const BASE = process.env.W3_BASE ?? 'http://localhost:5173';
const HEADED = process.argv.includes('--headed');

let browser;
let page;
let passed = 0;
let failed = 0;
const failures = [];
let openRouterCalls = [];

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

/** Wait up to `ms` for `predicate` (a zero-arg function returning a promise
 * of boolean) to hold. Polls every 100ms. */
async function waitFor(predicate, ms, label) {
	const start = Date.now();
	while (Date.now() - start < ms) {
		if (await predicate()) return true;
		await waitMs(100);
	}
	console.log(`    (timeout waiting for: ${label ?? 'predicate'})`);
	return false;
}

async function pageText() {
	return await page.evaluate(() => document.body.innerText);
}

async function setUpPage() {
	page = await browser.newPage();
	openRouterCalls = [];

	const corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
		'Access-Control-Allow-Headers': 'authorization,content-type,http-referer,x-title'
	};

	// Mock OpenRouter fetches: key verification (GET /models) and chat completions.
	await page.setRequestInterception(true);
	page.on('request', (req) => {
		const url = req.url();
		const method = req.method();
		if (!url.includes('openrouter.ai')) {
			req.continue();
			return;
		}
		if (method === 'OPTIONS') {
			req.respond({ status: 204, headers: corsHeaders, body: '' });
			return;
		}
		if (url.includes('openrouter.ai/api/v1/models')) {
			req.respond({
				status: 200,
				contentType: 'application/json',
				headers: corsHeaders,
				body: JSON.stringify({ data: [] })
			});
			return;
		}
		if (url.includes('openrouter.ai/api/v1/chat/completions')) {
			let body = {};
			try {
				body = JSON.parse(req.postData() ?? '{}');
			} catch {}
			openRouterCalls.push({
				model: body.model,
				messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
				lastUserContent:
					Array.isArray(body.messages) && body.messages.length
						? body.messages[body.messages.length - 1]?.content ?? ''
						: ''
			});
			req.respond({
				status: 200,
				contentType: 'application/json',
				headers: corsHeaders,
				body: JSON.stringify({
					choices: [
						{
							message: {
								content: `mock response for ${body.model} (msgs=${
									Array.isArray(body.messages) ? body.messages.length : 0
								})`
							},
							finish_reason: 'stop'
						}
					]
				})
			});
			return;
		}
		req.continue();
	});

	// Auto-approve confirm dialogs so the on-demand preview fires through.
	await page.evaluateOnNewDocument(() => {
		// Allow tests to inspect what confirm() was asked about.
		window.__confirmLog = [];
		const original = window.confirm;
		window.confirm = (msg) => {
			window.__confirmLog.push(String(msg));
			return true;
		};
		window.__originalConfirm = original;
	});

	page.on('console', (msg) => {
		if (msg.type() === 'error') console.log('    [browser error]', msg.text());
	});
}

async function seedKeyAndClearDb() {
	await page.goto(BASE, { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => {
		sessionStorage.setItem('openrouter-key', 'sk-or-mock-test-key');
	});
	await page.evaluate(async () => {
		await new Promise((resolve) => {
			const req = indexedDB.deleteDatabase('sovereignty-stack');
			req.onsuccess = () => resolve();
			req.onerror = () => resolve();
			req.onblocked = () => resolve();
		});
	});
	await waitMs(300);
}

async function selectMultiTurnConversation() {
	// Find a conversation with at least 3 turns and click its card.
	return await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.checkbox-grid .checkbox-card')];
		for (const c of cards) {
			const text = c.textContent ?? '';
			const match = text.match(/(\d+)\s*turns/);
			if (match && parseInt(match[1]) >= 3) {
				const cb = c.querySelector('input[type="checkbox"]');
				if (cb) cb.click();
				return { turns: parseInt(match[1]), preview: text.slice(0, 80) };
			}
		}
		return null;
	});
}

async function limitToMiniAnchor() {
	await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.checkbox-card')];
		cards.forEach((c) => {
			const text = c.textContent ?? '';
			const cb = c.querySelector('input[type="checkbox"]');
			if (!cb || cb.disabled) return;
			if (text.includes('Small') || text.includes('Medium') || text.includes('Large')) {
				if (cb.checked) cb.click();
			}
			if (text.includes('Mini') && !cb.checked) cb.click();
		});
	});
}

async function clickStartEvaluation() {
	await page.evaluate(() => {
		const btn = document.querySelector('[data-testid="start-evaluation"]');
		if (btn instanceof HTMLElement) btn.click();
	});
}

async function clickGenerateNextTurn() {
	await page.evaluate(() => {
		const btn = document.querySelector('[data-testid="generate-next-turn"]');
		if (btn instanceof HTMLElement) btn.click();
	});
}

async function startRatingUI() {
	// Click "Start Rating" once the initial batch completes.
	await page.evaluate(() => {
		const buttons = [...document.querySelectorAll('button')];
		const startRate = buttons.find((b) => b.textContent?.includes('Start Rating'));
		if (startRate) startRate.click();
	});
}

async function run() {
	console.log('SPEC-010 BDD: On-demand next-turn generation');
	console.log('============================================\n');

	browser = await puppeteer.launch({
		headless: !HEADED,
		args: ['--no-sandbox']
	});

	try {
		await setUpPage();
		await seedKeyAndClearDb();
		await page.goto(`${BASE}/worksheet3`, { waitUntil: 'domcontentloaded' });
		await waitMs(800);

		// Select a multi-turn conversation and limit tiers to Mini + Anchor so
		// the evaluation runner card is revealed.
		const picked = await selectMultiTurnConversation();
		assert(!!picked, `Picked a multi-turn conversation (${picked?.turns} turns)`);
		await limitToMiniAnchor();
		await waitMs(400);

		// AC #1 — cost preview copy for the initial batch.
		const preText = await pageText();
		assert(
			preText.includes('Generating turn 1 only') ||
				preText.includes('turn 1 only') ||
				preText.includes('later turns are generated on demand'),
			'AC1: initial batch copy states "turn 1 only" / "on demand"'
		);

		// Kick off the initial batch.
		const callsBeforeStart = openRouterCalls.length;
		await clickStartEvaluation();

		// Wait for the batch to finish — UI shows "Initial batch complete" or the
		// "Start Rating" button becomes visible for already-evaluated entries.
		const batchDone = await waitFor(
			async () => {
				const t = await pageText();
				return (
					t.includes('Initial batch complete') ||
					t.includes('Turn 1 is ready') ||
					t.includes('Start Rating')
				);
			},
			15000,
			'initial batch complete'
		);
		assert(batchDone, 'Initial batch completed within 15s');

		const initialCalls = openRouterCalls.slice(callsBeforeStart);
		// AC #2 — only turn-1 API calls during initial batch.
		const allTurnOne = initialCalls.every((c) => c.messageCount === 1);
		assert(
			initialCalls.length >= 1 && allTurnOne,
			`AC2: initial batch only fires turn-1 calls (${initialCalls.length} calls, all messageCount=1)`
		);

		// Enter the rating UI.
		await startRatingUI();
		await waitMs(500);

		// AC #5 — conversation switcher present.
		const switcher = await page.$('[data-testid="conversation-switcher"]');
		assert(!!switcher, 'AC5: conversation switcher is rendered');
		const generatedBadges = await page.$$eval('[data-testid="generated-count"]', (els) =>
			els.map((e) => e.textContent)
		);
		assert(
			generatedBadges.some((b) => b && /\d+\/\d+ generated/.test(b)),
			'AC5: switcher shows per-conversation turn-generation progress'
		);

		// AC #3 — "Generate next turn" control is present and wired to window.confirm().
		const nextTurnBtn = await page.$('[data-testid="generate-next-turn"]');
		assert(
			!!nextTurnBtn,
			'AC3: "Generate next turn" control is present when more turns exist'
		);

		const callsBeforeExpand = openRouterCalls.length;
		const confirmLogLenBefore = await page.evaluate(() => window.__confirmLog.length);
		await clickGenerateNextTurn();
		await waitFor(
			async () => (await page.evaluate(() => window.__confirmLog.length)) > confirmLogLenBefore,
			5000,
			'confirm dialog triggered'
		);
		const confirmLog = await page.evaluate(() => window.__confirmLog);
		const lastConfirmMsg = confirmLog[confirmLog.length - 1] ?? '';
		assert(
			/Estimated tokens/.test(lastConfirmMsg) && /Estimated time/.test(lastConfirmMsg),
			'AC3: preview dialog includes estimated tokens and time'
		);
		assert(
			/Continue\?|Generate turn/.test(lastConfirmMsg),
			'AC3: preview dialog asks for explicit approval'
		);

		// Wait for expansion to finish — calls to OpenRouter will be for turn 2
		// (messageCount > 1 because turn 0 context is prepended).
		const expansionDone = await waitFor(
			async () => openRouterCalls.length > callsBeforeExpand,
			10000,
			'expansion API call fires'
		);
		assert(expansionDone, 'AC4: approval triggers at least one API call');

		const expansionCalls = openRouterCalls.slice(callsBeforeExpand);
		const allExpansionMulti = expansionCalls.every((c) => c.messageCount >= 3);
		assert(
			allExpansionMulti,
			`AC4: expansion calls prepend turn-1 context (messageCount>=3, got ${expansionCalls
				.map((c) => c.messageCount)
				.join(',')})`
		);

		// Wait for the UI to update the generated count.
		await waitFor(
			async () => {
				const badges = await page.$$eval('[data-testid="generated-count"]', (els) =>
					els.map((e) => e.textContent)
				);
				return badges.some((b) => /^2\/\d+ generated/.test(b ?? ''));
			},
			5000,
			'generated count updates to 2/N'
		);
		const badgesAfter = await page.$$eval('[data-testid="generated-count"]', (els) =>
			els.map((e) => e.textContent)
		);
		assert(
			badgesAfter.some((b) => /^2\/\d+ generated/.test(b ?? '')),
			'AC7: switcher updates generated count after expansion'
		);

		// AC #9 — preview should estimate one turn at a time. The confirm message
		// should not mention a cumulative multi-turn cost.
		assert(
			!/all remaining turns|\d+ turns/.test(lastConfirmMsg),
			'AC9: preview scopes to a single turn (no bulk copy)'
		);
	} finally {
		if (browser) await browser.close();
	}

	console.log('');
	console.log(`Results: ${passed} passed, ${failed} failed`);
	if (failed > 0) {
		console.log('Failures:');
		failures.forEach((f) => console.log(`  - ${f}`));
		process.exit(1);
	}
}

run().catch((e) => {
	console.error('Test run crashed:', e);
	process.exit(2);
});
