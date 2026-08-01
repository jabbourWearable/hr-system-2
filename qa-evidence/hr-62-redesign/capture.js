// HR-62 visual evidence: Resend DESIGN.md redesign.
// Usage: node qa-evidence/hr-62-redesign/capture.js <email> <password>
// Signs up a fresh QA user (email confirmation is off), then captures the
// public + authenticated surfaces in dark (canonical) and light (derived).
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const OUTDIR = __dirname;

async function shot(page, name) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUTDIR}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

(async () => {
  const browser = await chromium.launch();

  // --- dark (canonical Resend palette) ---
  const dark = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });
  await dark.goto(`${BASE}/`);
  await shot(dark, "01-landing-dark");
  await dark.goto(`${BASE}/login`);
  await shot(dark, "02-login-dark");
  await dark.goto(`${BASE}/signup`);
  await shot(dark, "03-signup-dark");

  // sign up a fresh QA user (logs in immediately)
  await dark.fill("#fullName", "HR62 Design QA");
  await dark.fill("#email", EMAIL);
  await dark.fill("#password", PASSWORD);
  await dark.click('button[type="submit"]');
  await dark.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
  await shot(dark, "04-dashboard-dark");
  await dark.goto(`${BASE}/dashboard/leave`);
  await shot(dark, "05-leave-dark");
  await dark.goto(`${BASE}/dashboard/attendance`);
  await shot(dark, "06-attendance-history-dark");
  await dark.close();

  // --- light (derived variant, theme toggle preserved) ---
  const light = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
  });
  await light.goto(`${BASE}/`);
  await shot(light, "07-landing-light");
  await light.goto(`${BASE}/login`);
  await light.fill("#email", EMAIL);
  await light.fill("#password", PASSWORD);
  await light.click('button[type="submit"]');
  await light.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
  await shot(light, "08-dashboard-light");
  await light.close();

  await browser.close();
  console.log("done");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
