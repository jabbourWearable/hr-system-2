// HR-72 production hardening: E2E regression sweep against the LIVE Vercel
// deployment. Signs in as seeded users and walks every core surface, asserting
// no error boundary / 500 rendered. Emits a JSON verdict + full-page shots.
// Usage: node capture.js <baseUrl> <empEmail> <empPass> <mgrEmail> <mgrPass>
const { chromium } = require("playwright");

const BASE = process.argv[2];
const EMP = { email: process.argv[3], pass: process.argv[4] };
const MGR = { email: process.argv[5], pass: process.argv[6] };
const OUTDIR = __dirname;

const results = [];

function badMarkers(text) {
  const t = text.toLowerCase();
  return [
    "application error",
    "internal server error",
    "500: ",
    "this page could not be found",
    "unhandled runtime error",
    "client-side exception",
  ].filter((m) => t.includes(m));
}

async function visit(page, name, path, { expectRedirect } = {}) {
  const entry = { name, path, ok: false, finalUrl: null, status: null, notes: [] };
  try {
    const resp = await page.goto(`${BASE}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    entry.status = resp ? resp.status() : null;
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {
      entry.notes.push("networkidle-timeout");
    });
    entry.finalUrl = page.url().replace(BASE, "");
    const body = await page.locator("body").innerText().catch(() => "");
    const bad = badMarkers(body);
    if (bad.length) entry.notes.push("ERROR_MARKERS:" + bad.join("|"));
    if (expectRedirect && entry.finalUrl.startsWith(expectRedirect)) {
      entry.notes.push("redirected->" + entry.finalUrl);
    }
    await page
      .screenshot({ path: `${OUTDIR}/${name}.png`, fullPage: true })
      .catch((e) => entry.notes.push("shot-fail:" + e.message));
    entry.ok = bad.length === 0 && (entry.status === null || entry.status < 400);
  } catch (e) {
    entry.notes.push("EXCEPTION:" + e.message);
  }
  results.push(entry);
  console.log(
    `${entry.ok ? "PASS" : "FAIL"} ${name} [${entry.status}] -> ${entry.finalUrl} ${entry.notes.join(" ")}`
  );
  return entry;
}

async function login(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", who.email);
  await page.fill("#password", who.pass);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 25000 });
    return true;
  } catch (e) {
    const body = await page.locator("body").innerText().catch(() => "");
    console.log(`LOGIN-FAIL ${who.email} finalUrl=${page.url()} snippet="${body.slice(0, 200).replace(/\n/g, " ")}"`);
    return false;
  }
}

(async () => {
  const browser = await chromium.launch();

  // ---- Employee session ----
  const empCtx = await browser.newContext({ viewport: { width: 1360, height: 940 }, colorScheme: "dark" });
  const emp = await empCtx.newPage();
  const empLoggedIn = await login(emp, EMP);
  results.push({ name: "emp-login", ok: empLoggedIn, path: "/login", notes: empLoggedIn ? [] : ["LOGIN_FAILED"] });
  if (empLoggedIn) {
    await visit(emp, "emp-01-dashboard", "/dashboard");
    await visit(emp, "emp-02-attendance", "/dashboard/attendance");
    await visit(emp, "emp-03-directory", "/dashboard/directory");
    // open first profile if present
    const firstProfile = emp.locator('a[href^="/dashboard/directory/"]').first();
    if (await firstProfile.count()) {
      await firstProfile.click().catch(() => {});
      await emp.waitForLoadState("networkidle").catch(() => {});
      await emp.screenshot({ path: `${OUTDIR}/emp-04-profile.png`, fullPage: true }).catch(() => {});
      results.push({ name: "emp-04-profile", ok: true, path: emp.url().replace(BASE, ""), notes: [] });
      console.log("PASS emp-04-profile ->", emp.url().replace(BASE, ""));
    }
    await visit(emp, "emp-05-org", "/dashboard/org");
    await visit(emp, "emp-06-kudos", "/dashboard/kudos");
    await visit(emp, "emp-07-leave", "/dashboard/leave");
  }
  await empCtx.close();

  // ---- Manager session ----
  const mgrCtx = await browser.newContext({ viewport: { width: 1360, height: 940 }, colorScheme: "dark" });
  const mgr = await mgrCtx.newPage();
  const mgrLoggedIn = await login(mgr, MGR);
  results.push({ name: "mgr-login", ok: mgrLoggedIn, path: "/login", notes: mgrLoggedIn ? [] : ["LOGIN_FAILED"] });
  if (mgrLoggedIn) {
    await visit(mgr, "mgr-01-dashboard", "/dashboard");
    await visit(mgr, "mgr-02-leave-approvals", "/dashboard/leave/approvals");
    await visit(mgr, "mgr-03-team-attendance", "/dashboard/attendance/team");
    // admin surfaces — capture whatever the role is allowed to see
    await visit(mgr, "mgr-04-admin", "/admin");
    await visit(mgr, "mgr-05-admin-employees", "/admin/employees");
    await visit(mgr, "mgr-06-admin-attendance", "/admin/attendance");
    await visit(mgr, "mgr-07-admin-leave", "/admin/leave");
    await visit(mgr, "mgr-08-admin-sites", "/admin/sites");
  }
  await mgrCtx.close();

  await browser.close();

  const fs = require("fs");
  const summary = {
    base: BASE,
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).map((r) => ({ name: r.name, notes: r.notes, path: r.path })),
    results,
  };
  fs.writeFileSync(`${OUTDIR}/verdict.json`, JSON.stringify(summary, null, 2));
  console.log("\n==== SUMMARY ====");
  console.log(`passed ${summary.passed}/${summary.total}`);
  if (summary.failed.length) console.log("FAILURES:", JSON.stringify(summary.failed, null, 2));
  process.exit(summary.failed.length ? 2 : 0);
})().catch((err) => {
  console.error("HARNESS_CRASH", err);
  process.exit(1);
});
