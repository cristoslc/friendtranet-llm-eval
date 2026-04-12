import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://localhost:5173/worksheet1', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1000));

// Clear any prior state
await p.evaluate(async () => {
  return new Promise(resolve => {
    const req = indexedDB.deleteDatabase('sovereignty-stack');
    req.onsuccess = () => resolve();
  });
});
await p.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1000));

// Check HW mitigation slider for threat 1 BEFORE any selection
const mitBefore = await p.evaluate(() => {
  const text = document.body.textContent || '';
  const m = text.match(/HW mitigation:\s*(\d+)%/);
  return m ? m[1] : null;
});
console.log('Threat 1 HW mitigation (fresh): ' + mitBefore + '% (expected 100%)');

// Now set probability via slider — first probability slider for threat 1
const sliders = await p.$$('input[type="range"]');
await sliders[0].click(); // focus it
await p.evaluate(() => {
  // find all range sliders and check their aria-labels
  return [...document.querySelectorAll('input[type="range"]')]
    .slice(0, 5)
    .map(s => ({ label: s.getAttribute('aria-label'), min: s.min, max: s.max, value: s.value }));
}).then(x => console.log('First 5 sliders:', JSON.stringify(x)));

// Programmatically trigger a probability change
await p.evaluate(() => {
  const sliders = [...document.querySelectorAll('input[type="range"]')];
  const probSlider = sliders.find(s => s.getAttribute('aria-label')?.startsWith('Probability'));
  if (probSlider) {
    probSlider.value = '2'; // Rare
    probSlider.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await new Promise(r => setTimeout(r, 500));

const mitAfter = await p.evaluate(() => {
  const text = document.body.textContent || '';
  const m = text.match(/HW mitigation:\s*(\d+)%/);
  return m ? m[1] : null;
});
console.log('Threat 1 HW mitigation (after prob set): ' + mitAfter + '% (expected still 100%)');

console.log(mitAfter === '100' ? 'BUG FIXED ✓' : 'BUG STILL PRESENT ✗');

await b.close();
