#!/usr/bin/env node
/**
 * SPEC-009 live smoke — verifies the fix for qwen3.5-9b turn-5 empty response.
 *
 * Checks:
 *  1. Per-model max_tokens override reaches the OpenRouter request body
 *     (Mini / qwen/qwen3.5-9b sends max_tokens=16384, not 8192).
 *  2. Evaluation completes — either with content on every turn, or with
 *     empty-response errors that include the instrumentation tag
 *     (prompt=, completion=, reasoning=).
 *  3. W3 rating view exposes per-turn skip/un-skip controls when a
 *     response is truncated or empty.
 *  4. Metrics table renders a "Skipped" column header.
 *
 * Usage: OPENROUTER_KEY=sk-or-... BASE_URL=http://localhost:5175 node tests/spec009-smoke.mjs [--headed]
 */

import puppeteer from 'puppeteer';

const BASE = process.env.BASE_URL ?? 'http://localhost:5175';
const HEADED = process.argv.includes('--headed');
const KEY = process.env.OPENROUTER_KEY;

if (!KEY) {
	console.error('ERROR: OPENROUTER_KEY env var required');
	process.exit(1);
}

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, name, extra) {
	if (cond) {
		passed++;
		console.log(`  PASS  ${name}`);
	} else {
		failed++;
		failures.push(name + (extra ? ` — ${extra}` : ''));
		console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
	}
}

const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
	console.log(`SPEC-009 smoke — BASE=${BASE}`);
	console.log('==================================\n');

	const browser = await puppeteer.launch({ headless: !HEADED, args: ['--no-sandbox'] });
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });

	// Observe OpenRouter requests to verify max_tokens per model.
	// Using the request event directly (no interception) keeps navigation fast.
	const observedRequests = [];
	page.on('request', (req) => {
		if (req.url().includes('openrouter.ai/api/v1/chat/completions')) {
			try {
				const body = JSON.parse(req.postData() ?? '{}');
				observedRequests.push({
					model: body.model,
					max_tokens: body.max_tokens,
					messageCount: body.messages?.length ?? 0
				});
			} catch {
				// ignore
			}
		}
	});

	page.on('console', (msg) => {
		const t = msg.text();
		if (msg.type() === 'error') {
			if (!/WebSocket|vite|HMR/i.test(t)) console.log('  [browser error]', t.slice(0, 300));
		}
	});
	page.on('requestfailed', (req) => {
		const t = `${req.failure()?.errorText} ${req.url()}`;
		if (!/chrome-|\.well-known|devtools/.test(t)) console.log('  [req failed]', t.slice(0, 200));
	});
	page.on('response', (resp) => {
		if (resp.status() >= 400 && resp.url().startsWith(BASE)) {
			console.log(`  [${resp.status()}] ${resp.url()}`);
		}
	});

	// Seed key + clear IndexedDB. Use domcontentloaded — HMR on the wrong port
	// keeps networkidle0 from firing in this worktree's dev server.
	await page.goto(BASE, { waitUntil: 'domcontentloaded' });
	await waitMs(500);
	// Wait for the IDB delete to complete before continuing. onsuccess fires
	// only after all other connections close; polling resolves the hang
	// observed when the Vite HMR client keeps a handle open.
	const deleted = await page.evaluate(
		() =>
			new Promise((resolve) => {
				let settled = false;
				const done = (result) => {
					if (!settled) {
						settled = true;
						resolve(result);
					}
				};
				const req = indexedDB.deleteDatabase('sovereignty-stack');
				req.onsuccess = () => done('success');
				req.onerror = () => done('error');
				req.onblocked = () => done('blocked');
				setTimeout(() => done('timeout'), 3000);
			})
	);
	console.log(`    IDB delete: ${deleted}`);
	await page.evaluate((k) => sessionStorage.setItem('openrouter-key', k), KEY);
	await waitMs(200);

	await page.goto(`${BASE}/worksheet3`, { waitUntil: 'domcontentloaded' });
	// Poll for the W3 UI to render (loadW3() finishes + checkbox cards appear).
	let ready = false;
	for (let i = 0; i < 30; i++) {
		ready = await page.evaluate(() => document.querySelectorAll('.checkbox-card').length > 0);
		if (ready) break;
		await waitMs(500);
	}

	const diag1 = await page.evaluate(() => ({
		keyInStorage: !!sessionStorage.getItem('openrouter-key'),
		bodyHasKeyVerified: (document.body.textContent ?? '').includes('Key verified'),
		checkboxCount: document.querySelectorAll('.checkbox-card').length,
		bodySnippet: (document.body.textContent ?? '').slice(0, 300)
	}));
	console.log(`    diag: ${JSON.stringify(diag1)}`);
	if (!ready) {
		console.log('    UI never rendered — aborting live test');
		await browser.close();
		process.exit(2);
	}

	// Pick the shortest conversation to keep token spend bounded.
	console.log('\n--- Select shortest conversation + Mini tier only ---');
	await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.checkbox-grid .checkbox-card')];
		let minCard = null;
		let minTurns = Infinity;
		cards.forEach((c) => {
			const m = (c.textContent ?? '').match(/(\d+)\s*turns/);
			if (m && parseInt(m[1]) < minTurns) {
				minTurns = parseInt(m[1]);
				minCard = c;
			}
		});
		minCard?.querySelector('input[type="checkbox"]')?.click();
	});
	await waitMs(300);

	// Keep only Mini tier (uncheck others).
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
	await waitMs(400);

	console.log('\n--- Start evaluation ---');
	await page.evaluate(() => {
		const sb = [...document.querySelectorAll('button.primary')].find((b) =>
			b.textContent?.includes('Start Evaluation')
		);
		sb?.click();
	});

	console.log('\n--- Wait for completion (max 3 min) ---');
	let evalDone = false;
	const startTime = Date.now();
	const maxWait = 180000;
	while (Date.now() - startTime < maxWait) {
		const status = await page.evaluate(() => {
			const text = document.body.textContent ?? '';
			if (text.includes('Evaluation complete')) return 'done';
			if (text.includes('Start Rating')) return 'done';
			const prog = text.match(/(\d+)\/(\d+)/);
			if (prog && prog[1] === prog[2] && prog[1] !== '0') return 'done';
			return prog ? `${prog[1]}/${prog[2]}` : 'running';
		});
		process.stdout.write(`    Progress: ${status}\r`);
		if (status === 'done') {
			evalDone = true;
			break;
		}
		await waitMs(2500);
	}
	console.log('');
	assert(evalDone, 'Evaluation completed within 3 min');

	// --- Acceptance check 1: max_tokens override was sent ---
	console.log('\n--- Check 1: max_tokens override on the wire ---');
	const miniRequests = observedRequests.filter((r) => r.model?.includes('qwen3.5-9b'));
	const anchorRequests = observedRequests.filter((r) => r.model?.includes('claude'));
	console.log(`    Mini (qwen3.5-9b) requests observed: ${miniRequests.length}`);
	console.log(`    Anchor (claude) requests observed: ${anchorRequests.length}`);
	const miniUsed16k = miniRequests.length > 0 && miniRequests.every((r) => r.max_tokens === 16384);
	const miniUsedAtLeast16k = miniRequests.length > 0 && miniRequests.every((r) => r.max_tokens >= 16384);
	assert(
		miniUsed16k || miniUsedAtLeast16k,
		'Mini requests use max_tokens>=16384 (per-model override active)',
		`saw max_tokens=${[...new Set(miniRequests.map((r) => r.max_tokens))].join(',')}`
	);
	if (anchorRequests.length > 0) {
		const anchorUses8k = anchorRequests.every((r) => r.max_tokens === 8192);
		assert(anchorUses8k, 'Anchor requests use shared default max_tokens=8192 (override scoped per model)');
	}

	// --- Acceptance check 2: truncation instrumentation present in error messages (if any truncation occurred) ---
	console.log('\n--- Check 2: truncation instrumentation (if any truncation happened) ---');
	const errors = await page.evaluate(() => {
		const items = [...document.querySelectorAll('*')]
			.filter((e) => /Empty response|Truncated at max_tokens/.test(e.textContent ?? ''))
			.map((e) => e.textContent?.trim() ?? '')
			.filter((t) => t.length < 500);
		return items.slice(0, 5);
	});
	if (errors.length > 0) {
		console.log(`    Observed error messages:`);
		errors.forEach((e) => console.log(`      ${e.slice(0, 200)}`));
		const hasInstrumentation = errors.some((e) => /\[prompt=|completion=|reasoning=/.test(e));
		assert(hasInstrumentation, 'Truncation errors include usage-block instrumentation tag');
	} else {
		console.log('    (no truncation events observed — instrumentation path untested this run)');
	}

	// --- Advance to rating UI so we can check skip controls ---
	console.log('\n--- Check 3: rating UI + skip controls ---');
	await page.evaluate(() => {
		const sb = [...document.querySelectorAll('button.primary')].find(
			(b) => b.textContent?.trim() === 'Start Rating'
		);
		sb?.click();
	});
	await waitMs(1500);
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await waitMs(400);

	const ratingVisible = await page.evaluate(() =>
		[...document.querySelectorAll('h3')].some((h) => /^Response [A-E]/.test(h.textContent ?? ''))
	);
	assert(ratingVisible, 'Blind rating UI becomes visible');

	// Look for the re-run button on any response card (always present).
	const controls = await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.card')].filter((c) =>
			/^Response [A-E]/.test(c.querySelector('h3')?.textContent ?? '')
		);
		const btnTexts = cards
			.flatMap((c) => [...c.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim()))
			.filter((t) => t.length < 30);
		return {
			hasRerun: btnTexts.some((t) => t.includes('↻') || t.toLowerCase().includes('re-run')),
			hasSkip: btnTexts.some((t) => t.includes('⊘') || /\bskip\b/i.test(t)),
			cardCount: cards.length,
			sample: btnTexts.slice(0, 10)
		};
	});
	console.log(`    response cards: ${controls.cardCount}, button sample: ${JSON.stringify(controls.sample)}`);
	assert(controls.hasRerun, 'Re-run button present on response cards');
	// skip button only shows when needsRerun — may or may not trigger depending on live truncation.
	if (controls.hasSkip) {
		console.log('    (skip button observed — a turn truncated or went empty)');
		assert(true, 'Skip button visible on a truncated/empty response');
	} else {
		console.log('    (no skip button visible — no truncation/empty turn this run; skip-UI code path untested but present)');
	}

	// --- Check 4: metrics table exposes "Skipped" column ---
	console.log('\n--- Check 4: metrics table has Skipped column ---');
	// Give any pending rating a score so metrics populate.
	await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.card')].filter((c) =>
			/^Response [A-E]/.test(c.querySelector('h3')?.textContent ?? '')
		);
		for (const card of cards) {
			const btn = [...card.querySelectorAll('button')].find((b) =>
				/^3\s*—/.test((b.textContent ?? '').trim())
			);
			btn?.click();
		}
	});
	await waitMs(600);
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await waitMs(300);

	const hasSkippedHeader = await page.evaluate(() => {
		const ths = [...document.querySelectorAll('th')];
		return ths.some((t) => /skipped/i.test(t.textContent ?? ''));
	});
	assert(hasSkippedHeader, 'Metrics table includes a Skipped column');

	await browser.close();

	console.log('\n==================================');
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
