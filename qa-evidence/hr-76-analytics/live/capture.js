// HR-76 analytics dashboard verification. Signs in as an admin, walks
// /admin/analytics across every range preset in dark + light, exercises the
// CSS hover readout, and confirms the page is admin-gated.
// Usage: node capture.js <baseUrl> <adminEmail> <adminPass> <employeeEmail> <employeePass>
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2];
const ADMIN = { email: process.argv[3], pass: process.argv[4] };
const EMP = { email: process.argv[5], pass: process.argv[6] };
const OUTDIR = __dirname;
const results = [];
const consoleErrors = [];

function badMarkers(t) {
  t = t.toLowerCase();
  return ["application error", "internal server error", "this page could not be found", "unhandled runtime error", "client-side exception"].filter((m) => t.includes(m));
}

async function login(ctx, who) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`pageerror@${page.url()}:${e.message.slice(0, 60)}`));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`console@${page.url()}:${m.text().slice(0, 60)}`); });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", who.email);
  await page.fill("#password", who.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 25000 });
  return page;
}

async function check(name, ok, notes = []) {
  results.push({ name, ok, notes });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${notes.join(" ")}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const page = await login(ctx, ADMIN);

  for (const [suffix, shot] of [["", "01-dark-30d"], ["?range=90d", "02-dark-90d"], ["?range=12m", "03-dark-12m"]]) {
    await page.goto(`${BASE}/admin/analytics${suffix}`, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    const bad = badMarkers(body);
    // section-label headings are uppercased by CSS, so compare case-insensitively
    const hasSections = ["overview", "headcount", "attendance", "leave", "kudos"].every((s) => body.toLowerCase().includes(s));
    await page.screenshot({ path: `${OUTDIR}/${shot}.png`, fullPage: true });
    await check(`analytics ${suffix || "30d(default)"}`, bad.length === 0 && hasSections && page.url().includes("/admin/analytics"), bad);
  }

  // hover readout: hover the 3rd-from-last band of the first column chart
  await page.goto(`${BASE}/admin/analytics`, { waitUntil: "networkidle" });
  const bands = page.locator("svg .viz-band rect");
  const n = await bands.count();
  await bands.nth(Math.max(0, n - 3)).hover();
  await page.waitForTimeout(300);
  const readoutVisible = await page.evaluate(() => {
    const hovers = [...document.querySelectorAll(".viz-band .viz-hover")];
    return hovers.some((h) => getComputedStyle(h).opacity === "1");
  });
  await page.screenshot({ path: `${OUTDIR}/04-hover-readout.png`, fullPage: false });
  await check("hover readout appears", readoutVisible);

  // keyboard focus shows the same readout
  await bands.nth(0).focus();
  const focusReadout = await page.evaluate(() => {
    const hovers = [...document.querySelectorAll(".viz-band .viz-hover")];
    return hovers.some((h) => getComputedStyle(h).opacity === "1");
  });
  await check("focus readout appears", focusReadout);

  // table twin opens
  await page.locator("details summary").first().click();
  const tableRows = await page.locator("details[open] table tbody tr").count();
  await page.screenshot({ path: `${OUTDIR}/05-table-twin.png`, fullPage: false });
  await check("table twin has rows", tableRows > 0, [`rows=${tableRows}`]);

  // light mode
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`${BASE}/admin/analytics`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUTDIR}/06-light-30d.png`, fullPage: true });
  await check("light mode renders", badMarkers(await page.locator("body").innerText()).length === 0);
  await page.close();

  // non-admin is redirected away
  const empCtx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const empPage = await login(empCtx, EMP);
  await empPage.goto(`${BASE}/admin/analytics`, { waitUntil: "networkidle" });
  await check("employee redirected", !empPage.url().includes("/admin"), [`->${empPage.url().replace(BASE, "")}`]);
  await browser.close();

  const summary = { base: BASE, passed: results.filter((r) => r.ok).length, total: results.length, consoleErrors, results };
  fs.writeFileSync(`${OUTDIR}/verdict.json`, JSON.stringify(summary, null, 2));
  console.log(`\n==== SUMMARY ${summary.passed}/${summary.total} passed, consoleErrors=${consoleErrors.length} ====`);
  if (consoleErrors.length) console.log(consoleErrors.join("\n"));
  process.exit(summary.passed === summary.total && consoleErrors.length === 0 ? 0 : 2);
})().catch((e) => { console.error("HARNESS_CRASH", e); process.exit(1); });
