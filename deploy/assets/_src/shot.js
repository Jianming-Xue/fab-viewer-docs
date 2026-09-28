// 用法（在 _src 目录下）：node shot.js <卡片html> <输出目录>
// 例：node shot.js fb.html ..
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const htmlArg = process.argv[2];
  const outArg = process.argv[3] || '.';
  if (!htmlArg) { console.error('用法：node shot.js <卡片html> <输出目录>'); process.exit(1); }
  const html = path.resolve(htmlArg);
  const outDir = path.resolve(outArg);
  fs.mkdirSync(outDir, { recursive: true });

  const b = await chromium.launch();
  const p = await b.newPage({ viewportSize: { width: 1120, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('file://' + html);

  const shots = p.locator('.shot');
  const n = await shots.count();
  for (let i = 0; i < n; i++) {
    const el = shots.nth(i);
    const name = await el.getAttribute('data-name');
    const file = path.join(outDir, name + '.png');
    await el.screenshot({ path: file });
    const box = await el.boundingBox();
    console.log(`${name}.png  ${Math.round(box.width)}x${Math.round(box.height)}`);
  }
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
