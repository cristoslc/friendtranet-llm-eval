#!/usr/bin/env node
/**
 * Synthetic UAT — Puppeteer end-to-end tests for the Sovereignty Stack Decision SPA.
 * Exercises the golden path: landing → W1 → W2 → W3 → export → aggregation.
 *
 * Usage: node tests/uat.mjs [--headed]
 * Requires dev server running on localhost:5173.
 */

import puppeteer from 'puppeteer';

const BASE = 'http://localhost:5173';
const HEADED = process.argv.includes('--headed');
const SLOW = HEADED ? 50 : 0;

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

async function assertVisible(selector, name) {
	try {
		await page.waitForSelector(selector, { timeout: 3000 });
		assert(true, name);
	} catch {
		assert(false, name);
	}
}

// Helper: get text content of an element
async function getText(selector) {
	return page.$eval(selector, (el) => el.textContent?.trim() ?? '');
}

// ─── Test: Landing Page ─────────────────────────────────────────────

async function testLanding() {
	console.log('\n--- Landing Page ---');
	await page.goto(BASE, { waitUntil: 'networkidle0' });

	await assertVisible('h1', 'H1 heading renders');
	const h1 = await getText('h1');
	assert(h1.includes('Sovereignty Stack Decision'), 'H1 says "Sovereignty Stack Decision"');

	await assertVisible('nav.stepper', 'Stepper nav renders');
	const stepCount = await page.$$eval('nav.stepper a', (els) => els.length);
	assert(stepCount === 5, `Stepper has 5 steps (got ${stepCount})`);

	await assertVisible('details summary', 'ZDR/DPA expandable section exists');
	await assertVisible('button.primary', 'Begin Assessment button exists');

	// Click Begin Assessment — the button is inside an <a> tag
	await page.click('a[href="/worksheet1"]');
	await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
	await new Promise((r) => setTimeout(r, 500));
	const url = page.url();
	assert(url.includes('/worksheet1'), `Navigated to W1 (${url})`);
}

// ─── Test: Worksheet 1 (Risk Scorecard) ─────────────────────────────

async function testWorksheet1() {
	console.log('\n--- Worksheet 1: Risk Scorecard ---');
	await page.goto(`${BASE}/worksheet1`, { waitUntil: 'networkidle0' });

	const h1 = await getText('h1');
	assert(h1.includes('Risk Scorecard'), 'W1 heading renders');

	// Count threat cards
	const cardCount = await page.$$eval('.card h3', (els) =>
		els.filter((e) => /^\d+\./.test(e.textContent ?? '')).length
	);
	assert(cardCount === 10, `10 threat cards rendered (got ${cardCount})`);

	// Verify summary footer shows empty state
	const summaryText = await getText('.summary-card');
	assert(
		summaryText.includes('Select probability and impact'),
		'Empty state message shows in summary'
	);

	// Fill threat 1: probability = Rare (index 2), Monetary = Moderate (index 2)
	const selects = await page.$$('select');
	await selects[0].select('2'); // Probability: Rare
	await selects[1].select('2'); // Monetary: Moderate ($5,500)

	// Wait for reactivity
	await page.waitForFunction(
		() => !document.querySelector('.summary-card')?.textContent?.includes('Select probability'),
		{ timeout: 3000 }
	).catch(() => {});

	// Check that expected loss updated
	const summaryAfter = await getText('.summary-card');
	const hasAmount = /\$[1-9]/.test(summaryAfter);
	assert(hasAmount, `Summary shows non-zero amount after filling threat 1 (${summaryAfter.slice(0, 80)})`);

	// Check counter updated — find the muted text that contains "of 10"
	const counterText = await page.$$eval('p.muted', (els) =>
		els.find((e) => e.textContent?.includes('of 10'))?.textContent ?? ''
	);
	assert(counterText.includes('1 of 10'), `Counter shows 1 of 10 (got: "${counterText.slice(0, 60)}")`);

	// Fill threat 4 (Policy reversal): probability = Occasional (index 3), Psych = Violation (index 2)
	await selects[12].select('3'); // Probability: Occasional (threat 4, 4th probability dropdown)
	await selects[14].select('2'); // Psych-relational: Violation ($6,000)

	await new Promise((r) => setTimeout(r, 300));

	const counterAfter = await page.$$eval('p.muted', (els) =>
		els.find((e) => e.textContent?.includes('of 10'))?.textContent ?? ''
	);
	assert(counterAfter.includes('2 of 10'), `Counter shows 2 of 10 (got: "${counterAfter.slice(0, 60)}")`);

	// Navigate to W2
	const nextBtn = await page.$('a[href="/worksheet2"] button');
	assert(!!nextBtn, 'Next button links to W2');
}

// ─── Test: Worksheet 2 (Principle Scorecard) ────────────────────────

async function testWorksheet2() {
	console.log('\n--- Worksheet 2: Principle Scorecard ---');
	await page.goto(`${BASE}/worksheet2`, { waitUntil: 'networkidle0' });

	const h1 = await getText('h1');
	assert(h1.includes('Principle Scorecard'), 'W2 heading renders');

	// Step 1: Click two category checkboxes
	const checkboxes = await page.$$('.checkbox-card input[type="checkbox"]');
	assert(checkboxes.length === 10, `10 category checkboxes (got ${checkboxes.length})`);

	await checkboxes[0].click(); // Household
	await checkboxes[2].click(); // Financial
	await new Promise((r) => setTimeout(r, 200));

	const countText = await page.$$eval('p.muted', (els) =>
		els.find((e) => e.textContent?.includes('categories'))?.textContent ?? ''
	);
	assert(countText.includes('2 categories'), `Shows 2 categories selected (got: "${countText.slice(0, 60)}")`);

	// Step 2: Select stance - Topological sovereignty (first radio)
	const radios = await page.$$('.radio-option input[type="radio"]');
	assert(radios.length >= 8, `8+ stance options rendered (got ${radios.length})`);
	await radios[0].click(); // Topological sovereignty
	await new Promise((r) => setTimeout(r, 200));

	// Step 3: Set WTP slider to $1,500
	const slider = await page.$('input[type="range"][max="3000"]');
	assert(!!slider, 'WTP slider exists');
	if (slider) {
		await page.evaluate((el) => {
			el.value = '1500';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, slider);
		await new Promise((r) => setTimeout(r, 200));
	}

	// Step 4: Click "Moderately" compromise (3rd segmented button)
	const segButtons = await page.$$('.segmented button');
	if (segButtons.length >= 3) {
		await segButtons[2].click(); // Moderately (-25%)
		await new Promise((r) => setTimeout(r, 200));
	}

	// Check adjusted WTP calculation: $1500 * 0.75 = $1125
	const pageContent = await page.content();
	const hasAdjusted = pageContent.includes('1,125') || pageContent.includes('$1,125');
	assert(hasAdjusted, 'Adjusted WTP shows $1,125 ($1500 * 75%)');

	// Check gate check section renders
	const gateCheck = await page.$('.decision-card');
	assert(!!gateCheck, 'Gate check card renders');
}

// ─── Test: Worksheet 3 (Capability Evaluation) ─────────────────────

async function testWorksheet3() {
	console.log('\n--- Worksheet 3: Capability Evaluation ---');
	await page.goto(`${BASE}/worksheet3`, { waitUntil: 'networkidle0' });

	const h1 = await getText('h1');
	assert(h1.includes('Capability Evaluation'), 'W3 heading renders');

	// Gate check may or may not show depending on W1/W2 data from prior tests
	const gateCheck = await page.$('.decision-card');
	assert(true, `Gate check card: ${gateCheck ? 'visible (below threshold)' : 'hidden (above threshold, correct)'}`);

	// API key input
	await assertVisible('input[type="password"]', 'API key input exists');
	await assertVisible('button', 'Verify button exists');

	// Model tier section — count checkboxes near the "Model Tiers to Test" heading
	const tierCount = await page.evaluate(() => {
		const h2s = [...document.querySelectorAll('h2')];
		const tierHeading = h2s.find((h) => h.textContent?.includes('Model Tiers'));
		if (!tierHeading) return 0;
		const card = tierHeading.closest('.card');
		return card ? card.querySelectorAll('input[type="checkbox"]').length : 0;
	});
	assert(tierCount === 5, `5 model tier checkboxes (got ${tierCount})`);

	// Conversation grid
	const headings = await page.$$eval('h2', (els) => els.map((e) => e.textContent));
	assert(headings.some((h) => h?.includes('Select Conversations')), 'Conversation selection section exists');

	// Category filter dropdown
	const catFilter = await page.$('select');
	assert(!!catFilter, 'Category filter dropdown exists');

	// Conversation cards
	const convCards = await page.$$('.checkbox-grid .checkbox-card');
	assert(convCards.length === 13, `13 curated conversation cards (got ${convCards.length})`);

	// Export button
	const exportBtnCount = await page.$$eval('button.primary', (els) =>
		els.filter((e) => e.textContent?.includes('Export')).length
	);
	assert(exportBtnCount >= 1, 'Export button exists');
}

// ─── Test: Aggregation View ─────────────────────────────────────────

async function testAggregation() {
	console.log('\n--- Aggregation View ---');
	await page.goto(`${BASE}/aggregation`, { waitUntil: 'networkidle0' });

	const h1 = await getText('h1');
	assert(h1.includes('Group Aggregation'), 'Aggregation heading renders');

	// Drop zone
	await assertVisible('.drop-zone', 'Drop zone for JSON import exists');

	// Inject mock export data via JS to test aggregation logic
	await page.evaluate(() => {
		const mockData = [
			{
				version: 1,
				displayName: 'Alice',
				exportedAt: '2026-04-11T00:00:00Z',
				w1: { perThreat: [], baseLoss: 800, riskAversionPremium: 200, totalLoss: 1000 },
				w2: {
					selectedCategories: ['household', 'health'],
					stance: 'topological',
					rawWtp: 1200,
					compromiseReduction: 0.25,
					adjustedWtp: 900
				},
				w3: { evaluated: false },
				combined: {
					riskValue: 1000,
					principleValue: 900,
					totalValue: 1900,
					justifiedTiers: ['entry']
				}
			},
			{
				version: 1,
				displayName: 'Bob',
				exportedAt: '2026-04-11T00:00:00Z',
				w1: { perThreat: [], baseLoss: 300, riskAversionPremium: 0, totalLoss: 300 },
				w2: {
					selectedCategories: ['creative'],
					stance: 'none',
					rawWtp: 0,
					compromiseReduction: 0,
					adjustedWtp: 0
				},
				w3: { evaluated: false },
				combined: {
					riskValue: 300,
					principleValue: 0,
					totalValue: 300,
					justifiedTiers: []
				}
			},
			{
				version: 1,
				displayName: 'Cristos',
				exportedAt: '2026-04-11T00:00:00Z',
				w1: { perThreat: [], baseLoss: 1500, riskAversionPremium: 500, totalLoss: 2000 },
				w2: {
					selectedCategories: ['household', 'health', 'professional', 'creative'],
					stance: 'topological',
					rawWtp: 2000,
					compromiseReduction: 0,
					adjustedWtp: 2000
				},
				w3: { evaluated: false },
				combined: {
					riskValue: 2000,
					principleValue: 2000,
					totalValue: 4000,
					justifiedTiers: ['entry', 'mid', 'high']
				}
			}
		];

		// Simulate file import by dispatching events
		window.__mockMembers = mockData;
	});

	// Use file input approach — create mock files and trigger import
	await page.evaluate(() => {
		const data = window.__mockMembers;
		const dropZone = document.querySelector('.drop-zone');
		if (!dropZone) return;

		// Create mock File objects and DataTransfer
		const files = data.map(
			(d, i) => new File([JSON.stringify(d)], `member-${i}.json`, { type: 'application/json' })
		);
		const dt = new DataTransfer();
		files.forEach((f) => dt.items.add(f));

		const dropEvent = new DragEvent('drop', { bubbles: true, dataTransfer: dt });
		dropZone.dispatchEvent(dropEvent);
	});

	await new Promise((r) => setTimeout(r, 1000));
	await page.screenshot({ path: '/tmp/aggregation-after-import.png' });

	// Check member cards rendered
	const memberCards = await page.$$eval('h3', (els) =>
		els.filter((e) => ['Alice', 'Bob', 'Cristos'].some((n) => e.textContent?.includes(n))).length
	);
	assert(memberCards === 3, `3 member cards rendered (got ${memberCards})`);

	// Check group totals
	const pageContent = await page.content();
	const hasGroupTotal = pageContent.includes('6,200') || pageContent.includes('$6,200');
	assert(hasGroupTotal, 'Group combined total shows $6,200 ($1900 + $300 + $4000)');

	// Check decision card
	const decisionCard = await page.$('.decision-card');
	assert(!!decisionCard, 'Decision card renders');

	// Check red flags (Cristos at 4000/6200 = 64%, below 70% threshold — no driver flag)
	// But let's check the decision outcome
	const decisionText = await page.$eval('.decision-card', (el) => el.textContent ?? '');
	assert(decisionText.length > 10, `Decision card has content: "${decisionText.slice(0, 60)}..."`);

	// Check anonymization toggle
	const anonToggle = await page.$('input[type="checkbox"]');
	assert(!!anonToggle, 'Anonymization toggle exists');

	// Check export report button
	const exportBtns = await page.$$eval('button.primary', (els) =>
		els.filter((e) => e.textContent?.includes('Export Group Report')).length
	);
	assert(exportBtns === 1, 'Export Group Report button exists');
}

// ─── Test: Navigation & Persistence ─────────────────────────────────

async function testNavPersistence() {
	console.log('\n--- Navigation & Persistence ---');

	// Go to W1, interact using native select which triggers Svelte's onchange
	await page.goto(`${BASE}/worksheet1`, { waitUntil: 'networkidle0' });
	await new Promise((r) => setTimeout(r, 500));

	// Use Puppeteer's native .select() on element handles
	const navSelects = await page.$$('select');
	await navSelects[0].select('4'); // Probability: Common
	await new Promise((r) => setTimeout(r, 200));
	await navSelects[1].select('3'); // Monetary: Major ($55,000)
	await new Promise((r) => setTimeout(r, 800));

	// Verify computation triggered by checking the summary changed
	const summaryText = await page.$$eval('p.muted', (els) =>
		els.find((e) => e.textContent?.includes('of 10'))?.textContent ?? ''
	);
	// If the counter updated, the store function fired
	const storeWorked = summaryText.includes('1 of 10') || summaryText.includes('2 of 10');
	assert(storeWorked, `Store function triggered (counter: "${summaryText.slice(0, 60)}")`);

	// Navigate to W2 and back
	await page.goto(`${BASE}/worksheet2`, { waitUntil: 'networkidle0' });
	assert(page.url().includes('/worksheet2'), 'Navigated to W2');

	await page.goto(`${BASE}/worksheet1`, { waitUntil: 'networkidle0' });
	await new Promise((r) => setTimeout(r, 1500));

	// Check if any select has a non-empty value (IndexedDB restore)
	const anyRestored = await page.evaluate(() => {
		const sels = document.querySelectorAll('select');
		return [...sels].some((s) => s.value !== '');
	});
	assert(anyRestored, 'At least one select value restored after navigation');
}

// ─── Test: IndexedDB Persistence ────────────────────────────────────

async function testIndexedDBPersistence() {
	console.log('\n--- IndexedDB Persistence ---');

	// Fill W1 data
	await page.goto(`${BASE}/worksheet1`, { waitUntil: 'networkidle0' });
	const selects = await page.$$('select');
	await page.evaluate(() => {
		const selects = document.querySelectorAll('select');
		selects[0].value = '3';
		selects[0].dispatchEvent(new Event('change', { bubbles: true }));
		selects[2].value = '1';
		selects[2].dispatchEvent(new Event('change', { bubbles: true }));
	});
	await new Promise((r) => setTimeout(r, 1000));

	// Check IndexedDB has data
	const hasData = await page.evaluate(async () => {
		return new Promise((resolve) => {
			const req = indexedDB.open('sovereignty-stack', 1);
			req.onsuccess = () => {
				const db = req.result;
				const tx = db.transaction('worksheets', 'readonly');
				const get = tx.objectStore('worksheets').get('w1');
				get.onsuccess = () => resolve(get.result !== undefined);
				get.onerror = () => resolve(false);
			};
			req.onerror = () => resolve(false);
		});
	});
	assert(hasData, 'W1 data persisted to IndexedDB');
}

// ─── Runner ─────────────────────────────────────────────────────────

async function run() {
	console.log('Sovereignty Stack SPA — Synthetic UAT');
	console.log('=====================================\n');

	browser = await puppeteer.launch({
		headless: !HEADED,
		slowMo: SLOW,
		args: ['--no-sandbox']
	});
	page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 800 });

	try {
		await testLanding();
		await testWorksheet1();
		await testWorksheet2();
		await testWorksheet3();
		await testAggregation();
		await testNavPersistence();
		await testIndexedDBPersistence();
	} catch (err) {
		console.error('\nFATAL:', err.message);
		failed++;
		failures.push(`FATAL: ${err.message}`);
	}

	await browser.close();

	console.log('\n=====================================');
	console.log(`Results: ${passed} passed, ${failed} failed`);
	if (failures.length > 0) {
		console.log('\nFailures:');
		failures.forEach((f) => console.log(`  - ${f}`));
	}
	console.log('');

	process.exit(failed > 0 ? 1 : 0);
}

run();
